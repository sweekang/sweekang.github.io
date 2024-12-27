var i = 1

var G = universal.G/490.5;
var H = universal.H;
var R = universal.R;

class C {
  constructor(r=255, g=255, b=255) {
    this.r = r;
    this.g = g;
    this.b = b;
  }
}

class Body {
  constructor(x, y, m, c = new C()) {
    this.pos = createVector(x, y);
  
    this.m = m;
    this.r = sqrt(m)/3;
    this.c = c;
  }
  
  draw() {
    noFill();
    strokeWeight(5);
    stroke(this.c.r, this.c.g, this.c.b, 50);
    ellipse(this.pos.x, this.pos.y, 15, 15);
  }
}

class Magnet extends Body{
  constructor(x, y, m, c) {
    super(x, y, m, c)

    this.M = 1.5*40000;
    this.id = i;
    i++;

    window['folder'+this.id] = gui.addFolder( 'Magnet ' + this.id );
    window['folder'+this.id].magnetId = this.id;
    window['magnetControl'+this.id ] = {
      M: 1.5
    };
    window['folder'+this.id].add( window['magnetControl'+this.id ], 'M', 1, 10).name('Magnet Strength');
  }

  get_name() {
    return "m"
  }

  draw() {
    fill(0, 0, 0, 90);
    strokeWeight(Math.log2(window['magnetControl'+this.id].M) + 1);
    stroke(this.c.r, this.c.g, this.c.b);
    ellipse(this.pos.x, this.pos.y, 30, 30);

    fill(0, 0, 0, 90);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 30, 30);
  }
}

class Bob extends Body{
  constructor(x, y, m, c = new C()) {
    super(x, y, m, c = new C())
    
    this.strokeColor = HSVtoRGB(random(), 1, 1)
    this.m /= 300;
    
    this.startPos = createVector(x, y);

    // calcuation of movement
    this.pos = createVector(x, y);
    this.prevPos = createVector(x, y);
    this.vel = createVector();
    this.velPred = createVector();
    this.currAcc = createVector();
    this.prevAcc = createVector();
    this.prev2acc = createVector();
    this.magnetForce = createVector();
    this.gravity = createVector();
    this.friction = createVector();

    // history
    this.shape = [createVector(x, y)];
    this.backTrack = createVector(x, y);

    // to check what magnet it ends at
    this.counter = 0;
    this.nearestMagnetId = -1;
    this.magnetColor = null;
    this.done = false;
  }
  
  get_name() {
    return "b";
  }

  update(dt, magnets) {

    for (var magnet of magnets) {
      // magnetic force is about force of dipol which is proportional to 1/r^3
      // i.e. F = k * r/|r|^3, r being distance vector of bob from magnet
      var magnitude = createVector(magnet.pos.x-this.pos.x, magnet.pos.y-this.pos.y, H);
      var strength = magnet.M / (pow(p5.Vector.mag(magnitude), 3));
      // var strength = magnet.M / (Math.pow(p5.Vector.mag(magn), 2));
      magnitude.mult(strength);
      this.magnetForce.add(magnitude);
    }

    // Beeman's velocity predictor
    // v(t+Δt) = v(t) + (3/2)a(t)Δt − (1/2)a(t−Δt)Δt
    this.velPred.add(
                    p5.Vector.mult(this.prevAcc, 3/2*dt)
                    .add(p5.Vector.mult(this.prevAcc, -dt/2)));
                
    // force due to friction
    // i.e. F = -k * v, v being velocity of pendulum
    var momfric = p5.Vector.mult(this.velPred, -R);
    this.friction.add(momfric);

    // force due to gravity or tension in pendulum
    // i.e. F = k * r, r being distance vector of bob from origin
    var momgrav = createVector(width/2 - this.pos.x, height/2 - this.pos.y);
    momgrav.mult(G * this.m);
    this.gravity.add(momgrav);
    

    // a = F/m
    this.acc = createVector((this.magnetForce.x + this.gravity.x + this.friction.x) / this.m, 
                            (this.magnetForce.y + this.gravity.y + this.friction.y) / this.m);

    //Beeman's Algorithm

    // v(t+Δt) = v(t) + (1/3)a(t+Δt) + 5/6a(t) - a(t-Δt)
    this.vel.add(
                p5.Vector.mult(this.acc, dt * 1 / 3)
                .add(p5.Vector.mult(this.prevAcc, dt * 5 / 6))
                .add(this.prev2acc.mult(-1 / 6 * dt)));

    // let error = p5.Vector.mag(p5.Vector.sub(this.velPred, this.vel))/p5.Vector.mag(this.vel)
    // if (error * 100 > 1 && p5.Vector.mag(this.vel) > 1) {
    //   console.log(error, p5.Vector.mag(this.velPred), p5.Vector.mag(this.vel))
    // }

    // x(t+Δt) = x(t) + v(t)Δt + (2/3)a(t)(Δt)^2 - (1/6)a(t-Δt)(Δt)^2
    this.pos.add(
                    this.vel.mult(dt)
                    .add(p5.Vector.mult(this.prevAcc, dt*dt* 2/3))
                    .add(p5.Vector.mult(this.prev2acc, -dt*dt/6)));

    // update values
    this.prev2acc = this.prevAcc.copy();
    this.prevAcc = this.acc.copy();
    this.velPred = this.vel.copy();
    this.shape.push(this.pos.copy());
    
    this.backTrack = this.pos.copy();
    this.equilibrium();
  }

  equilibrium() {
    var smallestDist = Number.MAX_VALUE;
    var smallestDistMagnetId = null;

    for (var magnet of magnets) {
      var dist = mag(magnet.pos.x-this.pos.x, magnet.pos.y-this.pos.y)
      if (dist < smallestDist) {
        smallestDist = dist;
        smallestDistMagnetId = magnet.id;
        this.magnetColor = magnet.c;
      }
    }

    if (smallestDistMagnetId == this.nearestMagnetId) {
      this.counter++;
    }
    else {
      this.nearestMagnetId = smallestDistMagnetId;
      this.counter = 1;
    }

    if (smallestDist > 35) {
      this.counter = 0;
      this.nearestMagnetId = -1;
    }

    if (this.counter / universal.dt * Math.log2(window['magnetControl'+smallestDistMagnetId].M) >= 250) {
      this.done = true;
      this.c = this.magnetColor;
    }
  }

  draw() {
    fill(this.c.r, this.c.g, this.c.b);
    noStroke();
    stroke(this.c.r, this.c.g, this.c.b);
    ellipse(this.pos.x, this.pos.y, this.r, this.r);
  }

  drawPos(x, y) {
    fill(this.c.r, this.c.g, this.c.b);
    noStroke();
    stroke(this.c.r, this.c.g, this.c.b);
    ellipse(x, y, this.r, this.r);
  }
  
  animateTo(targetPos, ease) {
    if (!this.backTrack.equals(targetPos)) {
      var backUnit = p5.Vector.mult(p5.Vector.sub(this.backTrack, targetPos), pow(ease/50, 2));
      this.backTrack.sub(backUnit);
      if (mag(targetPos.x-this.backTrack.x, targetPos.y-this.backTrack.y) < backUnit.mag()*1.1) {
        this.backTrack = targetPos.copy();
      }
    }
    this.drawPos(this.backTrack.x, this.backTrack.y);
  }
}