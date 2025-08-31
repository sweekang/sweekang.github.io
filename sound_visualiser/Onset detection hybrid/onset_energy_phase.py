# This was not properly tested as I found the updated paper just before the first iteration

import pyaudio
import numpy as np
from collections import deque
import time

CHUNK = 1024                 # Frame size in samples
FORMAT = pyaudio.paFloat32   # 32-bit float audio
CHANNELS = 1                 # Mono
RATE = 44100                 # Sampling rate in Hz
WINDOW_TYPE = 'hann'         # Window function for FFT

# Auto-thresholding parameters
THRESHOLD_WINDOW_SECONDS = 5  # Time window for threshold estimation
FRAMES_PER_WINDOW = int((RATE / CHUNK) * THRESHOLD_WINDOW_SECONDS)
HIST_BINS = 50                # Number of bins in histogram

# Exponential weighting parameters
A = 30  # History depth for exponential smoothing
WEIGHTS = 1 / np.arange(1, A+1)  # Exponential weights (1/a)

# ================================================
class SubbandProcessor:
    def __init__(self, name, priority):
        self.name = name
        self.priority = priority
        self.detection_history = deque(maxlen=A)  # For smoothing
        self.threshold = None
        self.buffer = deque(maxlen=FRAMES_PER_WINDOW)

    def smooth_detection(self, new_value):
        if len(self.detection_history) < A:
            return new_value
            
        # Apply exponential weighting (Eq.13)
        weighted_sum = np.sum(np.array(self.detection_history) * WEIGHTS)
        self.detection_history.append(new_value)
        return new_value - weighted_sum
    
    def update_threshold(self, value):
        self.buffer.append(value)
        if len(self.buffer) < FRAMES_PER_WINDOW:
            return None
        
        # Auto-threshold using histogram curvature
        hist, bins = np.histogram(self.buffer, bins=HIST_BINS)
        bin_centers = (bins[:-1] + bins[1:])/2
        d2_hist = np.diff(hist, n=2)
        if len(d2_hist) < 1:
            return None
        
        max_idx = np.argmax(d2_hist)
        self.threshold = bin_centers[max_idx + 1]
    
class TEBand(SubbandProcessor):
    def __init__(self, name, priority):
        super().__init__(name, priority)
        self.phase_history = deque(maxlen=3)
    
    def compute_SE(self, magnitude, phase, T_tr=0.1): #T_tr being 2nd derivative threshold
        if len(self.phase_history) < 3:
            self.phase_history.append(phase)
            return None
            
        # Compute change in phase difference (Eq.4)
        # for steady state, phi(n) - phi(n-1) = phi(n-1) - phi(n-2) + change
        d2_phase = self.phase_history[0] - 2*self.phase_history[1] + phase
        transient_bins = np.abs(d2_phase) < T_tr
        
        # Transient energy (Eq.3)
        TE = np.sum(magnitude[transient_bins] ** 2)

        self.phase_history.append(phase)
        return TE

class DMBand(SubbandProcessor):
    def __init__(self, name, priority):
        super().__init__(name, priority)
        self.prev_mag = None

    def compute_SE(self, current_mag, *others):
        if self.prev_mag is None:
            self.prev_mag = current_mag.copy()
            return None
            
        # Compute normalized distance
        dX = current_mag - self.prev_mag # Eq.6
        DM = np.sum(dX[dX > 0] ** 2) # Eq.7
        # Eq.8
        norm = np.sum(self.prev_mag ** 2) + 1e-10 # prevents div by 0
        DM_norm = DM / norm

        self.prev_mag = current_mag.copy()
        return DM_norm

# ================================================
fft_bins = np.fft.rfftfreq(CHUNK, 1/RATE) # frequency ranges to FFT bins
# Subband definitions (frequency ranges in Hz)
processors = [
    {'processor': TEBand('S1', 0), 'range': np.where((fft_bins >= 5500) & (fft_bins < 11000))[0]},
    {'processor': TEBand('S2', 1), 'range': np.where((fft_bins >= 2500) & (fft_bins < 5500))[0]},
    {'processor': TEBand('S3_TE', 2), 'range': np.where((fft_bins >= 1200) & (fft_bins < 2500))[0]},
    {'processor': DMBand('S3_DM', 3), 'range': np.where((fft_bins >= 1200) & (fft_bins < 2500))[0]},
    {'processor': DMBand('S4', 4), 'range': np.where(fft_bins < 1100)[0]}
]

# Create window function
window = np.hanning(CHUNK)

# Initialize audio stream
p = pyaudio.PyAudio()
stream = p.open(format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK)

print("Starting audio stream. Press Ctrl+C to stop...")

try:
    while True:
        # Read and process audio frame
        data = stream.read(CHUNK, exception_on_overflow=False)
        audio_frame = np.frombuffer(data, dtype=np.float32)
        windowed = audio_frame * window
        fft = np.fft.rfft(windowed)
        magnitude = np.abs(fft)
        phase = np.unwrap(np.angle(fft))  # Unwrapped phases

        onsets = []
        
        for proc in processors:
            processor = proc["processor"]
            # Get subband-specific data
            sub_mag = magnitude[proc["range"]]
            sub_phase = phase[proc["range"]]
            
            # Compute detection value
            se = processor.compute_SE(sub_mag, sub_phase)
            det_val = proc["processor"].smooth_detection(se)
            
            if det_val is None:
                continue
                
            # Update threshold statistics
            processor.update_threshold(det_val)
            
            # Check for onset
            if processor.threshold is not None \
                and det_val > processor.threshold:
                onsets.append({
                    'time': time.time(),
                    'priority': processor.priority,
                    'name': processor.name
                })
        
        # Temporal fusion (50ms window with priority)
        if onsets:
            # Sort by priority and time
            onsets.sort(key=lambda x: (x['priority'], x['time']))
            # Group onsets within 50ms windows
            final_onsets = []
            last_onset = None
            for onset in onsets:
                if last_onset is None:
                    last_onset = onset
                    continue
                
                if (onset['time'] - last_onset['time']) <= 0.05:
                    # Keep higher priority onset
                    if onset['priority'] < last_onset['priority']:
                        last_onset = onset
                else:
                    final_onsets.append(last_onset)
                    last_onset = onset
            
            if last_onset is not None:
                final_onsets.append(last_onset)
            
            for onset in final_onsets:
                print(f"[{onset['name']}] Onset at {onset['time']:.3f}s")

            
except KeyboardInterrupt:
    print("\nExiting...")

finally:
    stream.stop_stream()
    stream.close()
    p.terminate()