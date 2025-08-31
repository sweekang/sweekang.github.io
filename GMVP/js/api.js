// ibm, tsco.lon, shop.trt, reliance.bse, 000002.SHZ

export async function fetchAlphaVantageDailyData(ticker, apiKey) {

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${apiKey}`;
    console.log(`Fetching data from: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();

        if (data["Error Message"]) {
            throw new Error(`Alpha Vantage API Error: ${data["Error Message"]}`);
        }
        if (!data["Time Series (Daily)"]) {
            throw new Error(`No daily time series data found for ${ticker}. Response: ${JSON.stringify(data)}`);
        }

        return data;

    } catch (error) {
        console.error(`Error fetching data for ${ticker}:`, error);
        throw error;
    }
}

/**
 * Parses Alpha Vantage data
 * Alpha Vantage format: { "YYYY-MM-DD": { "1. open": "...", "4. close": "..." }, ... }
 * Desired format: [{ date: 'YYYY-MM-DD', close: number }, ...]
 * Also sort data to oldest first.
 */
export function parseAlphaVantageData(timeSeriesData) {
    const parsedData = [];
    for (const date in timeSeriesData) {
        if (timeSeriesData.hasOwnProperty(date)) {
            const dayData = timeSeriesData[date];
            parsedData.push({
                date: date,
                close: parseFloat(dayData['4. close']) 
            });
        }
    }
    
    parsedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    return parsedData;
}