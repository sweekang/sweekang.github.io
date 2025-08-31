import numpy as np
import matplotlib.pyplot as plt

# Rastrigin function: The objective is to minimize this function
def rastrigin(X):
    A = 10
    return A * len(X) + sum([(x ** 2 - A * np.cos(2 * np.pi * x)) for x in X])

# Artificial Bee Colony (ABC) algorithm for continuous optimization of Rastrigin function
def artificial_bee_colony_rastrigin(n_iter=100, n_bees=30, dim=2, bound=(-5.12, 5.12)):
    """
    Apply Artificial Bee Colony (ABC) algorithm to minimize the Rastrigin function.
    
    Parameters:
    n_iter (int): Number of iterations
    n_bees (int): Number of bees in the population
    dim (int): Number of dimensions (variables)
    bound (tuple): Bounds for the search space (min, max)
    
    Returns:
    tuple: Best solution found, best fitness value, and list of best fitness values per iteration
    """
    # Initialize the bee population with random solutions within the given bounds
    bees = np.random.uniform(bound[0], bound[1], (n_bees, dim))
    best_bee = bees[0]
    best_fitness = rastrigin(best_bee)
    
    best_fitnesses = []
    
    for iteration in range(n_iter):
        # Employed bees phase: Explore new solutions based on the current bees
        for i in range(n_bees):
            # Generate a new candidate solution by perturbing the current bee's position
            new_bee = bees[i] + np.random.uniform(-1, 1, dim)
            new_bee = np.clip(new_bee, bound[0], bound[1])  # Keep within bounds
            
            # Evaluate the fitness of the new solution
            new_fitness = rastrigin(new_bee)
            if new_fitness < rastrigin(bees[i]):
                bees[i] = new_bee  # Update bee if the new solution is better
        
        # Onlooker bees phase: Exploit good solutions
        fitnesses = np.array([rastrigin(bee) for bee in bees])
        probabilities = 1 / (1 + fitnesses)  # Higher fitness gets higher chance
        probabilities /= probabilities.sum()  # Normalize probabilities
        
        for i in range(n_bees):
            if np.random.rand() < probabilities[i]:
                selected_bee = bees[i]
                # Generate a new candidate solution by perturbing the selected bee
                new_bee = selected_bee + np.random.uniform(-0.5, 0.5, dim)
                new_bee = np.clip(new_bee, bound[0], bound[1])
                if rastrigin(new_bee) < rastrigin(selected_bee):
                    bees[i] = new_bee
        
        # Scouting phase: Randomly reinitialize some bees to explore new areas
        if np.random.rand() < 0.1:  # 10% chance to reinitialize a bee
            scout_index = np.random.randint(n_bees)
            bees[scout_index] = np.random.uniform(bound[0], bound[1], dim)
        
        # Track the best solution found so far
        current_best_bee = bees[np.argmin(fitnesses)]
        current_best_fitness = min(fitnesses)
        
        if current_best_fitness < best_fitness:
            best_fitness = current_best_fitness
            best_bee = current_best_bee
        
        best_fitnesses.append(best_fitness)
    
    return best_bee, best_fitness, best_fitnesses

# Apply ABC to minimize the Rastrigin function
best_solution, best_fitness, best_fitnesses = artificial_bee_colony_rastrigin()

# Display results
print("Best Solution (x, y):", best_solution)
print("Best Fitness (Minimum Value):", best_fitness)

# Plot the performance over iterations
plt.figure()
plt.plot(best_fitnesses)
plt.title('Performance of ABC on Rastrigin Function Optimization')
plt.xlabel('Iterations')
plt.ylabel('Best Fitness (Lower is Better)')
plt.grid(True)
plt.show()

# Plot a surface graph of the Rastrigin function
x = np.linspace(-5.12, 5.12, 200)
y = np.linspace(-5.12, 5.12, 200)
X, Y = np.meshgrid(x, y)
Z = 10 * 2 + (X ** 2 - 10 * np.cos(2 * np.pi * X)) + (Y ** 2 - 10 * np.cos(2 * np.pi * Y))

plt.figure(figsize=(8, 6))
plt.contourf(X, Y, Z, levels=50, cmap='viridis')
plt.colorbar(label='Function Value')
plt.scatter(best_solution[0], best_solution[1], c='red', label='Best Solution')
plt.title('Rastrigin Function Optimization with ABC')
plt.xlabel('X')
plt.ylabel('Y')
plt.legend()
plt.grid(True)
plt.show()