/**
 * Alpha Vantage Data Source
 * 股票和财报数据 API
 * 文档: https://www.alphavantage.co/documentation/
 * 免费额度: 5 calls/minute, 500/day
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../.config/watchlist.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  config = { dataSource: { options: {} } };
}

const AV_CONFIG = config.dataSource?.options?.alphaVantage || {};
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY || AV_CONFIG.apiKey;
const BASE_URL = AV_CONFIG.baseUrl || 'https://www.alphavantage.co/query';

// 免费版限制约 1 次/秒，连续请求会返回限流提示，这里统一节流
let lastRequestAt = 0;
async function throttledFetch(url) {
  const wait = lastRequestAt + 1200 - Date.now();
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
  const response = await fetch(url);

  // 其他进程刚好也请求过时会触发限流提示，等待后重试一次
  const body = await response.clone().text();
  if (body.includes('1 request per second')) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    lastRequestAt = Date.now();
    return fetch(url);
  }
  return response;
}

/**
 * 获取财报日历
 */
async function getEarningsCalendar(symbol = null, market = 'us') {
  if (!API_KEY || API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY_HERE') {
    throw new Error('Alpha Vantage API Key 未配置，请在 .config/watchlist.json 中设置');
  }
  
  // Alpha Vantage 不直接提供财报日历 API
  // 可以通过 EARNINGS 函数获取历史财报
  console.log('⚠️ Alpha Vantage 不直接支持财报日历，建议使用其他数据源');
  return null;
}

/**
 * 获取公司财报详情
 */
async function getCompanyEarnings(symbol, market = 'us') {
  if (!API_KEY || API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY_HERE') {
    throw new Error('Alpha Vantage API Key 未配置');
  }
  
  try {
    // 获取收益数据
    const url = `${BASE_URL}?function=EARNINGS&symbol=${symbol}&apikey=${API_KEY}`;
    const response = await throttledFetch(url);
    const data = await response.json();
    
    if (!data || !data.quarterlyEarnings || data.quarterlyEarnings.length === 0) {
      return null;
    }
    
    const latest = data.quarterlyEarnings[0];
    
    return {
      symbol: latest.symbol || symbol,
      name: latest.symbol || symbol,
      quarter: latest.fiscalDateEnding,
      date: latest.fiscalDateEnding,
      expectedEPS: latest.estimatedEPS || 'N/A',
      actualEPS: latest.reportedEPS || 'N/A',
      expectedRevenue: 'N/A', // Alpha Vantage 不直接提供营收预期
      actualRevenue: 'N/A',
      yoyGrowth: 'N/A',
      highlights: [
        `Reported EPS: ${latest.reportedEPS || 'N/A'}`,
        `Estimated EPS: ${latest.estimatedEPS || 'N/A'}`,
        `Surprise: ${latest.surprise || 'N/A'}`,
        `Surprise %: ${latest.surprisePercentage || 'N/A'}%`
      ],
      guidance: '查看官方财报',
      afterHoursMove: 'N/A',
      currency: 'USD',
      isRealData: true,
      source: 'Alpha Vantage'
    };
  } catch (error) {
    console.error('Alpha Vantage API 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司信息
 */
async function getCompanyInfo(symbol, market = 'us') {
  if (!API_KEY || API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY_HERE') {
    throw new Error('Alpha Vantage API Key 未配置');
  }
  
  try {
    // 获取公司概况
    const url = `${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`;
    const response = await throttledFetch(url);
    const data = await response.json();
    
    if (!data || !data.Symbol) {
      return null;
    }
    
    return {
      symbol: data.Symbol,
      name: data.Name || data.Symbol,
      sector: data.Sector,
      industry: data.Industry,
      market: market,
      marketName: data.Exchange,
      description: data.Description,
      currency: data.Currency || 'USD',
      isRealData: true,
      source: 'Alpha Vantage'
    };
  } catch (error) {
    console.error('Alpha Vantage API 错误:', error.message);
    return null;
  }
}

module.exports = {
  getEarningsCalendar,
  getCompanyEarnings,
  getCompanyInfo
};
