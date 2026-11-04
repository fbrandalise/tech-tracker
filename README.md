# Tech Tracker

**[Português](#tech-tracker) | [English](#english)**

Painel de resultados trimestrais de empresas de tecnologia, com uma base de dados consultável por pessoas **e por agentes de IA**.

Coleta balanços de fontes públicas, reconcilia as diferenças entre elas, guarda tudo num banco SQLite e expõe os dados de quatro formas: um **dashboard web**, **perguntas em linguagem natural**, **controle de qualidade automático** e **servidores MCP** (um tradicional e outro com execução de código, comparados por uma bateria de testes com um LLM real).

> Documentação em português; a tradução para o inglês está [no final deste arquivo](#english). Os documentos em `dashboard/` estão apenas em português.

## O que resolve

Acompanhar os resultados de uma dúzia de empresas parece simples até se olhar para os dados:

| Problema | Como o projeto resolve |
|---|---|
| Cada fonte diz uma coisa. FMP, Yahoo e SEC têm moedas, calendários fiscais e definições diferentes (o lucro operacional do Yahoo é *ajustado*, o do SEC é *GAAP*). | Prioridade explícita entre fontes, rastreio da origem de cada trimestre e uma **ontologia** que documenta o significado de cada coluna e as armadilhas conhecidas. |
| As APIs gratuitas mostram só ~5 trimestres. | **Carga histórica** de ~5 anos direto do SEC EDGAR (10-Q/10-K), que nunca sobrescreve as outras fontes. |
| Dados financeiros erram em silêncio (um ano inteiro gravado como trimestre, por exemplo). | **19 regras de qualidade** (identidades contábeis, duplicatas, margens impossíveis, saltos de receita). Já pegaram um erro real na Oracle. |
| Um LLM que escreve SQL pode errar o dicionário de dados, ou ser perigoso. | Ontologia no prompt + **execução segura** do SQL (só views, somente leitura, tempo e linhas limitados). |
| Como dar a um agente acesso aos dados: ferramentas MCP clássicas ou execução de código? | Os **dois servidores** implementados sobre as mesmas capacidades e um **benchmark** com um LLM real para comparar custo, contexto, tempo e acertos. |

## Visão geral

18 empresas (12 dos EUA e 6 de Hong Kong), com receita, lucros, margens, caixa, estimativas, reação do preço, valuation e calendário de divulgações.

Abas do dashboard: **Resultados**, **Explorar** (histórico completo, gráfico de tendência com todas as empresas e, opcionalmente, perguntas em linguagem natural), **Calendário**, **Novidades de produtos** e **Comportamento de uso de produtos**.

## Arquitetura

```
 FMP ─────┐
 Yahoo ───┼─▶ pipeline/refresh.js ─┐
 SEC ─────┘   pipeline/backfill-sec.js
                                   ▼
 data/*.json ──(curadoria, ao subir)──▶  SQLite (WAL)  data/cache/earnings.db
 (empresas, overrides,                    tabelas: companies, quarters, snapshots, ...
  segmentos, notícias)                    views:   v_company · v_quarter · v_ttm · v_latest
                                          (tudo em bilhões de USD, margens e variações prontas)
                                                   │
        ┌──────────────┬──────────────┬────────────┼───────────────┬───────────────────┐
        ▼              ▼              ▼            ▼               ▼                   ▼
    server.js     pipeline/       pipeline/    ontology/      pipeline/            mcp/
    + public/     ask.js          quality.js   earnings.yaml  safe-sql.js     ┌──────┴───────┐
    (dashboard)   (pergunta em    (19 regras)  (dicionário    (SQL seguro     traditional  code-exec
                  linguagem                     de dados)      compartilhado)  10 tools     2 tools +
                  natural)                                                                   sandbox
```

Princípio central: **as views `v_*` são a única interface de leitura**. A ontologia descreve as views, o `ask` e os MCPs só enxergam as views, e o autorizador do SQLite garante isso em vez de pedir por favor no prompt.

## Componentes

### 1. Coleta e armazenamento (`dashboard/pipeline/`)

- **`refresh.js`**: coleta periódica (padrão a cada 12 h) de FMP e Yahoo Finance, com conversão para USD e aplicação de ajustes manuais do release da empresa (`data/overrides.json`).
- **`backfill-sec.js`**: histórico de ~5 anos pelo SEC EDGAR (XBRL). Reconstrói trimestres a partir de valores acumulados, calcula o Q4 (ano − 9 meses) e filtra marcações incorretas.
- **`db.js`**: SQLite embutido do Node (`node:sqlite`), modo WAL, migrações por `PRAGMA user_version`, views em USD.
- Curadoria versionada em `dashboard/data/*.json`, espelhada no banco a cada subida.

### 2. Dashboard web (`dashboard/server.js`, `dashboard/public/`)

Servidor Node sem framework, front-end em JavaScript puro com d3 para o gráfico de tendência. Rotas: `/earnings.json`, `/meta.json`, `/news.json`, `/health`, `/api/history/:symbol`, `/api/ask`. Português/inglês, tema claro/escuro.

### 3. Ontologia (`dashboard/ontology/`)

`earnings.yaml` descreve convenções (unidades, datas fiscais, câmbio), fontes, entidades e colunas, 17 métricas (com sinônimos PT/EN), regras de interpretação e de SQL, anomalias conhecidas e 9 perguntas de exemplo com SQL. `check.js` falha se a ontologia ficar velha: exemplos que quebram, colunas inexistentes **ou colunas das views sem descrição**. Ver [ontology/README.md](dashboard/ontology/README.md).

### 4. Perguntas em linguagem natural (`pipeline/ask.js`)

Opcional, desligado por padrão. O modelo (API do Claude) recebe a ontologia, escreve SQL sobre as views, e a resposta mostra as consultas usadas para conferência.

### 5. SQL seguro (`pipeline/safe-sql.js`)

Compartilhado por `ask` e pelos MCPs. Quatro barreiras: só `SELECT`/`WITH` de uma instrução; banco aberto somente leitura; autorizador do SQLite que só permite as views `v_*` (nega CTE recursiva, `PRAGMA`, `ATTACH`); execução em processo filho com limite de 5 s (SIGKILL) e no máximo 200 linhas.

### 6. Controle de qualidade (`pipeline/quality.js`)

`npm run quality` roda 19 regras (erro/aviso) sobre o banco. Saída em texto ou `--json`; `--strict` falha também nos avisos, para uso em CI.

### 7. Servidores MCP (`dashboard/mcp/`)

Dois servidores com as **mesmas dez capacidades** (listar empresas, snapshot, ranking, histórico, TTM, próximas divulgações, ontologia, qualidade, SQL livre), gerados do mesmo registro (`lib/tools.js`), para que a comparação meça a *forma* de expor e não o *que* se expõe.

| | Tradicional | Code execution |
|---|---|---|
| Ferramentas anunciadas | 10 | 2 (`search_tools`, `execute_code`) |
| Quem encadeia as chamadas | O modelo, uma por turno | O código que o modelo escreve, num turno |
| Dados intermediários | No contexto do modelo | No sandbox |
| Isolamento | Banco somente leitura | Sandbox: `node --permission` + namespaces Linux (sem rede, sem ver outros processos) + limites de memória, tempo e saída |

O segundo segue o padrão de [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp): ferramentas como módulos importáveis, descoberta progressiva e filtragem dos dados dentro do sandbox. Uma bateria de **40 ataques** ao sandbox e ao SQL (0 em aberto) acompanha o projeto.

### 8. Benchmark (`dashboard/mcp/bench/`)

Um LLM real (Qwen3.6-35B-A3B quantizado, rodando num `llama-server` local) dirige cada servidor em 10 tarefas, com verdade calculada por SQL independente e corretor automático, em três configurações. Resumo:

| Configuração | Acertos (trad. × code-exec) | Tokens de entrada | Quem foi melhor |
|---|---|---:|---|
| Com `run_sql` | 18/20 × 16/20 | 8,4 mil × 16,9 mil | Tradicional (custo, passos, tempo) |
| Sem `run_sql` | 12/20 × 17/20 | 40,3 mil × 11,8 mil | Code exec (em tudo) |
| Com `run_sql` + raciocínio | 18/20 × 16/20 | 7,3 mil × 14,3 mil | Tradicional (custo e passos) |

Leitura honesta: code execution compensa quando o servidor tradicional teria de fazer laços turno a turno; uma ferramenta de SQL livre captura quase todo esse benefício sem precisar de sandbox. As diferenças de acertos não são estatisticamente significativas (amostra pequena, um modelo local). Método, limites e recomendação em [mcp/docs/benchmark.md](dashboard/mcp/docs/benchmark.md).

### 9. CLI legado (`scripts/`, `SKILL.md`)

Herdado do projeto original: um calendário de divulgações no terminal para mercados EUA, Hong Kong e A-shares, empacotado como skill de agente. Funciona de forma independente do dashboard (`node scripts/index.js preview`) e usa `.config/watchlist.json`.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js ≥ 22.13 (sem framework, sem build) |
| Banco | SQLite via `node:sqlite` (WAL, views, `setAuthorizer`) |
| Fontes de dados | Financial Modeling Prep, Yahoo Finance (`yahoo-finance2`), SEC EDGAR (XBRL) |
| Front-end | HTML/CSS/JS puro, d3 |
| IA | API do Claude (`@anthropic-ai/sdk`) para perguntas em linguagem natural |
| Agentes | MCP (`@modelcontextprotocol/sdk`, stdio) com zod |
| Isolamento | `node --permission`, namespaces Linux (`unshare`) |
| Testes | Ontologia (`check.js`), qualidade dos dados, 40 ataques de segurança, benchmark com LLM local (`llama-server`) |

## Clonar e rodar localmente

Requisitos: **Node.js ≥ 22.13** e git. Linux para o isolamento completo do sandbox do MCP `code-exec` (sem `unshare`, ele cai para um modo mais fraco).

```bash
git clone https://github.com/fbrandalise/tech-tracker.git
cd tech-tracker/dashboard
npm install
npm start                      # http://localhost:3000
```

Ao subir, o servidor cria o banco em `dashboard/data/cache/earnings.db` e, cinco segundos depois, faz a primeira coleta. A página mostra os dados da última coleta concluída.

Para ter o **histórico de ~5 anos** das empresas dos EUA (as APIs gratuitas trazem só 5 trimestres), rode uma vez:

```bash
npm run backfill               # opções: -- --symbols NVDA,MSFT --years 6 --dry-run
npm run quality                # confere os dados carregados
```

### Configuração (opcional)

Crie `dashboard/.env` (fora do git) ou use variáveis de ambiente:

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `REFRESH_HOURS` | `12` | Intervalo da coleta automática; `0` desliga |
| `FMP_API_KEY` | vazio | Chave do [Financial Modeling Prep](https://financialmodelingprep.com/developer) (plano gratuito basta). Sem ela, só Yahoo |
| `SEC_USER_AGENT` | genérico | Identificação (nome e contato) enviada ao SEC no backfill, como a política deles pede |
| `ENABLE_ASK` + `ANTHROPIC_API_KEY` | desligado | Liga a caixa "Pergunte aos dados" na aba Explorar |

> O servidor escuta em `0.0.0.0` e não tem autenticação nem HTTPS. Use em rede confiável ou atrás de um proxy. Com `ENABLE_ASK=1`, quem alcança a porta gasta a sua chave de API.

### Comandos

| Comando (em `dashboard/`) | O que faz |
|---|---|
| `npm start` | Servidor + atualização automática |
| `npm run refresh` | Uma coleta, sem subir o servidor |
| `npm run backfill` | Carga histórica pelo SEC |
| `npm run quality` | Regras de qualidade dos dados |
| `npm run ask -- "pergunta" --sql` | Pergunta em linguagem natural pelo terminal |
| `node ontology/check.js` | Confere a ontologia contra o banco |
| `node mcp/bench/security.js` | 40 ataques aos servidores MCP |

### Usar os servidores MCP com um agente

Depois da primeira coleta (precisam do banco), registre-os no Claude Code com um `.mcp.json` na raiz do repositório:

```json
{
  "mcpServers": {
    "earnings-traditional": { "command": "node", "args": ["dashboard/mcp/traditional/server.js"] },
    "earnings-code-exec":   { "command": "node", "args": ["dashboard/mcp/code-exec/server.js"] }
  }
}
```

Para repetir o benchmark é preciso um `llama-server` (ou outra API compatível com OpenAI) em `http://127.0.0.1:8080`; ver [mcp/README.md](dashboard/mcp/README.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [dashboard/README.md](dashboard/README.md) | Operação do dashboard: comandos, configuração, segurança |
| [dashboard/ontology/README.md](dashboard/ontology/README.md) | Modelo de dados, fontes, convenções, casos de uso, manutenção |
| [dashboard/mcp/README.md](dashboard/mcp/README.md) | Como rodar e testar os servidores MCP |
| [dashboard/mcp/docs/design.md](dashboard/mcp/docs/design.md) | Arquitetura dos MCPs, camadas de isolamento, riscos residuais |
| [dashboard/mcp/docs/benchmark.md](dashboard/mcp/docs/benchmark.md) | Comparação tradicional × code-exec |
| [dashboard/mcp/docs/implementation-log.md](dashboard/mcp/docs/implementation-log.md) | Diário da implementação: decisões, falhas e correções |

## Limitações conhecidas

- Hong Kong tem poucos pontos de histórico: o Yahoo só fornece receita e lucro dos trimestres de junho.
- O lucro operacional diverge entre SEC (GAAP) e Yahoo (ajustado) em algumas empresas; sempre informe a fonte ao citá-lo.
- Trimestres vindos do SEC não têm EPS (o XBRL não é ajustado por desdobramentos).
- O sandbox do `code-exec` não é barreira contra um kernel vulnerável; para dados sensíveis, rode num contêiner (riscos residuais em [design.md](dashboard/mcp/docs/design.md)).
- O benchmark vale para um modelo local quantizado e uma base pequena.
- Os dados não são recomendação de investimento.

## Licença

MIT. Ver [LICENSE](LICENSE).

---

<a name="english"></a>
# Tech Tracker (English)

A quarterly-earnings dashboard for tech companies, backed by a database that both people **and AI agents** can query.

It collects financial statements from public sources, reconciles the differences between them, stores everything in SQLite, and exposes the data four ways: a **web dashboard**, **natural-language questions**, **automated data-quality checks**, and **MCP servers** (a traditional one and a code-execution one, compared by a benchmark run with a real LLM).

> Documentation is in Portuguese; this section is the English translation of this README. The documents under `dashboard/` are Portuguese only.

## The problem it solves

Following the earnings of a dozen companies looks easy until you look at the data:

| Problem | How the project handles it |
|---|---|
| Every source says something different. FMP, Yahoo and the SEC differ in currency, fiscal calendar and definitions (Yahoo's operating income is *adjusted*, the SEC's is *GAAP*). | Explicit source priority, per-quarter source tracking, and an **ontology** that documents every column and the known pitfalls. |
| Free APIs only show ~5 quarters. | **Historical backfill** of ~5 years straight from SEC EDGAR (10-Q/10-K), which never overwrites the other sources. |
| Financial data fails silently (e.g. a full year stored as a quarter). | **19 quality rules** (accounting identities, duplicates, impossible margins, revenue spikes). They already caught a real Oracle error. |
| An LLM writing SQL can get the data dictionary wrong, or be dangerous. | Ontology in the prompt + **safe SQL execution** (views only, read-only, time and row limits). |
| How to give an agent access to the data: classic MCP tools or code execution? | **Both servers** built on the same capabilities, plus a **benchmark** with a real LLM comparing cost, context, time and accuracy. |

## Overview

18 companies (12 US, 6 Hong Kong), with revenue, profits, margins, cash, estimates, price reaction, valuation and earnings calendar.

Dashboard tabs: **Results**, **Explore** (full history, a trend chart with all companies and, optionally, natural-language questions), **Calendar**, **Product news** and **Product usage behavior**.

## Architecture

```
 FMP ─────┐
 Yahoo ───┼─▶ pipeline/refresh.js ─┐
 SEC ─────┘   pipeline/backfill-sec.js
                                   ▼
 data/*.json ──(curation, at start)─▶  SQLite (WAL)  data/cache/earnings.db
 (companies, overrides,                tables: companies, quarters, snapshots, ...
  segments, news)                      views:  v_company · v_quarter · v_ttm · v_latest
                                       (all in USD billions, margins and changes precomputed)
                                                   │
        ┌──────────────┬──────────────┬────────────┼───────────────┬───────────────────┐
        ▼              ▼              ▼            ▼               ▼                   ▼
    server.js     pipeline/       pipeline/    ontology/      pipeline/            mcp/
    + public/     ask.js          quality.js   earnings.yaml  safe-sql.js     ┌──────┴───────┐
    (dashboard)   (natural-       (19 rules)   (data          (shared safe    traditional  code-exec
                  language Q&A)                 dictionary)    SQL)            10 tools     2 tools +
                                                                                             sandbox
```

Core principle: **the `v_*` views are the only read interface**. The ontology describes the views, `ask` and the MCP servers only see the views, and the SQLite authorizer enforces it instead of asking nicely in the prompt.

## Components

### 1. Collection and storage (`dashboard/pipeline/`)

- **`refresh.js`**: periodic collection (default every 12 h) from FMP and Yahoo Finance, converting to USD and applying manual adjustments from company releases (`data/overrides.json`).
- **`backfill-sec.js`**: ~5 years of history from SEC EDGAR (XBRL). Rebuilds quarters from cumulative values, computes Q4 (year − 9 months) and filters out mis-tagged facts.
- **`db.js`**: Node's built-in SQLite (`node:sqlite`), WAL mode, migrations via `PRAGMA user_version`, USD views.
- Versioned curation in `dashboard/data/*.json`, mirrored into the database on every start.

### 2. Web dashboard (`dashboard/server.js`, `dashboard/public/`)

Framework-free Node server, plain JavaScript front end with d3 for the trend chart. Routes: `/earnings.json`, `/meta.json`, `/news.json`, `/health`, `/api/history/:symbol`, `/api/ask`. Portuguese/English, light/dark theme.

### 3. Ontology (`dashboard/ontology/`)

`earnings.yaml` describes conventions (units, fiscal dates, FX), sources, entities and columns, 17 metrics (with PT/EN synonyms), interpretation and SQL rules, known anomalies and 9 example questions with SQL. `check.js` fails when the ontology goes stale: broken examples, nonexistent columns, **or view columns with no description**. See [ontology/README.md](dashboard/ontology/README.md).

### 4. Natural-language questions (`pipeline/ask.js`)

Optional, off by default. The model (Claude API) receives the ontology, writes SQL over the views, and the answer shows the queries used so you can check them.

### 5. Safe SQL (`pipeline/safe-sql.js`)

Shared by `ask` and the MCP servers. Four barriers: a single `SELECT`/`WITH` statement only; database opened read-only; a SQLite authorizer that only allows the `v_*` views (denies recursive CTEs, `PRAGMA`, `ATTACH`); execution in a child process with a 5 s limit (SIGKILL) and at most 200 rows.

### 6. Quality control (`pipeline/quality.js`)

`npm run quality` runs 19 rules (error/warning) against the database. Text or `--json` output; `--strict` also fails on warnings, for CI use.

### 7. MCP servers (`dashboard/mcp/`)

Two servers with the **same ten capabilities** (list companies, snapshot, ranking, history, TTM, upcoming earnings, ontology, quality, free SQL), generated from one registry (`lib/tools.js`), so the comparison measures the *way of exposing* rather than *what is exposed*.

| | Traditional | Code execution |
|---|---|---|
| Advertised tools | 10 | 2 (`search_tools`, `execute_code`) |
| Who chains the calls | The model, one per turn | The code the model writes, in one turn |
| Intermediate data | In the model's context | In the sandbox |
| Isolation | Read-only database | Sandbox: `node --permission` + Linux namespaces (no network, can't see other processes) + memory, time and output limits |

The second follows the pattern in [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp): tools as importable modules, progressive discovery and filtering data inside the sandbox. A battery of **40 attacks** on the sandbox and the SQL layer (0 open) ships with the project.

### 8. Benchmark (`dashboard/mcp/bench/`)

A real LLM (quantized Qwen3.6-35B-A3B on a local `llama-server`) drives each server through 10 tasks, with ground truth computed by independent SQL and an automatic grader, in three configurations. Summary:

| Configuration | Correct (trad. × code-exec) | Input tokens | Better one |
|---|---|---:|---|
| With `run_sql` | 18/20 × 16/20 | 8.4k × 16.9k | Traditional (cost, steps, time) |
| Without `run_sql` | 12/20 × 17/20 | 40.3k × 11.8k | Code exec (on everything) |
| With `run_sql` + reasoning | 18/20 × 16/20 | 7.3k × 14.3k | Traditional (cost and steps) |

Honest reading: code execution pays off when the traditional server would need turn-by-turn loops; a free-SQL tool captures nearly all of that benefit with no sandbox. Accuracy differences are not statistically significant (small sample, one local model). Method, limits and recommendation in [mcp/docs/benchmark.md](dashboard/mcp/docs/benchmark.md) (Portuguese).

### 9. Legacy CLI (`scripts/`, `SKILL.md`)

Inherited from the original project: a terminal earnings calendar for the US, Hong Kong and A-share markets, packaged as an agent skill. It works independently of the dashboard (`node scripts/index.js preview`) and uses `.config/watchlist.json`.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 22.13 (no framework, no build step) |
| Database | SQLite via `node:sqlite` (WAL, views, `setAuthorizer`) |
| Data sources | Financial Modeling Prep, Yahoo Finance (`yahoo-finance2`), SEC EDGAR (XBRL) |
| Front end | Plain HTML/CSS/JS, d3 |
| AI | Claude API (`@anthropic-ai/sdk`) for natural-language questions |
| Agents | MCP (`@modelcontextprotocol/sdk`, stdio) with zod |
| Isolation | `node --permission`, Linux namespaces (`unshare`) |
| Tests | Ontology (`check.js`), data quality, 40 security attacks, benchmark with a local LLM (`llama-server`) |

## Clone and run locally

Requirements: **Node.js ≥ 22.13** and git. Linux for the full `code-exec` MCP sandbox isolation (without `unshare` it falls back to a weaker mode).

```bash
git clone https://github.com/fbrandalise/tech-tracker.git
cd tech-tracker/dashboard
npm install
npm start                      # http://localhost:3000
```

On start, the server creates the database at `dashboard/data/cache/earnings.db` and runs the first collection five seconds later. The page shows data from the last completed collection.

To get the **~5-year history** for US companies (free APIs only return 5 quarters), run once:

```bash
npm run backfill               # options: -- --symbols NVDA,MSFT --years 6 --dry-run
npm run quality                # check the loaded data
```

### Configuration (optional)

Create `dashboard/.env` (kept out of git) or use environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Server port |
| `REFRESH_HOURS` | `12` | Automatic collection interval; `0` disables it |
| `FMP_API_KEY` | empty | [Financial Modeling Prep](https://financialmodelingprep.com/developer) key (the free plan is enough). Without it, Yahoo only |
| `SEC_USER_AGENT` | generic | Identification (name and contact) sent to the SEC during backfill, as their policy requires |
| `ENABLE_ASK` + `ANTHROPIC_API_KEY` | off | Turns on the "Ask the data" box in the Explore tab |

> The server listens on `0.0.0.0` and has no authentication or HTTPS. Use it on a trusted network or behind a proxy. With `ENABLE_ASK=1`, anyone who can reach the port spends your API key. See [SECURITY.md](SECURITY.md).

### Commands

| Command (in `dashboard/`) | What it does |
|---|---|
| `npm start` | Server + automatic refresh |
| `npm run refresh` | One collection, without starting the server |
| `npm run backfill` | Historical load from the SEC |
| `npm run quality` | Data-quality rules |
| `npm run ask -- "question" --sql` | Natural-language question from the terminal |
| `node ontology/check.js` | Check the ontology against the database |
| `node mcp/bench/security.js` | 40 attacks on the MCP servers |

### Using the MCP servers with an agent

After the first collection (they need the database), register them in Claude Code with a `.mcp.json` at the repository root:

```json
{
  "mcpServers": {
    "earnings-traditional": { "command": "node", "args": ["dashboard/mcp/traditional/server.js"] },
    "earnings-code-exec":   { "command": "node", "args": ["dashboard/mcp/code-exec/server.js"] }
  }
}
```

To repeat the benchmark you need a `llama-server` (or another OpenAI-compatible API) at `http://127.0.0.1:8080`; see [mcp/README.md](dashboard/mcp/README.md).

## Documentation (Portuguese)

| Document | Contents |
|---|---|
| [dashboard/README.md](dashboard/README.md) | Operating the dashboard: commands, configuration, security |
| [dashboard/ontology/README.md](dashboard/ontology/README.md) | Data model, sources, conventions, use cases, maintenance |
| [dashboard/mcp/README.md](dashboard/mcp/README.md) | How to run and test the MCP servers |
| [dashboard/mcp/docs/design.md](dashboard/mcp/docs/design.md) | MCP architecture, isolation layers, residual risks |
| [dashboard/mcp/docs/benchmark.md](dashboard/mcp/docs/benchmark.md) | Traditional × code-exec comparison |
| [dashboard/mcp/docs/implementation-log.md](dashboard/mcp/docs/implementation-log.md) | Implementation diary: decisions, failures and fixes |

## Known limitations

- Hong Kong has few history points: Yahoo only provides revenue and profit for the June quarters.
- Operating income differs between the SEC (GAAP) and Yahoo (adjusted) for some companies; always state the source when citing it.
- Quarters coming from the SEC have no EPS (XBRL is not split-adjusted).
- The `code-exec` sandbox is not a barrier against a vulnerable kernel; for sensitive data, run it in a container (residual risks in [design.md](dashboard/mcp/docs/design.md)).
- The benchmark applies to one quantized local model and a small dataset.
- The data is not investment advice.

## License

MIT. See [LICENSE](LICENSE).
