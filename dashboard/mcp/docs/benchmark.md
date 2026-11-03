# Comparação: MCP tradicional × MCP com execução de código

Resultados de três baterias com um LLM real dirigindo os dois servidores. O método e os limites vêm junto porque **mudam o que se pode concluir**.

## Resumo

| Configuração | Acertos (trad. × code-exec) | Tokens de entrada | Pico de contexto | Tempo | Quem foi melhor |
|---|---|---:|---:|---:|---|
| **A.** com `run_sql`, sem raciocínio | 18/20 × 16/20 (p = 0,66) | 8,4 mil × 16,9 mil | 3,0 mil × 4,0 mil | 10 s × 21 s | **Tradicional**, em custo, passos e tempo |
| **B.** sem `run_sql`, sem raciocínio | 12/20 × 17/20 (p = 0,16) | 40,3 mil × 11,8 mil | 8,9 mil × 3,9 mil | 38 s × 27 s | **Code exec**, em tudo |
| **C.** com `run_sql`, com raciocínio | 18/20 × 16/20 (p = 0,66) | 7,3 mil × 14,3 mil | 3,0 mil × 3,9 mil | 26 s × 27 s | **Tradicional**, em custo e passos |

**Conclusões que os dados sustentam:**

1. **O padrão de execução de código funciona e reduz custo quando o servidor tradicional precisa fazer laços turno a turno.** Em B, nas tarefas de histórico (volume "grande"), o tradicional acertou 2/6 com 79,8 mil tokens de entrada e picos de 17 mil de contexto; o code-exec acertou 6/6 com 17,7 mil e picos de 4,4 mil (p = 0,06 nos acertos; a diferença de tokens e de contexto é consistente).
2. **Uma ferramenta de SQL livre num servidor tradicional captura quase todo esse benefício.** Com `run_sql` (A e C), o modelo resolve as mesmas tarefas com uma consulta agregadora, e o tradicional volta a ser ~2× mais barato e mais rápido. Para dados que já vivem num banco, isso dá o "filtrar fora do contexto" sem sandbox.
3. **Em perguntas simples o code-exec perde sempre** (2 passos contra 4 a 6 em `lookup` e `top_growth`, nas três configurações): há descoberta e escrita de código a mais.
4. **O raciocínio ligado não mudou a comparação** (C ≈ A) e não reduziu os passos do code-exec.

**O que os dados não sustentam:** as diferenças de **acertos** não são estatisticamente distinguíveis em nenhuma configuração (amostra de 20 por lado); só tokens, contexto, passos e tempo são consistentes entre tarefas. Tudo vale para **um modelo local de 35 B quantizado**, não para o Claude.

## Método

- **Modelo:** `unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M` no `llama-server` local, temperatura 0,6. Tokens medidos pelo `usage` do servidor (tokenizer do modelo).
- **Agente:** o mesmo prompt de sistema para todos; a única diferença é o conjunto de ferramentas que o MCP anuncia (`bench/agent.js`). Até 12 passos; 6.000 tokens de saída por passo (16.000 com raciocínio).
- **Tarefas:** 10, em três faixas de volume (pequeno 3, médio 4, grande 3). **2 tentativas** por tarefa e servidor = 40 execuções por configuração, em série.
- **Configurações:** A = os dois servidores completos; B = os dois **sem `run_sql`** (`EXCLUDE_TOOLS=run_sql`, 9 funções em cada, para o code-exec não ficar com uma vantagem que o tradicional não tem); C = como A com `--thinking`.
- **Verdade:** SQL direto no banco, independente das ferramentas. **Corretor automático:** números com tolerância, nomes/símbolos por presença, lista de proibidos nas tarefas de conjunto (`bench/tasks.js`).
- **Isolamento do sandbox:** `namespaces+permission`. O workspace e as skills são zerados a cada execução.
- Dados brutos, com o rastro de cada execução: `bench/results/llm-nothink.json`, `llm-nosql.json`, `llm-thinking.json` (e `llm-diag.json`, ver a seção sobre respostas vazias). Tabelas completas: `bench/results/report-*.md` (`bench/report.js`).

## Custo fixo: definições de ferramentas no contexto

| | Ferramentas | Bytes | Tokens (medidos) |
|---|---:|---:|---:|
| Tradicional | 10 | 6.276 | 1.947 |
| Code exec | 2 | 1.864 | 688 |

Sem `run_sql` o tradicional tem 9 ferramentas (5.748 bytes). O code-exec carrega ~2,8× menos tokens antes da primeira pergunta, mas as definições vão em todo passo, e nas configurações A e C ele precisou de mais passos, então a economia foi consumida.

## A. Com `run_sql`, sem raciocínio

| Métrica | Tradicional | Code exec | Code exec ÷ Tradicional |
|---|---:|---:|---:|
| Acertos | 18/20 (90%) | 16/20 (80%) | |
| Passos (turnos do modelo) | 3,0 | 6,8 | 2,3× |
| Chamadas de ferramenta MCP | 2,7 | 5,8 | 2,2× |
| Erros de ferramenta | 0,4 | 1,3 | 3,1× |
| Tokens de entrada (soma dos passos) | 8.435 | 16.902 | 2,0× |
| Tokens de entrada novos (com cache de prefixo) | 1.245 | 3.285 | 2,6× |
| Tokens de saída | 297 | 717 | 2,4× |
| Pico de contexto (tokens) | 3.014 | 4.009 | 1,3× |
| Bytes de resultado de ferramenta no contexto | 1.837 | 7.403 | 4,0× |
| Tempo (s) | 9,5 | 21,4 | 2,3× |

O tradicional usou menos tokens de entrada em **9 das 10 tarefas**, menos passos em 9 e foi mais rápido em 10.

| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |
|---|---|---:|---:|---:|---:|---:|---:|
| pequeno | Tradicional | 6/6 | 2,0 | 4.322 | 91 | 2.273 | 5 |
|  | Code exec | 5/6 | 5,3 | 12.540 | 382 | 3.196 | 14 |
| médio | Tradicional | 8/8 | 2,9 | 9.183 | 306 | 3.239 | 10 |
|  | Code exec | 7/8 | 7,0 | 15.215 | 638 | 3.908 | 20 |
| grande | Tradicional | 4/6 | 4,0 | 11.550 | 491 | 3.456 | 14 |
|  | Code exec | 4/6 | 7,8 | 23.513 | 1.159 | 4.958 | 31 |

Mesmo nas tarefas grandes o tradicional ficou em ~3,5 mil tokens de pico: o modelo as resolveu com **uma consulta** (`AVG`, `LAG`, `ROW_NUMBER`). O code-exec acabou chamando o mesmo `runSql` de dentro do código, com um passo de escrita a mais.

| Tarefa | Servidor | # | Motivo | Faltou | Proibido | Erro |
|---|---|---:|---|---|---|---|
| `screen_multi` | Code exec | 1 | resposta incorreta | - | AMZN | - |
| `avg_margin_8q` | Tradicional | 1 | resposta incorreta | 57.9, 41.4, 38.5 | - | - |
| `avg_margin_8q` | Code exec | 2 | resposta incorreta | 57.9, 41.4, 38.5 | - | - |
| `worst_qoq` | Tradicional | 1 | resposta incorreta | 2022-07-31, -57.1 | - | - |
| `worst_qoq` | Code exec | 2 | falha de execução | INTU, 2022-07-31, -57.1 | - | max_steps |
| `source_counts` | Code exec | 1 | resposta incorreta | 174 | - | - |

Revisão manual das 5 execuções erradas (o corretor errou uma sexta, ver abaixo): todas foram **erro do modelo** (incluiu a AMZN, que cresceu 12% contra o corte de 15%; mediu a média de **todos** os trimestres em vez dos últimos 8, nos dois servidores; `LAG ... ORDER BY DESC` compara com o trimestre seguinte; estourou 12 passos; contou trimestres com o `limit` padrão de 8). Nenhuma foi falha de servidor. Uma sexta, `worst_qoq` tradicional #2, foi **bug do meu corretor** (data em `31/07/2022`); corrigi e reavaliei as 40 respostas com a mesma regra (`bench/regrade.js`; só esse veredito mudou, e o original fica em `correctOriginal`).

## B. Sem `run_sql`, sem raciocínio

| Métrica | Tradicional sem SQL | Code exec sem SQL | Code exec sem SQL ÷ Tradicional sem SQL |
|---|---:|---:|---:|
| Acertos | 12/20 (60%) | 17/20 (85%) | |
| Passos (turnos do modelo) | 5,6 | 5,5 | 1,0× |
| Chamadas de ferramenta MCP | 11,3 | 4,5 | 0,4× |
| Erros de ferramenta | 1,5 | 0,5 | 0,3× |
| Tokens de entrada (soma dos passos) | 40.319 | 11.846 | 0,3× |
| Tokens de entrada novos (com cache de prefixo) | 7.360 | 3.202 | 0,4× |
| Tokens de saída | 1.345 | 627 | 0,5× |
| Pico de contexto (tokens) | 8.905 | 3.885 | 0,4× |
| Bytes de resultado de ferramenta no contexto | 14.560 | 7.267 | 0,5× |
| Tempo (s) | 38,3 | 26,9 | 0,7× |

| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |
|---|---|---:|---:|---:|---:|---:|---:|
| pequeno | Tradicional sem SQL | 4/6 | 5,0 | 22.972 | 1.361 | 4.861 | 33 |
|  | Code exec sem SQL | 4/6 | 5,2 | 8.953 | 356 | 3.095 | 14 |
| médio | Tradicional sem SQL | 6/8 | 4,1 | 23.733 | 635 | 5.656 | 19 |
|  | Code exec sem SQL | 7/8 | 4,9 | 9.608 | 472 | 4.086 | 16 |
| grande | Tradicional sem SQL | 2/6 | 8,0 | 79.780 | 2.277 | 17.282 | 69 |
|  | Code exec sem SQL | 6/6 | 6,5 | 17.722 | 1.104 | 4.407 | 54 |

Sem a consulta agregadora, o tradicional passou a fazer **um laço turno a turno**: 23 e 26 chamadas em `avg_margin_8q`, 25 em `worst_qoq`, até 267 mil tokens de entrada acumulados numa única execução (que terminou sem resposta). Das suas 8 execuções erradas, **6 foram por estourar os 12 passos ou o limite de tokens**, o que quase não aconteceu na configuração A. O code-exec resolveu o mesmo laço dentro de um único código e imprimiu só o resultado.

| Tarefa | Servidor | # | Motivo | Faltou | Proibido | Erro |
|---|---|---:|---|---|---|---|
| `screen_multi` | Code exec sem SQL | 1 | resposta incorreta | - | AMZN | - |
| `screen_multi` | Tradicional sem SQL | 2 | resposta incorreta | - | AMZN | - |
| `capex_increase` | Tradicional sem SQL | 2 | falha de execução | AMZN, 18.8 | - | max_steps |
| `avg_margin_8q` | Tradicional sem SQL | 1 | falha de execução | NVDA, 57.9, GOOGL, 41.4, MSFT, 38.5 | - | max_steps |
| `avg_margin_8q` | Tradicional sem SQL | 2 | resposta incorreta | 57.9, GOOGL, 41.4 | - | - |
| `cagr_history` | Tradicional sem SQL | 2 | falha de execução | NVDA, 71.5 | - | max_steps |
| `worst_qoq` | Tradicional sem SQL | 2 | falha de execução | INTU, 2022-07-31, -57.1 | - | max_steps |
| `source_counts` | Tradicional sem SQL | 1 | falha de execução | FMP, 40, SEC, 174, Yahoo, 71, Yahoo + empresa, 2 | - | max_steps |
| `source_counts` | Code exec sem SQL | 1 | resposta incorreta | 174 | - | - |
| `source_counts` | Tradicional sem SQL | 2 | falha de execução | 71 | - | max_tokens |
| `source_counts` | Code exec sem SQL | 2 | resposta incorreta | 174 | - | - |

Observações:
- `source_counts` falhou nas **quatro** execuções, nos dois servidores. Não é impossível sem SQL (somar `getQuarters({limit: 40})` por empresa dá a resposta), mas o **`limit` padrão de 8 trunca em silêncio** e todos caíram nessa armadilha. É um defeito de ergonomia da interface comum aos dois, e a tarefa não discrimina o padrão. Sem ela, os acertos são 12/18 × 17/18 (p = 0,09).
- O code-exec não é uniformemente melhor: em `cagr_history` #2 gastou 10 passos, 46 mil tokens e 197 s, o pior caso dele.

## C. Com `run_sql`, com raciocínio ligado

| Métrica | Tradicional | Code exec | Code exec ÷ Tradicional |
|---|---:|---:|---:|
| Acertos | 18/20 (90%) | 16/20 (80%) | |
| Passos (turnos do modelo) | 2,7 | 6,2 | 2,3× |
| Chamadas de ferramenta MCP | 2,1 | 5,5 | 2,6× |
| Erros de ferramenta | 0,2 | 0,6 | 3,0× |
| Tokens de entrada (soma dos passos) | 7.298 | 14.308 | 2,0× |
| Tokens de entrada novos (com cache de prefixo) | 1.337 | 3.799 | 2,8× |
| Tokens de saída | 1.279 | 1.028 | 0,8× |
| Pico de contexto (tokens) | 2.992 | 3.927 | 1,3× |
| Bytes de resultado de ferramenta no contexto | 1.654 | 7.677 | 4,6× |
| Tempo (s) | 25,9 | 27,0 | 1,0× |

| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |
|---|---|---:|---:|---:|---:|---:|---:|
| pequeno | Tradicional | 6/6 | 2,0 | 4.221 | 425 | 2.174 | 10 |
|  | Code exec | 5/6 | 4,7 | 5.457 | 508 | 1.715 | 14 |
| médio | Tradicional | 7/8 | 2,6 | 7.254 | 1.008 | 3.034 | 21 |
|  | Code exec | 6/8 | 5,4 | 12.703 | 876 | 4.326 | 24 |
| grande | Tradicional | 5/6 | 3,5 | 10.432 | 2.493 | 3.753 | 48 |
|  | Code exec | 5/6 | 8,7 | 25.298 | 1.751 | 5.607 | 43 |

| Tarefa | Servidor | # | Motivo | Faltou | Proibido | Erro |
|---|---|---:|---|---|---|---|
| `lookup` | Code exec | 1 | resposta incorreta | 62 | - | - |
| `screen_multi` | Code exec | 1 | resposta incorreta | - | AMZN | - |
| `beat_and_fell` | Tradicional | 1 | resposta incorreta | - | 09988.HK | - |
| `beat_and_fell` | Code exec | 1 | resposta incorreta | 00700.HK, 09618.HK, AMD, INTU, META, MSFT, ORCL | - | - |
| `avg_margin_8q` | Tradicional | 1 | resposta incorreta | 57.9, 41.4, 38.5 | - | - |
| `avg_margin_8q` | Code exec | 1 | resposta incorreta | NVDA, 57.9, GOOGL, 41.4, MSFT, 38.5 | - | - |

**Respostas vazias (artefato do formato, não do padrão).** Três das seis execuções erradas têm resposta vazia, todas no code-exec. Rastreei a causa com um diagnóstico (`llm-diag.json`, que guarda o motivo de parada e o fim do raciocínio): o Qwen escreveu a **chamada de ferramenta dentro do próprio raciocínio** (aparecem os fechamentos `</parameter></function></tool_call>` no texto de raciocínio). O llama-server não a interpreta como chamada, o conteúdo fica vazio e o agente encerra. Não repeti essas execuções (sortear de novo favoreceria um dos lados). Lido de duas formas: **como medido**, 18/20 × 16/20; **excluindo as vazias**, 18/20 × 16/17. Não consigo dizer se isso é mais frequente no code-exec (que passa o código inteiro como argumento da chamada) ou acaso: foram 3 em 20, contra 0 em 20, e a repetição de diagnóstico reproduziu 1 em 8.

## Achados que valem para qualquer configuração

- **A qualidade da interface do code-exec pesa muito.** O primeiro teste com o modelo mostrou 4 defeitos meus: busca por nome só em snake_case que devolvia `[]`, erro ilegível para argumento posicional, ruído do Node na saída de erro e `await` esquecido. Corrigi os três primeiros e acrescentei uma frase na descrição; `lookup` caiu de 7 para 4–5 passos e `top_growth` de 10 para 4. O padrão tem uma sensibilidade a esses detalhes que o tradicional não tem.
- **Mais bytes no contexto, não menos, nas perguntas pequenas (4 a 5×):** o código imprime tentativas exploratórias, `JSON.stringify(x, null, 2)` e rastros de erro. Filtrar dentro do sandbox só ajuda se o modelo acerta de primeira ou se o volume é grande.
- **Defaults silenciosos custam caro:** o `limit` padrão de 8 de `get_quarters` enganou os dois servidores em `source_counts`. Vale devolver o total disponível junto com a lista truncada.
- **Segurança:** a primeira bateria de ataques achou 6 falhas (ver o [diário](implementation-log.md#7-primeira-bateria-de-segurança--6-falhas-encontradas)), entre elas o `node:sqlite` ignorando o `--permission` e o código do agente podendo matar o servidor. O code-exec exige três camadas de isolamento e tem riscos residuais; o tradicional só precisou do SQL seguro, que protege os dois. Resultado final: 40 ataques, 0 abertos, nos dois modos de isolamento (`bench/results/security-*.json`).

## Limites desta comparação

1. **Um modelo, local, quantizado.** Um modelo de fronteira escreve código com menos erros; o code-exec pode melhorar mais que o tradicional. **Não extrapole para o Claude.**
2. **Dados pequenos** (18 empresas, ~290 trimestres). Nenhum resultado de ferramenta passou de 3,3 KB com `run_sql`. O cenário do artigo (resultados intermediários de dezenas de milhares de tokens, centenas de ferramentas) não foi testado; a configuração B o aproxima ao obrigar laços, mas o volume dos dados continua pequeno.
3. **Amostra pequena:** 10 tarefas, 2 tentativas, 1 modelo. Nenhuma diferença de acertos é estatisticamente distinguível; as de tokens, contexto, passos e tempo são consistentes entre tarefas.
4. **Corretor automático.** A checagem de números aceita qualquer número da resposta dentro da tolerância, e só revi manualmente as execuções **erradas**, não as certas. O ajuste de datas foi feito depois de ver os resultados (aplicado a todas).
5. **Respostas vazias na configuração C** (acima) e **sem prompt caching real** (a coluna "entrada novos" usa o cache de prefixo do llama-server como aproximação).
6. **O código dos servidores mudou** depois do primeiro teste com o modelo (seção 9 do diário) e ficou congelado desde então; as três baterias rodaram na mesma versão.

## Quando usar cada um

- **Tradicional com uma ferramenta de SQL livre e seguro:** dados num banco, perguntas de poucos passos, clientes simples. É a recomendação para este projeto: dá o benefício central sem sandbox.
- **Tradicional puro (só ferramentas de leitura estruturada):** serve se todas as perguntas cabem em uma ou duas chamadas; deixa de servir quando a análise exige laço por entidade (B mostra o custo).
- **Code-exec:** quando a análise exige laços, junções ou agregações que nenhuma ferramenta cobre e não há SQL, quando há muitos dados intermediários, centenas de ferramentas, ou necessidade de guardar estado/skills. Planeje o sandbox, meça com o seu modelo e invista na ergonomia da interface.

## Próximos passos sugeridos

1. Repetir com **mais tentativas** (5 ou mais por tarefa) para estreitar o intervalo de acertos.
2. Acrescentar tarefas que **exijam** volume (ex.: histórico de todas as empresas mais a ontologia completa na mesma resposta).
3. Repetir com um **modelo da família Claude** quando houver chave de API.
4. Corrigir a armadilha do `limit` padrão (devolver o total disponível) e medir de novo `source_counts`.
