import numpy as np
import matplotlib.pyplot as plt

# Define the PSO parameters
class Particle:
    def __init__(self, n_assets):
        # Initialize a particle with random weights and velocities
        self.position = np.random.rand(n_assets)
        self.position /= np.sum(self.position)  # Normalize weights so they sum to 1
        self.velocity = np.random.rand(n_assets)
        self.best_position = np.copy(self.position)
        self.best_score = float('inf')  # Start with a very high score

def objective_function(weights, returns, covariance):
    """
    Calculate the portfolio's performance.
    - weights: Asset weights in the portfolio.
    - returns: Expected returns of the assets.
    - covariance: Covariance matrix representing risk.
    """
    portfolio_return = np.dot(weights, returns)  # Calculate the portfolio return
    portfolio_risk = np.sqrt(np.dot(weights.T, np.dot(covariance, weights)))  # Calculate portfolio risk (standard deviation)
    return -portfolio_return / portfolio_risk  # We want to maximize return and minimize risk

def update_particles(particles, global_best_position, returns, covariance, w, c1, c2):
    """
    Update the position and velocity of each particle.
    - particles: List of particle objects.
    - global_best_position: Best position found by all particles.
    - returns: Expected returns of the assets.
    - covariance: Covariance matrix representing risk.
    - w: Inertia weight to control particle's previous velocity effect.
    - c1: Cognitive coefficient to pull particles towards their own best position.
    - c2: Social coefficient to pull particles towards the global best position.
    """
    for particle in particles:
        # Random coefficients for velocity update
        r1, r2 = np.random.rand(len(particle.position)), np.random.rand(len(particle.position))
        # Update velocity
        particle.velocity = (w * particle.velocity +
                             c1 * r1 * (particle.best_position - particle.position) +
                             c2 * r2 * (global_best_position - particle.position))
        # Update position
        particle.position += particle.velocity
        particle.position = np.clip(particle.position, 0, 1)  # Ensure weights are between 0 and 1
        particle.position /= np.sum(particle.position)  # Normalize weights to sum to 1
        # Evaluate the new position
        score = objective_function(particle.position, returns, covariance)
        if score < particle.best_score:
            # Update the particle's best known position and score
            particle.best_position = np.copy(particle.position)
            particle.best_score = score

def pso_portfolio_optimization(n_particles, n_iterations, returns, covariance):
    """
    Perform Particle Swarm Optimization to find the optimal asset weights.
    - n_particles: Number of particles in the swarm.
    - n_iterations: Number of iterations for the optimization.
    - returns: Expected returns of the assets.
    - covariance: Covariance matrix representing risk.
    """
    # Initialize particles
    particles = [Particle(len(returns)) for _ in range(n_particles)]
    # Initialize global best position
    global_best_position = np.random.rand(len(returns))
    global_best_position /= np.sum(global_best_position)
    global_best_score = float('inf')
    
    # PSO parameters
    w = 0.5  # Inertia weight: how much particles are influenced by their own direction
    c1 = 1.5  # Cognitive coefficient: how well particles learn from their own best solutions
    c2 = 0.5  # Social coefficient: how well particles learn from global best solutions
    history = []  # To store the best score at each iteration
    
    for _ in range(n_iterations):
        update_particles(particles, global_best_position, returns, covariance, w, c1, c2)
        for particle in particles:
            score = objective_function(particle.position, returns, covariance)
            if score < global_best_score:
                # Update the global best position and score
                global_best_position = np.copy(particle.position)
                global_best_score = score
        # Store the best score (negative return/risk ratio) for plotting
        history.append(-global_best_score)
    
    return global_best_position, history

# Example data for 3 assets
returns = np.array([0.02, 0.28, 0.15])  # Expected returns for each asset
covariance = np.array([[0.1, 0.02, 0.03],  # Covariance matrix for asset risks
                       [0.02, 0.08, 0.04],
                       [0.03, 0.04, 0.07]])

# Run the PSO algorithm
n_particles = 10  # Number of particles
n_iterations = 10  # Number of iterations
best_weights, optimization_history = pso_portfolio_optimization(n_particles, n_iterations, returns, covariance)

# Plotting the optimization process
plt.figure(figsize=(12, 6))
plt.plot(optimization_history, marker='o')
plt.title('Portfolio Optimization Using PSO')
plt.xlabel('Iteration')
plt.ylabel('Objective Function Value (Negative of Return/Risk Ratio)')
plt.grid(False)  # Turn off gridlines
plt.show()

# Display the optimal asset weights
print(f"Optimal Asset Weights: {best_weights}")