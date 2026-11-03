# Desenho dos servidores MCP

Dois servidores MCP expõem as **mesmas dez capacidades** de consulta aos dados do dashboard, de duas formas:

| | Tradicional (`traditional/server.js`) | Code execution (`code-exec/server.js`) |
|---|---|---|
| Ferramentas MCP anunciadas | 10 (uma por capacidade) | 2: `search_tools` e `execute_code` |
| Quem decide a sequência de chamadas | O modelo, uma chamada por turno | O código que o modelo escreve, num só turno |
| Onde passam os dados intermediários | **No contexto do modelo** | No sandbox; só o que o código imprime volta |
| Descoberta das ferramentas | Tudo carregado antes da 1ª pergunta | Sob demanda (`search_tools`: nome → descrição → esquema) |
| Isolamento necessário | Nenhum além do banco somente leitura | Sandbox (processo filho, permissões, namespaces) |

O padrão do segundo é o descrito em [Code execution with MCP](https://www.anthropic.com/research/code-execution-with-mcp).

## Fonte única das capacidades

`lib/tools.js` registra as 10 ferramentas (nome, descrição, parâmetros, função). Os dois servidores são gerados dele, então **a comparação mede a forma de expor, não o que se expõe**.

| Ferramenta | Faz | Tamanho típico da resposta |
|---|---|---|
| `list_companies` | Empresas, com filtro por mercado/área | pequeno |
| `get_company_snapshot` | Linha completa de uma empresa (36 campos) | pequeno |
| `list_latest` | Última linha de **todas** as empresas; aceita `columns` | médio (≈14 KB com todas as colunas) |
| `rank_companies` | Ranking por uma métrica | pequeno |
| `get_quarters` | Histórico de **uma** empresa (até 40 trimestres, 29 colunas) | médio/grande |
| `get_ttm` | Soma móvel de 4 trimestres | pequeno |
| `get_upcoming_earnings` | Próximas divulgações | pequeno |
| `get_ontology` | Dicionário de dados (por seção) | médio/grande |
| `check_data_quality` | Regras de qualidade com problemas | pequeno/médio |
| `run_sql` | SELECT livre sobre as views | variável (≤200 linhas) |

Os parâmetros são descritos num formato simples e convertidos para zod (servidor tradicional) e JSON Schema (documentação gerada do code-exec) por `lib/schema.js`. Colunas pedidas pelo cliente só entram no SQL depois de validadas contra `PRAGMA table_info`.

### Variantes para o benchmark

`EXCLUDE_TOOLS=run_sql,get_ontology` (lista separada por vírgulas) tira ferramentas **dos dois servidores** na hora de subir (`lib/tools.js`); uma chamada a uma ferramenta excluída é recusada como "desconhecida". O benchmark usa `EXCLUDE_TOOLS=run_sql` para as variantes `traditional-nosql` e `code-exec-nosql`, que isolam o efeito do padrão do efeito de ter SQL livre. Em produção não é necessário.

## Servidor tradicional

Registra cada ferramenta com `registerTool` (SDK oficial, stdio), devolve JSON compacto e erros como `isError: true`. É simples de propósito: serve de linha de base.

## Servidor code-exec

### Layout em disco (`code-exec/sandbox/`, gerado ao subir)

```
servers/earnings/<funcao>.js    uma função por ferramenta, com JSDoc; valida o argumento e mostra a assinatura no erro
servers/earnings/index.js       reexporta todas
servers/_client.js              ponte IPC para as ferramentas reais (executadas fora do sandbox)
workspace/                      arquivos intermediários do agente (persistem entre execuções)
skills/                         código reutilizável salvo pelo agente (persiste)
runs/<id>.mjs                   o código de cada execução (apagado ao terminar)
```

Corresponde ao `servers/<servidor>/<ferramenta>` do artigo, em JavaScript em vez de TypeScript (sem etapa de build no sandbox).

### Fluxo de uma execução

```
modelo ──execute_code(código)──▶ servidor MCP (pai)
                                   │ grava runs/<id>.mjs
                                   │ spawn: unshare → node --permission --import harden.mjs runs/<id>.mjs
                                   ▼
                                sandbox (filho)
                                   │ import { rankCompanies } from '../servers/earnings/index.js'
                                   │ await rankCompanies({...})  ──IPC──▶ pai executa lib/tools.js (somente leitura) ──▶ resultado
                                   │ filtra/agrega em JS
                                   │ console.log(só o resultado)
modelo ◀── stdout + rodapé [ok · N chamadas · X ms] ─┘
```

Decisão importante: **o filho nunca abre o banco**. Toda consulta é uma mensagem IPC ao pai, que roda a mesma ferramenta do servidor tradicional. Assim as duas soluções compartilham a lógica de acesso a dados e o filho não precisa de acesso ao arquivo.

### Descoberta progressiva

`search_tools({ query, detail })` com três níveis: `name` (só o nome da função), `description` (com a linha de `import`) e `schema` (esquema completo dos parâmetros). A busca vale para nomes em camelCase ou snake_case e para qualquer palavra; sem resultado, devolve a lista de funções disponíveis.

### Camadas de isolamento

| Camada | O que impede | Obs. |
|---|---|---|
| `node --permission` | Ler fora de `servers/ workspace/ skills/ runs/`, escrever fora de `workspace/ skills/`, rede, processos, workers, addons | Nativo do Node |
| Namespaces `unshare --user --pid --net --mount-proc` | Ver ou sinalizar outros processos (inclusive o servidor), usar qualquer interface de rede | Só Linux. Sem `unshare`, cai para o modo `permission-only` |
| `harden.mjs` (`--import`) | `node:sqlite` (que **ignora** o `--permission`) e `process.kill` | Melhor esforço, no mesmo processo; é a rede de proteção do modo de recuo |
| Ambiente vazio | Vazar chaves de API do processo pai | O filho só recebe `NODE_NO_WARNINGS` |
| Limites | `--max-old-space-size=256`, 30 s (máx. 120 s), 32 KB de saída, 500 chamadas de ferramenta, aviso de cota de 50 MB | Tempo e memória matam o processo |

O modo ativo aparece em `sandbox.ISOLATION` (`namespaces+permission` ou `permission-only`). `SANDBOX_NO_NAMESPACES=1` força o recuo.

**Riscos residuais (assumidos e documentados):**
- Escrita em disco no `workspace/` não é impedida, só sinalizada depois (cota de 50 MB). Um laço de 30 s pode gravar vários GB.
- O preload é "melhor esforço": no modo `permission-only`, um código determinado a escapar do mesmo processo tem mais superfície do que dentro dos namespaces.
- `skills/` persiste código entre execuções: um agente comprometido por prompt injection pode deixar código lá. Ele roda no mesmo sandbox, então o dano fica limitado a `workspace/` e `skills/`, mas vale esvaziar `skills/` ao trocar de usuário ou de contexto.
- O sandbox não é uma barreira contra um kernel vulnerável (namespaces de usuário têm histórico de CVEs). Para dados sensíveis, rode o servidor num contêiner.

## SQL livre (`run_sql`) — `pipeline/safe-sql.js`

Usado pelos dois servidores **e** pela função "Pergunte aos dados". Quatro barreiras: só `SELECT/WITH` de uma instrução; banco somente leitura; autorizador do SQLite que só deixa ler as views `v_*` e nega CTE recursiva, PRAGMA, ATTACH e escrita; execução em processo filho com tempo limite de 5 s (SIGKILL) e leitura de no máximo 200 linhas por iteração. Ver o [diário](implementation-log.md#7-primeira-bateria-de-segurança--6-falhas-encontradas) para o porquê de cada uma.

## Como conectar a um cliente MCP

Claude Code (`.mcp.json` na raiz do projeto, ou `claude mcp add`):

```json
{
  "mcpServers": {
    "earnings-traditional": { "command": "node", "args": ["dashboard/mcp/traditional/server.js"] },
    "earnings-code-exec":   { "command": "node", "args": ["dashboard/mcp/code-exec/server.js"] }
  }
}
```

Requer Node ≥ 22.13 (`node:sqlite`); o sandbox usa `--permission` e `module.registerHooks` (testado no Node 26.4). O banco é `data/cache/earnings.db` (`DB_PATH` sobrescreve). Os servidores usam stdio e **não abrem porta de rede**.
