p5.disableFriendlyErrors = true; //for performance

let bodies = [];
let magnets = [];
let canvas;
var run = false;
var ease = 0;

const gui = new lil.GUI()

const universal = {
  spacing: 50,
	dt: 0.1,
  G: 9.81,
  H: 50,
  R: 0.2
};

gui.add( universal, 'spacing', 10).onChange( setup );
gui.add( universal, 'dt', 0.0001, 0.5);
gui.add( universal, 'G', 0, 100, 1).name('Gravitaional Constant');
gui.add( universal, 'R', 0.01, 0.9).name('Friction Constant');
gui.add( universal, 'H', 10, 100).name('Height of pendulum origin');

function setup() {
  bodies = [];

  canvas = createCanvas(window.innerWidth, window.innerHeight);
  canvas.mouseWheel(e => Controls.zoom(controls).worldZoom(e));

  if (magnets.length === 0) {
    magnets.push(
      new Magnet(width/2, 5*height/7, 5000, HSVtoRGB(random(), 1, 1)),
      new Magnet(width/3, 2*height/5, 5000, HSVtoRGB(random(), 1, 1)),
      new Magnet(2*width/3, 2*height/5, 5000, HSVtoRGB(random(), 1, 1))
    )
  }

  gui.onChange( e => {
    for (let m of magnets) if (m.id == e.controller.parent.magnetId) var affectedMagnet = m;
    if (e.property == "M") affectedMagnet.M = e.value*40000;
  } );

  // if (magnets.length === 0) { // workaround for changing spacing of bobs
  //   magnets.push(
  //     new Magnet(10*width/18, 6*height/14, 5000, HSVtoRGB(random(), 1, 1)),
  //     new Magnet(9*width/18, 8*height/14, 5000, HSVtoRGB(random(), 1, 1)),
  //     new Magnet(8*width/18, 6*height/14, 5000, HSVtoRGB(random(), 1, 1))
  //   )
  // }

  var xRight = (width - controls.view.x) / controls.view.zoom
  var yTop = (height - controls.view.y) / controls.view.zoom
  var xLeft = -controls.view.x / controls.view.zoom
  var yBottom = -controls.view.y / controls.view.zoom


	for (let x = width/2; x <= xRight; x += universal.spacing) {
		for (let y = height/2; y <= yTop; y += universal.spacing) {
			bodies.push(new Bob(x, y, 300));
		}
    for (let y = height/2 - universal.spacing; y >= yBottom; y -= universal.spacing) {
			bodies.push(new Bob(x, y, 300));
		}
  }
  for (let x = width/2 - universal.spacing; x >= xLeft; x -= universal.spacing) {
    for (let y = height/2; y <= yTop; y += universal.spacing) {
			bodies.push(new Bob(x, y, 300));
		}
		for (let y = height/2 - universal.spacing; y >= yBottom; y -= universal.spacing) {
      bodies.push(new Bob(x, y, 300));
		}
  }

  fill(0, 0, 0)
  rect(0, 0, width, height)
}

function draw_grid() {
	stroke(60, 60, 60);
	strokeWeight(1);

  var gridSpacing = 50;
  var xRight = (width - controls.view.x) / controls.view.zoom;
  var yTop = (height - controls.view.y) / controls.view.zoom;
  var xLeft = -controls.view.x / controls.view.zoom;
  var yBottom = -controls.view.y / controls.view.zoom;
  
	for (let x = width/2; x <= xRight; x += gridSpacing) {
		for (let y = height/2; y <= yTop; y += gridSpacing) {
			line(x, yBottom, x, yTop);
			line(xLeft, y, xRight, y);
		}
	}

  for (let x = width/2 - gridSpacing; x >= xLeft; x -= gridSpacing) {
		for (let y = height/2 - gridSpacing; y >= yBottom; y -= gridSpacing) {
			line(x, yBottom, x, yTop);
			line(xLeft, y, xRight, y);
		}
	}

  new Body(width/2, height/2, 5000).draw();
}

var equilibriumFound = false;
var currPosIndex = 0;

function hoveredOnMagnet() {
  for (let m of magnets) {
    if (dist((m.pos.x*controls.view.zoom+controls.transform.dx), 
    (m.pos.y*controls.view.zoom+controls.transform.dy), 
    mouseX, mouseY) < 30*controls.view.zoom) {
      return m;
    }
  }
  return false;
}


function draw() {

  background(0, 0, 0, 100);

  translate(controls.view.x, controls.view.y);
  scale(controls.view.zoom);
  ease++;

  if (run) {
    if (!equilibriumFound) {
      equilibriumFound = true;
      for(let i=0; i<bodies.length; i++) {
        if (!bodies[i].done) {equilibriumFound = false; ease = 0; break;}
      }
      if (equilibriumFound) run = false;
    }
    currPosIndex++;

    for (let i=0; i<bodies.length; i++) {
      let b = bodies[i];
      if (!equilibriumFound || b.shape.length < currPosIndex-1) b.update(universal.dt, magnets);
    }
  }

  draw_grid();

  for (let b of bodies) {
    try {
    if (run && equilibriumFound) b.drawPos(b.shape[currPosIndex].x, b.shape[currPosIndex].y);
    else if (run || !equilibriumFound) b.draw();
    else if (!run && equilibriumFound) {b.animateTo(b.startPos, ease); currPosIndex = 0;}
    } catch (error) {
      console.error(error);
      console.log(b.shape.length)
      console.log(currPosIndex)
    }
  }

  for (let m of magnets) {
    m.draw();
  }

  if (hoveredOnMagnet()) {
    document.body.style.cursor = 'pointer';
  }
  else document.body.style.cursor = 'default';
}