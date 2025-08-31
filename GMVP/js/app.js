import { fetchAlphaVantageDailyData, parseAlphaVantageData } from './api.js';
import {
    preprocessData,
    calculateCovarianceMatrix,
    calculateCorrelationMatrix,
    calculateGMVPWeights,
    calculatePortfolioReturn,
    calculatePortfolioVolatility,
    calculateHistoricalPortfolioPerformance
} from './dataProcessor.js';
import { 
    DOMElements,
    getApiKey,
    initializeDateInputs, 
    getSelectedDateRange, 
    renderSelectedAssets, 
    updateRemainingWeight, 
    updateCalculateButtonState, 
    updateMetrics, 
    renderCovarianceMatrix,
    renderCorrelationMatrix 
} from './ui.js';
import { initCharts, updateCharts } from './chartHandler.js';
const { DateTime } = window.luxon;

// globals
const assetDataCache = new Map();
let selectedAssets = []; // [{ ticker: 'AAPL', name: 'Apple Inc.', minWeight: null, maxWeight: null, historicalPrices: [] }, ...]
let calculatedPortfolios = []; // [{ id: 'port-XYZ', assets: [{ticker, name, minWeight, maxWeight}], weights: {ticker: weight}, volatility: X, return: Y, historicalSeries: [{date, value}], correlationMatrix: {data, labels}, params: {...}, expectedReturns: {...}, stdDevs: {...} }, ...]
let activePortfolioId = null; // ID of the currently displayed portfolio from calculatedPortfolios

async function handleAddAsset() {
    const ticker = DOMElements.tickerInput.value.trim().toUpperCase();
    if (!ticker) {
        alert('Please enter a stock ticker symbol.');
        return;
    }

    if (selectedAssets.some(asset => asset.ticker === ticker)) {
        alert(`Asset ${ticker} is already added.`);
        DOMElements.tickerInput.value = '';
        return;
    }

    const newAsset = {
        ticker: ticker,
        name: ticker,
        minWeight: null, 
        maxWeight: null, 
        historicalPrices: null,
        locked: false,
        status: 'fetching'
    };
    selectedAssets.push(newAsset);
    renderSelectedAssets(selectedAssets, DOMElements.longOnlyCheckbox.checked, handleRemoveAsset, handleToggleLock, handleSetWeightBounds);
    DOMElements.tickerInput.value = '';

    updateRemainingWeight(selectedAssets, DOMElements.longOnlyCheckbox.checked);
    updateCalculateButtonState(selectedAssets, DOMElements.longOnlyCheckbox.checked);

    try {
        if (!assetDataCache.has(ticker)) {
            const apiKey = getApiKey();
            const rawData = await fetchAlphaVantageDailyData(ticker, apiKey);
            const assetData = {
                ticker: ticker,
                name: rawData['Meta Data']['2. Symbol'] || ticker,
                historicalPrices: parseAlphaVantageData(rawData['Time Series (Daily)'])
            };
            assetDataCache.set(ticker, assetData);
        }
        const cachedAsset = assetDataCache.get(ticker);
        newAsset.historicalPrices = cachedAsset.historicalPrices;
        newAsset.name = cachedAsset.name;
        newAsset.status = 'loaded';
    } catch (error) {
        console.error(`Failed to fetch or parse data for ${ticker}:`, error);
        alert(`Failed to fetch data for ${ticker}: ${error.message}. Please check ticker or API key/limits.`);
        selectedAssets = selectedAssets.filter(asset => asset.ticker !== ticker); // Remove on failure
    } finally {
        updateAppUI();
    }
}

function handleRemoveAsset(event) {
    const tickerToRemove = event.target.dataset.ticker;
    selectedAssets = selectedAssets.filter(asset => asset.ticker !== tickerToRemove);
    updateAppUI();
}

function handleToggleLock(event) {
    const index = parseInt(event.currentTarget.dataset.assetIndex);
    if (!isNaN(index) && selectedAssets[index]) {
        selectedAssets[index].locked = !selectedAssets[index].locked;
        if (selectedAssets[index].locked) {
            if (selectedAssets[index].minWeight === null) {
                selectedAssets[index].minWeight = DOMElements.longOnlyCheckbox.checked ? 0 : -100;
            }
            if (selectedAssets[index].maxWeight === null) {
                selectedAssets[index].maxWeight = 100; 
            }
            // Ensure min <= max
            if (selectedAssets[index].minWeight > selectedAssets[index].maxWeight) {
                selectedAssets[index].maxWeight = selectedAssets[index].minWeight; 
            }
        }
        updateAppUI();
    }
}

function handleSetWeightBounds(event) {
    const inputElement = event.currentTarget;
    const index = parseInt(inputElement.closest('.asset-bounds-input-container').dataset.assetIndex);
    if (!isNaN(index) && selectedAssets[index]) {
        let value = parseFloat(inputElement.value);

        // Convert percentage to decimal for internal logic
        if (isNaN(value)) {
            value = null; // Use null if input is empty or invalid
        }

        if (inputElement.classList.contains('asset-min-weight-input')) {
            selectedAssets[index].minWeight = value;
        } else if (inputElement.classList.contains('asset-max-weight-input')) {
            selectedAssets[index].maxWeight = value;
        }
        updateRemainingWeight(selectedAssets, DOMElements.longOnlyCheckbox.checked);
        updateCalculateButtonState(selectedAssets, DOMElements.longOnlyCheckbox.checked);
    }
}

function updateAppUI() {
    const isLongOnly = DOMElements.longOnlyCheckbox.checked;
    renderSelectedAssets(selectedAssets, isLongOnly, handleRemoveAsset, handleToggleLock, handleSetWeightBounds);
    updateRemainingWeight(selectedAssets, isLongOnly);
    updateCalculateButtonState(selectedAssets, isLongOnly);
}

async function handleCalculateGMVPortfolio() {
    const isLongOnly = DOMElements.longOnlyCheckbox.checked;
    const { startDate, endDate } = getSelectedDateRange(); 
    const dataFrequency = DOMElements.dataFrequencySelect.value;

    DOMElements.calculateGmvBtn.textContent = 'Calculating...';
    DOMElements.calculateGmvBtn.disabled = true;

    // trivial date validation
    if (!startDate || !endDate || DateTime.fromISO(startDate) > DateTime.fromISO(endDate)) {
        alert('Please select a valid start and end date range.');
        updateCalculateButtonState(selectedAssets, isLongOnly);
        return;
    }

    // check if all assets have data
    const assetsWithoutData = selectedAssets.filter(asset => asset.status !== 'loaded');
    if (assetsWithoutData.length > 0) {
        alert(`Please wait for data to load for: ${assetsWithoutData.map(a => a.ticker).join(', ')}`);
        DOMElements.calculateGmvBtn.textContent = 'Calculate GMVP';
        updateCalculateButtonState(selectedAssets, isLongOnly);
        return;
    }

    // Single asset portfolio
    if (selectedAssets.length === 1) {
        const singleAsset = selectedAssets[0];
        const processedData = preprocessData([singleAsset], startDate, endDate, dataFrequency);

        if (!processedData) {
            alert("Could not process historical data for single asset. Please try again or adjust range.");
            updateCalculateButtonState(selectedAssets, isLongOnly);
            return;
        }
        const { commonDates, returns, expectedReturns, stdDevs } = processedData;

        const weights = { [singleAsset.ticker]: 1 }; // 100% to this asset
        const portfolioReturn = calculatePortfolioReturn(weights, expectedReturns);
        const portfolioVolatility = calculatePortfolioVolatility(weights, calculateCovarianceMatrix(returns), [singleAsset.ticker]);
        const historicalPortfolioPerformance = calculateHistoricalPortfolioPerformance(weights, returns, commonDates);
        
        const newPortfolioId = `port-${Date.now()}`;
        calculatedPortfolios.push({
            id: newPortfolioId,
            assets: [{ ticker: singleAsset.ticker, name: singleAsset.name }],
            weights: weights,
            volatility: portfolioVolatility,
            return: portfolioReturn,
            historicalSeries: historicalPortfolioPerformance,
            covarianceMatrix: { data: [[stdDevs[singleAsset.ticker]**2]], labels: [singleAsset.ticker] },
            correlationMatrix: { data: [[1]], labels: [singleAsset.ticker] },
            params: { startDate, endDate, dataFrequency, longOnly: true },
            expectedReturns: expectedReturns,
            stdDevs: stdDevs
        });
        activePortfolioId = newPortfolioId;
        updateCharts(calculatedPortfolios, activePortfolioId, handleHistoricalChartSelect);
        updateMetrics(calculatedPortfolios.find(p => p.id === activePortfolioId));
        renderCorrelationMatrix(calculatedPortfolios.find(p => p.id === activePortfolioId)?.correlationMatrix || null);
        renderCovarianceMatrix(calculatedPortfolios.find(p => p.id === activePortfolioId)?.covarianceMatrix || null);
        updateCalculateButtonState(selectedAssets, isLongOnly);
        return;
    }

    // 2+ assets with unfixed weights
    const processedData = preprocessData(selectedAssets, startDate, endDate, dataFrequency);
    if (!processedData) {
        alert("Not enough common historical data to perform GMV calculation. Please adjust inputs.");
        updateCalculateButtonState(selectedAssets, isLongOnly);
        return;
    }

    const { commonDates, returns, expectedReturns, stdDevs } = processedData;
    const allTickers = selectedAssets.map(a => a.ticker); // Order matters for matrix ops

    const covarianceMatrix = calculateCovarianceMatrix(returns);
    const correlationMatrix = calculateCorrelationMatrix(covarianceMatrix, stdDevs, allTickers);

    const qpSolver = calculateGMVPWeights(covarianceMatrix, selectedAssets, isLongOnly);
    if (qpSolver.message) {
        alert("GMV optimization failed or yielded invalid results. Please check inputs or try different assets.");
        updateCalculateButtonState(selectedAssets, isLongOnly);
        return;
    }
    const optimizedWeights = {};
    for (const [i, ticker] of allTickers.entries()) {
        optimizedWeights[ticker] = qpSolver.solution[i];
    }

    const portfolioReturn = calculatePortfolioReturn(optimizedWeights, expectedReturns);
    const portfolioVolatility = calculatePortfolioVolatility(optimizedWeights, covarianceMatrix, allTickers);
    const historicalPortfolioPerformance = calculateHistoricalPortfolioPerformance(optimizedWeights, returns, commonDates);

    const newPortfolioId = `port-${Date.now()}`;
    calculatedPortfolios.push({
        id: newPortfolioId,
        assets: selectedAssets.map(a => ({ ticker: a.ticker, name: a.name, fixedWeight: a.fixedWeight })),
        weights: optimizedWeights,
        volatility: portfolioVolatility,
        return: portfolioReturn,
        historicalSeries: historicalPortfolioPerformance,
        covarianceMatrix: {data: covarianceMatrix, labels: allTickers},
        correlationMatrix: correlationMatrix,
        params: { startDate, endDate, dataFrequency, longOnly: isLongOnly },
        expectedReturns: expectedReturns,
        stdDevs: stdDevs
    });
    activePortfolioId = newPortfolioId;
    updateCharts(calculatedPortfolios, activePortfolioId, handleHistoricalChartSelect);
    updateMetrics(calculatedPortfolios.find(p => p.id === activePortfolioId));
    renderCorrelationMatrix(calculatedPortfolios.find(p => p.id === activePortfolioId)?.correlationMatrix || null);
    renderCovarianceMatrix(calculatedPortfolios.find(p => p.id === activePortfolioId)?.covarianceMatrix || null);
    updateCalculateButtonState(selectedAssets, isLongOnly);
}

// Updates the active portfolio and re-renders UI when chart line clicked
function handleHistoricalChartSelect(portfolioId) {
    activePortfolioId = portfolioId;
    updateCharts(calculatedPortfolios, activePortfolioId, handleHistoricalChartSelect);
    updateMetrics(calculatedPortfolios.find(p => p.id === activePortfolioId));
    renderCorrelationMatrix(calculatedPortfolios.find(p => p.id === activePortfolioId)?.correlationMatrix || null);
    renderCovarianceMatrix(calculatedPortfolios.find(p => p.id === activePortfolioId)?.covarianceMatrix || null);
}

function handleParameterChange() {
    updateCalculateButtonState(selectedAssets, DOMElements.longOnlyCheckbox.checked);
}

// initial set up
document.addEventListener('DOMContentLoaded', () => {
    initializeDateInputs();
    updateCalculateButtonState(selectedAssets, DOMElements.longOnlyCheckbox.checked); // Initial button state
    renderSelectedAssets(selectedAssets, DOMElements.longOnlyCheckbox.checked, handleRemoveAsset, handleToggleLock, handleSetWeightBounds);

    // Initialize charts (no data yet)
    initCharts(DOMElements.historicalChartCanvas, DOMElements.portfolioWeightsChartCanvas);
    updateCharts(calculatedPortfolios, activePortfolioId, handleHistoricalChartSelect); // Pass initial empty state
    renderCovarianceMatrix(null);
    renderCorrelationMatrix(null);

    // Attach main event listeners
    DOMElements.addAssetBtn.addEventListener('click', handleAddAsset);
    DOMElements.tickerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAddAsset();
        }
    });
    DOMElements.longOnlyCheckbox.addEventListener('change', updateAppUI);
    DOMElements.startDateInput.addEventListener('change', handleParameterChange);
    DOMElements.endDateInput.addEventListener('change', handleParameterChange);
    DOMElements.dataFrequencySelect.addEventListener('change', handleParameterChange);
    DOMElements.calculateGmvBtn.addEventListener('click', handleCalculateGMVPortfolio);
});