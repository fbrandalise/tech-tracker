# Diário de implementação — MCPs de dados

Registro cronológico do que foi decidido, construído e descoberto. O desenho final está em [design.md](design.md) e os resultados da comparação em [benchmark.md](benchmark.md).

## 1. Ponto de partida

- Pedido: dois servidores MCP sobre os dados do dashboard — um "tradicional" e outro no padrão de [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp) — e uma bateria de testes comparando as soluções.
- O artigo propõe: ferramentas apresentadas como **módulos de código num diretório** (`servers/<servidor>/<ferramenta>.ts`); descoberta sob demanda (`search_tools` com níveis de detalhe: nome, descrição, esquema completo); o modelo escreve código que roda num **sandbox**, e os dados grandes são filtrados lá dentro, sem passar pelo contexto; **workspace** para guardar resultados intermediários e **skills** (código reutilizável salvo). Os autores avisam que o sandbox exige limites de recursos e monitoramento.
- Ambiente: Node 26.4, `@modelcontextprotocol/sdk` 1.32.2, zod 4. **Não há `ANTHROPIC_API_KEY`**, então não dá para pôr um modelo real escolhendo ferramentas. Consequência para a comparação: ver "Limites da comparação" em [benchmark.md](benchmark.md).

## 2. Decisões iniciais

| Decisão | Motivo |
|---|---|
| Um registro único de ferramentas (`lib/tools.js`) gera os dois servidores | Garante que ambos expõem exatamente as mesmas capacidades; a comparação mede a forma de expor, não o que se expõe |
| Banco aberto somente leitura nos dois | Mesma barreira de segurança da função "Pergunte aos dados" |
| Parâmetros descritos num formato simples, convertidos para zod e JSON Schema | O servidor tradicional precisa de zod; o code-exec precisa de JSON Schema para gerar a documentação dos módulos |
| 10 ferramentas, algumas "largas" (`list_latest`, `get_quarters` com 29 colunas) e outras estreitas (`rank_companies`) | Um conjunto realista: o tradicional ganha onde há ferramenta sob medida e perde onde precisa de laço ou de dados volumosos |
| Ferramentas aceitam `columns` | Dá ao baseline tradicional uma chance justa de reduzir o tamanho dos resultados |

## 3. Camada de dados e registro de ferramentas — feito

- `lib/tools.js`: 10 ferramentas (`list_companies`, `get_company_snapshot`, `list_latest`, `rank_companies`, `get_quarters`, `get_ttm`, `get_upcoming_earnings`, `get_ontology`, `check_data_quality`, `run_sql`).
- Nomes de colunas só entram no SQL depois de validados contra `PRAGMA table_info` (nunca texto livre). `run_sql` reutiliza `runSql` de `pipeline/ask.js` (só SELECT/WITH, máx. 200 linhas).
- Teste manual: ranking, histórico, ontologia, qualidade e `run_sql` funcionam; `DELETE` via `run_sql`, injeção em `metric` e parâmetro obrigatório ausente são recusados.

## 4. Servidor tradicional — feito

- `traditional/server.js`: registra cada ferramenta com `registerTool`, resultado em JSON compacto, erros como `isError: true`, `readOnlyHint`.

## 5. Servidor code-exec — feito (primeira versão)

- `code-exec/sandbox.js`: gera `sandbox/servers/earnings/*.js` (uma função por ferramenta, com JSDoc extraído do registro) e executa o código do agente num **processo Node filho com `--permission`**: leitura só de `servers/`, `workspace/`, `skills/`, `runs/`; escrita só em `workspace/` e `skills/`; sem rede, sem processos, sem workers (negados por padrão); ambiente vazio; `--max-old-space-size=256`; timeout 30 s (máx. 120 s); saída truncada em 32 KB; máx. 500 chamadas de ferramenta por execução.
- As funções do sandbox **não abrem o banco**: enviam a chamada por IPC ao processo pai, que executa a ferramenta real de `lib/tools.js` (somente leitura). Assim o filho nunca precisa de acesso ao arquivo do banco.
- `code-exec/server.js`: apenas duas ferramentas MCP, `search_tools` (níveis `name | description | schema`, como no artigo) e `execute_code`. O que volta ao modelo é só o que o código imprime, mais uma linha de rodapé com status, nº de chamadas internas e tempo.
- Teste de fumaça pelo cliente MCP real: definições carregadas no início = **1,8 KB** (tradicional: 6,3 KB); `listLatest` lido inteiro no sandbox (13,9 KB) sem nada disso chegar ao contexto; erro no código volta com `isError`.

## 6. Cliente de medição — feito

- `bench/client.js`: cliente MCP real (SDK, stdio) que registra, por chamada, bytes enviados, bytes devolvidos ao contexto e tempo, além do tamanho das definições de ferramentas.

## 7. Primeira bateria de segurança — 6 falhas encontradas

`bench/security.js` ataca os dois servidores pelo protocolo MCP (35 ataques na primeira versão). Resultado inicial: 25 bloqueados, 4 mitigados, **6 abertos**:

| # | Falha | Onde | Causa | Correção |
|---|---|---|---|---|
| 1 | `node:sqlite` abre qualquer arquivo SQLite no sandbox | code-exec | O modelo de permissões do Node 26 **não cobre** o `node:sqlite` (o `fs` foi bloqueado, o sqlite não). Daria para ler qualquer banco SQLite do usuário (ex.: cookies do navegador) ou criar arquivos fora do workspace | `code-exec/harden.mjs` (pré-carregado): `registerHooks` recusa `sqlite`/`node:sqlite` em `import` e `require`, e `process.getBuiltinModule` também |
| 2 | Código do agente mata o servidor MCP (`process.kill(ppid)`) | code-exec | `--permission` não restringe sinais. Pior: com força bruta de PIDs mataria **qualquer** processo do usuário | Namespaces (`unshare --user --pid --net --mount-proc`): dentro deles `ppid = 0`, `/proc` só mostra o próprio sandbox, sem rede. Mais `process.kill`/`_kill` bloqueados no preload para o modo de recuo |
| 3 | CTE recursiva infinita trava o servidor | **os dois** e `pipeline/ask.js` | `node:sqlite` é síncrono e não tem como interromper uma consulta; o `setTimeout` do pai nunca dispara. No dashboard isso congelaria o site inteiro | `pipeline/safe-sql.js` + `sql-worker.js`: a consulta roda num processo filho com tempo limite de 5 s (SIGKILL e recriação); lê no máximo 200 linhas por iteração |
| 4 | Produto cartesiano de views (bilhões de linhas) | os dois | Mesma causa do #3 | Mesma correção |
| 5 | `run_sql` lê tabelas brutas (`quarters`, `sqlite_master`) | os dois | A regra "só views" estava só no prompt/ontologia, não imposta | Autorizador do SQLite (`setAuthorizer`): só lê `v_*`, nega CTE recursiva, PRAGMA, ATTACH e escrita |
| 6 | `pipeline/ask.js` tinha a falha #3 | dashboard | Executava o SQL do modelo no processo do servidor web | Passou a usar `safe-sql.js`; `ask.js` agora exporta só `ask` |

Detalhes e armadilhas durante a correção:
- O autorizador negava as próprias views: `v_latest` usa `(SELECT MAX(id) FROM refresh_runs)` e o SQLite reporta essa leitura **sem contexto de view e sem nome de coluna**. Regra final: permitir leituras de `v_*`, leituras dentro de uma view e leituras sem nome de coluna. **Resíduo aceito:** `count(*)`/`MAX(id)` de tabelas brutas (só vazam contagens).
- Bug meu em `safe-sql.js`: depois de matar o processo por tempo, a consulta seguinte ia para o processo morto. Corrigido amarrando cada pendência ao processo que a recebeu e zerando `child` no kill.
- Meu teste classificava como "aberto" um `import` estático negado (o erro acontece na ligação do módulo, antes do `try/catch`). Corrigido o classificador.
- O modo de recuo (`SANDBOX_NO_NAMESPACES=1`, ou onde `unshare` não existe, ex.: macOS) também fecha em 0 abertos, mas depende do preload (melhor esforço, mesmo processo).

Resultado final: **40 ataques, 36 bloqueados, 4 mitigados, 0 abertos** nos dois modos (`bench/results/security-*.json`). Os 4 mitigados são limites, não bloqueios: saída truncada em 32 KB, 500 chamadas de ferramenta por execução, aviso de cota de 50 MB do workspace (a gravação em si não é impedida) e `limit` de 1 bilhão limitado a 40.

## 8. Mudança de plano na comparação: modelo real em vez de agente roteirizado

Sem chave da API da Anthropic, o plano era um agente roteirizado. O usuário indicou o `llama-server` local (porta 8080, **Qwen3.6-35B-A3B Q4_K_M**, contexto de 262144 tokens em 4 slots, tool calling nativo, `usage.prompt_tokens` real). Isso permite que um modelo de verdade escolha as ferramentas e escreva o código, e que os tokens sejam **medidos pelo tokenizer do modelo**, não estimados por bytes.

## 9. Primeiro teste com o Qwen: defeitos de usabilidade no code-exec

Smoke test (`lookup` e `top_growth`, 1 tentativa, `bench/results/llm-smoke-v1.json`). O resultado já mostrou a forma geral da comparação (o tradicional resolve perguntas pequenas em 2 passos; o code-exec gastou 7 a 10), mas a leitura dos traces mostrou que **parte do custo era defeito meu**, não do padrão:

| Defeito | Efeito observado | Correção |
|---|---|---|
| `search_tools` buscava só no nome em snake_case e exigia **todas** as palavras | `search_tools("rankCompanies")` devolvia `[]`; o modelo caía em tentativa e erro | Busca por camelCase e snake_case, qualquer palavra, ordenada por acertos; sem resultado, devolve a lista de funções disponíveis |
| Chamada posicional `getCompanySnapshot('NVDA')` falhava com um trecho ilegível do `_client.js` | O modelo não via a mensagem de erro | Os módulos gerados validam o argumento e dizem a assinatura: `getCompanySnapshot recebe um objeto: getCompanySnapshot({ symbol })` |
| Saída de erro do Node com caminho, código-fonte e pilha interna | Ruído no contexto | `cleanOutput` mantém só a mensagem e os frames do código do agente |
| Faltou `await` → `Promise { <pending> }` ou `{}` | 2 a 3 passos perdidos | Não há correção de código (é um erro do modelo); só a dica na descrição de `execute_code`: "são assíncronas (use await) e recebem um único objeto" |

Critério para não ajustar demais ao modelo: corrigi só o que era bug ou mensagem inútil; a única mudança de "ensino" foi essa frase, cujo custo em tokens entra na medição. **O código foi congelado aqui**: a bateria oficial roda nesta versão. O resultado v1 fica guardado como evidência do efeito dessas correções.

## 10. Bateria oficial com LLM

- 10 tarefas (volume de dados pequeno, médio e grande), cada uma nos dois servidores, 2 tentativas, temperatura 0,6, sem "thinking" (decisão de velocidade; um subconjunto com thinking ligado vem depois).
- Verdade calculada por SQL direto no banco; correção automática por valores com tolerância e nomes/símbolos, com lista de proibidos nas tarefas de conjunto.
- Execuções seriais, para o tempo de parede ser comparável. O workspace e as skills do sandbox são zerados a cada execução.

## 11. Resultado da bateria oficial

- 40 execuções (10 tarefas × 2 servidores × 2 tentativas). Tradicional **18/20**, code-exec **16/20** (sem significância, p = 0,66). Tradicional gastou ~½ dos tokens e foi 2,3× mais rápido; menos tokens de entrada em 9 de 10 tarefas, mais rápido em 10 de 10. Detalhes e ressalvas em [benchmark.md](benchmark.md).
- **Achado metodológico:** o servidor tradicional tem `run_sql`, e o modelo resolveu as tarefas "grandes" com uma consulta agregadora. Isso faz do tradicional um baseline forte e impede a bateria de exercitar o cenário em que o code-exec deveria ganhar (maior resultado de ferramenta no tradicional: 3,3 KB).
- **Bug do corretor:** a resposta de `worst_qoq` tradicional #2 estava certa mas com a data em `dd/mm/yyyy`. Corrigi `tasks.js` e reavaliei todas as 40 respostas (`bench/regrade.js`); só esse veredito mudou (17/20 → 18/20).
- Das 6 execuções realmente erradas, **todas foram erro do modelo**, nenhuma falha de servidor.

## 12. Não feito

- Variante do tradicional **sem `run_sql`**.
- Variante com **thinking ligado**.
- Tarefas de **alto volume** de dados.
- Comparação com um modelo Claude (sem chave de API).
- Commit: nada foi versionado (arquivos novos em `mcp/`, `pipeline/safe-sql.js`, `pipeline/sql-worker.js`, `pipeline/quality.js` e as mudanças em `pipeline/ask.js`).

## 13. Segunda etapa: variantes pedidas após a bateria oficial

Executadas a pedido do usuário, ainda sem ajustar o código dos servidores (congelado desde a seção 9):

- **Variante "sem SQL"** (`--kinds traditional-nosql,code-exec-nosql`): os mesmos dois servidores sem `run_sql`, via `EXCLUDE_TOOLS=run_sql` em `lib/tools.js`. A ferramenta sai **dos dois** (9 funções em cada), senão o code-exec ficaria com uma vantagem que o tradicional não tem e a comparação deixaria de isolar o efeito do padrão. Verificado: `run_sql` não aparece nas definições e uma chamada a ele é recusada.
- **Variante com thinking ligado** (`--thinking`): os dois servidores originais, 10 tarefas, 2 tentativas. O limite de tokens de saída por passo sobe de 6.000 para 16.000 (o raciocínio consome saída; sem folga o corte contaminaria o resultado).
- Mesmo corretor, mesmas tarefas e verdades, mesmo modelo e temperatura. Execuções seriais: primeiro "sem SQL", depois "thinking".

## 14. Resultado das variantes e o que aprendi com elas

- **Sem `run_sql`** (`llm-nosql.json`): o efeito do padrão aparece. Tradicional 12/20 contra code-exec 17/20 (p = 0,16); nas tarefas grandes, 2/6 contra 6/6 (p = 0,06) e 80 mil contra 18 mil tokens de entrada. Das 8 execuções erradas do tradicional, 6 foram por estourar os passos ou os tokens.
- **Com raciocínio ligado** (`llm-thinking.json`): igual à configuração A; o raciocínio não reduziu os passos do code-exec.
- **Respostas vazias com raciocínio ligado:** 3 execuções do code-exec terminaram sem resposta. Diagnóstico (`llm-diag.json`, com `finish_reason` e o fim do raciocínio, que acrescentei ao `agent.js`): o Qwen escreveu a chamada de ferramenta dentro do raciocínio e o llama-server não a interpretou. Mantive as execuções e reportei as duas leituras (com e sem elas), sem sortear de novo.
- **Correção de uma afirmação minha:** durante a bateria "sem SQL" eu disse que `source_counts` era uma "lacuna de capacidade". Não é: somar `getQuarters({limit: 40})` por empresa responde. Os dois servidores falharam por causa do `limit` padrão de 8, que trunca em silêncio. A tarefa não discrimina o padrão.
- **Deslize de processo:** um comentário `//` no meio de uma linha engoliu um `catch` em `llm-bench.js` e a primeira cadeia falhou ao carregar, sem nenhuma execução (nada contaminado). Mesmo erro do `explore.js` no início do projeto; verifico agora a sintaxe com `node --check` antes de lançar rodadas longas.
- **Não feito:** mais tentativas por tarefa, tarefas de volume realmente grande, modelo Claude, commit.

## 15. Auditoria da ontologia (depois do benchmark)

Pergunta do usuário: "a ontologia está atualizada?". O `check.js` passava, mas só confere o que o YAML **cita**. Auditoria contra as views reais e as mudanças da sessão:

| Lacuna | Correção |
|---|---|
| 17 colunas das views sem nenhuma menção (`revenue_usd_b`, `net_income_usd_b`, `ocf_usd_b`, `cash_usd_b`, `debt_usd_b`, `rd_*`, `sbc_*`; em `v_latest`: `financials_source`, `eps_estimate_native`, `price_native`, `ev_usd_b`, `employees`…) | Descritas em `entities`; novas métricas `rd_pct` e `sbc_pct` |
| Regras de SQL aprendidas na sessão (views só, CTE recursiva negada, 5 s, 200 linhas) e armadilhas que causaram erros no benchmark (`LAG` em ordem decrescente, "últimos N" × média de todos, contagem sobre lista truncada) | Quatro regras novas em `rules` |
| Anomalias que disparam avisos do `npm run quality` mas não são erro | Nova seção `known_anomalies`, datada (2026-11-03) |
| Peculiaridade do 10-K da ORCL descartada pelo backfill | Nota na fonte SEC |
| `check.js` não detectaria nada disso | Agora falha se uma coluna das views não aparece no YAML (verificado removendo `employees`: falha; restaurado: passa) |

Também corrigi a contagem de colunas de `v_latest` nas descrições das ferramentas e no `design.md` (diziam 35; são 36) e acrescentei `known_anomalies` ao enum de `get_ontology`.

**Atenção à validade do benchmark:** essas duas edições em `mcp/lib/tools.js` vieram **depois** das três baterias, que rodaram com o texto "35 colunas" e sem a seção nova no enum. Não afetam os resultados: nenhuma tarefa usa `get_ontology`, e "35"→"36" tem o mesmo número de tokens. As definições medidas continuam as mesmas em tamanho.

## 16. Segmentos históricos (depois do benchmark)

Nova tabela `segment_quarters` e view `v_segment` (receita por segmento e por produto, empresas dos EUA, ~5 anos), carregadas por `pipeline/backfill-segments.js`. **A view entrou depois do benchmark** (a `run_sql` e o `ask` passaram a anunciar cinco views em vez de quatro, e o `get_ontology` ficou maior); os resultados de `benchmark.md` valem para o conjunto de quatro views.

- **Fonte:** o `companyfacts` do SEC não traz dimensões, então a receita por segmento vem do iXBRL de cada 10-Q e 10-K (`pipeline/segments-xbrl.js`). Trimestres 1 a 3 vêm do 10-Q; o 4º é calculado (ano do 10-K menos os 3 trimestres) e marcado em `is_derived_q4`.
- **Reorganizações:** o valor do ano anterior é o que a empresa apresenta no MESMO arquivamento, então já vem reapresentado; `taxonomy` sobe quando o conjunto de segmentos muda e vale para sequências, não para a/a.
- **Hierarquia:** membros cuja receita é a soma de outros (Data Center = Hyperscale + Nuvens de IA) recebem `parent_member`, detectados por soma com tolerância de 0,1% (ou US$ 3 mi).
- **Falhas encontradas pelas regras de qualidade novas** (`segment_sum`, `segment_vs_quarter`): (1) fatos vazios `<ix:nonFraction/>` autofechados eram pareados com o valor do fato seguinte; (2) a tolerância de 0,5% juntava segmentos que só se parecem (Europa + Japão + Ásia ≈ Américas na Apple); (3) o total derivado do percentual arredondado dava erro em segmentos pequenos, então a view passou a expor `company_revenue_usd_b`; (4) um comentário `//` no meio de uma linha engoliu o resto dela, o mesmo erro de antes.
- **Limites assumidos:** a AMD foi excluída (os nomes dos membros XBRL não correspondem aos valores, mesmo depois de corrigir o parser); Amazon e Microsoft por produto, Salesforce e Oracle misturam cortes. Em vez de esconder, a view expõe `axis_coverage_pct` e a ontologia manda filtrar entre 95 e 105 antes de somar ou ranquear. Hong Kong não tem segmentos (sem 10-Q).
