import { stringToColour } from './chartHandler.js';
export const DOMElements = {
    apiKeyInput: document.getElementById('api-key-input'),
    tickerInput: document.getElementById('ticker-input'),
    addAssetBtn: document.getElementById('add-asset-btn'),
    selectedAssetsList: document.getElementById('selected-assets-list'),
    startDateInput: document.getElementById('start-date-input'),
    endDateInput: document.getElementById('end-date-input'),
    dataFrequencySelect: document.getElementById('data-frequency-select'),
    longOnlyCheckbox: document.getElementById('long-only-checkbox'),
    remainingWeightInfo: document.getElementById('remaining-weight-info'),
    calculateGmvBtn: document.getElementById('calculate-gmv-btn'),
    activeVolatilitySpan: document.getElementById('active-volatility'),
    activeReturnSpan: document.getElementById('active-return'),
    detailedDataTableBody: document.getElementById('detailed-data-tbody'),
    covarianceMatrixContainer: document.getElementById('covariance-matrix-container'),
    covarianceMatrixThead: document.getElementById('covariance-matrix-table').querySelector('thead'),
    covarianceMatrixTbody: document.getElementById('covariance-matrix-table').querySelector('tbody'),
    correlationMatrixContainer: document.getElementById('correlation-matrix-container'),
    correlationMatrixThead: document.getElementById('correlation-matrix-table').querySelector('thead'),
    correlationMatrixTbody: document.getElementById('correlation-matrix-table').querySelector('tbody'),
    historicalChartCanvas: document.getElementById('historical-performance-chart'),
    portfolioWeightsChartCanvas: document.getElementById('portfolio-weights-chart'),
    weightsList: document.getElementById('weights-list'),
};

const DEFAULT_API_KEY = 'H4X367UR02DL4B93'; 
export function getApiKey() {
    return DOMElements.apiKeyInput.value.trim() || DEFAULT_API_KEY;
}

const { DateTime } = window.luxon;
export function initializeDateInputs() {
    const today = DateTime.now();
    const fiveYearsAgo = today.minus({ years: 5 }); // defaults to 5 years from now

    DOMElements.endDateInput.value = today.toISODate(); // YYYY-MM-DD
    DOMElements.endDateInput.max = today.toISODate(); // Cannot select a future date

    DOMElements.startDateInput.value = fiveYearsAgo.toISODate();
    DOMElements.startDateInput.max = today.toISODate();

    // Update min/max attributes dynamically based on user input for each field
    DOMElements.startDateInput.addEventListener('change', () => {
        // Start date cannot be after end date
        if (DOMElements.startDateInput.value > DOMElements.endDateInput.value) {
            DOMElements.endDateInput.value = DOMElements.startDateInput.value;
        }
        DOMElements.endDateInput.min = DOMElements.startDateInput.value;
    });

    DOMElements.endDateInput.addEventListener('change', () => {
        // End date cannot be before start date
        if (DOMElements.endDateInput.value < DOMElements.startDateInput.value) {
            DOMElements.startDateInput.value = DOMElements.endDateInput.value;
        }
        DOMElements.startDateInput.max = DOMElements.endDateInput.value;
    });
}

export function getSelectedDateRange() {
    return {
        startDate: DOMElements.startDateInput.value,
        endDate: DOMElements.endDateInput.value
    };
}

export function renderSelectedAssets(selectedAssets, isLongOnly, removeAssetCallback, toggleLockCallback, setWeightBoundsCallback) {
    DOMElements.selectedAssetsList.innerHTML = '';
    if (selectedAssets.length === 0) {
        DOMElements.selectedAssetsList.innerHTML = '<p class="text-gray-500">No assets added yet.</p>';
        return;
    }

    // from flowbite
    const lockedIcon = `
        <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
        <path fill-rule="evenodd" d="M8 10V7a4 4 0 1 1 8 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2-3a2 2 0 1 1 4 0v3h-4V7Zm2 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
        </svg>
        `;
    const unlockedIcon = `
        <svg class="w-6 h-6" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
        <path fill-rule="evenodd" d="M15 7a2 2 0 1 1 4 0v4a1 1 0 1 0 2 0V7a4 4 0 0 0-8 0v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2V7Zm-5 6a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z" clip-rule="evenodd"/>
        </svg>
        `;

    selectedAssets.forEach((asset, index) => {
        const assetDiv = document.createElement('div');
        assetDiv.className = 'flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0 sm:space-x-3 p-3 border-b border-gray-200';

        let statusIndicator = '';
        if (asset.status === 'fetching') {
            statusIndicator = `<span class="relative size-3">
  <span class="absolute inline-flex size-3 animate-ping rounded-full bg-sky-400 opacity-75"></span>
  <span class="absolute inline-flex size-3 rounded-full bg-sky-500"></span>
</span>`;
        } else if (asset.status === 'loaded') {
            statusIndicator = `<span class="relative size-3">
  <span class="absolute inline-flex size-3 rounded-full bg-emerald-500"></span>
</span>`;
        } else { // error or not yet loaded
             statusIndicator = `<span class="relative size-3">
  <span class="absolute inline-flex size-3 rounded-full bg-orange-500"></span>
</span>`;
        }

        assetDiv.innerHTML = `
            <span class="font-medium text-gray-800 flex-grow">${asset.name || asset.ticker} ${statusIndicator}</span>
            <div class="flex items-center space-x-1 sm:space-x-2 asset-bounds-input-container w-full sm:w-auto" data-asset-index="${index}">
                <div class="relative flex items-center">
                    <input type="number"
                           class="asset-min-weight-input w-16 text-center border rounded py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-blue-500 ${asset.locked ? 'bg-blue-50' : 'bg-gray-100'}"
                           placeholder="Min"
                           step="0.01"
                           value="${asset.minWeight !== null ? asset.minWeight.toFixed(2) : ''}"
                           ${asset.locked ? '' : 'disabled'}
                           aria-label="Minimum weight for ${asset.ticker}"
                    >
                    <span class="ml-1 text-gray-600">%</span>
                </div>
                <span class="text-gray-500">-</span>
                <div class="relative flex items-center">
                    <input type="number"
                           class="asset-max-weight-input w-16 text-center border rounded py-1 px-2 text-gray-700 leading-tight focus:outline-none focus:ring-1 focus:ring-blue-500 ${asset.locked ? 'bg-blue-50' : 'bg-gray-100'}"
                           placeholder="Max"
                           step="0.01"
                           value="${asset.maxWeight !== null ? asset.maxWeight.toFixed(2) : ''}"
                           ${asset.locked ? '' : 'disabled'}
                           aria-label="Maximum weight for ${asset.ticker}"
                    >
                    <span class="ml-1 text-gray-600">%</span>
                </div>
                 <button class="toggle-lock-btn text-blue-500 hover:text-blue-700 ml-2 text-sm font-medium focus:outline-none"
                         data-asset-index="${index}">
                     ${asset.locked ? lockedIcon : unlockedIcon}
                 </button>
            </div>
            <button class="remove-asset-btn text-red-500 hover:text-red-700 ml-2 focus:outline-none" data-ticker="${asset.ticker}">
                &times;
            </button>
        `;

        DOMElements.selectedAssetsList.appendChild(assetDiv);
    });

    document.querySelectorAll('.remove-asset-btn').forEach(button => {
        button.addEventListener('click', removeAssetCallback);
    });
    document.querySelectorAll('.toggle-lock-btn').forEach(button => {
        button.addEventListener('click', toggleLockCallback);
    });
    // Use a single callback for both min and max inputs
    document.querySelectorAll('.asset-min-weight-input, .asset-max-weight-input').forEach(input => {
        input.addEventListener('input', setWeightBoundsCallback);
        input.addEventListener('blur', setWeightBoundsCallback);
    });
}

export function updateRemainingWeight(selectedAssets, isLongOnly) {
    let sumMinBounds = 0;
    let sumMaxBounds = 0;
    var hasUnlockedAssets = false;

    selectedAssets.forEach(asset => {
        if (asset.locked) {
            const minWeight = asset.minWeight !== null ? asset.minWeight : (isLongOnly ? 0 : -Number.MAX_SAFE_INTEGER);
            const maxWeight = asset.maxWeight !== null ? asset.maxWeight : Number.MAX_SAFE_INTEGER;

            if (minWeight === -Number.MAX_SAFE_INTEGER) sumMinBounds = -Number.MAX_SAFE_INTEGER;
            else if (sumMinBounds !== -Number.MAX_SAFE_INTEGER) sumMinBounds += minWeight;
            
            if (maxWeight === Number.MAX_SAFE_INTEGER) maxWeight = Number.MAX_SAFE_INTEGER;
            else if (sumMaxBounds !== Number.MAX_SAFE_INTEGER) sumMaxBounds += maxWeight;
        } else hasUnlockedAssets = true;
    });

    DOMElements.remainingWeightInfo.classList.remove('text-green-700', 'text-red-600', 'text-gray-600');

    let message = 'Total minimum weights (locked): ';
    let messageClass = 'text-gray-600';

    if (sumMinBounds > 100) {
        message = `Sum of locked minimums (${sumMinBounds.toFixed(2)}%) exceeds 100%!`;
        messageClass = 'text-red-600';
        DOMElements.calculateGmvBtn.disabled = true; // Disable if bounds are invalid
    } else {
        message = `Total minimum locked: ${sumMinBounds.toFixed(2)}% | Total maximum locked: ${sumMaxBounds === Number.MAX_SAFE_INTEGER ? 'N/A' : sumMaxBounds.toFixed(2)}%`;
        if (sumMaxBounds < 0 && !isLongOnly) { // If max bounds sum is negative (and shorting allowed)
            message += ` | Max bounds sum is negative.`;
            messageClass = 'text-red-600';
            DOMElements.calculateGmvBtn.disabled = true;
        } else if (sumMaxBounds < 100 && !hasUnlockedAssets) {
            message += ` | Max bounds sum must sum to at least 100%`;
            messageClass = 'text-red-600';
            DOMElements.calculateGmvBtn.disabled = true;
        }
    }

    DOMElements.remainingWeightInfo.textContent = message;
    DOMElements.remainingWeightInfo.classList.add(messageClass);
}

export function updateCalculateButtonState(selectedAssets, isLongOnly) {
    let buttonEnabled = false;
    let buttonText = 'Calculate GMVP';

    const hasAssets = selectedAssets.length > 0;
    const hasValidBounds = selectedAssets.every(asset => {
        if (asset.locked) {
            // Check if min is less than or equal to max if both are set
            if (asset.minWeight !== null && asset.maxWeight !== null && asset.minWeight > asset.maxWeight) {
                buttonText = 'min bound cannot be less than max bound';
                return false;
            }
            // Check long-only constraint
            if (isLongOnly) {
                if (asset.minWeight !== null && asset.minWeight < 0) {
                    buttonText = 'bounds cannot be < 0 in long-only';
                    return false;
                } if (asset.maxWeight !== null && asset.maxWeight < 0) { 
                    buttonText = 'bounds cannot be < 0 in long-only';
                    return false;
                }
            }
        }
        return true;
    });

    // Sum of locked min/max
    let sumLockedMin = 0;
    let sumLockedMax = 0;
    let anyLocked = false;

    selectedAssets.forEach(asset => {
        if (asset.locked) {
            anyLocked = true;
            sumLockedMin += asset.minWeight !== null ? asset.minWeight : (isLongOnly ? 0 : -Number.MAX_SAFE_INTEGER);
            sumLockedMax += asset.maxWeight !== null ? asset.maxWeight : Number.MAX_SAFE_INTEGER;
        }
    });

    if (!hasAssets) {
        buttonText = 'Add assets to calculate';
    } else if (!hasValidBounds) {
        // do nothing
    } else {
        // If there are locked weights, check if they make a feasible region
        if (anyLocked) {
             if (sumLockedMin > 100) {
                 buttonText = 'Sum of min bounds > 100%';
             } else if (sumLockedMax < 100 && isLongOnly) { // If shorting allowed and max bounds are all negative
                buttonText = 'Sum of max bounds < 100%';
             } else if (sumLockedMax < 0 && !isLongOnly) { // If shorting allowed and max bounds are all negative
                 buttonText = 'Sum of max bounds < 0%';
             } else {
                 buttonEnabled = true;
             }
        } else { // No locked weights, always possible to optimize
            buttonEnabled = true;
        }
    }

    DOMElements.calculateGmvBtn.disabled = !buttonEnabled;
    DOMElements.calculateGmvBtn.textContent = buttonText;
}

export function updateMetrics(activePortfolio) {
    if (activePortfolio) {
        DOMElements.activeVolatilitySpan.textContent = `${(activePortfolio.volatility * 100).toFixed(2)}%`;
        DOMElements.activeReturnSpan.textContent = `${(activePortfolio.return * 100).toFixed(2)}%`;
        renderDetailedDataTable(activePortfolio);
        renderPortfolioWeightsLegend(activePortfolio);
    } else {
        DOMElements.activeVolatilitySpan.textContent = '--.--%';
        DOMElements.activeReturnSpan.textContent = '--.--%';
        DOMElements.detailedDataTableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-500">Calculate a portfolio to see details here.</td></tr>`;
        renderPortfolioWeightsLegend(null);
    }
}

export function renderDetailedDataTable(portfolio) {
    DOMElements.detailedDataTableBody.innerHTML = '';
    if (!portfolio || !portfolio.weights || Object.keys(portfolio.weights).length === 0) {
        DOMElements.detailedDataTableBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-gray-500">No detailed data available.</td></tr>`;
        return;
    }

    const sortedTickers = Object.keys(portfolio.weights).sort();

    sortedTickers.forEach(ticker => {
        const weight = portfolio.weights[ticker] * 100;
        const asset = portfolio.assets.find(a => a.ticker === ticker);
        const expectedReturn = (portfolio.expectedReturns[ticker] * 100) || 0;
        const stdDev = (portfolio.stdDevs[ticker] * 100) || 0;

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="py-2 px-4 text-gray-800 font-medium">${asset ? asset.name : ticker}</td>
            <td class="py-2 px-4 text-gray-700 ${weight < 0 ? 'text-red-600' : ''}">${weight.toFixed(2)}%</td>
            <td class="py-2 px-4 text-gray-700">${expectedReturn.toFixed(2)}%</td>
            <td class="py-2 px-4 text-gray-700">${stdDev.toFixed(2)}%</td>
        `;
        DOMElements.detailedDataTableBody.appendChild(row);
    });
}

function renderPortfolioWeightsLegend(activePortfolio) {
    DOMElements.weightsList.innerHTML = ''; // Clear previous entries

    if (!activePortfolio || !activePortfolio.weights || Object.keys(activePortfolio.weights).length === 0) {
        DOMElements.weightsList.innerHTML = '<li class="text-gray-600">No portfolio selected.</li>';
        return;
    }

    const sortedTickers = Object.keys(activePortfolio.weights).sort();

    sortedTickers.forEach(ticker => {
        const weight = activePortfolio.weights[ticker] * 100;
        const assetName = activePortfolio.assets.find(a => a.ticker === ticker)?.name || ticker;

        const listItem = document.createElement('li');
        listItem.className = 'flex items-center space-x-2 text-gray-800';
        listItem.innerHTML = `
            <span class="inline-block w-3 h-3 rounded-full" style="background-color: ${stringToColour(ticker)};"></span>
            <span class="font-medium">${assetName}:</span>
            <span class="${weight < 0 ? 'text-red-600' : 'text-gray-700'}">${weight.toFixed(2)}%</span>
        `;
        DOMElements.weightsList.appendChild(listItem);
    });
}

export function renderCovarianceMatrix(covarianceMatrix) {
    DOMElements.covarianceMatrixThead.innerHTML = '';
    DOMElements.covarianceMatrixTbody.innerHTML = '';

    if (!covarianceMatrix || !covarianceMatrix.data || covarianceMatrix.data.length === 0) {
        DOMElements.covarianceMatrixTbody.innerHTML = `<tr><td colspan="${covarianceMatrix?.labels?.length + 1 || 2}" class="py-4 text-center text-gray-500">Calculate a portfolio to see details here.</td></tr>`;
        return;
    }

    const labels = covarianceMatrix.labels;
    const matrixData = covarianceMatrix.data;

    let headerRowHtml = '<tr><th class="py-3 px-4 text-left font-semibold">Asset</th>';
    labels.forEach(label => {
        headerRowHtml += `<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600">${label}</th>`;
    });
    headerRowHtml += '</tr>';
    DOMElements.covarianceMatrixThead.innerHTML = headerRowHtml;

    let tbodyHtml = '';
    labels.forEach((rowLabel, rowIndex) => {
        tbodyHtml += `<tr><td class="py-2 px-4 text-gray-800 font-medium">${rowLabel}</td>`;
        matrixData[rowIndex].forEach(value => {
            tbodyHtml += `<td class="py-2 px-4 text-sm text-gray-700">${value.toFixed(6)}</td>`; 
        });
        tbodyHtml += '</tr>';
    });
    DOMElements.covarianceMatrixTbody.innerHTML = tbodyHtml;
}

export function renderCorrelationMatrix(correlationMatrix) {
    DOMElements.correlationMatrixThead.innerHTML = '';
    DOMElements.correlationMatrixTbody.innerHTML = '';

    if (!correlationMatrix || !correlationMatrix.data || correlationMatrix.data.length === 0) {
        DOMElements.correlationMatrixTbody.innerHTML = `<tr><td colspan="${correlationMatrix?.labels?.length + 1 || 2}" class="py-4 text-center text-gray-500">Calculate a portfolio to see details here.</td></tr>`;
        return;
    }

    const labels = correlationMatrix.labels;
    const matrixData = correlationMatrix.data;

    let headerRowHtml = '<tr><th class="py-3 px-4 text-left font-semibold">Asset</th>';
    labels.forEach(label => {
        headerRowHtml += `<th class="py-3 px-4 text-left text-sm font-semibold text-gray-600">${label}</th>`;
    });
    headerRowHtml += '</tr>';
    DOMElements.correlationMatrixThead.innerHTML = headerRowHtml;

    let tbodyHtml = '';
    labels.forEach((rowLabel, rowIndex) => {
        tbodyHtml += `<tr><td class="py-2 px-4 text-gray-800 font-medium">${rowLabel}</td>`;
        matrixData[rowIndex].forEach(value => {
            const colorClass = value > 0.7 ? 'text-blue-600' : (value < -0.7 ? 'text-red-600' : '');
            tbodyHtml += `<td class="py-2 px-4 text-sm text-gray-700 ${colorClass}">${value.toFixed(4)}</td>`;
        });
        tbodyHtml += '</tr>';
    });
    DOMElements.correlationMatrixTbody.innerHTML = tbodyHtml;
}