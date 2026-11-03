/* Aba Explorar: dispersão com eixos escolhidos pelo usuário e evolução trimestral por empresa. Valores em USD. */
addDict({
  'ex2.h': 'Explore os dados', 'ex2.note': 'Escolha os eixos para cruzar dois indicadores. Cada ponto é uma empresa; clique em um ponto para adicioná-la (ou removê-la) da comparação lado a lado.',
  'ex2.x': 'Eixo X', 'ex2.y': 'Eixo Y', 'ex2.size': 'Tamanho', 'ex2.nosize': 'Tamanho fixo', 'ex2.med': 'Mostrar medianas', 'ex2.labels': 'Mostrar nomes',
  'ex2.missing': 'Fora do gráfico por falta de dado em algum eixo: {names}.', 'ex2.empty': 'Poucos dados para este cruzamento.',
  'ex2.tipSel': 'Na comparação', 'ex2.tipClick': 'Clique para comparar',
  'tr.h': 'Evolução trimestral', 'tr.note': 'Escolha o indicador e as empresas (quantas quiser). O eixo de tempo é o fim de cada trimestre fiscal. O índice de receita tem base 100 no primeiro trimestre que todas as empresas escolhidas têm em comum; o histórico vai até onde há dados (cerca de 5 anos nas empresas dos EUA, menos nas demais).',
  'tr.metric': 'Indicador', 'tr.rev': 'Receita (bi USD)', 'tr.revIdx': 'Receita (índice: 100 = primeiro trimestre)', 'tr.ni': 'Lucro líquido (bi USD)', 'tr.mar': 'Margem líquida (%)', 'tr.gm': 'Margem bruta (%)', 'tr.om': 'Margem operacional (%)',
  'tr.pick': 'Empresas', 'tr.none': 'Selecione ao menos uma empresa com histórico.',
}, {
  'ex2.h': 'Explore the data', 'ex2.note': 'Pick the axes to cross two metrics. Each dot is a company; click a dot to add it to (or remove it from) the side-by-side comparison.',
  'ex2.x': 'X axis', 'ex2.y': 'Y axis', 'ex2.size': 'Size', 'ex2.nosize': 'Fixed size', 'ex2.med': 'Show medians', 'ex2.labels': 'Show names',
  'ex2.missing': 'Not plotted because an axis has no data: {names}.', 'ex2.empty': 'Too little data for this combination.',
  'ex2.tipSel': 'In comparison', 'ex2.tipClick': 'Click to compare',
  'tr.h': 'Quarterly trend', 'tr.note': 'Pick the metric and companies (as many as you like). The time axis is each fiscal quarter end. The revenue index is 100 at the first quarter all selected companies have in common; history goes as far back as there is data (about 5 years for US companies, less for the others).',
  'tr.metric': 'Metric', 'tr.rev': 'Revenue (USD B)', 'tr.revIdx': 'Revenue (index: 100 = first quarter)', 'tr.ni': 'Net income (USD B)', 'tr.mar': 'Net margin (%)', 'tr.gm': 'Gross margin (%)', 'tr.om': 'Operating margin (%)',
  'tr.pick': 'Companies', 'tr.none': 'Select at least one company with history.',
});

const AXES = ['revenueYoY', 'netIncomeYoY', 'epsSurprisePct', 'reactPct', 'grossMargin', 'operatingMargin', 'ebitdaMargin', 'netMargin', 'fcfMargin', 'capexPct', 'salesMktPct', 'rdPct', 'sbcPct', 'opexPct', 'taxRate',
  'revenueB', 'netIncomeB', 'fcfB', 'mcapUsdB', 'pe', 'fwdPe', 'ps', 'evRev', 'evEbitda', 'revPerEmployeeK', 'employees', 'employeesYoY'];
const SIZES = ['revenueB', 'mcapUsdB', 'netIncomeB'];
const sx = { x: PREF('sx', 'revenueYoY'), y: PREF('sy', 'capexPct'), size: PREF('ss', 'mcapUsdB'), med: PREF('smed', '0') === '1', labels: PREF('slab', '1') === '1' };
const fillSelect = (id, keys, withNone) => {
  const s = document.getElementById(id); s.replaceChildren();
  if (withNone) s.appendChild(new Option(t('ex2.nosize'), 'none'));
  keys.forEach((k) => s.appendChild(new Option(metricLabel(k), k)));
};
fillSelect('sc-x', AXES); fillSelect('sc-y', AXES); fillSelect('sc-s', SIZES, true);
document.getElementById('sc-x').value = AXES.includes(sx.x) ? sx.x : 'revenueYoY';
document.getElementById('sc-y').value = AXES.includes(sx.y) ? sx.y : 'capexPct';
document.getElementById('sc-s').value = SIZES.includes(sx.size) || sx.size === 'none' ? sx.size : 'mcapUsdB';
document.getElementById('sc-med').checked = sx.med;
document.getElementById('sc-lab').checked = sx.labels;
const scRedraw = () => dash.draw('scatter');
[['sc-x', 'x', 'sx'], ['sc-y', 'y', 'sy'], ['sc-s', 'size', 'ss']].forEach(([id, k, p]) => document.getElementById(id).addEventListener('change', (e) => { sx[k] = e.target.value; SETPREF(p, sx[k]); scRedraw(); }));
document.getElementById('sc-med').addEventListener('change', (e) => { sx.med = e.target.checked; SETPREF('smed', sx.med ? '1' : '0'); scRedraw(); });
document.getElementById('sc-lab').addEventListener('change', (e) => { sx.labels = e.target.checked; SETPREF('slab', sx.labels ? '1' : '0'); scRedraw(); });

const medianOf = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
dash.draw('scatter', (el) => {
  const g = dash.data('earnings'); if (g.status !== 'ok') return;
  const rows = rowsUsd();
  const ok = rows.filter((r) => r[sx.x] != null && r[sx.y] != null);
  const missing = rows.filter((r) => r[sx.x] == null || r[sx.y] == null).map((r) => r.name);
  if (ok.length < 2) { el.replaceChildren(mk('p', 'nw-empty', t('ex2.empty'))); return; }
  const W = 900, H = 520, ml = 56, mr = 18, mt = 12, mb = 44;
  const ext = (k) => { const e = d3.extent(ok, (r) => r[k]); const pad = (e[1] - e[0]) * 0.08 || 1; return [Math.min(e[0], 0) === e[0] && e[0] >= 0 ? e[0] - pad * 0.0 : e[0] - pad, e[1] + pad]; };
  const x = d3.scaleLinear(ext(sx.x), [ml, W - mr]).nice(), y = d3.scaleLinear(ext(sx.y), [H - mb, mt]).nice();
  const sizeKey = sx.size === 'none' ? null : sx.size;
  const rScale = sizeKey ? d3.scaleSqrt([0, d3.max(ok, (r) => Math.abs(r[sizeKey] || 0)) || 1], [4, 24]) : () => 7;
  const svg = d3.create('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', metricLabel(sx.y) + ' × ' + metricLabel(sx.x));
  const xt = x.ticks(6), yt = y.ticks(5);
  svg.append('g').selectAll('line').data(xt).join('line').attr('class', 'grid').attr('x1', (v) => x(v)).attr('x2', (v) => x(v)).attr('y1', mt).attr('y2', H - mb);
  svg.append('g').selectAll('line').data(yt).join('line').attr('class', 'grid').attr('x1', ml).attr('x2', W - mr).attr('y1', (v) => y(v)).attr('y2', (v) => y(v));
  svg.append('g').selectAll('text').data(xt).join('text').attr('class', 'ax').attr('x', (v) => x(v)).attr('y', H - mb + 14).attr('text-anchor', 'middle').text((v) => f0.format(v));
  svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'ax').attr('x', ml - 6).attr('y', (v) => y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').text((v) => f0.format(v));
  if (x.domain()[0] < 0 && x.domain()[1] > 0) svg.append('line').attr('class', 'zero').attr('x1', x(0)).attr('x2', x(0)).attr('y1', mt).attr('y2', H - mb);
  if (y.domain()[0] < 0 && y.domain()[1] > 0) svg.append('line').attr('class', 'zero').attr('x1', ml).attr('x2', W - mr).attr('y1', y(0)).attr('y2', y(0));
  if (sx.med) {
    const mx = medianOf(ok.map((r) => r[sx.x])), my = medianOf(ok.map((r) => r[sx.y]));
    svg.append('line').attr('class', 'med').attr('x1', x(mx)).attr('x2', x(mx)).attr('y1', mt).attr('y2', H - mb);
    svg.append('line').attr('class', 'med').attr('x1', ml).attr('x2', W - mr).attr('y1', y(my)).attr('y2', y(my));
  }
  svg.append('text').attr('class', 'ax').attr('x', (ml + W - mr) / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(metricLabel(sx.x));
  svg.append('text').attr('class', 'ax').attr('transform', `translate(12,${(mt + H - mb) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(metricLabel(sx.y));

  const tip = mk('div', 'lx-tip'); tip.hidden = true;
  const tipFor = (event, r) => {
    tip.replaceChildren(mk('div', null, r.name + ' (' + r.symbol + ')'), mk('div', 't', mktName(r.market)),
      mk('div', null, metricLabel(sx.x) + ': ' + fmtMetric(sx.x, r)), mk('div', null, metricLabel(sx.y) + ': ' + fmtMetric(sx.y, r)));
    if (sizeKey) tip.appendChild(mk('div', 't', metricLabel(sizeKey) + ': ' + fmtMetric(sizeKey, r)));
    tip.appendChild(mk('div', 't', CMP.has(r.symbol) ? t('ex2.tipSel') : t('ex2.tipClick')));
    tip.hidden = false;
    const [px, py] = d3.pointer(event, el), w = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(px + 14, el.clientWidth - w - 4)) + 'px'; tip.style.top = Math.max(0, py - tip.offsetHeight - 12) + 'px';
  };
  const pts = svg.append('g').selectAll('g').data([...ok].sort((a, b) => (sizeKey ? Math.abs(b[sizeKey] || 0) - Math.abs(a[sizeKey] || 0) : 0))).join('g').style('cursor', 'pointer');
  pts.append('circle').attr('cx', (r) => x(r[sx.x])).attr('cy', (r) => y(r[sx.y])).attr('r', (r) => rScale(Math.abs(r[sizeKey] || 0)))
    .attr('fill', (r) => dash.colors[r.market === 'EUA' ? 0 : 1]).attr('fill-opacity', 0.62)
    .attr('stroke', (r) => (CMP.has(r.symbol) ? 'currentColor' : dash.colors[r.market === 'EUA' ? 0 : 1])).attr('stroke-width', (r) => (CMP.has(r.symbol) ? 3 : 1.2))
    .on('mousemove', (event, r) => tipFor(event, r)).on('mouseleave', () => { tip.hidden = true; })
    .on('click', (event, r) => { toggleCmp(r.symbol); dash.draw('rows'); scRedraw(); });
  if (sx.labels) pts.append('text').attr('class', 'pt-l').attr('x', (r) => x(r[sx.x]) + rScale(Math.abs(r[sizeKey] || 0)) + 3).attr('y', (r) => y(r[sx.y])).attr('dy', '0.35em').style('pointer-events', 'none').text((r) => r.name);
  el.replaceChildren(svg.node(), tip);
  if (missing.length) el.appendChild(mk('p', 'miss', t('ex2.missing', { names: missing.join(', ') })));
});

// ---- evolução trimestral -------------------------------------------------------------------
const TR_METRICS = {
  rev: (h) => h.rev, revIdx: null, ni: (h) => h.ni,
  mar: (h) => (h.ni != null && h.rev ? h.ni / h.rev * 100 : null),
  gm: (h) => (h.gp != null && h.rev ? h.gp / h.rev * 100 : null),
  om: (h) => (h.oi != null && h.rev ? h.oi / h.rev * 100 : null),
};
const trHist = (r) => (r.histAll && r.histAll.length ? r.histAll : r.hist) || [];
// uma cor fixa por empresa (pela posição na lista), para não mudar ao marcar ou desmarcar outras
const TR_COLORS = ['#2f66a8', '#c4661c', '#2a9d8f', '#8e5ea2', '#c0392b', '#7f8c3a', '#e377c2', '#17becf', '#8c564b', '#bcbd22', '#1f3b73', '#f2a900', '#4c9f70', '#d1495b', '#6a4c93', '#00798c', '#9c6644', '#5c677d'];
const tr = { metric: PREF('trm', 'revIdx'), sel: new Set((PREF('trs', 'NVDA,MSFT,GOOGL,00700.HK').split(',')).filter(Boolean)) };
const trMetricSel = document.getElementById('tr-m'); trMetricSel.replaceChildren();
Object.keys(TR_METRICS).forEach((k) => trMetricSel.appendChild(new Option(t('tr.' + k), k)));
trMetricSel.value = TR_METRICS[tr.metric] !== undefined ? tr.metric : 'revIdx';
trMetricSel.addEventListener('change', (e) => { tr.metric = e.target.value; SETPREF('trm', tr.metric); dash.draw('trend'); });
const trPickBox = document.getElementById('tr-pick');
function drawPick() {
  trPickBox.replaceChildren(...rowsUsd().map((r) => {
    const b = mk('button', 'chip' + (tr.sel.has(r.symbol) ? ' on' : ''), r.name); b.type = 'button'; b.setAttribute('aria-pressed', tr.sel.has(r.symbol) ? 'true' : 'false');
    if (trHist(r).length < 2) b.classList.add('dim');
    b.addEventListener('click', () => {
      if (tr.sel.has(r.symbol)) tr.sel.delete(r.symbol);
      else tr.sel.add(r.symbol);
      document.getElementById('tr-msg').textContent = '';
      SETPREF('trs', [...tr.sel].join(',')); drawPick(); dash.draw('trend');
    });
    return b;
  }));
}
dash.draw('trend', (el) => {
  const g = dash.data('earnings'); if (g.status !== 'ok') return;
  drawPick();
  const picked = rowsUsd().filter((r) => tr.sel.has(r.symbol) && trHist(r).length >= 2);
  const common = tr.metric === 'revIdx' ? picked.reduce((m, r) => { const f = trHist(r).find((h) => h.rev != null); return f && f.d > m ? f.d : m; }, '') : '';
  const order = rowsUsd().map((r) => r.symbol);
  const series = picked.map((r) => {
    let pts = trHist(r).filter((h) => h.d >= common).map((h) => ({ d: new Date(h.d), v: tr.metric === 'revIdx' ? h.rev : TR_METRICS[tr.metric](h) })).filter((p) => p.v != null);
    if (tr.metric === 'revIdx' && pts.length) { const base = pts[0].v; pts = pts.map((p) => ({ d: p.d, v: base ? p.v / base * 100 : null })).filter((p) => p.v != null); }
    return { r, pts, color: TR_COLORS[order.indexOf(r.symbol) % TR_COLORS.length] };
  }).filter((s) => s.pts.length >= 2);
  if (!series.length) { el.replaceChildren(mk('p', 'nw-empty', t('tr.none'))); return; }
  const W = 900, H = 360, ml = 52, mr = 110, mt = 12, mb = 28;
  const all = series.flatMap((s) => s.pts);
  const x = d3.scaleTime(d3.extent(all, (p) => p.d), [ml, W - mr]);
  const lo = Math.min(0, d3.min(all, (p) => p.v)), hi = d3.max(all, (p) => p.v);
  const y = d3.scaleLinear([lo, hi], [H - mb, mt]).nice();
  const svg = d3.create('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', t('tr.' + tr.metric));
  const yt = y.ticks(5);
  svg.append('g').selectAll('line').data(yt).join('line').attr('class', 'grid').attr('x1', ml).attr('x2', W - mr).attr('y1', (v) => y(v)).attr('y2', (v) => y(v));
  svg.append('g').selectAll('text').data(yt).join('text').attr('class', 'ax').attr('x', ml - 6).attr('y', (v) => y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').text((v) => f0.format(v));
  svg.append('g').selectAll('text').data(x.ticks(6)).join('text').attr('class', 'ax').attr('x', (v) => x(v)).attr('y', H - 8).attr('text-anchor', 'middle').text((v) => dateLabel(v.toISOString().slice(0, 7)));
  const fmt = (v) => (['mar', 'gm', 'om'].includes(tr.metric) ? pctPlain(v) : f1.format(v));
  const line = d3.line().x((p) => x(p.d)).y((p) => y(p.v));
  // rótulos no fim das linhas: afasta os que ficariam um sobre o outro
  const LH = 12, ly = new Map();
  const ends = series.map((s) => ({ s, y: y(s.pts[s.pts.length - 1].v) })).sort((a, b) => a.y - b.y);
  ends.forEach((e, i) => { if (i && e.y < ends[i - 1].y + LH) e.y = ends[i - 1].y + LH; });
  for (let i = ends.length - 1; i >= 0; i--) { const max = i === ends.length - 1 ? H - mb : ends[i + 1].y - LH; if (ends[i].y > max) ends[i].y = max; }
  ends.forEach((e) => ly.set(e.s, e.y));
  series.forEach((s) => {
    s.path = svg.append('path').attr('d', line(s.pts)).attr('fill', 'none').attr('stroke', s.color).attr('stroke-width', 2.2);
    s.circ = svg.append('g').selectAll('circle').data(s.pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 3).attr('fill', s.color);
    const last = s.pts[s.pts.length - 1];
    svg.append('text').attr('class', 'ax').attr('x', x(last.d) + 12).attr('y', ly.get(s)).attr('dy', '0.35em').style('fill', s.color).style('font-weight', 600).style('pointer-events', 'none').text(s.r.name);
    svg.append('path').attr('d', `M${x(last.d) + 3},${y(last.v)}L${x(last.d) + 9},${ly.get(s)}`).attr('stroke', s.color).attr('stroke-width', 1).attr('fill', 'none').style('pointer-events', 'none');
  });

  // mouse over: um tooltip só (o <title> nativo pisca ao cruzar os pontos). Acha o ponto mais próximo em toda a área do gráfico,
  // destaca a linha e lista as empresas naquele trimestre. Só altera atributos e reposiciona: nunca redesenha o gráfico.
  const tip = mk('div', 'lx-tip'); tip.hidden = true;
  const ring = svg.append('circle').attr('r', 6).attr('fill', 'none').attr('stroke-width', 2).style('display', 'none').style('pointer-events', 'none');
  const dots = series.flatMap((s) => s.pts.map((p) => ({ s, p, cx: x(p.d), cy: y(p.v) })));
  let cur = null;
  const clear = () => {
    cur = null; tip.hidden = true; ring.style('display', 'none');
    series.forEach((s) => { s.path.attr('stroke-opacity', 1).attr('stroke-width', 2.2); s.circ.attr('fill-opacity', 1); });
  };
  const showTip = (best) => {
    const when = best.p.d.getTime();
    // o trimestre mais próximo de cada empresa (os fechos caem em meses diferentes)
    const same = series.map((s) => { const q = s.pts.reduce((a, b) => (Math.abs(b.d - when) < Math.abs(a.d - when) ? b : a)); return Math.abs(q.d - when) <= 46 * 864e5 ? { s, q } : null; })
      .filter(Boolean).sort((a, b) => b.q.v - a.q.v);
    const rows = same.map(({ s, q }) => {
      const row = mk('div'); row.style.cssText = 'display:flex;gap:8px;align-items:center;' + (s === best.s ? 'font-weight:600;' : '');
      const sw = mk('span'); sw.style.cssText = `width:8px;height:8px;border-radius:50%;flex:none;background:${s.color}`;
      const nm = mk('span', null, s.r.name); nm.style.flex = '1';
      row.append(sw, nm, mk('span', null, fmt(q.v)));
      if (Math.abs(q.d - when) > 10 * 864e5) { const m = mk('span', 't', dateLabel(q.d.toISOString().slice(0, 7))); m.style.cssText = 'min-width:3.6em;text-align:right'; row.append(m); }
      return row;
    });
    tip.replaceChildren(mk('div', 't', date(best.p.d.toISOString().slice(0, 10)) + ' · ' + t('tr.' + tr.metric)), ...rows);
  };
  svg.append('rect').attr('x', ml).attr('y', mt).attr('width', W - mr - ml).attr('height', H - mb - mt).attr('fill', 'transparent')
    .on('mousemove', (event) => {
      const [mx, my] = d3.pointer(event);
      let best = null, bd = Infinity;
      for (const q of dots) { const d = (q.cx - mx) ** 2 + (q.cy - my) ** 2; if (d < bd) { bd = d; best = q; } }
      if (!best || bd > 50 * 50) { if (cur) clear(); return; }
      if (!cur || cur.s !== best.s || cur.p !== best.p) {   // só mexe no que mudou de ponto
        cur = best;
        series.forEach((s) => { const on = s === best.s; s.path.attr('stroke-opacity', on ? 1 : 0.18).attr('stroke-width', on ? 3.4 : 2.2); s.circ.attr('fill-opacity', on ? 1 : 0.18); });
        ring.attr('cx', best.cx).attr('cy', best.cy).attr('stroke', best.s.color).style('display', null);
        showTip(best);
      }
      tip.hidden = false;
      const [px, py] = d3.pointer(event, el), w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = Math.max(0, px + 16 + w > el.clientWidth ? px - w - 16 : px + 16) + 'px';
      tip.style.top = Math.max(0, Math.min(py - h / 2, el.clientHeight - h)) + 'px';
    })
    .on('mouseleave', clear);
  el.replaceChildren(svg.node(), tip);
});
window.addEventListener('lx-tab', (e) => { if (e.detail === 'explore') { dash.draw('scatter'); dash.draw('trend'); } });
