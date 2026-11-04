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
  'cat.Preço': 'Preço', 'cat.Estratégia': 'Estratégia',
  'nw.view.aria': 'Visão', 'nw.view.company': 'Por empresa', 'nw.view.timeline': 'Linha do tempo', 'nw.onlynew': 'Só novos', 'nw.markseen': 'Marcar tudo como visto', 'nw.new': 'Novo', 'nw.newcount': '{n} novos',
  'nw.link.seg': 'Receita do segmento "{s}"', 'nw.link.of': '{p} da receita', 'nw.link.yoy': '{v} a/a', 'nw.link.use': 'Uso', 'nw.link.by': 'Vínculo sugerido por este painel; confira antes de usar.',
  'nw.stage.ann': 'Anunciado', 'nw.stage.beta': 'Beta', 'nw.stage.prod': 'Produção em escala', 'nw.stage.ga': 'Disponível', 'nw.stage.days': '{n} dias do anúncio à disponibilidade',
  'nw.tl.undated': 'Sem mês definido',
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
  'cat.Preço': 'Pricing', 'cat.Estratégia': 'Strategy',
  'nw.view.aria': 'View', 'nw.view.company': 'By company', 'nw.view.timeline': 'Timeline', 'nw.onlynew': 'New only', 'nw.markseen': 'Mark all as seen', 'nw.new': 'New', 'nw.newcount': '{n} new',
  'nw.link.seg': 'Revenue of the "{s}" segment', 'nw.link.of': '{p} of revenue', 'nw.link.yoy': '{v} YoY', 'nw.link.use': 'Usage', 'nw.link.by': 'Link suggested by this dashboard; check it before relying on it.',
  'nw.stage.ann': 'Announced', 'nw.stage.beta': 'Beta', 'nw.stage.prod': 'Volume production', 'nw.stage.ga': 'Available', 'nw.stage.days': '{n} days from announcement to availability',
  'nw.tl.undated': 'No month set',
});

const nwState = { q: '', mkt: '', cat: '', view: 'company', onlyNew: false };
const padDate = (s) => { const [y, m = '00', d = '00'] = String(s).split('-'); return y + '-' + m + '-' + d; };
const NW_CATS = ['Chips e IA', 'IA', 'Nuvem', 'Software', 'Dispositivos', 'Consumo', 'Comércio', 'Mobilidade', 'Robótica', 'Corporativo', 'Resultado', 'Conectividade', 'Preço', 'Estratégia'];
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
// "novo" = item que esta pessoa ainda não viu neste navegador. Na primeira visita tudo entra como visto, para não marcar a lista inteira.
const NW_KEY = 'nw-seen-v1';
const nwId = (co, i) => co.symbol + '|' + i.date + '|' + i.title;
const nwSeen = (() => {
  let a = null;
  try { a = JSON.parse(localStorage.getItem(NW_KEY)); } catch (e) { /* sem armazenamento: nada é marcado */ }
  return { set: new Set(Array.isArray(a) ? a : []), fresh: !Array.isArray(a) };
})();
const nwSave = () => { try { localStorage.setItem(NW_KEY, JSON.stringify([...nwSeen.set])); } catch (e) { /* ignora */ } };
// os ids usam o texto original em PT, que é o que está em news.json (a tradução EN muda só o título exibido)
const nwOrig = () => { const g = dash.data('news'); return g.status === 'ok' ? g.data : []; };
const isNew = (co, i) => !nwSeen.fresh && !nwSeen.set.has(nwOriginalId(co.symbol, i._k));
const nwOriginalId = (symbol, k) => { const co = nwOrig().find((c) => c.symbol === symbol); const it = co && co.items[k]; return it ? nwId(co, it) : symbol + '|' + k; };
const nwSeedIfFresh = () => { if (!nwSeen.fresh) return; nwSeen.fresh = false; nwOrig().forEach((co) => co.items.forEach((i) => nwSeen.set.add(nwId(co, i)))); nwSave(); };
const nwNewCount = () => nwOrig().reduce((n, co) => n + co.items.filter((i) => !nwSeen.set.has(nwId(co, i))).length, 0);
const visibleNews = () => {
  const q = nwState.q.trim().toLowerCase();
  return newsOf().map((co) => {
    if (nwState.mkt && co.market !== nwState.mkt) return null;
    const items = co.items.map((i, k) => ({ ...i, _k: k }))
      .filter((i) => !nwState.onlyNew || isNew(co, i))
      .filter((i) => !nwState.cat || i.category === nwState.cat)
      .filter((i) => !q || (co.name + ' ' + co.symbol + ' ' + i.title + ' ' + i.summary).toLowerCase().includes(q))
      .sort((a, b) => padDate(b.date).localeCompare(padDate(a.date)));
    return items.length ? { ...co, items } : null;
  }).filter(Boolean).sort((a, b) => padDate(b.items[0].date).localeCompare(padDate(a.items[0].date)));
};
document.getElementById('nw-q').addEventListener('input', (e) => { nwState.q = e.target.value; dash.draw('nw-list'); dash.draw('nw-count'); });
document.getElementById('nw-mkt').addEventListener('change', (e) => { nwState.mkt = e.target.value; dash.draw('nw-list'); dash.draw('nw-count'); });
document.getElementById('nw-cat').addEventListener('change', (e) => { nwState.cat = e.target.value; dash.draw('nw-list'); dash.draw('nw-count'); });
document.querySelectorAll('.lx-seg[data-kind="nwview"] button').forEach((b) => b.addEventListener('click', () => {
  nwState.view = b.dataset.v;
  document.querySelectorAll('.lx-seg[data-kind="nwview"] button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  dash.draw('nw-list');
}));
document.getElementById('nw-new').addEventListener('change', (e) => { nwState.onlyNew = e.target.checked; dash.draw('nw-list'); dash.draw('nw-count'); });
document.getElementById('nw-seen').addEventListener('click', () => {
  nwOrig().forEach((co) => co.items.forEach((i) => nwSeen.set.add(nwId(co, i)))); nwSeen.fresh = false; nwSave();
  dash.draw('nw-list'); dash.draw('nw-count'); dash.draw('nw-new-count');
});
dash.draw('nw-count', (el) => { el.textContent = f0.format(visibleNews().length); });

// ---- vínculos: receita do segmento e métrica de uso ligadas ao item ------------------------------
const pair = (p) => (Array.isArray(p) ? (LANG === 'en' ? p[1] : p[0]) : p);
function linkChips(co, i) {
  const out = [];
  const l = i.link; if (!l) return out;
  const r = rowsOf().find((x) => x.symbol === co.symbol);
  if (l.segment && r && r.seg && r.seg.g) {
    const it = r.seg.g.flatMap((g) => g.i).find((x) => x.n === l.segment);
    if (it) {
      const yoy = it.y != null ? it.y : (it.p ? (it.v / it.p - 1) * 100 : null);
      const share = r.revenueB ? it.v / r.revenueB * 100 : null;
      const parts = [t('nw.link.seg', { s: it.n }) + ': ' + f1.format(it.v) + ' ' + t('u.bn') + ' ' + r.currency];
      if (yoy != null) parts.push(t('nw.link.yoy', { v: pct(yoy) }));
      if (share != null && share <= 100) parts.push(t('nw.link.of', { p: pctPlain(share) }));
      out.push(mk('span', 'nw-link ' + (yoy == null ? '' : tone(yoy)), parts.join(' · ')));
    }
  }
  if (l.usage != null) {
    const u = (dash.data('usage').data || {}).companies;
    const m = u && (u.find((c) => c.symbol === co.symbol) || {}).metrics;
    const x = m && m[l.usage];
    if (x) {
      const v = (Math.abs(x.v) >= 100 || Number.isInteger(x.v) ? f0 : f1).format(x.v);
      out.push(mk('span', 'nw-link', t('nw.link.use') + ' · ' + pair(x.l) + ': ' + v + ' ' + pair(x.u) + (x.yoy != null ? ' · ' + t('nw.link.yoy', { v: pct(x.yoy) }) : '')));
    }
  }
  if (out.length) out.push(mk('span', 'nw-by', '*'));
  if (out.length) out[out.length - 1].title = t('nw.link.by');
  return out;
}

// maturidade: só aparece quando o item traz as datas de cada estágio (stages: { announced, beta, production, ga }, formato AAAA-MM-DD)
function stageLine(i) {
  const s = i.stages; if (!s || !(s.announced || s.beta || s.production || s.ga)) return null;
  const steps = [['announced', 'ann'], ['beta', 'beta'], ['production', 'prod'], ['ga', 'ga']].filter(([k]) => s[k]).map(([k, n]) => t('nw.stage.' + n) + ' ' + date(s[k]));
  let txt = steps.join(' → ');
  if (s.announced && s.ga) txt += ' · ' + t('nw.stage.days', { n: Math.round((Date.parse(s.ga) - Date.parse(s.announced)) / 864e5) });
  return mk('div', 'nw-stages', txt);
}

function itemBody(co, i, withCo) {
  const body = mk('div');
  const title = mk('div', 'nw-title');
  if (withCo) title.appendChild(mk('span', 'nw-co-tag', co.name));
  title.appendChild(document.createTextNode(i.title));
  if (isNew(co, i)) title.appendChild(mk('span', 'nw-new-badge', t('nw.new')));
  body.append(title, mk('p', 'nw-sum', i.summary));
  const chips = linkChips(co, i);
  if (chips.length) { const w = mk('div', 'nw-links'); w.append(...chips); body.appendChild(w); }
  const st = stageLine(i); if (st) body.appendChild(st);
  const meta = mk('div', 'nw-meta');
  meta.append(mk('span', 'nw-tag', t('st.' + i.status)), mk('span', 'nw-tag', t('cat.' + i.category)), mk('span', 'nw-tag' + (i.confidence === 'primária' ? ' prim' : ''), i.confidence === 'primária' ? t('nw.prim') : t('nw.press')));
  if (/^https:\/\//.test(i.url)) {
    const a = mk('a', null, i.source);
    a.href = i.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    meta.appendChild(a);
  } else meta.appendChild(mk('span', null, i.source));
  body.appendChild(meta);
  return body;
}

dash.draw('nw-new-count', (el) => { const n = nwSeen.fresh ? 0 : nwNewCount(); el.textContent = n ? t('nw.newcount', { n }) : ''; el.hidden = !n; });

dash.draw('nw-list', (el) => {
  nwSeedIfFresh();
  dash.draw('nw-new-count');
  const cos = visibleNews();
  if (!cos.length) { el.replaceChildren(mk('p', 'nw-empty', t('nw.empty'))); return; }

  if (nwState.view === 'timeline') {
    // todos os itens de todas as empresas, do mais novo ao mais antigo, agrupados por mês
    const flat = cos.flatMap((co) => co.items.map((i) => ({ co, i }))).sort((a, b) => padDate(b.i.date).localeCompare(padDate(a.i.date)));
    const wrap = mk('div', 'nw-tl');
    let month = null, ul = null;
    flat.forEach(({ co, i }) => {
      const m = String(i.date).slice(0, 7);
      if (m !== month) {
        month = m;
        const h = mk('h3', 'nw-tl-m', /^\d{4}-\d{2}$/.test(m) ? monthName(m + '-01') : /^\d{4}$/.test(m) ? m : t('nw.tl.undated'));
        ul = mk('ul', 'nw-items'); wrap.append(h, ul);
      }
      const li = mk('li', 'nw-item');
      li.append(mk('div', 'nw-date', dateLabel(i.date)), itemBody(co, i, true));
      ul.appendChild(li);
    });
    el.replaceChildren(wrap);
    el.classList.add('nw-tl-on');
    return;
  }
  el.classList.remove('nw-tl-on');

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
      li.append(mk('div', 'nw-date', dateLabel(i.date)), itemBody(co, i, false));
      ul.appendChild(li);
    });
    card.appendChild(ul);
    return card;
  }));
});
