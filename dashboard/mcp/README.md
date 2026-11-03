# MCPs de dados do dashboard

Dois servidores MCP (stdio) que dão a um agente de IA acesso de **leitura** aos resultados trimestrais do dashboard, com as mesmas dez capacidades expostas de duas formas, mais uma bateria que compara as duas.

| | Quando usar |
|---|---|
| [`traditional/`](traditional/server.js) | Perguntas pontuais e rápidas; clientes que não executam código; ambientes onde não se quer sandbox |
| [`code-exec/`](code-exec/server.js) | Análises que varrem muitos dados (histórico de várias empresas, agregações); quando o contexto do modelo é o gargalo |

**Resumo da comparação:** com uma ferramenta de SQL livre o tradicional é ~2× mais barato; sem ela, o code-exec vence nas tarefas de histórico (menos tokens, menos contexto, mais acertos). Detalhes, método e limites em [docs/benchmark.md](docs/benchmark.md); o desenho em [docs/design.md](docs/design.md); a história da implementação, com o que deu errado, em [docs/implementation-log.md](docs/implementation-log.md).

## Rodando

```bash
npm install                                  # em dashboard/
node mcp/traditional/server.js               # fala MCP por stdin/stdout
node mcp/code-exec/server.js
```

Requer Node ≥ 22.13 e o banco em `data/cache/earnings.db` (`DB_PATH` sobrescreve; o banco é criado pelo `npm start` ou `npm run refresh`). Os servidores não abrem porta de rede e só leem o banco.

Conectar ao Claude Code (`.mcp.json` na raiz do repositório):

```json
{
  "mcpServers": {
    "earnings-traditional": { "command": "node", "args": ["dashboard/mcp/traditional/server.js"] },
    "earnings-code-exec":   { "command": "node", "args": ["dashboard/mcp/code-exec/server.js"] }
  }
}
```

## Estrutura

```
mcp/
  lib/tools.js            as 10 capacidades (fonte única dos dois servidores)
  lib/schema.js           parâmetros → zod / JSON Schema
  traditional/server.js   1 ferramenta MCP por capacidade
  code-exec/
    server.js             search_tools + execute_code
    sandbox.js            geração dos módulos, execução isolada
    harden.mjs            preload: bloqueia node:sqlite e process.kill
    sandbox/              gerado ao subir (servers/, workspace/, skills/, runs/); fora do git
  bench/
    client.js             cliente MCP real (stdio) com medição
    security.js           bateria de ataques (40 casos)
    agent.js              agente LLM (llama-server local) que dirige os servidores
    tasks.js              10 tarefas + verdade em SQL + corretor automático
    llm-bench.js          executor da bateria com LLM
    report.js             gera as tabelas Markdown a partir dos resultados
    regrade.js            reavalia respostas guardadas com o corretor atual
    results/              llm-nothink|nosql|thinking.json (3 baterias), llm-diag.json (diagnóstico
                          das respostas vazias), llm-smoke*.json (testes iniciais), security-*.json, report-*.md
  docs/                   design, diário, benchmark
```

## Testes

```bash
node mcp/bench/security.js                       # 40 ataques aos dois servidores (~1 min)
SANDBOX_NO_NAMESPACES=1 node mcp/bench/security.js   # o mesmo, no modo de recuo sem namespaces
node mcp/bench/llm-bench.js --trials 2           # bateria com LLM (precisa do llama-server em :8080)
node mcp/bench/report.js nothink                 # tabelas a partir dos resultados
node mcp/bench/regrade.js nothink                # reavalia as respostas guardadas com o corretor atual
```

Variáveis do benchmark: `LLM_URL` (padrão `http://127.0.0.1:8080`, API compatível com OpenAI com suporte a `tools`), `--thinking` liga o raciocínio do modelo, `--tasks id,id` filtra as tarefas e `--kinds` escolhe os servidores (`traditional`, `code-exec`, `traditional-nosql`, `code-exec-nosql`; os dois últimos são os mesmos servidores sem `run_sql`, via `EXCLUDE_TOOLS=run_sql`).

## Segurança em uma frase

O banco é somente leitura nos dois; o SQL livre só lê as views e roda em processo com tempo limite; o código do agente no `code-exec` roda num processo filho sem rede, com leitura/escrita restritas a pastas próprias, ambiente vazio, limites de tempo/memória/saída e (no Linux) isolado em namespaces de usuário, PID e rede. Riscos residuais e como mitigar: [docs/design.md](docs/design.md#camadas-de-isolamento).
