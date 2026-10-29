/**
 * AI Earnings Tracker - Core Module with Real Data Support
 * 支持真实数据获取 + 模拟数据回退
 */

const fs = require('fs');
const path = require('path');
const { getRealEarningsData, getRealEarningsCalendar } = require('./real-data');

// 加载配置
const CONFIG_PATH = path.join(__dirname, '../.config/watchlist.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.error('配置文件加载失败:', e.message);
  process.exit(1);
}

// 是否使用真实数据模式
const USE_REAL_DATA = process.env.USE_REAL_DATA !== 'false'; // 默认启用真实数据

/**
 * 获取下周财报预览（真实数据优先）
 */
async function getWeeklyPreview(options = {}) {
  const { market = null, sector = null, useRealData = USE_REAL_DATA } = options;
  const weekRange = getNextWeekRange();
  
  let companies = [];
  
  // 收集符合条件的公司
  if (sector) {
    companies = getCompaniesBySector(sector, market);
  } else if (market) {
    const m = config.markets[market];
    if (m) {
      companies = m.companies.map(c => ({ ...c, market, marketName: m.name }));
    }
  } else {
    Object.keys(config.markets).forEach(mCode => {
      const m = config.markets[mCode];
      companies.push(...m.companies.map(c => ({ 
        ...c, 
        market: mCode, 
        marketName: m.name 
      })));
    });
  }
  
  // 尝试获取真实数据
  let earningsData;
  if (useRealData) {
    console.log('🔍 尝试获取真实财报数据...');
    const realData = await getRealEarningsCalendar(null, market);
    if (realData && (realData.length > 0 || realData.providerChecked)) {
      earningsData = realData;
    } else {
      console.log('⚠️ 真实数据获取失败，使用模拟数据');
      earningsData = generateMockEarnings(companies, weekRange);
    }
  } else {
    earningsData = generateMockEarnings(companies, weekRange);
  }
  
  const formatted = formatPreviewReport(earningsData, weekRange.formatted, { market, sector });
  
  return {
    week: weekRange.formatted,
    companies: earningsData,
    formatted,
    market,
    sector,
    isRealData: useRealData && earningsData !== null,
    raw: earningsData
  };
}

/**
 * 查询特定公司（支持真实数据）
 */
async function queryCompany(symbol, marketCode = null, useRealData = USE_REAL_DATA) {
  let company = null;
  let foundMarket = null;
  
  // 查找公司
  if (marketCode) {
    const m = config.markets[marketCode];
    if (m) {
      company = m.companies.find(c => 
        c.symbol.toLowerCase() === symbol.toLowerCase()
      );
      if (company) foundMarket = marketCode;
    }
  } else {
    Object.keys(config.markets).forEach(mCode => {
      if (company) return;
      const m = config.markets[mCode];
      const found = m.companies.find(c => 
        c.symbol.toLowerCase() === symbol.toLowerCase()
      );
      if (found) {
        company = found;
        foundMarket = mCode;
      }
    });
  }
  
  if (!company) {
    return {
      formatted: `❌ 未找到 ${symbol}${marketCode ? ` (${config.markets[marketCode]?.name || marketCode})` : ''}\n\n请检查股票代码是否正确，或使用以下命令查看关注列表：\n• 美股：NVDA, MSFT, AAPL...\n• 港股：00700.HK, 09988.HK...\n• A股：600519, 002594...`,
      found: false
    };
  }
  
  const market = config.markets[foundMarket];
  
  // 尝试获取真实数据
  let earningsInfo;
  if (useRealData) {
    const realData = await getRealEarningsData(symbol, foundMarket);
    if (realData && (realData.latestEPS || realData.nextEarningsDate)) {
      earningsInfo = {
        date: realData.nextEarningsDate || '待公布',
        time: '盘后',
        expectedEPS: realData.latestEPS || 'N/A',
        expectedRevenue: realData.latestRevenue || 'N/A',
        yoyGrowth: realData.growth || 'N/A',
        isRealData: true
      };
    } else {
      earningsInfo = getMockEarningsDate(symbol);
      earningsInfo.isRealData = false;
    }
  } else {
    earningsInfo = getMockEarningsDate(symbol);
    earningsInfo.isRealData = false;
  }
  
  return {
    company: { ...company, market: foundMarket, marketName: market.name },
    market: foundMarket,
    nextEarnings: earningsInfo,
    formatted: formatCompanyQuery(company, market, earningsInfo),
    found: true
  };
}

/**
 * 生成财报摘要（支持真实数据）
 */
async function generateSummary(symbol, marketCode = null, useRealData = USE_REAL_DATA) {
  const query = await queryCompany(symbol, marketCode, useRealData);
  
  if (!query.found) {
    return { formatted: query.formatted, found: false };
  }
  
  const { company, market, nextEarnings } = query;
  const marketConfig = config.markets[market];
  
  // 尝试获取真实财报摘要
  let summaryData;
  if (useRealData && nextEarnings.isRealData) {
    const realData = await getRealEarningsData(symbol, market);
    if (realData) {
      summaryData = {
        symbol: company.symbol,
        name: company.name,
        quarter: '最新季度',
        date: realData.nextEarningsDate || new Date().toISOString().split('T')[0],
        time: '盘后',
        expectedEPS: realData.latestEPS || 'N/A',
        actualEPS: realData.latestEPS || 'N/A',
        expectedRevenue: realData.latestRevenue || 'N/A',
        actualRevenue: realData.latestRevenue || 'N/A',
        yoyGrowth: realData.growth || 'N/A',
        highlights: ['基于真实搜索数据', '详情请查看原始来源'],
        guidance: '请查看官方财报发布',
        afterHoursMove: '待公布',
        currency: marketConfig.currency,
        isRealData: true
      };
    } else {
      summaryData = getMockSummaryData(company, marketConfig.currency);
      summaryData.isRealData = false;
    }
  } else {
    summaryData = getMockSummaryData(company, marketConfig.currency);
    summaryData.isRealData = false;
  }
  
  return {
    company,
    market,
    summary: summaryData,
    formatted: formatEarningsSummary(summaryData, marketConfig),
    found: true
  };
}

// ... (其他辅助函数与之前相同)

function getNextWeekRange() {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilNextMonday = (8 - currentDay) % 7 || 7;
  
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  
  const nextFriday = new Date(nextMonday);
  nextFriday.setDate(nextMonday.getDate() + 4);
  
  return {
    start: nextMonday,
    end: nextFriday,
    formatted: `${formatDate(nextMonday)} - ${formatDate(nextFriday)}`,
    startFull: formatDateFull(nextMonday),
    endFull: formatDateFull(nextFriday)
  };
}

function formatDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

function formatDateFull(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCompaniesBySector(sectorId, marketCode = null) {
  const results = [];
  
  Object.keys(config.markets).forEach(mCode => {
    if (marketCode && mCode !== marketCode) return;
    
    const market = config.markets[mCode];
    const companies = market.companies.filter(c => c.sector === sectorId);
    
    companies.forEach(c => {
      results.push({
        ...c,
        market: mCode,
        marketName: market.name
      });
    });
  });
  
  return results;
}

function generateMockEarnings(companies, weekRange) {
  const dates = [];
  
  for (let i = 0; i < 5; i++) {
    const date = new Date(weekRange.start);
    date.setDate(date.getDate() + i);
    dates.push(formatDateFull(date));
  }
  
  return companies.slice(0, 8).map((company, index) => ({
    symbol: company.symbol,
    name: company.name,
    market: company.market,
    marketName: company.marketName,
    sector: company.sector,
    industry: company.industry,
    date: dates[index % dates.length],
    time: index % 2 === 0 ? 'after' : 'pre',
    expectedEPS: (Math.random() * 5 + 0.5).toFixed(2),
    expectedRevenue: `${(Math.random() * 100 + 10).toFixed(1)}`,
    currency: config.markets[company.market]?.currency || 'USD',
    isRealData: false
  }));
}

function getMockEarningsDate(symbol) {
  const today = new Date();
  const daysAhead = symbol.charCodeAt(0) % 30 + 1;
  const date = new Date(today);
  date.setDate(today.getDate() + daysAhead);
  
  return {
    date: formatDateFull(date),
    time: symbol.charCodeAt(0) % 2 === 0 ? 'after' : 'pre',
    expectedEPS: (Math.random() * 5 + 0.5).toFixed(2),
    expectedRevenue: `${(Math.random() * 100 + 10).toFixed(1)}`,
    isRealData: false
  };
}

function getMockSummaryData(company, currency) {
  const expectedEPS = (Math.random() * 5 + 0.5).toFixed(2);
  const actualEPS = (parseFloat(expectedEPS) * (0.9 + Math.random() * 0.3)).toFixed(2);
  const expectedRevenue = Math.floor(Math.random() * 100 + 10);
  const actualRevenue = Math.floor(expectedRevenue * (0.95 + Math.random() * 0.15));
  
  const highlights = [
    "核心业务保持稳定增长，市场份额持续扩大",
    "新产品/服务推出，获得市场积极反馈",
    "成本控制效果显著，毛利率同比提升",
    "战略合作持续推进，生态布局完善",
    "研发投入加大，技术创新能力增强"
  ];
  
  const shuffled = highlights.sort(() => 0.5 - Math.random());
  
  return {
    symbol: company.symbol,
    name: company.name,
    quarter: `Q${Math.floor(Math.random() * 4) + 1} ${new Date().getFullYear()}`,
    date: formatDateFull(new Date()),
    time: 'after',
    expectedEPS,
    actualEPS,
    expectedRevenue: `${expectedRevenue}`,
    actualRevenue: `${actualRevenue}`,
    yoyGrowth: `+${Math.floor(Math.random() * 50 + 10)}%`,
    highlights: shuffled.slice(0, 3),
    guidance: `下季度营收预期 ${Math.floor(actualRevenue * 1.05)}${currency} ± 2%`,
    afterHoursMove: `${Math.random() > 0.5 ? '+' : '-'}${(Math.random() * 5).toFixed(1)}%`,
    currency,
    isRealData: false
  };
}

function formatPreviewReport(companies, weekRange, options = {}) {
  const { market, sector } = options;
  
  const marketInfo = market ? ` | ${config.markets[market]?.name || market}` : '';
  const sectorInfo = sector ? ` | ${getSectorName(sector)}板块` : '';
  const dataType = companies.length === 0 || companies.some(c => c.isRealData) ? '' : ' [模拟数据]';
  
  const lines = [
    `📊 **下周财报预览 (${weekRange})${marketInfo}${sectorInfo}${dataType}**`,
    '',
    `共 **${companies.length}** 家公司发布财报：`,
    ''
  ];
  
  if (companies.length === 0) {
    lines.push('⚠️ 该筛选条件下暂无财报安排');
    return lines.join('\n');
  }
  
  const byDate = {};
  companies.forEach(c => {
    if (!byDate[c.date]) byDate[c.date] = [];
    byDate[c.date].push(c);
  });
  
  Object.keys(byDate).sort().forEach(date => {
    const dateObj = new Date(`${date}T12:00:00`); // 避免 UTC 解析导致的日期偏移
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dateObj.getDay()];
    lines.push(`📅 ${date} ${weekday}`);
    lines.push('');
    
    byDate[date].forEach((company, index) => {
      const timeEmoji = company.time === 'pre' ? '🌅' : '🌙';
      const timeText = company.time === 'pre' ? '盘前' : '盘后';
      const marketEmoji = getMarketEmoji(company.market);
      const dataTag = company.isRealData ? '' : '(模拟)';
      
      lines.push(`${index + 1}. ${marketEmoji} **${company.name} (${company.symbol})** ${dataTag}`);
      lines.push(`   ${timeEmoji} ${timeText} | 🏷️ ${company.industry}`);
      lines.push(`   📈 预期EPS: ${company.currency} ${company.expectedEPS} | 预期营收: ${company.expectedRevenue}${company.currency}`);
      lines.push('');
    });
  });
  
  lines.push('---');
  lines.push('💡 **操作提示**：');
  lines.push('• 回复「确认追踪」可自动设置财报提醒');
  lines.push('• 回复公司代码可查看详细信息（如：NVDA）');
  lines.push('• 使用真实数据: `USE_REAL_DATA=true node index.js preview`');
  
  return lines.join('\n');
}

function formatCompanyQuery(company, market, earningsDate) {
  const timeEmoji = earningsDate.time === 'pre' ? '🌅' : '🌙';
  const timeText = earningsDate.time === 'pre' ? '盘前' : '盘后';
  const marketEmoji = getMarketEmoji(market);
  const dataTag = earningsDate.isRealData ? '[真实数据]' : '[模拟数据]';
  
  return `
${marketEmoji} **${company.name} (${company.symbol})** ${dataTag}

🏷️ 市场: ${market.name} | 行业: ${company.industry} | 板块: ${getSectorName(company.sector)}

⏰ **下次财报**
📅 日期: ${earningsDate.date}
${timeEmoji} 时间: ${timeText} (${market.timezone})

📊 **市场预期**
• EPS: ${market.currency} ${earningsDate.expectedEPS}
• 营收: ${earningsDate.expectedRevenue} ${market.currency}
• 同比增速: ${earningsDate.yoyGrowth || '待更新'}

🔍 **关注点**
• ${company.industry}行业整体表现
• 公司核心业务增长情况
• 下季度业绩指引
• 市场竞争格局变化
  `.trim();
}

function formatEarningsSummary(data, marketConfig) {
  const beatEPS = parseFloat(data.actualEPS) >= parseFloat(data.expectedEPS);
  const beatRevenue = parseFloat(data.actualRevenue) >= parseFloat(data.expectedRevenue);
  
  const timeEmoji = data.time === 'pre' ? '🌅' : '🌙';
  const timeText = data.time === 'pre' ? '盘前' : '盘后';
  const dataTag = data.isRealData ? '[真实数据]' : '[模拟数据]';
  
  return `
📈 **${data.name} (${data.symbol}) ${data.quarter} 财报摘要** ${dataTag}

⏰ 发布时间: ${data.date} ${timeEmoji}${timeText}

📊 **核心指标**
• EPS: ${data.currency} ${data.actualEPS} (预期: ${data.currency} ${data.expectedEPS}) ${beatEPS ? '✅ 超预期' : '❌ 低于预期'}
• 营收: ${data.actualRevenue}${data.currency} (预期: ${data.expectedRevenue}${data.currency}) ${beatRevenue ? '✅ 超预期' : '❌ 低于预期'}
• 同比增速: ${data.yoyGrowth}

🚀 **关键亮点**
${data.highlights.map(h => `• ${h}`).join('\n')}

🎯 **下季度指引**
${data.guidance}

📰 **市场反应**
盘后涨跌: ${data.afterHoursMove}
  `.trim();
}

function getMarketEmoji(marketCode) {
  const emojis = {
    us: '🇺🇸',
    hk: '🇭🇰',
    cn: '🇨🇳'
  };
  return emojis[marketCode] || '📈';
}

function getSectorName(sectorId) {
  const sectorNames = {
    tech: '科技',
    finance: '金融',
    healthcare: '医疗健康',
    consumer: '消费',
    energy: '能源',
    industrial: '工业',
    property: '地产',
    manufacturing: '制造',
    materials: '材料'
  };
  return sectorNames[sectorId] || sectorId;
}

module.exports = {
  getWeeklyPreview,
  queryCompany,
  generateSummary,
  config,
  getNextWeekRange: () => getNextWeekRange(),
  getCompaniesBySector,
  getMarkets: () => Object.keys(config.markets).map(key => ({
    code: key,
    name: config.markets[key].name,
    timezone: config.markets[key].timezone,
    currency: config.markets[key].currency
  })),
  getSectors: (marketCode) => {
    const market = config.markets[marketCode];
    if (!market) return null;
    return market.sectors.map(sector => ({
      id: sector.id,
      name: sector.name,
      keywords: sector.keywords,
      companyCount: market.companies.filter(c => c.sector === sector.id).length
    }));
  }
};
