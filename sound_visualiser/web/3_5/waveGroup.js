import * as THREE from 'three';
import { frequencyData } from './audioHandler.js';

class WaveGroup {
    constructor(startBin, endBin, yOffset, invertY, zStart, speed = 10) {
        this.group = new THREE.Group();
        this.startBin = startBin;
        this.invertY = invertY;
        this.endBin = endBin;
        this.yOffset = yOffset;
        this.zStart = zStart;
        this.zEnd = 6000;
        this.numPoints = 256;
        this.waveWidth = window.innerWidth*2;
        this.lineMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 2
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
        var totalAmplitude = 0;

        positions.push(new THREE.Vector3(-this.waveWidth*2, this.yOffset, 0));
        for (let i = 0; i < this.numPoints; i++) {
            const t = i / (this.numPoints - 1);
            const binIndex = this.startBin + Math.floor(t * (this.endBin - this.startBin));
            const clampedBinIndex = Math.min(binIndex, this.endBin);
            var amplitude = frequencyData ? frequencyData[clampedBinIndex] / 255 : 0;
            totalAmplitude += amplitude;

            let x = THREE.MathUtils.mapLinear(i, 0, this.numPoints - 1, -this.waveWidth, 0);
            amplitude += x > -this.waveWidth/2 ? (1 + x/this.waveWidth)*amplitude*0.25 : 0;
            let y = this.invertY ? 
                this.yOffset - amplitude*750 :
                this.yOffset + amplitude*750;

            positions.push(new THREE.Vector3(x, y, 0));
        }

        totalAmplitude = Math.max(100, Math.min(totalAmplitude, 300));
        //this.gap = 0.0025*totalAmplitude^2 - 1.45*totalAmplitude + 220;
        this.gap = -0.2*totalAmplitude + 70;

        for (let i = this.numPoints - 2; i >= 0; i--) {
            positions.push(new THREE.Vector3(-positions[i].x, positions[i].y, 0));
        }
        
        const curve = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0);
        const points = curve.getPoints( (this.numPoints*2-1)*16 );

        const colors = [0,0,0];
        for (let point of points) {
            const amplitude = Math.abs(point.y-this.yOffset)/750;
            const color = amplitude < 0.4 ? new THREE.Color(0x01030f).lerp(new THREE.Color(0x000521), amplitude * 2.5) : 
            0.4 <= amplitude < 0.8 ? new THREE.Color(0x000521).lerp(new THREE.Color(0x039fcf), (amplitude - 0.4) * 2.5) : 
            0.8 <= amplitude < 0.9 ? new THREE.Color(0x039fcf).lerp(new THREE.Color(0x10dde7), (amplitude - 0.8) * 10) :
            new THREE.Color(0x10dde7).lerp(new THREE.Color(0xcafef7), Math.max(1, (amplitude - 0.9) * 10));
            colors.push(color.r); colors.push(color.g); colors.push(color.b);
        }
        const geometry = new THREE.BufferGeometry().setFromPoints( points );

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3, true));
        const mesh = new THREE.Line(geometry, this.lineMaterial);
        mesh.position.z = initialZ;

        return mesh
    }

    addInitialWaves(numWaves, gap) {
        this.gap = gap;
        for (let i = 0; i < numWaves; i++) {
            const zPosition = this.zStart + i * gap;
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