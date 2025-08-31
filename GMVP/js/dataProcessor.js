const { DateTime } = window.luxon;

function lastTradingPriceInPeriod(pricesByDate, periodStartDate, periodEndDate) {
    let currentCheckDate = DateTime.min(periodEndDate, DateTime.now().endOf('day'));

    // Start from end of period and go backwards to find the last trading day
    while (currentCheckDate >= periodStartDate) {
        const isoDate = currentCheckDate.toISODate();
        if (pricesByDate[isoDate] !== undefined) {
            return { date: isoDate, close: pricesByDate[isoDate] };
        }
        currentCheckDate = currentCheckDate.minus({ days: 1 });
    }
    return null; // No trading data found in period
}

export function preprocessData(assetsWithPrices, startDateStr, endDateStr, dataFrequency) {
    const rangeStartDate = DateTime.fromISO(startDateStr).startOf('day');
    const rangeEndDate = DateTime.fromISO(endDateStr).endOf('day');

    if (!rangeStartDate.isValid || !rangeEndDate.isValid || rangeStartDate > rangeEndDate) {
        console.error("Invalid start or end date provided for preprocessing.");
        return null;
    }

    const validAssets = assetsWithPrices.filter(asset => asset.historicalPrices && asset.historicalPrices.length > 1);
    if (validAssets.length === 0) {
        console.warn("No valid assets with sufficient historical data to preprocess.");
        return null;
    }

    const resampledPricesForAllAssets = {}; // {ticker: {resampledDate: price}}
    let allResampledDates = new Set(); // all unique resampled dates found across all assets

    validAssets.forEach(asset => {
        const ticker = asset.ticker;
        const pricesByDate = {}; // Map raw dates to prices for quick lookup
        // Filter raw historical prices to be within the user-selected overall range
        asset.historicalPrices.forEach(p => {
            const date = DateTime.fromISO(p.date);
            if (date >= rangeStartDate && date <= rangeEndDate) {
                pricesByDate[p.date] = p.close;
            }
        });

        resampledPricesForAllAssets[ticker] = {}; // Store resampled prices for this asset

        let currentPeriodStart = rangeStartDate;

        while (currentPeriodStart <= rangeEndDate) {
            let periodEnd = null;
            let relevantPrices = null; // { date: string, close: number } for this period

            if (dataFrequency === 'daily') {
                relevantPrices = lastTradingPriceInPeriod(pricesByDate, currentPeriodStart, currentPeriodStart);
                currentPeriodStart = currentPeriodStart.plus({ days: 1 });
            } else if (dataFrequency === 'weekly') {
                // Determine the week's boundaries based on the currentPeriodStart
                const weekStartForPeriod = currentPeriodStart.startOf('week');
                periodEnd = weekStartForPeriod.endOf('week');
                relevantPrices = lastTradingPriceInPeriod(pricesByDate, weekStartForPeriod, periodEnd);
                currentPeriodStart = weekStartForPeriod.plus({ weeks: 1 }); // Move to the start of the next calendar week
            } else if (dataFrequency === 'monthly') {
                // Determine the month's boundaries based on the currentPeriodStart
                const monthStartForPeriod = currentPeriodStart.startOf('month');
                periodEnd = monthStartForPeriod.endOf('month');
                relevantPrices = lastTradingPriceInPeriod(pricesByDate, monthStartForPeriod, periodEnd);
                currentPeriodStart = monthStartForPeriod.plus({ months: 1 }); // Move to the start of the next calendar month
            } else {
                // Fallback to daily if unknown frequency
                console.warn(`Unknown data frequency '${dataFrequency}'. Defaulting to daily.`);
                relevantPrices = lastTradingPriceInPeriod(pricesByDate, currentPeriodStart, currentPeriodStart);
                currentPeriodStart = currentPeriodStart.plus({ days: 1 });
            }

            // If a valid price was found for the period, add it to resampled data and track the date
            if (relevantPrices) {
                // Ensure the resampled date itself is not outside the user's requested range
                const resampledDateLuxon = DateTime.fromISO(relevantPrices.date);
                if (resampledDateLuxon >= rangeStartDate && resampledDateLuxon <= rangeEndDate) {
                    resampledPricesForAllAssets[ticker][relevantPrices.date] = relevantPrices.close;
                    allResampledDates.add(relevantPrices.date);
                }
            }
        }
    });

    // Find common dates across all assets based on resampled data
    let finalCommonDates = Array.from(allResampledDates).sort();
    let commonDatesAcrossAllAssets = [];

    for (const date of finalCommonDates) {
        let allAssetsHaveDate = true;
        for (const asset of validAssets) {
            if (resampledPricesForAllAssets[asset.ticker][date] === undefined) {
                allAssetsHaveDate = false;
                break;
            }
        }
        if (allAssetsHaveDate) {
            commonDatesAcrossAllAssets.push(date);
        }
    }

    if (commonDatesAcrossAllAssets.length < 2) {
        console.warn(`Not enough common historical data points for calculation with ${dataFrequency} frequency between ${startDateStr} and ${endDateStr}.`);
        return null;
    }

    // Calculate returns for common dates
    const assetReturns = {};
    const expectedReturns = {}; // Annualized
    const stdDevs = {}; // Annualized

    // Determine annualization factor based on frequency
    let annualizationFactor;
    switch (dataFrequency) {
        case 'daily': annualizationFactor = 252; break; // trading days in a year (cant be bothered with leap years)
        case 'weekly': annualizationFactor = 52; break; // weeks in a year
        case 'monthly': annualizationFactor = 12; break; // months in a year
        default: annualizationFactor = 252;
    }

    validAssets.forEach(asset => {
        const ticker = asset.ticker;
        const currentAssetReturns = [];
        const resampledPrices = resampledPricesForAllAssets[ticker];

        for (let i = 1; i < commonDatesAcrossAllAssets.length; i++) {
            const prevPrice = resampledPrices[commonDatesAcrossAllAssets[i - 1]];
            const currPrice = resampledPrices[commonDatesAcrossAllAssets[i]];

            if (prevPrice && currPrice && prevPrice !== 0) {
                currentAssetReturns.push((currPrice - prevPrice) / prevPrice);
            } else { // shouldn't get here
                currentAssetReturns.push(0);
            }
        }
        assetReturns[ticker] = currentAssetReturns;

        // Calculate expected return (mean) and standard deviation
        const sum = currentAssetReturns.reduce((a, b) => a + b, 0);
        const mean = sum / currentAssetReturns.length;
        expectedReturns[ticker] = mean * annualizationFactor;

        // Calculate sample variance
        const variance = currentAssetReturns.length > 1
            ? currentAssetReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (currentAssetReturns.length - 1)
            : 0; // lack of data points => no variance
        stdDevs[ticker] = Math.sqrt(variance) * Math.sqrt(annualizationFactor);
    });

    return {
        commonDates: commonDatesAcrossAllAssets,
        returns: assetReturns, // {ticker: [r1, r2, ...]}
        expectedReturns: expectedReturns, // {ticker: annualized_mean_return}
        stdDevs: stdDevs // {ticker: annualized_std_dev}
    };
}

export function calculateCovarianceMatrix(returns) {
    const tickers = Object.keys(returns);
    const n = tickers.length;
    const covMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

    if (n === 0) return [];

    const means = {};
    for (const ticker of tickers) {
        means[ticker] = returns[ticker].reduce((s, r) => s + r, 0) / returns[ticker].length;
    }

    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            const ticker1 = tickers[i];
            const ticker2 = tickers[j];
            const returns1 = returns[ticker1];
            const returns2 = returns[ticker2];

            let covariance = 0;
            // Assumes returns arrays are already aligned by common dates
            const numDataPoints = returns1.length;

            if (numDataPoints > 1) { // Need at least 2 data points for variance/covariance
                for (let k = 0; k < numDataPoints; k++) {
                    covariance += (returns1[k] - means[ticker1]) * (returns2[k] - means[ticker2]);
                }
                covariance /= (numDataPoints - 1); // Sample covariance
            } else {
                covariance = 0; // Not enough data points
            }

            covMatrix[i][j] = covariance;
            if (i !== j) {
                covMatrix[j][i] = covariance; // Symmetric matrix
            }
        }
    }
    return covMatrix;
}

// returns {object} {data: Array<Array<number>>, labels: string[]}
export function calculateCorrelationMatrix(covMatrix, stdDevs, tickers) {
    const n = tickers.length;
    const corrMatrix = Array(n).fill(0).map(() => Array(n).fill(0));

    if (n === 0) return { data: [], labels: [] };
    if (n === 1) return { data: [[1]], labels: [tickers[0]] }; // Single asset always correlates to itself at 1

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const stdDev1 = stdDevs[tickers[i]];
            const stdDev2 = stdDevs[tickers[j]];

            if (stdDev1 !== 0 && stdDev2 !== 0) {
                corrMatrix[i][j] = covMatrix[i][j] / (stdDev1 * stdDev2);
            } else {
                // If standard deviation is 0, assets don't move, correlation is undefined or 0.
                // Or if i === j, correlation is 1.
                corrMatrix[i][j] = (i === j) ? 1 : 0;
            }
            // Clamp values to -1 to 1 due to floating point inaccuracies
            corrMatrix[i][j] = Math.max(-1, Math.min(1, corrMatrix[i][j]));
        }
    }
    return { data: corrMatrix, labels: tickers };
}

export function calculateGMVPWeights(covarianceMatrix, selectedAssets, isLongOnly) {
    // numeric js solveQP(Dmat, dvec, Amat, bvec, meq=0, factorized=FALSE)
    // solves for b to minimise d'b + 0.5b'Db, where A'b >= b0 
    // Dmat matrix appearing in the quadratic function to be minimized
    // dvec vector appearing in the quadratic function to be minimized 
    // Amat matrix deﬁning the constraints under which we want to minimize the quadratic function.
    // bvec vector holding the values of b0 (defaults to zero).
    // meq the ﬁrst meq constraints are treated as equality constraints, all further as inequality constraints (defaults to 0).
    // factorized logical ﬂag: if TRUE, then we are passing R1 (where D = RT R) instead of the matrix D in the argument Dmat.

    // look at the term b'Db first. w(i) refers to weight of asset i
    // port variance = w(i)*w(j)*cov(i,j) for each asset i in portfolio for each asset j in portfolio
    // e.g. for 3 assets, var(p) = w(1)var(1) + w(2)var(2) + w(3)var(3) + 2w(1)w(2)cov(1,2) + 2w(1)w(3)cov(1,3) + 2w(2)w(3)cov(3)
    // notice that the row vector of weights multiplied with cov matrix = w'Cov, gives us 
    // a 1 x N row vector of [w(i)cov(i,j) for each asset i in portfolio] in col j 
    // e.g. (summation of w(i)cov(i,1), summation of w(i)cov(i,2), ..., summation of w(i)cov(i,N))
    // then the multiplication of w'Covw will give us the portfolio variance => cov mat maps to D, w to b (unknown to solve for)
    // thus, there is also no linear term, d'b = 0 => vector d' is a vector of 0s

    // contraint 1: sum of weights (b0) = 1
    // set meq to 1, first row of A' to 1 (first col of A), first element of b to 1
    // contraint 2: lower bounds => wi >= lbi
    // set b0 to lb, rows with 1 in the ith position in A'
    // contraint 3: lower bounds => wi <= ubi => -wi >= -ubi
    // set b0 to -ub, rows with -1 in the ith position in A'

    // b0 is vector of length 2N+1 where: (1-indexed)
    // element 1 = 1
    // elements 2 to N+1 = lb[1], lb[2], ..., lb[N]
    // elements N+2 to 2N+1 = -ub[1], -ub[2], ..., -ub[N]

    // A is N x (2N+1) mat where:
    // col 1 is all 1
    // col 2 to N+1 where row i is 1 and 0 elsewhere
    // col N+2 to 2 N+1 where row i is -1 and 0 elsewhere
    
    const minWeights = [];
    const maxWeights = [];
    for (let asset of selectedAssets) {
        if (isLongOnly) {
            minWeights.push(asset.locked ? asset.minWeight/100 : 0);
            maxWeights.push(asset.locked ? asset.maxWeight/100 : 1);
        } else {
            minWeights.push(asset.locked ? asset.minWeight/100 : -Number.MAX_SAFE_INTEGER);
            maxWeights.push(asset.locked ? asset.maxWeight/100 : Number.MAX_SAFE_INTEGER);
        }
    }

    const N = covarianceMatrix.length;

    const D = covarianceMatrix
    const d = Array(N).fill(0)

    let A = Array(N).fill(0).map(() => Array(2*N+1).fill(0));
    let b0 = Array(2*N+1).fill(0);
    
    for (let i = 0; i < N; i++) A[i][0] = 1; 
    b0[0] = 1;
    for (let i = 0; i < N; i++) {
        A[i][1 + i] = 1; // For w_i >= lb_i, the column for this constraint has a 1 at row i
        b0[1 + i] = minWeights[i];
    }
    for (let i = 0; i < N; i++) {
        A[i][1 + N + i] = -1; // For -w_i >= -ub_i, the column has a -1 at row i
        b0[1 + N + i] = -maxWeights[i];
    }

    try {
        const solution = numeric.solveQP(D, d, A, b0, 1);
        return solution;
    } catch (error) {
        console.error("Error during constrained GMVP calculation:", error);
        throw new Error("Could not calculate constrained GMVP weights. " +
                        "A feasible solution might not exist for the given constraints or the solver failed.");
    }
}

// Returns annualized portfolio return (annualized decimal)
export function calculatePortfolioReturn(weights, expectedReturns) {
    let portfolioReturn = 0;
    for (const ticker in weights) {
        portfolioReturn += weights[ticker] * (expectedReturns[ticker] || 0);
    }
    return portfolioReturn;
}

/**
 * Calculates portfolio volatility given weights and covariance matrix.
 * @param {object} weights - {ticker: weight}
 * @param {Array<Array<number>>} covarianceMatrix - 2D array
 * @param {string[]} tickers - ordered list of tickers corresponding to matrix indices
 * @returns {number} Portfolio volatility (standard deviation, decimal).
 */
export function calculatePortfolioVolatility(weights, covarianceMatrix, tickers) {
    const n = tickers.length;
    let portfolioVariance = 0;

    if (n === 0) return 0;
    if (n === 1) {
        // If single asset, volatility is its own std dev.
        // Assuming the covariance matrix is [ [ variance ] ] for a single asset.
        return Math.sqrt(covarianceMatrix[0][0]);
    }

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const tickerI = tickers[i];
            const tickerJ = tickers[j];
            const wI = weights[tickerI] || 0;
            const wJ = weights[tickerJ] || 0;

            // Ensure tickers map correctly to matrix indices
            const indexI = tickers.indexOf(tickerI);
            const indexJ = tickers.indexOf(tickerJ);

            if (indexI !== -1 && indexJ !== -1) {
                 portfolioVariance += wI * wJ * covarianceMatrix[indexI][indexJ];
            }
        }
    }
    // Ensure portfolioVariance is not negative due to floating point errors before sqrt
    return Math.sqrt(Math.max(0, portfolioVariance));
}

/**
 * Calculates the cumulative historical performance of a portfolio.
 * @param {object} weights - {ticker: decimal_weight}
 * @param {object} historicalReturns - {ticker: number[]} (returns for common dates, decimal)
 * @param {string[]} commonDates - The dates corresponding to the returns (YYYY-MM-DD)
 * @returns {Array<{date: string, value: number}>} Array of cumulative return objects.
 */
export function calculateHistoricalPortfolioPerformance(weights, historicalReturns, commonDates) {
    if (commonDates.length < 1 || Object.keys(weights).length === 0) return [];

    const cumulativePerformance = [];
    let currentValue = 1; // Start with an initial value of 1 (representing 100%)

    for (let i = 0; i < commonDates.length; i++) {
        const currentDate = commonDates[i];
        let dailyPortfolioReturn = 0;

        for (const ticker in weights) {
            const assetDailyReturn = historicalReturns[ticker] ? (historicalReturns[ticker][i] || 0) : 0;
            dailyPortfolioReturn += weights[ticker] * assetDailyReturn;
        }

        currentValue *= (1 + dailyPortfolioReturn);
        cumulativePerformance.push({
            date: currentDate,
            value: currentValue
        });
    }
    return cumulativePerformance;
}