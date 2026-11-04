# Ontologia dos resultados trimestrais

Este diretório descreve **o que os dados do dashboard significam**: entidades, métricas, fontes, convenções e armadilhas conhecidas. O arquivo principal é [`earnings.yaml`](earnings.yaml). Ele é lido por pessoas e pelo modelo da função "Pergunte aos dados".

Por que existe: os dados vêm de três fontes (FMP, Yahoo, SEC) com moedas, datas e definições diferentes. Sem um lugar que diga, por exemplo, que o lucro operacional do Yahoo é ajustado e o do SEC é GAAP, cada pessoa (ou cada consulta do modelo) tira uma conclusão diferente.

## Arquivos

| Arquivo | Função |
|---|---|
| `earnings.yaml` | A ontologia: convenções, fontes, entidades, relações, métricas, regras e 10 perguntas de exemplo com SQL |
| `check.js` | Confere que a ontologia ainda bate com o banco: roda os exemplos, verifica as colunas citadas e **exige que toda coluna das views esteja documentada** (veja "Manutenção") |
| `../pipeline/db.js` | Cria as views que a ontologia descreve (migração 2, constante `VIEWS_SQL`) |
| `../pipeline/ask.js` | Usa a ontologia para responder perguntas em linguagem natural |
| `../pipeline/safe-sql.js`, `sql-worker.js` | Execução segura do SQL escrito pelo modelo (autorizador de views, tempo limite, limite de linhas) |
| `../pipeline/quality.js` | Regras de qualidade derivadas das convenções da ontologia |
| `../mcp/` | Servidores MCP que expõem os dados (e a ontologia, via `get_ontology`) a agentes de IA; ver `../mcp/README.md` |

## O que há no `earnings.yaml`

`conventions` (unidades, datas fiscais, câmbio), `sources` (cobertura e limites de cada fonte), `entities` (as 5 views e o significado de cada coluna), `relationships`, `metrics` (17, com fórmula, sinônimos PT/EN e ressalvas), `rules` (regras de interpretação **e de SQL**, incluindo as armadilhas que fizeram o modelo errar nos testes), `known_anomalies` (avisos de `npm run quality` que não indicam erro de dado, com data da conferência) e `examples` (10 perguntas com SQL).

## Modelo de dados

A ontologia descreve **views**, não as tabelas brutas. As tabelas misturam moedas (USD e CNY) e unidades; as views entregam tudo em **bilhões de USD**, com margens e variações já calculadas.

```
v_company   1 linha por empresa      (nome, área, mercado, moeda, câmbio)
v_quarter   1 linha por trimestre    (financeiros, margens, variação a/a, fonte)
v_ttm       soma dos 4 últimos trimestres terminando em cada period_end
v_latest    1 linha por empresa como aparece no painel: último trimestre,
            estimativas, reação do preço, valuation, próximo resultado
v_segment   receita por segmento ou produto, por trimestre (só EUA, vem do SEC):
            a/a com o ano anterior reapresentado, participação, contribuição
            ao crescimento e `taxonomy` (muda quando a empresa reorganiza)
```

Relações: `v_quarter`, `v_ttm`, `v_segment` e `v_latest` ligam a `v_company` por `symbol`. O `v_latest` é o último `v_quarter` da empresa (casando `period_end` com tolerância de ±7 dias).

### Convenções que mais importam

- **Datas, não rótulos.** `period_end` é o fim do trimestre *fiscal*. NVDA fecha em jan/abr/jul/out, MSFT em mar/jun/set/dez. Compare por data (até 46 dias de diferença), nunca por "Q1/Q2".
- **Câmbio da última coleta.** A conversão para USD usa `v_company.fx_to_usd` de hoje, não o câmbio da época do trimestre.
- **Preço e múltiplos são de `v_company.as_of`**, a data da última coleta, não do fim do trimestre.
- **Hong Kong** (Tencent, Xiaomi, Meituan): o Yahoo só fornece receita e lucro dos trimestres de junho. Não há YoY nem TTM fora disso; para o TTM use `v_latest.ttm_*`.

### Fontes e prioridade

| Fonte | Cobre | Observação |
|---|---|---|
| FMP | EUA, últimos 5 trimestres | Principal. Tem EPS real e estimado |
| Yahoo | Todas, ~5 trimestres | Completa lacunas. Lucro operacional **ajustado** |
| Yahoo + empresa | Ajustes manuais em `data/overrides.json` | Valores do release da empresa |
| SEC (EDGAR) | EUA, ~5 anos de 10-Q/10-K | Carga histórica. Lucro operacional **GAAP**. Sem EPS. Nunca sobrescreve outra fonte |

O lucro operacional diverge entre SEC e Yahoo em CRM, ORCL, INTU e SPCX. Sempre informe a fonte ao citá-lo.

## Casos de uso

### Em uso hoje

**1. Perguntas em linguagem natural** (aba Explorar → "Pergunte aos dados")
O modelo recebe a ontologia inteira no prompt, escreve SQL sobre as views e responde com os números e as datas usados. A resposta mostra as consultas executadas para conferência. Exemplos: "Quais empresas mais cresceram a receita?", "Quem bateu o EPS e como o preço reagiu?".

Como ligar (fica desligado por padrão e a caixa nem aparece):

```
# dashboard/.env
ANTHROPIC_API_KEY=...
ENABLE_ASK=1
```

Reinicie o servidor. Variáveis opcionais: `ASK_MODEL` (padrão `claude-opus-5-5`), `ASK_EFFORT` (`low|medium|high`, padrão `medium`), `ASK_PER_MIN` (limite por minuto, padrão 10). Pela linha de comando: `npm run ask -- "pergunta" --sql`.

Salvaguardas no SQL que o modelo escreve (`pipeline/safe-sql.js`, compartilhado com os servidores MCP):
- só `SELECT`/`WITH`, uma instrução por chamada;
- banco aberto **somente leitura**;
- **só as views `v_*`**: um autorizador do SQLite nega a leitura das tabelas brutas e também CTE recursiva, `PRAGMA` e `ATTACH` (a regra "use só as views" deixou de ser só um pedido no prompt);
- a consulta roda num **processo filho com limite de 5 s**; se estourar, o processo é morto e a consulta seguinte cria outro (antes, uma consulta infinita travaria o servidor web inteiro);
- no máximo 200 linhas por resposta.

Além disso, há limite de perguntas por minuto e a resposta é exibida como texto, nunca como HTML. Atenção: o servidor escuta em `0.0.0.0`; com o recurso ligado, quem alcança a porta usa a sua chave. Resíduo conhecido do autorizador: leituras sem nome de coluna (`count(*)`, `MAX(id)`) das tabelas brutas continuam permitidas, porque as próprias views as usam; só vazam contagens.

**2. Teste de consistência da ontologia**
`node ontology/check.js` roda os 10 exemplos e verifica que toda coluna citada existe nas views. Roda sobre o banco real, então pega ontologia desatualizada depois de uma mudança nas views.

**3. Controle de qualidade dos dados**
`npm run quality` executa 19 regras contra o banco (somente leitura), como identidades contábeis (FCF = caixa operacional − capex), duplicatas, margens impossíveis, lacunas no histórico e saltos de receita. Erros saem com código 1; avisos só com `--strict`; `--json` para integrar com outras ferramentas. Foi esse controle que revelou o erro de marcação da ORCL no SEC (ano inteiro gravado como trimestre).

### Possíveis (não implementados)

- **Relatório semanal automático** (quem bateu o EPS, reação do preço, próximos resultados), reaproveitando as mesmas definições e fórmulas.
- ~~Agente ou servidor MCP~~ — **feito**: ver `../mcp/README.md` (a ferramenta `get_ontology` entrega o dicionário ao agente).
- **Busca de métricas por sinônimo** na interface: os sinônimos PT/EN ("margem de lucro", "profit margin", "FCF") já estão no YAML.
- **Novas empresas ou fontes**: a seção `sources` mostra a prioridade e o que uma fonte nova não pode sobrescrever.

## Manutenção

A ontologia só ajuda se estiver correta: se uma view mudar e o YAML ficar velho, o modelo responde errado com confiança.

1. Mudou uma view ou coluna (`pipeline/db.js`)? Atualize o YAML (colunas, métricas, exemplos).
2. Rode `node ontology/check.js`. Falha se algum exemplo quebrar, se citar coluna inexistente ou se uma coluna das views não aparecer no YAML (coluna nova de view = descrição nova na ontologia).
3. Rode `npm run quality` e veja se alguma regra nova de dados faz sentido.

### Como acrescentar uma métrica

Em `metrics:` do YAML:

```yaml
nome_da_metrica:
  label: {pt: "Nome", en: "Name"}
  formula: "como é calculada"
  where: [v_quarter, v_latest]     # onde a coluna existe
  columns: [coluna_a, coluna_b]    # opcional; o check.js valida estes nomes
  synonyms: ["outro nome"]
  caveat: "quando o valor engana ou fica vazio"
```

Se a métrica precisa de uma coluna nova, crie-a primeiro na view (nova migração em `pipeline/db.js`, incrementando `user_version`), depois descreva-a aqui.

### Como acrescentar um exemplo

Em `examples:`, mantendo exatamente este formato (o `check.js` o lê por expressão regular):

```yaml
  - question: "Pergunta em português?"
    sql: |
      SELECT ... FROM v_latest ...
```

O SQL deve usar só as views `v_*`.

## Limitações conhecidas

- EPS não existe para trimestres vindos do SEC (os valores do XBRL não são ajustados por desdobramentos de ações).
- Q4 do SEC é calculado (ano fechado − acumulado de 9 meses), porque não é reportado à parte.
- Hong Kong tem só dois pontos de histórico (junho), por limitação do Yahoo.
- O modelo das perguntas em linguagem natural só foi testado com uma API simulada; a qualidade das respostas e do SQL gerado ainda não foi avaliada com o modelo real.
