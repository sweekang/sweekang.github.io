import * as THREE from 'three';
import {
    initAudio,
    startBinLow,
    endBinLow,
    startBinHigh,
    endBinHigh
} from './audioHandler.js';
import {
    WaveGroup
} from './waveGroup.js';
import {
    RealTimeOnsetDetector
} from './onsetDetector.js';

let scene, camera, renderer;
let waveGroupLow, waveGroupHigh;
const zStart = 200;
const zEnd = 4000;
const gap = 30;
const highAmplitude = 250;
const lowAmplitude = 100;
let onsetDetector;
const spheres = []; // Array to hold the spheres
const lights = [];

async function init() {
    await initAudio();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, zStart, zEnd);
    camera.position.set(0, 0, 0);
    camera.lookAt(new THREE.Vector3(0, 0, zStart));
    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    // Create WaveGroup instances
    waveGroupLow = new WaveGroup(startBinLow, endBinLow, -window.innerHeight / 2, lowAmplitude, false, zStart, gap, 0x00ff88, 5); // Example speed: 5
    waveGroupHigh = new WaveGroup(startBinHigh, endBinHigh, window.innerHeight / 2, highAmplitude, true, zStart, gap, 0xffa500, 10); // Example speed: 10
    // Add initial waves to the groups
    const numInitialWaves = (zEnd - zStart) / gap;
    waveGroupLow.addInitialWaves(numInitialWaves);
    waveGroupHigh.addInitialWaves(numInitialWaves);
    // Add the groups to the scene
    scene.add(waveGroupLow.getGroup());
    scene.add(waveGroupHigh.getGroup());
    // Initialize the onset detector
    onsetDetector = new RealTimeOnsetDetector({
        sr: 44100,
        chunk_size: 512,
        window_size: 2048,
        H: 20,
        C_t: 1.3
    });
    await onsetDetector.start();
    createTestLights();
}

function createSphere(strength = 100) {
    const geometry = new THREE.SphereGeometry(Math.log10(strength), 32, 16); // radius, widthSegments, heightSegments

    const light = new THREE.PointLight(0x0000ff, strength, strength/4, 0.5); //color, intensity, distance, decay
    const material = new THREE.MeshBasicMaterial({
        color: 0x0000ff
    });
    const sphere = new THREE.Mesh(geometry, material);
    // Position the sphere randomly in the scene
    const [x, y, z] =  [Math.random() * 600, Math.random() * 600, Math.random() * 600 + 500]
    sphere.position.set(x, y, z);
    light.position.set(x, y, z);
    scene.add(light);
    scene.add(sphere);
    spheres.push(sphere);
    lights.push(light);
}

function createTestLights() {
    const geometry = new THREE.SphereGeometry(5, 32, 16);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffff00
    });
    const sphere = new THREE.Mesh(geometry, material);
    const sphere2 = new THREE.Mesh(geometry, material);
    sphere.position.set(300, 0, 500);
    sphere2.position.set(-300, 0, 500);
    scene.add(sphere);
    scene.add(sphere2);
    const light = new THREE.PointLight(0xff0000, 1000, 250, 0.5); //color, intensity, distance, decay
    const sphere3 = new THREE.Mesh(geometry, material);
    sphere3.position.set(-300, -10, 700);
    light.position.set(-300, -10, 700);
    scene.add(sphere3);
    scene.add(light);
    const directionalLight = new THREE.DirectionalLight(0x00ff00, 5);
    directionalLight.position.set(-300, 0, 500);
    directionalLight.target = sphere;
    const directionalLight2 = new THREE.DirectionalLight(0x00ff00, 5);
    directionalLight2.position.set(300, 0, 500);
    directionalLight2.target = sphere2;
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
    waveGroupLow,
    waveGroupHigh,
    onsetDetector,
    spheres,
    lights, 
    createSphere
};