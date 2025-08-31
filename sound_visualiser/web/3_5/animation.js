import {
    analyser,
    frequencyData
} from './audioHandler.js';

import {
    scene,
    composer,
    zStart,
    waveGroupLow,
    waveGroupHigh,
    particles,
    activeNoteIds,
    audioProcessorWorker,
    decayEstimatorWorker,
} from './sceneInitializer.js';
import FFT from 'https://cdn.skypack.dev/fft.js';

function animate(time) {
    // Request the next frame
    requestAnimationFrame(animate);

    // Get the audio data from analyser
    if (analyser) {
        let audioDataForWorker = new Float32Array(512); // Assuming audio processor chunk_size is 512
        let magnitudeDataForDecayEstimator = new Float32Array(2048 / 2 + 1); // Size of magnitude spectrum

        analyser.getByteFrequencyData(frequencyData);
        analyser.getFloatTimeDomainData(audioDataForWorker);

        audioProcessorWorker.postMessage({
            type: 'audioData',
            audioFrame: audioDataForWorker.buffer // Send the underlying ArrayBuffer
        }, [audioDataForWorker.buffer]); // Pass the buffer as a transferable object

        // for(let i = 0; i < frequencyData.length; i++) {
        //     magnitudeDataForDecayEstimator[i] = frequencyData[i] / 255.0;
        // }
        const fft = new FFT(2048);
        const complexSignal = fft.toComplexArray(audioDataForWorker);
        const spectrum = new Float64Array(complexSignal.length);
        fft.transform(spectrum, complexSignal);
        for(let i = 0; i < magnitudeDataForDecayEstimator.length; i++) {
            magnitudeDataForDecayEstimator[i] = Math.sqrt(spectrum[i*2]*spectrum[i*2] + spectrum[i*2+1]*spectrum[i*2+1]);
        }

        decayEstimatorWorker.postMessage({
            type: 'frequencyData',
            mags: magnitudeDataForDecayEstimator.buffer, 
        }, [magnitudeDataForDecayEstimator.buffer]);
    }

    // Update the wave group visualizations based on the new frequency data
    if (waveGroupLow) waveGroupLow.update();
    if (waveGroupHigh) waveGroupHigh.update();

    for (const [noteID, particle] of particles) {
        particle.update();
        particle.currPosition.z -= waveGroupHigh.currentSpeed;

        if (particle.getPosition().z < zStart || particle.getLightIntensity() < 0.1) {
            scene.remove(particle.getMesh());
            particle.disposeParticle();
            particles.delete(noteID);
            activeNoteIds.delete(noteID);
            decayEstimatorWorker.postMessage({ type: 'removeNote', noteId: noteID });
        }
    }

    composer.render();
}

export {
    animate
};
