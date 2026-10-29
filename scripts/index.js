#!/usr/bin/env node
/**
 * AI Earnings Tracker - 主入口 (v2.1)
 * 支持多数据源配置
 */

require('./load-env');

const { 
  getMarkets, 
  getSectors, 
  getWeeklyPreview, 
  queryCompany, 
  generateSummary 
} = require('./core-v2');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'preview':
      case 'weekly':
        console.log('📊 正在获取下周财报日历...\n');
        const options = parsePreviewOptions(args.slice(1));
        const preview = await getWeeklyPreview(options);
        console.log(preview.formatted);
        break;

      case 'markets':
        console.log('🌍 支持的股市列表\n');
        const markets = getMarkets();
        markets.forEach(m => {
          const emoji = m.code === 'us' ? '🇺🇸' : m.code === 'hk' ? '🇭🇰' : '🇨🇳';
          console.log(`${emoji} ${m.name} (${m.code.toUpperCase()})`);
          console.log(`   时区: ${m.timezone} | 货币: ${m.currency}`);
          console.log();
        });
        break;

      case 'sectors':
        const marketArg = args[1];
        if (marketArg) {
          console.log(`📂 ${marketArg.toUpperCase()} 市场行业板块\n`);
          const sectors = getSectors(marketArg.toLowerCase());
          if (!sectors) {
            console.error(`❌ 未找到市场: ${marketArg}`);
            console.log('\n可用市场: us, hk, cn');
            process.exit(1);
          }
          sectors.forEach(s => {
            console.log(`• ${s.name} (${s.id})`);
            console.log(`  关键词: ${s.keywords.join('、')}`);
            console.log(`  公司数: ${s.companyCount}`);
            console.log();
          });
        } else {
          console.log('📂 所有行业板块\n');
          const config = require('./core-v2').config;
          const allSectors = new Map();
          
          Object.keys(config.markets).forEach(mCode => {
            const market = config.markets[mCode];
            market.sectors.forEach(sector => {
              if (!allSectors.has(sector.id)) {
                allSectors.set(sector.id, {
                  id: sector.id,
                  name: sector.name,
                  markets: []
                });
              }
              allSectors.get(sector.id).markets.push(mCode);
            });
          });
          
          Array.from(allSectors.values()).forEach(s => {
            const marketEmojis = s.markets.map(m => {
              if (m === 'us') return '🇺🇸';
              if (m === 'hk') return '🇭🇰';
              return '🇨🇳';
            }).join(' ');
            console.log(`• ${s.name}: ${marketEmojis}`);
          });
        }
        break;

      case 'sector':
        const sectorId = args[1];
        if (!sectorId) {
          console.error('❌ 请提供板块ID，例如: npm run sector tech');
          process.exit(1);
        }
        console.log(`📂 正在获取${sectorId}板块财报...\n`);
        const sectorPreview = await getWeeklyPreview({ sector: sectorId });
        console.log(sectorPreview.formatted);
        break;

      case 'query':
      case 'company':
        const symbol = args[1];
        const marketFilter = args[2];
        if (!symbol) {
          console.error('❌ 请提供股票代码，例如: npm run query NVDA');
          process.exit(1);
        }
        console.log(`🔍 查询 ${symbol.toUpperCase()}${marketFilter ? ` (${marketFilter.toUpperCase()})` : ''}...\n`);
        const result = await queryCompany(symbol, marketFilter);
        console.log(result.formatted);
        break;

      case 'summary':
      case 'report':
        const sumSymbol = args[1];
        const sumMarket = args[2];
        if (!sumSymbol) {
          console.error('❌ 请提供股票代码，例如: npm run summary NVDA');
          process.exit(1);
        }
        console.log(`📈 生成 ${sumSymbol.toUpperCase()} 财报摘要...\n`);
        const summary = await generateSummary(sumSymbol, sumMarket);
        console.log(summary.formatted);
        break;

      case 'data-source':
      case 'ds':
        // 转发到数据源管理脚本
        const dsArgs = args.slice(1);
        process.argv = ['node', 'data-source.js', ...dsArgs];
        require('./data-source').main();
        break;

      case 'scan':
      case 'sector-scan':
        // 板块扫描
        const scanArgs = args.slice(1);
        process.argv = ['node', 'sector.js', 'scan', ...scanArgs];
        require('./sector');
        break;

      case 'watchlist':
      case 'wl':
        // 关注列表管理
        const wlArgs = args.slice(1);
        process.argv = ['node', 'watchlist.js', ...wlArgs];
        require('./watchlist');
        break;

      case 'demo':
        const { runDemo } = require('./demo');
        await runDemo();
        break;

      case 'help':
      default:
        console.log(`
🦞 AI Earnings Tracker - 财报追踪器 v2.2
支持：美股 🇺🇸 | 港股 🇭🇰 | A股 🇨🇳 | 多数据源 | 板块扫描

📊 财报查询:
  preview [market] [sector]      获取下周财报预览
  markets                        列出支持的股市
  sectors [market]               列出行业板块
  query, company <symbol>        查询特定公司
  summary, report <symbol>       生成财报摘要

🔍 板块扫描 (新功能):
  scan <sector> [market] [topN]  扫描板块龙头企业并推荐
  sectors                        列出可扫描的板块

📋 关注列表:
  watchlist list                 查看关注列表
  watchlist add <symbol> <mkt>   添加股票到关注列表
  watchlist remove <symbol> <mkt> 从关注列表移除

⚙️ 数据源管理:
  data-source list               列出可用数据源
  data-source switch <id>        切换数据源
  data-source test               测试当前数据源

🔧 其他:
  demo                           运行演示
  help                           显示帮助

💡 快速开始:
  # 扫描美股科技板块前50家龙头企业
  node index.js scan tech us 50

  # 查看推荐结果
  node index.js scan tech

  # 查询特定股票
  node index.js query NVDA

  # 管理关注列表
  node index.js watchlist add INTC us "英特尔" tech 芯片

板块ID: tech(科技), finance(金融), healthcare(医疗健康),
        consumer(消费), energy(能源), industrial(工业)
        `);
    }
  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.message.includes('API Key')) {
      console.log('\n💡 提示: 配置 API Key 或切换到其他数据源');
      console.log('   node index.js data-source list');
      console.log('   node index.js data-source switch mock');
    }
    process.exit(1);
  }
}

function parsePreviewOptions(args) {
  const options = {};
  if (args.length > 0) options.market = args[0].toLowerCase();
  if (args.length > 1) options.sector = args[1].toLowerCase();
  return options;
}

// 如果直接运行
if (require.main === module) {
  main();
}

module.exports = { main };
