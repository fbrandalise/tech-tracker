/**
 * Polygon.io Data Source
 * 实时市场数据 API
 * 文档: https://polygon.io/docs/stocks
 * 免费额度: 5 calls/minute
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

const POLYGON_CONFIG = config.dataSource?.options?.polygon || {};
const API_KEY = process.env.POLYGON_API_KEY || POLYGON_CONFIG.apiKey;
const BASE_URL = POLYGON_CONFIG.baseUrl || 'https://api.polygon.io/v2';

/**
 * 获取财报日历
 */
async function getEarningsCalendar(symbol = null, market = 'us') {
  if (!API_KEY || API_KEY === 'YOUR_POLYGON_API_KEY_HERE') {
    throw new Error('Polygon API Key 未配置，请在 .config/watchlist.json 中设置');
  }
  
  console.log('⚠️ Polygon.io 的免费版不支持财报日历，建议使用 Financial Modeling Prep');
  return null;
}

/**
 * 获取公司财报详情
 */
async function getCompanyEarnings(symbol, market = 'us') {
  if (!API_KEY || API_KEY === 'YOUR_POLYGON_API_KEY_HERE') {
    throw new Error('Polygon API Key 未配置');
  }
  
  console.log('⚠️ Polygon.io 的免费版不支持详细财报数据，建议使用 Financial Modeling Prep');
  return null;
}

/**
 * 获取公司信息
 */
async function getCompanyInfo(symbol, market = 'us') {
  if (!API_KEY || API_KEY === 'YOUR_POLYGON_API_KEY_HERE') {
    throw new Error('Polygon API Key 未配置');
  }
  
  try {
    // 获取股票详情
    const url = `${BASE_URL.replace(/\/v2$/, "/v3")}/reference/tickers/${symbol}?apiKey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data || !data.results) {
      return null;
    }
    
    const result = data.results;
    
    return {
      symbol: result.ticker,
      name: result.name || result.ticker,
      sector: result.sic_description || 'N/A',
      industry: result.industry || 'N/A',
      market: market,
      marketName: result.primary_exchange || 'N/A',
      description: result.description,
      website: result.homepage_url,
      currency: result.currency_name || 'USD',
      isRealData: true,
      source: 'Polygon.io'
    };
  } catch (error) {
    console.error('Polygon API 错误:', error.message);
    return null;
  }
}

module.exports = {
  getEarningsCalendar,
  getCompanyEarnings,
  getCompanyInfo
};
