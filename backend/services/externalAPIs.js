const axios = require('axios');


async function getWeather(city) {
  try {
    const cleanCity = city.replace(/tomorrow|today|email|it/gi, '').trim();

    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const response = await axios.get(url, {
      params: {
        q: cleanCity,
        appid: process.env.WEATHER_API_KEY,
        units: 'metric'
      }
    });

    return {
      city: response.data.name,
      temp: response.data.main.temp,
      condition: response.data.weather[0].description,
      humidity: response.data.main.humidity
    };
  } catch (err) {
    throw new Error(`Weather API error: ${err.response?.data?.message || err.message}`);
  }
}



async function getNews(category = "technology") {
  try {
    const url = `https://gnews.io/api/v4/top-headlines`;

    const response = await axios.get(url, {
      params: {
        category,
        lang: "en",
        country: "in",
        max: 5,
        apikey: process.env.GNEWS_API_KEY
      }
    });

    if (!response.data.articles || response.data.articles.length === 0) {
      return [];
    }

    return response.data.articles.map(a => ({
      title: a.title,
      source: a.source.name,
      url: a.url
    }));

  } catch (err) {
    throw new Error("News API error: " + (err.response?.data?.errors || err.message));
  }
}



async function getMarketData(symbol = "bitcoin") {
  try {
    const coin = symbol.toLowerCase();
    const forbidden = ["nifty", "sensex", "nifty 50", "nifty50", "aapl", "tsla"];

    if (forbidden.includes(coin)) {
      throw new Error(
        `Market API error: coin id "${symbol}" not found on CoinGecko. 
If this is a stock/index (NIFTY, SENSEX, AAPL), CoinGecko does not support stocks.`
      );
    }

    const url = `https://api.coingecko.com/api/v3/simple/price`;
    const response = await axios.get(url, {
      params: {
        ids: coin,
        vs_currencies: 'usd,inr',
        include_24hr_change: true
      }
    });

    if (!response.data[coin]) {
      throw new Error(`Market API error: No data found for ${symbol}`);
    }

    const data = response.data[coin];

    return {
      usd: data.usd,
      inr: data.inr,
      usd_24h_change: data.usd_24h_change?.toFixed(2) || "N/A"
    };

  } catch (err) {
    throw new Error("Market API error: " + err.message);
  }
}


module.exports = {
  getWeather,
  getNews,
  getMarketData
};
