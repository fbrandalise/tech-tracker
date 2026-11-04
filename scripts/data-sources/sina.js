/**
 * Sina Finance Data Source - 新浪财经数据源
 * 国内免费股票数据接口，无需代理
 * 
 * 接口说明：
 * - A股: https://hq.sinajs.cn/list=sh600519 (上海), sz000001 (深圳)
 * - 港股: https://hq.sinajs.cn/list=hk00700
 * - 美股: https://hq.sinajs.cn/list=gb_nvda
 */


/**
 * 转换股票代码为新浪财经格式
 */
function formatSinaSymbol(symbol, market) {
  market = market.toLowerCase();
  
  if (market === 'cn') {
    // A股：sh开头是上海，sz开头是深圳
    // 600/601/603/688 是上海，000/001/002/300 是深圳
    const code = symbol.replace(/[^0-9]/g, '');
    if (code.match(/^(600|601|603|605|688|689)/)) {
      return `sh${code}`;
    } else {
      return `sz${code}`;
    }
  } else if (market === 'hk') {
    // 港股：hk + 代码（去掉.HK后缀）
    const code = symbol.replace('.HK', '').replace('.hk', '');
    return `hk${code}`;
  } else if (market === 'us') {
    // 美股：gb_ + 代码（小写）
    return `gb_${symbol.toLowerCase()}`;
  }
  
  return symbol;
}

/**
 * 解析新浪财经返回的数据
 */
function parseSinaData(data, symbol, market) {
  // 新浪返回格式: var hq_str_sh600519="贵州茅台,1745.00,...";
  const match = data.match(/var hq_str_\w+="([^"]*)";/);
  if (!match || !match[1]) {
    return null;
  }
  
  const fields = match[1].split(',');
  if (fields.length < 5) {
    return null;
  }
  
  if (market === 'cn') {
    // A股格式：名称,今日开盘价,昨日收盘价,当前价格,今日最高价,今日最低价,...
    return {
      symbol: symbol,
      name: fields[0],
      open: parseFloat(fields[1]),
      close: parseFloat(fields[2]),
      price: parseFloat(fields[3]),
      high: parseFloat(fields[4]),
      low: parseFloat(fields[5]),
      volume: parseInt(fields[8]),
      amount: parseFloat(fields[9]),
      date: fields[30],
      time: fields[31],
      market: 'cn',
      currency: 'CNY',
      isRealData: true,
      source: '新浪财经'
    };
  } else if (market === 'hk') {
    // 港股格式类似
    return {
      symbol: symbol,
      name: fields[0],
      open: parseFloat(fields[2]),
      close: parseFloat(fields[3]),
      price: parseFloat(fields[6]),
      high: parseFloat(fields[4]),
      low: parseFloat(fields[5]),
      volume: parseInt(fields[12]),
      date: fields[17],
      time: fields[18],
      market: 'hk',
      currency: 'HKD',
      isRealData: true,
      source: '新浪财经'
    };
  } else {
    // 美股格式（gb_前缀）
    // 格式：名称,当前价,涨跌额,时间,涨跌额2,昨收,开盘价,最高价,最低价,52周高,52周低,成交量,...
    const price = parseFloat(fields[1]);
    const change = parseFloat(fields[2]);
    const prevClose = parseFloat(fields[5]); // 昨收
    const changePct = prevClose ? ((change / prevClose) * 100).toFixed(2) : '0.00';

    return {
      symbol: symbol,
      name: fields[0],
      price: price,
      change: change,
      changePercent: parseFloat(changePct),
      prevClose: prevClose,
      open: parseFloat(fields[6]),
      high: parseFloat(fields[7]),
      low: parseFloat(fields[8]),
      high52w: parseFloat(fields[9]),
      low52w: parseFloat(fields[10]),
      volume: parseInt(fields[11]),
      date: fields[3] ? fields[3].split(' ')[0] : new Date().toISOString().split('T')[0],
      time: fields[3] ? fields[3].split(' ')[1] : '',
      market: 'us',
      currency: 'USD',
      isRealData: true,
      source: '新浪财经'
    };
  }
}

/**
 * 获取股票实时行情
 */
async function getCompanyInfo(symbol, market = 'us') {
  try {
    const sinaSymbol = formatSinaSymbol(symbol, market);
    const url = `https://hq.sinajs.cn/list=${encodeURIComponent(sinaSymbol)}`;
    
    console.log(`  📡 请求: ${url}`);
    
    // fetch em vez de curl via shell: o símbolo vem do usuário e não pode chegar a um shell
    const resp = await fetch(url, { headers: { Referer: 'https://finance.sina.com.cn' }, signal: AbortSignal.timeout(15000) });
    const result = new TextDecoder('gb18030').decode(await resp.arrayBuffer());

    const data = parseSinaData(result, symbol, market);
    
    if (!data) {
      console.log(`  ⚠️ 无数据返回`);
      return null;
    }
    
    // 添加模拟的财报信息（新浪财经不提供财报日历）
    return {
      ...data,
      nextEarningsDate: getMockEarningsDate(symbol),
      expectedEPS: 'N/A',
      expectedRevenue: 'N/A',
      note: '实时行情数据，财报日期需从其他来源获取'
    };
  } catch (error) {
    console.error(`  ❌ 新浪API错误: ${error.message}`);
    return null;
  }
}

/**
 * 获取财报日历（新浪财经不提供，使用模拟数据）
 */
async function getEarningsCalendar(symbol = null, market = 'us') {
  console.log('⚠️ 新浪财经不提供财报日历API，请使用其他数据源');
  return null;
}

/**
 * 获取公司财报详情（新浪财经不提供）
 */
async function getCompanyEarnings(symbol, market = 'us') {
  console.log('⚠️ 新浪财经不提供历史财报详情API，请使用其他数据源');
  return null;
}

/**
 * 生成模拟财报日期
 */
function getMockEarningsDate(symbol) {
  const date = new Date();
  date.setDate(date.getDate() + 30); // 默认30天后
  return date.toISOString().split('T')[0];
}

/**
 * 批量获取股票行情（用于板块扫描）
 */
async function getBatchQuotes(symbols, market = 'us') {
  const results = [];
  
  for (const symbol of symbols) {
    try {
      const data = await getCompanyInfo(symbol, market);
      if (data) {
        results.push(data);
      }
    } catch (e) {
      // 忽略单个错误
    }
  }
  
  return results;
}

module.exports = {
  getCompanyInfo,
  getEarningsCalendar,
  getCompanyEarnings,
  getBatchQuotes,
  formatSinaSymbol
};
