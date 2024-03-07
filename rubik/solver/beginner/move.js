class Move {
    constructor (move) {
        this.raw = move.toUpperCase()
    }

    face() { return this.raw[0].toUpperCase() }

    set_face(new_face) { this.raw = new_face + this.slice(1) }

    double() { return this.raw.includes('2') }

    set_double(new_double) {
        if (new_double) this.raw = this.raw.replace('2', '').replace("'", '') + '2'
        else this.raw = this.raw.replace('2', '').replace("'", '')
    }

    counterclockwise() { return this.raw.includes("'") }

    set_counterclockwise(value) {
        if (value) this.raw = this.raw.replace("'", '').replace("2", '') + "'"
        else this.raw = this.raw.replace("'", '').replace("2", '')
    }

    clockwise() { return !this.counterclockwise() && !this.double() }

    set_clockwise(value) {this.counterclockwise() = !value}

    reverse() {
        if (this.clockwise()) return Move(this.face() + "'")
        else if (this.double()) return Move(this.face() + "2")
        else return Move(this.face())
    }
}

export { Move }