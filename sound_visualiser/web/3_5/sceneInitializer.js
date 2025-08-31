import * as THREE from 'three';

import {
    initAudio,
    startBinLow,
    endBinLow,
    startBinHigh,
    endBinHigh
} from './audioHandler.js';
import { WaveGroup } from './waveGroup.js';
import { Particle } from './particles.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

let scene, camera, renderer, composer;
let waveGroupLow, waveGroupHigh;
let currBpm = 0;
var newNoteId = 0;
const zStart = 200;
const zEnd = 6000;

const particles = new Map(); // noteID: Particle

// Create the Web Workers for audio processing
const audioProcessorWorker = new Worker('audioProcessor.js', { type: 'module' });
const decayEstimatorWorker = new Worker('decayEstimator.js', { type: 'module' });
const pulseEstimatorWorker = new Worker('pulseEstimator.js', { type: 'module' });

function bpmToWaveSpeed(bpm) { // custom sigmoid with point (100, 5)
    return 20 / (1 + Math.exp(-0.0257*(bpm-140)));
}

// Set up the message handler for messages coming from the worker
audioProcessorWorker.onmessage = function(event) {
    if (event.data.type === 'detectionResults') {
        const { onsetDetected, onsetStrength, detectedPitches } = event.data;

        // If an onset was detected by the worker, create a sphere on the main thread
        if (onsetDetected && detectedPitches.length > 0) {
            const noteIds = [];

            for (let note of detectedPitches) {    
                newNoteId = (newNoteId + 1) % 1021; // we should have < 1021 notes at once
                noteIds.push(newNoteId);
                // Create a particle for the new notes
                const newParticle = new Particle(note[0], note[1], 
                                    [window.innerWidth*-0.5,window.innerWidth*0.5],
                                    [window.innerHeight*-0.5,window.innerHeight*0.5]);
                particles.set(newNoteId, newParticle);
                scene.add(newParticle.getMesh());

                // console.log("Detected pitches: ", detectedPitches, "\nOnset Strength: ", onsetStrength);
            }
            // Tell the decay estimator worker to start tracking
            decayEstimatorWorker.postMessage({
                type: 'addNote',
                noteIds: noteIds,
                detectedPitches: detectedPitches
            });
            //  Send onset timestamp to the Pulse Estimator Worker
            pulseEstimatorWorker.postMessage({
                type: 'onset',
                timestamp: performance.now(), // time from 3js
                strength: onsetStrength
            });
        }
        // Note: The worker handles resetting its internal onsetDetected flag.
    }
};

audioProcessorWorker.onerror = function(error) {
    console.error('Audio Worker Error:', error);
};

const activeNoteIds = new Map();
// Handle messages from the Decay Estimator Worker
decayEstimatorWorker.onmessage = function(event) {
    if (event.data.type === 'decayResults') {
        const { decayingNotes } = event.data;
        // Update particles based on results
        for (const noteInfo of decayingNotes) {
            if (activeNoteIds.has(noteInfo.noteId)) {
            activeNoteIds.set(noteInfo.noteId, {decayRate: noteInfo.decayRate});
            particles.get(noteInfo.noteId).setDecayRate(noteInfo.decayRate);}
        }
    }
};

// Handle potential errors from the decay estimator worker
decayEstimatorWorker.onerror = function(error) {
    console.error('Decay Estimator Worker Error:', error);
};

//Handle messages from Pulse Estimator Worker
pulseEstimatorWorker.onmessage = function(event) {
    if (event.data.type === 'bpmResult') {
        const estimatedBPM = event.data.bpm;
        const confidence = event.data.confidence;

        if (currBpm == 0) currBpm = estimatedBPM;
        else currBpm = estimatedBPM * confidence + currBpm * (1 - confidence);

        const targetWaveSpeed = bpmToWaveSpeed(currBpm);
        waveGroupLow.setEasing(confidence);
        waveGroupHigh.setEasing(confidence);
        waveGroupLow.setTargetSpeed(targetWaveSpeed);
        waveGroupHigh.setTargetSpeed(targetWaveSpeed);

        // console.log("EstimatedBPM: ", estimatedBPM, " at confidence: ", confidence, " new bpm: ", currBpm, "new speed: ", targetWaveSpeed )
    }
};

// Handle potential errors from the pulse estimator worker
pulseEstimatorWorker.onerror = function(error) {
    console.error('Pulse Estimator Worker Error:', error);
};

async function init() {
    // Initialize audio on the main thread (AudioContext and AnalyserNode must be here)
    await initAudio();

    // Initialize workers with necessary parameters (sample rate, FFT size)
    audioProcessorWorker.postMessage({
        type: 'init',
        sampleRate: 44100,
        fftSize: 2048
    });
    decayEstimatorWorker.postMessage({
        type: 'init',
        sampleRate: 44100,
        fftSize: 2048
    });

    // Set up Three.js scene, camera, and renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, zStart, zEnd);
    camera.position.set(0, 0, 0);
    camera.lookAt(new THREE.Vector3(0, -2, zStart));

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMappingExposure = 1;
    document.body.appendChild(renderer.domElement);
    
    composer = new EffectComposer( renderer );
    composer.addPass( new RenderPass( scene, camera ) );
    const bloomParams = {
        threshold: 0.1, // Minimum luminance value to be affected by bloom
        strength: 1, // The intensity of the bloom effect
        radius: 0.8 // The radius of the bloom effect
    };
    const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), bloomParams.strength, bloomParams.radius, bloomParams.threshold );
    composer.addPass( bloomPass );
    bloomPass.renderToScreen = true;

    // Create WaveGroup instances
    waveGroupLow = new WaveGroup(startBinLow, endBinLow, -window.innerHeight*1.25, false, zStart, 5);
    waveGroupHigh = new WaveGroup(startBinHigh, endBinHigh, window.innerHeight*1.25, true, zStart, 5);
    // Add initial waves to the groups
    const numInitialWaves = (zEnd - zStart) / 30;
    waveGroupLow.addInitialWaves(numInitialWaves, 30);
    waveGroupHigh.addInitialWaves(numInitialWaves, 30);
    // Add the groups to the scene
    scene.add(waveGroupLow.getGroup());
    scene.add(waveGroupHigh.getGroup());

    const light1 = new THREE.PointLight(0xff00A1, 30, 0, 0);
    const light2 = new THREE.PointLight(0x00fff7, 30, 0, 0); 
    const light3 = new THREE.PointLight(0xff7300, 30, 0, 0); 
    const light4 = new THREE.PointLight(0x90fe00, 30, 0, 0); 
    light1.position.set(window.innerWidth, window.innerHeight+500, 750);
    light2.position.set(window.innerWidth, window.innerHeight+500, 1000);
    light3.position.set(-window.innerWidth, -window.innerHeight+500, 750);
    light4.position.set(-window.innerWidth, -window.innerHeight+500, 1000);
    //scene.add(light1); scene.add(light2); scene.add(light3); scene.add(light4);
}

export {
    init,
    scene,
    camera,
    renderer,
    composer,
    zStart,
    waveGroupLow,
    waveGroupHigh,
    particles,
    activeNoteIds,
    audioProcessorWorker,
    decayEstimatorWorker
};
