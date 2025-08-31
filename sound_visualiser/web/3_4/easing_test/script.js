const ball = document.getElementById('ball');
const numberLineContainer = document.querySelector('.number-line-container');

let target = 0; // final pos
let smoothTarget = 0; // intermediate target that smoothly moves towards target
let current = 0; // ball's current position
let velocity = 0; // ball's current velocity

// how quickly intermediate target catches up to desired target
const smoothTargetEasingFactor = 0.01; // Smaller value = slower intermediate target movement

// how strongly the smooth target "pulls" the ball (acceleration factor)
const attractionFactor = 0.005; // Adjust for stronger/weaker pull

// how much the ball's velocity is reduced each frame (damping)
const dampingFactor = 0.8; // Closer to 1 = less damping (more oscillation), Closer to 0 = more damping (stops faster)

// Snapping thresholds
const positionThreshold = 1; // If the ball is within this many pixels of the target
const velocityThreshold = 0.1; // If the ball's velocity is less than this value

let animationFrameId = null;
let containerRect = numberLineContainer.getBoundingClientRect();

window.addEventListener('load', () => {
    containerRect = numberLineContainer.getBoundingClientRect();

    current = containerRect.width / 2;
    smoothTarget = current; 
    target = current; 
    velocity = 0; 

    ball.style.left = current + 'px';

    animationFrameId = requestAnimationFrame(updateBallPosition);
});


// Add a keydown event listener to the entire document
document.addEventListener('keydown', (event) => {
    // Get the key that was pressed
    const key = event.key;

    if (key >= '0' && key <= '9') {
        // Convert the key character to a number
        const numberPressed = parseInt(key, 10);

        // Calculate the target position based on the number pressed
        // We map 0 to the left edge and 9 to the right edge of the container.
        const newTarget = (numberPressed / 9) * containerRect.width;

        // Update the target variable
        target = Math.max(0, Math.min(newTarget, containerRect.width));
    }
});

function updateBallPosition() {
    
    const deltaSmoothTarget = target - smoothTarget;
    smoothTarget += deltaSmoothTarget * smoothTargetEasingFactor;

    const distanceToSmoothTarget = smoothTarget - current;
    const force = distanceToSmoothTarget * attractionFactor;

    // smoothTarget is larger at the start, small at end (ease out)
    // distanceToSmoothTarget will increase at the start given that attractionFactor < smoothTargetEasingFactor (ease in)

    velocity += force;
    velocity *= dampingFactor;
    current += velocity;

    if (Math.abs(target-current) < positionThreshold && Math.abs(velocity) < velocityThreshold) {
        current = target;
        smoothTarget = target
        velocity = 0;
    }


    ball.style.left = current + 'px';
    animationFrameId = requestAnimationFrame(updateBallPosition);
}