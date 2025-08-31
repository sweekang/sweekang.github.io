// Window size for analyzing onsets (3 seconds)
const PULSE_WINDOW_MS = 3000; // milliseconds

// Buffer to store recent onset data: { timestamp: number, strength: number }
const onsetData = [];

// Minimum and maximum BPM to search for
const MIN_BPM = 40;
const MAX_BPM = 240;
// BPM = 60 / (IOI in seconds)
// IOI in ms = (60 / BPM) * 1000
const MIN_IOI = (60 / MAX_BPM) * 1000;
const MAX_IOI = (60 / MIN_BPM) * 1000;

// Number of tempo bins for the histogram
const NUM_TEMPO_BINS = 50;
const BIN_SIZE = (MAX_BPM - MIN_BPM) / NUM_TEMPO_BINS;

// Hann window for weighting onsets within the window
// Kind of like over-lap add
const hannWindowSize = Math.ceil(PULSE_WINDOW_MS);
const hannWindow = new Float32Array(hannWindowSize);

// Generate the Hann window once when the worker starts
for (let i = 0; i < hannWindowSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (hannWindowSize - 1)));
}


function estimateBPM() {
    const currentTime = performance.now(); // time from 3js

    // Remove data points older than window
    while (onsetData.length > 0 && onsetData[0].timestamp < currentTime - PULSE_WINDOW_MS) {
        onsetData.shift();
    }

    // not enough data
    if (onsetData.length < 2) return [null, null];

    // Calculate Inter Onset Intervals (IOIs) and their weighted strength
    const windowOnsets = onsetData.map(onset => {
        const timeInWindow = onset.timestamp - (currentTime - PULSE_WINDOW_MS); // time of onset relative to start of window
        const windowIndex = Math.floor(timeInWindow); // mapping time in ms to window index
        let weight = 0;

        if (windowIndex >= 0 && windowIndex < hannWindow.length) {
            weight = hannWindow[windowIndex];
        }
        return { timestamp: onset.timestamp, strength: onset.strength, windowWeight: weight };
    });


    const ioiWeightedStrengths = [];
    for (let i = 0; i < windowOnsets.length - 1; i++) {
        for (let j = i + 1; j < windowOnsets.length; j++) {
            const ioi = windowOnsets[j].timestamp - windowOnsets[i].timestamp; // Time difference in ms

            // Combine strengths and window weights
            const combinedStrength = windowOnsets[i].strength + windowOnsets[j].strength;
            const combinedWindowWeight = windowOnsets[i].windowWeight * windowOnsets[j].windowWeight;
            const finalWeight = combinedStrength * combinedWindowWeight;

            if (ioi >= MIN_IOI && ioi <= MAX_IOI) ioiWeightedStrengths.push({ ioi: ioi, weight: finalWeight });
            // Also consider half and double tempos, as these are common musical relationships, but weights are decreased
            if (ioi / 2 >= MIN_IOI && ioi / 2 <= MAX_IOI) ioiWeightedStrengths.push({ ioi: ioi / 2, weight: finalWeight*0.75 });
            if (ioi * 2 >= MIN_IOI && ioi * 2 <= MAX_IOI) ioiWeightedStrengths.push({ ioi: ioi * 2, weight: finalWeight*0.75 });
        }
    }

    // no valid IOIs
    if (ioiWeightedStrengths.length === 0) return [null, null];

    // Analyze IOIs using a weighted histogram
    // Initialize histogram bins with zero weight
    const bpmBins = new Float32Array(NUM_TEMPO_BINS).fill(0);

    // Populate the histogram with the weighted IOIs, and pick the highest weighted bin
    let maxBinWeight = 0;
    let bestBpmBinIndex = -1;
    let totalBinWeight = 0;
    for (const { ioi, weight } of ioiWeightedStrengths) {
        const bpm = 60 / (ioi / 1000); // Convert IOI (ms) to BPM
        if (bpm >= MIN_BPM && bpm <= MAX_BPM) { // Ensure BPM is within the defined range before binning (redundancy)
            const binIndex = Math.floor((bpm - MIN_BPM) / BIN_SIZE);
            // Add weight to the corresponding bin
            if (binIndex >= 0 && binIndex < NUM_TEMPO_BINS) {
                bpmBins[binIndex] += weight;
                totalBinWeight += weight;
                if (bpmBins[binIndex] > maxBinWeight) {
                    maxBinWeight = bpmBins[binIndex];
                    bestBpmBinIndex = binIndex;
                }
            }
        }
    }

    // Avoid reporting a BPM when there's very little rhythmic activity
    const MIN_BIN_WEIGHT_THRESHOLD = 0.1;
    if (maxBinWeight <= MIN_BIN_WEIGHT_THRESHOLD) return [null, null];

    // Estimate BPM from the winning bin.
    // Simple approach: use the center of the winning bin.
    // More advanced techniques could interpolate between bins or average contributing IOIs.
    const estimatedBPM = MIN_BPM + bestBpmBinIndex * BIN_SIZE + BIN_SIZE / 2;
    const confidence = Math.min(1, maxBinWeight/totalBinWeight);
    return [estimatedBPM, confidence];
}

// Listen for messages from the main thread
self.onmessage = function(event) {
    const message = event.data;

    switch (message.type) {
        case 'onset':
            // Received onset data: { type: 'onset', timestamp: number, strength: number }
            const { timestamp, strength } = message;
            onsetData.push({ timestamp: timestamp, strength: strength }); // Store in buffer

            // Estimate BPM every time a new onset arrives for responsiveness.
            const [estimatedBPM, confidence] = estimateBPM();

            // Post the estimated BPM back to the main thread if a valid estimate is available
            if (estimatedBPM !== null) {
                self.postMessage({
                    type: 'bpmResult',
                    bpm: estimatedBPM,
                    confidence: confidence
                });
            }
            break;
    }
};
