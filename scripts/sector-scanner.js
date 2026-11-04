/**
 * Sector Scanner - 板块扫描器
 * 动态查询板块内龙头企业，生成投资推荐
 */

const path = require('path');
const { getCompanyEarnings, getCompanyInfo } = require('./data-source-factory');

/**
 * 板块龙头企业映射（简化版，实际应从API获取）
 */
const SECTOR_LEADERS = {
  us: {
    tech: [
      { symbol: 'AAPL', name: '苹果', marketCap: '3.0T' },
      { symbol: 'MSFT', name: '微软', marketCap: '3.0T' },
      { symbol: 'NVDA', name: '英伟达', marketCap: '2.2T' },
      { symbol: 'GOOGL', name: '谷歌', marketCap: '1.8T' },
      { symbol: 'AMZN', name: '亚马逊', marketCap: '1.7T' },
      { symbol: 'META', name: 'Meta', marketCap: '1.2T' },
      { symbol: 'TSLA', name: '特斯拉', marketCap: '800B' },
      { symbol: 'AVGO', name: '博通', marketCap: '600B' },
      { symbol: 'ORCL', name: '甲骨文', marketCap: '400B' },
      { symbol: 'CRM', name: 'Salesforce', marketCap: '300B' },
      { symbol: 'AMD', name: 'AMD', marketCap: '250B' },
      { symbol: 'INTC', name: '英特尔', marketCap: '150B' },
      { symbol: 'QCOM', name: '高通', marketCap: '200B' },
      { symbol: 'CSCO', name: '思科', marketCap: '200B' },
      { symbol: 'ADBE', name: 'Adobe', marketCap: '250B' }
    ],
    finance: [
      { symbol: 'BRK-B', name: '伯克希尔', marketCap: '900B' },
      { symbol: 'JPM', name: '摩根大通', marketCap: '600B' },
      { symbol: 'V', name: 'Visa', marketCap: '550B' },
      { symbol: 'MA', name: '万事达', marketCap: '450B' },
      { symbol: 'BAC', name: '美国银行', marketCap: '300B' },
      { symbol: 'WFC', name: '富国银行', marketCap: '200B' },
      { symbol: 'GS', name: '高盛', marketCap: '150B' },
      { symbol: 'MS', name: '摩根士丹利', marketCap: '150B' },
      { symbol: 'BLK', name: '贝莱德', marketCap: '120B' },
      { symbol: 'AXP', name: '美国运通', marketCap: '150B' }
    ],
    healthcare: [
      { symbol: 'LLY', name: '礼来', marketCap: '700B' },
      { symbol: 'JNJ', name: '强生', marketCap: '400B' },
      { symbol: 'UNH', name: '联合健康', marketCap: '500B' },
      { symbol: 'ABBV', name: '艾伯维', marketCap: '300B' },
      { symbol: 'MRK', name: '默克', marketCap: '320B' },
      { symbol: 'PFE', name: '辉瑞', marketCap: '150B' },
      { symbol: 'TMO', name: '赛默飞', marketCap: '200B' },
      { symbol: 'ABT', name: '雅培', marketCap: '200B' },
      { symbol: 'DHR', name: '丹纳赫', marketCap: '180B' },
      { symbol: 'BMY', name: '百时美施贵宝', marketCap: '100B' }
    ],
    consumer: [
      { symbol: 'AMZN', name: '亚马逊', marketCap: '1.7T' },
      { symbol: 'TSLA', name: '特斯拉', marketCap: '800B' },
      { symbol: 'HD', name: '家得宝', marketCap: '350B' },
      { symbol: 'COST', name: '好市多', marketCap: '300B' },
      { symbol: 'WMT', name: '沃尔玛', marketCap: '450B' },
      { symbol: 'PG', name: '宝洁', marketCap: '400B' },
      { symbol: 'KO', name: '可口可乐', marketCap: '270B' },
      { symbol: 'MCD', name: '麦当劳', marketCap: '200B' },
      { symbol: 'NKE', name: '耐克', marketCap: '140B' },
      { symbol: 'DIS', name: '迪士尼', marketCap: '200B' }
    ],
    energy: [
      { symbol: 'XOM', name: '埃克森美孚', marketCap: '450B' },
      { symbol: 'CVX', name: '雪佛龙', marketCap: '280B' },
      { symbol: 'COP', name: '康菲石油', marketCap: '130B' },
      { symbol: 'EOG', name: 'EOG资源', marketCap: '70B' },
      { symbol: 'SLB', name: '斯伦贝谢', marketCap: '70B' },
      { symbol: 'MPC', name: '马拉松石油', marketCap: '60B' },
      { symbol: 'VLO', name: '瓦莱罗能源', marketCap: '50B' },
      { symbol: 'OXY', name: '西方石油', marketCap: '55B' },
      { symbol: 'PSX', name: 'Phillips 66', marketCap: '45B' },
      { symbol: 'WMB', name: '威廉姆斯', marketCap: '50B' }
    ]
  }
};

/**
 * 扫描板块，获取龙头企业财报数据
 */
async function scanSector(sectorId, market = 'us', topN = 50) {
  console.log(`🔍 扫描 ${market.toUpperCase()} 市场 ${sectorId} 板块...\n`);
  
  const leaders = SECTOR_LEADERS[market]?.[sectorId];
  
  if (!leaders) {
    console.log(`⚠️ 暂不支持 ${market}/${sectorId} 板块扫描`);
    return null;
  }
  
  // 取前N家
  const targets = leaders.slice(0, topN);
  
  console.log(`📊 分析前 ${targets.length} 家龙头企业\n`);
  
  const results = [];
  
  // 并行获取实时行情数据
  for (const company of targets) {
    try {
      console.log(`  📈 获取 ${company.symbol} (${company.name})...`);
      
      // 优先获取实时行情（新浪财经支持）
      const quote = await getCompanyInfo(company.symbol, market);
      
      // 尝试获取财报数据（可能失败，但不影响）
      let earnings = null;
      try {
        earnings = await getCompanyEarnings(company.symbol, market);
      } catch (e) {
        // 忽略财报数据错误
      }
      
      results.push({
        ...company,
        quote: quote || null,
        earnings: earnings || null,
        hasData: !!(quote || earnings)
      });
    } catch (e) {
      console.log(`  ⚠️ ${company.symbol} 数据获取失败`);
      results.push({
        ...company,
        quote: null,
        earnings: null,
        hasData: false
      });
    }
  }
  
  return analyzeAndRecommend(results, sectorId, market);
}

/**
 * 分析并生成投资推荐
 */
function analyzeAndRecommend(companies, sectorId, market) {
  console.log('\n📊 数据分析中...\n');

  // 过滤出有数据的公司（实时行情或财报）
  const withData = companies.filter(c => c.hasData && (c.quote || c.earnings));

  if (withData.length === 0) {
    return {
      success: false,
      message: '暂无数据，请检查数据源配置',
      companies: companies.map(c => c.symbol)
    };
  }

  // 评分逻辑（基于实时行情 + 财报数据）
  const scored = withData.map(c => {
    const e = c.earnings;
    const q = c.quote;
    let score = 50; // 基础分50
    let reasons = [];

    // 有实时数据加分
    if (q && q.price) {
      score += 15;
      reasons.push('数据正常');

      // 计算涨跌幅
      const prevClose = q.prevClose || q.close;
      if (prevClose && q.price) {
        const change = q.change !== undefined ? q.change : (q.price - prevClose);
        const changePct = q.changePercent !== undefined ? q.changePercent : (change / prevClose * 100);
        const changeStr = changePct.toFixed(2);

        // 上涨但不过度
        if (change > 0 && change < 5) {
          score += 10;
          reasons.push(`上涨 ${changeStr}%`);
        } else if (change >= 5 && change < 10) {
          score += 15;
          reasons.push(`强势上涨 ${changeStr}%`);
        } else if (change >= 10) {
          score += 20;
          reasons.push(`大涨 ${changeStr}% 🔥`);
        } else if (change > -3 && change <= 0) {
          score += 5;
          reasons.push(`微跌 ${changeStr}%`);
        } else if (change <= -3) {
          score -= 5;
          reasons.push(`回调 ${changeStr}%`);
        }
      }

      // 成交量活跃（简单判断：有成交量数据）
      if (q.volume && q.volume > 0) {
        score += 5;
        reasons.push('成交活跃');
      }
    }

    // EPS超预期加分
    if (e && e.beatEPS) {
      score += 30;
      reasons.push('EPS超预期');
    }

    // 营收超预期加分
    if (e && e.beatRevenue) {
      score += 20;
      reasons.push('营收超预期');
    }

    // 正增长加分
    if (e && e.yoyGrowth && parseFloat(e.yoyGrowth) > 0) {
      score += 20;
      reasons.push(`同比${e.yoyGrowth}增长`);
    }

    // 盘后上涨加分
    if (e && e.afterHoursMove && e.afterHoursMove.includes('+')) {
      score += 15;
      reasons.push('盘后上涨');
    }

    // 大盘值加分（稳定性）
    const marketCap = parseMarketCap(c.marketCap);
    if (marketCap > 500) { // 500B+
      score += 15;
      reasons.push('大盘蓝筹');
    } else if (marketCap > 100) { // 100B+
      score += 10;
      reasons.push('中大盘');
    } else if (marketCap > 50) {
      score += 5;
      reasons.push('中大型');
    }

    return {
      ...c,
      score,
      reasons,
      recommendation: score >= 70 ? '强烈推荐' : score >= 55 ? '推荐' : score >= 40 ? '中性' : '谨慎'
    };
  });
  
  // 排序
  scored.sort((a, b) => b.score - a.score);
  
  // 生成报告
  return generateSectorReport(scored, sectorId, market);
}

function parseMarketCap(cap) {
  if (!cap) return 0;
  const value = parseFloat(cap);
  if (cap.includes('T')) return value * 1000; // 转换为B
  return value;
}

/**
 * 生成板块投资报告
 */
function generateSectorReport(companies, sectorId, market) {
  const sectorNames = {
    tech: '科技', finance: '金融', healthcare: '医疗健康',
    consumer: '消费', energy: '能源', industrial: '工业'
  };
  
  const marketEmojis = { us: '🇺🇸', hk: '🇭🇰', cn: '🇨🇳' };
  
  const lines = [
    `${marketEmojis[market] || '📈'} ${sectorNames[sectorId] || sectorId}板块投资分析报告`,
    `扫描企业数: ${companies.length} 家`,
    `数据时间: ${new Date().toLocaleDateString()}`,
    '',
    '═'.repeat(60),
    '🏆 强烈推荐 (评分 70+)',
    '═'.repeat(60),
    ''
  ];
  
  const strongBuy = companies.filter(c => c.score >= 70);
  const buy = companies.filter(c => c.score >= 50 && c.score < 70);
  const neutral = companies.filter(c => c.score >= 30 && c.score < 50);
  const caution = companies.filter(c => c.score < 30);
  
  // 强烈推荐
  if (strongBuy.length > 0) {
    strongBuy.slice(0, 5).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.symbol} - ${c.name}`);
      lines.push(`   市值: ${c.marketCap} | 评分: ${c.score}`);
      lines.push(`   亮点: ${c.reasons.join('、')}`);
      if (c.quote && c.quote.price) {
        const change = c.quote.change !== undefined ? c.quote.change : (c.quote.price - (c.quote.prevClose || c.quote.close || c.quote.price));
        const changePct = c.quote.changePercent !== undefined ? c.quote.changePercent : (change / (c.quote.prevClose || c.quote.close || c.quote.price) * 100);
        const changeEmoji = change >= 0 ? '🟢' : '🔴';
        lines.push(`   当前价: $${c.quote.price} ${changeEmoji} ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`);
      }
      lines.push('');
    });
  } else {
    lines.push('暂无强烈推荐标的\n');
  }

  // 推荐
  if (buy.length > 0) {
    lines.push('═'.repeat(60));
    lines.push('👍 推荐 (评分 50-69)');
    lines.push('═'.repeat(60));
    lines.push('');

    buy.slice(0, 5).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.symbol} - ${c.name} (评分: ${c.score})`);
      lines.push(`   理由: ${c.reasons.join('、')}`);
      if (c.quote && c.quote.price) {
        lines.push(`   当前价: $${c.quote.price}`);
      }
      lines.push('');
    });
  }
  
  // 统计
  lines.push('═'.repeat(60));
  lines.push('📊 统计汇总');
  lines.push('═'.repeat(60));
  lines.push(`强烈推荐: ${strongBuy.length} 家`);
  lines.push(`推荐: ${buy.length} 家`);
  lines.push(`中性: ${neutral.length} 家`);
  lines.push(`谨慎: ${caution.length} 家`);
  lines.push('');
  lines.push('💡 建议:');
  lines.push('• 优先考虑"强烈推荐"标的');
  lines.push('• 关注财报发布日期，逢低布局');
  lines.push('• 分散投资，控制仓位');
  lines.push('');
  lines.push('⚠️ 风险提示: 以上分析基于模拟数据，不构成投资建议');
  
  return {
    success: true,
    sector: sectorId,
    market,
    total: companies.length,
    strongBuy: strongBuy.length,
    buy: buy.length,
    formatted: lines.join('\n'),
    topPicks: strongBuy.slice(0, 5).map(c => ({
      symbol: c.symbol,
      name: c.name,
      score: c.score,
      reasons: c.reasons
    }))
  };
}

/**
 * 获取板块列表
 */
function getAvailableSectors(market = 'us') {
  const sectors = SECTOR_LEADERS[market];
  if (!sectors) return [];
  
  return Object.keys(sectors).map(id => ({
    id,
    name: { tech: '科技', finance: '金融', healthcare: '医疗健康', consumer: '消费', energy: '能源' }[id] || id,
    count: sectors[id].length
  }));
}

module.exports = {
  scanSector,
  getAvailableSectors,
  SECTOR_LEADERS
};
