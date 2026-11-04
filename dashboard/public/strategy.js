/* Visões "Promessas" e "Estratégia" da aba Novidades. Dados: data/promises.json e data/strategy.json (curados à mão, cada linha com fonte). */
addDict({
  'pr.note': 'O que cada empresa disse que lançaria e quando, contra o que entregou. "A confirmar" significa que o prazo venceu e não achei confirmação da entrega, o que não prova atraso.',
  'pr.said': 'Disse', 'pr.deliv': 'Entregou', 'pr.target': 'Prazo', 'pr.none': 'Sem confirmação de entrega.', 'pr.nodate': 'sem data',
  'pr.st.cumprida': 'Cumprida no prazo', 'pr.st.tardia': 'Cumprida com atraso', 'pr.st.parcial': 'Parcial', 'pr.st.aberto': 'Em aberto', 'pr.st.confirmar': 'A confirmar', 'pr.st.semprazo': 'Sem prazo',
  'pr.sum': '{n} promessas', 'pr.empty': 'Nenhuma promessa para esse filtro.',
  'st.h.money': 'Para onde vai o dinheiro', 'st.money.note': 'P&D e capex em % da receita do último trimestre, e o crescimento do P&D contra o ano anterior. Ordenado por capex.',
  'st.col.co': 'Empresa', 'st.col.rd': 'P&D', 'st.col.rdy': 'P&D a/a', 'st.col.cx': 'Capex', 'st.col.rev': 'Receita a/a',
  'st.h.thesis': 'Tese declarada pela gestão', 'st.thesis.note': 'Resumo, com as minhas palavras, do que a gestão disse no último comunicado de resultados. Cada tese tem a fonte e a data.',
  'st.deals': 'Aquisições, parcerias e clientes', 'st.deal.unchecked': 'Item de curadoria anterior, ainda não conferido em fonte própria.',
  'st.kind.aquisição': 'Aquisição', 'st.kind.parceria': 'Parceria', 'st.kind.cliente': 'Cliente',
  'st.h.change': 'Mudança na forma de reportar', 'st.change.note': 'Avisos das próprias empresas sobre reorganização de segmentos: a comparação com períodos antigos muda.',
  'st.none': 'Sem tese ou acordos curados ainda.',
}, {
  'pr.note': 'What each company said it would ship and when, against what it delivered. "To confirm" means the deadline passed and I found no confirmation of delivery, which does not prove a delay.',
  'pr.said': 'Said', 'pr.deliv': 'Delivered', 'pr.target': 'Target', 'pr.none': 'No delivery confirmed.', 'pr.nodate': 'no date',
  'pr.st.cumprida': 'Met on time', 'pr.st.tardia': 'Met late', 'pr.st.parcial': 'Partial', 'pr.st.aberto': 'Open', 'pr.st.confirmar': 'To confirm', 'pr.st.semprazo': 'No deadline',
  'pr.sum': '{n} promises', 'pr.empty': 'No promises for this filter.',
  'st.h.money': 'Where the money goes', 'st.money.note': 'R&D and capex as % of latest-quarter revenue, and R&D growth against the prior year. Sorted by capex.',
  'st.col.co': 'Company', 'st.col.rd': 'R&D', 'st.col.rdy': 'R&D YoY', 'st.col.cx': 'Capex', 'st.col.rev': 'Revenue YoY',
  'st.h.thesis': 'Thesis stated by management', 'st.thesis.note': 'A summary, in my own words, of what management said in the latest earnings release. Each thesis has its source and date.',
  'st.deals': 'Acquisitions, partnerships and customers', 'st.deal.unchecked': 'Item from earlier curation, not yet checked against its own source.',
  'st.kind.aquisição': 'Acquisition', 'st.kind.parceria': 'Partnership', 'st.kind.cliente': 'Customer',
  'st.h.change': 'Change in how it reports', 'st.change.note': 'Notices from the companies themselves about segment reorganizations: comparison with older periods changes.',
  'st.none': 'No thesis or deals curated yet.',
});

// usa o campo *_en quando a interface está em inglês e ele existe
const nwL = (o, k) => (LANG === 'en' && o && o[k + '_en'] != null ? o[k + '_en'] : o && o[k]);
const nwToday = () => new Date().toISOString().slice(0, 10);
const nwPartDate = (s) => (s ? dateLabel(s) : t('pr.nodate'));
// cumprida: entregou até o prazo (ou sem prazo). tardia: entregou depois. parcial: entrega parcial. confirmar: prazo vencido sem prova. aberto: prazo no futuro.
function promiseStatus(p) {
  const d = p.delivered, tgt = p.said.targetDate;
  if (d && d.partial) return 'parcial';
  if (d) return !tgt || !d.date || d.date <= tgt ? 'cumprida' : 'tardia';
  if (tgt) return nwToday() > tgt ? 'confirmar' : 'aberto';
  return 'semprazo';
}
const stTone = { cumprida: 'ok', tardia: 'warn', parcial: 'warn', confirmar: 'warn', aberto: '', semprazo: '' };
const srcLink = (label, url) => {
  if (/^https:\/\//.test(url)) { const a = mk('a', null, label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
  return mk('span', null, label);
};
const nwFilterCo = (st, symbol) => {
  const r = rowsOf().find((x) => x.symbol === symbol);
  if (st.mkt && (!r || r.market !== st.mkt)) return false;
  const q = st.q.trim().toLowerCase();
  return !q || (symbol + ' ' + (r ? r.name : '')).toLowerCase().includes(q);
};

function nwDrawPromises(el, st) {
  const g = dash.data('promises'); const all = (g.status === 'ok' ? g.data : []).filter((p) => nwFilterCo(st, p.symbol));
  if (!all.length) { el.replaceChildren(mk('p', 'nw-empty', t('pr.empty'))); return; }
  const names = new Map(rowsOf().map((r) => [r.symbol, r.name]));
  const counts = {}; all.forEach((p) => { const s = promiseStatus(p); counts[s] = (counts[s] || 0) + 1; });
  const sum = mk('div', 'pr-sum');
  sum.appendChild(mk('span', 'pr-total', t('pr.sum', { n: all.length })));
  ['cumprida', 'tardia', 'parcial', 'aberto', 'confirmar', 'semprazo'].filter((k) => counts[k]).forEach((k) => sum.appendChild(mk('span', 'nw-chip ' + stTone[k], counts[k] + ' · ' + t('pr.st.' + k))));
  const list = mk('div', 'pr-list');
  all.slice().sort((a, b) => (b.said.date || '').localeCompare(a.said.date || '')).forEach((p) => {
    const s = promiseStatus(p);
    const card = mk('article', 'pr-card');
    const head = mk('div', 'pr-head');
    head.append(mk('span', 'nw-co-tag', names.get(p.symbol) || p.symbol), mk('b', null, nwL(p, 'product')), mk('span', 'nw-chip ' + stTone[s], t('pr.st.' + s)));
    card.appendChild(head);
    const said = mk('div', 'pr-row');
    said.append(mk('span', 'pr-k', t('pr.said') + ' · ' + nwPartDate(p.said.date)), mk('span', 'pr-v', nwL(p.said, 'text') + ' (' + t('pr.target') + ': ' + nwL(p.said, 'label') + ') '), srcLink(p.said.source, p.said.url));
    card.appendChild(said);
    const del = mk('div', 'pr-row');
    if (p.delivered) del.append(mk('span', 'pr-k', t('pr.deliv') + ' · ' + nwPartDate(p.delivered.date)), mk('span', 'pr-v', nwL(p.delivered, 'text') + ' '), srcLink(p.delivered.source, p.delivered.url));
    else del.append(mk('span', 'pr-k', t('pr.deliv')), mk('span', 'pr-v mute', t('pr.none')));
    card.appendChild(del);
    list.appendChild(card);
  });
  el.replaceChildren(sum, list);
}

function nwDrawStrategy(el, st) {
  const rows = rowsOf().filter((r) => nwFilterCo(st, r.symbol));
  const out = [];

  // 1. para onde vai o dinheiro (calculado dos dados de resultado, sem curadoria)
  const money = rows.filter((r) => r.rdPct != null || r.capexPct != null).sort((a, b) => (b.capexPct ?? -1) - (a.capexPct ?? -1));
  if (money.length) {
    out.push(mk('h3', 'nw-tl-m', t('st.h.money')), mk('p', 'note', t('st.money.note')));
    const tbl = mk('table', 'cal-t'); const hr = document.createElement('tr');
    [['st.col.co', ''], ['st.col.rd', 'num'], ['st.col.rdy', 'num'], ['st.col.cx', 'num'], ['st.col.rev', 'num']].forEach(([k, c]) => hr.appendChild(mk('th', c, t(k))));
    const th = document.createElement('thead'); th.appendChild(hr); tbl.appendChild(th);
    const tb = document.createElement('tbody');
    money.forEach((r) => {
      const tr = document.createElement('tr');
      const c = mk('td', null, r.name); c.appendChild(mk('span', 'sym', r.symbol)); tr.appendChild(c);
      tr.append(mk('td', 'num', r.rdPct == null ? '—' : pctPlain(r.rdPct)), mk('td', 'num ' + tone(r.rdYoY), r.rdYoY == null ? '—' : pct(r.rdYoY)), mk('td', 'num', r.capexPct == null ? '—' : pctPlain(r.capexPct)), mk('td', 'num ' + tone(r.revenueYoY), r.revenueYoY == null ? '—' : pct(r.revenueYoY)));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); const w = mk('div', 'cmp-scroll'); w.appendChild(tbl); out.push(w);
  }

  // 2. tese declarada e acordos, por empresa (curadoria com fonte)
  const g = dash.data('strategy'); const strat = (g.status === 'ok' ? g.data : []).filter((x) => nwFilterCo(st, x.symbol));
  out.push(mk('h3', 'nw-tl-m', t('st.h.thesis')), mk('p', 'note', t('st.thesis.note')));
  if (!strat.length) out.push(mk('p', 'nw-empty', t('st.none')));
  const grid = mk('div', 'st-grid');
  const names = new Map(rowsOf().map((r) => [r.symbol, r.name]));
  strat.forEach((x) => {
    const card = mk('article', 'nw-co');
    const head = mk('div', 'nw-head'); head.append(mk('h3', null, names.get(x.symbol) || x.symbol), mk('span', 'sym', x.symbol)); card.appendChild(head);
    if (x.thesis) {
      const ul = mk('ul', 'pr-points'); (LANG === 'en' && x.thesis.points_en ? x.thesis.points_en : x.thesis.points).forEach((p) => ul.appendChild(mk('li', null, p))); card.appendChild(ul);
      if (x.thesis.note) card.appendChild(mk('p', 'nw-sum', nwL(x.thesis, 'note')));
      const src = mk('div', 'nw-meta'); src.append(mk('span', null, dateLabel(x.thesis.date)), srcLink(x.thesis.source, x.thesis.url)); card.appendChild(src);
    }
    if (x.deals && x.deals.length) {
      card.appendChild(mk('h4', 'st-sub', t('st.deals')));
      const ul = mk('ul', 'nw-items');
      x.deals.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach((d) => {
        const li = mk('li', 'nw-item');
        const body = mk('div');
        body.append(mk('div', 'nw-title', nwL(d, 'name')), mk('p', 'nw-sum', nwL(d, 'note')));
        const meta = mk('div', 'nw-meta'); meta.append(mk('span', 'nw-tag', t('st.kind.' + d.kind)), mk('span', 'nw-tag' + (d.confidence === 'primária' ? ' prim' : ''), d.confidence === 'primária' ? t('nw.prim') : t('nw.press')), srcLink(d.source, d.url));
        if (d.checked === false) { const u = mk('span', 'nw-by', '*'); u.title = t('st.deal.unchecked'); meta.appendChild(u); }
        body.appendChild(meta);
        li.append(mk('div', 'nw-date', dateLabel(d.date)), body); ul.appendChild(li);
      });
      card.appendChild(ul);
    }
    grid.appendChild(card);
  });
  out.push(grid);

  // 3. mudança na forma de reportar: avisos já presentes nos segmentos curados
  const changes = rows.filter((r) => r.seg && r.seg.note);
  if (changes.length) {
    out.push(mk('h3', 'nw-tl-m', t('st.h.change')), mk('p', 'note', t('st.change.note')));
    const ul = mk('ul', 'pr-points');
    changes.forEach((r) => { const li = mk('li'); li.append(mk('b', null, r.name + ': '), document.createTextNode(LANG === 'en' && SEGEN().notes[r.symbol] ? SEGEN().notes[r.symbol] : r.seg.note)); ul.appendChild(li); });
    out.push(ul);
  }
  el.replaceChildren(...out);
}
