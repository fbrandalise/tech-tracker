/* Idioma (PT-BR / EN), dicionário e formatadores. Trocar o idioma recarrega a página. */
const LANG = (() => {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'pt') return q;
    const s = localStorage.getItem('lx-lang');
    if (s === 'en' || s === 'pt') return s;
  } catch (e) { /* sem armazenamento */ }
  return String(navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en';
})();
const LOCALE = LANG === 'pt' ? 'pt-BR' : 'en-US';
const DICT = { pt: {}, en: {} };
const addDict = (pt, en) => { Object.assign(DICT.pt, pt); Object.assign(DICT.en, en); };
const t = (key, vars) => {
  let s = DICT[LANG][key] ?? DICT.pt[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? '' : vars[k]));
  return s;
};
// texto com partes em negrito: {*nome} vira <b>valor</b>, {nome} vira texto
const fill = (el, key, vars) => {
  const s = DICT[LANG][key] ?? DICT.pt[key] ?? key;
  const frag = document.createDocumentFragment();
  s.split(/(\{\*?\w+\})/).forEach((part) => {
    const m = part.match(/^\{(\*?)(\w+)\}$/);
    if (!m) { if (part) frag.appendChild(document.createTextNode(part)); return; }
    const v = vars[m[2]] == null ? '' : String(vars[m[2]]);
    if (m[1]) { const b = document.createElement('b'); b.textContent = v; frag.appendChild(b); } else frag.appendChild(document.createTextNode(v));
  });
  el.replaceChildren(frag);
};

// ---- formatadores
const nf = (d) => new Intl.NumberFormat(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });
const f0 = nf(0), f1 = nf(1), f2 = nf(2);
const pct = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + f1.format(v) + '%');
const pctPlain = (v) => (v == null ? '—' : f1.format(v) + '%');
const mult = (v) => (v == null ? '—' : f1.format(v) + '×');
const dateFmt = d3.utcFormat(LANG === 'pt' ? '%d/%m/%y' : '%m/%d/%y');
const date = (s) => (s ? dateFmt(new Date(s)) : '—');
const dateLabel = (s) => {
  const p = String(s).split('-');
  if (p.length === 3) return date(s);
  if (p.length === 2) return LANG === 'pt' ? p[1] + '/' + p[0] : p[1] + '/' + p[0];
  return p[0];
};
const tone = (v) => (v == null ? 'mute' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat');
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const mktName = (m) => (m === 'EUA' ? t('mkt.us') : m);
const UNIT = () => ({ bn: t('u.bn'), k: t('u.k') });

addDict({
  title: 'Resultados de tecnologia',
  desc: 'Resultados do último trimestre das big techs dos EUA e de Hong Kong: EPS, receita, margens, valuation e destaques.',
  eyebrow: 'Big techs dos EUA e de Hong Kong · último trimestre divulgado',
  h1: 'Resultados de tecnologia',
  take: '{*beats} de {*with} empresas com EPS disponível superaram o esperado. Ficaram abaixo: {*miss}.',
  none: 'nenhuma',
  'lang.aria': 'Idioma',
  'tabs.aria': 'Seções',
  'tab.results': 'Resultados', 'tab.explore': 'Explorar', 'tab.calendar': 'Calendário', 'tab.news': 'Novidades de produtos', 'tab.usage': 'Comportamento de uso de produtos',
  'k.aria': 'Indicadores gerais',
  'k.beats': 'Superaram o EPS esperado', 'k.of': 'de', 'k.below': 'Abaixo:', 'k.inline': 'em linha:',
  'k.rev': 'Receita a/a (mediana)', 'k.mar': 'Margem líquida (mediana)', 'k.top': 'Maior crescimento de receita',
  'k.us': 'EUA', 'k.hk': 'HK',
  'tbl.h': 'Comparação do último trimestre',
  'tbl.note': 'Valores na moeda de cada empresa (ou em USD, no botão Moeda). Clique em um cabeçalho para ordenar, na seta ▸ para ver segmentos e histórico, ou em um valor para ver como ele é calculado. Marque até 4 empresas para compará-las.',
  'tbl.search': 'Buscar empresa ou símbolo',
  'mkt.aria': 'Mercado', 'mkt.all': 'Todos os mercados', 'mkt.us': 'EUA', 'mkt.hk': 'Hong Kong',
  'grp.aria': 'Colunas exibidas', 'grp.res': 'Resultado', 'grp.rent': 'Rentabilidade', 'grp.desp': 'Despesas', 'grp.caixa': 'Caixa e balanço', 'grp.val': 'Valuation', 'grp.all': 'Tudo',
  'cur.aria': 'Moeda', 'cur.orig': 'Moeda original', 'cur.usd': 'USD', 'cur.label': 'Moeda',
  'cur.note': 'Convertido para USD pelo câmbio de {date} (CNY {cny}).',
  'count': 'empresas',
  'u.bn': 'bi', 'u.k': 'mil',
  'ch.h': 'Comparação visual',
  'ch.rev': 'Crescimento da receita a/a', 'ch.rev.n': 'Receita do trimestre contra o mesmo trimestre do ano anterior.',
  'ch.mar': 'Margem líquida', 'ch.mar.n': 'Lucro líquido dividido pela receita do trimestre.',
  'ch.eps': 'EPS realizado vs esperado', 'ch.eps.n': 'Diferença percentual entre o EPS realizado e o esperado. Barras muito longas são cortadas; o rótulo (▸) mostra o valor real.',
  'ch.react': 'Reação do preço', 'ch.react.n': 'Variação da ação entre o fechamento do dia anterior à divulgação e o do dia seguinte (janela de 2 dias).',
  'ch.missing': 'Sem dado na fonte: {names}.',
  'ch.q': 'trimestre até',
  'ch.rev.x': 'Receita: {v}', 'ch.mar.x': 'Lucro líquido: {v}', 'ch.eps.x': 'EPS real {a} contra esperado {e}', 'ch.react.x': 'Divulgação em {d}; fechamento de {a} a {b}',
  'foot.main': 'Dados coletados automaticamente (Financial Modeling Prep para as empresas dos EUA que o plano gratuito cobre; Yahoo Finance para as demais, para valuation, preços e calendário). Despesas, caixa, balanço e funcionários vêm das mesmas fontes (Meituan: anúncio de resultados da empresa). Receita por segmento: comunicados e relatórios oficiais de cada empresa, com o link na linha expandida.',
  'foot.note': 'O Yahoo informa o fim do trimestre, não a data de divulgação, e traz poucos trimestres de histórico. EPS real e estimado podem estar em bases diferentes (GAAP e ajustado), por isso surpresas muito grandes pedem conferência no relatório oficial. Os destaques são gerados por regras sobre estes números, não pela leitura dos relatórios.',
  'foot.updated': 'Última atualização dos dados: {when}.',
  'tbl.foot': '* Empresa que reporta só SG&A (vendas, gerais e administrativas) numa linha; o valor inclui despesas administrativas. Variação de despesa não é boa nem ruim por si só, por isso não há cor. Caixa = caixa e aplicações de curto prazo; dívida = dívida de curto e longo prazo conforme a fonte (pode incluir arrendamentos financeiros e muda entre FMP e Yahoo); caixa líquido = caixa menos dívida, só como referência. Fluxo de caixa livre (FCF) = caixa gerado pelas operações menos capex (investimento em equipamentos e infraestrutura). Funcionários: último 10-K quando o FMP libera (com data), senão o perfil do Yahoo, sem data; receita por funcionário = receita do trimestre × 4 ÷ funcionários. Valuation: valor de mercado em USD; múltiplos calculados com os últimos 12 meses de receita, lucro e EBITDA (P/L só se o lucro for positivo). Reação do preço: fechamento do dia anterior à divulgação até o fechamento do dia seguinte. O Yahoo não traz fluxo de caixa de várias empresas de Hong Kong, e a Tencent não abre P&D. Na Amazon, P&D é "tecnologia e infraestrutura".',
  'hl.none': '—',
}, {
  title: 'Tech earnings',
  desc: 'Latest-quarter results of US and Hong Kong big tech: EPS, revenue, margins, valuation and highlights.',
  eyebrow: 'US and Hong Kong big tech · latest reported quarter',
  h1: 'Tech earnings',
  take: '{*beats} of {*with} companies with EPS available beat expectations. Below: {*miss}.',
  none: 'none',
  'lang.aria': 'Language',
  'tabs.aria': 'Sections',
  'tab.results': 'Results', 'tab.explore': 'Explore', 'tab.calendar': 'Calendar', 'tab.news': 'Product news', 'tab.usage': 'Product usage behavior',
  'k.aria': 'Key figures',
  'k.beats': 'Beat expected EPS', 'k.of': 'of', 'k.below': 'Below:', 'k.inline': 'in line:',
  'k.rev': 'Revenue YoY (median)', 'k.mar': 'Net margin (median)', 'k.top': 'Fastest revenue growth',
  'k.us': 'US', 'k.hk': 'HK',
  'tbl.h': 'Latest-quarter comparison',
  'tbl.note': "Values in each company's currency (or in USD, using the Currency button). Click a header to sort, the ▸ arrow for segments and history, or a value to see how it is calculated. Tick up to 4 companies to compare them.",
  'tbl.search': 'Search company or symbol',
  'mkt.aria': 'Market', 'mkt.all': 'All markets', 'mkt.us': 'US', 'mkt.hk': 'Hong Kong',
  'grp.aria': 'Columns shown', 'grp.res': 'Results', 'grp.rent': 'Profitability', 'grp.desp': 'Expenses', 'grp.caixa': 'Cash and balance sheet', 'grp.val': 'Valuation', 'grp.all': 'All',
  'cur.aria': 'Currency', 'cur.orig': 'Original currency', 'cur.usd': 'USD', 'cur.label': 'Currency',
  'cur.note': 'Converted to USD at the {date} exchange rate (CNY {cny}).',
  'count': 'companies',
  'u.bn': 'B', 'u.k': 'K',
  'ch.h': 'Visual comparison',
  'ch.rev': 'Revenue growth YoY', 'ch.rev.n': 'Quarter revenue versus the same quarter a year earlier.',
  'ch.mar': 'Net margin', 'ch.mar.n': 'Net income divided by quarter revenue.',
  'ch.eps': 'Actual vs expected EPS', 'ch.eps.n': 'Percentage difference between actual and expected EPS. Very long bars are clipped; the label (▸) shows the real value.',
  'ch.react': 'Price reaction', 'ch.react.n': 'Stock move from the close before the report date to the close after it (2-day window).',
  'ch.missing': 'No data from the source: {names}.',
  'ch.q': 'quarter ended',
  'ch.rev.x': 'Revenue: {v}', 'ch.mar.x': 'Net income: {v}', 'ch.eps.x': 'Actual EPS {a} vs expected {e}', 'ch.react.x': 'Reported {d}; close of {a} to {b}',
  'foot.main': 'Data collected automatically (Financial Modeling Prep for the US companies its free plan covers; Yahoo Finance for the rest, plus valuation, prices and calendar). Expenses, cash, balance sheet and headcount come from the same sources (Meituan: the company\'s results announcement). Segment revenue: each company\'s official releases and filings, linked in the expanded row.',
  'foot.note': 'Yahoo gives the quarter end, not the report date, and only a few quarters of history. Actual and expected EPS may be on different bases (GAAP vs adjusted), so very large surprises should be checked against the official report. Highlights are generated by rules over these numbers, not by reading the reports.',
  'foot.updated': 'Data last updated: {when}.',
  'tbl.foot': '* Company reports only SG&A (selling, general and administrative) on one line; the value includes administrative expenses. Expense changes are neither good nor bad by themselves, so there is no color. Cash = cash and short-term investments; debt = short- and long-term debt as given by the source (may include finance leases and differs between FMP and Yahoo); net cash = cash minus debt, for reference only. Free cash flow (FCF) = cash generated by operations minus capex (investment in equipment and infrastructure). Employees: latest 10-K when FMP allows it (dated), otherwise the Yahoo profile, undated; revenue per employee = quarter revenue × 4 ÷ employees. Valuation: market cap in USD; multiples use trailing-12-month revenue, earnings and EBITDA (P/E only if earnings are positive). Price reaction: close before the report date to close after it. Yahoo has no cash-flow data for several Hong Kong companies, and Tencent does not break out R&D. At Amazon, R&D is "technology and infrastructure".',
  'hl.none': '—',
});

// ---- textos estáticos do HTML
function applyStatic() {
  document.documentElement.lang = LANG === 'pt' ? 'pt-BR' : 'en';
  document.title = t('title');
  const d = document.querySelector('meta[name="description"]'); if (d) d.setAttribute('content', t('desc'));
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
  document.querySelectorAll('.lx-lang button').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.lang === LANG ? 'true' : 'false');
    b.addEventListener('click', () => {
      try { localStorage.setItem('lx-lang', b.dataset.lang); } catch (e) { /* ignore */ }
      const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString();
    });
  });
}
