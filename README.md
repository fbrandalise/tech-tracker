# Tech Tracker

Painel de resultados trimestrais de empresas de tecnologia, com uma base de dados consultável por pessoas **e por agentes de IA**.

Coleta balanços de fontes públicas, reconcilia as diferenças entre elas, guarda tudo num banco SQLite e expõe os dados de quatro formas: um **dashboard web**, **perguntas em linguagem natural**, **controle de qualidade automático** e **servidores MCP** (um tradicional e outro com execução de código, comparados por uma bateria de testes com um LLM real).

> Documentação em português. Código e identificadores em inglês/português, como no restante do projeto.

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
