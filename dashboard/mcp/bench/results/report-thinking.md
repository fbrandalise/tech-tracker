# Resultados — thinking

Modelo: `unsloth/Qwen3.6-35B-A3B-GGUF:Q4_K_M` (llama-server, temperatura 0.6, thinking ligado). Isolamento do sandbox: `namespaces+permission`. 2 tentativa(s) por tarefa e servidor, 40 execuções. Gerado em 2026-11-03T17:34:35.271Z.

## 1. Custo fixo: definições de ferramentas no contexto

| | Ferramentas | Bytes | Tokens (medidos) |
|---|---:|---:|---:|
| Tradicional | 10 | 6.276 | 1.947 |
| Code exec | 2 | 1.864 | 688 |

## 2. Visão geral (média por execução)

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

## 3. Por tarefa

| Tarefa | Volume | Servidor | Acertos | Passos | Chamadas | Entrada | Saída | Pico ctx | Resultado no ctx (B) | Tempo (s) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `lookup` | pequeno | Tradicional | 2/2 | 2,0 | 1,0 | 4.178 | 534 | 2.138 | 45 | 11 |
|  |  | Code exec | 1/2 | 4,5 | 3,5 | 5.766 | 490 | 2.180 | 3.407 | 14 |
| `top_growth` | pequeno | Tradicional | 2/2 | 2,0 | 1,0 | 4.269 | 451 | 2.218 | 218 | 10 |
|  |  | Code exec | 2/2 | 4,0 | 3,0 | 4.382 | 483 | 1.472 | 1.619 | 13 |
| `screen_multi` | médio | Tradicional | 2/2 | 2,0 | 1,0 | 4.204 | 433 | 2.151 | 114 | 10 |
|  |  | Code exec | 1/2 | 5,5 | 4,5 | 10.743 | 690 | 3.170 | 7.661 | 20 |
| `beat_and_fell` | médio | Tradicional | 1/2 | 2,0 | 1,0 | 4.297 | 1.152 | 2.242 | 346 | 22 |
|  |  | Code exec | 1/2 | 4,5 | 5,0 | 10.753 | 867 | 3.632 | 9.532 | 23 |
| `capex_increase` | médio | Tradicional | 2/2 | 4,0 | 6,0 | 14.304 | 1.980 | 4.631 | 4.469 | 41 |
|  |  | Code exec | 2/2 | 7,5 | 7,5 | 23.541 | 1.347 | 7.650 | 16.506 | 38 |
| `avg_margin_8q` | grande | Tradicional | 1/2 | 3,5 | 3,0 | 10.989 | 1.637 | 3.680 | 4.209 | 34 |
|  |  | Code exec | 1/2 | 6,5 | 5,5 | 17.567 | 803 | 4.713 | 10.635 | 24 |
| `cagr_history` | grande | Tradicional | 2/2 | 4,0 | 3,0 | 12.696 | 3.794 | 4.755 | 3.641 | 72 |
|  |  | Code exec | 2/2 | 9,5 | 8,5 | 28.556 | 1.773 | 6.048 | 11.129 | 45 |
| `worst_qoq` | grande | Tradicional | 2/2 | 3,0 | 2,0 | 7.611 | 2.047 | 2.823 | 893 | 39 |
|  |  | Code exec | 2/2 | 10,0 | 9,5 | 29.770 | 2.677 | 6.062 | 9.635 | 61 |
| `source_counts` | pequeno | Tradicional | 2/2 | 2,0 | 1,0 | 4.217 | 292 | 2.167 | 189 | 7 |
|  |  | Code exec | 2/2 | 5,5 | 4,5 | 6.223 | 552 | 1.494 | 1.423 | 16 |
| `quality` | médio | Tradicional | 2/2 | 2,5 | 2,0 | 6.213 | 469 | 3.112 | 2.419 | 12 |
|  |  | Code exec | 2/2 | 4,0 | 3,0 | 5.776 | 602 | 2.852 | 5.225 | 17 |

## 4. Por volume de dados da tarefa

| Volume | Servidor | Acertos | Passos | Entrada (tokens) | Saída (tokens) | Pico ctx | Tempo (s) |
|---|---|---:|---:|---:|---:|---:|---:|
| pequeno | Tradicional | 6/6 | 2,0 | 4.221 | 425 | 2.174 | 10 |
|  | Code exec | 5/6 | 4,7 | 5.457 | 508 | 1.715 | 14 |
| médio | Tradicional | 7/8 | 2,6 | 7.254 | 1.008 | 3.034 | 21 |
|  | Code exec | 6/8 | 5,4 | 12.703 | 876 | 4.326 | 24 |
| grande | Tradicional | 5/6 | 3,5 | 10.432 | 2.493 | 3.753 | 48 |
|  | Code exec | 5/6 | 8,7 | 25.298 | 1.751 | 5.607 | 43 |

## 5. Execuções erradas

| Tarefa | Servidor | # | Motivo | Faltou | Proibido | Erro |
|---|---|---:|---|---|---|---|
| `lookup` | Code exec | 1 | resposta incorreta | 62 | - | - |
| `screen_multi` | Code exec | 1 | resposta incorreta | - | AMZN | - |
| `beat_and_fell` | Tradicional | 1 | resposta incorreta | - | 09988.HK | - |
| `beat_and_fell` | Code exec | 1 | resposta incorreta | 00700.HK, 09618.HK, AMD, INTU, META, MSFT, ORCL | - | - |
| `avg_margin_8q` | Tradicional | 1 | resposta incorreta | 57.9, 41.4, 38.5 | - | - |
| `avg_margin_8q` | Code exec | 1 | resposta incorreta | NVDA, 57.9, GOOGL, 41.4, MSFT, 38.5 | - | - |

## 6. Segurança

| Modo | Ataques | Bloqueados | Mitigados | Abertos |
|---|---:|---:|---:|---:|
| namespaces | 40 | 36 | 4 | 0 |
| permission-only | 40 | 36 | 4 | 0 |

