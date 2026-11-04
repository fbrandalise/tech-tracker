/**
 * Web Search Data Source
 * 通过搜索引擎获取财报数据（备选方案）
 * 不需要 API Key，但准确性较低
 */

const { execFileSync } = require('child_process');   // sem shell: o texto da busca nunca é interpretado como comando
const path = require('path');

/**
 * 通过 Web Search 获取财报数据
 */
async function getEarningsCalendar(symbol = null, market = 'us') {
  try {
    const searchScript = path.join(__dirname, '../../coze-web-search/scripts/search.ts');
    
    let searchQuery;
    if (symbol) {
      searchQuery = `${symbol} earnings date next report Q1 Q2 Q3 Q4 2025 2026`;
    } else {
      const nextWeek = getNextWeekRange();
      searchQuery = `earnings calendar ${nextWeek} stock market`;
    }
    
    const result = execFileSync('npx', ['ts-node', searchScript, '-q', searchQuery, '--count', '10'],
      { encoding: 'utf8', timeout: 60000 }
    );
    
    // 解析搜索结果
    return parseSearchResults(result, symbol);
  } catch (error) {
    console.error('Web Search 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司财报详情
 */
async function getCompanyEarnings(symbol, market = 'us') {
  try {
    const searchScript = path.join(__dirname, '../../coze-web-search/scripts/search.ts');
    
    const queries = [
      `${symbol} latest earnings EPS revenue beat miss`,
      `${symbol} Q4 2025 earnings results`,
      `${symbol} 财报 业绩 营收 EPS`
    ];
    
    const results = [];
    for (const query of queries) {
      try {
        const result = execFileSync('npx', ['ts-node', searchScript, '-q', query, '--count', '5'],
          { encoding: 'utf8', timeout: 60000 }
        );
        results.push(result);
      } catch (e) {
        // 忽略单个查询错误
      }
    }
    
    return mergeAndParseResults(results, symbol);
  } catch (error) {
    console.error('Web Search 错误:', error.message);
    return null;
  }
}

/**
 * 获取公司信息
 */
async function getCompanyInfo(symbol, market = 'us') {
  try {
    const searchScript = path.join(__dirname, '../../coze-web-search/scripts/search.ts');
    
    const query = `${symbol} company profile sector industry`;
    const result = execFileSync('npx', ['ts-node', searchScript, '-q', query, '--count', '5'],
      { encoding: 'utf8', timeout: 60000 }
    );
    
    return parseCompanyInfo(result, symbol, market);
  } catch (error) {
    console.error('Web Search 错误:', error.message);
    return null;
  }
}

// 辅助函数
function parseSearchResults(searchOutput, symbol) {
  const lines = searchOutput.split('\n');
  const earnings = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('earnings') || line.includes('财报') || line.includes('业绩')) {
      const nextLine = lines[i + 1] || '';
      const urlMatch = nextLine.match(/URL:\s*(.+)/);
      const dateMatch = line.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
      
      if (urlMatch) {
        earnings.push({
          title: line.trim(),
          url: urlMatch[1].trim(),
          date: dateMatch ? dateMatch[1] : null,
          symbol: symbol,
          isRealData: true,
          source: 'Web Search',
          note: '数据来自搜索，准确性较低'
        });
      }
    }
  }
  
  return earnings;
}

function mergeAndParseResults(results, symbol) {
  const merged = {
    symbol,
    isRealData: true,
    source: 'Web Search',
    note: '数据来自搜索，仅供参考',
    reports: [],
    latestEPS: null,
    latestRevenue: null,
    nextEarningsDate: null,
    growth: null
  };
  
  for (const result of results) {
    const lines = result.split('\n');
    
    for (const line of lines) {
      const epsMatch = line.match(/EPS[:\s]+\$?([\d.]+)/i);
      if (epsMatch && !merged.latestEPS) merged.latestEPS = epsMatch[1];
      
      const revenueMatch = line.match(/revenue[:\s]+\$?([\d.]+)\s*(B|M)/i);
      if (revenueMatch && !merged.latestRevenue) {
        merged.latestRevenue = `${revenueMatch[1]}${revenueMatch[2]}`;
      }
      
      const growthMatch = line.match(/(?:growth|增长)[:\s]+([+\-]?\d+)%/i);
      if (growthMatch && !merged.growth) merged.growth = `${growthMatch[1]}%`;
      
      const dateMatch = line.match(/next earnings[:\s]+(\w+ \d{1,2},? \d{4})/i);
      if (dateMatch && !merged.nextEarningsDate) merged.nextEarningsDate = dateMatch[1];
    }
  }
  
  return merged;
}

function parseCompanyInfo(searchOutput, symbol, market) {
  return {
    symbol,
    name: symbol,
    market,
    isRealData: true,
    source: 'Web Search',
    note: '数据来自搜索，准确性较低',
    description: '请查看搜索结果获取详细信息'
  };
}

function getNextWeekRange() {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const start = new Date(nextWeek);
  start.setDate(nextWeek.getDate() - nextWeek.getDay() + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  
  const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  return `${formatDate(start)} to ${formatDate(end)}`;
}

module.exports = {
  getEarningsCalendar,
  getCompanyEarnings,
  getCompanyInfo
};
