class CircularQueue {
    constructor(size) {
        this.buffer = new Float32Array(size);
        this.size = size;
        this.head = 0;
        this.length = 0;
    }

    push(value) {
        this.buffer[this.head] = value;
        this.head = (this.head + 1) % this.size;
        if (this.length < this.size) {
            this.length++;
        }
    }

    // Get elements in chronological order (oldest first)
    getElements() {
        const elements = new Array(this.length);
        let current = (this.head - this.length + this.size) % this.size;
        for (let i = 0; i < this.length; i++) {
            elements[i] = this.buffer[current];
            current = (current + 1) % this.size;
        }
        return elements;
    }

    // Access elements from the end (most recent first)
    getFromEnd(n) {
        if (n > this.length) {
            throw new Error("Not enough elements in buffer");
        }
        const index = (this.head - n + this.size) % this.size;
        return this.buffer[index];
    }

    median() {
        const elements = this.getElements();
        if (elements.length === 0) return 0;
        elements.sort((a, b) => a - b);
        const mid = Math.floor(elements.length / 2);
        return elements.length % 2 !== 0 ? elements[mid] : (elements[mid - 1] + elements[mid]) / 2;
    }
}

export {
    CircularQueue
};