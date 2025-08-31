let audioContext, analyser, microphoneSource;
let frequencyData;
const FFT_SIZE = 2048;
let sampleRate, frequencyPerBin, startBinLow, endBinLow, startBinHigh, endBinHigh;

async function initAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sampleRate = audioContext.sampleRate;
        microphoneSource = audioContext.createMediaStreamSource(stream);
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        microphoneSource.connect(analyser);

        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        frequencyPerBin = (sampleRate / 2) / analyser.frequencyBinCount;

        // Calculate frequency bins
        startBinLow = Math.floor(20 / frequencyPerBin);
        endBinLow = Math.ceil(1050 / frequencyPerBin);
        startBinHigh = Math.floor(260 / frequencyPerBin);
        endBinHigh = Math.ceil(4500 / frequencyPerBin);
    } catch(err) {
        console.error('Audio setup error:', err);
        alert('Microphone access required!');
    }
}

export {
    initAudio,
    analyser,
    frequencyData,
    startBinLow,
    endBinLow,
    startBinHigh,
    endBinHigh,
    sampleRate,
    frequencyPerBin,
    audioContext
};