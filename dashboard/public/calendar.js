/* Aba Calendário: próximos resultados (com contagem regressiva e estimativas) e reação do preço aos últimos. */
addDict({
  'cal.h': 'Próximos resultados', 'cal.note': 'Datas e estimativas de consenso das fontes (FMP e Yahoo). "Estimada" significa que a empresa ainda não confirmou a data.',
  'cal.date': 'Data', 'cal.in': 'Quando', 'cal.company': 'Empresa', 'cal.status': 'Data', 'cal.eps': 'EPS esperado', 'cal.rev': 'Receita esperada', 'cal.last': 'Último EPS vs esperado',
  'cal.today': 'hoje', 'cal.tomorrow': 'amanhã', 'cal.days': 'em {n} dias', 'cal.past': 'há {n} dias',
  'cal.confirmed': 'Confirmada', 'cal.estimated': 'Estimada', 'cal.unknown': 'Da fonte',
  'cal.nodate': 'Sem data divulgada: {names}.', 'cal.empty': 'Nenhum resultado futuro nas fontes.',
  'cal.react.h': 'Reação do preço aos últimos resultados', 'cal.react.note': 'Variação da ação do fechamento do dia anterior à divulgação ao fechamento do dia seguinte. A janela de 2 dias mistura empresas que divulgam antes e depois do pregão; a data de divulgação de algumas empresas vem de comunicados.',
  'cal.brief': 'Clique em uma empresa para ver o briefing.', 'cal.b.watch': 'O que observar', 'cal.b.eps': 'Histórico de acerto do EPS', 'cal.b.react': 'Última reação do preço', 'cal.b.reactNote': 'Só há a reação mais recente.', 'cal.b.trend': 'Tendência', 'cal.b.err': 'Não foi possível carregar o briefing.', 'cal.b.real': 'Real', 'cal.b.est': 'Estimado', 'cal.b.sup': 'Surpresa', 'cal.b.q': 'Trimestre', 'cal.b.rev': 'Receita', 'cal.b.yoy': 'a/a', 'cal.b.op': 'Margem op.', 'cal.b.rd': 'P&D', 'cal.b.disc': 'Calculado só com os números do banco, sem IA. Não é recomendação de investimento.',
  'cal.react.date': 'Divulgação', 'cal.react.move': 'Reação (2 dias)', 'cal.react.none': 'Sem preços para a janela da divulgação.',
}, {
  'cal.h': 'Upcoming earnings', 'cal.note': 'Dates and consensus estimates from the sources (FMP and Yahoo). "Estimated" means the company has not confirmed the date yet.',
  'cal.date': 'Date', 'cal.in': 'When', 'cal.company': 'Company', 'cal.status': 'Date', 'cal.eps': 'Expected EPS', 'cal.rev': 'Expected revenue', 'cal.last': 'Last EPS vs expected',
  'cal.today': 'today', 'cal.tomorrow': 'tomorrow', 'cal.days': 'in {n} days', 'cal.past': '{n} days ago',
  'cal.confirmed': 'Confirmed', 'cal.estimated': 'Estimated', 'cal.unknown': 'From source',
  'cal.nodate': 'No date announced: {names}.', 'cal.empty': 'No future earnings in the sources.',
  'cal.react.h': 'Price reaction to the latest results', 'cal.react.note': 'Stock move from the close before the report date to the close after it. The 2-day window mixes companies that report before and after the market; some report dates come from company releases.',
  'cal.brief': 'Click a company to see its briefing.', 'cal.b.watch': 'What to watch', 'cal.b.eps': 'EPS beat history', 'cal.b.react': 'Latest price reaction', 'cal.b.reactNote': 'Only the most recent reaction is available.', 'cal.b.trend': 'Trend', 'cal.b.err': 'Could not load the briefing.', 'cal.b.real': 'Actual', 'cal.b.est': 'Estimate', 'cal.b.sup': 'Surprise', 'cal.b.q': 'Quarter', 'cal.b.rev': 'Revenue', 'cal.b.yoy': 'YoY', 'cal.b.op': 'Op. margin', 'cal.b.rd': 'R&D', 'cal.b.disc': 'Computed only from the database numbers, no AI. Not investment advice.',
  'cal.react.date': 'Reported', 'cal.react.move': 'Reaction (2 days)', 'cal.react.none': 'No prices for the report window.',
});

const dayDiff = (iso) => Math.round((new Date(iso + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 864e5);
const whenText = (n) => (n === 0 ? t('cal.today') : n === 1 ? t('cal.tomorrow') : n > 1 ? t('cal.days', { n }) : t('cal.past', { n: -n }));
const weekday = (iso) => new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
const monthName = (iso) => { const m = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z')); return m.charAt(0).toUpperCase() + m.slice(1); };

const bn1 = (x, d = 1) => (x == null ? '—' : x.toFixed(d));
function briefTable(heads, rows) {
  const tbl = mk('table', 'cal-t'); const hr = document.createElement('tr');
  heads.forEach(([k, c]) => hr.appendChild(mk('th', c, t(k))));
  const th = document.createElement('thead'); th.appendChild(hr); tbl.appendChild(th);
  const tb = document.createElement('tbody');
  rows.forEach((cells) => { const tr = document.createElement('tr'); cells.forEach((v, i) => tr.appendChild(mk('td', heads[i][1], v))); tb.appendChild(tr); });
  tbl.appendChild(tb); const w = mk('div', 'cal-brief-scroll'); w.appendChild(tbl); return w;
}
// painel do briefing: tudo entra por textContent (mk), nada de HTML vindo do servidor
async function fillBrief(box, symbol) {
  box.replaceChildren(mk('p', 'note', '…'));
  let b;
  try { const r = await fetch('/api/briefing/' + encodeURIComponent(symbol) + '?lang=' + LANG); if (!r.ok) throw new Error(r.status); b = await r.json(); }
  catch (e) { box.replaceChildren(mk('p', 'note', t('cal.b.err'))); return; }
  const out = [];
  out.push(mk('h3', null, t('cal.b.watch')));
  const ul = mk('ul', 'cal-brief-list'); b.watch.forEach((w) => ul.appendChild(mk('li', null, w))); out.push(ul);
  out.push(mk('h3', null, t('cal.b.eps')));
  out.push(briefTable([['cal.date', ''], ['cal.b.real', 'num'], ['cal.b.est', 'num'], ['cal.b.sup', 'num']], b.eps.map((x) => [date(x.date), f2.format(x.actual), f2.format(x.estimate), pct(x.surprisePct)])));
  if (b.reaction) { out.push(mk('h3', null, t('cal.b.react'))); out.push(mk('p', 'note', date(b.reaction.report) + ': ' + pct(b.reaction.pct) + '. ' + t('cal.b.reactNote'))); }
  out.push(mk('h3', null, t('cal.b.trend')));
  out.push(briefTable([['cal.b.q', ''], ['cal.b.rev', 'num'], ['cal.b.yoy', 'num'], ['cal.b.op', 'num'], ['cal.b.rd', 'num']],
    b.trend.slice(-6).map((x) => [date(x.period_end), bn1(x.revenue), x.yoy == null ? '—' : pct(x.yoy), x.op == null ? '—' : bn1(x.op) + '%', x.rd == null ? '—' : bn1(x.rd) + '%'])));
  out.push(mk('p', 'dt-foot', t('cal.b.disc')));
  box.replaceChildren(...out);
}

dash.draw('cal', (el) => {
  const g = dash.data('earnings'); if (g.status !== 'ok') return;
  const rows = rowsOf();
  const future = rows.filter((r) => r.nextEarnings && dayDiff(r.nextEarnings) >= 0).sort((a, b) => a.nextEarnings.localeCompare(b.nextEarnings));
  const nodate = rows.filter((r) => !r.nextEarnings || dayDiff(r.nextEarnings) < 0).map((r) => r.name);
  if (!future.length) { el.replaceChildren(mk('p', 'nw-empty', t('cal.empty'))); }
  else {
    const scrollBox = mk('div', 'cmp-scroll'), wrap = scrollBox;
    const tbl = mk('table', 'cal-t');
    const head = document.createElement('tr');
    [['cal.date', ''], ['cal.in', ''], ['cal.company', ''], ['cal.status', ''], ['cal.eps', 'num'], ['cal.rev', 'num'], ['cal.last', 'num']].forEach(([k, c]) => head.appendChild(mk('th', c, t(k))));
    const thead = document.createElement('thead'); thead.appendChild(head); tbl.appendChild(thead);
    const tb = document.createElement('tbody');
    let month = '';
    future.forEach((r) => {
      const mo = r.nextEarnings.slice(0, 7);
      if (mo !== month) { month = mo; const m = document.createElement('tr'); m.className = 'cal-m'; const th = mk('th', null, monthName(r.nextEarnings)); th.colSpan = 7; m.appendChild(th); tb.appendChild(m); }
      const n = dayDiff(r.nextEarnings);
      const tr = document.createElement('tr');
      if (n <= 7) tr.className = 'soon';
      tr.classList.add('cal-click'); tr.tabIndex = 0; tr.setAttribute('role', 'button'); tr.setAttribute('aria-expanded', 'false'); tr.title = t('cal.brief');
      const toggle = () => {
        const open = tr.nextElementSibling?.classList.contains('cal-brief');
        tb.querySelectorAll('tr.cal-brief').forEach((x) => { x.previousElementSibling.setAttribute('aria-expanded', 'false'); x.remove(); });
        scrollBox.style.maxHeight = open ? '' : 'none';   // com o briefing aberto a caixa cresce em vez de cortá-lo
        if (open) return;
        const d = document.createElement('tr'); d.className = 'cal-brief'; const td = document.createElement('td'); td.colSpan = 7;
        const box = mk('div', 'cal-brief-box'); td.appendChild(box); d.appendChild(td); tr.after(d); tr.setAttribute('aria-expanded', 'true');
        fillBrief(box, r.symbol);
      };
      tr.addEventListener('click', toggle);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      tr.appendChild(mk('td', null, weekday(r.nextEarnings) + ' ' + date(r.nextEarnings)));
      tr.appendChild(mk('td', 'cal-when', whenText(n)));
      const c = mk('td', null, r.name); c.appendChild(mk('span', 'sym', r.symbol + ' · ' + mktName(r.market))); tr.appendChild(c);
      tr.appendChild(mk('td', null, r.nextEstimated === true ? t('cal.estimated') : r.nextEstimated === false ? t('cal.confirmed') : t('cal.unknown')));
      tr.appendChild(mk('td', 'num', r.nextEps == null ? '—' : f2.format(r.nextEps)));
      tr.appendChild(mk('td', 'num', r.nextRevB == null ? '—' : f1.format(r.nextRevB) + ' ' + t('u.bn') + ' ' + r.currency));
      tr.appendChild(mk('td', 'num ' + (r.epsSurprisePct == null ? 'mute' : r.epsSurprisePct > 2 ? 'up' : r.epsSurprisePct < -2 ? 'down' : 'flat'), r.epsSurprisePct == null ? '—' : pct(r.epsSurprisePct)));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    el.replaceChildren(wrap);
  }
  if (nodate.length) el.appendChild(mk('p', 'dt-foot', t('cal.nodate', { names: nodate.join(', ') })));
});

dash.draw('cal-react', (el) => {
  const g = dash.data('earnings'); if (g.status !== 'ok') return;
  const rows = rowsOf().filter((r) => r.reportDate).sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  const mx = Math.max(10, ...rows.map((r) => Math.abs(r.reactPct || 0)));
  const tbl = mk('table', 'cal-t');
  const head = document.createElement('tr');
  [['cal.react.date', ''], ['cal.company', ''], ['m.epsSurprisePct', 'num'], ['cal.react.move', 'num'], ['', '']].forEach(([k, c]) => head.appendChild(mk('th', c, k ? t(k) : '')));
  const thead = document.createElement('thead'); thead.appendChild(head); tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.appendChild(mk('td', null, date(r.reportDate)));
    const c = mk('td', null, r.name); c.appendChild(mk('span', 'sym', r.symbol)); tr.appendChild(c);
    tr.appendChild(mk('td', 'num ' + (r.epsSurprisePct == null ? 'mute' : r.epsSurprisePct > 2 ? 'up' : r.epsSurprisePct < -2 ? 'down' : 'flat'), r.epsSurprisePct == null ? '—' : pct(r.epsSurprisePct)));
    tr.appendChild(mk('td', 'num ' + tone(r.reactPct), r.reactPct == null ? '—' : pct(r.reactPct)));
    const bar = mk('td', 'cal-bar');
    if (r.reactPct != null) {
      const w = Math.min(50, Math.abs(r.reactPct) / mx * 50);
      const i = document.createElement('i'); i.style.width = w + '%'; i.style.left = r.reactPct >= 0 ? '50%' : (50 - w) + '%'; i.style.background = dash.colors[r.market === 'EUA' ? 0 : 1];
      bar.append(mk('span', 'axis'), i);
      bar.title = t('ch.react.x', { d: date(r.reportDate), a: date(r.reactFrom), b: date(r.reactTo) });
    } else bar.title = t('cal.react.none');
    tr.appendChild(bar);
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  const wrap = mk('div', 'cmp-scroll'); wrap.appendChild(tbl);
  el.replaceChildren(wrap);
});
