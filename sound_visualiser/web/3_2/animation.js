import { analyser, frequencyData } from './audioHandler.js';
import { scene, renderer, camera, waveGroupLow, waveGroupHigh } from './sceneInitializer.js';

function animate(time) {
    requestAnimationFrame(animate);

    if(analyser) analyser.getByteFrequencyData(frequencyData);

    if (waveGroupLow) waveGroupLow.update();
    if (waveGroupHigh) waveGroupHigh.update();

    renderer.render(scene, camera);
}

export { animate };