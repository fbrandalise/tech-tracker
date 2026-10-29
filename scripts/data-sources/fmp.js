/**
 * Financial Modeling Prep Data Source
 * 专业金融数据 API (使用 /stable 端点；旧版 /api/v3 已于 2025-08-31 停止支持)
 * 文档: https://site.financialmodelingprep.com/developer/docs
 * 免费额度: 250 calls/day
 */

require('../load-env');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../.config/watchlist.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  config = { dataSource: { options: {} } };
}

const FMP_CONFIG = config.dataSource?.options?.financialModelingPrep || {};
const API_KEY = process.env.FMP_API_KEY || FMP_CONFIG.apiKey;
const BASE_URL = 'https://financialmodelingprep.com/stable';

function requireKey() {
  if (!API_KEY || API_KEY === 'YOUR_FMP_API_KEY_HERE') {
    throw new Error('FMP API Key 未配置，请在 .env 中设置 FMP_API_KEY');
  }
}

function formatMillions(value) {
  return value ? (value / 1000000).toFixed(1) + 'M' : 'N/A';
}

/**
 * 请求 FMP；API 错误（如 403 / Error Message）会抛出异常
 */
async function fmpGet(endpoint, params = {}) {
  const query = new URLSearchParams({ ...params, apikey: API_KEY });
  const response = await fetch(`${BASE_URL}/${endpoint}?${query}`);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }
  if (!response.ok || (data && !Array.isArray(data) && data['Error Message'])) {
    throw new Error(data?.['Error Message'] || `HTTP ${response.status}`);
  }
  return data;
}

/**
 * 获取财报日历
 * @param {object} range - { from, to } (YYYY-MM-DD)，默认今天起 7 天
 */
async function getEarningsCalendar(symbol = null, market = 'us', range = null) {
  requireKey();

  try {
    let data;
    if (symbol) {
      data = (await fmpGet('earnings', { symbol, limit: 5 }))
        .filter(item => !item.epsActual && item.epsActual !== 0);
    } else {
      const from = range?.from || new Date().toISOString().split('T')[0];
      const to = range?.to || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      data = await fmpGet('earnings-calendar', { from, to });
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data.map(item => ({
      symbol: item.symbol,
      name: item.name || item.symbol,
      date: item.date,
      time: item.time || 'after',
      expectedEPS: item.epsEstimated ?? 'N/A',
      expectedRevenue: formatMillions(item.revenueEstimated),
      currency: 'USD',
      isRealData: true,
      source: 'FMP'
    }));
  } catch (error) {
    console.error('FMP API 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司财报详情（最近一次已公布的财报）
 */
async function getCompanyEarnings(symbol, market = 'us') {
  requireKey();

  try {
    const earnings = await fmpGet('earnings', { symbol, limit: 5 });
    const latest = earnings.find(item => item.epsActual !== null && item.epsActual !== undefined);
    if (!latest) {
      return null;
    }

    const income = await fmpGet('income-statement', { symbol, limit: 1 }).catch(() => []);
    const statement = income[0] || {};

    return {
      symbol: latest.symbol,
      name: latest.symbol,
      quarter: latest.date,
      date: latest.date,
      expectedEPS: latest.epsEstimated ?? 'N/A',
      actualEPS: latest.epsActual ?? 'N/A',
      expectedRevenue: formatMillions(latest.revenueEstimated),
      actualRevenue: formatMillions(latest.revenueActual),
      yoyGrowth: 'N/A',
      highlights: [
        `EPS: ${latest.epsActual} (预期 ${latest.epsEstimated ?? 'N/A'})`,
        `Revenue: ${formatMillions(latest.revenueActual)} (预期 ${formatMillions(latest.revenueEstimated)})`,
        `Net Income (${statement.period || 'last'} ${statement.fiscalYear || ''}): ${formatMillions(statement.netIncome)}`
      ],
      guidance: '查看官方财报',
      afterHoursMove: 'N/A',
      currency: 'USD',
      isRealData: true,
      source: 'FMP'
    };
  } catch (error) {
    console.error('FMP API 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司信息
 */
async function getCompanyInfo(symbol, market = 'us') {
  requireKey();

  try {
    const profiles = await fmpGet('profile', { symbol });
    if (!profiles || profiles.length === 0) {
      return null;
    }
    const profile = profiles[0];

    // 下次财报日期：最近一条尚未公布实际值、且日期不早于今天的记录
    const today = new Date().toISOString().split('T')[0];
    const earnings = await fmpGet('earnings', { symbol, limit: 5 }).catch(() => []);
    const upcoming = earnings.filter(e => !e.epsActual && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const nextEarnings = upcoming[0] || null;

    return {
      symbol: profile.symbol,
      name: profile.companyName || profile.symbol,
      price: profile.price,
      sector: profile.sector,
      industry: profile.industry,
      market: 'us',
      marketName: profile.exchange,
      nextEarningsDate: nextEarnings ? nextEarnings.date : 'N/A',
      expectedEPS: nextEarnings?.epsEstimated ?? 'N/A',
      expectedRevenue: nextEarnings ? formatMillions(nextEarnings.revenueEstimated) : 'N/A',
      currency: profile.currency || 'USD',
      description: profile.description,
      website: profile.website,
      isRealData: true,
      source: 'FMP'
    };
  } catch (error) {
    console.error('FMP API 错误:', error.message);
    return null;
  }
}

module.exports = {
  getEarningsCalendar,
  getCompanyEarnings,
  getCompanyInfo
};
