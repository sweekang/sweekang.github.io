import pyaudio
import numpy as np
from scipy.linalg import eig
from scipy.signal import find_peaks

# MUSIC algorithm
def music_algorithm(cov_matrix, num_sources, freqs, sampling_rate):
    # Eigenvalue decomposition
    eigenvalues, eigenvectors = eig(cov_matrix)
    
    # Sort eigenvalues and eigenvectors in ascending order
    idx = np.argsort(eigenvalues)
    noise_subspace = eigenvectors[:, idx[:-num_sources]]  # Noise subspace
    
    # Compute the MUSIC pseudospectrum
    pseudospectrum = []
    for freq in freqs:
        steering_vector = np.exp(-1j * 2 * np.pi * np.arange(cov_matrix.shape[0]) * freq / sampling_rate)
        projection = np.linalg.norm(noise_subspace.conj().T @ steering_vector) ** 2
        pseudospectrum.append(1 / projection)
    
    return np.array(pseudospectrum)

# Detect the number of signals
def estimate_number_of_sources(cov_matrix, threshold=100):
    eigenvalues, _ = eig(cov_matrix)
    eigenvalues = np.sort(eigenvalues)[::-1]  # Descending order
    noise_floor = eigenvalues[-1]
    significant_eigenvalues = eigenvalues[eigenvalues > threshold * noise_floor]
    return len(significant_eigenvalues)

# Real-time audio processing
def process_audio(stream, sampling_rate, buffer_size, freq_range=(20, 4000)):
    print("Listening for piano notes...")
    freqs = np.linspace(freq_range[0], freq_range[1], 500)  # Frequency range for MUSIC
    num_channels = 8  # Number of virtual channels (for spatial smoothing)

    while True:
        # Read audio buffer
        audio_data = np.frombuffer(stream.read(buffer_size, exception_on_overflow=False), dtype=np.float32)
        
        # Autocorrelation matrix estimation
        reshaped_data = audio_data[:len(audio_data) // num_channels * num_channels].reshape(-1, num_channels)
        cov_matrix = np.cov(reshaped_data.T)
        
        # Estimate number of sources
        num_sources = estimate_number_of_sources(cov_matrix)
        print(f"Estimated number of notes: {num_sources}")
        
        # Apply MUSIC algorithm
        pseudospectrum = music_algorithm(cov_matrix, num_sources, freqs, sampling_rate)
        
        # Identify peak frequencies (notes)
        peaks, _ = find_peaks(pseudospectrum, height=np.max(pseudospectrum) * 0.5)
        peak_frequencies = freqs[peaks]
        print(f"Detected notes (Hz): {peak_frequencies}")

# Main function
def main():
    # Audio settings
    sampling_rate = 44100  # Sampling rate in Hz
    buffer_size = 4096  # Size of audio buffer

    # Initialize PyAudio
    p = pyaudio.PyAudio()
    stream = p.open(format=pyaudio.paFloat32,
                    channels=1,
                    rate=sampling_rate,
                    input=True,
                    frames_per_buffer=buffer_size)

    try:
        process_audio(stream, sampling_rate, buffer_size)
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()

if __name__ == "__main__":
    main()