# Dashboard de resultados trimestrais

Painel web com os resultados trimestrais de 18 empresas de tecnologia (12 dos EUA e 6 de Hong Kong): receita, lucros, margens, caixa, estimativas, reação do preço, valuation e calendário de divulgações. Os dados são coletados de fontes públicas, guardados num banco SQLite e servidos por um servidor Node sem framework.

Abas: **Resultados**, **Explorar** (histórico completo, gráfico de tendência com todas as empresas e, opcionalmente, perguntas em linguagem natural), **Calendário**, **Novidades de produtos** e **Comportamento de uso de produtos**.

## Início rápido

```bash
npm install
npm start                # http://localhost:3000
```

Requer **Node ≥ 22.13** (usa o `node:sqlite` embutido). Ao subir, o servidor cria o banco em `data/cache/earnings.db`, sincroniza as curadorias de `data/*.json` e, cinco segundos depois, faz a primeira coleta; depois repete a cada `REFRESH_HOURS`. A página mostra os dados da última coleta concluída.

O servidor escuta em `0.0.0.0` (acessível pela rede local). Se isso não for desejado, ponha um proxy na frente ou ajuste o `listen` em `server.js`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm start` | Servidor + atualização automática |
| `npm run refresh` | Uma coleta de dados, sem subir o servidor |
| `npm run backfill` | Carga histórica de ~5 anos de trimestres a partir do SEC EDGAR (empresas dos EUA). Opções: `-- --symbols NVDA,MSFT --years 6 --dry-run` |
| `npm run briefing -- NVDA` | Briefing pré-divulgação de uma empresa (só números do banco, sem IA; `--json`). Também na aba Calendário, clicando numa linha |
| `npm run backfill:reactions` | Grava a reação do preço a cada divulgação passada (Yahoo); o coletor passa a gravar a nova a cada divulgação |
| `npm run backfill:segments` | Receita por segmento/produto de ~5 anos a partir dos 10-Q/10-K do SEC (empresas dos EUA; lê o iXBRL de cada arquivamento, leva alguns minutos). Opções: `-- --symbols NVDA --years 5 --dry-run` |
| `npm run quality` | 19 regras de qualidade dos dados (`--strict` falha também nos avisos; `--json`) |
| `npm run ask -- "pergunta" --sql` | Pergunta em linguagem natural pela linha de comando (precisa de `ANTHROPIC_API_KEY`) |
| `node ontology/check.js` | Confere que a ontologia ainda bate com o banco |
| `node mcp/bench/security.js` | 40 ataques aos servidores MCP |

## Configuração

Variáveis de ambiente, ou um arquivo `.env` nesta pasta (fora do git):

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `REFRESH_HOURS` | `12` | Intervalo da coleta automática; `0` desliga |
| `FMP_API_KEY` | vazio | Chave do Financial Modeling Prep (plano gratuito: últimos 5 trimestres das empresas dos EUA). Sem ela, usa só Yahoo Finance |
| `SEC_USER_AGENT` | `earnings-tracker/1.0 (personal research tool)` | Identificação enviada ao SEC no `backfill` (a política deles pede nome e contato) |
| `DATA_DIR` / `DB_PATH` | `data/cache` / `<DATA_DIR>/earnings.db` | Onde fica o banco |
| `QUIET` | vazio | Silencia o log da coleta |
| `ENABLE_ASK` + `ANTHROPIC_API_KEY` | desligado | Liga a caixa "Pergunte aos dados" (ver abaixo) |
| `ASK_MODEL`, `ASK_EFFORT`, `ASK_PER_MIN` | `claude-opus-5-5`, `medium`, `10` | Modelo, esforço e limite de perguntas por minuto |

## Arquitetura

```
FMP ─┐
Yahoo ├─▶ pipeline/refresh.js ─▶ banco SQLite (data/cache/earnings.db) ─▶ server.js ─▶ public/ (navegador)
SEC ──┘   pipeline/backfill-sec.js        │  ▲                                │
                                          │  └── data/*.json (curadoria, sincronizada ao subir)
                                          ├──▶ views v_company / v_quarter / v_ttm / v_latest (USD, em bilhões)
                                          ├──▶ ontology/earnings.yaml (significado e armadilhas dos dados)
                                          ├──▶ pipeline/ask.js        pergunta em linguagem natural (Claude API)
                                          ├──▶ pipeline/quality.js    regras de qualidade
                                          └──▶ mcp/                   servidores MCP para agentes de IA
```

- **Fontes:** FMP (principal, EUA), Yahoo Finance (completa lacunas; única fonte de Hong Kong) e SEC EDGAR (histórico dos EUA, nunca sobrescreve as outras). O significado de cada uma e as divergências conhecidas (ex.: lucro operacional GAAP × ajustado) estão em [ontology/README.md](ontology/README.md).
- **Banco:** SQLite em modo WAL, com migrações por `PRAGMA user_version`. Tabelas: `reactions` (reação do preço por divulgação; ainda não exposta nas views, então fora do `ask` e dos MCPs), `companies`, `overrides`, `segments`, `news` (curadorias), `refresh_runs`, `earnings_snapshots`, `quarters`, `state` e `fmp_cache` (coletas). `segment_quarters` (receita por segmento e produto, do SEC). As cinco views `v_*` entregam tudo em bilhões de USD e são a interface de leitura para a ontologia, o `ask` e os MCPs.
- **Curadoria:** os JSONs em `data/` (`companies`, `overrides`, `segments`, `news`) continuam sendo a fonte versionada e são espelhados no banco a cada subida. `data/state.json` e `data/fmp-cache.json` são o estado da coleta anterior.
- **Servidor** (`server.js`): arquivos estáticos de `public/` e `/earnings.json`, `/meta.json`, `/news.json` lidos do banco (com recuo para os arquivos estáticos). Rotas: `GET /health`, `GET /api/history/:symbol`, `GET /api/briefing/:symbol?lang=pt|en`, `GET|POST /api/ask`.

## Funções opcionais

### Perguntas em linguagem natural (aba Explorar)
Desligada por padrão. Para ligar, ponha `ANTHROPIC_API_KEY` e `ENABLE_ASK=1` no `.env` e reinicie. O modelo lê a ontologia, escreve SQL sobre as views e responde mostrando as consultas usadas. O SQL passa por [pipeline/safe-sql.js](pipeline/safe-sql.js). **Atenção:** com o servidor em `0.0.0.0`, quem alcançar a porta gasta a sua chave (até `ASK_PER_MIN` perguntas por minuto). Detalhes em [ontology/README.md](ontology/README.md).

### Servidores MCP para agentes de IA
Dois servidores (tradicional e com execução de código) dão a um agente acesso de leitura aos dados, mais uma bateria que os compara com um LLM real. Ver [mcp/README.md](mcp/README.md) e a comparação em [mcp/docs/benchmark.md](mcp/docs/benchmark.md).

## Segurança

- **SQL escrito por terceiros** (modelo, agentes): só `SELECT`/`WITH`, banco somente leitura, só as views `v_*` (autorizador do SQLite), processo filho com limite de 5 s e no máximo 200 linhas. É compartilhado por `ask` e pelos MCPs: [pipeline/safe-sql.js](pipeline/safe-sql.js).
- **Código do agente** (MCP `code-exec`): sandbox em processo filho com permissões do Node, namespaces do Linux e limites de recursos. Riscos residuais em [mcp/docs/design.md](mcp/docs/design.md).
- O servidor web não tem autenticação nem HTTPS; é pensado para uso local ou numa rede confiável.

## Mapa dos documentos

| Documento | Conteúdo |
|---|---|
| [ontology/README.md](ontology/README.md) | Modelo de dados, fontes, convenções, casos de uso da ontologia, manutenção |
| [mcp/README.md](mcp/README.md) | Como rodar e testar os servidores MCP |
| [mcp/docs/design.md](mcp/docs/design.md) | Arquitetura dos MCPs, camadas de isolamento, riscos residuais |
| [mcp/docs/benchmark.md](mcp/docs/benchmark.md) | Comparação tradicional × code-exec, com método, limites e recomendação |
| [mcp/docs/implementation-log.md](mcp/docs/implementation-log.md) | Diário da implementação dos MCPs: decisões, falhas encontradas e correções |

## Limitações conhecidas

- Hong Kong (Tencent, Xiaomi, Meituan, etc.) tem poucos pontos de histórico: o Yahoo só fornece receita e lucro dos trimestres de junho.
- O lucro operacional diverge entre SEC (GAAP) e Yahoo (ajustado) em CRM, ORCL, INTU e SPCX.
- Trimestres vindos do SEC não têm EPS (os valores do XBRL não são ajustados por desdobramentos).
- O plano gratuito do FMP limita a 5 trimestres por consulta; o histórico mais longo vem do SEC.
