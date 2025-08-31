import numpy as np
import os
import pyaudio
import librosa
import matplotlib.pyplot as plt
from scipy.signal import butter, lfilter, find_peaks, remez
from scipy.signal.windows import tukey
from scipy.fftpack import fft, ifft
from scipy.linalg import toeplitz

# Constants and Parameters
NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
DELTA1 = 0.025
DELTA2 = 0.12#DELTA1*5
MAX_ITERATIONS = 10
F_MIN = 27.5
F_MAX = 4186.0
M_LO = 30
M_HI = 735
M_MAX = 2048

# Dynamic Thresholding Parameters
SLIDING_WINDOW_SIZE = 100  # Adjust based on desired temporal context (e.g., ~1 second)
SCALE_FACTOR = 1.5         # Scaling factor for median-based threshold

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
    # Compensate for energy loss
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

#https://github.com/sevagh/warped-linear-prediction
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

def compute_salience(sacf, peaks, m_max, dynamic_thresholds):
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
            if abs(exact - estimate) < tolerance and sacf[exact] > dynamic_thresholds[peak]:
                salience += sacf[exact]
                peak_counter += 1
                refined_peak += exact / k
            previous_peak = exact
        refined_peak /= peak_counter
        salience *= (peak_counter / (m_max / refined_peak)) ** 2
        peak_salience.append((refined_peak, salience))
    return peak_salience

def fit_exponential(x, y):
    # Solve for log y = log a + b*x
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

    # Collect peak positions and amplitudes
    for k in range(2, m_max // best_peak + 1):
        estimate = previous_peak + base_peak
        search_range = slice(max(0, int(estimate - tolerance)), 
                                 min(len(sacf), int(estimate + tolerance + 1)))
        exact = np.argmax(sacf[search_range]) + search_range.start
        periodicity_error = abs(estimate-exact)
        
        if periodicity_error < tolerance and sacf[exact] > delta1:
            peaks_to_remove.append(exact)
            amplitudes.append(sacf[exact])
        previous_peak = exact

    # Fit an exponential envelope to the peak amplitudes
    if len(peaks_to_remove) > 1:
        a, b = fit_exponential(peaks_to_remove, [sacf[round(x)] for x in peaks_to_remove])
    else:
        a, b = 0, 0  # Default values if insufficient data to fit

    # Prune each peak using the envelope
    for peak in peaks_to_remove:
        # Estimated amplitude of the peak
        estimated_amplitude = a * np.exp(b * peak)

        # Create a Tukey window around the peak
        left, right = find_inflection(sacf, peak)
        window = np.zeros(len(sacf))
        window[left:right + 1] = tukey(right - left + 1, alpha=0.2)

        # Scale window to remove the peak smoothly
        inverse_window = 1 - min(1, estimated_amplitude / sacf[peak]) * window
        sacf *= inverse_window

    return sacf

def dynamic_threshold(sacf, current_lag, M_LO, M_HI, window_size, scale_factor):
    # Define the analysis window around the current lag
    start = max(M_LO, current_lag - window_size // 2)
    end = min(M_HI, current_lag + window_size // 2)
    window = sacf[start:end+1]
    
    if len(window) == 0:
        return 0.025  # Fallback minimum threshold
    
    median_val = np.median(window)
    return max(median_val * scale_factor, 0.025)

def polyphonic_pitch_detection_iterative(audio_frame, fs):
    N = len(audio_frame)
    N_r = 2 * N

    # Preprocessing and SACF computation (same as original)
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
    for _ in range(MAX_ITERATIONS):
        # Compute dynamic thresholds for all lags
        dynamic_thresholds = [
            dynamic_threshold(sacf, m, M_LO, M_HI, SLIDING_WINDOW_SIZE, SCALE_FACTOR)
            for m in range(len(sacf))
        ]

        # Find peaks above local thresholds
        peaks, _ = find_peaks(sacf, height=np.median(sacf))
        peaks = [p for p in peaks if M_LO <= p <= M_HI and sacf[p] > dynamic_thresholds[p]]

        if not peaks:
            break

        # Compute salience with local delta1 and delta2
        peak_salience = compute_salience(sacf, peaks, M_MAX, dynamic_thresholds)
        peak_salience.sort(key=lambda x: x[1], reverse=True)

        if not peak_salience or peak_salience[0][1] < (dynamic_thresholds[round(peak_salience[0][0])] * 5):
            break  # Salience < local delta2 (5 * delta1)
        else:
            print(peak_salience[0][0], peak_salience[0][1], dynamic_thresholds[round(peak_salience[0][0])] * 5)
        # Select top peak and prune
        f_pitch = fs / peak_salience[0][0]
        detected_pitches.append(note_name(freq_to_number(f_pitch)))
        sacf = prune_peak_series(sacf, peak_salience, M_MAX, dynamic_thresholds[round(peak_salience[0][0])])

    return detected_pitches


def run_real_time_detection():
    fs = 44100
    N = 4096
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paFloat32, channels=1, rate=fs, input=True, frames_per_buffer=N)
    print("Listening for pitches... Press Ctrl+C to stop.")
    try:
        while True:
            audio_data = np.frombuffer(stream.read(N, exception_on_overflow=False), dtype=np.float32)
            pitches = polyphonic_pitch_detection_iterative(audio_data, fs)
            if pitches:
                print("Detected pitches:", pitches)
    except KeyboardInterrupt:
        print("Stopping detection.")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

if __name__ == "__main__":
    run_real_time_detection()