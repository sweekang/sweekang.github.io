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

let scene, camera, renderer;
let waveGroupLow, waveGroupHigh;
let currBpm = 0;
var newNoteId = 0;
const zStart = 200;
const zEnd = 6000;
const gap = 30;

const particles = new Map(); // noteID: Particle

// Create the Web Workers for audio processing
const audioProcessorWorker = new Worker('audioProcessor.js', { type: 'module' });
const decayEstimatorWorker = new Worker('decayEstimator.js', { type: 'module' });
const pulseEstimatorWorker = new Worker('pulseEstimator.js', { type: 'module' });

function bpmToWaveSpeed(bpm) { // custom sigmoid with point (100, 5)
    return 20 / (1 + Math.exp(-0.0257*(bpm-140)));
}

// Set up the message handler for messages coming *from* the worker
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
                const newParticle = new Particle(note[0], note[1], [window.innerWidth*-0.5,window.innerWidth*0.5],
                                    [window.innerHeight*-0.5,window.innerHeight*0.5], new THREE.Vector3(0, 0, 2500));
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
    camera.lookAt(new THREE.Vector3(0, 0, zStart)); // Look towards the starting point of the waves

    scene.fog = new THREE.Fog( 0x2ad7c6, zStart, zEnd );

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create WaveGroup instances
    waveGroupLow = new WaveGroup(startBinLow, endBinLow, -window.innerHeight, false, zStart, gap, 0x00ff88, 5);
    waveGroupHigh = new WaveGroup(startBinHigh, endBinHigh, window.innerHeight, true, zStart, gap, 0xffa500, 5);
    // Add initial waves to the groups
    const numInitialWaves = (zEnd - zStart) / gap;
    waveGroupLow.addInitialWaves(numInitialWaves);
    waveGroupHigh.addInitialWaves(numInitialWaves);
    // Add the groups to the scene
    scene.add(waveGroupLow.getGroup());
    scene.add(waveGroupHigh.getGroup());

    createTestLights();
}

function createTestLights() {
    const geometry = new THREE.SphereGeometry(1,1,1);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00
    });
    const sphere = new THREE.Mesh(geometry, material);

    const directionalLight = new THREE.DirectionalLight(0x00ff00, 2);
    directionalLight.position.set(-600, 0, 500);
    directionalLight.target = sphere;
    scene.add(directionalLight);
    const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
    scene.add(directionalLightHelper);
    const light2 = new THREE.AmbientLight(0x404040, 1); // soft white light
    scene.add(light2);
}

export {
    init,
    scene,
    camera,
    renderer,
    zStart,
    waveGroupLow,
    waveGroupHigh,
    particles,
    activeNoteIds,
    audioProcessorWorker,
    decayEstimatorWorker
};
