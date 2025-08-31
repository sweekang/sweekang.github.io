import numpy as np
import pyaudio
import time
from scipy.signal import butter, sosfilt, find_peaks
from scipy.signal.windows import tukey
from scipy.optimize import curve_fit

# Constants
RATE = 44100  # Audio sample rate
CHUNK = 4096  # Number of samples per audio chunk
ORDER = 2  # Order of Butterworth filter
DISTORTION = 0.6  # ACF distortion factor
TAPER = 0.4  # Tukey tapering factor
M_LO, M_HI = 30, 735  # Min and max lag for periodicity estimation
PEAK_THRESHOLD = 0.025  # Threshold for peak detection
MAX_LAG = 2048  # Maximum lag considered for peak multiples
SALIENCE_THRESHOLD = 0.12  # Minimum salience for valid peaks

# Piano note names
NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]

# Helper functions for note detection
def freq_to_number(f): 
    return round(49 + 12 * np.log2(f / 440.0))

def note_name(n): 
    return NOTE_NAMES[n % 12 - 1] + str(int((n + 8) / 12))

# Bandpass filter
def bandpass_filter(signal, lowcut, highcut):
    sos = butter(ORDER, [lowcut, highcut], btype='band', fs=RATE, output='sos')
    return sosfilt(sos, signal)

# ACF calculation
def calculate_acf(signal):
    # Apply Tukey window
    window = tukey(len(signal), alpha=TAPER)
    signal *= window

    # Compute autocorrelation using the Wiener–Khinchin theorem
    spectrum = np.fft.fft(signal, n=2 * len(signal))  # Zero-padding for better resolution
    power_spectrum = np.abs(spectrum) ** DISTORTION
    acf = np.fft.ifft(power_spectrum).real[:len(signal)]
    return acf

# SACF calculation
def calculate_sacf(signal):
    low_band = bandpass_filter(signal, 60, 2250)
    high_band = bandpass_filter(signal, 2250, 5000)

    # Compute SACF by summing ACFs of two filtered bands
    sacf = calculate_acf(low_band) + calculate_acf(high_band)
    sacf /= np.max(sacf)  # Normalize
    return sacf

# Periodicity salience calculation
def periodicity_salience(sacf):
    peaks, _ = find_peaks(sacf, height=PEAK_THRESHOLD)
    peaks = [p for p in peaks if M_LO <= p <= M_HI]
    
    results = []
    for peak in peaks:
        tolerance = 4 + peak / 25
        salience = sacf[peak]
        num_peaks = 1
        multiples = [(peak, 1)]

        for k in range(2, MAX_LAG // peak):
            predicted_pos = peak * k
            if predicted_pos >= len(sacf):
                break

            search_range = slice(
                max(0, int(predicted_pos - tolerance)),
                min(len(sacf), int(predicted_pos + tolerance + 1))
            )
            local_max = np.argmax(sacf[search_range]) + search_range.start

            if abs(local_max - predicted_pos) < tolerance:
                salience += sacf[local_max]
                multiples.append((local_max, k))
                num_peaks += 1

        refined_peak = sum(map(lambda x: x[0] / x[1], multiples)) / num_peaks
        salience *= (num_peaks * MAX_LAG / refined_peak) ** 2
        results.append((refined_peak, salience))

    return results

# Peak removal
def remove_peak(sacf, peak):
    tolerance = 4 + peak / 25  # Tolerance for peak multiples
    max_lag = len(sacf)
    peak_series = [(peak, sacf[int(peak)])]  # Store (lag, amplitude) for the peak series

    # Collect multiples of the base peak
    for k in range(2, MAX_LAG // int(peak) + 1):
        multiple = peak * k
        if multiple >= max_lag:
            break

        # Search for the local max near the predicted multiple
        search_range = slice(
            max(0, int(multiple - tolerance)),
            min(max_lag, int(multiple + tolerance + 1))
        )
        local_max = np.argmax(sacf[search_range]) + search_range.start

        # Add the valid multiple to the peak series
        if abs(local_max - multiple) < tolerance:
            peak_series.append((local_max, sacf[local_max]))

    # Extract lags and amplitudes from the peak series
    lags = np.array([p[0] for p in peak_series])
    amplitudes = np.array([p[1] for p in peak_series])

    # Find inflection points for the entire peak series
    left = int(min(lags))
    right = int(max(lags))

    # Fit an exponential envelope to the peak series
    # log(y) = b * x + log(a)
    log_amplitudes = np.log(np.clip(amplitudes, a_min=1e-10, a_max=None))
    A = np.vstack([lags, np.ones_like(lags)]).T
    b, log_a = np.linalg.lstsq(A, log_amplitudes, rcond=None)[0]
    envelope = np.exp(log_a) * np.exp(b * np.arange(left, right + 1))

    # Create a Tukey window for the width of the peak series
    window = tukey(len(envelope), alpha=0.2)
    inverse_window = 1 - (envelope / np.max(envelope)) * window

    # Apply the inverse Tukey window to remove the peak series
    sacf[left:right + 1] *= inverse_window
    return sacf

# Pitch detection
def detect_pitch(signal):
    notes = []
    sacf = calculate_sacf(signal)
    results = periodicity_salience(sacf)

    while results:
        # Find the peak with the highest salience
        picked_peak = max(results, key=lambda x: x[1])
        lag, salience = picked_peak

        # Check salience threshold
        if salience < SALIENCE_THRESHOLD:
            break

        # Convert lag to frequency
        freq = RATE / lag
        notes.append(note_name(freq_to_number(freq)))

        # Remove the detected peak and recalculate
        sacf = remove_peak(sacf, lag)
        results = periodicity_salience(sacf)

    return notes

# Audio callback
def audio_callback(in_data, frame_count, time_info, status):
    global audio_buffer
    audio_buffer = np.frombuffer(in_data, dtype=np.int16).astype(np.float32)
    return (in_data, pyaudio.paContinue)

# Main function
def main():
    global audio_buffer
    audio_buffer = np.zeros(CHUNK, dtype=np.float32)

    # Initialize PyAudio
    p = pyaudio.PyAudio()
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=RATE,
        input=True,
        frames_per_buffer=CHUNK,
        stream_callback=audio_callback
    )

    stream.start_stream()
    print("Listening for notes... Press Ctrl+C to stop.")

    try:
        while stream.is_active():
            if np.any(audio_buffer):
                notes = detect_pitch(audio_buffer)
                if notes:
                    print(f"Detected Notes: {', '.join(set(notes))}")
    except KeyboardInterrupt:
        print("Stopping...")

    stream.stop_stream()
    stream.close()
    p.terminate()

if __name__ == "__main__":
    main()
