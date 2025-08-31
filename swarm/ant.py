import numpy as np
import matplotlib.pyplot as plt

# Graph class represents the environment where ants will travel
class Graph:
    def __init__(self, distances):
        # Initialize the graph with a distance matrix (distances between nodes)
        self.distances = distances
        self.num_nodes = len(distances)  # Number of nodes (cities)
        # Initialize pheromones for each path between nodes (same size as distances)
        self.pheromones = np.ones_like(distances, dtype=float)  # Start with equal pheromones

# Ant class represents an individual ant that travels across the graph
class Ant:
    def __init__(self, graph):
        self.graph = graph
        # Choose a random starting node for the ant
        self.current_node = np.random.randint(graph.num_nodes)
        self.path = [self.current_node]  # Start path with the initial node
        self.total_distance = 0  # Start with zero distance traveled
        # Unvisited nodes are all nodes except the starting one
        self.unvisited_nodes = set(range(graph.num_nodes)) - {self.current_node}

    # Select the next node for the ant to travel to, based on pheromones and distances
    def select_next_node(self):
        # Initialize an array to store the probability for each node
        probabilities = np.zeros(self.graph.num_nodes)
        # For each unvisited node, calculate the probability based on pheromones and distances
        for node in self.unvisited_nodes:
            if self.graph.distances[self.current_node][node] > 0:  # Only consider reachable nodes
                # The more pheromones and the shorter the distance, the more likely the node will be chosen
                probabilities[node] = (self.graph.pheromones[self.current_node][node] ** 2 /
                                       self.graph.distances[self.current_node][node])
        probabilities /= probabilities.sum()  # Normalize the probabilities to sum to 1
        # Choose the next node based on the calculated probabilities
        next_node = np.random.choice(range(self.graph.num_nodes), p=probabilities)
        return next_node

    # Move to the next node and update the ant's path
    def move(self):
        next_node = self.select_next_node()  # Pick the next node
        self.path.append(next_node)  # Add it to the path
        # Add the distance between the current node and the next node to the total distance
        self.total_distance += self.graph.distances[self.current_node][next_node]
        self.current_node = next_node  # Update the current node to the next node
        self.unvisited_nodes.remove(next_node)  # Mark the next node as visited

    # Complete the path by visiting all nodes and returning to the starting node
    def complete_path(self):
        while self.unvisited_nodes:  # While there are still unvisited nodes
            self.move()  # Keep moving to the next node
        # After visiting all nodes, return to the starting node to complete the cycle
        self.total_distance += self.graph.distances[self.current_node][self.path[0]]
        self.path.append(self.path[0])  # Add the starting node to the end of the path

# ACO (Ant Colony Optimization) class runs the algorithm to find the best path
class ACO:
    def __init__(self, graph, num_ants, num_iterations, decay=0.5, alpha=1.0):
        self.graph = graph
        self.num_ants = num_ants  # Number of ants in each iteration
        self.num_iterations = num_iterations  # Number of iterations
        self.decay = decay  # Rate at which pheromones evaporate
        self.alpha = alpha  # Strength of pheromone update
        self.best_distance_history = []  # Store the best distance found in each iteration

    # Main function to run the ACO algorithm
    def run(self):
        best_path = None
        best_distance = np.inf  # Start with a very large number for comparison
        # Run the algorithm for the specified number of iterations
        for _ in range(self.num_iterations):
            ants = [Ant(self.graph) for _ in range(self.num_ants)]  # Create a group of ants
            for ant in ants:
                ant.complete_path()  # Let each ant complete its path
                # If the current ant's path is shorter than the best one found so far, update the best path
                if ant.total_distance < best_distance:
                    best_path = ant.path
                    best_distance = ant.total_distance
            self.update_pheromones(ants)  # Update pheromones based on the ants' paths
            self.best_distance_history.append(best_distance)  # Save the best distance for each iteration
        return best_path, best_distance

    # Update the pheromones on the paths after all ants have completed their trips
    def update_pheromones(self, ants):
        self.graph.pheromones *= self.decay  # Reduce pheromones on all paths (evaporation)
        # For each ant, increase pheromones on the paths they took, based on how good their path was
        for ant in ants:
            for i in range(len(ant.path) - 1):
                from_node = ant.path[i]
                to_node = ant.path[i + 1]
                # Update the pheromones inversely proportional to the total distance traveled by the ant
                self.graph.pheromones[from_node][to_node] += self.alpha / ant.total_distance

# Generate random distances between nodes (cities) for a 20-node graph
num_nodes = 20
distances = np.random.randint(1, 100, size=(num_nodes, num_nodes))  # Random distances between 1 and 100
np.fill_diagonal(distances, 0)  # Distance from a node to itself is 0
graph = Graph(distances)  # Create the graph with the random distances
aco = ACO(graph, num_ants=10, num_iterations=30)  # Initialize ACO with 10 ants and 30 iterations
best_path, best_distance = aco.run()  # Run the ACO algorithm to find the best path

# Print the best path found and the total distance
print(f"Best path: {best_path}")
print(f"Total distance: {best_distance}")

# Plotting the final solution (first plot) - Shows the final path found by the ants
def plot_final_solution(distances, path):
    num_nodes = len(distances)
    # Generate random coordinates for the nodes to visualize them on a 2D plane
    coordinates = np.random.rand(num_nodes, 2) * 10
    # Plot the nodes (cities) as red points
    plt.scatter(coordinates[:, 0], coordinates[:, 1], color='red')
    # Label each node with its index number
    for i in range(num_nodes):
        plt.text(coordinates[i, 0], coordinates[i, 1], f"{i}", fontsize=10)
    # Plot the path (edges) connecting the nodes, showing the best path found
    for i in range(len(path) - 1):
        start, end = path[i], path[i + 1]
        plt.plot([coordinates[start, 0], coordinates[end, 0]], 
                 [coordinates[start, 1], coordinates[end, 1]], 
                 'blue', linewidth=1.5)
    plt.title("Final Solution: Best Path")
    plt.show()

# Plotting the distance over iterations (second plot) - Shows how the path length improves over time
def plot_distance_over_iterations(best_distance_history):
    # Plot the best distance found in each iteration (should decrease over time)
    plt.plot(best_distance_history, color='green', linewidth=2)
    plt.title("Trip Length Over Iterations")
    plt.xlabel("Iteration")
    plt.ylabel("Distance")
    plt.show()

# Call the plotting functions to display the results
plot_final_solution(distances, best_path)
plot_distance_over_iterations(aco.best_distance_history)