from numpy import log2
#https://en.wikipedia.org/wiki/Piano_key_frequencies

NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
def freq_to_number(f): return round(49 + 12*log2(f/440.0))
def number_to_freq(n): return 440 * 2.0**((n-49)/12.0)
def note_name(n): return NOTE_NAMES[n % 12 - 1] + str(int((n+8)/12))

print(note_name(freq_to_number(440))) #A4
print(note_name(freq_to_number(87.30706))) # F2
print(note_name(freq_to_number(3300))) # G#7