/* Reproduz, no navegador, a parte da API `dash` que a página usa:
   dash.data / dash.calc / dash.draw / dash.onData / dash.colors */
(function () {
  const datasets = {};
  const calcs = {};
  const draws = [];
  const dataHandlers = [];
  let ready = false;

  const lightColors = ['#2f66a8', '#c4661c'];
  const darkColors = ['#7db0ea', '#f0a35f'];
  const dark = window.matchMedia('(prefers-color-scheme: dark)');

  function runDraw(d, el) { try { d.fn(el); } catch (e) { console.error('draw', d.name, e); } }
  function runAll(name) {
    draws.filter((d) => !name || d.name === name).forEach((d) => {
      document.querySelectorAll('[data-draw="' + d.name + '"]').forEach((el) => runDraw(d, el));
    });
  }

  window.dash = {
    get colors() { return dark.matches ? darkColors : lightColors; },
    data(id) {
      if (datasets[id]) return { status: 'ok', data: datasets[id] };
      const c = calcs[id];
      if (!c) return { status: 'missing', data: [] };
      if (!c.result) c.result = c.fn(...c.inputs.map((i) => datasets[i]));
      return { status: 'ok', data: c.result };
    },
    calc(id, spec) { calcs[id] = { fn: spec.fn, inputs: spec.inputs, result: null }; },
    draw(name, fn) {
      if (!fn) { if (ready) runAll(name); return; }
      const d = { name, fn };
      draws.push(d);
      if (ready) document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => runDraw(d, el));
    },
    onData(fn) { dataHandlers.push(fn); if (ready) fn(); }
  };

  let lastWidth = new WeakMap();
  function watchWidths() {
    document.querySelectorAll('.lx-chart[data-draw]:not(.lx-static)').forEach((el) => {
      lastWidth.set(el, el.clientWidth);
      new ResizeObserver(() => {
        if (el.clientWidth !== lastWidth.get(el)) { lastWidth.set(el, el.clientWidth); runAll(el.dataset.draw); }
      }).observe(el);
    });
  }
  dark.addEventListener('change', () => { dataHandlers.forEach((f) => f()); runAll(); });

  const load = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error(f + ': HTTP ' + r.status); return r.json(); });
  const wantEn = (function () {
    try { const q = new URLSearchParams(location.search).get('lang'); if (q) return q === 'en'; const v = localStorage.getItem('lx-lang'); if (v) return v === 'en'; } catch (e) { /* ignore */ }
    return !String(navigator.language || 'pt').toLowerCase().startsWith('pt');
  })();
  const SCRIPTS = ['i18n.js', 'content-en.js', 'metrics.js', 'page.js', 'compare.js', 'explore.js', 'calendar.js', 'news.js', 'strategy.js', 'usage.js', 'ask.js'];
  const loadScripts = (list) => list.reduce((p, src) => p.then(() => new Promise((res, rej) => {
    const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('Falha ao carregar ' + src));
    document.body.appendChild(el);
  })), Promise.resolve());
  Promise.all([load('earnings.json'), load('news.json'), load('usage.json').catch(() => ({ companies: [] })), load('meta.json').catch(() => ({ fx: { USD: 1 } })), wantEn ? load('news-en.json').catch(() => ({})) : Promise.resolve({}), load('promises.json').catch(() => []), load('strategy.json').catch(() => [])])
    .then(([rows, news, usage, meta, newsEn, promises, strategy]) => {
      datasets.earnings = rows;
      datasets.news = news;
      datasets.usage = usage;
      datasets.meta = meta;
      datasets.newsEn = newsEn;
      datasets.promises = promises;
      datasets.strategy = strategy;
      return loadScripts(SCRIPTS);
    })
    .then(() => {
      if (typeof applyStatic === 'function') applyStatic();
      ready = true;
      dataHandlers.forEach((f) => f());
      runAll();
      watchWidths();
    })
    .catch((e) => {
      const p = document.createElement('p');
      p.style.cssText = 'padding:24px;color:var(--color-bad)';
      p.textContent = 'Não foi possível carregar os dados / Could not load the data (' + e.message + ').';
      document.body.prepend(p);
    });
})();
