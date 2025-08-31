// sceneInitializer.js
import * as THREE from 'three';
import { initAudio, startBinLow, endBinLow, startBinHigh, endBinHigh } from './audioHandler.js';
import { WaveGroup } from './waveGroup.js';

let scene, camera, renderer;
let waveGroupLow, waveGroupHigh;
const zStart = 200;
const zEnd = 4000;
const gap = 30;
const highAmplitude = 250;
const lowAmplitude = 100;

async function init() {
    await initAudio();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, zStart, zEnd);
    camera.position.set(0, 0, 0);
    camera.lookAt(new THREE.Vector3(0, 0, zStart));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create WaveGroup instances
    waveGroupLow = new WaveGroup(startBinLow, endBinLow, -window.innerHeight/2, lowAmplitude, false, zStart, gap, 0x00ff88, 5); // Example speed: 5
    waveGroupHigh = new WaveGroup(startBinHigh, endBinHigh, window.innerHeight/2, highAmplitude, true, zStart, gap, 0xffa500, 10); // Example speed: 10

    // Add initial waves to the groups
    const numInitialWaves = (zEnd - zStart) / gap;
    waveGroupLow.addInitialWaves(numInitialWaves);
    waveGroupHigh.addInitialWaves(numInitialWaves);

    // Add the groups to the scene
    scene.add(waveGroupLow.getGroup());
    scene.add(waveGroupHigh.getGroup());

    const geometry = new THREE.SphereGeometry( 5, 32, 16 );
    const material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
    const sphere = new THREE.Mesh( geometry, material );
    const sphere2 = new THREE.Mesh( geometry, material );
    sphere.position.set(300, 0, 500);
    sphere2.position.set(-300, 0, 500);
    scene.add(sphere);
    scene.add(sphere2);

    const light = new THREE.PointLight( 0xff0000, 1000, 250, 0.5); //color, intensity, distance, decay
    const sphere3 = new THREE.Mesh( geometry, material );
    sphere3.position.set(-300,-10,700);
    light.position.set(-300, -10, 700 );
    scene.add(sphere3);
    scene.add( light );


    const directionalLight = new THREE.DirectionalLight(  0x00ff00, 5 );
    directionalLight.position.set(-300, 0, 500);
    directionalLight.target = sphere;

    const directionalLight2 = new THREE.DirectionalLight( 0x00ff00, 5 );
    directionalLight2.position.set(300, 0, 500);
    directionalLight2.target = sphere2;
    scene.add(directionalLight);
    const directionalLightHelper = new THREE.DirectionalLightHelper(directionalLight, 1);
    scene.add(directionalLightHelper);


    const light2 = new THREE.AmbientLight( 0x404040, 1 ); // soft white light
    scene.add( light2 );
}

export { init, scene, camera, renderer, waveGroupLow, waveGroupHigh };