import { DOMElements } from './ui.js'; // To get canvas elements

let historicalChartInstance = null;
let portfolioWeightsChartInstance = null;

export function stringToColour(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    var colour = '#';
    for (var i = 0; i < 3; i++) {
        var value = (hash >> (i * 8)) & 0xFF;
        colour += ('00' + value.toString(16)).slice(-2);
    }
    return colour;
}


export function initCharts(historicalChartCanvas, weightsChartCanvas) { // init empty charts
    if (historicalChartInstance) historicalChartInstance.destroy();
    if (portfolioWeightsChartInstance) portfolioWeightsChart.destroy();

    if (historicalChartCanvas) {
        historicalChartInstance = new Chart(historicalChartCanvas, {
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                stacked: false,
                plugins: {
                    title: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month', // Default unit; will adapt based on data density
                            tooltipFormat: 'MMM d, yyyy', // Format for tooltips
                            displayFormats: {
                                day: 'MMM d',
                                week: 'MMM d',
                                month: 'MMM yyyy',
                                year: 'yyyy'
                            }
                        },
                        title: { display: false, }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Cumulative Value ($)'
                        }
                    }
                },
                elements: {point: {radius: 0}},
                onClick: (e, elements, chart) => {
                    // Handle click on a dataset line to select a portfolio
                    if (elements.length > 0) {
                        const datasetIndex = elements[0].datasetIndex;
                        const portfolioId = chart.data.datasets[datasetIndex].portfolioId;
                        if (typeof chart.options.onClickCallback === 'function') {
                            chart.options.onClickCallback(portfolioId);
                        }
                    }
                }
            }
        });
    }

    if (weightsChartCanvas) {
        portfolioWeightsChartInstance = new Chart(weightsChartCanvas, {
            type: 'doughnut',
            data: {
                labels: [], // Asset tickers/names
                datasets: [{
                    data: [], // Weights
                    backgroundColor: [],
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                plugins: {
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed.toFixed(2) + '%';
                                }
                                return label;
                            }
                        }
                    },
                    legend: { display: false }
                }
            }
        });
    }
}

/**
 * Updates (or initializes) the Chart.js charts based on calculated portfolio data.
 * @param {Array<Object>} calculatedPortfolios - All calculated portfolio objects.
 * @param {string|null} activePortfolioId - ID of the currently active portfolio.
 * @param {Function} onHistoricalChartClick - Callback for when a line on the historical chart is clicked.
 */
export function updateCharts(calculatedPortfolios, activePortfolioId, onHistoricalChartClick) {
    if (historicalChartInstance) historicalChartInstance.destroy(); // Destroy old instance to prevent memory leaks

    const historicalDatasets = calculatedPortfolios.map((p, index) => ({
        label: `Portfolio ${index + 1}`,
        data: p.historicalSeries.map(d => ({ x: d.date, y: d.value })),
        borderColor: p.id === activePortfolioId ? 'rgb(59, 130, 246)' : 'rgb(107, 114, 128)', // blue-600 vs gray-500
        borderWidth: p.id === activePortfolioId ? 3 : 1,
        tension: 0.1,
        fill: false,
        id: p.id, // Store ID to identify on click
        hidden: false // Ensure all are visible by default unless specified
    }));

    historicalChartInstance = new Chart(DOMElements.historicalChartCanvas, {
        type: 'line',
        data: {
            datasets: historicalDatasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            // Ensure Luxon is loaded and used for time parsing if applicable
                            if (context[0] && context[0].parsed && context[0].parsed.x) {
                                return new Date(context[0].parsed.x).toLocaleDateString();
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM D, YYYY'
                    },
                    title: { display: false }
                },
                y: {
                    title: { display: true, text: 'Cumulative Value' },
                    beginAtZero: true
                }
            },
            elements: {point: {radius: 0}},
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const clickedDatasetIndex = elements[0].datasetIndex;
                    const portfolioId = historicalChartInstance.data.datasets[clickedDatasetIndex].id;
                    onHistoricalChartClick(portfolioId); // Call callback to update active portfolio in app.js
                }
            }
        }
    });


    // --- Update Portfolio Weights Chart ---
    if (portfolioWeightsChartInstance) portfolioWeightsChartInstance.destroy(); // Destroy old instance

    const activePortfolio = calculatedPortfolios.find(p => p.id === activePortfolioId);

    if (activePortfolio && Object.keys(activePortfolio.weights).length > 0) {
        const weightLabels = Object.keys(activePortfolio.weights);
        const weightValues = weightLabels.map(ticker => (activePortfolio.weights[ticker] * 100)); // Convert to percentage

        const backgroundColors = weightLabels.map(ticker => (stringToColour(ticker)));

        portfolioWeightsChartInstance = new Chart(DOMElements.portfolioWeightsChartCanvas, {
            type: 'doughnut',
            data: {
                labels: weightLabels,
                datasets: [{
                    label: 'Portfolio Weight (%)',
                    data: weightValues,
                    backgroundColor: backgroundColors,
                    hoverOffset: 3
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                plugins: {
                    title: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed.toFixed(2) + '%';
                                }
                                return label;
                            }
                        }
                    },
                    legend: { display: false }
                }
            }
        });
        DOMElements.portfolioWeightsChartCanvas.style.display = 'block'; // Ensure canvas is visible
    } else {
        DOMElements.portfolioWeightsChartCanvas.style.display = 'none'; // Hide canvas if no active portfolio
    }
}