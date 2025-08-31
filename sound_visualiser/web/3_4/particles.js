import * as THREE from 'three';

class Particle {

    constructor(noteFrequency, noteSalience, xRange, yRange, initialPosition) {

        this.noteSalience = noteSalience;
        this.currPosition = initialPosition;
        this.mesh = this.createParticle(noteSalience);

        this.lightDecay = 0.5; // High initial factor for sharp drop
        this.decayRate = 0.01; // We use a standard decay rate until information is updated

        // Initialize rotation speed based on salience
        const initialRotationMagnitude = this.noteSalience * 0.25 + 0.01;
        this.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 2 * initialRotationMagnitude,
            (Math.random() - 0.5) * 2 * initialRotationMagnitude,
            (Math.random() - 0.5) * 2 * initialRotationMagnitude
        );

        this.xRange = xRange;
        this.yRange = yRange;
        // allowed fluctuation range (per side) around the target after reaching it
        this.xGap = (xRange[1] - xRange[0]) / 13
        this.yGap = (yRange[1] - yRange[0]) / 5

        this.initTargetPosition(noteFrequency);
        this.targetAttraction = this.noteSalience * 0.05 + 0.005; // How large a fraction of distance to move per update, scaled off salience
        this.isMovingToTarget = true;
        this.movementT = 0; // Parameter t for Bezier curve (0 to 1)
        this.movementStartXY = new THREE.Vector3(this.currPosition.x, this.currPosition.y, 0);
        this.targetPosition = new THREE.Vector3(this.targetX, this.targetY, this.currPosition.z); // Target Z is initially current Z
        this.targetPositionXY = new THREE.Vector3(this.targetX, this.targetY, 0);
        this.movementControlXY = this.calculateControlPoint(this.movementStartXY, this.targetPositionXY);
    }

    initTargetPosition(f) {
        const noteNames = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"]
        const noteMap = {
            "A": 1, "F#": 2, "F": 3, "C#": 4, "D": 5, "A#": 6, "C": 7, "D#": 8, "E": 9, "G#": 10, "G": 11, "B": 12
        };
        const midiNum = Math.round(49 + 12 * Math.log2(f / 440.0));
        const noteName = noteNames[(midiNum % 12 + 12) % 12];
        this.targetX = noteMap[noteName] * this.xGap + this.xRange[0];

        // guassian-random added to targetX
        var u = 1 - Math.random(); // Converting [0,1) to (0,1]
        var v = Math.random();
        var z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        // Transform to the desired standard deviation (using xGap scaled)
        this.targetX += this.xGap * z * 0.25;
        
        const octave = Math.floor((midiNum + 8) / 12); // ranges 0-8
        this.targetY = (octave + 1) * this.yGap / 2 + this.yRange[0];
        u = 1 - Math.random();
        v = Math.random();
        z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        // guassian-random added to targetY
        this.targetY += this.yGap * z * 0.25;

        // Note: target Z is handled in constructor/update
    }

    calculateControlPoint(startXY, targetXY) {
        const midPoint = startXY.clone().lerp(targetXY, 0.5); // Midpoint between start and target

        const direction = new THREE.Vector3().subVectors(targetXY, startXY);
        const distance = direction.length();
        if (distance === 0) return midPoint; // Avoid division by zero

        // Get a vector perpendicular to the direction in the XY plane
        const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();

        // Calculate a random offset magnitude based on distance and defined range
        const offsetMagnitude = distance * (Math.random() * (0.4 - 0.1) + 0.1);
        const randomSign = Math.random() > 0.5 ? 1 : -1;

        // Calculate the control point by offsetting the midpoint along the perpendicular vector
        const controlPoint = midPoint.addScaledVector(perpendicular, offsetMagnitude * randomSign);

        return controlPoint;
    }

    createParticle(salience) {
        const radius = Math.max(25, salience**2 *75); // Smaller radius, scale by salience
        const color = [0xff00A1, 0xff0040, 0xff7300, 0x90fe00, 0x00fff7, 0xffffff][Math.floor(Math.random() * 6)] // Added white

        // create random polyhedron geometry
        let geometry;
        const randomNum = Math.floor(Math.random() * 5);
        switch (randomNum) {
            case 0:
                geometry = new THREE.TetrahedronGeometry(radius, 0);
                break;
            case 1:
                geometry = new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2); // BoxGeometry uses full dimensions
                break;
            case 2:
                geometry = new THREE.OctahedronGeometry(radius, 0);
                break;
            case 3:
                geometry = new THREE.DodecahedronGeometry(radius, 0);
                break;
            case 4:
                geometry = new THREE.IcosahedronGeometry(radius, 0);
                break;
        }
        // Create EdgesGeometry from the base geometry
        const edges = new THREE.EdgesGeometry(geometry);

        const material = new THREE.LineBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 1
        });

        const edgeMesh = new THREE.LineSegments(edges, material);
        edgeMesh.position.copy(this.currPosition);

        // intensity scales from 5000-10000. skew towards 10000 to allow for more fall off
        const intensity = 5000 + salience**2 * 5000

        const decay = 1.0; // THREE.js light decay - controls falloff based on distance

        const light = new THREE.PointLight(color, intensity, 0, decay);
        edgeMesh.add(light);

        return edgeMesh;
    }

    update() {
        // Particle rotation speed should decrease and tend towards 0
        // Higher decay rates should cause larger decrease in rotation
        this.mesh.rotation.x += this.rotationSpeed.x;
        this.mesh.rotation.y += this.rotationSpeed.y;
        this.mesh.rotation.z += this.rotationSpeed.z;

        // If the magnitude is below the minimum
        if (this.rotationSpeed.length() <= 0.05) {
            // Normalize the vector to get the direction and scale it to the minimum magnitude
            this.rotationSpeed.normalize().multiplyScalar(0.05);
        }
        else {
            this.rotationSpeed.multiplyScalar(0.98 - this.decayRate * 0.05);
        }

        // Particle light intensity to decrease based on decay rate and current intensity
        // Light intensity should have a sharp fall off at the start
        const light = this.mesh.children[0];
        light.intensity -= light.intensity * (this.lightDecay + (this.decayRate * 0.2));
        this.lightDecay = Math.max(this.lightDecay*0.7, 0.01);
        if (light.intensity < 150) this.mesh.material.opacity = (light.intensity-50)/100

        // Movement speed in z direction to depend on decay rate
        // High decay rate should cause z position to decrease greater
        this.currPosition.z -= this.decayRate * 0.5 + 2;

        // Move particle towards targetX and targetY (XY plane)
        if (this.isMovingToTarget) {
            // Increment the parameter t for the Bezier curve interpolation PER UPDATE
            this.movementT += (1 - this.movementT) * this.targetAttraction;
            this.movementT = Math.min(this.movementT, 1);

            // Calculate the current position on the Quadratic Bezier curve based on t
            // B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
            // P0 = this.movementStartXY
            // P1 = this.movementControlXY
            // P2 = this.targetPositionXY


            const curvedPosition = new THREE.Vector3()
                .addScaledVector(this.movementStartXY, (1 - this.movementT)**2) // (1-t)^2 * P0
                .addScaledVector(this.movementControlXY, 2 * (1 - this.movementT) * this.movementT) // 2 * (1-t) * t * P1
                .addScaledVector(this.targetPositionXY, this.movementT**2); // t^2 * P2

            // Update the particle's XY position based on the calculated curve point
            this.currPosition.x = curvedPosition.x;
            this.currPosition.y = curvedPosition.y;

            // Check if the movement is complete (t = 1), or clamp when close enough
            if (this.movementT >= 0.99) {
                this.movementT = 1;
                this.isMovingToTarget = false; 

                this.currPosition.x = this.targetX;
                this.currPosition.y = this.targetY;
            }
        } 
        this.mesh.position.copy(this.currPosition);
    }

    getMesh() {
        return this.mesh;
    }

    getPosition() {
        return this.currPosition;
    }

    getLightIntensity() {
        return this.mesh.children[0].intensity;
    }

    setDecayRate(decayRate) {
        this.decayRate = decayRate;
    }

    disposeParticle() {
        if (this.mesh && this.mesh.geometry) {
            this.mesh.geometry.dispose();
            this.mesh.geometry = null;
        }

        if (this.mesh && this.mesh.material) {
            this.mesh.material.dispose();
            this.mesh.material = null;
        }

        this.mesh.remove(this.mesh.children[0]); // remove light
        this.mesh = null;
    }
}

export { Particle };