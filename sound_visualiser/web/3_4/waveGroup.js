import * as THREE from 'three';
import { frequencyData } from './audioHandler.js';

class WaveGroup {
    constructor(startBin, endBin, yOffset, invertY, zStart, gap, materialColor = 0x00ff88, speed = 10) {
        this.group = new THREE.Group();
        this.startBin = startBin;
        this.endBin = endBin;
        this.yOffset = yOffset;
        this.zStart = zStart;
        this.gap = gap;
        this.materialColor = materialColor;
        this.zEnd = 6000;
        this.numPoints = 128;
        this.waveWidth = window.innerWidth*2;
        this.tubeMaterial = new THREE.MeshStandardMaterial({
            color: this.materialColor,
            roughness: 0.8,
            metalness: 0.5,
        });

        this.targetSpeed = speed; // speed to converge to
        this.intermediateTarget = speed; // intermediate target for smoothing
        this.currentSpeed = speed;
        this.dv = 0; // rate of change of speed

        // how quickly intermediate target catches up to desired target
        this.intermediateEasingFactor = 0.01; // Smaller value = slower intermediate target movement
        // how strongly speed converges to intermediate target
        this.attractionFactor = 0.005; // must be < intermediateEasing, set as 0.5*intermediate easing
        this.dampingFactor = 0.8; // Closer to 1 = less damping (more oscillation), Closer to 0 = more damping (stops faster)
    
        this.speedClip = 0.05;
        this.dvClip = 0.01;
    }

    createWave(initialZ) {
        const positions = [];

        positions.push(new THREE.Vector3(-this.waveWidth*2, this.yOffset, 0));
        for (let i = 0; i < this.numPoints; i++) {
            const t = i / (this.numPoints - 1);
            const binIndex = this.startBin + Math.floor(t * (this.endBin - this.startBin));
            const clampedBinIndex = Math.min(binIndex, this.endBin);
            const amplitude = frequencyData ? frequencyData[clampedBinIndex] / 255 : 0;

            let x = THREE.MathUtils.mapLinear(i, 0, this.numPoints - 1, -this.waveWidth, 0);
            let y = amplitude * 750;
            
            if (this.invertY) y = this.yOffset - y;
            else y = this.yOffset + y;

            positions.push(new THREE.Vector3(x, y, 0));
        }

        for (let i = this.numPoints - 2; i >= 0; i--) {
            positions.push(new THREE.Vector3(-positions[i].x, positions[i].y, 0));
        }

        const path = new THREE.CatmullRomCurve3(positions, false, 'chordal');
        const geometry = new THREE.TubeGeometry(path, 128, 1, 8, false);

        const mesh = new THREE.Mesh(geometry, this.tubeMaterial);
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
        if (this.currentSpeed != this.targetSpeed) {
            this.intermediateTarget += (this.targetSpeed-this.intermediateTarget) * this.intermediateEasingFactor;
            this.dv += (this.intermediateTarget-this.currentSpeed) * this.attractionFactor;
            this.dv *= this.dampingFactor;
            this.currentSpeed += this.dv;

            if (Math.abs(this.currentSpeed-this.targetSpeed) < this.speedClip && Math.abs(this.dv) < this.dvClip) {
                this.currentSpeed = this.targetSpeed;
                this.intermediateTarget = this.targetSpeed;
                this.dv = 0;
            }
        }

        this.group.children.forEach(waveMesh => {
            waveMesh.position.z -= this.currentSpeed;
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

    setEasing(factor) {
        this.intermediateEasingFactor = 0.05*factor;
        this.attractionFactor = 0.5*this.intermediateEasingFactor;
    }

    getSpeed() {
        return this.currentSpeed;
    }

    setTargetSpeed(target) {
        this.targetSpeed = target;
    }
}

export { WaveGroup };