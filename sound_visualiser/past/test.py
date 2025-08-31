import numpy as np
import os, pyaudio, librosa, time
from scipy.signal import butter, lfilter
from scipy.signal.windows import tukey
from scipy.fftpack import fft, ifft
from scipy.linalg import toeplitz

NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
def freq_to_number(f): return round(49 + 12*np.log2(f/440.0))
def note_name(n): return NOTE_NAMES[n % 12 - 1] + str(int((n+8)/12))

def polyphonic_pitch_detection_iterative(audio_frame, fs):
    """
    Real-time polyphonic pitch detection for a single audio frame.
    
    Args:
        audio_frame (np.array): Audio frame to process.
        fs (int): Sampling frequency.

    Returns:
        list: Detected pitches in Hz for the audio frame.
    """
    # Parameters
    N = len(audio_frame)  # Block length (frame size)
    N_r = 2 * N  # Zero-padded length for ACF
    delta1 = 0.025  # Peak position tolerance
    delta2 = 0.12  # Peak detection threshold
    max_iterations = 10  # Maximum number of iterations
    f_min = 27.5  # Minimum frequency for an 88-key piano (Hz)
    f_max = 4186.0  # Maximum frequency for an 88-key piano (Hz)
    m_lo = 30  # Minimum period for base peak
    m_hi = 735 # Maximum period for base peak
    m_max = 2048  # Maximum period for multiples of peak (harmonics)

    # Precompute bandpass filters
    bp_low = butter_bandpass(27.5, 2250, fs, order=2)
    bp_high = butter_bandpass(2250, 8000, fs, order=2)

    # Windowing
    window = tukey(N, alpha=0.4)

    # Preprocessing
    frame = audio_frame * window
    frame_whitened = pre_whiten(frame, order=8, warping_factor=0.72)

    # Bandpass filtering
    low_band = apply_filter(frame_whitened, bp_low)
    high_band = apply_filter(frame_whitened, bp_high)
    high_band = half_wave_rectify(high_band)

    # Periodicity Estimation
    acf_low = compute_acf(low_band, N_r)
    acf_high = compute_acf(high_band, N_r)
    sacf = acf_low + acf_high

    # Iterative Periodicity Analysis
    detected_pitches = []
    for _ in range(max_iterations):
        # Find peaks in SACF above delta1
        peaks = find_peaks(sacf, threshold=delta1, m_lo=m_lo, m_hi=m_hi)
        if not peaks:
            break

        # Compute periodicity salience
        peak_salience = compute_salience(sacf, peaks, m_max, delta1)
        peak_salience.sort(key=lambda x:x[1], reverse=True)

        if peak_salience[0][1] < delta2:
            break
        
        # Convert period to frequency
        f_pitch = fs / peak_salience[0][0]
        detected_pitches.append(note_name(freq_to_number(f_pitch)))

        # Remove peak series from SACF
        sacf = prune_peak_series(sacf, peak_salience, m_max, delta1)

    return detected_pitches

# Utility Functions
def butter_bandpass(lowcut, highcut, fs, order=2):
    nyquist = 0.5 * fs
    low = lowcut / nyquist
    high = highcut / nyquist
    b, a = butter(order, [low, high], btype="band")
    return b, a

def apply_filter(data, bandpass_filter):
    b, a = bandpass_filter
    return lfilter(b, a, data)

def half_wave_rectify(data):
    return np.maximum(0, data)

def pre_whiten(signal, order=8, warping_factor=0.72):
    """
    Perform pre-whitening of the input signal using warped linear prediction (WLP).

    Args:
        signal (np.array): Input audio signal.
        order (int): Order of the prediction filter (default is 8).
        warping_factor (float): Warping coefficient for WLP (default is 0.72).

    Returns:
        np.array: Pre-whitened signal.
    """
    # Apply the warped autocorrelation method
    autocorr = warped_autocorrelation(signal, warping_factor, order + 1)
    
    # Solve the Yule-Walker equations to get LPC coefficients
    r = autocorr[:order + 1]
    R = toeplitz(r[:-1])
    a = np.linalg.solve(R, -r[1:])
    a = np.concatenate(([1], a))  # LPC coefficients (including leading 1 for AR model)

    # Apply the inverse filter to the signal
    whitened_signal = lfilter(a, [1], signal)
    return whitened_signal

def warped_autocorrelation(signal, warping_factor, length):
    """
    Compute the warped autocorrelation of a signal using the given warping factor.

    Args:
        signal (np.array): Input audio signal.
        warping_factor (float): Warping coefficient for WLP.
        length (int): Length of the autocorrelation.

    Returns:
        np.array: Warped autocorrelation values.
    """
    # Initialize the warped autocorrelation array
    warped_r = np.zeros(length)

    # Compute the warped autocorrelation iteratively
    z = signal
    for i in range(length):
        warped_r[i] = np.sum(z * signal)
        z = np.roll(z, 1) * warping_factor
        z[0] = 0  # Ensure no feedback across time

    return warped_r

def compute_acf(signal, N_r):
    """Compute the autocorrelation function (ACF)."""
    gamma = 0.6 # non linear distortion
    signal = np.pad(signal, (0, N_r - len(signal)))
    spectrum = fft(signal)
    power_spectrum = np.abs(spectrum) ** gamma
    acf = np.real(ifft(power_spectrum))
    return acf[:N_r // 2]

def find_peaks(acf, threshold, m_lo, m_hi):
    """Find local maxima in ACF within valid range."""
    peaks = []
    for m in range(m_lo, m_hi):
        if acf[m] > threshold and acf[m] > acf[m - 1] and acf[m] > acf[m + 1]:
            peaks.append(m)
    return peaks

def compute_salience(sacf, peaks, m_max, delta1):
    """Calculate salience for each peak in SACF."""
    peak_salience = []
    for peak in peaks:
        base_peak = peak
        refined_peak = peak
        tolerance = peak/25 + 4
        peak_counter = 1
        previous_peak = peak
        salience = sacf[peak]
        for k in range(2, m_max // peak + 1):
            estimate = previous_peak + base_peak

            search_range = slice(max(0, int(estimate - tolerance)), 
                                 min(len(sacf), int(estimate + tolerance + 1)))
            exact = np.argmax(sacf[search_range]) + search_range.start
            periodicity_error = abs(estimate-exact)

            if periodicity_error < tolerance and sacf[exact] > delta1:
                salience += sacf[exact]
                peak_counter += 1
                refined_peak += exact/k
            previous_peak = exact

        refined_peak /= peak_counter
        salience = salience * (peak_counter/(m_max/refined_peak))**2
        peak_salience.append((refined_peak, salience))
       
    return peak_salience

def prune_peak_series(sacf, peaks, m_max, delta1):
    """
    Remove peak series from the SACF starting with the most salient peak.
    
    Args:
        sacf (np.array): Summary autocorrelation function (SACF).
        best_peak (int): Position of the strongest peak (base period).
        m_max (int): Maximum lag to consider multiples.

    Returns:
        np.array: Pruned SACF with the peak series removed.
    """
    # Initialize variables
    best_peak = int(peaks[0][0])
    peaks_to_remove = [best_peak]
    amplitudes = [sacf[best_peak]]

    base_peak = best_peak
    previous_peak = best_peak
    tolerance = best_peak/25 + 4

    # Fit an exponential envelope to the peak amplitudes
    if len(peaks) > 1:
        a, b = fit_exponential([x[0] for x in peaks], [sacf[round(x[0])] for x in peaks])
    else:
        a, b = 0, 0  # Default values if insufficient data to fit

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

# Helper Functions
def find_local_max(sacf, candidate, tolerance=4):
    """
    Find the local maximum near the candidate position within a tolerance range.
    
    Args:
        sacf (np.array): Summary autocorrelation function (SACF).
        candidate (int): Approximate peak position.
        tolerance (int): Range to search for the local maximum.

    Returns:
        int or None: Position of the local maximum or None if no peak is found.
    """
    left = max(0, candidate - tolerance)
    right = min(len(sacf), candidate + tolerance + 1)
    local_max = np.argmax(sacf[left:right])
    max_pos = left + local_max

    if sacf[max_pos] > sacf[max_pos - 1] and sacf[max_pos] > sacf[max_pos + 1]:
        return max_pos
    return None

def find_inflection(sacf, center):
    left = np.floor(center).astype(int)
    right = np.ceil(center).astype(int)

    while left > 0 and sacf[left] > sacf[left-1]:
        left -= 1
    while right < len(sacf) - 1 and sacf[right] > sacf[right+1]:
        right += 1
    return left, right

def fit_exponential(peaks, amplitudes):
    """
    Fit an exponential curve to the peaks: S(m) = a * exp(b * m).

    Args:
        peaks (list): List of peak positions.
        amplitudes (list): List of corresponding peak amplitudes.

    Returns:
        tuple: Parameters a and b of the exponential fit.
    """
    if len(peaks) < 2:
        return 1, 0  # Default values if insufficient data

    # Convert to numpy arrays
    peaks = np.array(peaks)
    amplitudes = np.array(amplitudes)

    # Fit log(amplitudes) = log(a) + b * m
    log_amplitudes = np.log(amplitudes + 1e-10)  # Avoid log(0)
    coefficients = np.polyfit(peaks, log_amplitudes, 1)
    return np.exp(coefficients[1]), coefficients[0]

def run_real_time_detection():
    """
    Run real-time polyphonic pitch detection using a microphone.
    """
    fs = 44100  # Sampling rate
    N = 4096  # Frame size
    hop_size = 1024  # Overlap

    # Initialize PyAudio
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paFloat32,
                    channels=1,
                    rate=fs,
                    input=True,
                    frames_per_buffer=N)

    print("Listening for pitches... Press Ctrl+C to stop.")

    try:
        while True:
            # Read audio data from the microphone
            audio_data = np.frombuffer(stream.read(N, exception_on_overflow=False), dtype=np.float32)
            
            # Run pitch detection on the current audio frame
            pitches = polyphonic_pitch_detection_iterative(audio_data, fs)
            
            # Filter pitches within the 88-key piano range
            pitches = [note_name(freq_to_number(p)) for p in pitches if 27.5 <= p <= 4186.0]

            # Print detected pitches
            if pitches:
                print("Detected pitches (Hz):", pitches)

    except KeyboardInterrupt:
        print("\nStopping detection.")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

# load audio file
# if __name__ == "__main__":

#     # Load audio
#     path = os.path.dirname(os.path.abspath(__file__))
#     filepath = os.path.join(path, "TRIOS Dataset/mozart/piano.wav")
#     audio, fs = librosa.load(filepath, sr=None)

#     # Run pitch detection
#     pitches = polyphonic_pitch_detection_iterative(audio, fs)
#     print(pitches)

# Run the real-time detection
if __name__ == "__main__":
    run_real_time_detection()