# Earnings Tracker - AI财报追踪器

> AI-powered earnings calendar tracker for US, HK, and CN markets with sector filtering.
> 自动追踪美股、港股、A股三大市场财报，支持行业板块筛选的AI财报追踪器。

**[English](#english) | [中文](#中文)**

---

<a name="english"></a>
## English

### What is this?

Earnings Tracker is an AI-powered tool that automatically monitors earnings announcements across three major stock markets (US, Hong Kong, and China A-shares) with intelligent sector filtering.

### Features

- 🌍 **Three Markets**: US stocks 🇺🇸 | Hong Kong stocks 🇭🇰 | China A-shares 🇨🇳
- 🏷️ **Sector Filtering**: 9 major sectors including Tech, Finance, Consumer, Healthcare
- 🤖 **AI Summary**: Auto-generates structured earnings reports with key metrics
- 📊 **Multi-Data Source**: Support for Mock, FMP, Alpha Vantage, Yahoo Finance, Polygon.io, Web Search
- 📱 **Notifications**: Push to Feishu/Lark for mobile access
- 💱 **Multi-Currency**: USD / HKD / CNY with proper timezone handling

### Data Sources

| Provider | API Key Required | Free Tier | Quality | Recommendation |
|----------|-----------------|-----------|---------|----------------|
| **Mock** | ❌ No | Unlimited | ⭐⭐ | Demo/Testing |
| **FMP** | ✅ Yes | 250/day | ⭐⭐⭐⭐⭐ | **Recommended** |
| **Alpha Vantage** | ✅ Yes | 500/day | ⭐⭐⭐⭐ | Good |
| **Yahoo Finance** | ❌ No | Unlimited | ⭐⭐⭐ | Free but unstable |
| **Polygon** | ✅ Yes | 5/min | ⭐⭐⭐⭐⭐ | Professional |
| **Web Search** | ❌ No | Unlimited | ⭐⭐ | Fallback |

### Prerequisites

- [ ] Node.js 18+ installed (`node --version`)
- [ ] OpenClaw or compatible agent framework
- [ ] (Optional) API Key for real data sources
  - Copy `.env.example` to `.env` and fill in `ALPHA_VANTAGE_API_KEY` / `POLYGON_API_KEY`

### Installation

```bash
# Install via skills CLI
npx skills add <your-github>/earnings-tracker

# Or clone manually
git clone https://github.com/<your-github>/earnings-tracker.git
cd earnings-tracker

# Install optional dependencies (for Yahoo Finance)
npm install yahoo-finance2
```

### Quick Start

```bash
# 1. View available data sources
node scripts/index.js data-source list

# 2. Test current data source
node scripts/index.js data-source test

# 3. Get earnings preview (using mock data by default)
node scripts/index.js preview

# 4. Switch to real data source (after configuring API key)
node scripts/index.js data-source switch fmp
```

### Configure Real Data Source

#### Option 1: Financial Modeling Prep (Recommended)

1. Register at https://financialmodelingprep.com/developer
2. Get your free API key (250 calls/day)
3. Edit `.config/watchlist.json`:

```json
{
  "dataSource": {
    "provider": "financialModelingPrep",
    "options": {
      "financialModelingPrep": {
        "enabled": true,
        "apiKey": "YOUR_ACTUAL_API_KEY_HERE"
      }
    }
  }
}
```

4. Switch to FMP:
```bash
node scripts/index.js data-source switch fmp
```

#### Option 2: Yahoo Finance (Free, No API Key)

```bash
# Install dependency
npm install yahoo-finance2

# Switch to Yahoo Finance
node scripts/index.js data-source switch yahooFinance
```

### Usage Examples

**Get next week's earnings calendar:**
```bash
node scripts/index.js preview
```

**Filter by market:**
```bash
node scripts/index.js preview us
```

**Filter by sector:**
```bash
node scripts/index.js preview us tech
node scripts/index.js sector tech
```

**Query specific company:**
```bash
node scripts/index.js query NVDA
node scripts/index.js query 00700.HK
node scripts/index.js query 600519 cn
```

**Generate earnings summary:**
```bash
node scripts/index.js summary NVDA
```

**Manage data sources:**
```bash
node scripts/index.js data-source list
node scripts/index.js data-source switch fmp
node scripts/index.js data-source test
node scripts/index.js data-source current
```

### Supported Markets & Sectors

See full documentation in [SKILL.md](SKILL.md)

### Troubleshooting

| Problem | Solution |
|---------|----------|
| "API Key not configured" | Get free API key from FMP or switch to mock/yahooFinance |
| "Data source connection failed" | Check internet connection and API key validity |
| "Stock not found" | Check symbol format (HK: .HK suffix, CN: 6 digits) |

---

<a name="中文"></a>
## 中文

### 这是什么？

AI财报追踪器是一个智能工具，自动监控美股、港股、A股三大市场的财报发布，支持按行业板块筛选和多数据源配置。

### 功能特性

- 🌍 **三大市场**：美股 🇺🇸 | 港股 🇭🇰 | A股 🇨🇳
- 🏷️ **板块筛选**：科技、金融、消费、医疗等9大行业
- 🤖 **AI摘要**：自动生成结构化财报报告
- 📊 **多数据源**：支持模拟数据、FMP、Alpha Vantage、Yahoo Finance等
- 📱 **消息推送**：飞书/钉钉移动端直达
- 💱 **多货币**：USD / HKD / CNY，自动处理时区

### 数据源对比

| 提供商 | 需要API Key | 免费额度 | 数据质量 | 推荐度 |
|--------|------------|----------|----------|--------|
| **模拟数据** | ❌ 不需要 | 无限制 | ⭐⭐ | 演示/测试 |
| **FMP** | ✅ 需要 | 250次/天 | ⭐⭐⭐⭐⭐ | **强烈推荐** |
| **Alpha Vantage** | ✅ 需要 | 500次/天 | ⭐⭐⭐⭐ | 良好 |
| **Yahoo Finance** | ❌ 不需要 | 无限制 | ⭐⭐⭐ | 免费但不稳定 |
| **Polygon** | ✅ 需要 | 5次/分钟 | ⭐⭐⭐⭐⭐ | 专业级 |
| **Web Search** | ❌ 不需要 | 无限制 | ⭐⭐ | 备选方案 |

### 前置条件

- [ ] 已安装 Node.js 18+ (`node --version`)
- [ ] OpenClaw 或兼容的 Agent 框架
- [ ] （可选）真实数据源的 API Key

### 安装

```bash
# 通过 skills CLI 安装
npx skills add <your-github>/earnings-tracker

# 或手动克隆
git clone https://github.com/<your-github>/earnings-tracker.git
cd earnings-tracker

# 安装可选依赖（用于 Yahoo Finance）
npm install yahoo-finance2
```

### 快速开始

```bash
# 1. 查看可用的数据源
node scripts/index.js data-source list

# 2. 测试当前数据源
node scripts/index.js data-source test

# 3. 获取财报预览（默认使用模拟数据）
node scripts/index.js preview

# 4. 切换到真实数据源（配置 API Key 后）
node scripts/index.js data-source switch fmp
```

### 配置真实数据源

#### 方案一：Financial Modeling Prep（推荐）

1. 访问 https://financialmodelingprep.com/developer 注册
2. 获取免费 API Key（250次/天）
3. 编辑 `.config/watchlist.json`：

```json
{
  "dataSource": {
    "provider": "financialModelingPrep",
    "options": {
      "financialModelingPrep": {
        "enabled": true,
        "apiKey": "你的实际API密钥"
      }
    }
  }
}
```

4. 切换到 FMP：
```bash
node scripts/index.js data-source switch fmp
```

#### 方案二：Yahoo Finance（免费，无需 API Key）

```bash
# 安装依赖
npm install yahoo-finance2

# 切换到 Yahoo Finance
node scripts/index.js data-source switch yahooFinance
```

### 使用示例

**获取下周财报日历：**
```bash
node scripts/index.js preview
```

**按市场筛选：**
```bash
node scripts/index.js preview us
```

**按板块筛选：**
```bash
node scripts/index.js preview us tech
node scripts/index.js sector tech
```

**查询特定公司：**
```bash
node scripts/index.js query NVDA
node scripts/index.js query 00700.HK
node scripts/index.js query 600519 cn
```

**生成财报摘要：**
```bash
node scripts/index.js summary NVDA
```

**管理数据源：**
```bash
node scripts/index.js data-source list      # 列出数据源
node scripts/index.js data-source switch fmp # 切换数据源
node scripts/index.js data-source test      # 测试连接
node scripts/index.js data-source current   # 查看当前
```

### 故障排除

| 问题 | 解决方法 |
|------|----------|
| "API Key 未配置" | 从 FMP 获取免费 API Key，或切换到 mock/yahooFinance |
| "数据源连接失败" | 检查网络连接和 API Key 有效性 |
| "找不到股票" | 检查代码格式（港股加.HK后缀，A股6位数字） |

---

## License

MIT License - see [LICENSE](LICENSE) file

## Credits

- Built for [OpenClaw](https://openclaw.ai/) agent framework
- Inspired by the AI Earnings Tracker use case from [awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases)
