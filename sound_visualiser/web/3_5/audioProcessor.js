import FFT from 'https://cdn.skypack.dev/fft.js';

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

// Constants and Parameters for Pitch Detection
const DELTA1 = 0.025; // Threshold for peak detection
const DELTA2 = DELTA1 * 5; // Threshold for peak salience
const MAX_ITERATIONS = 10; // Maximum iterations for polyphonic pitch detection
const F_MIN = 27.5; // Minimum frequency to detect (Hz)
const F_MAX = 8000; // Maximum frequency to detect (Hz)
const M_LO = 10; // Minimum period (lag) to consider for pitch detection
const M_HI = 735; // Maximum period (lag) to consider for pitch detection
const M_MAX = 2048; // Maximum lag for ACF calculation

// State for the simple bandpass filter
var filterState = {
    prevPrevInput: 0,
    prevInput: 0,
    prevPrevOutput: 0,
    prevOutput: 0
};

// 2nd order bandpass filter
function bandpassFilter(input, lowCut, highCut, sampleRate) {
    // Filter coefficients (simplified - may need tuning)
    const f0 = (highCut + lowCut) / 2;
    const bw = highCut - lowCut;
    const Q = f0 / bw;
    const w0 = 2 * Math.PI * f0 / sampleRate;
    const alpha = Math.sin(w0) / (2 * Q);

    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;

    const inputSample = input;
    const outputSample = (b0 * inputSample + b1 * filterState.prevInput + b2 * filterState.prevPrevInput -
                          a1 * filterState.prevOutput - a2 * filterState.prevPrevOutput) / a0;

    // Update filter state
    filterState.prevPrevInput = filterState.prevInput;
    filterState.prevInput = inputSample;
    filterState.prevPrevOutput = filterState.prevOutput;
    filterState.prevOutput = outputSample;

    return outputSample;
}

// Compute the Auto-Correlation Function (ACF) using FFT
function computeACF(signal, N_r, gamma = 0.6) {
    const N = signal.length;
    const paddedSignal = new Float64Array(N_r);
    paddedSignal.set(signal);

    // Using fft.js for FFT
    const fftInstance = new FFT(N_r); // Use N_r for FFT size
    const complexSignal = fftInstance.toComplexArray(paddedSignal);
    const spectrum = new Float64Array(complexSignal.length);
    fftInstance.transform(spectrum, complexSignal);

    // Calculate power spectrum with compression (gamma)
    const powerSpectrum = [];
     for(let i = 0; i < spectrum.length; i += 2) {
         const magnitude = Math.sqrt(spectrum[i] * spectrum[i] + spectrum[i+1] * spectrum[i+1]);
         powerSpectrum.push(Math.pow(magnitude, gamma));
     }


    // Inverse FFT to get ACF
    const complexPowerSpectrum = new Float64Array(powerSpectrum.length * 2);
    for (let i = 0; i < powerSpectrum.length; i++) {
        complexPowerSpectrum[i * 2] = powerSpectrum[i];
        complexPowerSpectrum[i * 2 + 1] = 0; // Imaginary part is 0
    }

    const acfComplex = new Float64Array(complexPowerSpectrum.length);
    fftInstance.inverseTransform(acfComplex, complexPowerSpectrum);

    // ACF is the real part of the inverse FFT result
    const acf = [];
    for(let i = 0; i < acfComplex.length / 2; i += 2) {
         acf.push(acfComplex[i]);
    }

    // Normalize ACF (optional but often helpful)
    const acf0 = acf[0];
    if (acf0 > 0) {
        for (let i = 0; i < acf.length; i++) {
            acf[i] /= acf0;
        }
    }


    return acf.slice(0, N_r / 2); // Return only the meaningful part of the ACF
}

// Generate a Tukey window
function tukey(size, alpha = 0.5) {
    if (alpha <= 0 || alpha >= 1) {
        return new Float32Array(size).fill(1); // Rectangular window
    }

    const window = new Float32Array(size);
    const n1 = Math.floor(alpha * (size - 1) / 2);
    const n2 = size - 1 - n1;

    for (let n = 0; n < size; n++) {
        if (n < n1) {
            window[n] = 0.5 * (1 + Math.cos(Math.PI * (-1 + 2 * n / (alpha * (size - 1)))));
        } else if (n >= n2) {
            window[n] = 0.5 * (1 + Math.cos(Math.PI * (-alpha * (size - 1) + 2 * n) / (alpha * (size - 1))));
        } else {
            window[n] = 1;
        }
    }
    return window;
}

// Find peaks in an array above a certain height
function findPeaks(arr, height) {
    const peaks = [];
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] > height && arr[i] > arr[i - 1] && arr[i] > arr[i + 1]) {
            peaks.push(i);
        }
    }
    return peaks;
}

// function findPeaks(arr, height) {
//     const peaks = [];
//     const n = arr.length;
//     const guard_cells = 2; // per side
//     const training_cells = 25; // per side

//     // ensure data is large enough
//     if (n <= 2 * guard_cells) return peaks;

//     let current_amplitude_sum = 0;
//     let current_num_training_cells = 0;

//     // Sum and count for the right training window for index guard_cells
//     let initialRightTrainStart = 2 * guard_cells + 1;
//     let initialRightTrainEnd = Math.min(n - 1, 2 * guard_cells + training_cells);

//     if (initialRightTrainEnd >= initialRightTrainStart) {
//         for (let j = initialRightTrainStart; j <= initialRightTrainEnd; j++) current_amplitude_sum += arr[j];
//         current_num_training_cells = initialRightTrainEnd - initialRightTrainStart + 1;
//     }

//     if (current_num_training_cells > 0) { 
//         const dynamic_threshold = current_amplitude_sum / current_num_training_cells + height;
//         if (arr[guard_cells] > dynamic_threshold && arr[guard_cells] > arr[guard_cells - 1] && arr[guard_cells] > arr[guard_cells + 1]) {
//             peaks.push(guard_cells);
//         }
//     }

//     for (let i = guard_cells + 1; i < n - guard_cells; i++) {
//         // Element leaving left training window (was in window around i-1): index (i-1) - guard_cells - training_cells
//         let leftLeavingIndex = i - 1 - guard_cells - training_cells;
//         if (leftLeavingIndex >= 0) current_amplitude_sum -= arr[leftLeavingIndex];

//         // Element entering left training window (is in window around i): index i - guard_cells - 1
//         let leftEnteringIndex = i - guard_cells - 1; // index is always >= 0 for i >= guard_cells + 1
//         current_amplitude_sum += arr[leftEnteringIndex];

//         // Element leaving right training window (was in window around i-1): index (i-1) + guard_cells + 1 = i + guard_cells
//         let rightLeavingIndex = i + guard_cells; // index is always < n for i < n - guard_cells
//         current_amplitude_sum -= arr[rightLeavingIndex];

//         // Element entering right training window (is in window around i): index i + guard_cells + training_cells
//         let rightEnteringIndex = i + guard_cells + training_cells;
//         if (rightEnteringIndex < n) current_amplitude_sum += arr[rightEnteringIndex];

//         // The number of training cells changes only when the training windows hit array boundaries (0 or n-1).
//         // We calculate the size of the valid parts of the left and right training windows for the current index `i`.
//         let numLeftCells = 0;
//         let leftTrainStart = i - guard_cells - training_cells;
//         let leftTrainEnd = i - guard_cells - 1;
//         // Count elements in the range [Math.max(0, leftTrainStart), leftTrainEnd] if valid
//         if (leftTrainEnd >= Math.max(0, leftTrainStart)) numLeftCells = leftTrainEnd - Math.max(0, leftTrainStart) + 1;

//         let numRightCells = 0;
//         let rightTrainStart = i + guard_cells + 1;
//         let rightTrainEnd = i + guard_cells + training_cells;
//         if (Math.min(n - 1, rightTrainEnd) >= rightTrainStart) numRightCells = Math.min(n - 1, rightTrainEnd) - rightTrainStart + 1;

//         current_num_training_cells = numLeftCells + numRightCells;

//         if (current_num_training_cells > 0) {
//             const dynamic_threshold = current_amplitude_sum / current_num_training_cells + height;
//             if (arr[i] > dynamic_threshold && arr[i] > arr[i - 1] && arr[i] > arr[i + 1]) {
//                 peaks.push(i);
//             }
//         }
//     }

//     return peaks;
// }

// Compute the salience of peaks based on their harmonics
function computeSalience(sacf, peaks, m_max, delta1) {
    const peakSalience = [];
    for (const peak of peaks) {
        let salience = sacf[peak];
        let refinedPeak = peak;
        let tolerance = Math.floor(peak / 25 + 4);
        let peakCounter = 1;
        let previousPeak = peak;
        for (let k = 2; k <= Math.floor(m_max / peak); k++) {
            const estimate = previousPeak + peak;
            const searchRangeStart = Math.max(0, Math.floor(estimate - tolerance));
            const searchRangeEnd = Math.min(sacf.length, Math.floor(estimate + tolerance + 1));
            const searchRange = sacf.slice(searchRangeStart, searchRangeEnd);

            if (searchRange.length === 0) continue; // Avoid errors with empty search range

            const exact = searchRange.indexOf(Math.max(...searchRange)) + searchRangeStart;
            if (Math.abs(exact - estimate) < tolerance && sacf[exact] > delta1) {
                salience += sacf[exact];
                peakCounter++;
                refinedPeak += exact / k;
                previousPeak = exact;
            }
        }
        refinedPeak /= peakCounter;
        // Adjust salience based on the number of harmonics found
        salience *= Math.pow(peakCounter / (m_max / refinedPeak), 2);
        peakSalience.push([refinedPeak, salience]);
    }
    return peakSalience;
}

// Fit an exponential curve to a set of points (for peak pruning)
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

// Find the inflection points around a peak (where the slope changes sign)
function findInflection(sacf, center) {
    let left = Math.floor(center);
    let right = Math.ceil(center);

    // Search left for inflection point
    while (left > 0 && sacf[left] > sacf[left - 1]) {
        left--;
    }
    // Search right for inflection point
    while (right < sacf.length - 1 && sacf[right] > sacf[right + 1]) {
        right++;
    }
    return [left, right];
}

// Prune peaks from the ACF based on an exponential decay model
function prunePeakSeries(sacf, peaks, m_max, delta1) {
    // Create a copy to avoid modifying the original ACF array directly
    let prunedSacf = sacf.slice();

    const peakIndices = peaks.map(peak => Math.floor(peak[0]));
    if (peakIndices.length === 0) return prunedSacf;

    // Consider the most salient peak as the fundamental
    const bestPeakIndex = peakIndices[0];
    const peaksToRemove = [bestPeakIndex];
    const amplitudes = [prunedSacf[bestPeakIndex]];
    let basePeak = bestPeakIndex;
    let previousPeak = bestPeakIndex;
    let tolerance = Math.floor(bestPeakIndex / 25 + 4); // Tolerance for harmonic matching

    // Find potential harmonics of the fundamental
    for (let k = 2; k <= Math.floor(m_max / bestPeakIndex); k++) {
        const estimate = previousPeak + basePeak;
        const searchRangeStart = Math.max(0, Math.floor(estimate - tolerance));
        const searchRangeEnd = Math.min(prunedSacf.length, Math.floor(estimate + tolerance + 1));
        const searchRange = prunedSacf.slice(searchRangeStart, searchRangeEnd);

        if (searchRange.length === 0) continue;

        const exact = searchRange.indexOf(Math.max(...searchRange)) + searchRangeStart;
        const periodicityError = Math.abs(estimate - exact);

        // If a peak is found near the estimated harmonic position and is above the threshold
        if (periodicityError < tolerance && prunedSacf[exact] > delta1) {
            peaksToRemove.push(exact);
            amplitudes.push(prunedSacf[exact]);
            previousPeak = exact; // Use the found peak as the base for the next harmonic estimate
        }
    }

    // Fit an exponential to the found peak series
    let a, b;
    if (peaksToRemove.length > 1) {
        // Use the actual peak values for fitting
         const peakValuesForFit = peaksToRemove.map(idx => prunedSacf[Math.round(idx)]);
        [a, b] = fitExponential(peaksToRemove, peakValuesForFit);
    } else {
        a = 0;
        b = 0;
    }

    // Prune the identified peaks from the ACF
    for (const peak of peaksToRemove) {
        // Estimate the expected amplitude based on the fitted exponential
        const estimatedAmplitude = a * Math.exp(b * peak);
        // Find the region around the peak to apply pruning
        const [left, right] = findInflection(prunedSacf, peak);
         // Create a window based on the peak's shape
        const windowSize = right - left + 1;
        if (windowSize <= 0) continue; // Avoid issues with zero or negative size
        const window = tukey(windowSize, 0.2);

        // Create an inverse window based on the estimated amplitude
        const inverseWindow = window.map(w => 1 - Math.min(1, estimatedAmplitude / prunedSacf[Math.floor(peak)]) * w);

        // Apply the inverse window to the ACF to reduce the peak
        for (let i = left; i <= right; i++) {
             if (i >= 0 && i < prunedSacf.length) { // Ensure index is within bounds
                 prunedSacf[i] *= inverseWindow[i - left];
             }
        }
    }
    return prunedSacf;
}


// Iteratively detect polyphonic pitches from an audio frame
function polyphonicPitchDetectionIterative(audioFrame, fs) {
    const N = audioFrame.length;
    const N_r = 2 * N; // Size for ACF calculation (often 2*N)
    const window = tukey(N, 0.4); // Apply a window to the audio frame
    const frame = audioFrame.map((val, i) => val * window[i]);
    const lowBand = frame.map(sample => bandpassFilter(sample, F_MIN, 2250, fs));
    const filteredFrame = frame.map(sample => bandpassFilter(sample, 2250, F_MAX, fs));
    const highBand = filteredFrame.map(val => Math.max(0, val));

    const acfLow = computeACF(lowBand, N_r);
    const acfHigh = computeACF(highBand, N_r);
    var sacf = acfLow.map((val, i) => val + acfHigh[i]);

    const detectedPitches = [];

    // Iteratively find and prune peaks in the SACF
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // Find peaks within the defined pitch range
        let peaks = findPeaks(sacf, DELTA1).filter(peak => M_LO <= peak && peak <= M_HI);

        if (peaks.length === 0) break; // No more peaks found

        // Compute salience for the found peaks
        let peakSalience = computeSalience(sacf, peaks, M_MAX, DELTA1);
        peakSalience.sort((a, b) => b[1] - a[1]); // Sort by salience descending

        // If the most salient peak is below the salience threshold, stop
        if (peakSalience.length === 0 || peakSalience[0][1] < DELTA2) {
            // console.log("low salience, stopping iteration");
            break;
        }

        // Get the frequency of the most salient peak
        const fPitch = fs / peakSalience[0][0];

        // Add the detected pitch (as a note name)
        detectedPitches.push([fPitch, peakSalience[0][1]]);

        // Prune the detected pitch and its harmonics from the SACF
        sacf = prunePeakSeries(sacf, peakSalience, M_MAX, DELTA1);
    }
    return detectedPitches; 
}

// Module-level variables to hold the state
let sampleRate = 44100; // Sample rate
let chunk_size = 512; // Size of audio chunks processed at a time
let fftSize = 2048; // FFT window size
let C_t = 1.5; // Onset detection threshold multiplier
let H = 20; // History size for median calculation

// Circular buffers for history (using TypedArrays)
let eta_history;
let threshold_history;

// Audio buffer to hold a window of audio data
let audio_buffer;

// Hann window for FFT
let window;

// Buffers for phase and magnitude history
let prev_phases;
let prev_prev_phases;
let prev_mags;

let frame_count = 0; // Counter for processed frames

// Onset detection results state
let onsetDetected = false;
let onsetStrength = 0;

// FFT instance (created once)
let fftInstance;


// Initialization function (called once when the worker starts)
function initializeOnsetDetector(options = {}) {
    sampleRate = options.sampleRate || 44100;
    chunk_size = options.chunk_size || 512;
    fftSize = options.fftSize || 2048;
    hop_size = chunk_size;
    C_t = options.C_t || 1.5;
    H = options.H || 10;

    // Initialize circular buffers
    eta_history = new CircularQueue(H);
    threshold_history = new CircularQueue(3);

    // Initialize audio buffer and windows
    audio_buffer = new Float32Array(fftSize);
    window = generateHannWindow(fftSize);

    // Initialize phase and magnitude history buffers
    prev_phases = new Float32Array(fftSize / 2 + 1);
    prev_prev_phases = new Float32Array(fftSize / 2 + 1);
    prev_mags = new Float32Array(fftSize / 2 + 1);

    fftInstance = new FFT(fftSize);
}

// Generate a Hann window (moved from class method)
function generateHannWindow(size) {
    const window = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    return window;
}

// Process a chunk of audio data (moved from class method)
function processAudioChunk(dataArray) {
    // Append new data to the audio buffer (sliding window)
    for(let i = 0; i < fftSize - chunk_size; i++) {
        audio_buffer[i] = audio_buffer[i + chunk_size];
    }
    for(let i = 0; i < chunk_size; i++) {
        audio_buffer[fftSize - chunk_size + i] = dataArray[i];
    }

    // Process the current windowed frame
    const eta = processFrame();

    // Update history buffers
    updateBuffers(eta);

    // Check for onset
    onsetDetected = checkOnset();

    // If onset detected, perform pitch detection and prepare results
    let detectedPitches = [];
    if (onsetDetected) {
        // Get onset strength from history (value at the peak)
        onsetStrength = eta_history.getFromEnd(2);

        // Perform pitch detection on the current audio buffer window
        detectedPitches = polyphonicPitchDetectionIterative(audio_buffer.slice(), sampleRate);
    }

    // Return the detection results
    return {
        onsetDetected: onsetDetected,
        onsetStrength: onsetStrength,
        detectedPitches: detectedPitches
    };
}

// Process a single frame (calculate onset detection function value) (moved from class method)
function processFrame() {
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
        windowed[i] = audio_buffer[i] * window[i];
    }

    const complexSignal = fftInstance.toComplexArray(windowed);
    const output = new Float64Array(complexSignal.length);
    fftInstance.transform(output, complexSignal);

    const spectrum = [];
    for (let i = 0; i < fftSize / 2 + 1; i++) {
        spectrum.push({
            real: output[i * 2],
            imag: output[i * 2 + 1]
        });
    }

    const mags = spectrum.map(x => Math.sqrt(x.real ** 2 + x.imag ** 2));
    const phases = spectrum.map(x => Math.atan2(x.imag, x.real));

    const delta = phases.map((phase, i) => {
        let d = phase - prev_phases[i];
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        return d;
    });

    const unwrapped_phases = delta.map((d, i) => prev_phases[i] + d);

    let eta = 0.0;
    if (frame_count >= 2) {
        for (let k = 0; k < mags.length; k++) {
            const R_prev = prev_mags[k];
            const R_current = mags[k];

            const expected_phase = 2 * prev_phases[k] - prev_prev_phases[k];
            let d_phi = unwrapped_phases[k] - expected_phase;
             d_phi -= 2 * Math.PI * Math.round(d_phi / (2 * Math.PI));

            const gamma = Math.sqrt(R_prev ** 2 + R_current ** 2 -
                2 * R_prev * R_current * Math.cos(d_phi));
            eta += gamma;
        }
    }

    prev_prev_phases.set(prev_phases);
    prev_phases.set(unwrapped_phases);
    prev_mags.set(mags);

    frame_count++;

    return eta;
}

// Update circular buffers for history and calculate threshold (moved from class method)
function updateBuffers(eta) {

    eta_history.push(eta);
    if (eta_history.length >= H) {
        const current_threshold = C_t * eta_history.median();
        threshold_history.push(current_threshold);
    }
}

// Check for onset based on history and threshold (moved from class method)
function checkOnset() {
    if (eta_history.length < 3 || threshold_history.length < 3) {
        return false;
    }
    const prev_eta = eta_history.getFromEnd(2);
    const threshold = threshold_history.getFromEnd(2);
    const is_peak = (eta_history.getFromEnd(3) < prev_eta &&
                    eta_history.getFromEnd(1) < prev_eta);

    return is_peak && (prev_eta > threshold);
}

// Initialize the onset detector state when the worker starts
initializeOnsetDetector({
    sampleRate: 44100,
    chunk_size: 512,
    fftSize: 2048,
    H: 20,
    C_t: 1.3
});

// Listen for messages from the main thread
self.onmessage = function(event) {
    const message = event.data;

    switch (message.type) {
        case 'init':
            // Initialize worker with audio context parameters
            sampleRate = message.sampleRate;
            fftSize = message.fftSize;
            break;

        case 'audioData':
            // Received audio data buffer
            const audioFrame = new Float32Array(event.data.audioFrame);
    
            // Process the audio chunk using the module-level function
            const results = processAudioChunk(audioFrame);
    
            // Send the results back to the main thread
            self.postMessage({
                type: 'detectionResults',
                onsetDetected: results.onsetDetected,
                onsetStrength: results.onsetStrength,
                detectedPitches: results.detectedPitches
            });
            break;
    }
};