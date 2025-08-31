import * as THREE from 'three';
import { frequencyData } from './audioHandler.js';


class WaveGroup {
    constructor(startBin, endBin, yOffset, amplitude, invertY, zStart, gap, materialColor = 0x00ff88, speed = 10) {
        this.group = new THREE.Group();
        this.startBin = startBin;
        this.endBin = endBin;
        this.yOffset = yOffset;
        this.amplitude = amplitude;
        this.invertY = invertY;
        this.zStart = zStart;
        this.gap = gap;
        this.materialColor = materialColor;
        this.speed = speed;
        this.zEnd = 4000;
        this.numPoints = 64;
        this.waveWidth = window.innerWidth;
    }

    createWave(initialZ) {
        const positions = [];
        
        for (let i = 0; i < this.numPoints; i++) {
            const t = i / (this.numPoints - 1);
            const binIndex = this.startBin + Math.floor(t * (this.endBin - this.startBin));
            const clampedBinIndex = Math.min(binIndex, this.endBin);
            const amplitude = frequencyData ? frequencyData[clampedBinIndex] / 255 : 0;

            let x = THREE.MathUtils.mapLinear(i, 0, this.numPoints - 1, -this.waveWidth, 0);
            let y = amplitude * this.amplitude * 2;
            if (this.invertY) y = -y;
            y += this.yOffset;

            positions.push(new THREE.Vector3(x, y, 0));
        }
        for (let i = this.numPoints - 2; i >= 0; i--) {
            positions.push(new THREE.Vector3(-positions[i].x, positions[i].y, 0));
        }

        const path = new THREE.CatmullRomCurve3(positions, false, 'chordal');
        const geometry = new THREE.TubeGeometry(path, 128, 1, 8, false);
        const material = new THREE.MeshStandardMaterial({
            color: this.materialColor,
            roughness: 0.8,
            metalness: 0.5,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = initialZ;

        return mesh
    }

    addInitialWaves(numWaves) {
        for (let i = 0; i < numWaves; i++) {
            const zPosition = this.zStart + i * this.gap;
            const waveObject = this.createWave(zPosition);
            this.group.add(waveObject);
        }
    }

    update() {
        this.group.children.forEach(waveMesh => {
            waveMesh.position.z -= this.speed;
        });

        // Add new waveform
        if (this.group.children.length === 0 ||
            this.group.children[this.group.children.length - 1].position.z < this.zEnd - this.gap) {
            const newWave = this.createWave(this.zStart + this.group.children.length * this.gap);
            this.group.add(newWave);
        }

        // Remove old waveforms
        if (this.group.children[0]?.position.z < this.zStart - this.gap) {
            this.group.remove(this.group.children[0]);
        }
    }

    getGroup() {
        return this.group;
    }

    setSpeed(newSpeed) {
        this.speed = newSpeed;
    }
}

export { WaveGroup };