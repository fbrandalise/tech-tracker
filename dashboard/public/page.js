/* Núcleo da página de resultados: resumo, tabela, linha expansível, gráficos, moeda e abas. */
addDict({
  'hl.eps.up': 'EPS {v} acima do esperado', 'hl.eps.down': 'EPS {v} abaixo do esperado', 'hl.eps.flat': 'EPS em linha com o esperado', 'hl.noEps': 'EPS real não disponível na fonte',
  'hl.revSurp': 'receita {v} vs. estimativa', 'hl.revYoY': 'receita {v} a/a', 'hl.niYoY': 'lucro líquido {v} a/a',
  'hl.nonop.above': 'lucro líquido bem acima do operacional (itens não operacionais)', 'hl.nonop.below': 'lucro líquido bem abaixo do operacional (itens não operacionais ou impostos)',
  'hl.sm.S&M': 'despesa de vendas e marketing {v} a/a', 'hl.sm.SG&A': 'despesas de vendas, gerais e adm. (SG&A) {v} a/a',
  'hl.capex': 'capex de {v} da receita', 'hl.capex.neg': 'capex de {v} da receita (fluxo de caixa livre negativo)',
  'hl.note.meituanBase': 'base de comparação baixa: o lucro do 2T25 foi de apenas RMB 0,4 bi',
  'hl.note.spcxEps': 'EPS é GAAP diluído (o consenso e o EPS ajustado variam entre fontes)',
  'seg.rev': 'Receita ({c})', 'seg.share': '% da receita', 'seg.yoy': 'a/a', 'seg.src': 'Fonte', 'seg.none': 'Sem dados de segmento para esta empresa.', 'seg.toggle': 'Receita por segmento e histórico de {n}',
  'hist.h': 'Histórico de trimestres', 'hist.rev': 'Receita', 'hist.mar': 'Margem líquida', 'hist.eps': 'EPS real vs esperado', 'hist.note': 'A fonte traz poucos trimestres; a data é o fim do trimestre fiscal.', 'hist.none': 'Sem histórico suficiente na fonte.',
  'hist.act': 'real', 'hist.exp': 'esperado',
  'cmp.cb': 'Comparar {n}',
  'upd.never': 'indisponível',
  'foot.stale': 'O FMP estava indisponível na última coleta; os dados dele para {names} vêm da última coleta bem-sucedida.',
}, {
  'hl.eps.up': 'EPS {v} above expected', 'hl.eps.down': 'EPS {v} below expected', 'hl.eps.flat': 'EPS in line with expected', 'hl.noEps': 'Actual EPS not available from the source',
  'hl.revSurp': 'revenue {v} vs. estimate', 'hl.revYoY': 'revenue {v} YoY', 'hl.niYoY': 'net income {v} YoY',
  'hl.nonop.above': 'net income well above operating income (non-operating items)', 'hl.nonop.below': 'net income well below operating income (non-operating items or taxes)',
  'hl.sm.S&M': 'sales and marketing expense {v} YoY', 'hl.sm.SG&A': 'selling, general and administrative (SG&A) expense {v} YoY',
  'hl.capex': 'capex at {v} of revenue', 'hl.capex.neg': 'capex at {v} of revenue (negative free cash flow)',
  'hl.note.meituanBase': 'low comparison base: Q2 2025 profit was only RMB 0.4 B',
  'hl.note.spcxEps': 'EPS is diluted GAAP (consensus and adjusted EPS vary by source)',
  'seg.rev': 'Revenue ({c})', 'seg.share': '% of revenue', 'seg.yoy': 'YoY', 'seg.src': 'Source', 'seg.none': 'No segment data for this company.', 'seg.toggle': 'Segment revenue and history for {n}',
  'hist.h': 'Quarterly history', 'hist.rev': 'Revenue', 'hist.mar': 'Net margin', 'hist.eps': 'Actual vs expected EPS', 'hist.note': 'The source has only a few quarters; the date is the fiscal quarter end.', 'hist.none': 'Not enough history from the source.',
  'hist.act': 'actual', 'hist.exp': 'expected',
  'cmp.cb': 'Compare {n}',
  'upd.never': 'unavailable',
  'foot.stale': 'FMP was unavailable in the latest run; its data for {names} comes from the last successful run.',
});

// ---- resumo (medianas e contagens)
dash.calc('summary', {
  inputs: ['earnings'],
  title: 'Resumo das empresas',
  description: 'Contagens e medianas calculadas a partir da tabela de resultados.',
  fn: (earnings) => {
    const med = (xs) => {
      const s = xs.filter((v) => v != null).sort((a, b) => a - b);
      if (!s.length) return null;
      const m = s.length >> 1;
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const withEps = earnings.filter((r) => r.epsSurprisePct != null);
    const beats = withEps.filter((r) => r.epsSurprisePct > 2);
    const misses = withEps.filter((r) => r.epsSurprisePct < -2);
    const growth = earnings.filter((r) => r.revenueYoY != null).sort((a, b) => b.revenueYoY - a.revenueYoY);
    const us = earnings.filter((r) => r.market === 'EUA');
    const hk = earnings.filter((r) => r.market === 'Hong Kong');
    return [{
      n: earnings.length, withEps: withEps.length, beats: beats.length, misses: misses.length,
      inLine: withEps.length - beats.length - misses.length, missNames: misses.map((r) => r.name).join(', '),
      medRevYoY: med(earnings.map((r) => r.revenueYoY)), usMedRevYoY: med(us.map((r) => r.revenueYoY)), hkMedRevYoY: med(hk.map((r) => r.revenueYoY)),
      medNetMargin: med(earnings.map((r) => r.netMargin)), usMedMargin: med(us.map((r) => r.netMargin)), hkMedMargin: med(hk.map((r) => r.netMargin)),
      topGrowthName: growth[0].name, topGrowthValue: growth[0].revenueYoY
    }];
  }
});

// ---- estado, moeda e linhas
const PREF = (k, d) => { try { return localStorage.getItem('lx-' + k) || d; } catch (e) { return d; } };
const SETPREF = (k, v) => { try { localStorage.setItem('lx-' + k, v); } catch (e) { /* ignore */ } };
const state = { key: 'epsSurprisePct', dir: 'desc', q: '', mkt: '', g: PREF('g', 'res'), cur: PREF('cur', 'orig') };
const CMP = new Set();                     // empresas marcadas para comparar
const open = new Set();                    // linhas expandidas
const baseRows = () => { const g = dash.data('earnings'); return g.status === 'ok' ? g.data : []; };
const usdCache = {};
const rowsUsd = () => (usdCache.rows ||= baseRows().map((r) => convertRow(r, META().fx || { USD: 1 })));
const rowsOf = () => (state.cur === 'usd' ? rowsUsd() : baseRows());
const sumOf = () => { const g = dash.data('summary'); return g.status === 'ok' && g.data[0] ? g.data[0] : null; };
const hlText = (r) => {
  const parts = (r.hl || []).map((h) => {
    switch (h.t) {
      case 'eps': return t('hl.eps.' + h.k, { v: pct(h.v) });
      case 'noEps': return t('hl.noEps');
      case 'revSurp': return t('hl.revSurp', { v: pct(h.v) });
      case 'revYoY': return t('hl.revYoY', { v: pct(h.v) });
      case 'niYoY': return t('hl.niYoY', { v: pct(h.v) });
      case 'nonop': return t('hl.nonop.' + h.k);
      case 'smYoY': return t('hl.sm.' + h.basis, { v: pct(h.v) });
      case 'capex': return t(h.neg ? 'hl.capex.neg' : 'hl.capex', { v: pctPlain(h.v) });
      case 'note': return t('hl.note.' + h.k);
      default: return '';
    }
  }).filter(Boolean);
  const s = parts.join('; ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
};

// ---- faixa de resumo e indicadores
dash.draw('take', (el) => {
  const s = sumOf(); if (!s) return;
  fill(el, 'take', { beats: s.beats, with: s.withEps, miss: s.missNames || t('none') });
});
const put = (name, key, fmt) => dash.draw(name, (el) => { const s = sumOf(); el.textContent = s && s[key] != null ? fmt(s[key]) : '—'; });
put('k-beats', 'beats', f0.format); put('k-with', 'withEps', f0.format); put('k-misses', 'misses', f0.format); put('k-inline', 'inLine', f0.format);
put('k-rev', 'medRevYoY', pct); put('k-rev-us', 'usMedRevYoY', pct); put('k-rev-hk', 'hkMedRevYoY', pct);
put('k-mar', 'medNetMargin', pctPlain); put('k-mar-us', 'usMedMargin', pctPlain); put('k-mar-hk', 'hkMedMargin', pctPlain);
put('k-top', 'topGrowthValue', pct); put('k-top-name', 'topGrowthName', (v) => v);
dash.draw('updated', (el) => {
  const m = META();
  let when = t('upd.never');
  if (m.generatedAt) { try { when = new Date(m.generatedAt).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { when = m.generatedAt; } }
  el.textContent = t('foot.updated', { when }) + (m.fmpStale && m.fmpStale.length ? ' ' + t('foot.stale', { names: m.fmpStale.join(', ') }) : '');
});

const paintSwatches = () => document.querySelectorAll('.lx [data-swatch]').forEach((el) => { el.style.background = dash.colors[+el.dataset.swatch]; });
paintSwatches();
dash.onData(paintSwatches);

// ---- gráficos pequenos (histórico) --------------------------------------------------------
const svgEl = (w, h) => d3.create('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).attr('class', 'mini').attr('role', 'img');
function miniBars(vals, labels, fmt, color, title) {
  const W = 220, H = 84, mt = 6, mb = 16, ml = 4, mr = 4;
  const svg = svgEl(W, H).attr('aria-label', title);
  const xs = d3.scaleBand(vals.map((_, i) => i), [ml, W - mr]).padding(0.25);
  const y = d3.scaleLinear([Math.min(0, d3.min(vals) ?? 0), Math.max(0, d3.max(vals) ?? 1)], [H - mb, mt]);
  svg.append('line').attr('class', 'zero').attr('x1', ml).attr('x2', W - mr).attr('y1', y(0)).attr('y2', y(0));
  const g = svg.append('g').selectAll('g').data(vals).join('g');
  g.append('rect').attr('x', (_, i) => xs(i)).attr('width', xs.bandwidth()).attr('y', (v) => y(Math.max(0, v))).attr('height', (v) => Math.max(1, Math.abs(y(v) - y(0)))).attr('rx', 2).attr('fill', color);
  g.append('title').text((v, i) => labels[i] + ': ' + fmt(v));
  svg.append('text').attr('x', ml).attr('y', H - 3).attr('class', 'ax').text(labels[0]);
  svg.append('text').attr('x', W - mr).attr('y', H - 3).attr('text-anchor', 'end').attr('class', 'ax').text(labels[labels.length - 1]);
  return svg.node();
}
function miniLine(vals, labels, fmt, color, title) {
  const W = 220, H = 84, mt = 8, mb = 16, ml = 4, mr = 40;
  const svg = svgEl(W, H).attr('aria-label', title);
  const x = d3.scalePoint(vals.map((_, i) => i), [ml + 4, W - mr]);
  const lo = Math.min(0, d3.min(vals)), hi = Math.max(0, d3.max(vals));
  const y = d3.scaleLinear([lo, hi === lo ? lo + 1 : hi], [H - mb, mt]);
  svg.append('line').attr('class', 'zero').attr('x1', ml).attr('x2', W - mr).attr('y1', y(0)).attr('y2', y(0));
  svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((v) => y(v))(vals)).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2);
  svg.append('g').selectAll('circle').data(vals).join('circle').attr('cx', (_, i) => x(i)).attr('cy', (v) => y(v)).attr('r', 2.5).attr('fill', color).append('title').text((v, i) => labels[i] + ': ' + fmt(v));
  svg.append('text').attr('x', W - mr + 5).attr('y', y(vals[vals.length - 1])).attr('dy', '0.35em').attr('class', 'ax').text(fmt(vals[vals.length - 1]));
  svg.append('text').attr('x', ml).attr('y', H - 3).attr('class', 'ax').text(labels[0]);
  svg.append('text').attr('x', W - mr).attr('y', H - 3).attr('text-anchor', 'end').attr('class', 'ax').text(labels[labels.length - 1]);
  return svg.node();
}
function miniDots(items, fmt, color, title) {
  const W = 220, H = 84, mt = 8, mb = 16, ml = 4, mr = 4;
  const svg = svgEl(W, H).attr('aria-label', title);
  const vals = items.flatMap((i) => [i.a, i.e]).filter((v) => v != null);
  const x = d3.scalePoint(items.map((_, i) => i), [ml + 8, W - mr - 8]);
  const y = d3.scaleLinear([Math.min(...vals), Math.max(...vals) === Math.min(...vals) ? Math.min(...vals) + 1 : Math.max(...vals)], [H - mb - 4, mt]);
  svg.append('g').selectAll('line').data(items.filter((i) => i.a != null && i.e != null)).join('line').attr('x1', (d) => x(items.indexOf(d))).attr('x2', (d) => x(items.indexOf(d))).attr('y1', (d) => y(d.a)).attr('y2', (d) => y(d.e)).attr('stroke', 'currentColor').attr('stroke-opacity', 0.25);
  svg.append('g').selectAll('circle.e').data(items.filter((i) => i.e != null)).join('circle').attr('cx', (d) => x(items.indexOf(d))).attr('cy', (d) => y(d.e)).attr('r', 3.5).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 1.5).append('title').text((d) => date(d.d) + ' · ' + t('hist.exp') + ': ' + fmt(d.e));
  svg.append('g').selectAll('circle.a').data(items.filter((i) => i.a != null)).join('circle').attr('cx', (d) => x(items.indexOf(d))).attr('cy', (d) => y(d.a)).attr('r', 3.5).attr('fill', color).append('title').text((d) => date(d.d) + ' · ' + t('hist.act') + ': ' + fmt(d.a));
  svg.append('text').attr('x', ml).attr('y', H - 3).attr('class', 'ax').text(date(items[0].d));
  svg.append('text').attr('x', W - mr).attr('y', H - 3).attr('text-anchor', 'end').attr('class', 'ax').text(date(items[items.length - 1].d));
  return svg.node();
}
const sparkNode = (r) => {
  const v = (r.hist || []).map((h) => h.rev).filter((x) => x != null);
  const td = mk('span', 'spark');
  if (v.length < 2) { td.textContent = '—'; return td; }
  const W = 64, H = 20, x = d3.scaleLinear([0, v.length - 1], [2, W - 2]), y = d3.scaleLinear([d3.min(v), d3.max(v)], [H - 3, 3]);
  const svg = d3.create('svg').attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', t('m.spark'));
  svg.append('path').attr('d', d3.line().x((_, i) => x(i)).y((q) => y(q))(v)).attr('fill', 'none').attr('stroke', dash.colors[r.market === 'EUA' ? 0 : 1]).attr('stroke-width', 1.6);
  svg.append('circle').attr('cx', x(v.length - 1)).attr('cy', y(v[v.length - 1])).attr('r', 2).attr('fill', dash.colors[r.market === 'EUA' ? 0 : 1]);
  td.appendChild(svg.node());
  return td;
};
function histBlock(r) {
  const wrap = mk('div', 'dt-grp dt-hist');
  wrap.appendChild(mk('h3', null, t('hist.h')));
  const h = (r.hist || []).filter((x) => x.rev != null);
  if (h.length < 2) { wrap.appendChild(mk('p', 'dt-foot', t('hist.none'))); return wrap; }
  const col = dash.colors[r.market === 'EUA' ? 0 : 1];
  const labels = h.map((x) => dateLabel(x.d));
  const cards = mk('div', 'hist-grid');
  const card = (title, node) => { const c = mk('div', 'hist-c'); c.appendChild(mk('div', 'hist-t', title)); c.appendChild(node); cards.appendChild(c); };
  card(t('hist.rev') + ' (' + t('u.bn') + ' ' + r.currency + ')', miniBars(h.map((x) => x.rev), labels, (v) => f1.format(v), col, t('hist.rev')));
  const mar = h.filter((x) => x.ni != null).map((x) => ({ d: x.d, v: x.ni / x.rev * 100 }));
  if (mar.length >= 2) card(t('hist.mar') + ' (%)', miniLine(mar.map((x) => x.v), mar.map((x) => dateLabel(x.d)), (v) => pctPlain(v), col, t('hist.mar')));
  const eh = (r.epsHist || []).filter((x) => x.a != null);
  if (eh.length >= 2) card(t('hist.eps'), miniDots(eh, (v) => f2.format(v), col, t('hist.eps')));
  wrap.appendChild(cards);
  wrap.appendChild(mk('p', 'dt-foot', t('hist.note')));
  return wrap;
}

// ---- linha expansível: segmentos + histórico
const SEGEN = () => (typeof SEG_EN !== 'undefined' ? SEG_EN : { names: {}, notes: {}, sources: {} });
const tx = (s) => (LANG === 'en' && SEGEN().names[s]) || s;
const segGroup = (r, grp) => {
  const wrap = mk('div', 'dt-grp');
  wrap.appendChild(mk('h3', null, tx(grp.t)));
  const sumPos = Math.max(...grp.i.map((x) => x.v), 0.0001);
  const line = (x, depth) => {
    const row = mk('div', 'dt-row' + (depth ? ' sub' : ''));
    row.appendChild(mk('span', 'dt-n', tx(x.n)));
    row.appendChild(mk('span', 'dt-v', (x.a ? '≈ ' : '') + f1.format(x.v) + ' ' + t('u.bn')));
    row.appendChild(mk('span', 'dt-s', r.revenueB ? pctPlain(x.v / r.revenueB * 100) : '—'));
    const yoy = x.p != null && x.p > 0 ? (x.v / x.p - 1) * 100 : x.y;
    row.appendChild(mk('span', 'dt-y ' + tone(yoy), yoy == null ? '—' : pct(+yoy.toFixed(1))));
    const bar = mk('span', 'dt-b'); const i = document.createElement('i');
    i.style.width = Math.max(0, Math.min(100, x.v / sumPos * 100)) + '%'; i.style.background = dash.colors[r.market === 'EUA' ? 0 : 1];
    bar.appendChild(i); row.appendChild(bar);
    wrap.appendChild(row);
    (x.c || []).forEach((c) => line(c, depth + 1));
  };
  const head = mk('div', 'dt-row dt-head');
  [['', 'dt-n'], [t('seg.rev', { c: r.currency }), 'dt-v'], [t('seg.share'), 'dt-s'], [t('seg.yoy'), 'dt-y'], ['', 'dt-b']].forEach(([x, c]) => head.appendChild(mk('span', c, x)));
  wrap.appendChild(head);
  grp.i.forEach((x) => line(x, 0));
  return wrap;
};
const detailRow = (r, span) => {
  const tr = mk('tr', 'detail'); tr.dataset.for = r.symbol;
  const td = document.createElement('td'); td.colSpan = span;
  const box = mk('div', 'dt');
  const gs = mk('div', 'dt-grps');
  if (r.seg) r.seg.g.forEach((g) => gs.appendChild(segGroup(r, g)));
  else gs.appendChild(mk('p', 'dt-foot', t('seg.none')));
  gs.appendChild(histBlock(r));
  box.appendChild(gs);
  if (r.seg) {
    const foot = mk('p', 'dt-foot');
    const note = LANG === 'en' && SEGEN().notes[r.symbol] ? SEGEN().notes[r.symbol] : r.seg.note;
    foot.append((note ? note + ' ' : '') + t('seg.src') + ': ');
    const label = r.seg.src ? ((LANG === 'en' && SEGEN().sources[r.seg.src.label]) || r.seg.src.label) : '—';
    if (r.seg.src && /^https:/.test(r.seg.src.url)) { const a = document.createElement('a'); a.href = r.seg.src.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label; foot.appendChild(a); }
    else foot.append(label);
    foot.append('.');
    box.appendChild(foot);
  }
  td.appendChild(box); tr.appendChild(td); return tr;
};

// ---- tabela: colunas, filtro, ordenação ----------------------------------------------------
const epsCell = (r) => { const s = r.epsSurprisePct; const glyph = s == null ? '' : s > 2 ? '▲ ' : s < -2 ? '▼ ' : '≈ '; return [s == null ? '—' : glyph + pct(s), 'num ' + (s == null ? 'mute' : s > 2 ? 'up' : s < -2 ? 'down' : 'flat')]; };
const TONED = new Set(['revenueYoY', 'netIncomeYoY', 'reactPct']);
const metricCell = (k) => (r) => [fmtMetric(k, r), 'num' + (TONED.has(k) ? ' ' + tone(r[k]) : '') + ((k === 'fcfB' || k === 'netCashB') && r[k] != null && r[k] < 0 ? ' down' : '')];
const C = (k, g, extra) => ({ k, g, num: 1, m: k, fmt: metricCell(k), ...extra });
const COLS = [
  { k: 'name', g: '*', fmt: (r) => [r.name, ''] },
  { k: 'market', g: '*', fmt: (r) => [mktName(r.market), ''] },
  { k: 'periodEnd', g: '*', fmt: (r) => [date(r.periodEnd), ''] },
  { k: 'spark', g: 'res', nosort: 1, fmt: () => ['', ''], spark: 1 },
  { k: 'epsActual', g: 'res', num: 1, m: 'epsActual', fmt: (r) => [r.epsActual == null ? '—' : f2.format(r.epsActual), 'num'] },
  { k: 'epsEstimate', g: 'res', num: 1, m: 'epsEstimate', fmt: (r) => [r.epsEstimate == null ? '—' : f2.format(r.epsEstimate), 'num'] },
  { k: 'epsSurprisePct', g: 'res', num: 1, m: 'epsSurprisePct', fmt: epsCell },
  C('revenueB', '*'), C('revenueYoY', 'res rent val'), C('netIncomeYoY', 'res'), C('reactPct', 'res val', { tip: 1 }),
  C('grossMargin', 'rent'), C('operatingMargin', 'res rent'), C('ebitdaMargin', 'rent'), C('netMargin', 'res rent'), C('taxRate', 'rent'),
  C('employees', 'rent', { tip: 1, cellTip: (r) => (r.employees == null ? '' : r.employeesSource + (r.employeesAsOf ? ' · ' + date(r.employeesAsOf) : '')) }), C('revPerEmployeeK', 'rent', { tip: 1 }), C('employeesYoY', 'rent', { tip: 1 }),
  C('salesMktB', 'desp', { tip: 1, star: 1 }), C('salesMktPct', 'desp'), C('salesMktYoY', 'desp'), C('gaPct', 'desp'), C('rdB', 'desp'), C('rdPct', 'desp'), C('sbcPct', 'desp'), C('opexPct', 'desp'),
  C('capexPct', 'caixa'), C('fcfB', 'caixa', { tip: 1 }), C('fcfMargin', 'caixa'), C('fcfYoY', 'caixa'), C('cashB', 'caixa'), C('debtB', 'caixa'), C('netCashB', 'caixa'),
  C('mcapUsdB', 'val'), C('pe', 'val', { tip: 1 }), C('fwdPe', 'val'), C('ps', 'val'), C('evRev', 'val'), C('evEbitda', 'val'),
  { k: 'nextEarnings', g: 'res', fmt: (r) => [date(r.nextEarnings), ''] },
  { k: 'highlight', g: 'res', nosort: 1, fmt: (r) => [hlText(r), 'hl'] },
];
const NUM_SORT_FIRST = ['name', 'market', 'periodEnd', 'nextEarnings'];
const tableEl = document.querySelector('.lx table');
const colOn = (c) => state.g === 'all' || c.g.split(' ').includes('*') || c.g.split(' ').includes(state.g);

const visible = () => {
  const q = state.q.trim().toLowerCase();
  const rows = rowsOf().filter((r) => (!state.mkt || r.market === state.mkt) && (!q || (r.name + ' ' + r.symbol).toLowerCase().includes(q)));
  const sgn = state.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[state.key], y = b[state.key];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), LOCALE)) * sgn;
  });
};
const markSort = () => document.querySelectorAll('#lx-head th').forEach((th) => {
  const b = th.querySelector('button');
  th.setAttribute('aria-sort', b && b.dataset.sort === state.key ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');
});
document.getElementById('lx-head').replaceChildren(...COLS.map((c) => {
  const th = document.createElement('th');
  th.dataset.field = c.k; th.dataset.grp = c.g;
  if (c.num) th.className = 'num';
  const label = t('m.' + c.k);
  if (c.nosort) { th.textContent = c.spark ? '' : label; if (c.spark) th.setAttribute('aria-label', label); return th; }
  th.setAttribute('aria-sort', 'none');
  const b = mk('button', null, label); b.type = 'button'; b.dataset.sort = c.k;
  if (c.tip) b.title = t('tip.' + c.k);
  th.appendChild(b); return th;
}));
tableEl.dataset.g = state.g;
markSort();
document.getElementById('lx-head').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-sort]'); if (!b) return;
  const k = b.dataset.sort;
  state.dir = state.key === k ? (state.dir === 'asc' ? 'desc' : 'asc') : (NUM_SORT_FIRST.includes(k) ? 'asc' : 'desc');
  state.key = k;
  markSort();
  dash.draw('rows');
});
document.getElementById('lx-q').addEventListener('input', (e) => { state.q = e.target.value; dash.draw('rows'); dash.draw('count'); });
document.getElementById('lx-mkt').addEventListener('change', (e) => { state.mkt = e.target.value; dash.draw('rows'); dash.draw('count'); });
dash.draw('count', (el) => { el.textContent = f0.format(visible().length); });

dash.draw('rows', (tbody) => {
  const rows = visible();
  const span = COLS.filter(colOn).length;
  const out = [];
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.dataset.key = r.symbol;
    COLS.forEach((c) => {
      const td = document.createElement('td'); td.dataset.grp = c.g;
      if (c.spark) { td.appendChild(sparkNode(r)); tr.appendChild(td); return; }
      const [text, cls] = c.fmt(r);
      td.textContent = text; if (cls) td.className = cls;
      if (c.m && MET[c.m] && r[c.m] != null) { td.dataset.m = c.m; td.title = t('ex.hint'); }
      if (c.cellTip) { const tip = c.cellTip(r); if (tip) td.title = tip + ' · ' + t('ex.hint'); }
      if (c.star && r.salesMktBasis === 'SG&A' && r.salesMktB != null) td.textContent += '*';
      if (c.k === 'name') {
        td.appendChild(mk('span', 'sym', r.symbol));
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'cmp-cb'; cb.dataset.sym = r.symbol; cb.checked = CMP.has(r.symbol);
        cb.setAttribute('aria-label', t('cmp.cb', { n: r.name }));
        td.prepend(cb);
        const on = open.has(r.symbol);
        const b = mk('button', 'dt-tg', on ? '▾' : '▸'); b.type = 'button';
        b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.setAttribute('aria-label', t('seg.toggle', { n: r.name })); b.title = t('seg.toggle', { n: r.name });
        b.addEventListener('click', () => { if (open.has(r.symbol)) open.delete(r.symbol); else open.add(r.symbol); dash.draw('rows'); });
        td.prepend(b);
      }
      tr.appendChild(td);
    });
    out.push(tr);
    if (open.has(r.symbol)) out.push(detailRow(r, span));
  });
  tbody.replaceChildren(...out);
});
// clicar em um valor explica a conta
document.querySelector('.lx table tbody').addEventListener('click', (e) => {
  const td = e.target.closest('td[data-m]'); if (!td) return;
  const r = rowsOf().find((x) => x.symbol === td.closest('tr').dataset.key);
  if (r) showExplain(td, td.dataset.m, r);
});

// grupos de colunas e moeda
const pressGroup = () => document.querySelectorAll('.lx-seg[data-kind="grp"] button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.g === state.g ? 'true' : 'false'));
document.querySelectorAll('.lx-seg[data-kind="grp"] button').forEach((b) => b.addEventListener('click', () => {
  state.g = b.dataset.g; SETPREF('g', state.g); tableEl.dataset.g = state.g; pressGroup(); dash.draw('rows');
}));
pressGroup();
const redrawAll = () => { ['rows', 'count', 'chart-rev', 'chart-mar', 'chart-eps', 'chart-react', 'cmp', 'cal', 'cur-note'].forEach((n) => dash.draw(n)); };
const pressCur = () => document.querySelectorAll('.lx-seg[data-kind="cur"] button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.cur === state.cur ? 'true' : 'false'));
document.querySelectorAll('.lx-seg[data-kind="cur"] button').forEach((b) => b.addEventListener('click', () => {
  state.cur = b.dataset.cur; SETPREF('cur', state.cur); pressCur(); redrawAll();
}));
pressCur();
dash.draw('cur-note', (el) => {
  const m = META();
  if (state.cur !== 'usd' || !m.fx) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = t('cur.note', { date: m.generatedAt ? date(m.generatedAt.slice(0, 10)) : '—', cny: m.fx.CNY ? f2.format(m.fx.CNY) : '—' });
});

// ---- gráficos de barras ---------------------------------------------------------------------
const MARKET_COLOR = { 'EUA': 0, 'Hong Kong': 1 };
function barChart(el, key, label, opts) {
  const g = dash.data('earnings');
  if (g.status !== 'ok') { el.replaceChildren(); el.classList.add('dash-skeleton'); return; }
  el.classList.remove('dash-skeleton');
  const all = rowsOf();
  const items = all.filter((r) => r[key] != null).sort((a, b) => b[key] - a[key]);
  const missing = all.filter((r) => r[key] == null).map((r) => r.name);
  const clamp = opts.clamp || Infinity;
  const W = Math.max(280, el.clientWidth), rowH = 22, mt = 4, mb = 22, nameW = 76, mr = 70;
  const H = mt + items.length * rowH + mb;
  const clipped = (v) => Math.max(-clamp, Math.min(clamp, v));
  const vals = items.map((r) => clipped(r[key]));
  const x = d3.scaleLinear([Math.min(0, d3.min(vals)), Math.max(0, d3.max(vals))], [nameW + 48, W - mr]).nice(4);
  const y = d3.scaleBand(items.map((r) => r.symbol), [mt, mt + items.length * rowH]).padding(0.28);

  const svg = d3.create('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
  const ticks = x.ticks(4);
  svg.append('g').selectAll('line').data(ticks).join('line').attr('class', 'grid').attr('x1', (tk) => x(tk)).attr('x2', (tk) => x(tk)).attr('y1', mt).attr('y2', mt + items.length * rowH);
  svg.append('g').selectAll('text').data(ticks).join('text').attr('x', (tk) => x(tk)).attr('y', H - 6).attr('text-anchor', 'middle').text((tk) => f0.format(tk) + '%');
  svg.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', mt).attr('y2', mt + items.length * rowH);

  const tip = document.createElement('div');
  tip.className = 'lx-tip'; tip.hidden = true;
  const showTip = (event, r) => {
    tip.replaceChildren();
    tip.append(mk('div', null, r.name + ' (' + r.symbol + ')'), mk('div', 't', mktName(r.market) + ' · ' + t('ch.q') + ' ' + date(r.periodEnd)), mk('div', null, label + ': ' + opts.fmt(r[key])));
    if (opts.extra) tip.append(mk('div', 't', opts.extra(r)));
    tip.hidden = false;
    const [px, py] = d3.pointer(event, el);
    const w = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(px + 12, W - w - 4)) + 'px';
    tip.style.top = Math.max(0, py - tip.offsetHeight - 10) + 'px';
  };
  const row = svg.append('g').selectAll('g').data(items).join('g');
  row.append('rect').attr('x', 0).attr('width', W).attr('y', (r) => y(r.symbol) - 3).attr('height', y.bandwidth() + 6).attr('fill', 'transparent')
    .on('mousemove', (event, r) => showTip(event, r)).on('mouseleave', () => { tip.hidden = true; });
  row.append('rect')
    .attr('x', (r) => x(Math.min(0, clipped(r[key])))).attr('width', (r) => Math.max(1, Math.abs(x(clipped(r[key])) - x(0))))
    .attr('y', (r) => y(r.symbol)).attr('height', y.bandwidth()).attr('rx', 3)
    .attr('fill', (r) => dash.colors[MARKET_COLOR[r.market] ?? 0]).style('pointer-events', 'none');
  row.append('text').attr('class', 'nm').attr('x', 0).attr('y', (r) => y(r.symbol) + y.bandwidth() / 2).attr('dy', '0.35em').text((r) => r.name).style('pointer-events', 'none');
  row.append('text').attr('class', 'vl')
    .attr('x', (r) => (r[key] >= 0 ? x(clipped(r[key])) + 6 : x(clipped(r[key])) - 6))
    .attr('text-anchor', (r) => (r[key] >= 0 ? 'start' : 'end'))
    .attr('y', (r) => y(r.symbol) + y.bandwidth() / 2).attr('dy', '0.35em')
    .text((r) => opts.fmt(r[key]) + (Math.abs(r[key]) > clamp ? ' ▸' : '')).style('pointer-events', 'none');

  el.replaceChildren(svg.node(), tip);
  if (missing.length) el.appendChild(mk('p', 'miss', t('ch.missing', { names: missing.join(', ') })));
}
dash.draw('chart-rev', (el) => barChart(el, 'revenueYoY', t('m.revenueYoY'), { fmt: pct, extra: (r) => t('ch.rev.x', { v: fmtMetric('revenueB', r) }) }));
dash.draw('chart-mar', (el) => barChart(el, 'netMargin', t('m.netMargin'), { fmt: pctPlain, extra: (r) => t('ch.mar.x', { v: fmtMetric('netIncomeB', r) }) }));
dash.draw('chart-eps', (el) => barChart(el, 'epsSurprisePct', t('m.epsSurprisePct'), { fmt: pct, clamp: 40, extra: (r) => t('ch.eps.x', { a: r.epsActual == null ? '—' : f2.format(r.epsActual), e: r.epsEstimate == null ? '—' : f2.format(r.epsEstimate) }) }));
dash.draw('chart-react', (el) => barChart(el, 'reactPct', t('m.reactPct'), { fmt: pct, clamp: 40, extra: (r) => t('ch.react.x', { d: date(r.reportDate), a: date(r.reactFrom), b: date(r.reactTo) }) }));

// ---- abas (a aba selecionada fica no hash)
(function () {
  const tabs = [...document.querySelectorAll('.lx-tabs [data-tab]')];
  const HASH = { results: '', explore: '#explore', calendar: '#calendar', news: '#news', usage: '#usage' };
  const FROM = { '#explore': 'explore', '#explorar': 'explore', '#calendar': 'calendar', '#calendario': 'calendar', '#news': 'news', '#novidades': 'news', '#usage': 'usage', '#uso': 'usage' };
  const show = (name) => {
    tabs.forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      document.getElementById('tab-' + b.dataset.tab).hidden = !on;
    });
    try { history.replaceState(null, '', HASH[name] || location.pathname + location.search); } catch (e) { /* ignore */ }
    window.dispatchEvent(new CustomEvent('lx-tab', { detail: name }));
  };
  tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  window.lxShowTab = show;
  if (FROM[location.hash]) show(FROM[location.hash]);
})();
