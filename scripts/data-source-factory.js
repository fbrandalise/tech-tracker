/**
 * Data Source Factory - 统一数据源接口
 * 支持多种数据源：Mock, FMP, Alpha Vantage, Yahoo Finance, Polygon, Web Search, 新浪财经
 */

require('./load-env');
const fs = require('fs');
const path = require('path');

// 加载配置
const CONFIG_PATH = path.join(__dirname, '../.config/watchlist.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.error('配置文件加载失败:', e.message);
  process.exit(1);
}

/**
 * 获取当前配置的数据源
 */
function getActiveDataSource() {
  const dsConfig = config.dataSource;
  const provider = dsConfig.provider;
  const options = dsConfig.options[provider];
  
  if (!options || !options.enabled) {
    console.log(`⚠️ 数据源 ${provider} 未启用，回退到新浪财经`);
    return { provider: 'sina', options: dsConfig.options.sina };
  }
  
  return { provider, options };
}

/**
 * 获取财报日历（统一接口）
 */
async function getEarningsCalendar(symbol = null, market = 'us') {
  const { provider } = getActiveDataSource();
  
  switch (provider) {
    case 'mock':
      return require('./data-sources/mock').getEarningsCalendar(symbol, market);
    case 'financialModelingPrep':
      return require('./data-sources/fmp').getEarningsCalendar(symbol, market);
    case 'alphaVantage':
      return require('./data-sources/alpha-vantage').getEarningsCalendar(symbol, market);
    case 'yahooFinance':
      return require('./data-sources/yahoo-finance').getEarningsCalendar(symbol, market);
    case 'polygon':
      return require('./data-sources/polygon').getEarningsCalendar(symbol, market);
    case 'webSearch':
      return require('./data-sources/web-search').getEarningsCalendar(symbol, market);
    case 'sina':
      return require('./data-sources/sina').getEarningsCalendar(symbol, market);
    default:
      console.warn(`未知数据源: ${provider}，使用新浪财经`);
      return require('./data-sources/sina').getEarningsCalendar(symbol, market);
  }
}

/**
 * 获取公司财报详情（统一接口）
 */
async function getCompanyEarnings(symbol, market = 'us') {
  const { provider } = getActiveDataSource();
  
  switch (provider) {
    case 'mock':
      return require('./data-sources/mock').getCompanyEarnings(symbol, market);
    case 'financialModelingPrep':
      return require('./data-sources/fmp').getCompanyEarnings(symbol, market);
    case 'alphaVantage':
      return require('./data-sources/alpha-vantage').getCompanyEarnings(symbol, market);
    case 'yahooFinance':
      return require('./data-sources/yahoo-finance').getCompanyEarnings(symbol, market);
    case 'polygon':
      return require('./data-sources/polygon').getCompanyEarnings(symbol, market);
    case 'webSearch':
      return require('./data-sources/web-search').getCompanyEarnings(symbol, market);
    case 'sina':
      return require('./data-sources/sina').getCompanyEarnings(symbol, market);
    default:
      return require('./data-sources/sina').getCompanyEarnings(symbol, market);
  }
}

/**
 * 获取公司信息（统一接口）
 */
async function getCompanyInfo(symbol, market = 'us') {
  const { provider } = getActiveDataSource();
  
  switch (provider) {
    case 'mock':
      return require('./data-sources/mock').getCompanyInfo(symbol, market);
    case 'financialModelingPrep':
      return require('./data-sources/fmp').getCompanyInfo(symbol, market);
    case 'alphaVantage':
      return require('./data-sources/alpha-vantage').getCompanyInfo(symbol, market);
    case 'yahooFinance':
      return require('./data-sources/yahoo-finance').getCompanyInfo(symbol, market);
    case 'polygon':
      return require('./data-sources/polygon').getCompanyInfo(symbol, market);
    case 'webSearch':
      return require('./data-sources/web-search').getCompanyInfo(symbol, market);
    case 'sina':
      return require('./data-sources/sina').getCompanyInfo(symbol, market);
    default:
      return require('./data-sources/sina').getCompanyInfo(symbol, market);
  }
}

/**
 * 列出所有可用的数据源
 */
function listDataSources() {
  const dsConfig = config.dataSource;
  const sources = [];
  
  for (const [key, value] of Object.entries(dsConfig.options)) {
    sources.push({
      id: key,
      name: value.description,
      enabled: value.enabled,
      isActive: dsConfig.provider === key,
      freeTier: value.freeTier || 'N/A',
      needsApiKey: !!value.apiKey
    });
  }
  
  return sources;
}

/**
 * 切换数据源
 */
function switchDataSource(provider) {
  const dsConfig = config.dataSource;
  
  if (!dsConfig.options[provider]) {
    return { success: false, message: `未知数据源: ${provider}` };
  }
  
  dsConfig.provider = provider;
  dsConfig.options[provider].enabled = true;
  
  // 保存配置
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return { 
      success: true, 
      message: `已切换到 ${provider} 数据源`,
      provider,
      config: dsConfig.options[provider]
    };
  } catch (e) {
    return { success: false, message: `保存配置失败: ${e.message}` };
  }
}

/**
 * 测试当前数据源连接
 */
async function testDataSource() {
  const { provider, options } = getActiveDataSource();
  
  console.log(`🔍 测试数据源: ${provider}`);
  
  try {
    // 使用英伟达作为测试（所有数据源均支持美股）
    // 部分数据源（如 Alpha Vantage 免费版）只提供财报，不提供公司资料
    const result = (await getCompanyInfo('NVDA', 'us')) || (await getCompanyEarnings('NVDA', 'us'));
    
    if (result && (result.symbol || result.name)) {
      return {
        success: true,
        provider,
        message: `连接成功！获取到 ${result.name || result.symbol} 的数据`,
        sample: result
      };
    } else {
      return {
        success: false,
        provider,
        message: '连接成功但未获取到有效数据'
      };
    }
  } catch (error) {
    return {
      success: false,
      provider,
      message: `连接失败: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  getEarningsCalendar,
  getCompanyEarnings,
  getCompanyInfo,
  listDataSources,
  switchDataSource,
  testDataSource,
  getActiveDataSource
};
