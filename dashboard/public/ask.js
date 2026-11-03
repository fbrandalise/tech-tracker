/* Aba Explorar: pergunta em linguagem natural. A caixa só aparece quando o servidor está com ENABLE_ASK=1 e a chave da API. */
addDict({
  'ask.h': 'Pergunte aos dados', 'ask.go': 'Perguntar', 'ask.busy': 'Consultando…',
  'ask.note': 'Pergunte em linguagem natural; a resposta vem de consultas ao banco, que você pode conferir abaixo dela. Cada pergunta usa a API do modelo e leva alguns segundos.',
  'ask.ph': 'Ex.: Quais empresas mais cresceram a receita no último trimestre?',
  'ask.wait': 'Consultando os dados…', 'ask.err': 'Não foi possível responder agora.',
  'ask.sql': 'Consultas usadas ({n})', 'ask.rows': '{n} linhas', 'ask.sqlErr': 'erro',
  'ask.e1': 'Quais empresas mais cresceram a receita?', 'ask.e2': 'Quais têm fluxo de caixa livre negativo?', 'ask.e3': 'Quem bateu a estimativa de EPS e como o preço reagiu?', 'ask.e4': 'Qual o capex em relação à receita de cada big tech?',
}, {
  'ask.h': 'Ask the data', 'ask.go': 'Ask', 'ask.busy': 'Working…',
  'ask.note': 'Ask in plain language; the answer comes from queries to the database, which you can check below it. Each question uses the model API and takes a few seconds.',
  'ask.ph': 'E.g. Which companies grew revenue the most last quarter?',
  'ask.wait': 'Querying the data…', 'ask.err': 'Could not answer right now.',
  'ask.sql': 'Queries used ({n})', 'ask.rows': '{n} rows', 'ask.sqlErr': 'error',
  'ask.e1': 'Which companies grew revenue the most?', 'ask.e2': 'Which have negative free cash flow?', 'ask.e3': 'Who beat the EPS estimate and how did the price react?', 'ask.e4': 'What is capex as a share of revenue for each big tech?',
});

(function () {
  const card = document.getElementById('ask-card');
  if (!card) return;
  fetch('/api/ask').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.enabled) init(); }).catch(() => { /* sem servidor: a caixa fica escondida */ });

  function init() {
    const form = document.getElementById('ask-form'), input = document.getElementById('ask-q'), go = document.getElementById('ask-go');
    const out = document.getElementById('ask-out'), ex = document.getElementById('ask-ex');
    input.placeholder = t('ask.ph');
    let busy = false;

    const render = (r) => {
      const nodes = [mk('p', 'ask-ans', r.answer || '')];   // sempre como texto, nunca como HTML
      if (r.queries && r.queries.length) {
        const d = mk('details', 'ask-sql'); d.appendChild(mk('summary', null, t('ask.sql', { n: r.queries.length })));
        for (const q of r.queries) d.appendChild(mk('pre', null, q.sql + '\n-- ' + (q.error ? t('ask.sqlErr') + ': ' + q.error : t('ask.rows', { n: q.rowCount }))));
        nodes.push(d);
      }
      out.replaceChildren(...nodes);
    };

    async function submit(q) {
      q = q.trim();
      if (!q || busy) return;
      busy = true; go.disabled = true; go.textContent = t('ask.busy');
      out.replaceChildren(mk('p', 'ask-wait', t('ask.wait')));
      try {
        const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, lang: LANG }), signal: AbortSignal.timeout(180000) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) out.replaceChildren(mk('p', 'ask-err', j.error || t('ask.err')));
        else render(j);
      } catch (e) { out.replaceChildren(mk('p', 'ask-err', t('ask.err'))); }
      busy = false; go.disabled = false; go.textContent = t('ask.go');
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); submit(input.value); });
    ex.replaceChildren(...['ask.e1', 'ask.e2', 'ask.e3', 'ask.e4'].map((k) => {
      const b = mk('button', 'chip', t(k)); b.type = 'button';
      b.addEventListener('click', () => { input.value = t(k); submit(t(k)); });
      return b;
    }));
    card.hidden = false;
  }
})();
