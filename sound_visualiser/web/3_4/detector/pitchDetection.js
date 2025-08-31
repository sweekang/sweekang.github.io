import FFT from 'https://cdn.skypack.dev/fft.js';

// Constants and Parameters
const NOTE_NAMES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
// const DELTA1 = 0.025;
// const DELTA2 = 0.12; //DELTA1*5
const DELTA1 = 0.005
const DELTA2 = DELTA1*5;
const MAX_ITERATIONS = 10;
const F_MIN = 27.5;
const F_MAX = 4186.0;
const M_LO = 30;
const M_HI = 735;
const M_MAX = 2048;
var filterState = {
    prevPrevInput: 0,
    prevInput: 0,
    prevPrevOutput: 0,
    prevOutput: 0
};

function freqToNumber(f) {
    return Math.round(49 + 12 * Math.log2(f / 440.0));
}

function noteName(n) {
    return NOTE_NAMES[(n % 12 + 12) % 12] + Math.floor((n + 8) / 12);
}

function bandpassFilter(input, lowCut, highCut, sampleRate) {
    // Simple 2nd order bandpass (adjust coefficients as needed)
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

    filterState.prevPrevInput = filterState.prevInput;
    filterState.prevInput = inputSample;
    filterState.prevPrevOutput = filterState.prevOutput;
    filterState.prevOutput = outputSample;

    return outputSample;
}

function computeACF(signal, N_r, gamma = 0.6) {
    const N = signal.length;
    const paddedSignal = new Float64Array(N_r);
    paddedSignal.set(signal);

    //Using fft.js for FFT
    const fftInstance = new FFT(N);
    const complexSignal = fftInstance.toComplexArray(paddedSignal);
    const spectrum = new Float64Array(complexSignal.length);
    fftInstance.transform(spectrum, complexSignal);

    const powerSpectrum = spectrum.map(x => Math.pow(Math.abs(x), gamma));

    //Inverse FFT to get ACF
    const complexPowerSpectrum = new Float64Array(powerSpectrum.length * 2);
    for (let i = 0; i < powerSpectrum.length; i++) {
        complexPowerSpectrum[i * 2] = powerSpectrum[i];
    }
    const acfComplex = new Float64Array(complexPowerSpectrum.length);
    fftInstance.inverseTransform(acfComplex, complexPowerSpectrum);
    const acf = acfComplex.slice(0, N_r / 2);

    return acf;
}

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

function findPeaks(arr, height) {
    const peaks = [];
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] > height && arr[i] > arr[i - 1] && arr[i] > arr[i + 1]) {
            peaks.push(i);
        }
    }
    return peaks;
}

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
            const exact = searchRange.indexOf(Math.max(...searchRange)) + searchRangeStart;
            if (Math.abs(exact - estimate) < tolerance && sacf[exact] > delta1) {
                salience += sacf[exact];
                peakCounter++;
                refinedPeak += exact / k;
                previousPeak = exact;
            }
        }
        refinedPeak /= peakCounter;
        salience *= Math.pow(peakCounter / (m_max / refinedPeak), 2);
        peakSalience.push([refinedPeak, salience]);
    }
    return peakSalience;
}

function fitExponential(x, y) {
    // Solve for log y = log a + b*x
    const weights = y.map(val => Math.log(Math.max(1e-10, val)));
    const A = x.map(xi => [xi, 1]);
    
    // Least squares solution (simplified)
    const AtA = A.reduce((acc, row) => acc.map((_, i) => row.reduce((sum, val, j) => sum + val * A[j][i], 0)), [[0, 0], [0, 0]]);
    const Atb = A.reduce((acc, row, i) => acc.map((_, j) => acc[j] + row[0] * weights[i]), [0, 0]);

    const det = AtA[0][0] * AtA[1][1] - AtA[0][1] * AtA[1][0];
    if (det === 0) {
        return [0, 0]; // Or handle singularity appropriately
    }
    const a = (AtA[1][1] * Atb[0] - AtA[0][1] * Atb[1]) / det;
    const b = (AtA[0][0] * Atb[1] - AtA[1][0] * Atb[0]) / det;

    return [Math.exp(b), a];
}

function findInflection(sacf, center) {
    let left = Math.floor(center);
    let right = Math.ceil(center);

    while (left > 0 && sacf[left] > sacf[left - 1]) {
        left--;
    }
    while (right < sacf.length - 1 && sacf[right] > sacf[right + 1]) {
        right++;
    }
    return [left, right];
}

function prunePeakSeries(sacf, peaks, m_max, delta1) {
    const peakIndices = peaks.map(peak => Math.floor(peak[0]));
    if (peakIndices.length === 0) return sacf;  // Handle empty peak list
    const bestPeak = peakIndices[0];
    const peaksToRemove = [bestPeak];
    const amplitudes = [sacf[bestPeak]];
    let basePeak = bestPeak;
    let previousPeak = bestPeak;
    let tolerance = Math.floor(bestPeak / 25 + 4);

    for (let k = 2; k <= Math.floor(m_max / bestPeak); k++) {
        const estimate = previousPeak + basePeak;
        const searchRangeStart = Math.max(0, Math.floor(estimate - tolerance));
        const searchRangeEnd = Math.min(sacf.length, Math.floor(estimate + tolerance + 1));
        const searchRange = sacf.slice(searchRangeStart, searchRangeEnd);
        const exact = searchRange.indexOf(Math.max(...searchRange)) + searchRangeStart;
        const periodicityError = Math.abs(estimate - exact);
        if (periodicityError < tolerance && sacf[exact] > delta1) {
            peaksToRemove.push(exact);
            amplitudes.push(sacf[exact]);
        }
        previousPeak = exact;
    }

    let a, b;
    if (peaksToRemove.length > 1) {
        [a, b] = fitExponential(peaksToRemove, peaksToRemove.map(x => sacf[Math.round(x)]));
    } else {
        a = 0;
        b = 0;
    }

    for (const peak of peaksToRemove) {
        const estimatedAmplitude = a * Math.exp(b * peak);
        const [left, right] = findInflection(sacf, peak);
        const window = new Float64Array(sacf.length);
        for (let i = left; i <= right; i++) {
            window[i] = tukey(right - left + 1, 0.2)[i - left];
        }
        const inverseWindow = window.map(w => 1 - Math.min(1, estimatedAmplitude / sacf[Math.floor(peak)]) * w);
        sacf = sacf.map((val, i) => val * inverseWindow[i]);
    }
    return sacf;
}

function polyphonicPitchDetectionIterative(audioFrame, fs) {
    const N = audioFrame.length;
    const N_r = 2 * N;
    const window = tukey(N, 0.4);
    const frame = audioFrame.map((val, i) => val * window[i]);
    const lowBand = frame.map(sample => bandpassFilter(sample, F_MIN, 2250, fs));
    const filteredFrame = frame.map(sample => bandpassFilter(sample, 2250, F_MAX, fs));
    const highBand = filteredFrame.map(val => Math.max(0, val));
    const acfLow = computeACF(lowBand, N_r);
    const acfHigh = computeACF(highBand, N_r);
    var sacf = acfLow.map((val, i) => val + acfHigh[i]);

    const detectedPitches = [];
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        let peaks = findPeaks(sacf, DELTA1).filter(peak => M_LO <= peak && peak <= M_HI);
        if (peaks.length === 0) break;
        let peakSalience = computeSalience(sacf, peaks, M_MAX, DELTA1);
        peakSalience.sort((a, b) => b[1] - a[1]);
        if (peakSalience[0][1] < DELTA2) {
            console.log("low salience")
            break;
        }
        const fPitch = fs / peakSalience[0][0];
        detectedPitches.push(noteName(freqToNumber(fPitch)));
        sacf = prunePeakSeries(sacf, peakSalience, M_MAX, DELTA1);
    }
    return detectedPitches;
}

export { polyphonicPitchDetectionIterative };