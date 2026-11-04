# Segurança

## Modelo de ameaça

O dashboard é pensado para **uso local ou rede confiável**: não tem autenticação nem HTTPS e escuta em `0.0.0.0`. Não o exponha à internet sem um proxy reverso com autenticação e TLS.

- **`ENABLE_ASK=1`** gasta a sua `ANTHROPIC_API_KEY` para qualquer pessoa que alcance a porta (limite de `ASK_PER_MIN` perguntas por minuto, global).
- **SQL escrito pelo modelo** passa por `dashboard/pipeline/safe-sql.js`: só `SELECT`/`WITH`, banco somente leitura, só as views `v_*`, 5 s e 200 linhas.
- **MCP `code-exec`** executa código escrito por um agente num sandbox (`node --permission` + namespaces Linux). Não é barreira contra um kernel vulnerável; para dados sensíveis, rode num contêiner. Riscos residuais em `dashboard/mcp/docs/design.md`. `node mcp/bench/security.js` roda 40 ataques.
- Chaves ficam em `dashboard/.env` (ignorado pelo git). Nunca as versione.
- `npm audit` aponta o `zod` aninhado em `yahoo-finance2` (consumo de memória ao validar coleções enormes vindas de entrada não confiável). Aqui a entrada é a resposta do Yahoo, não de usuários.

## Reportar uma vulnerabilidade

Abra uma *security advisory* privada no GitHub (aba Security) ou um issue sem detalhes de exploração.
