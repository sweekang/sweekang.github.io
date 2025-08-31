import numpy as np
import scipy.fft
import scipy.signal
import pyaudio
from collections import deque
from scipy.signal import butter, lfilter, find_peaks, remez
from scipy.signal.windows import tukey
from scipy.fftpack import fft, ifft

# Constants and Parameters for Pitch Detection
NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
DELTA1 = 0.025
DELTA2 = 0.12  # DELTA1*5
MAX_ITERATIONS = 10
F_MIN = 27.5
F_MAX = 4186.0
M_LO = 30
M_HI = 735
M_MAX = 2048

def freq_to_number(f):
    return round(49 + 12 * np.log2(f / 440.0))

def note_name(n):
    return NOTE_NAMES[(n % 12) - 1] + str((n + 8) // 12)

def butter_bandpass(lowcut, highcut, fs, order=2):
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(order, [low, high], btype="band")
    return b, a

def apply_filter(data, bandpass_filter):
    b, a = bandpass_filter
    filtered_data = lfilter(b, a, data)
    energy_ratio = np.sqrt(np.sum(data**2) / (np.sum(filtered_data**2) + 1e-10))
    return filtered_data * energy_ratio

def half_wave_rectify(data):
    return np.maximum(0, data)

def compute_acf(signal, N_r, gamma=0.6):
    signal = np.pad(signal, (0, N_r - len(signal)))
    spectrum = fft(signal)
    power_spectrum = np.abs(spectrum) ** gamma
    acf = np.real(ifft(power_spectrum))
    return acf[:N_r // 2]

def wfir(x, fs, order=8, coeff=0.72):
    B = [-coeff.conjugate(), 1]
    A = [1, -coeff]
    ys = [0] * order
    ys[0] = lfilter(B, A, x)
    for i in range(1, len(ys)):
        ys[i] = lfilter(B, A, ys[i - 1])
    l = 20
    r = min(20000, fs/2 - 1)
    t = 1
    c = remez(order+1, [0, l-t, l, r, r+t, 0.5*fs], [0, 1, 0], fs=fs)
    x_hat = c[0] * x
    for i in range(order):
        x_hat += c[i+1] * ys[i]
    r = x - x_hat
    return r

def compute_salience(sacf, peaks, m_max, delta1):
    peak_salience = []
    for peak in peaks:
        salience = sacf[peak]
        refined_peak = peak
        tolerance = peak / 25 + 4
        peak_counter = 1
        previous_peak = peak
        for k in range(2, m_max // peak + 1):
            estimate = previous_peak + peak
            search_range = slice(max(0, int(estimate - tolerance)), min(len(sacf), int(estimate + tolerance + 1)))
            exact = np.argmax(sacf[search_range]) + search_range.start
            if abs(exact - estimate) < tolerance and sacf[exact] > delta1:
                salience += sacf[exact]
                peak_counter += 1
                refined_peak += exact / k
            previous_peak = exact
        refined_peak /= peak_counter
        salience *= (peak_counter / (m_max / refined_peak)) ** 2
        peak_salience.append((refined_peak, salience))
    return peak_salience

def fit_exponential(x, y):
    weights = np.log(np.clip(y, a_min=1e-10, a_max=None))
    A = np.vstack([x, np.ones_like(x)]).T
    b, a = np.linalg.lstsq(A, weights, rcond=None)[0]
    return np.exp(a), b

def find_inflection(sacf, center):
    left = np.floor(center).astype(int)
    right = np.ceil(center).astype(int)
    while left > 0 and sacf[left] > sacf[left-1]:
        left -= 1
    while right < len(sacf) - 1 and sacf[right] > sacf[right+1]:
        right += 1
    return left, right

def prune_peak_series(sacf, peaks, m_max, delta1):
    peaks = [int(peak[0]) for peak in peaks]
    best_peak = peaks[0]
    peaks_to_remove = [best_peak]
    amplitudes = [sacf[best_peak]]
    base_peak = best_peak
    previous_peak = best_peak
    tolerance = best_peak/25 + 4
    for k in range(2, m_max // best_peak + 1):
        estimate = previous_peak + base_peak
        search_range = slice(max(0, int(estimate - tolerance)), min(len(sacf), int(estimate + tolerance + 1)))
        exact = np.argmax(sacf[search_range]) + search_range.start
        periodicity_error = abs(estimate-exact)
        if periodicity_error < tolerance and sacf[exact] > delta1:
            peaks_to_remove.append(exact)
            amplitudes.append(sacf[exact])
        previous_peak = exact
    if len(peaks_to_remove) > 1:
        a, b = fit_exponential(peaks_to_remove, [sacf[round(x)] for x in peaks_to_remove])
    else:
        a, b = 0, 0
    for peak in peaks_to_remove:
        estimated_amplitude = a * np.exp(b * peak)
        left, right = find_inflection(sacf, peak)
        window = np.zeros(len(sacf))
        window[left:right + 1] = tukey(right - left + 1, alpha=0.2)
        inverse_window = 1 - min(1, estimated_amplitude / sacf[peak]) * window
        sacf *= inverse_window
    return sacf

def polyphonic_pitch_detection_iterative(audio_frame, fs):
    N = len(audio_frame)
    N_r = 2 * N
    bp_low = butter_bandpass(F_MIN, 2250, fs, order=2)
    bp_high = butter_bandpass(2250, F_MAX, fs, order=2)
    window = tukey(N, alpha=0.4)
    frame = audio_frame * window
    frame_whitened = wfir(frame, fs=fs)
    low_band = apply_filter(frame_whitened, bp_low)
    high_band = half_wave_rectify(apply_filter(frame_whitened, bp_high))
    acf_low = compute_acf(low_band, N_r)
    acf_high = compute_acf(high_band, N_r)
    sacf = acf_low + acf_high
    detected_pitches = []
    for iteration in range(MAX_ITERATIONS):
        peaks = find_peaks(sacf, height=DELTA1)[0]
        peaks = [peak for peak in peaks if M_LO <= peak <= M_HI]
        if not peaks:
            break
        peak_salience = compute_salience(sacf, peaks, M_MAX, DELTA1)
        peak_salience.sort(key=lambda x: x[1], reverse=True)
        if peak_salience[0][1] < DELTA2:
            break
        f_pitch = fs / peak_salience[0][0]
        detected_pitches.append(note_name(freq_to_number(f_pitch)))
        sacf = prune_peak_series(sacf, peak_salience, M_MAX, DELTA1)
    return detected_pitches

class RealTimeOnsetDetector:
    def __init__(self, sr=44100, chunk_size=512, window_size=4096, C_t=1.5, H=10):
        self.sr = sr
        self.chunk_size = chunk_size
        self.window_size = window_size
        self.hop_size = chunk_size
        self.C_t = C_t
        self.H = H
        
        self.audio_buffer = np.zeros(window_size)
        self.window = scipy.signal.windows.hann(window_size)
        
        self.prev_phases = np.zeros(window_size//2 + 1)
        self.prev_prev_phases = np.zeros(window_size//2 + 1)
        self.prev_mags = np.zeros(window_size//2 + 1)
        
        self.eta_buffer = deque(maxlen=H)
        self.eta_history = deque(maxlen=3)
        self.threshold_history = deque(maxlen=3)
        self.frame_count = 0

    def process_frame(self):
        windowed = self.audio_buffer * self.window
        spectrum = scipy.fft.fft(windowed)[:self.window_size//2 + 1]
        mags = np.abs(spectrum)
        phases = np.angle(spectrum)
        
        delta = phases - self.prev_phases
        delta -= 2 * np.pi * np.round(delta / (2 * np.pi))
        unwrapped_phases = self.prev_phases + delta
        
        eta = 0.0
        if self.frame_count >= 2:
            for k in range(len(mags)):
                R_prev = self.prev_mags[k]
                R_current = mags[k]
                d_phi = unwrapped_phases[k] - 2*self.prev_phases[k] + self.prev_prev_phases[k]
                d_phi = np.angle(np.exp(1j * d_phi))
                gamma = np.sqrt(R_prev**2 + R_current**2 - 2*R_prev*R_current*np.cos(d_phi))
                eta += gamma
        
        self.prev_prev_phases = self.prev_phases.copy()
        self.prev_phases = unwrapped_phases.copy()
        self.prev_mags = mags.copy()
        self.frame_count += 1
        return eta

    def update_buffers(self, eta):
        self.eta_buffer.append(eta)
        self.eta_history.append(eta)
        if len(self.eta_buffer) >= self.H:
            current_threshold = self.C_t * np.median(self.eta_buffer)
            self.threshold_history.append(current_threshold)

    def check_onset(self):
        if len(self.eta_history) < 3 or len(self.threshold_history) < 3:
            return False
        prev_eta = self.eta_history[-2]
        threshold = self.threshold_history[-2]
        is_peak = (self.eta_history[-3] < prev_eta and self.eta_history[-1] < prev_eta)
        return is_peak and (prev_eta > threshold)

    def audio_callback(self, in_data, frame_count, time_info, status):
        new_chunk = np.frombuffer(in_data, dtype=np.float32)
        self.audio_buffer[:-self.chunk_size] = self.audio_buffer[self.chunk_size:]
        self.audio_buffer[-self.chunk_size:] = new_chunk
        
        eta = self.process_frame()
        self.update_buffers(eta)
        
        if self.check_onset():
            print(f"Onset detected! Strength: {self.eta_history[-2]:.2f}")
            detected_pitches = polyphonic_pitch_detection_iterative(self.audio_buffer.copy(), self.sr)
            if detected_pitches:
                print("Detected pitches:", detected_pitches)
        
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
    detector = RealTimeOnsetDetector(sr=44100, chunk_size=512, window_size=4096, H=20, C_t=1.3)
    detector.start()
    try:
        while True: pass
    except KeyboardInterrupt:
        detector.stop()
        print("\nStopped.")