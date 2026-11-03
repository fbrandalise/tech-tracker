# Resultados — nothink

Modelo: `unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M` (llama-server, temperatura 0.6, thinking desligado). Isolamento do sandbox: `namespaces+permission`. 2 tentativa(s) por tarefa e servidor, 40 execuções. Gerado em 2026-11-03T16:58:11.221Z.

## 1. Custo fixo: definições de ferramentas no contexto

| | Ferramentas | Bytes | Tokens (medidos) |
|---|---:|---:|---:|
| Tradicional | 10 | 6.276 | 1.947 |
| Code exec | 2 | 1.864 | 688 |

## 2. Visão geral (média por execução)

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

## 3. Por tarefa

| Tarefa | Volume | Servidor | Acertos | Passos | Chamadas | Entrada | Saída | Pico ctx | Resultado no ctx (B) | Tempo (s) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `lookup` | pequeno | Tradicional | 2/2 | 2,0 | 1,0 | 4.473 | 56 | 2.431 | 760 | 4 |
|  |  | Code exec | 2/2 | 4,5 | 3,5 | 6.270 | 253 | 2.350 | 4.083 | 10 |
| `top_growth` | pequeno | Tradicional | 2/2 | 2,0 | 1,0 | 4.273 | 120 | 2.220 | 218 | 5 |
|  |  | Code exec | 2/2 | 4,0 | 3,0 | 4.570 | 231 | 1.567 | 1.885 | 9 |
| `screen_multi` | médio | Tradicional | 2/2 | 2,0 | 1,0 | 4.261 | 95 | 2.206 | 191 | 5 |
|  |  | Code exec | 1/2 | 6,0 | 5,0 | 11.819 | 495 | 3.166 | 6.759 | 16 |
| `beat_and_fell` | médio | Tradicional | 2/2 | 2,0 | 1,0 | 4.297 | 111 | 2.240 | 346 | 5 |
|  |  | Code exec | 2/2 | 6,5 | 5,5 | 11.072 | 524 | 2.986 | 6.070 | 17 |
| `capex_increase` | médio | Tradicional | 2/2 | 5,5 | 10,5 | 23.013 | 861 | 5.404 | 6.121 | 23 |
|  |  | Code exec | 2/2 | 11,0 | 10,0 | 31.681 | 1.172 | 6.661 | 11.795 | 35 |
| `avg_margin_8q` | grande | Tradicional | 1/2 | 5,0 | 4,0 | 14.790 | 438 | 3.983 | 4.600 | 14 |
|  |  | Code exec | 1/2 | 5,0 | 4,0 | 10.017 | 587 | 3.103 | 6.493 | 17 |
| `cagr_history` | grande | Tradicional | 2/2 | 2,5 | 1,5 | 6.158 | 431 | 2.764 | 623 | 11 |
|  |  | Code exec | 2/2 | 6,5 | 5,5 | 17.383 | 1.223 | 4.679 | 7.953 | 30 |
| `worst_qoq` | grande | Tradicional | 1/2 | 4,5 | 3,5 | 13.704 | 604 | 3.621 | 2.908 | 17 |
|  |  | Code exec | 1/2 | 12,0 | 11,5 | 43.138 | 1.668 | 7.092 | 13.389 | 45 |
| `source_counts` | pequeno | Tradicional | 2/2 | 2,0 | 1,0 | 4.221 | 99 | 2.169 | 185 | 5 |
|  |  | Code exec | 1/2 | 7,5 | 6,5 | 26.780 | 663 | 5.671 | 10.784 | 23 |
| `quality` | médio | Tradicional | 2/2 | 2,0 | 2,0 | 5.162 | 157 | 3.108 | 2.419 | 7 |
|  |  | Code exec | 2/2 | 4,5 | 3,5 | 6.288 | 360 | 2.821 | 4.817 | 13 |

## 4. Por volume de dados da tarefa

| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |
|---|---|---:|---:|---:|---:|---:|---:|
| pequeno | Tradicional | 6/6 | 2,0 | 4.322 | 91 | 2.273 | 5 |
|  | Code exec | 5/6 | 5,3 | 12.540 | 382 | 3.196 | 14 |
| médio | Tradicional | 8/8 | 2,9 | 9.183 | 306 | 3.239 | 10 |
|  | Code exec | 7/8 | 7,0 | 15.215 | 638 | 3.908 | 20 |
| grande | Tradicional | 4/6 | 4,0 | 11.550 | 491 | 3.456 | 14 |
|  | Code exec | 4/6 | 7,8 | 23.513 | 1.159 | 4.958 | 31 |

## 5. Execuções erradas

| Tarefa | Servidor | # | Motivo | Faltou | Proibido | Erro |
|---|---|---:|---|---|---|---|
| `screen_multi` | Code exec | 1 | resposta incorreta | - | AMZN | - |
| `avg_margin_8q` | Tradicional | 1 | resposta incorreta | 57.9, 41.4, 38.5 | - | - |
| `avg_margin_8q` | Code exec | 2 | resposta incorreta | 57.9, 41.4, 38.5 | - | - |
| `worst_qoq` | Tradicional | 1 | resposta incorreta | 2022-07-31, -57.1 | - | - |
| `worst_qoq` | Code exec | 2 | falha de execução | INTU, 2022-07-31, -57.1 | - | max_steps |
| `source_counts` | Code exec | 1 | resposta incorreta | 174 | - | - |

## 6. Segurança

| Modo | Ataques | Bloqueados | Mitigados | Abertos |
|---|---:|---:|---:|---:|
| namespaces | 40 | 36 | 4 | 0 |
| permission-only | 40 | 36 | 4 | 0 |

