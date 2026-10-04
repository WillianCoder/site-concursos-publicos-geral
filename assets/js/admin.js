/*
 * Atlas Concursos — Painel do Administrador.
 *
 * Como funciona: o site é estático, então o painel edita o arquivo
 * assets/js/config.js direto no GitHub, usando um token pessoal do dono.
 * O token fica só na sessão deste navegador (some ao fechar a aba) e
 * nunca é enviado para outro lugar além de api.github.com.
 */
(function () {
  'use strict';

  const API = 'https://api.github.com';
  const PATH = 'assets/js/config.js';
  const SS = 'atlas:admin';
  const LOCAL = window.ATLAS_CONFIG || {};
  const DATA = window.ATLAS_DATA || { categorias: [], estados: [] };
  const RADAR = window.ATLAS_RADAR || { items: [] };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || '').trim());
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));
  const b64decode = (b64) => decodeURIComponent(escape(atob(String(b64).replace(/\s/g, ''))));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- Sessão ---------- */
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(SS) || 'null'); } catch (e) {}
  let cfg = null, sha = null, dirty = false, tab = 'geral';

  function setDirty(v) {
    dirty = v;
    $('#adm-dirty').hidden = !v;
  }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  async function gh(path, opts) {
    opts = opts || {};
    const res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + session.token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.message || ('Erro ' + res.status)); err.status = res.status; throw err; }
    return data;
  }

  function parseConfig(text) {
    const start = text.indexOf('{', text.indexOf('window.ATLAS_CONFIG'));
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('formato');
    return JSON.parse(text.slice(start, end + 1));
  }
  function serialize(c) {
    return '/*\n * Configurações do Atlas Concursos.\n * Edite pelo Painel do Administrador (admin.html) ou à mão — o conteúdo entre\n * as chaves precisa ser JSON válido (aspas duplas, sem comentários).\n * O significado de cada campo está no README.md, seção "Configurações".\n */\nwindow.ATLAS_CONFIG = ' + JSON.stringify(c, null, 2) + ';\n';
  }
  function normalize(c) {
    c = c || {};
    c.ads = c.ads || { client: '', slots: {} };
    c.ads.slots = c.ads.slots || {};
    c.pix = c.pix || { chave: '', nome: '', cidade: '', valores: [5, 10, 20, 50] };
    c.contato = c.contato || { email: '', whatsapp: '' };
    ['pacotes', 'patrocinios', 'recomendados', 'dicasPatrocinadas'].forEach((k) => { if (!Array.isArray(c[k])) c[k] = []; });
    if (c.firebase === undefined) c.firebase = null;
    return c;
  }

  async function loadRemote() {
    const f = await gh('/repos/' + session.owner + '/' + session.repo + '/contents/' + PATH + '?ref=' + encodeURIComponent(session.branch));
    sha = f.sha;
    try { cfg = normalize(parseConfig(b64decode(f.content))); }
    catch (e) {
      if (!confirm('O config.js do repositório está num formato antigo. Carregar as configurações desta página e substituí-lo ao salvar?')) throw e;
      cfg = normalize(clone(LOCAL));
      setDirty(true);
    }
  }

  async function save() {
    const errs = validate();
    if (errs.length) { alert('Corrija antes de publicar:\n\n• ' + errs.join('\n• ')); return; }
    const btn = $('#adm-save');
    btn.disabled = true; btn.textContent = 'Publicando…';
    try {
      const r = await gh('/repos/' + session.owner + '/' + session.repo + '/contents/' + PATH, {
        method: 'PUT',
        body: { message: 'Painel: atualiza as configurações do site', content: b64encode(serialize(cfg)), sha, branch: session.branch }
      });
      sha = r.content.sha;
      setDirty(false);
      toast('Publicado! O site atualiza em cerca de 1 minuto.');
    } catch (e) {
      if (e.status === 409) alert('O arquivo foi alterado em outro lugar. Recarregue o painel e refaça a alteração.');
      else alert('Não foi possível publicar: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Salvar e publicar';
    }
  }

  function validate() {
    const e = [];
    const chk = (u, where) => { if (u && !safeUrl(u)) e.push(where + ': o link precisa começar com https://'); };
    cfg.patrocinios.forEach((p, i) => { if (!p.titulo) e.push('Patrocínio ' + (i + 1) + ': falta o título'); chk(p.url, 'Patrocínio "' + (p.titulo || i + 1) + '"'); if (!p.url) e.push('Patrocínio ' + (i + 1) + ': falta o link'); });
    cfg.recomendados.forEach((r, i) => { chk(r.url, 'Recomendado "' + (r.titulo || i + 1) + '"'); if (!r.url) e.push('Recomendado ' + (i + 1) + ': falta o link'); });
    cfg.dicasPatrocinadas.forEach((d, i) => chk(d.url, 'Dica ' + (i + 1)));
    chk(cfg.listaEsperaPro, 'Lista de espera do Pro');
    chk(cfg.siteUrl, 'Endereço do site');
    if (cfg.contato.whatsapp && !/^\d{12,13}$/.test(cfg.contato.whatsapp)) e.push('WhatsApp: use só números com DDI e DDD, ex.: 5511999999999');
    if (cfg.ads.client && !/^ca-pub-\d{10,20}$/.test(cfg.ads.client)) e.push('AdSense: o ID deve ter o formato ca-pub-0000000000000000');
    return e;
  }

  /* ---------- Login ---------- */
  function repoFromConfig() {
    const m = String(LOCAL.repoUrl || '').match(/github\.com\/([^/]+)\/([^/#?]+)/);
    return m ? m[1] + '/' + m[2] : '';
  }

  function renderLogin(error) {
    $('#adm-save').hidden = true; $('#adm-logout').hidden = true;
    $('#adm').innerHTML =
      '<form class="panel panel-pad adm-login" id="login">' +
        '<span class="eyebrow">Acesso restrito</span><h1 style="font-size:26px">Painel do Administrador</h1>' +
        '<p class="muted">Edite Pix, contato, patrocínios, recomendados e anúncios sem mexer em código. Cada alteração é publicada no GitHub e o site atualiza sozinho.</p>' +
        (error ? '<p class="badge danger" style="white-space:normal">' + esc(error) + '</p>' : '') +
        '<label class="field">Repositório (dono/nome)<input class="input" name="repo" required value="' + esc(repoFromConfig()) + '" placeholder="WillianCoder/site-concursos-publicos-geral" autocomplete="off"></label>' +
        '<label class="field">Branch publicada<input class="input" name="branch" required value="main" autocomplete="off"></label>' +
        '<label class="field">Token de acesso do GitHub<input class="input" name="token" type="password" required placeholder="github_pat_…" autocomplete="off" spellcheck="false"></label>' +
        '<button class="btn btn-primary" type="submit">Entrar</button>' +
        '<details><summary style="cursor:pointer;font-weight:600">Como criar o token (2 minutos, uma vez a cada 90 dias)</summary>' +
          '<ol style="margin-top:10px">' +
            '<li>Abra <a class="grad-text" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li>' +
            '<li>Nome: <code>Painel Atlas</code>. Validade: <b>90 dias</b>.</li>' +
            '<li>Repository access: <b>Only select repositories</b> → escolha este repositório.</li>' +
            '<li>Permissions → Repository → <b>Contents: Read and write</b>. Nada mais.</li>' +
            '<li>Gere, copie e cole aqui. Não envie o token para ninguém.</li>' +
          '</ol></details>' +
        '<p class="adm-help">O token fica só nesta aba do navegador e some ao fechá-la. Ative a verificação em duas etapas (2FA) na sua conta do GitHub.</p>' +
      '</form>';
    $('#login').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      const [owner, repo] = f.repo.trim().split('/');
      if (!owner || !repo) return renderLogin('Informe o repositório no formato dono/nome.');
      session = { token: f.token.trim(), owner, repo, branch: f.branch.trim() || 'main' };
      const btn = $('button[type=submit]', ev.target); btn.disabled = true; btn.textContent = 'Verificando…';
      try {
        const r = await gh('/repos/' + owner + '/' + repo);
        if (!r.permissions || !r.permissions.push) throw new Error('Este token não tem permissão de escrita no repositório.');
        await loadRemote();
        sessionStorage.setItem(SS, JSON.stringify(session));
        renderApp();
      } catch (e) {
        session = null;
        renderLogin(e.status === 401 ? 'Token inválido ou expirado.' : e.status === 404 ? 'Repositório, branch ou arquivo não encontrado (o site já foi publicado na branch indicada?).' : e.message);
      }
    });
  }

  /* ---------- Editor de listas ---------- */
  const PLACES = [['home', 'Página inicial'], ['radar', 'Radar de Editais'], ['descubra', 'Descubra seu concurso'], ['ferramentas', 'Ferramentas']]
    .concat(DATA.categorias.map((c) => ['c:' + c.id, 'Categoria: ' + c.nome]))
    .concat(DATA.estados.map((e) => ['uf:' + e.uf, 'Estado: ' + e.nome]));

  function field(f, val, i) {
    const attrs = ' data-i="' + i + '" data-k="' + f.k + '"';
    let input;
    if (f.type === 'textarea') input = '<textarea class="textarea" rows="2" style="min-height:64px"' + attrs + '>' + esc(val) + '</textarea>';
    else if (f.type === 'multi') input = '<select class="select" multiple' + attrs + '>' + PLACES.map((p) => '<option value="' + p[0] + '"' + ((val || []).includes(p[0]) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') + '</select>';
    else input = '<input class="input" type="' + (f.type || 'text') + '"' + attrs + ' value="' + esc(val) + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + (f.type === 'number' ? ' min="0" step="1"' : '') + '>';
    return '<label class="field' + (f.full ? ' full' : '') + '">' + esc(f.label) + input + (f.help ? '<span class="adm-help">' + f.help + '</span>' : '') + '</label>';
  }

  function listEditor(key, schema, opts) {
    const list = cfg[key];
    return '<div class="adm-section" data-list="' + key + '">' +
      (list.length ? list.map((it, i) => {
        let status = '';
        if (opts.status) status = opts.status(it);
        return '<div class="panel adm-item"><div class="adm-item-head"><h3>' + esc(it[opts.title] || opts.empty) + '</h3>' + status +
          '<button class="icon-btn" data-up="' + i + '" title="Subir" aria-label="Subir">↑</button>' +
          '<button class="icon-btn" data-del="' + i + '" title="Remover" aria-label="Remover">✕</button></div>' +
          '<div class="adm-grid">' + schema.map((f) => field(f, it[f.k], i)).join('') + '</div></div>';
      }).join('') : '<div class="empty">' + opts.none + '</div>') +
      '<div><button class="btn" data-add="' + key + '">+ ' + esc(opts.add) + '</button></div></div>';
  }

  function bindList(root, key, blank) {
    const box = $('[data-list="' + key + '"]', root);
    if (!box) return;
    const onEdit = (e) => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const it = cfg[key][+el.dataset.i];
      const k = el.dataset.k;
      if (el.multiple) it[k] = Array.from(el.selectedOptions).map((o) => o.value);
      else if (el.type === 'number') it[k] = el.value === '' ? '' : Number(el.value);
      else it[k] = el.value;
      setDirty(true);
    };
    box.addEventListener('input', onEdit);
    box.addEventListener('change', onEdit);
    box.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      const del = e.target.closest('[data-del]');
      const up = e.target.closest('[data-up]');
      if (add) { cfg[key].push(clone(blank)); setDirty(true); renderApp(); }
      else if (del && confirm('Remover este item?')) { cfg[key].splice(+del.dataset.del, 1); setDirty(true); renderApp(); }
      else if (up && +up.dataset.up > 0) { const i = +up.dataset.up; [cfg[key][i - 1], cfg[key][i]] = [cfg[key][i], cfg[key][i - 1]]; setDirty(true); renderApp(); }
    });
  }

  // Liga inputs simples a um caminho do objeto (ex.: "pix.chave").
  function bindPaths(root) {
    $$('[data-path]', root).forEach((el) => {
      const handler = () => {
        const parts = el.dataset.path.split('.');
        let o = cfg;
        parts.slice(0, -1).forEach((p) => { o = o[p] = o[p] || {}; });
        let v = el.value;
        if (el.dataset.kind === 'list') v = v.split(',').map((x) => Number(x.trim())).filter((x) => x > 0);
        if (el.dataset.kind === 'digits') v = v.replace(/\D/g, '');
        if (el.dataset.kind === 'json') {
          if (!v.trim()) v = null;
          else { try { v = JSON.parse(v); el.style.borderColor = ''; } catch (e) { el.style.borderColor = 'var(--danger)'; return; } }
        }
        o[parts[parts.length - 1]] = v;
        setDirty(true);
        if (el.dataset.path.startsWith('pix.')) drawPix(root);
      };
      el.addEventListener('input', handler);
    });
  }
  const pathInput = (label, path, val, opts) => {
    opts = opts || {};
    return '<label class="field' + (opts.full ? ' full' : '') + '">' + esc(label) +
      (opts.textarea
        ? '<textarea class="textarea" data-path="' + path + '"' + (opts.kind ? ' data-kind="' + opts.kind + '"' : '') + ' rows="5" spellcheck="false" style="font-family:monospace;font-size:12px">' + esc(val) + '</textarea>'
        : '<input class="input" data-path="' + path + '"' + (opts.kind ? ' data-kind="' + opts.kind + '"' : '') + ' value="' + esc(val) + '"' + (opts.ph ? ' placeholder="' + esc(opts.ph) + '"' : '') + ' autocomplete="off">') +
      (opts.help ? '<span class="adm-help">' + opts.help + '</span>' : '') + '</label>';
  };

  /* ---------- Pix (prévia) ---------- */
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) { crc ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff; }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  const ascii = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim().toUpperCase();
  function drawPix(root) {
    const box = $('#adm-pix', root); if (!box) return;
    const p = cfg.pix;
    if (!p.chave || !p.nome || !p.cidade) { box.innerHTML = '<p class="adm-help">Preencha chave, nome e cidade para ver o QR Code de teste.</p>'; return; }
    const body = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', String(p.chave).trim()) + tlv('02', 'Apoio Atlas Concursos')) + tlv('52', '0000') + tlv('53', '986') + tlv('54', '1.00') + tlv('58', 'BR') + tlv('59', ascii(p.nome).slice(0, 25)) + tlv('60', ascii(p.cidade).slice(0, 15)) + tlv('62', tlv('05', 'ATLAS')) + '6304';
    const code = body + crc16(body);
    let svg = '';
    if (typeof window.qrcode === 'function') { const q = window.qrcode(0, 'M'); q.addData(code); q.make(); svg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
    box.innerHTML = '<div class="adm-qr">' + svg + '</div><p class="adm-help">Teste: pague <b>R$ 1,00</b> para você mesmo pelo app do banco e confirme que o nome aparece certo.</p>';
  }

  /* ---------- Abas ---------- */
  const TABS = [['geral', 'Visão geral'], ['pix', 'Pix e contato'], ['patrocinios', 'Patrocínios'], ['recomendados', 'Afiliados e dicas'], ['pacotes', 'Preços (Anuncie)'], ['anuncios', 'AdSense e Pro'], ['avancado', 'Avançado']];

  function viewGeral() {
    const ativos = cfg.patrocinios.filter((p) => !p.ate || p.ate >= today());
    const receita = ativos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const vencendo = ativos.filter((p) => p.ate && (new Date(p.ate) - new Date(today())) / 86400000 <= 7);
    const radarRecent = (RADAR.items || []).filter((x) => (new Date(today()) - new Date(x.d)) / 86400000 <= 7).length;
    const check = (ok, txt, goTab) => '<div class="row"><span class="badge ' + (ok ? 'ok' : 'warn') + '">' + (ok ? '✓' : '!') + '</span><div class="grow"><div class="title" style="white-space:normal">' + txt + '</div></div>' + (goTab ? '<button class="btn btn-sm" data-go="' + goTab + '">Configurar</button>' : '') + '</div>';
    const site = cfg.siteUrl || ('https://' + session.owner.toLowerCase() + '.github.io/' + session.repo + '/');
    const link = (href, t, d) => '<a class="tile" href="' + esc(href) + '" target="_blank" rel="noopener"><h3>' + esc(t) + '</h3><p>' + esc(d) + '</p></a>';
    return '<div class="kpis">' +
        '<div class="kpi"><b>' + brl(receita) + '</b><span>receita mensal dos patrocínios ativos</span></div>' +
        '<div class="kpi"><b>' + ativos.length + '</b><span>patrocínios ativos</span></div>' +
        '<div class="kpi"><b style="color:' + (vencendo.length ? 'var(--warn)' : 'inherit') + '">' + vencendo.length + '</b><span>vencem em 7 dias</span></div>' +
        '<div class="kpi"><b>' + cfg.recomendados.length + '</b><span>links de afiliado</span></div>' +
        '<div class="kpi"><b>' + radarRecent + '</b><span>novidades no Radar (7 dias)</span></div>' +
      '</div>' +
      (vencendo.length ? '<div class="panel panel-pad section"><b>Renove com o cliente:</b> ' + vencendo.map((p) => esc(p.titulo) + ' (até ' + esc(p.ate) + ')').join(', ') + '</div>' : '') +
      '<section class="section"><div class="section-head"><h2>Checklist para começar a faturar</h2></div><div class="list">' +
        check(cfg.pix.chave && cfg.pix.nome && cfg.pix.cidade, 'Pix configurado — página <b>Apoie o Atlas</b> no ar', 'pix') +
        check(cfg.contato.whatsapp || cfg.contato.email, 'Contato comercial — página <b>Anuncie no Atlas</b> no ar', 'pix') +
        check(cfg.recomendados.length, 'Pelo menos um link de afiliado (Amazon, Hotmart, Kiwify)', 'recomendados') +
        check(ativos.length, 'Primeiro patrocinador fechado (dica: ofereça o Destaque no estado aos cursinhos da sua cidade)', 'patrocinios') +
        check(cfg.siteUrl, 'Domínio próprio configurado (necessário para o AdSense)', 'avancado') +
        check(cfg.ads.client, 'Google AdSense aprovado e configurado', 'anuncios') +
      '</div></section>' +
      '<section class="section"><div class="section-head"><h2>Atalhos</h2></div><div class="adm-links">' +
        link(site, 'Ver o site', 'Abre o site publicado') +
        link('https://github.com/' + session.owner + '/' + session.repo + '/actions', 'Automações', 'Publicação, Radar e verificação de links') +
        link('https://github.com/' + session.owner + '/' + session.repo + '/issues', 'Links reportados', 'Avisos de visitantes sobre links quebrados') +
        link('https://search.google.com/search-console', 'Google Search Console', 'Visitas vindas do Google') +
        link('https://adsense.google.com', 'Google AdSense', 'Ganhos com anúncios') +
        link('https://busca.inpi.gov.br', 'INPI', 'Registro da marca e do software') +
      '</div></section>';
  }

  function viewPix() {
    return '<div class="tool-layout">' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Pix (página "Apoie o Atlas")</h2><div class="adm-grid">' +
        pathInput('Chave Pix', 'pix.chave', cfg.pix.chave, { ph: 'CPF, CNPJ, e-mail, celular (+5511…) ou aleatória', full: true }) +
        pathInput('Nome do recebedor', 'pix.nome', cfg.pix.nome, { ph: 'WILLIAN SALLES', help: 'Até 25 letras, sem acentos.' }) +
        pathInput('Cidade', 'pix.cidade', cfg.pix.cidade, { ph: 'SAO PAULO', help: 'Até 15 letras, sem acentos.' }) +
        pathInput('Valores sugeridos (R$)', 'pix.valores', (cfg.pix.valores || []).join(', '), { kind: 'list', ph: '5, 10, 20, 50', full: true }) +
      '</div><div id="adm-pix"></div></div>' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Contato comercial (página "Anuncie")</h2><div class="adm-grid">' +
        pathInput('WhatsApp', 'contato.whatsapp', cfg.contato.whatsapp, { kind: 'digits', ph: '5511999999999', help: 'Só números: 55 + DDD + número.' }) +
        pathInput('E-mail', 'contato.email', cfg.contato.email, { ph: 'contato@seudominio.com.br' }) +
      '</div><p class="adm-help">O e-mail também recebe os avisos de link quebrado quando o repositório estiver privado.</p></div>' +
    '</div>';
  }

  const SPONSOR = [
    { k: 'titulo', label: 'Título', ph: 'Cursinho Exemplo — PM-MG' },
    { k: 'url', label: 'Link (https://…)', type: 'url', ph: 'https://' },
    { k: 'valor', label: 'Valor cobrado (R$/mês)', type: 'number', help: 'Só para o seu controle; não aparece no site.' },
    { k: 'ate', label: 'Exibir até', type: 'date', help: 'Depois desta data o card some sozinho.' },
    { k: 'desc', label: 'Texto do card', type: 'textarea', full: true },
    { k: 'onde', label: 'Onde aparece (Ctrl/⌘ para escolher vários)', type: 'multi', full: true }
  ];
  const REC = [
    { k: 'titulo', label: 'Produto', ph: 'Vade Mecum 2026' },
    { k: 'url', label: 'Link de afiliado', type: 'url', ph: 'https://amzn.to/…' },
    { k: 'preco', label: 'Preço exibido', ph: 'R$ 89,90' },
    { k: 'tag', label: 'Etiqueta', ph: 'Livro, Curso, Apostila…' },
    { k: 'desc', label: 'Descrição', type: 'textarea', full: true }
  ];
  const TIP = [
    { k: 'data', label: 'Dia', type: 'date' },
    { k: 'url', label: 'Link (opcional)', type: 'url', ph: 'https://' },
    { k: 'texto', label: 'Mensagem', type: 'textarea', full: true }
  ];
  const PKG = [
    { k: 'nome', label: 'Pacote' },
    { k: 'preco', label: 'Preço', ph: 'R$ 99/mês' },
    { k: 'ideal', label: 'Ideal para' },
    { k: 'desc', label: 'Descrição', type: 'textarea', full: true }
  ];

  function sponsorStatus(p) {
    if (p.ate && p.ate < today()) return '<span class="badge">expirado</span>';
    if (p.ate && (new Date(p.ate) - new Date(today())) / 86400000 <= 7) return '<span class="badge warn">vence ' + esc(p.ate) + '</span>';
    return '<span class="badge ok">ativo</span>';
  }

  function viewPatrocinios() {
    return '<p class="adm-help">Cada patrocínio vira um card com a etiqueta <b>Patrocinado</b> nos lugares escolhidos. Combine o valor com o cliente, receba por Pix e cadastre aqui.</p>' +
      listEditor('patrocinios', SPONSOR, { title: 'titulo', empty: 'Novo patrocínio', none: 'Nenhum patrocínio ainda. Que tal oferecer o "Destaque no estado" a um cursinho da sua cidade?', add: 'Adicionar patrocínio', status: sponsorStatus });
  }
  function viewRecomendados() {
    return '<h2 style="font-size:18px">Recomendados (links de afiliado)</h2><p class="adm-help">Aparecem na página inicial e em Ferramentas, sempre com o aviso de link de afiliado.</p>' +
      listEditor('recomendados', REC, { title: 'titulo', empty: 'Novo produto', none: 'Nenhum produto. Cadastre-se na Amazon Associados, Hotmart ou Kiwify e cole os links aqui.', add: 'Adicionar produto' }) +
      '<h2 style="font-size:18px;margin-top:26px">Dicas patrocinadas</h2><p class="adm-help">Substituem a "Dica do dia" da página inicial no dia escolhido (pacote de R$ 29/dia).</p>' +
      listEditor('dicasPatrocinadas', TIP, { title: 'data', empty: 'Nova dica', none: 'Nenhuma dica patrocinada agendada.', add: 'Agendar dica' });
  }
  function viewPacotes() {
    return '<p class="adm-help">Tabela de preços exibida na página "Anuncie no Atlas". Aumente os valores conforme as visitas crescerem.</p>' +
      listEditor('pacotes', PKG, { title: 'nome', empty: 'Novo pacote', none: 'Sem pacotes.', add: 'Adicionar pacote' });
  }
  function viewAnuncios() {
    return '<div class="tool-layout">' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Google AdSense</h2><div class="adm-grid">' +
        pathInput('ID de editor', 'ads.client', cfg.ads.client, { ph: 'ca-pub-0000000000000000', full: true, help: 'Aparece no painel do AdSense depois da aprovação. Lembre de atualizar também o arquivo ads.txt.' }) +
        pathInput('Bloco da barra lateral', 'ads.slots.sidebar', cfg.ads.slots.sidebar, { ph: '1234567890' }) +
        pathInput('Bloco entre seções', 'ads.slots.feed', cfg.ads.slots.feed, { ph: '1234567890' }) +
        pathInput('Bloco do rodapé', 'ads.slots.footer', cfg.ads.slots.footer, { ph: '1234567890' }) +
      '</div></div>' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Atlas Pro (lista de espera)</h2>' +
        pathInput('Link do formulário', 'listaEsperaPro', cfg.listaEsperaPro, { ph: 'https://forms.gle/…', help: 'Crie um Google Forms pedindo nome, e-mail/WhatsApp e órgãos de interesse. Com 100 inscritos, vale construir os alertas pagos.' }) +
      '</div></div>';
  }
  function viewAvancado() {
    return '<div class="tool-layout">' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Endereços</h2>' +
        pathInput('Endereço público do site', 'siteUrl', cfg.siteUrl, { ph: 'https://atlasconcursos.com.br', help: 'Usado nos compartilhamentos e na proteção contra o site ser exibido dentro de outro site.' }) +
        pathInput('Repositório (para reportar links)', 'repoUrl', cfg.repoUrl, { ph: 'https://github.com/…', help: 'Deixe vazio se o repositório for privado: os avisos vão para o e-mail de contato.' }) +
      '</div>' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Login na nuvem (Firebase)</h2>' +
        pathInput('Configuração do app web (JSON)', 'firebase', cfg.firebase ? JSON.stringify(cfg.firebase, null, 2) : '', { textarea: true, kind: 'json', full: true, help: 'Cole o objeto de configuração do Firebase (apiKey, authDomain, projectId, appId). Vazio = desligado. Passo a passo no README.' }) +
      '</div></div>' +
      '<div class="panel panel-pad section adm-section"><h2 style="font-size:18px">Cópia de segurança</h2><p class="adm-help">Baixe o arquivo de configuração atual (inclui alterações ainda não publicadas).</p><div><button class="btn" id="adm-download">Baixar config.js</button></div></div>';
  }

  function renderApp() {
    $('#adm-save').hidden = false; $('#adm-logout').hidden = false;
    const views = { geral: viewGeral, pix: viewPix, patrocinios: viewPatrocinios, recomendados: viewRecomendados, pacotes: viewPacotes, anuncios: viewAnuncios, avancado: viewAvancado };
    const root = $('#adm');
    root.innerHTML =
      '<div class="page-head" style="margin-bottom:0"><div><span class="eyebrow">' + esc(session.owner + '/' + session.repo) + ' · ' + esc(session.branch) + '</span><h1>Painel do Administrador</h1></div></div>' +
      '<nav class="adm-tabs">' + TABS.map((t) => '<button class="chip' + (tab === t[0] ? ' sel' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</nav>' +
      '<div id="adm-view">' + views[tab]() + '</div>';
    $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderApp(); }));
    $$('[data-go]', root).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.go; renderApp(); }));
    bindPaths(root);
    bindList(root, 'patrocinios', { titulo: '', url: '', desc: '', valor: 99, ate: '', onde: ['home'] });
    bindList(root, 'recomendados', { titulo: '', url: '', preco: '', tag: '', desc: '' });
    bindList(root, 'dicasPatrocinadas', { data: today(), texto: '', url: '' });
    bindList(root, 'pacotes', { nome: '', preco: '', ideal: '', desc: '' });
    drawPix(root);
    const dl = $('#adm-download', root);
    if (dl) dl.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([serialize(cfg)], { type: 'application/javascript' }));
      a.download = 'config.js'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  $('#adm-save').addEventListener('click', save);
  $('#adm-logout').addEventListener('click', () => {
    if (dirty && !confirm('Há alterações não publicadas. Sair mesmo assim?')) return;
    sessionStorage.removeItem(SS); session = null; cfg = null; setDirty(false); renderLogin();
  });

  (async function init() {
    if (!session) return renderLogin();
    try { await loadRemote(); renderApp(); }
    catch (e) { sessionStorage.removeItem(SS); session = null; renderLogin('Sessão expirada. Entre novamente.'); }
  })();
})();
