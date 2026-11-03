/* Aba Comportamento de uso de produtos: métricas de usuários, engajamento e adoção divulgadas por cada empresa (data/usage.json, curado à mão). */
addDict({
  'us.h': 'Comportamento de uso de produtos',
  'us.note': 'Métricas de usuários, uso e adoção que cada empresa divulga, no último período disponível. Cada empresa define o seu critério (diário, mensal, assinatura, acumulado), então os números não são comparáveis entre empresas. A "Leitura" é uma interpretação deste painel, não recomendação de investimento.',
  'us.search': 'Buscar empresa ou métrica', 'us.kind.all': 'Todos os tipos', 'us.kind.aria': 'Tipo de métrica',
  'us.kind.uso': 'Usuários e uso', 'us.kind.engajamento': 'Engajamento', 'us.kind.comercial': 'Assinaturas e vendas',
  'us.empty': 'Nenhum item para esse filtro.', 'us.read': 'Leitura', 'us.none': 'Sem métrica de uso divulgada',
  'us.prim': 'Fonte primária', 'us.tr': 'Transcrição de terceiros', 'us.press': 'Imprensa', 'us.yoy': '{v} a/a', 'us.prev': 'antes: {v}',
  'us.foot': 'Marquei cada número pela origem: "Fonte primária" foi conferido no documento da própria empresa (comunicado, 10-Q, 6-K ou HKEX); "Transcrição de terceiros" vem da teleconferência transcrita por um site; "Imprensa" vem de cobertura e deve ser conferido. Onde a empresa não divulga um número, o cartão diz isso em vez de estimar. Data da coleta: 30/10/2026.',
  'us.n': 'empresas',
}, {
  'us.h': 'Product usage behavior',
  'us.note': 'User, usage and adoption metrics each company discloses, for the latest available period. Each company defines its own criterion (daily, monthly, subscription, cumulative), so the numbers are not comparable across companies. The "Reading" is this dashboard\'s interpretation, not investment advice.',
  'us.search': 'Search company or metric', 'us.kind.all': 'All types', 'us.kind.aria': 'Metric type',
  'us.kind.uso': 'Users and usage', 'us.kind.engajamento': 'Engagement', 'us.kind.comercial': 'Subscriptions and sales',
  'us.empty': 'No items for this filter.', 'us.read': 'Reading', 'us.none': 'No usage metric disclosed',
  'us.prim': 'Primary source', 'us.tr': 'Third-party transcript', 'us.press': 'Press', 'us.yoy': '{v} YoY', 'us.prev': 'before: {v}',
  'us.foot': 'Each number is tagged by origin: "Primary source" was checked against the company\'s own document (release, 10-Q, 6-K or HKEX); "Third-party transcript" comes from an earnings call transcribed by a site; "Press" comes from coverage and should be verified. Where a company does not disclose a number, the card says so instead of estimating. Collected on 10/30/2026.',
  'us.n': 'companies',
});

const usState = { q: '', mkt: '', kind: '' };
(function fillKinds() {
  const s = document.getElementById('us-kind');
  s.replaceChildren(new Option(t('us.kind.all'), ''), ...['uso', 'engajamento', 'comercial'].map((k) => new Option(t('us.kind.' + k), k)));
})();
const L = (pair) => (Array.isArray(pair) ? (LANG === 'en' ? pair[1] : pair[0]) : pair);
const usNum = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? f0.format(v) : f1.format(v));
const usData = () => { const g = dash.data('usage'); return g.status === 'ok' ? g.data : null; };
const visibleUsage = () => {
  const d = usData(); if (!d) return [];
  const q = usState.q.trim().toLowerCase();
  const out = d.companies.map((co) => {
    if (usState.mkt && co.market !== usState.mkt) return null;
    const metrics = co.metrics.filter((m) => !usState.kind || m.kind === usState.kind)
      .filter((m) => !q || (co.name + ' ' + co.symbol + ' ' + L(m.l)).toLowerCase().includes(q));
    if (usState.kind || q) return metrics.length ? { ...co, metrics } : null;
    return { ...co, metrics };
  }).filter(Boolean);
  return out.sort((a, b) => (b.metrics.length > 0) - (a.metrics.length > 0));
};
const usRedraw = () => { dash.draw('us-list'); dash.draw('us-count'); };
document.getElementById('us-q').addEventListener('input', (e) => { usState.q = e.target.value; usRedraw(); });
document.getElementById('us-mkt').addEventListener('change', (e) => { usState.mkt = e.target.value; usRedraw(); });
document.getElementById('us-kind').addEventListener('change', (e) => { usState.kind = e.target.value; usRedraw(); });
dash.draw('us-count', (el) => { el.textContent = f0.format(visibleUsage().length); });

dash.draw('us-list', (el) => {
  const cos = visibleUsage();
  if (!cos.length) { el.replaceChildren(mk('p', 'nw-empty', t('us.empty'))); return; }
  el.replaceChildren(...cos.map((co) => {
    const card = mk('article', 'nw-co us-co');
    const head = mk('div', 'nw-head');
    head.append(mk('h3', null, co.name), mk('span', 'sym', co.symbol + ' · ' + mktName(co.market) + ' · ' + L(co.period)));
    card.appendChild(head);

    if (co.metrics.length) {
      const ul = mk('ul', 'us-metrics');
      co.metrics.forEach((m) => {
        const li = mk('li', 'us-m');
        const val = mk('div', 'us-val');
        if (m.v != null) val.append(mk('b', null, usNum(m.v)), mk('span', 'us-unit', L(m.u)));
        else val.appendChild(mk('span', 'us-unit', '—'));
        if (m.yoy != null) val.appendChild(mk('span', 'nw-chip ' + tone(m.yoy), t('us.yoy', { v: pct(m.yoy) })));
        const body = mk('div', 'us-body');
        body.appendChild(mk('div', 'nw-title', L(m.l)));
        const sub = [];
        if (m.per) sub.push(L(m.per));
        if (m.prev != null) sub.push(t('us.prev', { v: usNum(m.prev) }));
        if (sub.length) body.appendChild(mk('div', 'us-sub', sub.join(' · ')));
        if (m.n) body.appendChild(mk('p', 'nw-sum', L(m.n)));
        const tag = mk('span', 'nw-tag' + (m.conf === 'primária' ? ' prim' : ''), m.conf === 'primária' ? t('us.prim') : m.conf === 'transcrição' ? t('us.tr') : t('us.press'));
        body.appendChild(mk('div', 'nw-meta')).appendChild(tag);
        li.append(val, body);
        ul.appendChild(li);
      });
      card.appendChild(ul);
    } else card.appendChild(mk('p', 'us-none', t('us.none')));

    const read = mk('p', 'nw-read');
    read.append(mk('b', null, t('us.read')), document.createTextNode(L(co.insight)));
    card.appendChild(read);
    if (/^https:\/\//.test(co.source.url)) {
      const meta = mk('div', 'nw-meta');
      const a = mk('a', null, co.source.label); a.href = co.source.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      meta.appendChild(a); card.appendChild(meta);
    }
    return card;
  }));
});
