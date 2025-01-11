import pyaudio
import wave
import scipy.io.wavfile as wavfile
import numpy as np
import pylab as pl

CHUNK = 1024
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
RECORD_SECONDS = 3

# frames=[]

# with wave.open('output.wav', 'wb') as wf:
#     p = pyaudio.PyAudio()
#     wf.setnchannels(CHANNELS)
#     wf.setsampwidth(p.get_sample_size(FORMAT))
#     wf.setframerate(RATE)

#     stream = p.open(format = FORMAT,
#                channels = CHANNELS,
#                rate = RATE,
#                input=True,
#                frames_per_buffer=CHUNK)

#     for _ in range(0, RATE // CHUNK * RECORD_SECONDS):
#         data = stream.read(CHUNK)
#         wf.writeframes(data)
#         frames.append(data)

#     stream.close()
#     p.terminate()

rate, data = wavfile.read('test.wav')
t = np.arange(len(data[:,0]))*1.0/rate
pl.plot(t, data[:,0])
pl.show()

p = 20*np.log10(np.abs(np.fft.rfft(data[:2048, 0])))
f = np.linspace(0, rate/2.0, len(p))
pl.plot(f, p)
pl.xlabel("Frequency(Hz)")
pl.ylabel("Power(dB)")
pl.show()