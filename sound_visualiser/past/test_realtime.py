import numpy as np
import pyaudio
from collections import defaultdict

#RATE = 44100
RATE = 16000 #number of samples to be captured by mic per second
CHANNELS = 1 #microphone audio channels (mono audio)
CHUNK_SIZE = 8192 #number of samples to be processed at once
SAMPLE_LENGTH = int(CHUNK_SIZE*1000/RATE) #length of each sample (in ms)
AMPLITUDE_CHANGE = 5000 #threshold for change in amplitude

#https://en.wikipedia.org/wiki/Piano_key_frequencies
NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
def freq_to_number(f): return round(49 + 12*np.log2(f/440.0))
def number_to_freq(n): return 440 * 2.0**((n-49)/12.0)
def note_name(n): return NOTE_NAMES[n % 12 - 1] + str(int((n+8)/12))

#open audio stream
p = pyaudio.PyAudio()
stream = p.open(format=pyaudio.paInt16, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK_SIZE)

#store magnitudes for all notes
prev_magnitudes = defaultdict(lambda: 0)
attack_detected = defaultdict(lambda: False)
attack_start_time = defaultdict(lambda: None)
TIME_WINDOW_SIZE = 0.5  # Time window in seconds for attack detection
previous_time = 0  # Previous time stamp for detecting time to peak

try:
    while True:
        #read data from stream
        raw_data = stream.read(CHUNK_SIZE)
        audio_data = np.frombuffer(raw_data, dtype=np.int16)

        #apply Hanning window to the audio data
        #should hopefully make frequencies more defined?
        hanning_window = np.hanning(len(audio_data))
        audio_data = audio_data * hanning_window

        #perform FFT
        fft_data = np.fft.fft(audio_data) 
        magnitude = np.abs(fft_data)
        frequencies = np.fft.fftfreq(len(fft_data), d=1/RATE)
        positive_frequencies = frequencies[:len(frequencies)//2] #slice positive part only (since the FFT output is symmetric)
        positive_magnitude = magnitude[:len(magnitude)//2]

        #bin frequencies and detect changes
        bins = defaultdict(lambda: 0)
        for i in range(len(positive_frequencies)):
            freq = positive_frequencies[i]
            if freq > 4310:  # out of piano range (> C8)
                break
            elif freq < 26:  # out of piano range (< A0)
                continue

            note = note_name(freq_to_number(freq))
            bins[note] = positive_magnitude[i]

            # Detect change in amplitude (amplitude increase)
            amplitude_change = abs(bins[note] - prev_magnitudes[note])
            current_time = i * SAMPLE_LENGTH  # current time in seconds

            if amplitude_change >= AMPLITUDE_CHANGE and not attack_detected[note]:
                # Mark the start of the attack for this note
                attack_start_time[note] = current_time
                print(f"Attack detected for {note} at time: {attack_start_time[note]:.3f} seconds")
                attack_detected[note] = True  # Mark attack as detected

            # Track the time to peak (maximum amplitude)
            if attack_detected[note]:
                # Calculate time to peak (in seconds)
                time_to_peak = current_time - attack_start_time[note]
                if bins[note] == max(bins[note], bins[note]):
                    print(f"Time to peak for {note}: {time_to_peak:.3f} seconds")

            # Reset attack detection after amplitude decreases
            if bins[note] < prev_magnitudes[note] / 2:  # If amplitude drops back down
                attack_detected[note] = False
                attack_start_time[note] = None  # Reset the attack start time

            # Update previous magnitude for next iteration
            prev_magnitudes[note] = bins[note]

except KeyboardInterrupt:
    print("programme ended")

finally:
    # Close the stream
    stream.stop_stream()
    stream.close()
    p.terminate()