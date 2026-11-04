'use strict';
/*
 * Extrai a receita por segmento/produto de um 10-Q ou 10-K em iXBRL (HTML com marcações ix:).
 * O companyfacts do SEC só traz fatos sem dimensões, então segmentos precisam vir do documento do arquivamento.
 *
 * parseFiling(html) -> { contexts, facts }   (puro, sem rede)
 * segmentRevenue(html, { reportDate, form }) -> linhas { axis, member, revenue, prev, total, totalPrev } do período do arquivamento
 */
const REVENUE = new Set([
  'us-gaap:Revenues', 'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
  'us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax', 'us-gaap:SalesRevenueNet',
]);
// eixos que descrevem linhas de negócio; geografia fica de fora de propósito (outro tipo de corte)
const AXES = { 'us-gaap:StatementBusinessSegmentsAxis': 'segment', 'srt:ProductOrServiceAxis': 'product', 'us-gaap:ProductOrServiceAxis': 'product' };

const attr = (s, n) => { const m = s.match(new RegExp(`\\b${n}="([^"]*)"`)); return m ? m[1] : null; };
const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const span = (a, b) => Math.round((day(b) - day(a)) / 864e5);
const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&#160;|&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

function parseFiling(html) {
  const contexts = new Map();
  for (const m of html.matchAll(/<xbrli:context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/g)) {
    const body = m[2];
    const start = (body.match(/<xbrli:startDate>([^<]+)</) || [])[1], end = (body.match(/<xbrli:endDate>([^<]+)</) || [])[1];
    if (!start || !end) continue;   // só durações
    const dims = [...body.matchAll(/<xbrldi:explicitMember\b[^>]*dimension="([^"]+)"[^>]*>([^<]+)</g)].map((d) => [d[1].trim(), d[2].trim()]);
    contexts.set(m[1], { start: start.trim(), end: end.trim(), dims, typed: /<xbrldi:typedMember/.test(body) });
  }
  const facts = [];
  // fatos vazios vêm como <ix:nonFraction .../> (sem fechamento): tratar como abertura faria o valor do fato seguinte
  // ser atribuído a este (valores trocados entre segmentos), então os autofechados são ignorados
  for (const m of html.matchAll(/<ix:nonFraction\b([^>]*?)(\/?)>/g)) {
    if (m[2] === '/') continue;
    const close = html.indexOf('</ix:nonFraction>', m.index);
    if (close < 0) continue;
    const name = attr(m[1], 'name');
    if (!REVENUE.has(name)) continue;
    const ctx = contexts.get(attr(m[1], 'contextRef'));
    if (!ctx) continue;
    const txt = decode(html.slice(m.index + m[0].length, close));
    let v = /\d/.test(txt) ? Number(txt.replace(/[^\d.]/g, '')) : 0;   // "—" marcado como zero
    if (!Number.isFinite(v)) continue;
    v *= 10 ** Number(attr(m[1], 'scale') || 0);
    if (attr(m[1], 'sign') === '-') v = -v;
    facts.push({ name, ctx, value: v });
  }
  return { contexts, facts };
}

// 3 meses para 10-Q; ~12 meses para 10-K (o trimestre 4 é calculado depois, pelo chamador)
function segmentRevenue(html, { reportDate, form }) {
  const { facts } = parseFiling(html);
  const annual = form === '10-K';
  const ok = (c, endRef) => (annual ? span(c.start, c.end) >= 350 && span(c.start, c.end) <= 380 : span(c.start, c.end) >= 80 && span(c.start, c.end) <= 100) && Math.abs(span(c.end, endRef)) <= 7;
  const prevRef = new Date(day(reportDate) - 365 * 864e5).toISOString().slice(0, 10);
  const rows = new Map();   // axis|member -> linha
  const put = (axis, member, key, v) => {
    const k = axis + '|' + member;
    const r = rows.get(k) || { axis, member, revenue: null, prev: null };
    // o mesmo fato aparece em vários conceitos de receita: vale o maior valor absoluto marcado para o mesmo contexto
    if (r[key] == null || Math.abs(v) > Math.abs(r[key])) r[key] = v;
    rows.set(k, r);
  };
  for (const f of facts) {
    const c = f.ctx;
    if (c.typed || c.dims.length > 1) continue;
    const key = ok(c, reportDate) ? 'revenue' : ok(c, prevRef) ? 'prev' : null;
    if (!key) continue;
    if (c.dims.length === 0) { put('total', 'total', key, f.value); continue; }
    const [axisName, member] = c.dims[0];
    const axis = AXES[axisName];
    if (axis) put(axis, member, key, f.value);
  }
  const total = rows.get('total|total');
  return { rows: [...rows.values()].filter((r) => r.axis !== 'total' && r.revenue != null), total: total?.revenue ?? null, totalPrev: total?.prev ?? null };
}

// "nvda:DataCenterMember" -> "Data Center"
const labelOf = (member) => member.replace(/^[^:]*:/, '').replace(/([a-z])and(?=[A-Z])/g, '$1 and ').replace(/Member$/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/ Segment$/, '').trim();

module.exports = { parseFiling, segmentRevenue, labelOf, AXES };
