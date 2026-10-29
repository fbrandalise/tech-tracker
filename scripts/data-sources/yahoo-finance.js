/**
 * Yahoo Finance Data Source
 * 使用 yahoo-finance2 库获取免费数据
 * 安装: npm install yahoo-finance2
 * 文档: https://github.com/gadicc/node-yahoo-finance2
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../.config/watchlist.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  config = { markets: {} };
}

let yahooFinance;
try {
  const YahooFinance = require('yahoo-finance2').default;
  yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
} catch (e) {
  console.warn('yahoo-finance2 未安装或初始化失败，请运行: npm install yahoo-finance2');
}


/**
 * 转换为 Yahoo Finance 代码格式
 * A股: 600519 -> 600519.SS / 000858 -> 000858.SZ；港股: 00700.HK -> 0700.HK
 */
function toYahooSymbol(symbol, market = 'us') {
  const code = String(symbol).trim().toUpperCase();
  if (/\.(SS|SZ|HK)$/.test(code) && !code.endsWith('.HK')) return code;
  if (market === 'hk' || code.endsWith('.HK')) {
    const digits = code.replace(/\.HK$/, '').replace(/^0+(?=\d{4,})/, '');
    return `${digits.padStart(4, '0')}.HK`;
  }
  if (market === 'cn' || /^\d{6}$/.test(code)) {
    return `${code}.${code.startsWith('6') || code.startsWith('9') ? 'SS' : 'SZ'}`;
  }
  return code;
}

/**
 * 取下次财报日期（YYYY-MM-DD）。quote 的字段是 earningsTimestamp（旧代码读 earningsDate，始终为空）
 */
function getEarningsDate(quote) {
  const raw = quote.earningsTimestamp || quote.earningsTimestampStart || quote.earningsDate;
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date) ? null : date.toISOString().split('T')[0];
}

async function getQuote(symbol, market) {
  const quote = await yahooFinance.quote(toYahooSymbol(symbol, market));
  if (!quote) {
    throw new Error(`Yahoo Finance 未找到 ${symbol}（${toYahooSymbol(symbol, market)}）`);
  }
  return quote;
}

/**
 * 获取财报日历
 */
async function getEarningsCalendar(symbol = null, market = 'us') {
  if (!yahooFinance) {
    throw new Error('yahoo-finance2 未安装。运行: npm install yahoo-finance2');
  }
  
  try {
    if (symbol) {
      // 获取特定公司的财报日期
      const quote = await getQuote(symbol, market);
      const earningsDate = getEarningsDate(quote);
      if (!earningsDate) return null;

      return [{
        symbol: quote.symbol,
        name: quote.longName || quote.shortName || quote.symbol,
        date: earningsDate,
        time: 'after',
        expectedEPS: quote.epsForward || 'N/A',
        expectedRevenue: 'N/A', // Yahoo Finance 不直接提供预期营收
        currency: quote.currency || 'USD',
        isRealData: true,
        source: 'Yahoo Finance'
      }];
    } else {
      // Yahoo Finance 不提供批量财报日历，需要逐个查询
      // 返回关注列表中的前5个
      const usCompanies = config.markets[market]?.companies.slice(0, 5) || [];
      const results = [];
      
      for (const company of usCompanies) {
        try {
          const quote = await getQuote(company.symbol, market);
          const earningsDate = getEarningsDate(quote);
          if (earningsDate) {
            results.push({
              symbol: quote.symbol,
              name: quote.longName || quote.shortName || quote.symbol,
              date: earningsDate,
              time: 'after',
              expectedEPS: quote.epsForward || 'N/A',
              expectedRevenue: 'N/A',
              currency: quote.currency || 'USD',
              isRealData: true,
              source: 'Yahoo Finance'
            });
          }
        } catch (e) {
          // 忽略单个查询错误
        }
      }
      
      return results;
    }
  } catch (error) {
    console.error('Yahoo Finance 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司财报详情
 */
async function getCompanyEarnings(symbol, market = 'us') {
  if (!yahooFinance) {
    throw new Error('yahoo-finance2 未安装');
  }
  
  try {
    // 获取 quote 和基本面数据
    const quote = await getQuote(symbol, market);
    
    // 尝试获取财务报表
    let financials = null;
    try {
      financials = await yahooFinance.fundamentalsTimeSeries(symbol, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0]
      });
    } catch (e) {
      // 财务报表可能不可用
    }
    
    return {
      symbol: quote.symbol,
      name: quote.longName || quote.shortName || quote.symbol,
      quarter: 'N/A',
      date: getEarningsDate(quote) || 'N/A',
      expectedEPS: quote.epsForward || quote.epsCurrentYear || 'N/A',
      actualEPS: quote.epsTrailingTwelveMonths || 'N/A',
      expectedRevenue: 'N/A',
      actualRevenue: 'N/A',
      yoyGrowth: quote.earningsGrowth ? (quote.earningsGrowth * 100).toFixed(1) + '%' : 'N/A',
      highlights: [
        `Trailing EPS: ${quote.epsTrailingTwelveMonths || 'N/A'}`,
        `Forward EPS: ${quote.epsForward || 'N/A'}`,
        `PE Ratio: ${quote.trailingPE || quote.forwardPE || 'N/A'}`,
        `Market Cap: ${quote.marketCap ? (quote.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A'}`
      ],
      guidance: `Earnings Growth: ${quote.earningsGrowth ? (quote.earningsGrowth * 100).toFixed(1) + '%' : 'N/A'}`,
      afterHoursMove: `${quote.regularMarketChangePercent ? (quote.regularMarketChangePercent).toFixed(2) : 0}%`,
      currency: quote.currency || 'USD',
      isRealData: true,
      source: 'Yahoo Finance'
    };
  } catch (error) {
    console.error('Yahoo Finance 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司信息
 */
async function getCompanyInfo(symbol, market = 'us') {
  if (!yahooFinance) {
    throw new Error('yahoo-finance2 未安装');
  }
  
  try {
    const quote = await getQuote(symbol, market);
    
    return {
      symbol: quote.symbol,
      name: quote.longName || quote.shortName || quote.symbol,
      price: quote.regularMarketPrice,
      sector: quote.sector,
      industry: quote.industry,
      market: market,
      marketName: quote.exchange,
      nextEarningsDate: getEarningsDate(quote) || 'N/A',
      expectedEPS: quote.epsForward || 'N/A',
      expectedRevenue: 'N/A',
      currency: quote.currency || 'USD',
      description: quote.longBusinessSummary,
      website: quote.website,
      marketCap: quote.marketCap ? (quote.marketCap / 1000000000).toFixed(2) + 'B' : 'N/A',
      isRealData: true,
      source: 'Yahoo Finance'
    };
  } catch (error) {
    console.error('Yahoo Finance 错误:', error.message);
    return null;
  }
}

module.exports = {
  getEarningsCalendar,
  getCompanyEarnings,
  getCompanyInfo
};
