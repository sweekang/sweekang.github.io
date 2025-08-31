import numpy as np
import pyaudio
from scipy.signal import find_peaks
from scipy.fft import fft, ifft
import matplotlib.pyplot as plt
from itertools import chain

# =============================================
# CONFIGURATION 
# =============================================
FS = 44100
N_W = 4096        # 93 ms frame size
N_H = 1024        # 23 ms hop size
N_DFT = 8192      # FFT size
F0_RANGE = (27.5, 4186)  # A0-C8
NUM_BANDS = 8
INHARMONICITY_B = 0.0005
TONALNESS_THRESH = 0.7
PEAK_HEIGHT = 0.001

# =============================================
# CORE PROCESSING MODULES
# =============================================

def compute_fft(frame: np.ndarray) -> tuple:
    """Compute windowed FFT of audio frame"""
    window = np.hanning(len(frame))
    frame_windowed = frame * window / N_W  # Include normalization by N_W
    magnitude = np.abs(fft(frame_windowed, n=N_DFT))
    freqs = np.fft.fftfreq(N_DFT, 1/FS)[:N_DFT//2]
    return magnitude, freqs

def compute_tonalness(magnitude: np.ndarray) -> np.ndarray:
    """Compute tonalness using peakiness and amplitude threshold features (paper-based)"""
    tonal_scores = np.ones_like(magnitude)
    
    # =============================================
    # 1. PEAKINESS (PK) 
    # =============================================
    #The main lobe width of a Hanning window is 4π/N, which translates to 4 bins in the FFT
    m = 2 
    v_pk = np.zeros_like(magnitude)
    for k in range(len(magnitude)):
        left = max(0, k - m)
        right = min(len(magnitude)-1, k + m)
        v_pk[k] = (magnitude[left] + magnitude[right]) / (magnitude[k] + 1e-8)
    
    # Normalize PK
    epsilon_pk = 0.5
    t_pk = np.exp(-epsilon_pk * v_pk**2)
    tonal_scores *= t_pk
    
    # =============================================
    # 2. AMPLITUDE THRESHOLD (AT)
    # =============================================
    # Single-pole low-pass filter (forward + backward)
    alpha = 0.2  # Smoothing factor from paper
    r_th_forward = np.zeros_like(magnitude)
    
    # Forward pass
    r_th_forward[0] = magnitude[0]
    for k in range(1, len(magnitude)):
        r_th_forward[k] = alpha * r_th_forward[k-1] + (1 - alpha) * magnitude[k]
    
    # Backward pass
    r_th_backward = np.zeros_like(magnitude)
    r_th_backward[-1] = r_th_forward[-1]
    for k in range(len(magnitude)-2, -1, -1):
        r_th_backward[k] = alpha * r_th_backward[k+1] + (1 - alpha) * r_th_forward[k]
    
    # Compute tonal score for AT
    v_at = r_th_backward / (magnitude + 1e-8)
    t_at = np.clip(v_at, 0, 1)  # Clip as per paper
    tonal_scores *= t_at
    
    # =============================================
    # Combine features with geometric mean
    # =============================================
    tonalness = tonal_scores ** (1/2)
    
    return tonalness

def find_spectral_peaks(freqs: np.ndarray, spectrum: np.ndarray, tonal_mask: np.ndarray) -> list:
    """Improved spectral peak detection with local maxima and inharmonicity compensation"""
    # Find local maxima using scipy's find_peaks
    peaks, _ = find_peaks(spectrum[:len(freqs)], height=PEAK_HEIGHT*np.max(spectrum))
    
    valid_peaks = []
    for idx in peaks:
        # Apply tonalness and frequency range filters
        if not (tonal_mask[idx] > 0.7 and F0_RANGE[0] <= freqs[idx] <= F0_RANGE[1]):
            continue
            
        # Inharmonic partial search
        salience = 0
        for p in range(1, 4):
            expected_bin = idx * p #* np.sqrt(1 + INHARMONICITY_B * p**2)
            search_radius = int(N_DFT/3500)
            start = max(0, expected_bin - search_radius)
            end = min(len(spectrum)-1, expected_bin + search_radius)
            
            local_max_bin = start + np.argmax(spectrum[start:end+1])
            salience += spectrum[local_max_bin] ** 0.25
            
        valid_peaks.append((freqs[idx], salience))
    
    # Apply salience threshold
    max_salience = max([p[1] for p in valid_peaks], default=1e-8)
    return [p for p in valid_peaks if p[1] > 0.1**0.25 * max_salience]

def compute_prewhitening(spectrum: np.ndarray, freqs: np.ndarray) -> np.ndarray:
    spectrum = spectrum[:N_W]
    log_freqs = np.log(freqs + 1e-8)
    peaks, _ = find_peaks(spectrum, height=0.01 * np.max(spectrum))
    peaks = peaks[peaks < len(spectrum)]
    if len(peaks) == 0:
        return spectrum
    
    envelope = np.interp(log_freqs, log_freqs[peaks], spectrum[peaks])
    alpha = 20/N_W
    for _ in range(3):
        if len(envelope) > 2:
            envelope = np.convolve(envelope, [alpha, 1 - 2 * alpha, alpha], mode='same')
            envelope = np.convolve(envelope[::-1], [alpha, 1 - 2 * alpha, alpha], mode='same')[::-1]
    whitened = spectrum / (envelope + 1e-8)
    k_B = int(12000 / FS * N_DFT) #12kHz cut-offf normalisation
    return whitened * np.sqrt(np.sum(spectrum[:k_B]**2) / (np.sum(whitened[:k_B]**2) + 1e-8))

def compute_mcacf_bands(whitened_spectrum: np.ndarray, freqs: np.ndarray) -> list:
    """Implement linear-sloped octave band filters"""
    bands = []
    k_min = np.argmin(np.abs(freqs - F0_RANGE[0]))

    for c in range(NUM_BANDS):
        k_c = (2 ** c) * k_min
        band_filter = np.zeros(len(freqs))
        
        for i, f in enumerate(freqs):
            if f < 0.25 * freqs[k_c]:
                continue
            elif 0.25 * freqs[k_c] <= f < freqs[k_c]:
                band_filter[i] = (4/(3*freqs[k_c])) * f - 1/3
            elif freqs[k_c] <= f <= 2*freqs[k_c]:
                band_filter[i] = 1
            elif 2*freqs[k_c] < f < 20*freqs[k_c]:
                band_filter[i] = (-1/(18*freqs[k_c])) * f + 10/9
                
        # Normalize filter
        band_filter /= np.sum(band_filter)
        bands.append(np.real(ifft((whitened_spectrum[:N_W] * N_W)**0.5 * band_filter))[:N_W//2])

    return bands

def find_mcacf_peaks(bands: list) -> list:
    """Proper MCACF peak detection with lag ranges"""
    all_peaks = []
    max_peak = 0

    for c, acf in enumerate(bands):
        peaks_c = []

        # Find peaks in valid range
        peaks, _ = find_peaks(acf, height=0.001*acf[1])

        if peaks.size < 0:
            continue
        
        # plt.figure(figsize=(10, 6))
        # plt.plot(acf, label=f"ACF")
        # plt.plot(peaks, [acf[i] for i in peaks], "x")
        # plt.xlabel("Lag")
        # plt.ylabel("Amplitude")
        # plt.legend()
        # plt.show()

        # Calculate salience with multiple checking
        for peak in peaks:
            salience = 0
            for p in range(1, 4):
                expected_lag = peak * p #* np.sqrt(1 + INHARMONICITY_B * p**2)
                if expected_lag > len(acf):
                    continue

                # Search around expected lag
                start = max(0, expected_lag - int(FS/10000))
                end = min(len(acf)-1, expected_lag + int(FS/10000))
                salience += np.max(acf[start:end+1])

            peaks_c.append((FS/peak, salience, acf[peak]))
            max_peak = max(acf[peak], max_peak)
        all_peaks.append(peaks_c)

    all_peaks = filter(lambda peaks_c: max(peaks_c, key=lambda x:x[2])[2] >= 0.3 * max_peak, all_peaks)
    return list(chain(*all_peaks))

# =============================================
# POST-PROCESSING MODULES
# =============================================

def convert_freqs_to_semitones(frequencies: list) -> list:
    """Convert frequencies to semitone integers"""
    return [int(12 * np.log2(f/440) + 69) for f in frequencies]

def match_semitone_candidates(spectral_semis: list, mcacf_semis: list) -> list:
    """Find common semitones between spectral and MCACF candidates"""
    common = set(spectral_semis) & set(mcacf_semis)
    return [semitone_to_note(s) for s in common]

def combine_peaks(spectral_peaks: list, mcacf_peaks: list) -> list:
    """Paper-accurate salience combination with thresholding"""
    # Convert to semitone bins
    semitone_bins = {}
    
    # Process spectral peaks
    for freq, salience in spectral_peaks:
        semitone = int(12 * np.log2(freq/440) + 69)
        if semitone not in semitone_bins:
            semitone_bins[semitone] = {'spectral': 0, 'mcacf': 0}
        semitone_bins[semitone]['spectral'] = max(semitone_bins[semitone]['spectral'], salience)
    
    # Process MCACF peaks
    for freq, salience, _ in mcacf_peaks:
        semitone = int(12 * np.log2(freq/440) + 69)
        if semitone not in semitone_bins:
            semitone_bins[semitone] = {'spectral': 0, 'mcacf': 0}
        semitone_bins[semitone]['mcacf'] = max(semitone_bins[semitone]['mcacf']*10, salience)
    
    # Combine and threshold
    print(list(filter(lambda x:x[1]['spectral']*x[1]['mcacf'] != 0, semitone_bins.items())))
    final_notes = []
    for semitone, scores in semitone_bins.items():
        combined = scores['spectral'] * scores['mcacf']
        if combined > 3e-5:
            final_notes.append(semitone_to_note(semitone))
    
    return final_notes

# =============================================
# UTILITIES
# =============================================

def semitone_to_note(semitone: int) -> str:
    """Convert semitone number to note name"""
    notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    return f"{notes[semitone % 12]}{semitone//12 - 1}"

# =============================================
# MAIN PROCESSING PIPELINE
# =============================================

def process_frame(frame: np.ndarray):
    # Spectral analysis
    magnitude, freqs = compute_fft(frame)
    tonalness = compute_tonalness(magnitude)
    tonal_mask = tonalness > TONALNESS_THRESH
    
    # Rest of the pipeline remains similar
    spectral_peaks = find_spectral_peaks(freqs, magnitude, tonal_mask)
    whitened = compute_prewhitening(magnitude, freqs)
    bands = compute_mcacf_bands(whitened, freqs)
    mcacf_peaks = find_mcacf_peaks(bands)
    detected_notes = combine_peaks(spectral_peaks, mcacf_peaks)
    print(f"Detected notes: {detected_notes}")


# =============================================
# INITIALIZE & RUN
# =============================================
def run_real_time_detection():
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paFloat32, channels=1, rate=FS, input=True, frames_per_buffer=N_W)
    print("Listening for pitches... Press Ctrl+C to stop.")
    try:
        while True:
            audio_data = np.frombuffer(stream.read(N_W, exception_on_overflow=False), dtype=np.float32)
            process_frame(audio_data)
    except KeyboardInterrupt:
        print("Stopping detection.")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

if __name__ == "__main__":
    run_real_time_detection()
