/*
 * Atlas Concursos — aplicação principal.
 * Sem frameworks e sem build: HTML + CSS + JavaScript puro.
 * Expõe `window.Atlas` para que tools.js e cloud.js adicionem páginas.
 */
(function () {
  'use strict';

  const CFG = window.ATLAS_CONFIG || {};
  const DATA = window.ATLAS_DATA;

  /* =========================================================
     Utilidades
     ========================================================= */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseDate = (k) => { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseDate(k); d.setDate(d.getDate() + n); return dateKey(d); };
  const daysUntil = (k) => Math.round((parseDate(k) - parseDate(dateKey())) / 86400000);
  const fmtDate = (k) => k ? parseDate(k).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const fmtMin = (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60); return h ? h + 'h' + (m % 60 ? ' ' + pad(m % 60) + 'min' : '') : m + 'min'; };

  function hostOf(u) {
    try { const x = new URL(u); return (x.hostname.replace(/^www\d?\./, '') + x.pathname.replace(/\/$/, '')).replace(/\/pt-br$/, ''); }
    catch (e) { return u; }
  }
  // Segurança: só aceitamos endereços http(s). Bloqueia "javascript:", "data:" etc.
  const safeUrl = (u) => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '');
  function normalizeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { return safeUrl(new URL(u).href); } catch (e) { return ''; }
  }
  const googleSite = (u, q = 'concurso edital') => {
    let h = u; try { h = new URL(u).hostname; } catch (e) {}
    return 'https://www.google.com/search?q=' + encodeURIComponent('site:' + h + ' ' + q);
  };
  const google = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);

  /* ---------- Ícones (SVG inline, sem dependências) ---------- */
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    landmark: '<path d="M3 21h18"/><path d="M5 21V10M9.5 21V10M14.5 21V10M19 21V10"/><path d="M2 10 12 3l10 7z"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 11h6M9 15h4"/>',
    newspaper: '<path d="M4 5h13v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v10a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5M8 17h3"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0z"/><path d="m19 7-3 7a3 3 0 0 0 6 0z"/>',
    calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/><path d="M10 21v-3h4v3"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 19.5A2 2 0 0 0 6 21h14"/><path d="M9 7h7"/>',
    graduation: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/>',
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.8-2 3-2s2.4.5 3 2M15 10h3M15 14h3"/>',
    flame: '<path d="M12 21c-4 0-7-2.7-7-6.5 0-3.3 2.5-5.5 4-7.5.4 2 1.5 3 2.5 3.5C11 7 12 4.5 14 3c.5 3 5 5.5 5 11.5 0 3.8-3 6.5-7 6.5z"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="m6 7 1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 20V9"/><path d="m7 14 5-5 5 5"/><path d="M5 4h14"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.75 3.75 0 0 1 17.5 18z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v3"/><path d="M3 13h18M10 13v2h4v-2"/>',
    note: '<path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.5L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3.5L20 15"/><path d="M20 20v-5h-5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    pause: '<path d="M7 4h3v16H7zM14 4h3v16h-3z"/>',
    logout: '<path d="M15 4h4v16h-4"/><path d="m10 17-5-5 5-5M5 12h11"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    sparkle: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    install: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M12 8v7M9 12l3 3 3-3"/>'
  };
  const icon = (name, cls) => '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.link) + '</svg>';
  const hydrateIcons = (root) => $$('[data-icon]', root).forEach((el) => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });

  /* =========================================================
     Armazenamento ("conta" local, com sincronização opcional)
     ========================================================= */
  const KEY = 'atlas:v1';
  const defaults = () => ({
    version: 1,
    updatedAt: 0,
    profile: { nome: '', uf: '' },
    favs: {},          // url -> { u, n, d, folder, note, at, custom }
    folders: ['Geral'],
    recent: [],        // [{ u, n, at }]
    visits: {},        // url -> número de acessos
    exams: [],         // meus concursos
    subjects: [],      // edital verticalizado
    revisions: [],     // revisões espaçadas
    study: {},         // 'AAAA-MM-DD' -> minutos estudados
    notes: '',
    settings: { theme: 'dark', dailyGoal: 120, pomodoro: { focus: 25, short: 5, long: 15 } }
  });

  const listeners = [];
  const Store = {
    state: defaults(),
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (raw && typeof raw === 'object') {
          this.state = sanitize(merge(defaults(), raw));
          localStorage.setItem(KEY, JSON.stringify(this.state));   // grava a versão higienizada
        }
      } catch (e) { /* armazenamento indisponível: segue em memória */ }
      return this.state;
    },
    save(opts) {
      opts = opts || {};
      if (!opts.keepTime) this.state.updatedAt = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) {}
      listeners.forEach((fn) => { try { fn(this.state, opts); } catch (e) { console.error(e); } });
    },
    update(fn, opts) { fn(this.state); this.save(opts); },
    replace(next, opts) { this.state = sanitize(merge(defaults(), next || {})); this.save(opts); },
    on(fn) { listeners.push(fn); }
  };
  // Limpa dados vindos do navegador ou de um backup: remove links inseguros e tipos inválidos.
  function sanitize(st) {
    const favs = {};
    Object.values(st.favs || {}).forEach((f) => {
      const u = f && safeUrl(f.u);
      if (u) favs[u] = { u, n: String(f.n || u).slice(0, 200), d: String(f.d || '').slice(0, 500), folder: String(f.folder || 'Geral').slice(0, 60), note: String(f.note || '').slice(0, 1000), at: +f.at || Date.now(), custom: !!f.custom };
    });
    st.favs = favs;
    st.recent = (Array.isArray(st.recent) ? st.recent : []).filter((r) => r && safeUrl(r.u)).slice(0, 12);
    st.exams = (Array.isArray(st.exams) ? st.exams : []).filter((e) => e && e.id).map((e) => Object.assign(e, { edital: safeUrl(e.edital) }));
    ['subjects', 'revisions', 'folders'].forEach((k) => { if (!Array.isArray(st[k])) st[k] = []; });
    if (typeof st.notes !== 'string') st.notes = '';
    return st;
  }
  function merge(base, extra) {
    for (const k in extra) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        base[k] = merge(base[k], extra[k]);
      } else if (extra[k] !== undefined) {
        base[k] = extra[k];
      }
    }
    return base;
  }

  /* =========================================================
     Catálogo e índice de busca
     ========================================================= */
  const REG = new Map();      // url -> item
  const INDEX = [];           // itens pesquisáveis
  const catById = {};
  const ufBy = {};
  let totalSites = 0;

  function addItem(it) {
    if (!REG.has(it.u)) { REG.set(it.u, it); totalSites++; }
    it.hay = norm([it.n, it.d, (it.t || []).join(' '), it.catNome, it.uf, it.ufNome, hostOf(it.u), (it.s || []).map((s) => s[0]).join(' '), it.kw].join(' '));
    // Palavras-chave fortes: siglas, palavras do nome e tags (pesam mais na ordenação).
    it.keys = new Set(norm([it.n, (it.t || []).join(' '), it.kw, abbr(it.n)].join(' ')).split(/[^a-z0-9]+/).filter(Boolean));
    it.words = it.hay.split(/[^a-z0-9]+/).filter(Boolean);
    it.acr = norm(String(it.n).split(/ — | - |\(/)[0]).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).map((w) => w[0]).join('');
    INDEX.push(it);
  }

  const KW = {
    pm: (e) => 'pm pm' + e.uf + ' policia militar soldado oficial ' + (e.uf === 'RS' ? 'brigada militar bm' : ''),
    pc: (e) => 'pc pc' + e.uf + ' policia civil delegado escrivao investigador agente ' + (e.uf === 'MT' ? 'pjc judiciaria' : ''),
    cbm: (e) => 'cbm cbm' + e.uf + ' bombeiro militar',
    tj: (e) => 'tj tj' + e.uf + ' tribunal justica escrevente oficial de justica analista judiciario',
    mp: (e) => 'mp mp' + e.uf + ' ministerio publico promotor',
    dpe: (e) => 'dpe dpe' + e.uf + ' defensoria publica defensor',
    tre: (e) => 'tre tre' + e.uf + ' eleitoral',
    sefaz: (e) => 'sefaz sefaz' + e.uf + ' fazenda fiscal auditor icms receita estadual',
    tce: (e) => 'tce tce' + e.uf + ' contas auditor controle',
    al: (e) => 'al al' + e.uf + ' assembleia legislativa deputado',
    doe: (e) => 'doe doe' + e.uf + ' diario oficial imprensa editais',
    gov: (e) => 'governo estado secretaria'
  };

  function buildCatalog() {
    DATA.categorias.forEach((c) => {
      catById[c.id] = c;
      c.itens.forEach((it) => { it.cat = c.id; it.catNome = c.nome; addItem(it); });
    });
    DATA.estados.forEach((e) => {
      ufBy[e.uf] = e;
      e.items = {};
      const notas = DATA.notas || {};
      Object.keys(e.links).forEach((k) => {
        const tipo = DATA.tipos[k];
        if (!tipo) return;
        const it = {
          n: tipo.nome + ' — ' + e.uf,
          short: tipo.nome,
          u: e.links[k],
          d: notas[e.uf + '.' + k] || (tipo.nome + ' — ' + e.nome),
          t: [], s: [], cat: 'estado', catNome: e.nome, uf: e.uf, ufNome: e.nome, tipo: k,
          kw: (KW[k] ? KW[k](e) : '') + ' ' + norm(e.nome)
        };
        e.items[k] = it;
        addItem(it);
      });
      e.trtItems = e.trts.map((u) => {
        const n = (u.match(/trt(\d+)/) || [])[1];
        const it = { n: 'TRT da ' + n + 'ª Região — ' + e.uf, short: 'TRT ' + n + 'ª Região', u, d: 'Tribunal Regional do Trabalho (' + e.nome + ')', t: [], s: [], cat: 'estado', catNome: e.nome, uf: e.uf, ufNome: e.nome, tipo: 'trt', kw: 'trt justica do trabalho ' + norm(e.nome) };
        addItem(it);
        return it;
      });
    });
  }

  function search(q, limit) {
    const toks = norm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const res = [];
    for (const it of INDEX) {
      if (!toks.every((t) => it.hay.includes(t))) continue;
      const name = norm(it.n);
      let score = 0;
      toks.forEach((t) => {
        if (t.length > 1 && t === it.acr) score += 6;
        if (it.keys.has(t)) score += 8;
        else if (it.words.some((w) => w.startsWith(t))) score += 4;
        if (name.startsWith(t)) score += 4;
        else if (name.includes(t)) score += 1;
        if (it.uf && t === it.uf.toLowerCase()) score += 5;
      });
      if (it.cat !== 'estado') score += 1;
      score += Math.min(3, (Store.state.visits[it.u] || 0) * 0.3);
      score += it.uf === 'SP' ? 2 : it.uf === 'RJ' ? 1.6 : it.uf === 'MG' ? 1 : 0;   // estados com mais procura primeiro
      res.push({ it, score });
    }
    res.sort((a, b) => b.score - a.score || a.it.n.localeCompare(b.it.n));
    return res.slice(0, limit || 60).map((r) => r.it);
  }

  /* =========================================================
     Componentes
     ========================================================= */
  const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'para', 'em']);
  function abbr(name) {
    const head = String(name).split(/ — | - /)[0];
    const caps = head.match(/\b[A-ZÀ-Ú][A-ZÀ-Ú0-9.]{1,5}\b/);
    if (caps && caps[0].replace(/\./g, '').length <= 5) return caps[0].replace(/\./g, '');
    const words = head.replace(/[()]/g, '').split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
    return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
  }
  function hue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  const mono = (name, key) => '<span class="mono" style="--h:' + hue(key || name) + '" aria-hidden="true">' + esc(abbr(name)) + '</span>';
  const isFav = (u) => !!Store.state.favs[u];
  const extLink = (u, cls, inner, name) => '<a class="' + cls + '" href="' + esc(safeUrl(u) || '#') + '" target="_blank" rel="noopener" data-track="' + esc(u) + '"' + (name ? ' data-name="' + esc(name) + '"' : '') + '>' + inner + '</a>';

  function card(it, opts) {
    opts = opts || {};
    const fav = isFav(it.u);
    const subs = (it.s || []).concat(opts.extra || []);
    const title = opts.short ? (it.short || it.n) : it.n;
    return '<article class="card">' +
      '<div class="card-top">' + mono(title, it.u) +
        '<div class="card-title"><h3>' + esc(title) + '</h3><span class="domain">' + esc(hostOf(it.u)) + '</span></div>' +
        favBtn(it.u, fav) +
      '</div>' +
      (it.d && it.d !== title ? '<p class="desc">' + esc(it.d) + '</p>' : '') +
      cardBadges.map((fn) => { try { return fn(it) || ''; } catch (e) { return ''; } }).join('') +
      (subs.length ? '<div class="subs">' + subs.map((s) => extLink(s[1], 'chip', icon(s[2] || 'external') + esc(s[0]), s[0])).join('') + '</div>' : '') +
      '<div class="card-actions">' +
        extLink(it.u, 'btn btn-primary btn-sm btn-open', 'Acessar site ' + icon('external')) +
        '<a class="icon-btn" href="' + esc(googleSite(it.u)) + '" target="_blank" rel="noopener" title="Procurar editais e concursos dentro deste site" aria-label="Procurar editais neste site">' + icon('search') + '</a>' +
        '<button class="icon-btn" type="button" data-action="copy" data-url="' + esc(it.u) + '" title="Copiar link" aria-label="Copiar link">' + icon('copy') + '</button>' +
        '<button class="icon-btn" type="button" data-action="report" data-url="' + esc(it.u) + '" data-name="' + esc(it.n) + '" title="Link quebrado? Avise a gente" aria-label="Reportar link quebrado">' + icon('flag') + '</button>' +
      '</div>' +
    '</article>';
  }
  const favBtn = (u, on) => '<button class="icon-btn fav' + (on ? ' on' : '') + '" type="button" data-action="fav" data-url="' + esc(u) + '" aria-pressed="' + on + '" title="' + (on ? 'Remover dos meus links' : 'Salvar nos meus links') + '" aria-label="Salvar link">' + icon('star') + '</button>';

  function ghostCard(tipoNome, e) {
    return '<article class="card ghost">' +
      '<div class="card-top">' + mono(tipoNome) + '<div class="card-title"><h3>' + esc(tipoNome) + '</h3><span class="domain">ainda não catalogado</span></div></div>' +
      '<p class="desc">Ainda não temos o endereço confirmado. Busque o site oficial ou nos ajude a completar o catálogo.</p>' +
      '<div class="card-actions">' +
        '<a class="btn btn-sm btn-open" href="' + esc(google(tipoNome + ' ' + e.nome + ' site oficial concurso')) + '" target="_blank" rel="noopener">' + icon('search') + 'Buscar site oficial</a>' +
        '<button class="icon-btn" type="button" data-action="suggest" data-name="' + esc(tipoNome + ' — ' + e.nome) + '" title="Sugerir o link" aria-label="Sugerir link">' + icon('plus') + '</button>' +
      '</div></article>';
  }

  const tile = (href, ic, title, desc, meta) =>
    '<a class="tile" href="' + href + '"><span class="tile-icon">' + icon(ic, 'i-lg') + '</span><h3>' + esc(title) + '</h3>' +
    (desc ? '<p>' + esc(desc) + '</p>' : '') + (meta ? '<span class="meta">' + meta + '</span>' : '') + '</a>';

  const emptyBox = (ic, title, text, action) =>
    '<div class="empty">' + icon(ic) + '<h3>' + esc(title) + '</h3><p>' + text + '</p>' + (action ? '<div style="margin-top:14px">' + action + '</div>' : '') + '</div>';

  const adFeed = () => (CFG.ads && CFG.ads.client && CFG.ads.slots && CFG.ads.slots.feed) ? '<div class="ad-slot ad-feed" data-slot="feed"></div>' : '';

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* =========================================================
     Ações sobre links
     ========================================================= */
  function toggleFav(u) {
    const it = REG.get(u) || Store.state.favs[u];
    if (!it) return;
    let now;
    Store.update((s) => {
      if (s.favs[u]) { delete s.favs[u]; now = false; }
      else { s.favs[u] = { u, n: it.n, d: it.d || '', folder: 'Geral', note: '', at: Date.now() }; now = true; }
    });
    $$('[data-action="fav"][data-url="' + CSS.escape(u) + '"]').forEach((b) => {
      b.classList.toggle('on', now); b.setAttribute('aria-pressed', now);
      b.title = now ? 'Remover dos meus links' : 'Salvar nos meus links';
    });
    toast(now ? '★ Salvo em Meus links' : 'Removido dos Meus links');
    if (current.name === 'meus-links') render();
  }

  function track(u, n) {
    const it = REG.get(u);
    Store.update((s) => {
      s.visits[u] = (s.visits[u] || 0) + 1;
      s.recent = [{ u, n: (it && it.n) || n || hostOf(u), at: Date.now() }].concat(s.recent.filter((r) => r.u !== u)).slice(0, 12);
    });
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Link copiado!'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Link copiado!'); } catch (e2) { toast('Não foi possível copiar'); }
      ta.remove();
    }
  }

  // Reportes vão para as issues do repositório; se ele for privado (repoUrl vazio), vão por e-mail.
  function issueUrl(title, body) {
    const repo = (CFG.repoUrl || '').replace(/\/$/, '');
    if (repo) return repo + '/issues/new?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
    const mail = CFG.contato && CFG.contato.email;
    return mail ? 'mailto:' + mail + '?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body) : null;
  }

  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* =========================================================
     Roteador
     ========================================================= */
  const routes = [];
  const current = { name: '', params: [] };
  function route(pattern, name, handler) { routes.push({ pattern, name, handler }); }

  function render() {
    const hash = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
    let match = null, r = null;
    for (const x of routes) { match = hash.match(x.pattern); if (match) { r = x; break; } }
    if (!r) { r = routes.find((x) => x.name === 'notfound'); match = [hash]; }
    const sameRoute = current.name === r.name && current.hash === hash;
    current.name = r.name; current.params = match.slice(1); current.hash = hash;

    const out = r.handler.apply(null, current.params) || {};
    // Troca o elemento da view a cada render para descartar ouvintes de eventos da página anterior.
    const oldView = $('#view');
    const view = oldView.cloneNode(false);
    oldView.replaceWith(view);
    const scroll = sameRoute ? window.scrollY : 0;
    view.classList.toggle('no-anim', sameRoute);
    view.innerHTML = out.html || '';
    hydrateIcons(view);
    document.title = (out.title ? out.title + ' · ' : '') + 'Atlas Concursos';
    $('#crumbs').innerHTML = (out.crumbs || [['Início', '#/']]).map((c, i, a) =>
      i === a.length - 1 ? '<b>' + esc(c[0]) + '</b>' : '<a href="' + c[1] + '">' + esc(c[0]) + '</a><span class="sep">/</span>').join('');
    renderNav();
    document.body.classList.remove('nav-open');
    if (!sameRoute) { window.scrollTo(0, 0); view.focus({ preventScroll: true }); } else window.scrollTo(0, scroll);
    if (out.after) out.after(view);
    afterRender.forEach((fn) => { try { fn(view, current); } catch (e) { console.error(e); } });
    Ads.fill(view);
  }

  /* ---------- Navegação lateral ---------- */
  const extraNav = [];   // tools.js adiciona itens em "Minha área"
  const projectNav = []; // monetize.js adiciona "Apoie" e "Anuncie"
  const topNav = [];     // features.js adiciona "Radar de Editais" e "Descubra seu concurso"
  const cardBadges = []; // funções (item) => html de selos extras nos cards
  const afterRender = []; // funções chamadas depois de cada página renderizada
  function renderNav() {
    const s = Store.state;
    const favCount = Object.keys(s.favs).length;
    const h = '#' + (current.hash || '/');
    const link = (href, ic, label, count) => {
      const active = href === h || (href !== '#/' && h.startsWith(href + '/')) ? ' active' : '';
      return '<a class="' + active.trim() + '" href="' + href + '">' + icon(ic) + '<span>' + esc(label) + '</span>' + (count != null ? '<span class="count">' + count + '</span>' : '') + '</a>';
    };
    let html = link('#/', 'home', 'Início') + link('#/explorar', 'grid', 'Explorar tudo', totalSites) + link('#/estados', 'map', 'Estados', 27);
    topNav.forEach((n) => { html += link(n.href, n.icon, n.label, n.count ? n.count(s) : null); });
    const me = ufBy[s.profile.uf];
    if (me) html += link('#/uf/' + me.uf, 'flag', 'Meu estado: ' + me.uf);
    html += '<div class="nav-label">Categorias</div>';
    DATA.categorias.forEach((c) => { html += link('#/c/' + c.id, c.icone, c.nome, c.itens.length); });
    html += '<div class="nav-label">Minha área</div>';
    html += link('#/meus-links', 'star', 'Meus links', favCount);
    extraNav.forEach((n) => { html += link(n.href, n.icon, n.label, n.count ? n.count(s) : null); });
    html += link('#/conta', 'user', 'Minha conta');
    const proj = projectNav.filter((n) => !n.show || n.show());
    if (proj.length) {
      html += '<div class="nav-label">Projeto</div>';
      proj.forEach((n) => { html += link(n.href, n.icon, n.label); });
    }
    $('#nav').innerHTML = html;

    $$('.tabbar [data-tab]').forEach((a) => {
      const t = a.dataset.tab;
      a.classList.toggle('active', (t === 'home' && current.name === 'home') || current.name === t || (t === 'ferramentas' && current.name.startsWith('tool')));
    });
    renderAccountChip();
  }

  function renderAccountChip() {
    const s = Store.state;
    const cloudUser = Atlas.cloud && Atlas.cloud.user;
    const nome = (cloudUser && cloudUser.displayName) || s.profile.nome;
    const initials = nome ? nome.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
    const avatar = cloudUser && cloudUser.photoURL
      ? '<span class="avatar"><img src="' + esc(cloudUser.photoURL) + '" alt="" referrerpolicy="no-referrer"></span>'
      : '<span class="avatar">' + (initials ? esc(initials) : icon('user')) + '</span>';
    $('#account-chip').innerHTML = avatar + '<span class="name">' + esc(nome ? nome.split(' ')[0] : 'Minha conta') + '</span>';
  }

  /* =========================================================
     Páginas
     ========================================================= */
  const TIPS = [
    'Todo concurso tem seu edital publicado em Diário Oficial. Salve o diário do seu estado nos Meus links.',
    'Inscritos no CadÚnico podem pedir isenção da taxa de inscrição na maioria dos concursos.',
    'Leia a "lei seca" no site do Planalto: é o texto que as bancas copiam nas questões.',
    'Na Cebraspe, um erro anula um acerto. Às vezes deixar em branco é a melhor estratégia — use a Calculadora de Nota.',
    'Revisar em 24 h, 7 dias e 30 dias fixa muito mais o conteúdo. O Edital Verticalizado agenda isso para você.',
    'Estude por ciclos: 25 a 50 minutos de foco e uma pausa curta. Use o Pomodoro e acompanhe suas horas.',
    'Antes de pagar a inscrição, confira o cronograma e os requisitos do cargo no edital.',
    'Provas antigas da mesma banca são o melhor simulado. Veja a categoria "Estudo Gratuito & Provas".'
  ];

  const POPULAR = [
    'https://www.policiamilitar.sp.gov.br', 'https://www.pmerj.rj.gov.br', 'https://www.in.gov.br', 'https://www.gov.br/gestao/pt-br/concursonacional', 'https://www.cebraspe.org.br',
    'https://conhecimento.fgv.br/concursos', 'https://www.gov.br/pf/pt-br', 'https://www.gov.br/prf/pt-br',
    'https://www.pciconcursos.com.br', 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'
  ];

  route(/^\/?$/, 'home', function () {
    const s = Store.state;
    const nome = s.profile.nome ? s.profile.nome.split(' ')[0] : '';
    const today = dateKey();
    const studied = s.study[today] || 0;
    const goal = s.settings.dailyGoal || 120;
    const next = s.exams.filter((e) => e.data && daysUntil(e.data) >= 0).sort((a, b) => a.data.localeCompare(b.data))[0];
    const due = s.revisions.filter((r) => !r.done && r.due <= today).length;
    const favs = Object.keys(s.favs).length;
    const me = ufBy[s.profile.uf];

    const widgets = '<div class="widgets">' +
      '<div class="panel widget"><span class="w-label">' + icon('calendar') + 'Próxima prova</span>' +
        (next ? '<span class="w-value">' + (daysUntil(next.data) === 0 ? 'É hoje!' : daysUntil(next.data) + ' dias') + '</span><span class="w-sub">' + esc(next.nome) + ' · ' + fmtDate(next.data) + '</span>'
              : '<span class="w-value">—</span><span class="w-sub">Cadastre os concursos que você vai fazer.</span>') +
        '<a class="w-link" href="#/concursos">Meus concursos →</a></div>' +
      '<div class="panel widget"><span class="w-label">' + icon('clock') + 'Estudo hoje</span>' +
        '<span class="w-value">' + fmtMin(studied) + '</span><div class="progress"><i style="width:' + Math.min(100, studied / goal * 100) + '%"></i></div>' +
        '<span class="w-sub">Meta diária: ' + fmtMin(goal) + '</span><a class="w-link" href="#/ferramentas/pomodoro">Iniciar foco →</a></div>' +
      '<div class="panel widget"><span class="w-label">' + icon('refresh') + 'Revisões para hoje</span>' +
        '<span class="w-value">' + due + '</span><span class="w-sub">' + (due ? 'Conteúdos esperando revisão.' : 'Nada pendente. Bom trabalho!') + '</span>' +
        '<a class="w-link" href="#/ferramentas/revisoes">Ver revisões →</a></div>' +
      '<div class="panel widget"><span class="w-label">' + icon('star') + 'Links salvos</span>' +
        '<span class="w-value">' + favs + '</span><span class="w-sub">Toque na ★ de qualquer site para salvar.</span>' +
        '<a class="w-link" href="#/meus-links">Meus links →</a></div>' +
    '</div>';

    const tiles = DATA.categorias.map((c) => tile('#/c/' + c.id, c.icone, c.nome, c.desc, c.itens.length + ' sites')).join('') +
      tile('#/estados', 'map', 'Estados (27 UFs)', 'PM, Polícia Civil, Bombeiros, TJ, MP, Sefaz, Diário Oficial e mais, por estado.', DATA.estados.length + ' hubs');

    let myState = '';
    if (me) {
      const ks = ['doe', 'pm', 'pc', 'tj', 'mp', 'sefaz', 'gov'];
      myState = '<section class="section"><div class="section-head"><h2>' + icon('flag') + 'Meu estado: ' + esc(me.nome) + '</h2><a class="link-more" href="#/uf/' + me.uf + '">Ver tudo ' + icon('chevron') + '</a></div>' +
        '<div class="subs">' + ks.filter((k) => me.items[k]).map((k) => extLink(me.items[k].u, 'chip', icon(DATA.tipos[k].icone) + esc(DATA.tipos[k].nome))).join('') + '</div></section>';
    } else {
      myState = '<section class="section panel panel-pad"><div class="section-head" style="margin-bottom:10px"><h2>' + icon('flag') + 'Qual é o seu estado?</h2></div>' +
        '<p class="muted small" style="margin-bottom:12px">Escolha e tenha atalhos para a PM, Polícia Civil, TJ, Diário Oficial e outros órgãos do seu estado logo aqui.</p>' +
        '<select class="select" id="pick-uf" style="max-width:320px"><option value="">Selecione…</option>' +
        DATA.estados.map((e) => '<option value="' + e.uf + '">' + esc(e.nome) + '</option>').join('') + '</select></section>';
    }

    const recent = s.recent.slice(0, 6);
    const recentHtml = recent.length ? '<section class="section"><div class="section-head"><h2>' + icon('clock') + 'Acessados recentemente</h2></div><div class="list">' +
      recent.map((r) => '<div class="row">' + mono(r.n, r.u) + '<div class="grow"><div class="title">' + esc(r.n) + '</div><div class="sub">' + esc(hostOf(r.u)) + '</div></div>' +
        favBtn(r.u, isFav(r.u)) + extLink(r.u, 'icon-btn', icon('external')) + '</div>').join('') + '</div></section>' : '';

    const popular = POPULAR.map((u) => REG.get(u)).filter(Boolean);

    return {
      title: 'Início',
      crumbs: [['Início', '#/']],
      html:
        '<section class="hero">' +
          '<span class="eyebrow">' + icon('sparkle') + (nome ? 'Olá, ' + esc(nome) + '!' : 'Gratuito para todo concurseiro') + '</span>' +
          '<h1>Todos os sites de <span class="grad-text">concursos públicos</span> do Brasil em um só lugar.</h1>' +
          '<p class="lead">Bancas, diários oficiais, polícias, tribunais e órgãos dos 27 estados — organizados, pesquisáveis e com ferramentas de estudo grátis.</p>' +
          '<div class="hero-search" data-action="palette" role="button" tabindex="0">' + icon('search') + '<span class="ph">Busque: "PM São Paulo", "PM Rio de Janeiro", "TJ SP", "Cebraspe"…</span><kbd>Ctrl K</kbd>' +
            '<span class="btn btn-primary">Buscar</span></div>' +
          '<div class="hero-stats">' +
            '<div class="stat"><b>' + totalSites + '+</b><span>sites oficiais</span></div>' +
            '<div class="stat"><b>27</b><span>estados + DF</span></div>' +
            '<div class="stat"><b>' + catById.bancas.itens.length + '</b><span>bancas</span></div>' +
            '<div class="stat"><b>100%</b><span>gratuito</span></div>' +
          '</div>' +
        '</section>' +
        widgets +
        myState +
        '<section class="section"><div class="section-head"><h2>' + icon('grid') + 'Explore por categoria</h2><a class="link-more" href="#/explorar">Ver todos os sites ' + icon('chevron') + '</a></div><div class="tiles">' + tiles + '</div></section>' +
        recentHtml +
        adFeed() +
        '<section class="section"><div class="section-head"><h2>' + icon('target') + 'Mais acessados pelos concurseiros</h2></div><div class="cards">' + popular.map((it) => card(it)).join('') + '</div></section>' +
        '<section class="section panel panel-pad" id="tip-of-day"><span class="eyebrow">' + icon('info') + 'Dica do dia</span><p style="font-size:16px">' + esc(TIPS[new Date().getDate() % TIPS.length]) + '</p></section>',
      after(view) {
        const sel = $('#pick-uf', view);
        if (sel) sel.addEventListener('change', () => {
          if (!sel.value) return;
          Store.update((s) => { s.profile.uf = sel.value; });
          toast('Estado definido: ' + ufBy[sel.value].nome);
          render();
        });
      }
    };
  });

  /* ---------- Explorar tudo ---------- */
  const ui = { filter: '', cat: '' };
  route(/^\/explorar$/, 'explorar', function () {
    const chips = '<button class="chip' + (!ui.cat ? ' sel' : '') + '" data-cat="">Todas</button>' +
      DATA.categorias.map((c) => '<button class="chip' + (ui.cat === c.id ? ' sel' : '') + '" data-cat="' + c.id + '">' + icon(c.icone) + esc(c.nome) + '</button>').join('');
    return {
      title: 'Explorar',
      crumbs: [['Início', '#/'], ['Explorar tudo', '#/explorar']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('grid') + 'Diretório completo</span><h1>Explorar todos os sites</h1>' +
        '<p>' + totalSites + ' endereços oficiais organizados por categoria. Os órgãos estaduais ficam em <a href="#/estados" class="grad-text">Estados</a>.</p></div></div>' +
        '<div class="toolbar"><div class="filter-input">' + icon('search') + '<input class="input" id="flt" type="search" placeholder="Filtrar nesta página…" value="' + esc(ui.filter) + '"></div></div>' +
        '<div class="subs" id="cat-chips" style="margin-bottom:8px">' + chips + '</div>' +
        '<div id="results"></div>',
      after(view) {
        const box = $('#results', view);
        const draw = () => {
          const q = norm(ui.filter);
          let html = '';
          DATA.categorias.forEach((c) => {
            if (ui.cat && ui.cat !== c.id) return;
            const items = c.itens.filter((it) => !q || q.split(/\s+/).every((t) => it.hay.includes(t)));
            if (!items.length) return;
            html += '<section class="section"><div class="section-head"><h2>' + icon(c.icone) + esc(c.nome) + '</h2><a class="link-more" href="#/c/' + c.id + '">Abrir categoria ' + icon('chevron') + '</a></div><div class="cards">' + items.map((it) => card(it)).join('') + '</div></section>';
          });
          box.innerHTML = html || emptyBox('search', 'Nada encontrado', 'Tente outro termo ou use a busca global (Ctrl K), que também procura nos estados.');
        };
        draw();
        $('#flt', view).addEventListener('input', (e) => { ui.filter = e.target.value; draw(); });
        $('#cat-chips', view).addEventListener('click', (e) => {
          const b = e.target.closest('[data-cat]'); if (!b) return;
          ui.cat = b.dataset.cat;
          $$('[data-cat]', view).forEach((x) => x.classList.toggle('sel', x === b));
          draw();
        });
      }
    };
  });

  /* ---------- Categoria ---------- */
  route(/^\/c\/([\w-]+)$/, 'categoria', function (id) {
    const c = catById[id];
    if (!c) return notFound();
    return {
      title: c.nome,
      crumbs: [['Início', '#/'], ['Explorar', '#/explorar'], [c.nome, '#/c/' + id]],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon(c.icone) + c.itens.length + ' sites</span><h1>' + esc(c.nome) + '</h1><p>' + esc(c.desc) + '</p></div></div>' +
        '<div class="toolbar"><div class="filter-input">' + icon('search') + '<input class="input" id="flt" type="search" placeholder="Filtrar em ' + esc(c.nome) + '…"></div></div>' +
        '<div class="cards" id="results"></div>' + adFeed(),
      after(view) {
        const box = $('#results', view);
        const draw = (q) => {
          q = norm(q);
          const items = c.itens.filter((it) => !q || q.split(/\s+/).every((t) => it.hay.includes(t)));
          box.innerHTML = items.length ? items.map((it) => card(it)).join('') : emptyBox('search', 'Nada encontrado', 'Tente outro termo.');
        };
        draw('');
        $('#flt', view).addEventListener('input', (e) => draw(e.target.value));
      }
    };
  });

  /* ---------- Estados ---------- */
  route(/^\/estados$/, 'estados', function () {
    const regions = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
    const mine = Store.state.profile.uf;
    return {
      title: 'Estados',
      crumbs: [['Início', '#/'], ['Estados', '#/estados']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('map') + '27 hubs estaduais</span><h1>Concursos por estado</h1>' +
        '<p>Cada estado reúne seus "subsites": Polícia Militar, Polícia Civil, Bombeiros, Tribunal de Justiça, MP, Defensoria, TRE, TRT, Sefaz, Tribunal de Contas, Assembleia e o Diário Oficial onde os editais são publicados.</p></div></div>' +
        '<div class="region"><h3>Mais procurados</h3><div class="uf-grid">' + ['SP', 'RJ', 'MG', 'BA', 'PR', 'RS'].map((uf) => ufBy[uf]).map((e) =>
          '<a class="uf' + (e.uf === mine ? ' mine' : '') + '" href="#/uf/' + e.uf + '"><b>' + e.uf + '</b><span>' + esc(e.nome) + '</span><small>' + (Object.keys(e.items).length + e.trtItems.length + 1) + ' órgãos</small></a>').join('') + '</div></div>' +
        regions.map((r) => '<div class="region"><h3>' + r + '</h3><div class="uf-grid">' +
          DATA.estados.filter((e) => e.regiao === r).map((e) =>
            '<a class="uf' + (e.uf === mine ? ' mine' : '') + '" href="#/uf/' + e.uf + '"><b>' + e.uf + '</b><span>' + esc(e.nome) + '</span><small>' + (Object.keys(e.items).length + e.trtItems.length + 1) + ' órgãos</small></a>').join('') +
          '</div></div>').join('')
    };
  });

  const GROUPS = [
    { nome: 'Segurança Pública', icone: 'shield', tipos: ['pm', 'pc', 'cbm'] },
    { nome: 'Justiça', icone: 'scale', tipos: ['tj', 'mp', 'dpe', 'tre'] },
    { nome: 'Fiscal & Controle', icone: 'calculator', tipos: ['sefaz', 'tce'] },
    { nome: 'Governo & Legislativo', icone: 'landmark', tipos: ['gov', 'doe', 'al'] }
  ];

  route(/^\/uf\/([A-Za-z]{2})$/, 'uf', function (uf) {
    const e = ufBy[uf.toUpperCase()];
    if (!e) return notFound();
    const doe = e.items.doe;
    const mine = Store.state.profile.uf === e.uf;
    const extraFor = (it) => {
      const x = [];
      if (doe && it.tipo !== 'doe') x.push(['Editais no Diário Oficial', doe.u, 'newspaper']);
      return x;
    };
    const trf = REG.get('https://www.trf' + e.trf + '.jus.br');
    const sections = GROUPS.map((g) => {
      const cards = g.tipos.map((k) => e.items[k] ? card(e.items[k], { short: true, extra: extraFor(e.items[k]) }) : ghostCard(DATA.tipos[k].nome, e));
      if (g.tipos.includes('tre')) {
        e.trtItems.forEach((it) => cards.push(card(it, { short: true })));
        if (trf) cards.push(card(trf));
      }
      return '<section class="section"><div class="section-head"><h2>' + icon(g.icone) + g.nome + '</h2></div><div class="cards">' + cards.join('') + '</div></section>';
    }).join('');

    const shortcuts = [
      ['Concursos abertos em ' + e.nome, google('concursos abertos ' + e.nome + ' edital ' + new Date().getFullYear())],
      ['Prefeituras de ' + e.nome, google('concurso prefeitura ' + e.nome + ' edital ' + new Date().getFullYear())],
      ['Prefeitura de ' + e.capital, google('concurso prefeitura de ' + e.capital + ' edital')],
      ['Diários municipais (Querido Diário)', 'https://queridodiario.org.br']
    ];

    return {
      title: e.nome,
      crumbs: [['Início', '#/'], ['Estados', '#/estados'], [e.nome, '#/uf/' + e.uf]],
      html:
        '<div class="page-head"><div class="state-hero"><span class="state-badge">' + e.uf + '</span><div><span class="eyebrow">' + esc(e.regiao) + ' · capital ' + esc(e.capital) + '</span><h1>' + esc(e.nome) + '</h1>' +
        '<p>Todos os órgãos que fazem concurso em ' + esc(e.nome) + '. ' + (doe ? 'Os editais estaduais saem no <b>Diário Oficial</b> — ele aparece como atalho em cada órgão.' : '') + '</p></div></div>' +
        '<button class="btn' + (mine ? '' : ' btn-primary') + '" data-action="set-uf" data-uf="' + e.uf + '">' + icon('flag') + (mine ? 'É o meu estado' : 'Definir como meu estado') + '</button></div>' +
        '<div class="panel panel-pad"><span class="eyebrow">' + icon('search') + 'Atalhos de busca</span><div class="subs">' + shortcuts.map((s) => extLink(s[1], 'chip', icon('search') + esc(s[0]))).join('') + '</div></div>' +
        sections + adFeed()
    };
  });

  /* ---------- Meus links ---------- */
  const linksUi = { folder: '', q: '' };
  route(/^\/meus-links$/, 'meus-links', function () {
    const s = Store.state;
    const all = Object.values(s.favs).sort((a, b) => b.at - a.at);
    const folders = Array.from(new Set(['Geral'].concat(s.folders, all.map((f) => f.folder || 'Geral'))));
    if (linksUi.folder && !folders.includes(linksUi.folder)) linksUi.folder = '';

    const row = (f) =>
      '<div class="row" data-u="' + esc(f.u) + '">' + mono(f.n, f.u) +
        '<div class="grow"><div class="title">' + esc(f.n) + (f.custom ? ' <span class="tag">meu</span>' : '') + '</div><div class="sub">' + esc(hostOf(f.u)) + ' · ' + esc(f.folder || 'Geral') + '</div>' +
        (f.note ? '<div class="note">' + esc(f.note) + '</div>' : '') + '</div>' +
        extLink(f.u, 'btn btn-sm btn-primary', 'Abrir') +
        '<button class="icon-btn" data-action="edit-fav" title="Editar pasta e anotação" aria-label="Editar">' + icon('edit') + '</button>' +
        '<button class="icon-btn" data-action="copy" data-url="' + esc(f.u) + '" aria-label="Copiar">' + icon('copy') + '</button>' +
        '<button class="icon-btn" data-action="fav" data-url="' + esc(f.u) + '" aria-label="Remover">' + icon('trash') + '</button>' +
      '</div>';

    return {
      title: 'Meus links',
      crumbs: [['Início', '#/'], ['Meus links', '#/meus-links']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('star') + all.length + ' salvos</span><h1>Meus links</h1>' +
        '<p>Sua coleção pessoal. Salve qualquer site do catálogo com a ★ ou adicione links próprios (ex.: a prefeitura da sua cidade, o edital que você está estudando).</p></div>' +
        '<div class="btn-row"><button class="btn" data-action="export">' + icon('download') + 'Backup</button><a class="btn" href="#/conta">' + icon('cloud') + 'Sincronizar</a></div></div>' +
        '<details class="panel panel-pad"' + (all.length ? '' : ' open') + '><summary style="cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px">' + icon('plus') + 'Adicionar link próprio</summary>' +
          '<form id="add-form" class="form-grid" style="margin-top:14px">' +
            '<label class="field">Nome<input class="input" name="n" required placeholder="Ex.: Prefeitura de Campinas — Concursos"></label>' +
            '<label class="field">Endereço (URL)<input class="input" name="u" required placeholder="https://…" inputmode="url"></label>' +
            '<label class="field">Pasta<input class="input" name="folder" list="folders" placeholder="Geral"></label>' +
            '<label class="field">Anotação<input class="input" name="note" placeholder="Ex.: inscrições até 15/11"></label>' +
            '<datalist id="folders">' + folders.map((f) => '<option value="' + esc(f) + '">').join('') + '</datalist>' +
            '<div style="display:flex;align-items:flex-end"><button class="btn btn-primary" type="submit">' + icon('plus') + 'Salvar link</button></div>' +
          '</form></details>' +
        '<div class="section">' +
          (all.length ? '<div class="toolbar"><div class="filter-input">' + icon('search') + '<input class="input" id="flt" type="search" placeholder="Buscar nos meus links…" value="' + esc(linksUi.q) + '"></div></div>' +
            '<div class="tabs" id="folder-tabs"></div><div class="list" id="fav-list"></div>'
          : emptyBox('star', 'Você ainda não salvou nenhum link', 'Toque na estrela ★ de qualquer site para guardá-lo aqui.', '<a class="btn btn-primary" href="#/explorar">Explorar sites</a>')) +
        '</div>',
      after(view) {
        const draw = () => {
          const tabs = $('#folder-tabs', view);
          if (!tabs) return;
          tabs.innerHTML = [''].concat(folders).map((f) => '<button class="chip' + (linksUi.folder === f ? ' sel' : '') + '" data-folder="' + esc(f) + '">' + icon(f ? 'folder' : 'grid') + esc(f || 'Todas') + '</button>').join('');
          const q = norm(linksUi.q);
          const list = all.filter((f) => (!linksUi.folder || (f.folder || 'Geral') === linksUi.folder) && (!q || norm(f.n + ' ' + f.u + ' ' + f.note).includes(q)));
          $('#fav-list', view).innerHTML = list.length ? list.map(row).join('') : emptyBox('search', 'Nenhum link encontrado', 'Tente outra pasta ou outro termo.');
        };
        draw();
        $('#add-form', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const f = Object.fromEntries(new FormData(ev.target));
          const u = normalizeUrl(f.u);
          if (!u) { toast('Endereço inválido'); return; }
          const folder = (f.folder || 'Geral').trim() || 'Geral';
          Store.update((s) => {
            s.favs[u] = { u, n: f.n.trim(), d: '', folder, note: (f.note || '').trim(), at: Date.now(), custom: true };
            if (!s.folders.includes(folder)) s.folders.push(folder);
          });
          toast('Link salvo!');
          render();
        });
        const flt = $('#flt', view);
        if (flt) flt.addEventListener('input', () => { linksUi.q = flt.value; draw(); });
        view.addEventListener('click', (ev) => {
          const tab = ev.target.closest('[data-folder]');
          if (tab) { linksUi.folder = tab.dataset.folder; draw(); return; }
          const b = ev.target.closest('[data-action="edit-fav"]'); if (!b) return;
          const u = b.closest('.row').dataset.u;
          const f = Store.state.favs[u];
          const folder = prompt('Pasta deste link:', f.folder || 'Geral');
          if (folder === null) return;
          const note = prompt('Anotação (opcional):', f.note || '');
          Store.update((s) => {
            const name = folder.trim() || 'Geral';
            s.favs[u].folder = name;
            if (note !== null) s.favs[u].note = note.trim();
            if (!s.folders.includes(name)) s.folders.push(name);
          });
          render();
        });
      }
    };
  });

  /* ---------- Conta ---------- */
  const accountHooks = [];   // cloud.js adiciona o bloco de login
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });

  route(/^\/conta$/, 'conta', function () {
    const s = Store.state;
    const counts = [
      [Object.keys(s.favs).length, 'links salvos'],
      [s.exams.length, 'concursos'],
      [s.subjects.length, 'matérias'],
      [fmtMin(Object.values(s.study).reduce((a, b) => a + b, 0)), 'de estudo']
    ];
    return {
      title: 'Minha conta',
      crumbs: [['Início', '#/'], ['Minha conta', '#/conta']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('user') + 'Perfil</span><h1>Minha conta</h1>' +
        '<p>Seus links, concursos e estudos ficam guardados neste aparelho automaticamente — sem cadastro e sem custo.</p></div></div>' +
        '<div class="kpis">' + counts.map((c) => '<div class="kpi"><b>' + c[0] + '</b><span>' + c[1] + '</span></div>').join('') + '</div>' +
        '<div class="tool-layout section">' +
          '<form class="panel panel-pad" id="profile-form" style="display:flex;flex-direction:column;gap:12px">' +
            '<h2 style="font-size:18px">Perfil</h2>' +
            '<label class="field">Como quer ser chamado?<input class="input" name="nome" value="' + esc(s.profile.nome) + '" placeholder="Seu nome"></label>' +
            '<label class="field">Meu estado<select class="select" name="uf"><option value="">—</option>' + DATA.estados.map((e) => '<option value="' + e.uf + '"' + (s.profile.uf === e.uf ? ' selected' : '') + '>' + esc(e.nome) + '</option>').join('') + '</select></label>' +
            '<label class="field">Meta diária de estudo (minutos)<input class="input" name="goal" type="number" min="10" max="900" step="5" value="' + (s.settings.dailyGoal || 120) + '"></label>' +
            '<div><button class="btn btn-primary" type="submit">' + icon('check') + 'Salvar perfil</button></div>' +
          '</form>' +
          '<div style="display:flex;flex-direction:column;gap:16px">' +
            '<div class="panel panel-pad" id="cloud-box"></div>' +
            '<div class="panel panel-pad" style="display:flex;flex-direction:column;gap:12px">' +
              '<h2 style="font-size:18px">Backup e transferência</h2>' +
              '<p class="muted small">Baixe um arquivo com todos os seus dados e restaure em outro navegador ou celular.</p>' +
              '<div class="btn-row"><button class="btn" data-action="export">' + icon('download') + 'Baixar backup</button>' +
              '<label class="btn">' + icon('upload') + 'Restaurar backup<input type="file" accept="application/json,.json" id="import-file" hidden></label></div>' +
              (installPrompt ? '<button class="btn" id="install-btn">' + icon('install') + 'Instalar como aplicativo</button>' : '') +
            '</div>' +
            '<div class="panel panel-pad" style="display:flex;flex-direction:column;gap:10px">' +
              '<h2 style="font-size:18px">Zona de perigo</h2>' +
              '<p class="muted small">Apaga todos os dados deste aparelho. Faça um backup antes.</p>' +
              '<div><button class="btn btn-danger" data-action="wipe">' + icon('trash') + 'Apagar meus dados</button></div>' +
            '</div>' +
          '</div>' +
        '</div>',
      after(view) {
        $('#profile-form', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const f = Object.fromEntries(new FormData(ev.target));
          Store.update((s) => {
            s.profile.nome = f.nome.trim();
            s.profile.uf = f.uf;
            s.settings.dailyGoal = Math.max(10, Math.min(900, parseInt(f.goal, 10) || 120));
          });
          toast('Perfil salvo!');
          render();
        });
        $('#import-file', view).addEventListener('change', (ev) => {
          const file = ev.target.files[0]; if (!file) return;
          const r = new FileReader();
          r.onload = () => {
            try {
              const data = JSON.parse(r.result);
              if (!data || typeof data !== 'object' || !('favs' in data)) throw new Error('formato');
              if (!confirm('Substituir os dados deste aparelho pelos do backup?')) return;
              Store.replace(data);
              applyTheme();
              toast('Backup restaurado!');
              render();
            } catch (e) { toast('Arquivo de backup inválido'); }
          };
          r.readAsText(file);
        });
        const ib = $('#install-btn', view);
        if (ib) ib.addEventListener('click', async () => { installPrompt.prompt(); installPrompt = null; ib.remove(); });
        const cb = $('#cloud-box', view);
        if (accountHooks.length) accountHooks.forEach((fn) => fn(cb));
        else cb.innerHTML = '<h2 style="font-size:18px;display:flex;gap:8px;align-items:center">' + icon('cloud') + 'Sincronização</h2><p class="muted small" style="margin-top:8px">Use o backup ao lado para levar seus dados para outro aparelho.</p>';
        hydrateIcons(view);
      }
    };
  });

  /* ---------- Sobre ---------- */
  route(/^\/sobre$/, 'sobre', function () {
    return {
      title: 'Sobre',
      crumbs: [['Início', '#/'], ['Sobre', '#/sobre']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('info') + 'Sobre o projeto</span><h1>Por que o Atlas Concursos existe</h1></div></div>' +
        '<div class="panel panel-pad" style="display:flex;flex-direction:column;gap:14px;max-width:820px;font-size:15.5px">' +
          '<p>Quem estuda para concurso perde horas procurando: qual é o site da banca? Onde sai o edital da PM? Qual o endereço do Diário Oficial do meu estado? O Atlas reúne <b>todos esses endereços oficiais em um só lugar</b>, organizados por categoria e por estado, com busca instantânea.</p>' +
          '<p>Também traz ferramentas gratuitas para o dia a dia do concurseiro: <b>Pomodoro</b> com histórico, <b>edital verticalizado</b> com revisões automáticas, <b>calculadora de nota</b> (inclusive Cebraspe), <b>planejador de estudos</b>, <b>contagem regressiva</b> para as provas e <b>bloco de notas</b>.</p>' +
          '<p><b>Importante:</b> o Atlas é um projeto independente, não é um site do governo nem de banca. Confirme sempre datas, valores e regras no edital oficial.</p>' +
          '<p><b>Privacidade:</b> seus dados ficam no seu aparelho. Nada é enviado para servidores, a menos que você ative a sincronização com sua conta Google. Veja a <a class="grad-text" href="privacidade.html">política de privacidade</a>.</p>' +
          '<p><b>Encontrou um link quebrado ou quer sugerir um site?</b> Use o botão ⚑ em qualquer card.</p>' +
          '<p><b>Direitos:</b> o Atlas Concursos, seu código, design e a organização do catálogo são protegidos por direitos autorais. Veja os <a class="grad-text" href="termos.html">termos de uso</a>. Tem um cursinho, escola ou prefeitura e quer uma versão do Atlas? Oferecemos licenças personalizadas.</p>' +
        '</div>'
    };
  });

  function notFound() {
    return {
      title: 'Página não encontrada',
      html: emptyBox('search', 'Página não encontrada', 'O endereço não existe. Use a busca para encontrar o que procura.', '<a class="btn btn-primary" href="#/">Voltar ao início</a>')
    };
  }
  route(/^__notfound__$/, 'notfound', notFound);

  /* =========================================================
     Busca global (Ctrl K)
     ========================================================= */
  const pages = [];   // comandos de navegação (tools.js adiciona os seus)
  function basePages() {
    return [
      { n: 'Início', href: '#/', ic: 'home' },
      { n: 'Explorar todos os sites', href: '#/explorar', ic: 'grid' },
      { n: 'Estados', href: '#/estados', ic: 'map' },
      { n: 'Meus links', href: '#/meus-links', ic: 'star' },
      { n: 'Minha conta', href: '#/conta', ic: 'user' }
    ].concat(DATA.categorias.map((c) => ({ n: c.nome, href: '#/c/' + c.id, ic: c.icone, sub: 'Categoria' })))
      .concat(DATA.estados.map((e) => ({ n: e.nome + ' (' + e.uf + ')', href: '#/uf/' + e.uf, ic: 'map', sub: 'Hub do estado', kw: e.uf })));
  }

  const Palette = {
    el: null, input: null, list: null, results: [], index: 0,
    init() {
      this.el = $('#palette'); this.input = $('#palette-input'); this.list = $('#palette-results');
      this.input.addEventListener('input', () => this.run());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.move(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); this.choose(this.index, e.ctrlKey || e.metaKey); }
        else if (e.key === 'Escape') this.close();
      });
      this.el.addEventListener('click', (e) => {
        if (e.target === this.el) return this.close();
        const fav = e.target.closest('[data-pfav]');
        if (fav) { e.preventDefault(); e.stopPropagation(); this.choose(+fav.dataset.pfav, true); return; }
        const item = e.target.closest('[data-i]');
        if (item) { e.preventDefault(); this.choose(+item.dataset.i, false); }
      });
      this.list.addEventListener('mousemove', (e) => {
        const item = e.target.closest('[data-i]');
        if (item && +item.dataset.i !== this.index) { this.index = +item.dataset.i; this.paint(); }
      });
    },
    open(q) {
      this.el.hidden = false;
      document.body.style.overflow = 'hidden';
      this.input.value = q || '';
      this.run();
      setTimeout(() => this.input.focus(), 10);
    },
    close() { this.el.hidden = true; document.body.style.overflow = ''; },
    run() {
      const q = this.input.value.trim();
      const s = Store.state;
      let res = [];
      if (!q) {
        res = res.concat(s.recent.slice(0, 5).map((r) => ({ group: 'Recentes', n: r.n, sub: hostOf(r.u), u: r.u })));
        const TOP = [['SP', 'pm'], ['RJ', 'pm'], ['SP', 'pc'], ['RJ', 'pc'], ['SP', 'tj'], ['RJ', 'tj'], ['SP', 'cbm'], ['RJ', 'cbm'], ['SP', 'doe'], ['RJ', 'doe']];
        res = res.concat(TOP.map(([uf, k]) => ufBy[uf] && ufBy[uf].items[k]).filter(Boolean)
          .map((it) => ({ group: 'Mais procurados', n: it.n, sub: it.ufNome + ' · ' + hostOf(it.u), u: it.u })));
        res = res.concat(basePages().slice(0, 5).concat(pages).map((p) => ({ group: 'Ir para', n: p.n, sub: p.sub || '', href: p.href, ic: p.ic })));
      } else {
        const nq = norm(q);
        const toks = nq.split(/\s+/);
        const navs = basePages().concat(pages).filter((p) => toks.every((t) => norm(p.n + ' ' + (p.sub || '') + ' ' + (p.kw || '')).includes(t))).slice(0, 6);
        res = res.concat(navs.map((p) => ({ group: 'Páginas', n: p.n, sub: p.sub || '', href: p.href, ic: p.ic })));
        const own = Object.values(s.favs).filter((f) => f.custom && toks.every((t) => norm(f.n + ' ' + f.u + ' ' + f.note).includes(t)));
        res = res.concat(own.map((f) => ({ group: 'Meus links', n: f.n, sub: hostOf(f.u), u: f.u })));
        res = res.concat(search(q, 40).map((it) => ({ group: 'Sites oficiais', n: it.n, sub: (it.uf ? it.ufNome : it.catNome) + ' · ' + hostOf(it.u), u: it.u })));
        if (!res.length) res.push({ group: 'Sem resultados no catálogo', n: 'Pesquisar "' + q + '" em sites do governo', sub: 'Google · site:gov.br', u: google(q + ' concurso site:gov.br'), web: true });
      }
      this.results = res; this.index = 0; this.paint(q);
    },
    paint(q) {
      if (q === undefined) q = this.input.value.trim();
      const toks = norm(q).split(/\s+/).filter(Boolean);
      const hl = (text) => {
        const t = String(text);
        const n = norm(t);
        if (!toks.length || n.length !== t.length) return esc(t);
        const marks = new Array(t.length).fill(false);
        toks.forEach((tk) => { let i = n.indexOf(tk); while (i >= 0) { for (let j = i; j < i + tk.length; j++) marks[j] = true; i = n.indexOf(tk, i + tk.length); } });
        let out = '', open = false;
        for (let i = 0; i < t.length; i++) {
          if (marks[i] && !open) { out += '<mark>'; open = true; }
          if (!marks[i] && open) { out += '</mark>'; open = false; }
          out += esc(t[i]);
        }
        return out + (open ? '</mark>' : '');
      };
      let html = '', last = '';
      this.results.forEach((r, i) => {
        if (r.group !== last) { html += '<div class="p-group">' + esc(r.group) + '</div>'; last = r.group; }
        const left = r.href ? '<span class="tile-icon" style="width:34px;height:34px;border-radius:10px">' + icon(r.ic || 'chevron') + '</span>' : mono(r.n, r.u);
        const right = r.u && !r.web ? '<button class="icon-btn fav' + (isFav(r.u) ? ' on' : '') + '" data-pfav="' + i + '" title="Salvar (Ctrl+Enter)" aria-label="Salvar">' + icon('star') + '</button>' : icon(r.href ? 'chevron' : 'external');
        html += '<div class="p-item' + (i === this.index ? ' active' : '') + '" data-i="' + i + '" role="option" aria-selected="' + (i === this.index) + '">' + left +
          '<div class="grow"><div class="title">' + hl(r.n) + '</div>' + (r.sub ? '<div class="sub">' + esc(r.sub) + '</div>' : '') + '</div>' + right + '</div>';
      });
      this.list.innerHTML = html;
      const act = $('.p-item.active', this.list);
      if (act) act.scrollIntoView({ block: 'nearest' });
    },
    move(d) {
      if (!this.results.length) return;
      this.index = (this.index + d + this.results.length) % this.results.length;
      this.paint();
    },
    choose(i, save) {
      const r = this.results[i]; if (!r) return;
      if (save && r.u && !r.web) { toggleFav(r.u); this.paint(); return; }
      if (r.href) { this.close(); location.hash = r.href; return; }
      if (r.u) { if (!r.web) track(r.u, r.n); window.open(r.u, '_blank', 'noopener'); this.close(); }
    }
  };

  /* =========================================================
     Tema
     ========================================================= */
  function applyTheme() {
    const t = Store.state.settings.theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    const m = $('meta[name="theme-color"]');
    if (m) m.content = t === 'light' ? '#f4f6fb' : '#070a12';
  }

  /* =========================================================
     Anúncios (Google AdSense) + consentimento (LGPD)
     ========================================================= */
  const CONSENT_KEY = 'atlas:consent';
  const Ads = {
    enabled: !!(CFG.ads && CFG.ads.client),
    loaded: false,
    init() {
      if (!this.enabled) return;
      let c = null;
      try { c = localStorage.getItem(CONSENT_KEY); } catch (e) {}
      if (c) this.load(c === 'all');
      else this.ask();
    },
    ask() {
      const box = $('#consent');
      box.innerHTML = '<div class="consent panel" role="dialog" aria-label="Cookies">' +
        '<p>Usamos cookies de publicidade (Google AdSense) para manter o Atlas Concursos gratuito. Você pode aceitar anúncios personalizados ou ver apenas anúncios genéricos. <a class="grad-text" href="privacidade.html">Saiba mais</a>.</p>' +
        '<div class="btn-row"><button class="btn btn-primary btn-sm" data-consent="all">Aceitar</button><button class="btn btn-sm" data-consent="essential">Apenas essenciais</button></div></div>';
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-consent]'); if (!b) return;
        try { localStorage.setItem(CONSENT_KEY, b.dataset.consent); } catch (err) {}
        box.innerHTML = '';
        this.load(b.dataset.consent === 'all');
      });
    },
    load(personalized) {
      if (this.loaded) return;
      this.loaded = true;
      window.adsbygoogle = window.adsbygoogle || [];
      if (!personalized) window.adsbygoogle.requestNonPersonalizedAds = 1;
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(CFG.ads.client);
      document.head.appendChild(s);
      this.fill(document);
    },
    fill(root) {
      if (!this.loaded) return;
      $$('.ad-slot[data-slot]', root).forEach((el) => {
        const slot = CFG.ads.slots && CFG.ads.slots[el.dataset.slot];
        if (!slot || el.dataset.filled) return;
        el.dataset.filled = '1';
        el.innerHTML = '<span class="ad-label">Publicidade</span><ins class="adsbygoogle" style="display:block" data-ad-client="' + esc(CFG.ads.client) + '" data-ad-slot="' + esc(slot) + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
      });
    }
  };

  /* =========================================================
     Eventos globais
     ========================================================= */
  const actions = {
    palette: () => Palette.open(),
    theme: () => { Store.update((s) => { s.settings.theme = s.settings.theme === 'light' ? 'dark' : 'light'; }); applyTheme(); },
    'open-nav': () => document.body.classList.add('nav-open'),
    'close-nav': () => document.body.classList.remove('nav-open'),
    fav: (b) => toggleFav(b.dataset.url),
    copy: (b) => copy(b.dataset.url),
    report: (b) => {
      const url = issueUrl('Link quebrado: ' + b.dataset.name, 'O link abaixo não está funcionando ou mudou de endereço:\n\n- Nome: ' + b.dataset.name + '\n- Link atual: ' + b.dataset.url + '\n- Endereço correto (se souber): \n');
      if (url) window.open(url, '_blank', 'noopener'); else toast('Obrigado! Configure o repositório em config.js.');
    },
    suggest: (b) => {
      const url = issueUrl('Sugestão de link: ' + b.dataset.name, 'Sugiro adicionar o site oficial de:\n\n- Órgão: ' + b.dataset.name + '\n- Link: \n');
      if (url) window.open(url, '_blank', 'noopener');
    },
    'set-uf': (b) => {
      Store.update((s) => { s.profile.uf = s.profile.uf === b.dataset.uf ? '' : b.dataset.uf; });
      toast(Store.state.profile.uf ? 'Este é o seu estado agora' : 'Estado removido');
      render();
    },
    export: () => {
      download('atlas-concursos-backup-' + dateKey() + '.json', JSON.stringify(Store.state, null, 2));
      toast('Backup baixado!');
    },
    wipe: () => {
      if (!confirm('Apagar todos os seus links, concursos, matérias e histórico deste aparelho?')) return;
      Store.replace(defaults());
      applyTheme();
      toast('Dados apagados');
      render();
    }
  };

  function bindGlobal() {
    document.addEventListener('click', (e) => {
      const tr = e.target.closest('a[data-track]');
      if (tr) track(tr.dataset.track, tr.dataset.name);
      const a = e.target.closest('[data-action]');
      if (a && actions[a.dataset.action]) {
        if (a.tagName === 'A' || a.tagName === 'BUTTON' || a.getAttribute('role') === 'button') e.preventDefault();
        actions[a.dataset.action](a, e);
      }
    });
    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); Palette.el.hidden ? Palette.open() : Palette.close(); }
      else if (e.key === '/' && !typing && Palette.el.hidden) { e.preventDefault(); Palette.open(); }
      else if (e.key === 'Escape' && !Palette.el.hidden) Palette.close();
      else if (e.key === 'Enter' && document.activeElement.classList.contains('hero-search')) Palette.open();
    });
    window.addEventListener('hashchange', render);
    window.addEventListener('storage', (e) => { if (e.key === KEY) { Store.load(); applyTheme(); render(); } });
  }

  /* =========================================================
     API pública para os outros módulos
     ========================================================= */
  const Atlas = window.Atlas = {
    $, $$, esc, norm, uid, safeUrl, icon, hydrateIcons, toast, dateKey, addDays, daysUntil, fmtDate, fmtMin, pad,
    Store, REG, route, render, current, card, mono, emptyBox, extLink, hostOf, google, download,
    nav: extraNav, navProject: projectNav, navTop: topNav, cardBadges, isFav, toggleFav, ufBy, afterRender, pages, accountHooks, renderNav, renderAccountChip, defaults, copy,
    cloud: null
  };

  /* =========================================================
     Inicialização
     ========================================================= */
  function start() {
    // Anti-clickjacking: no domínio oficial, o site não pode ser exibido dentro de outro site.
    try {
      if (CFG.siteUrl && window.top !== window.self && new URL(CFG.siteUrl).origin === location.origin) window.top.location = location.href;
    } catch (e) { document.documentElement.style.display = 'none'; }
    Store.load();
    applyTheme();
    buildCatalog();
    hydrateIcons(document);
    Palette.init();
    bindGlobal();
    Ads.init();
    render();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  // tools.js e cloud.js carregam depois deste arquivo; iniciamos quando o DOM estiver pronto.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else setTimeout(start, 0);
})();
