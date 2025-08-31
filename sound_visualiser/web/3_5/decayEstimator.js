// --- Configuration and State ---
let sampleRate = 44100; // Default sample rate (should be initialized from main thread)
let fftSize = 2048; // Default FFT size (should be initialized from main thread)
let frequencyBinCount = fftSize / 2 + 1; // Number of frequency bins
let frequencyPerBin = (sampleRate / 2) / frequencyBinCount; // Hz per frequency bin

const DECAY_HISTORY_SIZE = 10; // Number of past magnitude scores to buffer for decay fitting
const HARMONIC_COUNT = 5; // Number of harmonics to consider for amplitude score
const MIN_AMPLITUDE_SCORE = 1e-6; // Minimum amplitude score to consider for fitting

// Map to store state for each tracked note: noteId -> { history: CircularQueue, detectedPitch: string }
const trackedNotes = new Map();

class CircularQueue {
    constructor(size) {
        this.buffer = new Float32Array(size);
        this.size = size;
        this.head = 0;
        this.length = 0;
    }

    push(value) {
        this.buffer[this.head] = value;
        this.head = (this.head + 1) % this.size;
        if (this.length < this.size) {
            this.length++;
        }
    }

    // Get elements in chronological order (oldest first)
    getElements() {
        const elements = new Array(this.length);
        let current = (this.head - this.length + this.size) % this.size;
        for (let i = 0; i < this.length; i++) {
            elements[i] = this.buffer[current];
            current = (current + 1) % this.size;
        }
        return elements;
    }

    // Access elements from the end (most recent first)
    getFromEnd(n) {
        if (n > this.length) {
            throw new Error("Not enough elements in buffer");
        }
        const index = (this.head - n + this.size) % this.size;
        return this.buffer[index];
    }

    median() {
        const elements = this.getElements();
        if (elements.length === 0) return 0;
        elements.sort((a, b) => a - b);
        const mid = Math.floor(elements.length / 2);
        return elements.length % 2 !== 0 ? elements[mid] : (elements[mid - 1] + elements[mid]) / 2;
    }
}

// --- Helper Functions ---

// Convert MIDI note number to frequency (Hz)
function midiToFreq(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Convert frequency (Hz) to frequency bin index
function freqToBin(frequency, sampleRate, fftSize) {
    const bin = frequency / (sampleRate / fftSize);
    return Math.round(bin);
}

// Calculate amplitude score for a note based on fundamental and weighted harmonics
function calculateAmplitudeScore(mags, fundamentalFreq, sampleRate, fftSize, harmonicCount) {
    let score = 0;
    const binCount = mags.length;

    for (let i = 1; i <= harmonicCount; i++) {
        const harmonicFreq = fundamentalFreq * i;
        const binIndex = freqToBin(harmonicFreq, sampleRate, fftSize);

        // sum within surrounding bins
        for (let j = 0; j < 3; j++) {
            // Ensure bin index is within bounds
            if (binIndex+j < binCount) {
                const weight = 1 / i;
                score += mags[binIndex+j] * weight;
            } else {
                // Stop if harmonics go beyond the frequency range
                break;
            }
        }
        if (binIndex > binCount) break;
    }
    return score;
}

// Fit an exponential curve (y = a * exp(b * x)) to data points (x: frame index, y: amplitude score)
// Returns [a, b] where b is the decay rate. A negative b indicates decay.
function fitExponential(x, y) {
    const n = x.length;
    if (n < 2) return [0, 0]; // Need at least two points

    const logY = y.map(val => Math.log(Math.max(1e-10, val)));

    let sumX = 0, sumLogY = 0, sumX2 = 0, sumXLogY = 0;
    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumLogY += logY[i];
        sumX2 += x[i] * x[i];
        sumXLogY += x[i] * logY[i];
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
        return [0, 0]; // Avoid division by zero
    }

    const b = (n * sumXLogY - sumX * sumLogY) / denominator;
    const logA = (sumLogY - b * sumX) / n;
    const a = Math.exp(logA);

    return [a, b]; // Returns [a, b] for y = a * exp(b * x)
}

// --- Worker Message Handling ---

// Listen for messages from the main thread
self.onmessage = function(event) {
    const message = event.data;

    switch (message.type) {
        case 'init':
            // Initialize worker with audio context parameters
            sampleRate = message.sampleRate;
            fftSize = message.fftSize;
            frequencyBinCount = fftSize / 2 + 1;
            frequencyPerBin = (sampleRate / 2) / frequencyBinCount;
            // console.log(`Decay Estimator Worker initialized with SR: ${sampleRate}, FFT Size: ${fftSize}`);
            break;

        case 'addNote':
            // Add a new note to track decay for
            // Message should include: { type: 'addNote', noteId: array of number, detectedPitch: array of float }
            const { noteIds, detectedPitches } = message;

            for (let i=0; i<noteIds.length; i++) {
                if (!trackedNotes.has(noteIds[i])) {
                    trackedNotes.set(noteIds[i], {
                        history: new CircularQueue(DECAY_HISTORY_SIZE),
                        detectedPitch: detectedPitches[i][0],
                        decayRate: 0 // Initialize decay rate
                    });
                    // console.log(`Tracking decay for Note ID: ${noteIds[i]}, Pitch: ${detectedPitches[i][0]}`);
                }
            }
            break;

        case 'frequencyData':
            // Receive frequency magnitude data and process decay for tracked notes
            // Message should include: { type: 'frequencyData', mags: Float32Array, frame: number }
            const mags = new Float32Array(message.mags);
            const decayResults = [];

            // Iterate through tracked notes and update their decay status
            for (const [id, noteState] of trackedNotes.entries()) {
                // Calculate the amplitude score for this note in the current frame
                const amplitudeScore = calculateAmplitudeScore(
                    mags,
                    noteState.detectedPitch,
                    sampleRate,
                    fftSize,
                    HARMONIC_COUNT
                );
            
                // Push the new amplitude score to the note's history buffer
                noteState.history.push(amplitudeScore);

                if (noteState.history.size == noteState.history.length) {
                    // If the history buffer is full, fit an exponential curve and estimate decay rate
                    const historyData = noteState.history.getElements();
                    // Create x-axis data (frame indices relative to the buffer)
                    const x = Array.from({ length: DECAY_HISTORY_SIZE }, (_, i) => i);

                    const [a, b] = fitExponential(x, historyData);

                    // The 'b' parameter is the decay rate. A more negative value means faster decay.
                    noteState.decayRate = b;

                    // Send decay rate back to the main thread
                    decayResults.push({
                        noteId: id,
                        decayRate: noteState.decayRate,
                        detectedPitch: noteState.detectedPitch,
                    });
                    // console.log(noteState.detectedPitch, noteState.decayRate)
                }
            }
            // Post decay results back to the main thread
            if (decayResults.length > 0) {
                self.postMessage({
                    type: 'decayResults',
                    decayingNotes: decayResults
                });
            }

            break;

        case 'removeNote':
             // Remove a note from tracking
             // Message should include: { type: 'removeNote', noteId: number }
             const noteIdToRemove = message.noteId;
             if (trackedNotes.has(noteIdToRemove)) {
                trackedNotes.delete(noteIdToRemove);
                //  console.log(`Stopped tracking decay for Note ID: ${noteIdToRemove}`);
             }
             break;

        default:
            console.warn('Decay Estimator Worker: Unknown message type', message.type);
    }
};