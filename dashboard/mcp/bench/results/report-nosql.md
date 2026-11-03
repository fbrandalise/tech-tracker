# Resultados — nosql

Modelo: `unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M` (llama-server, temperatura 0.6, thinking desligado). Isolamento do sandbox: `namespaces+permission`. 2 tentativa(s) por tarefa e servidor, 40 execuções. Gerado em 2026-11-03T17:12:45.810Z.

## 1. Custo fixo: definições de ferramentas no contexto

| | Ferramentas | Bytes | Tokens (medidos) |
|---|---:|---:|---:|
| Tradicional sem SQL | 9 | 5.748 | 1.817 |
| Code exec sem SQL | 2 | 1.864 | 688 |

## 2. Visão geral (média por execução)

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

## 3. Por tarefa

| Tarefa | Volume | Servidor | Acertos | Passos | Chamadas | Entrada | Saída | Pico ctx | Resultado no ctx (B) | Tempo (s) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `lookup` | pequeno | Tradicional sem SQL | 2/2 | 2,0 | 1,0 | 4.213 | 48 | 2.301 | 760 | 4 |
|  |  | Code exec sem SQL | 2/2 | 6,0 | 5,0 | 10.049 | 353 | 4.028 | 6.604 | 14 |
| `top_growth` | pequeno | Tradicional sem SQL | 2/2 | 2,0 | 1,0 | 4.013 | 120 | 2.090 | 218 | 5 |
|  |  | Code exec sem SQL | 2/2 | 4,0 | 3,0 | 4.629 | 233 | 1.590 | 1.983 | 9 |
| `screen_multi` | médio | Tradicional sem SQL | 1/2 | 4,0 | 3,0 | 11.190 | 183 | 3.139 | 2.526 | 9 |
|  |  | Code exec sem SQL | 1/2 | 7,0 | 6,0 | 16.630 | 754 | 6.974 | 12.098 | 25 |
| `beat_and_fell` | médio | Tradicional sem SQL | 2/2 | 2,5 | 1,5 | 5.826 | 118 | 2.668 | 2.068 | 6 |
|  |  | Code exec sem SQL | 2/2 | 4,0 | 3,0 | 6.535 | 364 | 2.600 | 5.721 | 12 |
| `capex_increase` | médio | Tradicional sem SQL | 1/2 | 8,0 | 30,0 | 73.016 | 2.137 | 13.840 | 20.193 | 57 |
|  |  | Code exec sem SQL | 2/2 | 5,0 | 4,0 | 10.263 | 531 | 4.077 | 8.199 | 18 |
| `avg_margin_8q` | grande | Tradicional sem SQL | 0/2 | 8,5 | 24,5 | 56.735 | 1.574 | 8.938 | 12.247 | 42 |
|  |  | Code exec sem SQL | 2/2 | 6,5 | 5,5 | 13.076 | 864 | 3.494 | 6.339 | 23 |
| `cagr_history` | grande | Tradicional sem SQL | 1/2 | 7,5 | 12,5 | 38.248 | 2.835 | 9.470 | 13.738 | 68 |
|  |  | Code exec sem SQL | 2/2 | 7,0 | 6,0 | 27.318 | 1.284 | 6.213 | 13.021 | 109 |
| `worst_qoq` | grande | Tradicional sem SQL | 1/2 | 8,0 | 18,5 | 144.357 | 2.421 | 33.437 | 70.980 | 97 |
|  |  | Code exec sem SQL | 2/2 | 6,0 | 5,0 | 12.774 | 1.164 | 3.514 | 5.678 | 31 |
| `source_counts` | pequeno | Tradicional sem SQL | 0/2 | 11,0 | 18,5 | 60.691 | 3.917 | 10.193 | 20.454 | 90 |
|  |  | Code exec sem SQL | 0/2 | 5,5 | 4,5 | 12.182 | 482 | 3.667 | 8.397 | 17 |
| `quality` | médio | Tradicional sem SQL | 2/2 | 2,0 | 2,0 | 4.902 | 102 | 2.978 | 2.419 | 6 |
|  |  | Code exec sem SQL | 2/2 | 3,5 | 2,5 | 5.006 | 242 | 2.694 | 4.634 | 10 |

## 4. Por volume de dados da tarefa

| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |
|---|---|---:|---:|---:|---:|---:|---:|
| pequeno | Tradicional sem SQL | 4/6 | 5,0 | 22.972 | 1.361 | 4.861 | 33 |
|  | Code exec sem SQL | 4/6 | 5,2 | 8.953 | 356 | 3.095 | 14 |
| médio | Tradicional sem SQL | 6/8 | 4,1 | 23.733 | 635 | 5.656 | 19 |
|  | Code exec sem SQL | 7/8 | 4,9 | 9.608 | 472 | 4.086 | 16 |
| grande | Tradicional sem SQL | 2/6 | 8,0 | 79.780 | 2.277 | 17.282 | 69 |
|  | Code exec sem SQL | 6/6 | 6,5 | 17.722 | 1.104 | 4.407 | 54 |

## 5. Execuções erradas

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

## 6. Segurança

| Modo | Ataques | Bloqueados | Mitigados | Abertos |
|---|---:|---:|---:|---:|
| namespaces | 40 | 36 | 4 | 0 |
| permission-only | 40 | 36 | 4 | 0 |

