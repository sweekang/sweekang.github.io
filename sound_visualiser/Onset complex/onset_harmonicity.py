#DOESN'T WORK!
import numpy as np
import scipy.fft
import scipy.signal
import pyaudio
from collections import deque

class RealTimeOnsetDetector:
    def __init__(self, sr=22050, chunk_size=512, window_size=2048, C_t=1.5, H=10):
        self.sr = sr
        self.chunk_size = chunk_size
        self.window_size = window_size
        self.hop_size = chunk_size
        self.C_t = C_t
        self.H = H
        
        # Audio processing buffers
        self.audio_buffer = np.zeros(window_size)
        self.window = scipy.signal.windows.hann(window_size)
        
        # Phase tracking
        self.prev_phases = np.zeros(window_size//2 + 1)
        self.prev_prev_phases = np.zeros(window_size//2 + 1)
        self.prev_mags = np.zeros(window_size//2 + 1)
        
        # Detection function and thresholding
        self.eta_buffer = deque(maxlen=H)  # For median calculation
        self.eta_history = deque(maxlen=3)  # For peak detection
        self.threshold_history = deque(maxlen=3)
        self.frame_count = 0

        # Harmonic structure check
        self.gamma_history = deque(maxlen=5)  # Store recent gamma arrays
        self.harmonic_threshold = 0.4  # Relative to fundamental gamma
        self.harmonic_decay = 0.6  # Allowable decay per harmonic

    def process_frame(self):
        windowed = self.audio_buffer * self.window
        spectrum = scipy.fft.fft(windowed)[:self.window_size//2 + 1]
        mags = np.abs(spectrum)
        phases = np.angle(spectrum)
        
        # Phase unwrapping
        delta = phases - self.prev_phases
        delta -= 2 * np.pi * np.round(delta / (2 * np.pi))
        unwrapped_phases = self.prev_phases + delta
        
        # Compute detection function
        eta = 0.0
        gamma_values = np.zeros(self.window_size//2 + 1)

        if self.frame_count >= 2:
            for k in range(len(mags)):
                R_prev = self.prev_mags[k]
                R_current = mags[k]
                
                d_phi = unwrapped_phases[k] - 2*self.prev_phases[k] + self.prev_prev_phases[k]
                d_phi = np.angle(np.exp(1j * d_phi))
                
                gamma = np.sqrt(
                    R_prev**2 + R_current**2 - 
                    2*R_prev*R_current*np.cos(d_phi)
                )
                gamma_values[k] = gamma
                eta += gamma
        
        # Update state variables
        self.prev_prev_phases = self.prev_phases.copy()
        self.prev_phases = unwrapped_phases.copy()
        self.prev_mags = mags.copy()
        self.frame_count += 1
        
        return eta, gamma_values

    def update_buffers(self, eta):
        # Update detection function buffer for median calculation
        self.eta_buffer.append(eta)
        
        # Update history for peak detection (with 2-frame delay)
        self.eta_history.append(eta)
        if len(self.eta_buffer) >= self.H:
            current_threshold = self.C_t * np.median(self.eta_buffer)
            self.threshold_history.append(current_threshold)

    def check_onset(self):
        if len(self.eta_history) < 3 or len(self.threshold_history) < 3:
            return False
        
        # Check if middle value is a local maximum
        prev_eta = self.eta_history[-2]
        threshold = self.threshold_history[-2]  # Corresponding threshold
        
        is_peak = (self.eta_history[-3] < prev_eta and 
                   self.eta_history[-1] < prev_eta)
        
        return is_peak and (prev_eta > threshold)
    
    def validate_harmonics(self, gamma_values):
        """Check harmonic structure using complex differences"""
        fundamental_bin = np.argmax(gamma_values)
        if fundamental_bin == 0:
            return False

        valid = True
        fundamental_gamma = gamma_values[fundamental_bin]
        
        # Check first 3 harmonics
        for harmonic in range(2, 5):
            harmonic_bin = int(fundamental_bin * harmonic)
            if harmonic_bin >= len(gamma_values):
                break
            
            expected_gamma = fundamental_gamma * (1/harmonic)
            actual_gamma = gamma_values[harmonic_bin]
            
            # Check both absolute and relative thresholds
            if (actual_gamma < self.harmonic_threshold * fundamental_gamma or
                actual_gamma < expected_gamma * self.harmonic_decay):
                valid = False
                break

        return valid

    def audio_callback(self, in_data, frame_count, time_info, status):
        new_chunk = np.frombuffer(in_data, dtype=np.float32)
        
        # Update audio buffer
        self.audio_buffer[:-self.chunk_size] = self.audio_buffer[self.chunk_size:]
        self.audio_buffer[-self.chunk_size:] = new_chunk
        
        # Process frame and update buffers
        eta, gamma_values = self.process_frame()
        self.gamma_history.append(gamma_values)
        self.update_buffers(eta)
        
        # Check for onsets with 2-frame delay
        if self.check_onset():
            # Get corresponding gamma values (2-frame delay)
            try:
                gamma_values = self.gamma_history[-3]
            except IndexError:
                return (None, pyaudio.paContinue)
            print(f"Strength: {self.eta_history[-2]:.2f}")
            
            if self.validate_harmonics(gamma_values):
                print(f"Harmonic Strength: {self.eta_history[-2]:.2f}")
        
        return (None, pyaudio.paContinue)

    def start(self):
        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=self.sr,
            input=True,
            output=False,
            frames_per_buffer=self.chunk_size,
            stream_callback=self.audio_callback
        )
        print("Listening for onsets...")

    def stop(self):
        self.stream.stop_stream()
        self.stream.close()
        self.p.terminate()

if __name__ == "__main__":
    detector = RealTimeOnsetDetector(H=20, C_t=1.3)
    detector.start()
    
    try:
        while True: pass
    except KeyboardInterrupt:
        detector.stop()
        print("\nStopped.")