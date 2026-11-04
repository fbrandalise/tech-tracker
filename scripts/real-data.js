/**
 * Real Data API Module for Earnings Tracker
 * 接入真实财报数据源
 */

const { execFileSync } = require('child_process');   // sem shell: o texto da busca nunca é interpretado como comando
const fs = require('fs');
const path = require('path');
const {
  getActiveDataSource,
  getEarningsCalendar: providerCalendar,
  getCompanyInfo: providerInfo,
  getCompanyEarnings: providerEarnings
} = require('./data-source-factory');

// 支持真实财报数据的数据源（Sina 只有行情，Mock/WebSearch 不是真实 API）
const LIVE_PROVIDERS = ['financialModelingPrep', 'yahooFinance', 'alphaVantage', 'polygon'];

const watchlist = JSON.parse(fs.readFileSync(path.join(__dirname, '../.config/watchlist.json'), 'utf8'));

/**
 * 选择某个市场使用的数据源函数。FMP 只覆盖美股，港股/A股改用 Yahoo Finance。
 */
function sourceFor(market) {
  const { provider } = getActiveDataSource();
  if (provider === 'financialModelingPrep' && market !== 'us') {
    const yahoo = require('./data-sources/yahoo-finance');
    return { name: 'yahooFinance', calendar: yahoo.getEarningsCalendar, info: yahoo.getCompanyInfo, earnings: yahoo.getCompanyEarnings };
  }
  return { name: provider, calendar: providerCalendar, info: providerInfo, earnings: providerEarnings };
}

const clean = value => (value === 'N/A' || value === undefined ? null : value);
const todayISO = () => new Date().toISOString().split('T')[0];

// 加载新浪财经数据源（国内直接访问）
let sinaDataSource;
try {
  sinaDataSource = require('./data-sources/sina');
} catch (e) {
  console.warn('新浪财经数据源加载失败:', e.message);
}

/**
 * 通过 Web Search 获取真实财报日历
 * @param {string} symbol - 股票代码（可选）
 * @param {string} market - 市场代码（us/hk/cn）
 */
async function getRealEarningsCalendar(symbol = null, market = 'us') {
  if (!symbol) {
    const providerResult = await getProviderCalendar(market);
    if (providerResult) return providerResult;
  }

  let searchQuery;
  
  if (symbol) {
    // 查询特定公司
    searchQuery = `${symbol} earnings date next report ${getMarketSuffix(market)}`;
  } else {
    // 获取下周财报日历
    const nextWeek = getNextWeekDateRange();
    searchQuery = `earnings calendar ${nextWeek} ${getMarketSuffix(market)}`;
  }
  
  try {
    const searchScript = path.join(__dirname, '../../coze-web-search/scripts/search.ts');
    const result = execFileSync('npx', ['ts-node', searchScript, '-q', searchQuery, '--count', '15'],
      { encoding: 'utf8', timeout: 60000 }
    );
    
    // 解析搜索结果
    return parseSearchResults(result, symbol);
  } catch (error) {
    console.error('获取真实数据失败:', error.message);
    return null;
  }
}

/**
 * 用当前数据源逐个查询关注列表，返回下周有财报的公司。
 * 数据源不支持或全部失败时返回 null（调用方回退到其他方式）。
 */
async function getProviderCalendar(market) {
  const { provider } = getActiveDataSource();
  if (!LIVE_PROVIDERS.includes(provider)) return null;

  const range = getNextWeekISORange();
  const marketCodes = market ? [market] : Object.keys(watchlist.markets);
  const supported = marketCodes.filter(m => watchlist.markets[m]);
  if (supported.length === 0) return null;

  console.log(`📡 使用 ${provider} 查询 ${range.from} ~ ${range.to} 的财报...`);

  const results = [];
  let succeeded = 0;

  for (const m of supported) {
    const marketConfig = watchlist.markets[m];
    const source = sourceFor(m);
    await Promise.all(marketConfig.companies.map(async company => {
      try {
        const list = await source.calendar(company.symbol, m);
        succeeded++;
        const entry = (list || [])
          .filter(item => item.date >= range.from && item.date <= range.to)
          .sort((a, b) => a.date.localeCompare(b.date))[0];
        if (entry) {
          results.push({
            ...entry,
            symbol: company.symbol,
            name: company.name,
            industry: company.industry,
            market: m,
            marketName: marketConfig.name,
            currency: marketConfig.currency || entry.currency,
            isRealData: true
          });
        }
      } catch (e) {
        // 单个公司失败不影响其他公司
      }
    }));
  }

  if (succeeded === 0) return null;
  results.sort((a, b) => a.date.localeCompare(b.date));
  results.providerChecked = true; // 即使为空也是真实结果（该周确实没有财报）
  return results;
}

/**
 * 用当前数据源获取公司财报数据
 */
async function getProviderCompanyData(symbol, market) {
  const { provider } = getActiveDataSource();
  if (!LIVE_PROVIDERS.includes(provider)) return null;

  const source = sourceFor(market);
  const [info, earnings] = await Promise.all([
    source.info(symbol, market).catch(() => null),
    source.earnings(symbol, market).catch(() => null)
  ]);
  if (!info && !earnings) return null;

  const nextDate = clean(info?.nextEarningsDate);
  const latestEPS = clean(earnings?.actualEPS);
  // 只有行情/资料、没有财报信息（如 Polygon 免费版）时，交给后续数据源处理
  if (!latestEPS && !(nextDate && nextDate >= todayISO())) return null;

  return {
    symbol,
    name: info?.name || earnings?.name,
    price: info?.price,
    market,
    latestEPS,
    expectedEPS: clean(info?.expectedEPS),
    expectedRevenue: clean(info?.expectedRevenue),
    latestRevenue: clean(earnings?.actualRevenue),
    nextEarningsDate: nextDate && nextDate >= todayISO() ? nextDate : null,
    growth: clean(earnings?.yoyGrowth),
    isRealData: true,
    source: info?.source || earnings?.source || provider
  };
}

/**
 * 最近一次已公布财报的摘要（实际值 vs 预期值），仅当数据源提供了实际 EPS 时返回
 */
async function getRealEarningsSummary(symbol, market = 'us') {
  const { provider } = getActiveDataSource();
  if (!LIVE_PROVIDERS.includes(provider)) return null;

  try {
    const earnings = await sourceFor(market).earnings(symbol, market);
    return earnings && clean(earnings.actualEPS) ? earnings : null;
  } catch (e) {
    return null;
  }
}

/**
 * 获取特定公司的财报数据
 */
async function getRealCompanyEarnings(symbol, market = 'us') {
  // 优先使用当前配置的数据源（FMP / Yahoo / Alpha Vantage / Polygon）
  try {
    const providerData = await getProviderCompanyData(symbol, market);
    if (providerData) return providerData;
  } catch (e) {
    console.warn('当前数据源获取失败:', e.message);
  }

  // 优先使用新浪财经数据源（国内可用）
  if (sinaDataSource) {
    try {
      console.log(`📡 尝试从新浪财经获取 ${symbol} 数据...`);
      const sinaData = await sinaDataSource.getCompanyInfo(symbol, market);
      if (sinaData) {
        return {
          symbol: sinaData.symbol,
          name: sinaData.name,
          price: sinaData.price,
          market: sinaData.market,
          latestEPS: 'N/A',
          latestRevenue: 'N/A',
          nextEarningsDate: null, // 新浪不提供财报日期（其值仅为占位的 +30 天）
          growth: 'N/A',
          isRealData: true,
          source: '新浪财经'
        };
      }
    } catch (e) {
      console.warn('新浪财经获取失败:', e.message);
    }
  }
  
  // 回退到 Web Search
  const queries = [
    `${symbol} Q4 2025 earnings EPS revenue ${getMarketSuffix(market)}`,
    `${symbol} latest earnings results beat miss ${getMarketSuffix(market)}`,
    `${symbol} 财报 业绩 EPS 营收 ${getMarketSuffix(market)}`
  ];
  
  const results = [];
  
  for (const query of queries) {
    try {
      const searchScript = path.join(__dirname, '../../coze-web-search/scripts/search.ts');
      const result = execFileSync('npx', ['ts-node', searchScript, '-q', query, '--count', '10'],
        { encoding: 'utf8', timeout: 60000 }
      );
      results.push(result);
    } catch (e) {
      // 忽略错误，继续下一个查询
    }
  }
  
  return mergeAndParseResults(results, symbol);
}

/**
 * 解析搜索结果
 */
function parseSearchResults(searchOutput, symbol) {
  const lines = searchOutput.split('\n');
  const earnings = [];
  
  // 简单解析逻辑 - 提取标题中包含 earnings 的结果
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测财报相关标题
    if (line.includes('earnings') || line.includes('财报') || line.includes('业绩')) {
      const nextLine = lines[i + 1] || '';
      const urlMatch = nextLine.match(/URL:\s*(.+)/);
      const dateMatch = line.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      
      if (urlMatch) {
        earnings.push({
          title: line.trim(),
          url: urlMatch[1].trim(),
          date: dateMatch ? dateMatch[1] : null,
          symbol: symbol
        });
      }
    }
  }
  
  return earnings;
}

/**
 * 合并并解析多个搜索结果
 */
function mergeAndParseResults(results, symbol) {
  const merged = {
    symbol,
    reports: [],
    latestEPS: null,
    latestRevenue: null,
    nextEarningsDate: null,
    growth: null
  };
  
  for (const result of results) {
    const lines = result.split('\n');
    
    for (const line of lines) {
      // 提取EPS
      const epsMatch = line.match(/EPS[:\s]+\$?([\d.]+)/i);
      if (epsMatch) merged.latestEPS = epsMatch[1];
      
      // 提取营收
      const revenueMatch = line.match(/revenue[:\s]+\$?([\d.]+)\s*(B|M)/i);
      if (revenueMatch) {
        merged.latestRevenue = `${revenueMatch[1]}${revenueMatch[2]}`;
      }
      
      // 提取增长率
      const growthMatch = line.match(/(?:growth|增长)[:\s]+([+\-]?\d+)%/i);
      if (growthMatch) merged.growth = `${growthMatch[1]}%`;
      
      // 提取下次财报日期
      const dateMatch = line.match(/next earnings[:\s]+(\w+ \d{1,2},? \d{4})/i);
      if (dateMatch) merged.nextEarningsDate = dateMatch[1];
    }
  }
  
  return merged;
}

/**
 * 获取下周日期范围
 */
function getNextWeekDateRange() {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = new Date(nextWeek);
  start.setDate(nextWeek.getDate() - nextWeek.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  
  const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  return `${formatDate(start)} to ${formatDate(end)}`;
}

/**
 * 下周一至周五的日期范围（YYYY-MM-DD），与 core-v2 的 getNextWeekRange 一致
 */
function getNextWeekISORange() {
  const today = new Date();
  const daysUntilNextMonday = (8 - today.getDay()) % 7 || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilNextMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(monday), to: iso(friday) };
}

/**
 * 获取市场后缀
 */
function getMarketSuffix(market) {
  const suffixes = {
    us: '',
    hk: 'HKEX Hong Kong',
    cn: 'A-share China'
  };
  return suffixes[market] || '';
}

/**
 * 获取真实财报数据（带缓存）
 */
async function getRealEarningsData(symbol, market = 'us') {
  console.log(`🔍 正在获取 ${symbol} 的真实数据...`);
  
  const data = await getRealCompanyEarnings(symbol, market);
  
  if (!data || (!data.price && !data.latestEPS && !data.nextEarningsDate)) {
    console.log(`⚠️ 未找到 ${symbol} 的实时数据`);
    return null;
  }
  
  console.log(`✅ 成功获取 ${symbol} 的${data.source || '真实'}数据`);
  return data;
}

module.exports = {
  getRealEarningsCalendar,
  getRealCompanyEarnings,
  getRealEarningsSummary,
  getRealEarningsData,
  getNextWeekDateRange
};
