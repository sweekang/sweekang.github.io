import {
    analyser,
    frequencyData
} from './audioHandler.js';
import {
    scene,
    renderer,
    camera,
    waveGroupLow,
    waveGroupHigh,
    onsetDetector,
    spheres,
    lights,
    createSphere
} from './sceneInitializer.js';

function animate(time) {
    requestAnimationFrame(animate);
    if (analyser) analyser.getByteFrequencyData(frequencyData);
    if (waveGroupLow) waveGroupLow.update();
    if (waveGroupHigh) waveGroupHigh.update();
    renderer.render(scene, camera);

    if (onsetDetector && onsetDetector.onsetDetected) {
        createSphere(onsetDetector.onsetStrength);
        onsetDetector.onsetDetected = false; // Reset the flag
    }
    updateSpheres();
}

function updateSpheres() {
    for (let i = 0; i < spheres.length; i++) {
        spheres[i].position.z -= 5;
        lights[i].position.z -= 5;
        if (spheres[i].position.z < -300) {
            scene.remove(spheres[i]);
            spheres.splice(i, 1);
            scene.remove(lights[i]);
            lights.splice(i, 1);
        }
    }
}

export {
    animate
};