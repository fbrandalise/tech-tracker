/* Registro de métricas: rótulo, formato, direção ("melhor") e a conta que explica cada número. */
addDict({
  'm.name': 'Empresa', 'm.market': 'Mercado', 'm.periodEnd': 'Trimestre até', 'm.epsActual': 'EPS real', 'm.epsEstimate': 'EPS esperado',
  'm.epsSurprisePct': 'EPS realizado vs esperado', 'm.revenueB': 'Receita', 'm.revenueYoY': 'Receita a/a', 'm.netIncomeB': 'Lucro líquido', 'm.netIncomeYoY': 'Lucro líq. a/a',
  'm.grossMargin': 'Margem bruta', 'm.operatingMargin': 'Margem op.', 'm.ebitdaMargin': 'Margem EBITDA', 'm.netMargin': 'Margem líq.', 'm.taxRate': 'Imposto efetivo',
  'm.employees': 'Funcionários', 'm.revPerEmployeeK': 'Receita por funcionário (anualizada)', 'm.employeesYoY': 'Funcionários a/a',
  'm.salesMktB': 'Vendas & mkt', 'm.salesMktPct': 'Vendas & mkt % receita', 'm.salesMktYoY': 'Vendas & mkt a/a', 'm.gaPct': 'G&A % receita',
  'm.rdB': 'P&D', 'm.rdPct': 'P&D % receita', 'm.sbcPct': 'Remuneração em ações % receita', 'm.opexPct': 'Despesas operacionais % receita',
  'm.capexPct': 'Capex % receita', 'm.fcfB': 'Fluxo de caixa livre', 'm.fcfMargin': 'FCF % receita', 'm.fcfYoY': 'FCF a/a',
  'm.cashB': 'Caixa e aplicações', 'm.debtB': 'Dívida', 'm.netCashB': 'Caixa líquido', 'm.nextEarnings': 'Próximo resultado', 'm.highlight': 'O que se destacou',
  'm.reactPct': 'Reação do preço (2 dias)', 'm.mcapUsdB': 'Valor de mercado (USD)', 'm.pe': 'P/L (12m)', 'm.fwdPe': 'P/L projetado', 'm.ps': 'Preço/receita (12m)',
  'm.evRev': 'VE/receita (12m)', 'm.evEbitda': 'VE/EBITDA (12m)', 'm.spark': 'Receita (trimestres)',
  'tip.salesMktB': 'Despesa de vendas e marketing do trimestre. Com asterisco: a empresa só reporta SG&A.',
  'tip.fcfB': 'Caixa gerado pelas operações menos os investimentos em equipamentos e infraestrutura (capex). É o que sobra para dividendos, recompras, dívida ou novos negócios.',
  'tip.employees': 'Número de funcionários. FMP: último 10-K (data no tooltip da célula). Yahoo: perfil atual, sem data.',
  'tip.revPerEmployeeK': 'Receita do trimestre × 4 ÷ funcionários. A data do número de funcionários difere da do trimestre.',
  'tip.employeesYoY': 'Só onde há histórico de 10-K (FMP).',
  'tip.reactPct': 'Fechamento do dia anterior à divulgação até o fechamento do dia seguinte.',
  'tip.pe': 'Valor de mercado ÷ lucro líquido dos últimos 12 meses.',
  'ex.title': 'Como este número é calculado', 'ex.formula': 'Conta', 'ex.inputs': 'Valores usados', 'ex.source': 'Fonte', 'ex.period': 'Período', 'ex.close': 'Fechar',
  'ex.hint': 'Clique para ver como é calculado',
  'ex.src.eps': 'EPS: {s}', 'ex.src.fin': 'Demonstrativos financeiros: {s}', 'ex.src.val': 'Valor de mercado e preços: Yahoo Finance; receita, lucro e EBITDA dos demonstrativos ({s})',
  'ex.src.px': 'Preços: Yahoo Finance', 'ex.src.emp': 'Funcionários: {s}',
  'i.epsActual': 'EPS real', 'i.epsEstimate': 'EPS esperado', 'i.revenue': 'Receita', 'i.revenuePrev': 'Receita do mesmo trimestre do ano anterior',
  'i.netIncome': 'Lucro líquido', 'i.netIncomePrev': 'Lucro líquido do ano anterior', 'i.grossProfit': 'Lucro bruto', 'i.operatingIncome': 'Lucro operacional',
  'i.ebitda': 'EBITDA', 'i.tax': 'Imposto de renda', 'i.pretax': 'Lucro antes do imposto', 'i.salesMkt': 'Vendas e marketing', 'i.salesMktPrev': 'Vendas e marketing do ano anterior',
  'i.ga': 'G&A', 'i.rd': 'P&D', 'i.sbc': 'Remuneração em ações', 'i.opex': 'Despesas operacionais', 'i.capex': 'Capex', 'i.ocf': 'Caixa das operações',
  'i.fcf': 'Fluxo de caixa livre', 'i.fcfPrev': 'FCF do ano anterior', 'i.cash': 'Caixa e aplicações', 'i.debt': 'Dívida', 'i.employees': 'Funcionários',
  'i.employeesPrev': 'Funcionários um ano antes', 'i.close0': 'Fechamento em {d}', 'i.close1': 'Fechamento em {d}', 'i.mcap': 'Valor de mercado (USD)', 'i.ev': 'Valor da empresa (USD)',
  'i.ttmRev': 'Receita 12m (USD)', 'i.ttmNi': 'Lucro líquido 12m (USD)', 'i.ttmEbitda': 'EBITDA 12m (USD)', 'i.price': 'Preço da ação', 'i.basis': 'Base da despesa',
  'x.epsActual': 'Lucro por ação divulgado pela empresa no trimestre.', 'x.epsEstimate': 'Estimativa média dos analistas antes da divulgação.',
  'x.epsSurprisePct': '(EPS real − EPS esperado) ÷ |EPS esperado|',
  'x.revenueB': 'Receita do trimestre, conforme o demonstrativo de resultados.', 'x.netIncomeB': 'Lucro líquido do trimestre, conforme o demonstrativo de resultados.',
  'x.revenueYoY': '(Receita − receita do mesmo trimestre do ano anterior) ÷ receita do ano anterior',
  'x.netIncomeYoY': '(Lucro líquido − lucro líquido do ano anterior) ÷ |lucro líquido do ano anterior|',
  'x.grossMargin': 'Lucro bruto ÷ receita', 'x.operatingMargin': 'Lucro operacional ÷ receita', 'x.ebitdaMargin': 'EBITDA ÷ receita', 'x.netMargin': 'Lucro líquido ÷ receita',
  'x.taxRate': 'Imposto de renda ÷ lucro antes do imposto (só quando o lucro antes do imposto é positivo)',
  'x.salesMktB': 'Despesa de vendas e marketing do trimestre. Se a empresa só reporta SG&A, usa-se o SG&A (inclui despesas administrativas).',
  'x.salesMktPct': 'Vendas e marketing ÷ receita', 'x.salesMktYoY': '(Vendas e marketing − valor do ano anterior) ÷ valor do ano anterior',
  'x.gaPct': 'G&A ÷ receita', 'x.rdB': 'Despesa de pesquisa e desenvolvimento do trimestre.', 'x.rdPct': 'P&D ÷ receita',
  'x.sbcPct': 'Remuneração em ações (do fluxo de caixa) ÷ receita', 'x.opexPct': 'Despesas operacionais ÷ receita', 'x.capexPct': 'Capex ÷ receita',
  'x.fcfB': 'Caixa das operações − capex', 'x.fcfMargin': 'Fluxo de caixa livre ÷ receita', 'x.fcfYoY': '(FCF − FCF do ano anterior) ÷ FCF do ano anterior (omitido se a variação passa de 300%)',
  'x.cashB': 'Caixa, equivalentes e aplicações de curto prazo no fim do trimestre.', 'x.debtB': 'Dívida de curto prazo + longo prazo no fim do trimestre.',
  'x.netCashB': 'Caixa e aplicações − dívida (referência: as fontes definem dívida de modo diferente).',
  'x.employees': 'Número de funcionários informado pela empresa.', 'x.revPerEmployeeK': 'Receita do trimestre × 4 ÷ funcionários',
  'x.employeesYoY': '(Funcionários − funcionários um ano antes) ÷ funcionários um ano antes',
  'x.reactPct': '(Fechamento do dia seguinte à divulgação − fechamento do dia anterior) ÷ fechamento do dia anterior',
  'x.mcapUsdB': 'Preço da ação × ações em circulação, convertido para USD.',
  'x.pe': 'Valor de mercado ÷ lucro líquido dos últimos 12 meses (USD)', 'x.fwdPe': 'Preço ÷ lucro por ação estimado para os próximos 12 meses (estimativa do Yahoo; só EUA).',
  'x.ps': 'Valor de mercado ÷ receita dos últimos 12 meses (USD)', 'x.evRev': 'Valor da empresa ÷ receita dos últimos 12 meses', 'x.evEbitda': 'Valor da empresa ÷ EBITDA dos últimos 12 meses',
  'xc.epsSurprisePct': 'EPS real e estimado podem estar em bases diferentes (GAAP e ajustado); surpresas muito grandes pedem conferência no relatório.',
  'xc.salesMktB': 'Nem toda empresa separa vendas e marketing.', 'xc.debtB': 'Pode incluir arrendamentos financeiros; difere entre FMP e Yahoo.',
  'xc.reactPct': 'A janela de 2 dias mistura empresas que divulgam antes e depois do pregão.', 'xc.ev': 'Valor da empresa = valor de mercado + dívida − caixa.',
  'xc.ttm': 'Os 12 meses vêm de {s}.', 'xc.employees': 'A data do número difere da do trimestre.',
  'xc.pe': 'Não calculado quando o lucro de 12 meses é negativo.',
}, {
  'm.name': 'Company', 'm.market': 'Market', 'm.periodEnd': 'Quarter ended', 'm.epsActual': 'Actual EPS', 'm.epsEstimate': 'Expected EPS',
  'm.epsSurprisePct': 'Actual vs expected EPS', 'm.revenueB': 'Revenue', 'm.revenueYoY': 'Revenue YoY', 'm.netIncomeB': 'Net income', 'm.netIncomeYoY': 'Net income YoY',
  'm.grossMargin': 'Gross margin', 'm.operatingMargin': 'Operating margin', 'm.ebitdaMargin': 'EBITDA margin', 'm.netMargin': 'Net margin', 'm.taxRate': 'Effective tax rate',
  'm.employees': 'Employees', 'm.revPerEmployeeK': 'Revenue per employee (annualized)', 'm.employeesYoY': 'Employees YoY',
  'm.salesMktB': 'Sales & marketing', 'm.salesMktPct': 'Sales & marketing % of revenue', 'm.salesMktYoY': 'Sales & marketing YoY', 'm.gaPct': 'G&A % of revenue',
  'm.rdB': 'R&D', 'm.rdPct': 'R&D % of revenue', 'm.sbcPct': 'Stock comp % of revenue', 'm.opexPct': 'Operating expenses % of revenue',
  'm.capexPct': 'Capex % of revenue', 'm.fcfB': 'Free cash flow', 'm.fcfMargin': 'FCF % of revenue', 'm.fcfYoY': 'FCF YoY',
  'm.cashB': 'Cash and investments', 'm.debtB': 'Debt', 'm.netCashB': 'Net cash', 'm.nextEarnings': 'Next earnings', 'm.highlight': 'What stood out',
  'm.reactPct': 'Price reaction (2 days)', 'm.mcapUsdB': 'Market cap (USD)', 'm.pe': 'P/E (TTM)', 'm.fwdPe': 'Forward P/E', 'm.ps': 'Price/sales (TTM)',
  'm.evRev': 'EV/revenue (TTM)', 'm.evEbitda': 'EV/EBITDA (TTM)', 'm.spark': 'Revenue (quarters)',
  'tip.salesMktB': 'Sales and marketing expense for the quarter. With an asterisk: the company only reports SG&A.',
  'tip.fcfB': 'Cash generated by operations minus investment in equipment and infrastructure (capex). What is left for dividends, buybacks, debt or new businesses.',
  'tip.employees': 'Headcount. FMP: latest 10-K (date in the cell tooltip). Yahoo: current profile, undated.',
  'tip.revPerEmployeeK': 'Quarter revenue × 4 ÷ employees. The headcount date differs from the quarter date.',
  'tip.employeesYoY': 'Only where 10-K history exists (FMP).',
  'tip.reactPct': 'Close before the report date to close after it.',
  'tip.pe': 'Market cap ÷ trailing-12-month net income.',
  'ex.title': 'How this number is calculated', 'ex.formula': 'Formula', 'ex.inputs': 'Values used', 'ex.source': 'Source', 'ex.period': 'Period', 'ex.close': 'Close',
  'ex.hint': 'Click to see how it is calculated',
  'ex.src.eps': 'EPS: {s}', 'ex.src.fin': 'Financial statements: {s}', 'ex.src.val': 'Market cap and prices: Yahoo Finance; revenue, earnings and EBITDA from the statements ({s})',
  'ex.src.px': 'Prices: Yahoo Finance', 'ex.src.emp': 'Headcount: {s}',
  'i.epsActual': 'Actual EPS', 'i.epsEstimate': 'Expected EPS', 'i.revenue': 'Revenue', 'i.revenuePrev': 'Revenue in the same quarter a year earlier',
  'i.netIncome': 'Net income', 'i.netIncomePrev': 'Net income a year earlier', 'i.grossProfit': 'Gross profit', 'i.operatingIncome': 'Operating income',
  'i.ebitda': 'EBITDA', 'i.tax': 'Income tax', 'i.pretax': 'Pre-tax income', 'i.salesMkt': 'Sales and marketing', 'i.salesMktPrev': 'Sales and marketing a year earlier',
  'i.ga': 'G&A', 'i.rd': 'R&D', 'i.sbc': 'Stock-based compensation', 'i.opex': 'Operating expenses', 'i.capex': 'Capex', 'i.ocf': 'Operating cash flow',
  'i.fcf': 'Free cash flow', 'i.fcfPrev': 'FCF a year earlier', 'i.cash': 'Cash and investments', 'i.debt': 'Debt', 'i.employees': 'Employees',
  'i.employeesPrev': 'Employees a year earlier', 'i.close0': 'Close on {d}', 'i.close1': 'Close on {d}', 'i.mcap': 'Market cap (USD)', 'i.ev': 'Enterprise value (USD)',
  'i.ttmRev': 'TTM revenue (USD)', 'i.ttmNi': 'TTM net income (USD)', 'i.ttmEbitda': 'TTM EBITDA (USD)', 'i.price': 'Share price', 'i.basis': 'Expense basis',
  'x.epsActual': 'Earnings per share reported by the company for the quarter.', 'x.epsEstimate': 'Average analyst estimate before the report.',
  'x.epsSurprisePct': '(Actual EPS − expected EPS) ÷ |expected EPS|',
  'x.revenueB': 'Quarter revenue, from the income statement.', 'x.netIncomeB': 'Quarter net income, from the income statement.',
  'x.revenueYoY': '(Revenue − revenue in the same quarter a year earlier) ÷ revenue a year earlier',
  'x.netIncomeYoY': '(Net income − net income a year earlier) ÷ |net income a year earlier|',
  'x.grossMargin': 'Gross profit ÷ revenue', 'x.operatingMargin': 'Operating income ÷ revenue', 'x.ebitdaMargin': 'EBITDA ÷ revenue', 'x.netMargin': 'Net income ÷ revenue',
  'x.taxRate': 'Income tax ÷ pre-tax income (only when pre-tax income is positive)',
  'x.salesMktB': 'Sales and marketing expense for the quarter. If the company only reports SG&A, SG&A is used (it includes administrative expenses).',
  'x.salesMktPct': 'Sales and marketing ÷ revenue', 'x.salesMktYoY': '(Sales and marketing − value a year earlier) ÷ value a year earlier',
  'x.gaPct': 'G&A ÷ revenue', 'x.rdB': 'Research and development expense for the quarter.', 'x.rdPct': 'R&D ÷ revenue',
  'x.sbcPct': 'Stock-based compensation (from the cash flow statement) ÷ revenue', 'x.opexPct': 'Operating expenses ÷ revenue', 'x.capexPct': 'Capex ÷ revenue',
  'x.fcfB': 'Operating cash flow − capex', 'x.fcfMargin': 'Free cash flow ÷ revenue', 'x.fcfYoY': '(FCF − FCF a year earlier) ÷ FCF a year earlier (omitted if the change exceeds 300%)',
  'x.cashB': 'Cash, equivalents and short-term investments at quarter end.', 'x.debtB': 'Short-term + long-term debt at quarter end.',
  'x.netCashB': 'Cash and investments − debt (for reference: sources define debt differently).',
  'x.employees': 'Headcount reported by the company.', 'x.revPerEmployeeK': 'Quarter revenue × 4 ÷ employees',
  'x.employeesYoY': '(Employees − employees a year earlier) ÷ employees a year earlier',
  'x.reactPct': '(Close the day after the report − close the day before) ÷ close the day before',
  'x.mcapUsdB': 'Share price × shares outstanding, converted to USD.',
  'x.pe': 'Market cap ÷ trailing-12-month net income (USD)', 'x.fwdPe': 'Price ÷ earnings per share estimated for the next 12 months (Yahoo estimate; US only).',
  'x.ps': 'Market cap ÷ trailing-12-month revenue (USD)', 'x.evRev': 'Enterprise value ÷ trailing-12-month revenue', 'x.evEbitda': 'Enterprise value ÷ trailing-12-month EBITDA',
  'xc.epsSurprisePct': 'Actual and expected EPS may be on different bases (GAAP vs adjusted); very large surprises should be checked in the report.',
  'xc.salesMktB': 'Not every company separates sales and marketing.', 'xc.debtB': 'May include finance leases; differs between FMP and Yahoo.',
  'xc.reactPct': 'The 2-day window mixes companies that report before and after the market.', 'xc.ev': 'Enterprise value = market cap + debt − cash.',
  'xc.ttm': 'The trailing 12 months come from {s}.', 'xc.employees': 'The headcount date differs from the quarter date.',
  'xc.pe': 'Not calculated when trailing-12-month earnings are negative.',
});

// type: pctS (com sinal), pct, money, usd, k, mult, eps, int
const MET = {
  epsActual: { type: 'eps' }, epsEstimate: { type: 'eps' },
  epsSurprisePct: { type: 'pctS', dir: 1, src: 'eps', inp: (r) => [['epsActual', r.epsActual, 'eps'], ['epsEstimate', r.epsEstimate, 'eps']] },
  revenueB: { type: 'money', src: 'fin' }, netIncomeB: { type: 'money', src: 'fin' },
  revenueYoY: { type: 'pctS', dir: 1, inp: (r) => [['revenue', r.revenueB, 'money'], ['revenuePrev', r.revenuePrevB, 'money']] },
  netIncomeYoY: { type: 'pctS', dir: 1, inp: (r) => [['netIncome', r.netIncomeB, 'money'], ['netIncomePrev', r.netIncomePrevB, 'money']] },
  grossMargin: { type: 'pct', dir: 1, inp: (r) => [['grossProfit', r.grossProfitB, 'money'], ['revenue', r.revenueB, 'money']] },
  operatingMargin: { type: 'pct', dir: 1, inp: (r) => [['operatingIncome', r.operatingIncomeB, 'money'], ['revenue', r.revenueB, 'money']] },
  ebitdaMargin: { type: 'pct', dir: 1, inp: (r) => [['ebitda', r.ebitdaB, 'money'], ['revenue', r.revenueB, 'money']] },
  netMargin: { type: 'pct', dir: 1, inp: (r) => [['netIncome', r.netIncomeB, 'money'], ['revenue', r.revenueB, 'money']] },
  taxRate: { type: 'pct', inp: (r) => [['tax', r.taxB, 'money'], ['pretax', r.pretaxB, 'money']] },
  salesMktB: { type: 'money', inp: (r) => [['salesMktPrev', r.salesMktPrevB, 'money'], ['basis', r.salesMktBasis, 'text']] },
  salesMktPct: { type: 'pct', inp: (r) => [['salesMkt', r.salesMktB, 'money'], ['revenue', r.revenueB, 'money']] },
  salesMktYoY: { type: 'pctS', inp: (r) => [['salesMkt', r.salesMktB, 'money'], ['salesMktPrev', r.salesMktPrevB, 'money']] },
  gaPct: { type: 'pct', inp: (r) => [['ga', r.gaB, 'money'], ['revenue', r.revenueB, 'money']] },
  rdB: { type: 'money' }, rdPct: { type: 'pct', inp: (r) => [['rd', r.rdB, 'money'], ['revenue', r.revenueB, 'money']] },
  sbcPct: { type: 'pct', inp: (r) => [['sbc', r.sbcB, 'money'], ['revenue', r.revenueB, 'money']] },
  opexPct: { type: 'pct', inp: (r) => [['opex', r.opexB, 'money'], ['revenue', r.revenueB, 'money']] },
  capexPct: { type: 'pct', inp: (r) => [['capex', r.capexB, 'money'], ['revenue', r.revenueB, 'money']] },
  fcfB: { type: 'signed', inp: (r) => [['ocf', r.ocfB, 'money'], ['capex', r.capexB, 'money']] },
  fcfMargin: { type: 'pct', dir: 1, inp: (r) => [['fcf', r.fcfB, 'money'], ['revenue', r.revenueB, 'money']] },
  fcfYoY: { type: 'pctS', inp: (r) => [['fcf', r.fcfB, 'money'], ['fcfPrev', r.fcfPrevB, 'money']] },
  cashB: { type: 'money' }, debtB: { type: 'money', caveat: 'xc.debtB' },
  netCashB: { type: 'signed', inp: (r) => [['cash', r.cashB, 'money'], ['debt', r.debtB, 'money']] },
  employees: { type: 'int', src: 'emp', period: 'emp', caveat: 'xc.employees' },
  revPerEmployeeK: { type: 'k', dir: 1, src: 'emp', inp: (r) => [['revenue', r.revenueB, 'money'], ['employees', r.employees, 'int']], caveat: 'xc.employees' },
  employeesYoY: { type: 'pctS', src: 'emp', period: 'emp', inp: (r) => [['employees', r.employees, 'int'], ['employeesPrev', r.employeesPrev, 'int']] },
  reactPct: { type: 'pctS', dir: 1, src: 'px', period: 'react', inp: (r) => [['close0', r.reactFromC, 'px', r.reactFrom], ['close1', r.reactToC, 'px', r.reactTo]], caveat: 'xc.reactPct' },
  mcapUsdB: { type: 'usd', src: 'px', inp: (r) => [['price', r.price, 'px', r.priceCurrency]] },
  pe: { type: 'mult', src: 'val', inp: (r) => [['mcap', r.mcapUsdB, 'usd'], ['ttmNi', usdOf(r.ttmNiB, r), 'usd']], caveat: 'xc.pe' },
  fwdPe: { type: 'mult', src: 'px' },
  ps: { type: 'mult', src: 'val', inp: (r) => [['mcap', r.mcapUsdB, 'usd'], ['ttmRev', usdOf(r.ttmRevB, r), 'usd']] },
  evRev: { type: 'mult', src: 'val', inp: (r) => [['ev', r.evUsdB, 'usd'], ['ttmRev', usdOf(r.ttmRevB, r), 'usd']], caveat: 'xc.ev' },
  evEbitda: { type: 'mult', src: 'val', inp: (r) => [['ev', r.evUsdB, 'usd'], ['ttmEbitda', usdOf(r.ttmEbitdaB, r), 'usd']], caveat: 'xc.ev' },
};

// ---- câmbio
const META = () => { const g = dash.data('meta'); return g.status === 'ok' ? g.data : { fx: { USD: 1 } }; };
const usdOf = (v, r) => { if (v == null) return null; const f = r.currency === 'USD' ? 1 : (META().fx || {})[r.currency]; return f == null ? null : v * f; };
const MONEY_B = ['revenueB', 'revenuePrevB', 'revenueEstimateB', 'netIncomeB', 'netIncomePrevB', 'grossProfitB', 'operatingIncomeB', 'salesMktB', 'salesMktPrevB', 'rdB', 'ocfB', 'capexB', 'fcfB', 'fcfPrevB', 'sbcB', 'cashB', 'debtB', 'netCashB', 'ebitdaB', 'taxB', 'pretaxB', 'opexB', 'gaB', 'nextRevB', 'ttmRevB', 'ttmNiB', 'ttmEbitdaB', 'revPerEmployeeK'];
const PER_SHARE = ['epsActual', 'epsEstimate', 'nextEps'];
const segMap = (it, f) => ({ ...it, v: it.v == null ? null : it.v * f, p: it.p == null ? null : it.p * f, c: it.c ? it.c.map((x) => segMap(x, f)) : undefined });
function convertRow(r, rates) {
  if (r.currency === 'USD') return r;
  const f = rates[r.currency];
  if (f == null) return r;
  const o = { ...r, currency: 'USD', origCurrency: r.currency };
  const sc = (k) => { if (o[k] != null) o[k] = +(o[k] * f).toFixed(4); };
  MONEY_B.forEach(sc); PER_SHARE.forEach(sc);
  o.hist = (r.hist || []).map((h) => ({ ...h, rev: h.rev == null ? null : h.rev * f, ni: h.ni == null ? null : h.ni * f, gp: h.gp == null ? null : h.gp * f, oi: h.oi == null ? null : h.oi * f, eps: h.eps == null ? null : h.eps * f }));
  o.epsHist = (r.epsHist || []).map((h) => ({ ...h, a: h.a == null ? null : h.a * f, e: h.e == null ? null : h.e * f }));
  if (r.seg) o.seg = { ...r.seg, g: r.seg.g.map((g) => ({ ...g, i: g.i.map((x) => segMap(x, f)) })) };
  return o;
}

// ---- formatação de uma métrica
const moneyStr = (v, r, d) => (v == null ? '—' : (d === 2 ? f2 : f1).format(v) + ' ' + t('u.bn') + ' ' + r.currency);
function fmtMetric(key, r, d) {
  const m = MET[key], v = r[key];
  if (v == null) return '—';
  switch (m ? m.type : 'num') {
    case 'pctS': return pct(v);
    case 'pct': return pctPlain(v);
    case 'money': return moneyStr(v, r, d);
    case 'signed': return (v > 0 ? '+' : v < 0 ? '−' : '') + moneyStr(Math.abs(v), r, d);
    case 'usd': return (v >= 100 ? f0 : f1).format(v) + ' ' + t('u.bn') + ' USD';
    case 'k': return f0.format(v) + ' ' + t('u.k') + ' ' + r.currency;
    case 'mult': return mult(v);
    case 'eps': return f2.format(v);
    case 'int': return f0.format(v);
    default: return String(v);
  }
}
const metricLabel = (key) => t('m.' + key);

// ---- popover "como é calculado"
let popEl = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; document.removeEventListener('keydown', popKey, true); } }
function popKey(e) { if (e.key === 'Escape') closePop(); }
function srcText(m, r) {
  const p = r.prov || {};
  switch (m.src) {
    case 'eps': return t('ex.src.eps', { s: p.eps || '—' });
    case 'px': return t('ex.src.px');
    case 'val': return t('ex.src.val', { s: p.fin || '—' });
    case 'emp': return t('ex.src.emp', { s: r.employeesSource || '—' });
    default: return t('ex.src.fin', { s: p.fin || '—' });
  }
}
function showExplain(anchor, key, r) {
  closePop();
  const m = MET[key]; if (!m) return;
  const box = mk('div', 'lx-pop'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', t('ex.title'));
  const head = mk('div', 'pop-head');
  head.append(mk('b', null, metricLabel(key)), mk('span', 'pop-co', r.name + ' · ' + (r.origCurrency || r.currency)));
  const x = mk('button', 'pop-x', '×'); x.type = 'button'; x.setAttribute('aria-label', t('ex.close')); x.addEventListener('click', closePop);
  head.appendChild(x);
  box.appendChild(head);
  box.appendChild(mk('div', 'pop-val', fmtMetric(key, r, 2)));
  const sect = (title, node) => { const s = mk('div', 'pop-s'); s.appendChild(mk('div', 'pop-k', title)); s.appendChild(node); box.appendChild(s); };
  sect(t('ex.formula'), mk('p', 'pop-p', t('x.' + key)));
  if (m.inp) {
    const rows = m.inp(r).filter((a) => a[1] != null);
    if (rows.length) {
      const dl = mk('dl', 'pop-dl');
      rows.forEach(([lab, v, ty, extra]) => {
        const label = lab === 'close0' || lab === 'close1' ? t('i.' + lab, { d: date(extra) }) : t('i.' + lab, { d: '' });
        let val;
        if (ty === 'money') val = moneyStr(v, r, 2);
        else if (ty === 'usd') val = f2.format(v) + ' ' + t('u.bn') + ' USD';
        else if (ty === 'eps') val = f2.format(v);
        else if (ty === 'int') val = f0.format(v);
        else if (ty === 'px') val = f2.format(v) + (extra && lab === 'price' ? ' ' + extra : '');
        else val = String(v);
        dl.append(mk('dt', null, label), mk('dd', null, val));
      });
      sect(t('ex.inputs'), dl);
    }
  }
  const per = m.period === 'emp' ? (r.employeesAsOf ? date(r.employeesAsOf) : '—') : m.period === 'react' ? (r.reactFrom ? date(r.reactFrom) + ' → ' + date(r.reactTo) : '—') : date(r.periodEnd);
  sect(t('ex.source'), mk('p', 'pop-p', srcText(m, r) + ' · ' + t('ex.period') + ': ' + per));
  const notes = [];
  if (m.caveat) notes.push(t(m.caveat));
  if (['pe', 'ps', 'evRev', 'evEbitda'].includes(key) && r.ttmSrc) notes.push(t('xc.ttm', { s: r.ttmSrc }));
  if (key === 'epsSurprisePct') notes.push(t('xc.epsSurprisePct'));
  if (key === 'salesMktB' && r.salesMktBasis === 'SG&A') notes.push(t('xc.salesMktB'));
  if (notes.length) box.appendChild(mk('p', 'pop-note', notes.join(' ')));
  document.body.appendChild(box);
  popEl = box;
  const ar = anchor.getBoundingClientRect();
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const left = Math.max(8, Math.min(ar.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - bw - 8));
  let top = ar.bottom + window.scrollY + 6;
  if (ar.bottom + bh + 12 > window.innerHeight && ar.top - bh - 12 > 0) top = ar.top + window.scrollY - bh - 6;
  box.style.left = left + 'px'; box.style.top = top + 'px';
  document.addEventListener('keydown', popKey, true);
  x.focus();
}
document.addEventListener('mousedown', (e) => { if (popEl && !popEl.contains(e.target) && !e.target.closest('[data-m]')) closePop(); });
