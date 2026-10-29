/* Aba de novidades e insights de produtos. O conteúdo está em PT; em EN, aplica a tradução de news-en.json item a item. */
addDict({
  'nw.h': 'Novidades e insights de produtos',
  'nw.note': 'Compilado em 29/10/2026 a partir de comunicados das empresas e da imprensa. Cada item traz a fonte e se ela é primária (da própria empresa) ou da imprensa. A "Leitura" é uma interpretação deste painel, não recomendação de investimento.',
  'nw.search': 'Buscar empresa ou produto', 'nw.cat.all': 'Todas as categorias', 'nw.cat.aria': 'Categoria',
  'nw.empty': 'Nenhum item para esse filtro.', 'nw.read': 'Leitura', 'nw.prim': 'Fonte primária', 'nw.press': 'Imprensa',
  'nw.chip.eps': 'EPS {v} vs. esperado', 'nw.chip.rev': 'Receita {v} a/a', 'nw.chip.next': 'Próximo resultado {d}',
  'nw.foot': 'Itens de imprensa podem divergir da empresa e alguns números não foram conferidos em fonte primária. Onde não achei anúncio recente, o cartão diz isso. Não incluí rumores de produto como se fossem lançamentos: ficam marcados como "Relatado".',
  'cat.Chips e IA': 'Chips e IA', 'cat.IA': 'IA', 'cat.Nuvem': 'Nuvem', 'cat.Software': 'Software', 'cat.Dispositivos': 'Dispositivos', 'cat.Consumo': 'Consumo', 'cat.Comércio': 'Comércio',
  'cat.Mobilidade': 'Mobilidade', 'cat.Robótica': 'Robótica', 'cat.Corporativo': 'Corporativo', 'cat.Resultado': 'Resultado', 'cat.Conectividade': 'Conectividade',
  'st.Anunciado': 'Anunciado', 'st.Divulgado': 'Divulgado', 'st.Lançado': 'Lançado', 'st.Relatado': 'Relatado', 'st.Piloto/Beta': 'Piloto/Beta',
}, {
  'nw.h': 'Product news and insights',
  'nw.note': 'Compiled on 10/29/2026 from company releases and the press. Each item shows its source and whether it is primary (from the company itself) or press. The "Reading" is this dashboard\'s interpretation, not investment advice.',
  'nw.search': 'Search company or product', 'nw.cat.all': 'All categories', 'nw.cat.aria': 'Category',
  'nw.empty': 'No items for this filter.', 'nw.read': 'Reading', 'nw.prim': 'Primary source', 'nw.press': 'Press',
  'nw.chip.eps': 'EPS {v} vs. expected', 'nw.chip.rev': 'Revenue {v} YoY', 'nw.chip.next': 'Next earnings {d}',
  'nw.foot': 'Press items can differ from the company and some numbers were not checked against a primary source. Where I found no recent announcement, the card says so. Product rumors are not presented as launches: they are marked "Reported".',
  'cat.Chips e IA': 'Chips and AI', 'cat.IA': 'AI', 'cat.Nuvem': 'Cloud', 'cat.Software': 'Software', 'cat.Dispositivos': 'Devices', 'cat.Consumo': 'Consumer', 'cat.Comércio': 'Commerce',
  'cat.Mobilidade': 'Mobility', 'cat.Robótica': 'Robotics', 'cat.Corporativo': 'Corporate', 'cat.Resultado': 'Earnings', 'cat.Conectividade': 'Connectivity',
  'st.Anunciado': 'Announced', 'st.Divulgado': 'Disclosed', 'st.Lançado': 'Launched', 'st.Relatado': 'Reported (unconfirmed)', 'st.Piloto/Beta': 'Pilot/Beta',
});

const nwState = { q: '', mkt: '', cat: '' };
const padDate = (s) => { const [y, m = '00', d = '00'] = String(s).split('-'); return y + '-' + m + '-' + d; };
const NW_CATS = ['Chips e IA', 'IA', 'Nuvem', 'Software', 'Dispositivos', 'Consumo', 'Comércio', 'Mobilidade', 'Robótica', 'Corporativo', 'Resultado', 'Conectividade'];
(function fillCats() {
  const s = document.getElementById('nw-cat');
  s.replaceChildren(new Option(t('nw.cat.all'), ''), ...NW_CATS.map((c) => new Option(t('cat.' + c), c)));
})();
// em EN, sobrepõe título, resumo e "leitura" com a tradução (alinhada pela posição original)
const newsOf = () => {
  const g = dash.data('news'); if (g.status !== 'ok') return [];
  const en = LANG === 'en' ? (dash.data('newsEn').data || {}) : null;
  if (!en) return g.data;
  return g.data.map((co) => {
    const e = en[co.symbol]; if (!e) return co;
    return { ...co, insight: e.insight || co.insight, items: co.items.map((i, k) => ({ ...i, title: (e.items[k] && e.items[k].title) || i.title, summary: (e.items[k] && e.items[k].summary) || i.summary })) };
  });
};
const visibleNews = () => {
  const q = nwState.q.trim().toLowerCase();
  return newsOf().map((co) => {
    if (nwState.mkt && co.market !== nwState.mkt) return null;
    const items = co.items
      .filter((i) => !nwState.cat || i.category === nwState.cat)
      .filter((i) => !q || (co.name + ' ' + co.symbol + ' ' + i.title + ' ' + i.summary).toLowerCase().includes(q))
      .sort((a, b) => padDate(b.date).localeCompare(padDate(a.date)));
    return items.length ? { ...co, items } : null;
  }).filter(Boolean).sort((a, b) => padDate(b.items[0].date).localeCompare(padDate(a.items[0].date)));
};
document.getElementById('nw-q').addEventListener('input', (e) => { nwState.q = e.target.value; dash.draw('nw-list'); dash.draw('nw-count'); });
document.getElementById('nw-mkt').addEventListener('change', (e) => { nwState.mkt = e.target.value; dash.draw('nw-list'); dash.draw('nw-count'); });
document.getElementById('nw-cat').addEventListener('change', (e) => { nwState.cat = e.target.value; dash.draw('nw-list'); dash.draw('nw-count'); });
dash.draw('nw-count', (el) => { el.textContent = f0.format(visibleNews().length); });

dash.draw('nw-list', (el) => {
  const cos = visibleNews();
  if (!cos.length) { el.replaceChildren(mk('p', 'nw-empty', t('nw.empty'))); return; }
  const byS = new Map(rowsOf().map((r) => [r.symbol, r]));
  el.replaceChildren(...cos.map((co) => {
    const card = mk('article', 'nw-co');
    const head = mk('div', 'nw-head');
    head.append(mk('h3', null, co.name), mk('span', 'sym', co.symbol + ' · ' + mktName(co.market)));
    card.appendChild(head);

    const r = byS.get(co.symbol);
    if (r) {
      const chips = mk('div', 'nw-chips');
      if (r.epsSurprisePct != null) chips.appendChild(mk('span', 'nw-chip ' + (r.epsSurprisePct > 2 ? 'up' : r.epsSurprisePct < -2 ? 'down' : ''), t('nw.chip.eps', { v: pct(r.epsSurprisePct) })));
      if (r.revenueYoY != null) chips.appendChild(mk('span', 'nw-chip ' + tone(r.revenueYoY), t('nw.chip.rev', { v: pct(r.revenueYoY) })));
      if (r.nextEarnings) chips.appendChild(mk('span', 'nw-chip', t('nw.chip.next', { d: date(r.nextEarnings) })));
      card.appendChild(chips);
    }

    const read = mk('p', 'nw-read');
    read.append(mk('b', null, t('nw.read')), document.createTextNode(co.insight));
    card.appendChild(read);

    const ul = mk('ul', 'nw-items');
    co.items.forEach((i) => {
      const li = mk('li', 'nw-item');
      li.appendChild(mk('div', 'nw-date', dateLabel(i.date)));
      const body = mk('div');
      body.append(mk('div', 'nw-title', i.title), mk('p', 'nw-sum', i.summary));
      const meta = mk('div', 'nw-meta');
      meta.append(mk('span', 'nw-tag', t('st.' + i.status)), mk('span', 'nw-tag', t('cat.' + i.category)), mk('span', 'nw-tag' + (i.confidence === 'primária' ? ' prim' : ''), i.confidence === 'primária' ? t('nw.prim') : t('nw.press')));
      if (/^https:\/\//.test(i.url)) {
        const a = mk('a', null, i.source);
        a.href = i.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        meta.appendChild(a);
      } else meta.appendChild(mk('span', null, i.source));
      body.appendChild(meta);
      li.appendChild(body);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    return card;
  }));
});
