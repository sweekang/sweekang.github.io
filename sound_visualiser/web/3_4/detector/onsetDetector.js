import {
    audioContext,
    analyser
} from './audioHandler.js';
import {polyphonicPitchDetectionIterative} from './pitchDetection.js';
import {CircularQueue} from './circularQueueDS.js';
import FFT from 'https://cdn.skypack.dev/fft.js';

class RealTimeOnsetDetector {
    constructor(options = {}) {
        this.sr = options.sr || 22050;
        this.chunk_size = options.chunk_size || 512;
        this.window_size = options.window_size || 2048;
        this.hop_size = this.chunk_size;
        this.C_t = options.C_t || 1.5;
        this.H = options.H || 10;
        this.gainNode = audioContext.createGain();
        this.audio_buffer = new Float32Array(this.window_size);
        this.window = this.hann(this.window_size);
        this.prev_phases = new Float32Array(this.window_size / 2 + 1);
        this.prev_prev_phases = new Float32Array(this.window_size / 2 + 1);
        this.prev_mags = new Float32Array(this.window_size / 2 + 1);
        this.eta_buffer = new CircularQueue(this.H);
        this.eta_history = new CircularQueue(3);
        this.threshold_history = new CircularQueue(3);
        this.frame_count = 0;
        this.onsetDetected = false;
        this.onsetStrength = 0;
        this.fftInstance = new FFT(this.window_size); // Create FFT instance here
    }

    hann(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1));
        }
        return window;
    }

    async start() {
        analyser.connect(this.gainNode);
        this.gainNode.connect(audioContext.destination);
        this.processAudio();
    }

    stop() {
        analyser.disconnect();
        this.gainNode.disconnect();
    }

    processAudio() {
        const dataArray = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(dataArray);
        this.audio_buffer.set(this.audio_buffer.slice(this.chunk_size), 0);
        this.audio_buffer.set(dataArray.slice(0, this.chunk_size), this.audio_buffer.length - this.chunk_size);
        const eta = this.processFrame();
        this.updateBuffers(eta);
        this.onsetDetected = this.checkOnset();
        if (this.onsetDetected) {
            this.onsetStrength = this.threshold_history.getFromEnd(2);

            const detectedPitches = polyphonicPitchDetectionIterative(this.audio_buffer.slice(), audioContext.sampleRate);
            if (detectedPitches.length > 0) {
                console.log("Detected pitches: ", detectedPitches, "\nOnset Strength: ", this.onsetStrength);
            }
        }
        requestAnimationFrame(this.processAudio.bind(this));
    }

    processFrame() {
        const windowed = new Float32Array(this.window_size);
        for (let i = 0; i < this.window_size; i++) {
            windowed[i] = this.audio_buffer[i] * this.window[i];
        }

        const complexSignal = this.fftInstance.toComplexArray(windowed);
        const output = new Float64Array(complexSignal.length);
        this.fftInstance.transform(output, complexSignal);

        const spectrum = [];
        for (let i = 0; i < this.window_size / 2 + 1; i++) {
            spectrum.push({
                real: output[i * 2],
                imag: output[i * 2 + 1]
            });
        }
        
        const mags = spectrum.map(x => Math.sqrt(x.real ** 2 + x.imag ** 2));
        const phases = spectrum.map(x => Math.atan2(x.imag, x.real));
        const delta = phases.map((phase, i) => {
            let d = phase - this.prev_phases[i];
            d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
            return d;
        });
        const unwrapped_phases = delta.map((d, i) => this.prev_phases[i] + d);

        let eta = 0.0;
        if (this.frame_count >= 2) {
            for (let k = 0; k < mags.length; k++) {
                const R_prev = this.prev_mags[k];
                const R_current = mags[k];

                const d_phi = unwrapped_phases[k] - 2 * this.prev_phases[k] + this.prev_prev_phases[k];
                const gamma = Math.sqrt(R_prev ** 2 + R_current ** 2 - 
                    2 * R_prev * R_current * Math.cos(d_phi));
                eta += gamma;
            }
        }

        this.prev_prev_phases = this.prev_phases.slice();
        this.prev_phases = unwrapped_phases.slice();
        this.prev_mags = mags.slice();
        this.frame_count++;

        return eta;
    }

    updateBuffers(eta) {
        this.eta_history.push(eta);
        
        this.eta_buffer.push(eta);
        if (this.eta_buffer.length >= this.H) {
            const current_threshold = this.C_t * this.eta_buffer.median();
            this.threshold_history.push(current_threshold);
        }
    }

    checkOnset() {
        if (this.eta_history.length < 3 || this.threshold_history.length < 3) {
            return false;
        }
        const prev_eta = this.eta_history.getFromEnd(2);
        const threshold = this.threshold_history.getFromEnd(2);
        const is_peak = (this.eta_history.getFromEnd(3) < prev_eta &&
                        this.eta_history.getFromEnd(1) < prev_eta);

        return is_peak && (prev_eta > threshold);
    }
}

export {
    RealTimeOnsetDetector
};