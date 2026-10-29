/* Comparação lado a lado: até 4 empresas marcadas na tabela ou clicadas no gráfico de dispersão. Sempre em USD. */
addDict({
  'cmp.h': 'Comparação lado a lado', 'cmp.clear': 'Limpar seleção', 'cmp.hint1': 'Marque mais uma empresa na tabela (ou clique em um ponto da aba Explorar) para comparar.',
  'cmp.max': 'Máximo de 4 empresas. Desmarque uma para escolher outra.', 'cmp.usd': 'Valores em dinheiro convertidos para USD. O destaque marca o melhor valor entre as selecionadas nos indicadores em que maior é melhor; múltiplos de valuation e despesas não têm destaque, porque "melhor" depende do caso.',
  'cmp.remove': 'Remover {n} da comparação',
  'cmp.g.res': 'Resultado do trimestre', 'cmp.g.prof': 'Rentabilidade', 'cmp.g.size': 'Tamanho', 'cmp.g.exp': 'Despesas e investimento', 'cmp.g.val': 'Valuation',
}, {
  'cmp.h': 'Side-by-side comparison', 'cmp.clear': 'Clear selection', 'cmp.hint1': 'Tick one more company in the table (or click a point in the Explore tab) to compare.',
  'cmp.max': 'Maximum of 4 companies. Untick one to pick another.', 'cmp.usd': 'Money values converted to USD. The highlight marks the best value among the selected companies for metrics where higher is better; valuation multiples and expenses have no highlight because "better" depends on the case.',
  'cmp.remove': 'Remove {n} from the comparison',
  'cmp.g.res': 'Quarter results', 'cmp.g.prof': 'Profitability', 'cmp.g.size': 'Size', 'cmp.g.exp': 'Expenses and investment', 'cmp.g.val': 'Valuation',
});

const CMP_GROUPS = [
  ['cmp.g.res', ['epsSurprisePct', 'revenueYoY', 'netIncomeYoY', 'reactPct']],
  ['cmp.g.prof', ['grossMargin', 'operatingMargin', 'ebitdaMargin', 'netMargin', 'fcfMargin', 'taxRate']],
  ['cmp.g.size', ['revenueB', 'netIncomeB', 'fcfB', 'cashB', 'mcapUsdB', 'employees', 'revPerEmployeeK']],
  ['cmp.g.exp', ['salesMktPct', 'rdPct', 'sbcPct', 'capexPct', 'opexPct', 'gaPct']],
  ['cmp.g.val', ['pe', 'fwdPe', 'ps', 'evRev', 'evEbitda']],
];
const MAXCMP = 4;
const refreshChecks = () => document.querySelectorAll('.cmp-cb').forEach((cb) => { cb.checked = CMP.has(cb.dataset.sym); });
function toggleCmp(sym, on) {
  if (on == null) on = !CMP.has(sym);
  if (on) {
    if (CMP.size >= MAXCMP && !CMP.has(sym)) { const n = document.getElementById('cmp-msg'); if (n) { n.hidden = false; n.textContent = t('cmp.max'); } refreshChecks(); return false; }
    CMP.add(sym);
  } else CMP.delete(sym);
  const n = document.getElementById('cmp-msg'); if (n) n.hidden = true;
  refreshChecks();
  dash.draw('cmp');
  return true;
}
document.querySelector('.lx table tbody').addEventListener('change', (e) => {
  const cb = e.target.closest('.cmp-cb'); if (!cb) return;
  if (!toggleCmp(cb.dataset.sym, cb.checked)) cb.checked = false;
});

dash.draw('cmp', (el) => {
  const sec = document.getElementById('cmp-sec');
  const sel = [...CMP].map((s) => rowsUsd().find((r) => r.symbol === s)).filter(Boolean);
  sec.hidden = sel.length === 0;
  if (!sel.length) { el.replaceChildren(); return; }
  if (sel.length === 1) { el.replaceChildren(mk('p', 'dt-foot', t('cmp.hint1')), chips(sel)); return; }
  const tbl = mk('table', 'cmp-t');
  const thead = document.createElement('thead'); const hr = document.createElement('tr');
  hr.appendChild(mk('th', null, ''));
  sel.forEach((r) => {
    const th = mk('th', 'cmp-co');
    th.append(mk('span', 'cmp-n', r.name), mk('span', 'sym', r.symbol));
    const x = mk('button', 'cmp-x', '×'); x.type = 'button'; x.setAttribute('aria-label', t('cmp.remove', { n: r.name })); x.addEventListener('click', () => toggleCmp(r.symbol, false));
    th.appendChild(x); hr.appendChild(th);
  });
  thead.appendChild(hr); tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  CMP_GROUPS.forEach(([gk, keys]) => {
    const gr = document.createElement('tr'); gr.className = 'cmp-g';
    const gt = mk('th', null, t(gk)); gt.colSpan = sel.length + 1; gr.appendChild(gt); tb.appendChild(gr);
    keys.forEach((k) => {
      const vals = sel.map((r) => r[k]);
      if (vals.every((v) => v == null)) return;
      const m = MET[k];
      const tr = document.createElement('tr');
      tr.appendChild(mk('th', 'cmp-l', metricLabel(k)));
      const nums = vals.filter((v) => v != null);
      const best = m.dir === 1 && nums.length > 1 ? Math.max(...nums) : null;
      const mx = Math.max(...nums.map((v) => Math.abs(v)), 1e-9);
      sel.forEach((r, i) => {
        const v = vals[i];
        const td = mk('td', 'num' + (best != null && v === best ? ' best' : ''));
        td.appendChild(mk('span', 'cmp-v', fmtMetric(k, r)));
        if (v != null && ['pct', 'pctS'].includes(m.type)) {
          const bar = mk('span', 'cmp-b'); const b = document.createElement('i');
          b.style.width = Math.min(100, Math.abs(v) / mx * 100) + '%'; b.style.background = dash.colors[r.market === 'EUA' ? 0 : 1];
          if (v < 0) b.style.opacity = 0.55;
          bar.appendChild(b); td.appendChild(bar);
        }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  });
  tbl.appendChild(tb);
  const wrap = mk('div', 'cmp-scroll'); wrap.appendChild(tbl);
  el.replaceChildren(wrap, mk('p', 'dt-foot', t('cmp.usd')));
});
function chips(sel) {
  const d = mk('div', 'cmp-chips');
  sel.forEach((r) => { const c = mk('span', 'nw-chip', r.name); d.appendChild(c); });
  return d;
}
document.getElementById('cmp-clear').addEventListener('click', () => { CMP.clear(); refreshChecks(); dash.draw('cmp'); const n = document.getElementById('cmp-msg'); if (n) n.hidden = true; });
