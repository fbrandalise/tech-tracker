/* Aba Calendário: próximos resultados (com contagem regressiva e estimativas) e reação do preço aos últimos. */
addDict({
  'cal.h': 'Próximos resultados', 'cal.note': 'Datas e estimativas de consenso das fontes (FMP e Yahoo). "Estimada" significa que a empresa ainda não confirmou a data.',
  'cal.date': 'Data', 'cal.in': 'Quando', 'cal.company': 'Empresa', 'cal.status': 'Data', 'cal.eps': 'EPS esperado', 'cal.rev': 'Receita esperada', 'cal.last': 'Último EPS vs esperado',
  'cal.today': 'hoje', 'cal.tomorrow': 'amanhã', 'cal.days': 'em {n} dias', 'cal.past': 'há {n} dias',
  'cal.confirmed': 'Confirmada', 'cal.estimated': 'Estimada', 'cal.unknown': 'Da fonte',
  'cal.nodate': 'Sem data divulgada: {names}.', 'cal.empty': 'Nenhum resultado futuro nas fontes.',
  'cal.react.h': 'Reação do preço aos últimos resultados', 'cal.react.note': 'Variação da ação do fechamento do dia anterior à divulgação ao fechamento do dia seguinte. A janela de 2 dias mistura empresas que divulgam antes e depois do pregão; a data de divulgação de algumas empresas vem de comunicados.',
  'cal.react.date': 'Divulgação', 'cal.react.move': 'Reação (2 dias)', 'cal.react.none': 'Sem preços para a janela da divulgação.',
}, {
  'cal.h': 'Upcoming earnings', 'cal.note': 'Dates and consensus estimates from the sources (FMP and Yahoo). "Estimated" means the company has not confirmed the date yet.',
  'cal.date': 'Date', 'cal.in': 'When', 'cal.company': 'Company', 'cal.status': 'Date', 'cal.eps': 'Expected EPS', 'cal.rev': 'Expected revenue', 'cal.last': 'Last EPS vs expected',
  'cal.today': 'today', 'cal.tomorrow': 'tomorrow', 'cal.days': 'in {n} days', 'cal.past': '{n} days ago',
  'cal.confirmed': 'Confirmed', 'cal.estimated': 'Estimated', 'cal.unknown': 'From source',
  'cal.nodate': 'No date announced: {names}.', 'cal.empty': 'No future earnings in the sources.',
  'cal.react.h': 'Price reaction to the latest results', 'cal.react.note': 'Stock move from the close before the report date to the close after it. The 2-day window mixes companies that report before and after the market; some report dates come from company releases.',
  'cal.react.date': 'Reported', 'cal.react.move': 'Reaction (2 days)', 'cal.react.none': 'No prices for the report window.',
});

const dayDiff = (iso) => Math.round((new Date(iso + 'T00:00:00Z') - new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')) / 864e5);
const whenText = (n) => (n === 0 ? t('cal.today') : n === 1 ? t('cal.tomorrow') : n > 1 ? t('cal.days', { n }) : t('cal.past', { n: -n }));
const weekday = (iso) => new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
const monthName = (iso) => { const m = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z')); return m.charAt(0).toUpperCase() + m.slice(1); };

dash.draw('cal', (el) => {
  const g = dash.data('earnings'); if (g.status !== 'ok') return;
  const rows = rowsOf();
  const future = rows.filter((r) => r.nextEarnings && dayDiff(r.nextEarnings) >= 0).sort((a, b) => a.nextEarnings.localeCompare(b.nextEarnings));
  const nodate = rows.filter((r) => !r.nextEarnings || dayDiff(r.nextEarnings) < 0).map((r) => r.name);
  if (!future.length) { el.replaceChildren(mk('p', 'nw-empty', t('cal.empty'))); }
  else {
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
    const wrap = mk('div', 'cmp-scroll'); wrap.appendChild(tbl);
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
