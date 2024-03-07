import * as THREE from 'three';

import { RoundedBoxGeometry } from '/rubik/RoundedBoxGeometry.js';
import { RoundedPlaneGeometry } from '/rubik/RoundedPlaneGeometry.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Cube } from '/rubik/solver/beginner/cubie.js';
import { BeginnerSolver } from '/rubik/solver/beginner/beginner_solver.js';

function* enumerate (it, start = 0) { let i = start
    for (const x of it)
      yield [i++, x]
}

// default setups
const renderer = new THREE.WebGLRenderer( { antialias: true } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.ReinhardToneMapping;
document.getElementById( 'scene' ).appendChild( renderer.domElement );

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 200 );
camera.position.set( 5, 5, 10 );
camera.lookAt( 0, 0, 0 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.addEventListener( 'change', render );

const renderScene = new RenderPass( scene, camera );

// add glow to cube
const BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set( BLOOM_SCENE );

const darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );
const materials = {};

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
bloomPass.threshold = 0.25;
bloomPass.strength = 1;
bloomPass.radius = 0.25;

const bloomComposer = new EffectComposer( renderer );
bloomComposer.renderToScreen = false;
bloomComposer.addPass( renderScene );
bloomComposer.addPass( bloomPass );

const mixPass = new ShaderPass(
    new THREE.ShaderMaterial( {
        uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: bloomComposer.renderTarget2.texture }
        },
        vertexShader: document.getElementById( 'vertexshader' ).textContent,
        fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
        defines: {}
    } ), 'baseTexture'
);
mixPass.needsSwap = true;

const outputPass = new OutputPass();

const finalComposer = new EffectComposer( renderer );
finalComposer.addPass( renderScene );
finalComposer.addPass( mixPass );
finalComposer.addPass( outputPass );

// select color to color cube
let colorSelect;
let colorButton;
var buttons = document.getElementsByClassName("button");
for ( let i = 0; i < buttons.length; i++ ) {
    buttons[ i ].addEventListener( "click", onButtonClick );
};

function onButtonClick( event ) {
    if ( colorButton ) {
        colorButton.style.backgroundColor = "black";
    }

    colorSelect = event.target.classList[1];
    colorButton = document.getElementsByClassName( colorSelect )[0];
    colorButton.style.backgroundColor = "white";
}

const raycaster = new THREE.Raycaster();

const mouse = new THREE.Vector2();

window.addEventListener( 'mousemove', onPointerMove ); // glow on hover
window.addEventListener( 'click', onMouseClick ); // color on click

let prev_intersected = null;
function onPointerMove( event ) {

    var canvasBounds = renderer.domElement.getBoundingClientRect();
    mouse.x = ( ( event.clientX - canvasBounds.left ) / ( canvasBounds.right - canvasBounds.left ) ) * 2 - 1;
    mouse.y = - ( ( event.clientY - canvasBounds.top ) / ( canvasBounds.bottom - canvasBounds.top) ) * 2 + 1;
    raycaster.setFromCamera( mouse, camera ); 

    const intersects = raycaster.intersectObjects( scene.children, true );
    if ( intersects.length > 0 ) {

        const object = intersects[ 0 ].object;

        if (prev_intersected == null) {
            prev_intersected = object;
            prev_intersected.layers.toggle( BLOOM_SCENE );
        }
        else if (object != prev_intersected) {
            prev_intersected.layers.toggle( BLOOM_SCENE );
            object.layers.toggle( BLOOM_SCENE );
            prev_intersected = object;
        }

    }
    else {
        if ( prev_intersected != null ) {
            prev_intersected.layers.toggle( BLOOM_SCENE );
            prev_intersected = null;
        }
    }
    render();
}

function onMouseClick( event ) {

    if ( colorSelect && !animOngoing ) {
        var canvasBounds = renderer.domElement.getBoundingClientRect();
        mouse.x = ( ( event.clientX - canvasBounds.left ) / ( canvasBounds.right - canvasBounds.left ) ) * 2 - 1;
        mouse.y = - ( ( event.clientY - canvasBounds.top ) / ( canvasBounds.bottom - canvasBounds.top) ) * 2 + 1;
        raycaster.setFromCamera( mouse, camera );
        
        const intersects = raycaster.intersectObjects( scene.children, true );
        if ( intersects.length > 0 ) {
            if ( intersects[ 0 ].object.geometry.name == "pieceGeometry" ) {
                intersects[ 0 ].object.name = colorSelect;
                intersects[ 0 ].object.material.color.set(colorSelect);
            }
        }

        render();
    }
}

window.onresize = function () {

    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize( width, height );

    bloomComposer.setSize( width, height );
    finalComposer.setSize( width, height );

    render();
};

// set up rubiks cube
var edges = []
var cubies = []
function setupScene() {
    KCube.asyncInit( "/rubik/solver/kociemba/worker.js", function() {
        document.querySelector( ".edit-mode-text" ).textContent = "Solve!";
        document.querySelector( "#solve-button" ).disabled = false;
    });
    //KCube.initSolver();
    scene.traverse( disposeMaterial );
    scene.children.length = 0;

    const ambientLight = new THREE.AmbientLight( 'white', 0.5 );
    ambientLight.position.set( 0, 0, 0 );
    scene.add( ambientLight );

    const dirLight = new THREE.DirectionalLight( 'white', 1 );
    for (const pos of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) {
        const light = dirLight.clone();
        light.position.set( ...pos );
        scene.add( light );
    }
    
    // cube details store whether its [F, B, L, R, D, U] edges are shown. Position can be determined from this too
    const cubieDetails = [
        [1, 0, 1, 0, 1, 0],//1
        [1, 0, 0, 0, 1, 0],//2
        [1, 0, 0, 1, 1, 0],//3
        [0, 0, 1, 0, 1, 0],//4
        [0, 0, 0, 0, 1, 0],//5
        [0, 0, 0, 1, 1, 0],//6
        [0, 1, 1, 0, 1, 0],//7
        [0, 1, 0, 0, 1, 0],//8
        [0, 1, 0, 1, 1, 0],//9

        [1, 0, 1, 0, 0, 0],//1
        [1, 0, 0, 0, 0, 0],//2
        [1, 0, 0, 1, 0, 0],//3
        [0, 0, 1, 0, 0, 0],//4
        [0, 0, 0, 0, 0, 0],//5
        [0, 0, 0, 1, 0, 0],//6
        [0, 1, 1, 0, 0, 0],//7
        [0, 1, 0, 0, 0, 0],//8
        [0, 1, 0, 1, 0, 0],//9

        [1, 0, 1, 0, 0, 1],//1
        [1, 0, 0, 0, 0, 1],//2
        [1, 0, 0, 1, 0, 1],//3
        [0, 0, 1, 0, 0, 1],//4
        [0, 0, 0, 0, 0, 1],//5
        [0, 0, 0, 1, 0, 1],//6
        [0, 1, 1, 0, 0, 1],//7
        [0, 1, 0, 0, 0, 1],//8
        [0, 1, 0, 1, 0, 1],//9
    ];

    const cubeMaterial = new THREE.MeshLambertMaterial( {
        color: 'black',
        wireframe: false
    });

    const edgeGeometry = RoundedPlaneGeometry(
        0.75, // size
        0.15, // radius
        0.05 // depth
    );

    const pieceMaterial = new THREE.MeshLambertMaterial( {
        color: 'gray',
        wireframe: false
    });

    const cubieMesh = new THREE.Mesh(
        new RoundedBoxGeometry( 1, 1, 1, 3, 0.15 ),
        cubeMaterial.clone()
    );

    // generate cube
    //const testCube = "RGYRWWOBWOYWBRWBGYYGOBRBRGROYOGGOGOWWGOBYYBWYRWGROBBYR";
    //const testCube = "WOGOWOYBBWBYORGWYBRBWOBRRWYWYROBROBWYGYRGRGGWGBRYOGOGY";
    //const testCube = "RGYWBBYRRYYRBWOBOYOYGWGGOBORYBBYGWBRGOWOGRGWWORWGRWYBO";
    //const testCube = "WOGGWOBWYRYGOGWRRBBYORGGYGOROYBYBWBROBBRYOWWRWGYRBWGYO"
    //const cD = {"R": "red", "O": "orange", "Y": "yellow", "G": "green", "B": "blue", "W": "white"}
    //var j = 0;
    for (let i = 0; i < cubieDetails.length; i++) {
        var cubie = cubieMesh.clone();
        // [F, B, L, R, D, U]
        var z = cubieDetails[i][0] + cubieDetails[i][1] * -1; 
        var x = cubieDetails[i][2] * -1 + cubieDetails[i][3];
        var y = cubieDetails[i][4] * -1 + cubieDetails[i][5];
        cubie.position.set(x, y, z);

        for (const [index, element] of cubieDetails[i].entries()) {
            if (element == 0) {continue; }

            const edge = new THREE.Mesh( edgeGeometry, pieceMaterial.clone() );
            edge.rotation.set(
                [0, 0, 0, 0, Math.PI / 2, Math.PI / 2][index], // front/back
                [0, 0, Math.PI / 2, Math.PI / 2, 0, 0][index], // left/right
                0
            );
            
            edge.material.color.set( ['white', 'yellow', 'orange', 'red', 'green', 'blue'][index] );
            //edge.material.color.set( cD[testCube[j]] );

            var py = [0, 0, 0, 0, -0.49, 0.53][index]
            var px = [0, 0, -0.53, 0.49, 0, 0][index]
            var pz = [0.49, -0.53, 0, 0, 0, 0][index]
            edge.position.set(px, py, pz);

            edge.name = ['white', 'yellow', 'orange', 'red', 'green', 'blue'][index];
            //edge.name = cD[testCube[j]];
            //j++;

            edge.childNum = index;

            cubie.add( edge );
            edges.push( edge );
        }
        cubie.name = cubieDetails[i];
        cubies.push( cubie );
        scene.add( cubie );
    }

    render();

}

setupScene();

function disposeMaterial( obj ) {

    if ( obj.material ) {
        obj.material.dispose();
    }

}

function darkenNonBloomed( obj ) {

    if ( obj.isMesh && bloomLayer.test( obj.layers ) === false ) {
        materials[ obj.uuid ] = obj.material;
        obj.material = darkMaterial;
    }

}

function restoreMaterial( obj ) {

    if ( materials[ obj.uuid ] ) {
        obj.material = materials[ obj.uuid ];
        delete materials[ obj.uuid ];
    }

}

function render() {

    scene.traverse( darkenNonBloomed );
    bloomComposer.render();
    scene.traverse( restoreMaterial );

    // render the entire scene, then render bloom scene on top
    finalComposer.render();
}

// toggle between different solve modes
var currentSolver = "beginner-solver";
var solverChoices = document.getElementsByClassName( "solver-setting" );

for ( let i = 0; i < solverChoices.length; i++ ) {
    solverChoices[ i ].addEventListener( "click", chooseSolver );
}
function chooseSolver( event ) {
    var solver = document.getElementsByClassName( currentSolver )[0];
    solver.classList.remove("active-solver");

    currentSolver = event.target.classList[1];
    solver = document.getElementsByClassName( currentSolver )[0];
    solver.classList.add("active-solver");

    
    if ( currentSolver == "beginner-solver" ) {
        document.querySelector( ".quick-settings" ).style.display = "none";
        document.querySelector( ".beginner-settings" ).style.display = "block";
    }
    else {
        document.querySelector( ".beginner-settings" ).style.display = "none";
        document.querySelector( ".quick-settings" ).style.display = "block";
    }
}

// if axis is off, exp has to be off
const axisToggle = document.querySelector("#axis-toggle");
const expToggle = document.querySelector("#explanation-toggle");
var prevExp = true;
var prevAxis = true;

axisToggle.addEventListener( "change", toggleAxis );
expToggle.addEventListener( "change", toggleExp );

function toggleAxis() {
    prevAxis = axisToggle.checked;
    if ( axisToggle.checked == false && expToggle.checked ) {
        // axis switched off, but exp still on
        expToggle.checked = false;
        prevExp = true;
    }
    else {
        // restore prev state of Exp
        expToggle.checked = prevExp;
    }
}

function toggleExp() {
    prevExp = expToggle.checked;
    if ( expToggle.checked && axisToggle.checked == false) {
        axisToggle.checked = true;
        prevAxis = false;
    }
    else {
        axisToggle.checked = prevAxis;
    }
}

// Choose max steps for quick solver
const incrementButton = document.querySelector( "#increment" );
const decrementButton = document.querySelector( "#decrement" );
const stepsInput = document.querySelector( "#steps" );

incrementButton.addEventListener( "click", ( ) => {
    stepsInput.value = parseInt( stepsInput.value ) + 1; 
    if ( stepsInput.value > parseInt( stepsInput.max ) ) {
        stepsInput.value = stepsInput.max;
    }
}
);
decrementButton.addEventListener( "click", ( ) => {
    stepsInput.value = parseInt( stepsInput.value ) - 1;
    if ( stepsInput.value < parseInt( stepsInput.min ) ) {
        stepsInput.value = stepsInput.min;
}
} );
stepsInput.addEventListener( "change", ( ) => {
    if ( stepsInput.value > parseInt( stepsInput.max ) ) {
        stepsInput.value = stepsInput.max;
    } else if ( stepsInput.value < parseInt( stepsInput.min ) ) {
        stepsInput.value = stepsInput.min;
    }
}
);


// Animation speed
var animSpeed = 500;
for (const slider of document.getElementsByClassName( "range-slider" )) {
    slider.addEventListener( "input", updateSpeed );
    slider.addEventListener( "change", updateSpeed );
}
function updateSpeed( e ) {
    for (const sliderValue of document.getElementsByClassName( "range-value" )) {
        sliderValue.innerHTML = e.target.value + 'ms';
        animSpeed = e.target.value;
    }
    for (const slider of document.getElementsByClassName( "range-slider" )) {
        slider.value = e.target.value;
    }
}

// toggle solve button between solve and back
const solveButton = document.getElementById( "solve-button" );
var editMode = true;
solveButton.addEventListener( "click", solverClick );

var moves = [];
var explanation = [];
var animationCounter = 0;
var cube;
function resetCamera() {
    animOngoing = true;
    animate();
    new TWEEN.Tween( camera.position )
    .to(  {x: 5, y: 5, z: 10}, 500 )
    .easing( TWEEN.Easing.Quartic.InOut )
    .onComplete( function() {animOngoing = false;} )
    .start( );
}
function solverClick() {
    if (!animOngoing) {
        solveButton.classList.remove("solve-button-edit-mode");
        solveButton.classList.add("solve-button-solve-mode");
        editMode = !editMode;

        const menuSwitch = document.getElementById( "menu-switch" );
        menuSwitch.checked = false;
        menuSwitch.disabled = true;
    
        const solveSwitch = document.getElementById( "solve-switch" );
        const solveToggle = document.getElementById( "solve-toggle" );
        solveToggle.style.display = "inline-block";
        solveSwitch.checked = true;
        solveSwitch.disabled = false;

        if ( window.matchMedia( "(orientation: portrait)" ).matches ) {
            const canvas = document.querySelector( "canvas" )
            canvas.style.height = "30vh";
            canvas.style.width = "30vw";
            canvas.style.marginLeft = "35vw";
        }
    
        document.getElementById( "action-container" ).style.bottom = "-10em";
    
        resetCamera();

        moves = [];
        animationCounter = 0;
        cube = new Cube();

        cube.from_rendered_cube( edges );
        if ( cube.verify_cube() != "Valid Cube" ) {
            invalidCube();
            return;
        }
        
        if ( currentSolver == "beginner-solver" ) {
            const solve = new BeginnerSolver( cube );
            [moves, explanation] = solve.solution();

            if ( expToggle.checked ) { toBeginnerExpSolver(); }
            else { toBeginnerSolver( axisToggle.checked ); }
        }
        else {
            toQuickSolver();
        }
    }
}

function invalidCube() {

    const solveStepDisplay = document.getElementById("solve-steps"); 
    solveStepDisplay.innerHTML = `<div class='title'>Solver</div>
    <div class = 'move-step'>
        <span class = 'step-explanation'>Invalid Cube: ${ cube.verify_cube() }</span>
    </dov>`;
}

function toBeginnerExpSolver() {
    // remove all previous moves
    const solveStepDisplay = document.getElementById("solve-steps"); 
    solveStepDisplay.innerHTML = "<div class='title'>Solver</div>";

    function makeHTML(dict, parentMoveStep) {

        for (const [key, value] of Object.entries( dict )) {

            var currStep = document.createElement( "div" );
            currStep.classList.add( "move-step" );
            parentMoveStep.appendChild( currStep );

            var stepExp = document.createElement( "span" );
            stepExp.textContent = key;
            stepExp.classList.add( "step-explanation" );
            currStep.appendChild( stepExp );

            if ( typeof value === 'object' && value !== null && !( value instanceof Array ) ) { // if is dictionary
                makeHTML( value, currStep );
            }
            else {
                for (const m of value) {
                    if (m.length > 3 || m == "") {
                        stepExp.textContent += m;
                    }
                    else {
                        var move =  document.createElement( "span" );
                        move.textContent = m;
                        move.classList.add( "move" );
                        currStep.appendChild( move );
                        move.setAttribute( "id", `m${moveCnt}` );
                        move.addEventListener( "click", goToMove );
                        moveCnt++;
                    }
                }
            }
        }
    }

    var moveCnt = 0;
    const generalMoves = {0: "Solve White Cross", 1: "Solve First layer", 3: "Solve Second Layer", 4: "Solve Yellow Cross", 5: "Solve Last layer"};
    for ( let i = 0; i < 6; i++ ) {
        var moveStep = document.createElement( "div" );
        moveStep.classList.add( "move-step" );

        var stepExp = document.createElement( "span" );
        stepExp.textContent = generalMoves[i];
        stepExp.classList.add( "step-explanation" );
        moveStep.appendChild( stepExp );

        document.getElementById( "solve-steps" ).appendChild( moveStep );

        makeHTML(explanation[i], moveStep);
    }
}

function makegridHTML( moves ) {
    // remove all previous moves
    const solveStepDisplay = document.getElementById("solve-steps"); 
    solveStepDisplay.innerHTML = "<div class='title'>Solver</div>";

    var step = document.createElement( "div" );
    step.classList.add( "move-step" );
    solveStepDisplay.appendChild( step );

    for ( const [cnt, m] of enumerate(moves) ) {
        var move =  document.createElement( "span" );
        move.textContent = m;
        move.classList.add( "move" );
        move.setAttribute( "id", `m${cnt}` );
        move.addEventListener( "click", goToMove );
        step.appendChild( move );
    }
}

function toBeginnerSolver( axisRotations ) {
    if ( !axisRotations ) {
        const convert = {
            "Y": {
                "U": "U", "D": "D", "L": "F", "F": "R", "R": "B", "B": "L", 
                "X": "Z'",
                "X'": "Z",
                "Z": "X",
                "Y": "Y"
            },
            "X": {
                "L": "L", "R": "R", "D": "B", "B": "U", "U": "F", "F": "D", 
                "Y": "Z", 
                "Z": "Y'",
                "Z'": "Y",
                "X": "X"
            },
            "Z" : {
                "F": "F", "B": "B", "U": "L", "L": "D", "D": "R", "R": "U", 
                "X": "Y", 
                "Y": "X'",
                "Y'": "X",
                "Z": "Z" 
            }
        }

        function swapKeysAndValues( obj ) {
            const swapped = Object.entries( obj ).map( ([key, value]) => [value, key] );
            return Object.fromEntries(swapped);
        }
        function toggleCounter( move ) { 
            if ( move.includes("'") ) return move[0];
            else return move + "'"
        }
        function axisMove( move, moveMap ) {
            if ( move.includes("'") ) return toggleCounter( moveMap[ move[0] ] );
            else if ( move.includes("2") ) return moveMap[ move[0] ][0] + "2";
            else return moveMap[ move ];
        }

        for ( let i = 0; i < moves.length; i++ ) {

            if ( ["X", "Y", "Z"].includes( moves[i][0] ) ) {// if move is a turn
                var moveMap = _.cloneDeep( convert[ moves[i][0] ] );
                if ( moves[i].includes("'") ) { moveMap = swapKeysAndValues( moveMap ); }
                for ( let j = i + 1; j < moves.length; j++ ) { // convert all moves after
                    moves[j] = axisMove( moves[j], moveMap );
                    if ( moves[i].includes("2") ) {
                        moves[j] = axisMove( moves[j], moveMap );
                    }
                }
            }
        }

        moves = moves.filter( (move) => !["X", "Y", "Z"].includes( move[0] ) );
    }

    makegridHTML( moves );
}

function toQuickSolver() {
    const solveStepDisplay = document.getElementById("solve-steps"); 
    solveStepDisplay.innerHTML = `<div class='title'>Solver</div>
    <div class = 'move-step'>
        <span class = 'step-explanation'>Loading Solution...</span>
    </dov>`;

    const n_cube = cube.to_naive_cube();

    const color_state = { "W": "F", "R": "R", "O": "L", "Y": "B", "B": "U", "G": "D" };
    const cube_state = n_cube.slice(0, 9) + n_cube.slice(27, 36) + n_cube.slice(18, 27) + n_cube.slice(45) + n_cube.slice(9, 18) + n_cube.slice(36, 45)
    var cube_face = "";
    for ( let i = 0; i < cube_state.length; i++ ) {
        cube_face += color_state[ cube_state[i] ];
    }

    const solveCube = KCube.fromString( cube_face );
    KCube.asyncSolve( solveCube, stepsInput.value,
        function( algo ) { 
        moves = algo;
        makegridHTML( moves );
    });
}

function reverseMoves( move ) {
    if ( move.includes("'") ) return move[0].toUpperCase();
    else if ( move.includes('2') ) return move;
    else return move[0].toUpperCase() + "'";
}

var animOngoing = false;
function nextAnimation( highlight = true, targetMove = moves.length, reverse = false ) {
    if (animationCounter < targetMove && !reverse && animOngoing) {
        if ( highlight ) highlightMove();
        animateRotate( moves[ animationCounter ], highlight, targetMove, reverse );
        animationCounter++;
    }
    else if ( animationCounter > targetMove && reverse && animOngoing ) {
        animationCounter--;
        if ( highlight ) highlightMove();
        animateRotate( reverseMoves( moves[ animationCounter ] ), highlight, targetMove, reverse );
    }
    else {
        animOngoing = false;
    }
}

//click on move
function goToMove( e ) {
    const targetMove = Number(e.target.id.slice(1));
    if ( targetMove > animationCounter && !animOngoing ) {
        animOngoing = true;
        animate();
        nextAnimation( true, targetMove + 1 );
    }
    else if ( targetMove < animationCounter && !animOngoing ) {
        animOngoing = true;
        animate();
        nextAnimation( true, targetMove, true );
    }
}

//play next animation
function highlightMove() {
    const currActive = document.querySelector( ".active-move" );
    const toHighlight = document.querySelector( `#m${animationCounter}` );
    if (currActive) {currActive.classList.remove( "active-move" );}
    if ( toHighlight ) {
        toHighlight.classList.add( "active-move" );

        toHighlight.scrollIntoView({ block: 'center',  behavior: 'smooth' });
    }
}

const animStepButton = document.querySelector("#forward-move");
animStepButton.addEventListener( "click", playNextAnim );
function playNextAnim() {
    if (animationCounter < moves.length && !animOngoing) {
        animOngoing = true;
        animate();
        nextAnimation( true, animationCounter + 1, false );
    }
}

//reverse animation
const animBackButton = document.querySelector("#reverse-move");
animBackButton.addEventListener( "click", reverseAnimation );
function reverseAnimation() {
    if ( animationCounter > 0 && !animOngoing ) {
        animOngoing = true;
        animate();
        nextAnimation( true, animationCounter - 1, true );
    }
}

//play all animation
const animAllButton = document.querySelector("#play-all");
animAllButton.addEventListener( "click", animAll );
function animAll() {
    if (!animOngoing) {
        animOngoing = true;
        animate();
        nextAnimation();
    }
}

// pause anim
const pauseButton = document.querySelector("#pause");
pauseButton.addEventListener( "click", pauseOngoing );
function pauseOngoing() {
    const ongoingAnim = TWEEN.getAll()[0];
    if (ongoingAnim) {
        ongoingAnim._onCompleteCallback = function () { animOngoing = false; };
    }
    else {
        animOngoing = false;
    }
}

// back to edit page
const backButton = document.getElementById("solve-toggle");
backButton.addEventListener( "click", toEdit );

function toEdit() {
    // return back to edited cube
    if ( !animOngoing ) {
        editMode = !editMode;
    
        solveButton.classList.remove("solve-button-solve-mode");
        solveButton.classList.add("solve-button-edit-mode");
        if ( window.matchMedia( "(orientation: portrait)" ).matches ) {
            const canvas = document.querySelector( "canvas" )
            canvas.style.height = "100vh";
            canvas.style.width = "100vw";
            canvas.style.marginLeft = "0";
        }
    
        const menuSwitch = document.getElementById( "menu-switch" );
        menuSwitch.disabled = false;
    
        const solveSwitch = document.getElementById( "solve-switch" );
        const solveToggle = document.getElementById( "solve-toggle" );
        solveToggle.style.display = "none";
        solveSwitch.checked = false;
        solveSwitch.disabled = true;
    
        document.getElementById( "action-container" ).style.bottom = "0";
    }
}

// random moves
const shuffleButton = document.getElementById("shuffle");
shuffleButton.addEventListener( "click", shuffle );
function shuffle() {
    if ( !animOngoing ) {
        animationCounter = 0;
        moves = [];
        const rotations = ["U", "U'", "U2", "D", "D'", "D2", "L", "L'", "L2", "R", "R'", "R2", "F", "F'", "F2", "B", "B'", "B2"];
        for (let i = 0; i < 20; i++) {moves.push(rotations[Math.floor(Math.random()*rotations.length)]);}
        animOngoing = true;
        animate();
        nextAnimation( false );
    }
}

// animate cube rotation

function rotateRightCW( )   { rotate( 'XYZ', 'x',  1, -1 ) }
function rotateRightACW( )  { rotate( 'XYZ', 'x',  1,  1 ) }
function rotateRight( )     { rotate( 'XYZ', 'x',  1, -1, Math.PI ) }

function rotateLeftCW( )    { rotate( 'XYZ', 'x', -1,  1 ) }
function rotateLeftACW( )   { rotate( 'XYZ', 'x', -1, -1 ) }
function rotateLeft( )      { rotate( 'XYZ', 'x', -1,  1, Math.PI ) }

function rotateTopCW( )     { rotate( 'YZX', 'y',  1, -1 ) }
function rotateTopACW( )    { rotate( 'YZX', 'y',  1,  1 ) }
function rotateTop( )       { rotate( 'YZX', 'y',  1, -1, Math.PI ) }

function rotateBottomCW( )  { rotate( 'YZX', 'y', -1,  1 ) }
function rotateBottomACW( ) { rotate( 'YZX', 'y', -1, -1 ) }
function rotateBottom( )    { rotate( 'YZX', 'y', -1,  1, Math.PI ) }

function rotateFrontCW( )   { rotate( 'ZXY', 'z',  1, -1 ) }
function rotateFrontACW( )  { rotate( 'ZXY', 'z',  1,  1 ) }
function rotateFront( )     { rotate( 'ZXY', 'z',  1, -1, Math.PI ) }

function rotateBackCW( )    { rotate( 'ZXY', 'z', -1,  1 ) }
function rotateBackACW( )   { rotate( 'ZXY', 'z', -1, -1 ) }
function rotateBack( )      { rotate( 'ZXY', 'z', -1,  1, Math.PI ) }

function rotateYCW( )       { rotate( 'YZX', 'y',  1, -1, Math.PI/2, true ) }
function rotateYACW( )      { rotate( 'YZX', 'y',  1,  1, Math.PI/2, true ) }
function rotateY( )         { rotate( 'YZX', 'y',  1, -1, Math.PI, true ) }

function rotateZCW( )       { rotate( 'ZXY', 'z', 1, -1, Math.PI/2, true ) }
function rotateZACW( )      { rotate( 'ZXY', 'z', 1,  1, Math.PI/2, true ) }
function rotateZ( )         { rotate( 'ZXY', 'z', 1, -1, Math.PI, true ) }

function rotateXCW( )       { rotate( 'XYZ', 'x', 1, -1, Math.PI/2, true  ) }
function rotateXACW( )      { rotate( 'XYZ', 'x', 1,  1, Math.PI/2, true ) }
function rotateX( )         { rotate( 'XYZ', 'x', 1, -1, Math.PI, true  ) }

var rotations = {
    "R": rotateRightCW,
    "R'": rotateRightACW,
    "R2": rotateRight,

    "L": rotateLeftCW,
    "L'": rotateLeftACW,
    "L2": rotateLeft,

    "U": rotateTopCW,
    "U'": rotateTopACW,
    "U2": rotateTop,

    "D": rotateBottomCW,
    "D'": rotateBottomACW,
    "D2": rotateBottom,

    "F": rotateFrontCW,
    "F'": rotateFrontACW,
    "F2": rotateFront,

    "B": rotateBackCW,
    "B'": rotateBackACW,
    "B2": rotateBack,

    "Y": rotateYCW,
    "Y'": rotateYACW,
    "Y2": rotateY,

    "X": rotateXCW,
    "X'": rotateXACW,
    "X2": rotateX,

    "Z": rotateZCW,
    "Z'": rotateZACW,
    "Z2": rotateZ
}

function animateRotate( direction, highlight, targetMove, reverse ) {
    rot.k = 0;
    rot.oldK = 0;
    new TWEEN.Tween( rot )
        .to( {k: 1}, animSpeed )
        .easing( TWEEN.Easing.Quartic.InOut )
        .onUpdate( rotations[ direction ] )
        .onComplete( function () { nextAnimation( highlight, targetMove, reverse ); } )
        .start( );
}

// a general rotator
var rot = {k: 0, oldK: 0}
var e = new THREE.Euler( );

function rotate( order, axis, sign, dir, magnitude = Math.PI/2, rotateAxis = false ) {
    for ( var cubie of cubies ) {
        if ( rotateAxis ) {
            cubie.rotation.reorder( order );
            cubie.rotation[axis] += dir * magnitude * ( rot.k - rot.oldK );
            
            e.set( 0, 0, 0, order );
            e[ axis ] += dir * magnitude * ( rot.k - rot.oldK );
            cubie.position.applyEuler( e );
        }

        else {
            if ( sign * cubie.position[ axis ] > 0.5 ) {
                cubie.rotation.reorder( order );
                cubie.rotation[ axis ] += dir * magnitude * ( rot.k - rot.oldK );
                
                e.set( 0, 0, 0, order );
                e[ axis ] += dir * magnitude * ( rot.k - rot.oldK );
                cubie.position.applyEuler( e );
            }
        }
        if( rot.k == 1 ) {cubie.position.round();}
    }
    rot.oldK = rot.k;
}

function animate() {
    if (animOngoing) requestAnimationFrame( animate );
    TWEEN.update();
    controls.update();
    renderer.render( scene, camera );
}