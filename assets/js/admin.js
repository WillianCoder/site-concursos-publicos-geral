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
  const AGENDA_PATH = 'data/agenda.js';
  const SS = 'atlas:admin';
  const LOCAL = window.ATLAS_CONFIG || {};
  const DATA = window.ATLAS_DATA || { categorias: [], estados: [] };
  const RADAR = window.ATLAS_RADAR || { items: [] };
  const MARCAS = window.ATLAS_MARCAS || [{ id: 'atlas', nome: 'Atlas Concursos', p1: 'Atlas', p2: 'Concursos', desc: '' }];

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
  let agenda = { atualizadoEm: '', itens: [] }, agendaSha = null, dirtyAgenda = false;

  // which: 'config' (padrão) ou 'agenda' — cada arquivo é publicado separadamente.
  function setDirty(v, which) {
    if (which === 'agenda') dirtyAgenda = v; else if (which === 'all') { dirty = v; dirtyAgenda = v; } else dirty = v;
    $('#adm-dirty').hidden = !(dirty || dirtyAgenda);
  }
  window.addEventListener('beforeunload', (e) => { if (dirty || dirtyAgenda) { e.preventDefault(); e.returnValue = ''; } });

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

  function parseConfig(text, name) {
    const start = text.indexOf('{', text.indexOf(name || 'window.ATLAS_CONFIG'));
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
    if (typeof c.adminEmail !== 'string') c.adminEmail = '';
    c.servicos = c.servicos || {};
    c.servicos.diario = Object.assign({ ativo: true, preco: 15, prazo: 'em até 2 dias úteis' }, c.servicos.diario || {});
    c.servicos.acompanhamento = Object.assign({ ativo: false, preco: 39, semanas: 4 }, c.servicos.acompanhamento || {});
    if (typeof c.marca !== 'string') c.marca = 'atlas';
    c.limites = Object.assign({ lembretes: 3, pedidosAbertos: 2, pedidosDia: 3 }, c.limites || {});
    delete c.limites.buscasDia; delete c.limites.buscasDiaConta;   // a busca grátis virou ferramenta da equipe
    c.mostrarAnuncie = c.mostrarAnuncie === true;
    return c;
  }

  function serializeAgenda(a) {
    return '/* Agenda de Inscrições do Atlas Concursos — editada pelo Painel do Administrador (aba "Agenda").\n   O conteúdo entre as chaves precisa ser JSON válido. */\nwindow.ATLAS_AGENDA = ' + JSON.stringify(a, null, 1) + ';\n';
  }
  async function loadAgenda() {
    try {
      const f = await gh('/repos/' + session.owner + '/' + session.repo + '/contents/' + AGENDA_PATH + '?ref=' + encodeURIComponent(session.branch));
      agendaSha = f.sha;
      agenda = parseConfig(b64decode(f.content), 'window.ATLAS_AGENDA');
    } catch (e) {
      if (e.status !== 404) throw e;
      agendaSha = null; agenda = { atualizadoEm: '', itens: [] };
    }
    if (!Array.isArray(agenda.itens)) agenda.itens = [];
  }

  async function loadRemote() {
    await loadAgenda();
    const f = await gh('/repos/' + session.owner + '/' + session.repo + '/contents/' + PATH + '?ref=' + encodeURIComponent(session.branch));
    sha = f.sha;
    try { cfg = normalize(parseConfig(b64decode(f.content))); }
    catch (e) {
      if (!confirm('O config.js do repositório está num formato antigo. Carregar as configurações desta página e substituí-lo ao salvar?')) throw e;
      cfg = normalize(clone(LOCAL));
      setDirty(true);
    }
  }

  // Modo demonstração: abre o painel com as configurações atuais do site, sem token e sem publicar nada.
  function startDemo() {
    const [owner, repo] = (repoFromConfig() || 'WillianCoder/site-concursos-publicos-geral').split('/');
    session = { demo: true, owner, repo, branch: 'main' };
    cfg = normalize(clone(LOCAL));
    agenda = clone(window.ATLAS_AGENDA || { atualizadoEm: '', itens: [] });
    if (!Array.isArray(agenda.itens)) agenda.itens = [];
    renderApp();
  }

  async function save() {
    if (session && session.demo) {
      toast('Modo demonstração: nada é publicado. No site oficial, entre com o token para salvar.');
      return;
    }
    const errs = validate();
    if (errs.length) { alert('Corrija antes de publicar:\n\n• ' + errs.join('\n• ')); return; }
    const btn = $('#adm-save');
    btn.disabled = true; btn.textContent = 'Publicando…';
    try {
      if (dirty) {
        const r = await gh('/repos/' + session.owner + '/' + session.repo + '/contents/' + PATH, {
          method: 'PUT',
          body: { message: 'Painel: atualiza as configurações do site', content: b64encode(serialize(cfg)), sha, branch: session.branch }
        });
        sha = r.content.sha;
        setDirty(false);
      }
      if (dirtyAgenda) {
        agenda.atualizadoEm = today();
        const body = { message: 'Painel: atualiza a Agenda de Inscrições', content: b64encode(serializeAgenda(agenda)), branch: session.branch };
        if (agendaSha) body.sha = agendaSha;
        const r = await gh('/repos/' + session.owner + '/' + session.repo + '/contents/' + AGENDA_PATH, { method: 'PUT', body });
        agendaSha = r.content.sha;
        setDirty(false, 'agenda');
      }
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
    agenda.itens.forEach((x, i) => {
      const nome = 'Agenda "' + (x.orgao || i + 1) + '"';
      if (!x.orgao) e.push('Agenda ' + (i + 1) + ': falta o órgão');
      chk(x.edital, nome + ' (edital)'); chk(x.site, nome + ' (site)'); chk(x.linkBanca, nome + ' (página na banca)'); chk(x.areaCandidato, nome + ' (área do candidato)');
      if (!x.inscFim && !x.prova) e.push(nome + ': informe o fim das inscrições ou a data da prova');
      if (x.inscInicio && x.inscFim && x.inscInicio > x.inscFim) e.push(nome + ': o início das inscrições está depois do fim');
    });
    if (cfg.contato.whatsapp && !/^\d{12,13}$/.test(cfg.contato.whatsapp)) e.push('WhatsApp: use só números com DDI e DDD, ex.: 5511999999999');
    if (!(Number(cfg.servicos.diario.preco) > 0)) e.push('Pesquisa no Diário: informe o preço (ex.: 15)');
    if (cfg.servicos.acompanhamento.ativo && !(Number(cfg.servicos.acompanhamento.preco) > 0 && Number(cfg.servicos.acompanhamento.semanas) >= 1)) e.push('Acompanhamento: informe o preço e o número de semanas');
    Object.keys(cfg.limites).forEach((k) => { const v = cfg.limites[k]; if (!(Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000)) e.push('Limites: use números inteiros de 0 a 1000 (0 = sem limite)'); });
    if (!MARCAS.some((m) => m.id === cfg.marca)) e.push('Marca: escolha uma das marcas da aba "Marca e logo"');
    if (cfg.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.adminEmail)) e.push('E-mail do administrador inválido');
    cfg.patrocinios.forEach((p) => { if (p.inicio && p.ate && p.inicio > p.ate) e.push('Patrocínio "' + (p.titulo || '?') + '": o início está depois do fim'); });
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
        '<button class="btn" type="button" id="adm-demo">Ver o painel em modo demonstração</button>' +
        '<details><summary style="cursor:pointer;font-weight:600">Como criar o token (2 minutos, uma vez a cada 90 dias)</summary>' +
          '<ol style="margin-top:10px">' +
            '<li>Abra <a class="grad-text" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.</li>' +
            '<li>Nome: <code>Painel Atlas</code>. Validade: <b>90 dias</b>.</li>' +
            '<li>Repository access: <b>Only select repositories</b> → escolha este repositório.</li>' +
            '<li>Permissions → Repository → <b>Contents: Read and write</b> e <b>Actions: Read and write</b> (para o botão "Atualizar o Radar"). Nada mais.</li>' +
            '<li>Gere, copie e cole aqui. Não envie o token para ninguém.</li>' +
          '</ol></details>' +
        '<p class="adm-help">O token fica só nesta aba do navegador e some ao fechá-la. Ative a verificação em duas etapas (2FA) na sua conta do GitHub.</p>' +
      '</form>';
    $('#adm-demo').addEventListener('click', startDemo);
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
        try { localStorage.setItem('atlas:equipe', '1'); } catch (e) {}   // libera a "Busca da equipe" no site neste aparelho
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
    else if (f.type === 'select') input = '<select class="select"' + attrs + '>' + f.options.map((o) => '<option value="' + esc(o[0]) + '"' + ((val || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
    else if (f.type === 'multi') input = '<select class="select" multiple' + attrs + '>' + PLACES.map((p) => '<option value="' + p[0] + '"' + ((val || []).includes(p[0]) ? ' selected' : '') + '>' + esc(p[1]) + '</option>').join('') + '</select>';
    else input = '<input class="input" type="' + (f.type || 'text') + '"' + attrs + ' value="' + esc(val) + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + (f.type === 'number' ? ' min="0" step="1"' : '') + '>';
    return '<label class="field' + (f.full ? ' full' : '') + '">' + esc(f.label) + input + (f.help ? '<span class="adm-help">' + f.help + '</span>' : '') + '</label>';
  }

  function listEditor(key, schema, opts) {
    const list = (opts.src || cfg)[key];
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

  function bindList(root, key, blank, src, which, afterEdit) {
    const box = $('[data-list="' + key + '"]', root);
    if (!box) return;
    const obj = src || cfg;
    const onEdit = (e) => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const it = obj[key][+el.dataset.i];
      const k = el.dataset.k;
      if (el.multiple) it[k] = Array.from(el.selectedOptions).map((o) => o.value);
      else if (el.type === 'number') it[k] = el.value === '' ? '' : Number(el.value);
      else it[k] = el.value;
      if (afterEdit) afterEdit(it, k, +el.dataset.i, box);
      setDirty(true, which);
    };
    box.addEventListener('input', onEdit);
    box.addEventListener('change', onEdit);
    box.addEventListener('click', (e) => {
      const add = e.target.closest('[data-add]');
      const del = e.target.closest('[data-del]');
      const up = e.target.closest('[data-up]');
      if (add) { const n = clone(blank); if ('id' in n) n.id = Date.now().toString(36); obj[key].unshift(n); setDirty(true, which); renderApp(); }
      else if (del && confirm('Remover este item?')) { obj[key].splice(+del.dataset.del, 1); setDirty(true, which); renderApp(); }
      else if (up && +up.dataset.up > 0) { const i = +up.dataset.up; [obj[key][i - 1], obj[key][i]] = [obj[key][i], obj[key][i - 1]]; setDirty(true, which); renderApp(); }
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
        if (el.dataset.kind === 'number') v = Number(String(v).replace(',', '.')) || 0;
        if (el.dataset.kind === 'bool') v = el.checked;
        if (el.dataset.kind === 'json') {
          if (!v.trim()) v = null;
          else { try { v = JSON.parse(v); el.style.borderColor = ''; } catch (e) { el.style.borderColor = 'var(--danger)'; return; } }
        }
        o[parts[parts.length - 1]] = v;
        setDirty(true);
        if (el.dataset.path.startsWith('pix.')) drawPix(root);
      };
      el.addEventListener('input', handler);
      if (el.type === 'checkbox') el.addEventListener('change', handler);
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
  const TABS = [['geral', 'Visão geral'], ['pedidos', 'Pedidos'], ['lembretes', 'Lembretes de hoje'], ['usuarios', 'Usuários'], ['agenda', 'Concursos abertos'], ['pix', 'Pix, serviços e contato'], ['limites', 'Limites de uso'], ['patrocinios', 'Patrocínios'], ['teste', 'Testar anúncios'], ['recomendados', 'Afiliados e dicas'], ['pacotes', 'Preços (Anuncie)'], ['anuncios', 'AdSense e Pro'], ['marca', 'Marca e logo'], ['avancado', 'Avançado']];

  function viewGeral() {
    const ativos = cfg.patrocinios.filter((p) => (!p.inicio || p.inicio <= today()) && (!p.ate || p.ate >= today()));
    const receita = ativos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const vencendo = ativos.filter((p) => p.ate && (new Date(p.ate) - new Date(today())) / 86400000 <= 7);
    const radarRecent = (RADAR.items || []).filter((x) => (new Date(today()) - new Date(x.d)) / 86400000 <= 7).length;
    const check = (ok, txt, goTab) => '<div class="row"><span class="badge ' + (ok ? 'ok' : 'warn') + '">' + (ok ? '✓' : '!') + '</span><div class="grow"><div class="title" style="white-space:normal">' + txt + '</div></div>' + (goTab ? '<button class="btn btn-sm" data-go="' + goTab + '">Configurar</button>' : '') + '</div>';
    const site = cfg.siteUrl || new URL('./', location.href).href;
    const link = (href, t, d) => '<a class="tile" href="' + esc(href) + '" target="_blank" rel="noopener"><h3>' + esc(t) + '</h3><p>' + esc(d) + '</p></a>';
    return '<div class="kpis">' +
        '<div class="kpi"><b>' + brl(receita) + '</b><span>em patrocínios no ar agora</span></div>' +
        '<div class="kpi"><b>' + ativos.length + '</b><span>patrocínios ativos</span></div>' +
        '<div class="kpi"><b style="color:' + (vencendo.length ? 'var(--warn)' : 'inherit') + '">' + vencendo.length + '</b><span>vencem em 7 dias</span></div>' +
        '<div class="kpi"><b>' + cfg.recomendados.length + '</b><span>links de afiliado</span></div>' +
        '<div class="kpi"><b>' + radarRecent + '</b><span>novidades no Radar (7 dias)</span></div>' +
        '<div class="kpi"><b>' + agenda.itens.filter((x) => x.inscFim && x.inscFim >= today()).length + '</b><span>inscrições abertas na agenda</span></div>' +
      '</div>' +
      (vencendo.length ? '<div class="panel panel-pad section"><b>Renove com o cliente:</b> ' + vencendo.map((p) => esc(p.titulo) + ' (até ' + esc(p.ate) + ')').join(', ') + '</div>' : '') +
      '<section class="section panel panel-pad adm-section"><div class="section-head" style="margin:0"><h2 style="font-size:17px">Radar de Editais</h2>' +
        '<button class="btn btn-primary btn-sm" id="adm-radar">Atualizar o Radar agora</button></div>' +
        '<p class="adm-help">O robô visita os sites oficiais todo dia às 7h. Use o botão para rodar agora: em cerca de 5 minutos as inscrições abertas encontradas aparecem no site.' +
        (RADAR.updatedAt ? ' Última varredura: <b>' + esc(new Date(RADAR.updatedAt).toLocaleString('pt-BR')) + '</b> · ' + (RADAR.abertas || []).length + ' inscrições abertas encontradas.' : ' Ainda não houve varredura.') + '</p></section>' +
      '<section class="section"><div class="section-head"><h2>Checklist para começar a faturar</h2></div><div class="list">' +
        check(agenda.itens.length >= 5, 'Agenda de Inscrições com pelo menos 5 concursos (ela traz visitas todo dia)', 'agenda') +
        check(cfg.pix.chave && cfg.pix.nome && cfg.pix.cidade, 'Pix configurado — QR Code nos pedidos e página <b>Apoie o Atlas</b> no ar', 'pix') +
        check(hasFirebase() && cfg.adminEmail, 'Contas ativadas (Firebase) e e-mail do administrador — libera Pedidos, Usuários e Lembretes', 'avancado') +
        check(cfg.contato.whatsapp, 'WhatsApp do negócio — recebe pedidos, comprovantes e pedidos de lembrete', 'pix') +
        check(cfg.recomendados.length, 'Pelo menos um link de afiliado (Amazon, Hotmart, Kiwify)', 'recomendados') +
        check(ativos.length, 'Primeiro patrocinador fechado (dica: ofereça o Destaque no estado aos cursinhos da sua cidade)', 'patrocinios') +
        check(cfg.siteUrl, 'Domínio próprio configurado (necessário para o AdSense)', 'avancado') +
        check(cfg.ads.client, 'Google AdSense aprovado e configurado', 'anuncios') +
      '</div></section>' +
      '<section class="section"><div class="section-head"><h2>Atalhos</h2></div><div class="adm-links">' +
        link(site, 'Ver o site', 'Abre o site publicado') +
        link(new URL('./', location.href).href + '#/equipe/busca', 'Busca da equipe', 'Monta as buscas de um pedido (só aparece para você)') +
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
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Serviço: Pesquisa no Diário Oficial</h2>' +
        '<label class="opt-check"><input type="checkbox" data-path="servicos.diario.ativo" data-kind="bool"' + (cfg.servicos.diario.ativo !== false ? ' checked' : '') + '> Serviço ativo (aparece no site e na página inicial do celular)</label>' +
        '<div class="adm-grid">' +
          pathInput('Preço (R$)', 'servicos.diario.preco', String(cfg.servicos.diario.preco), { kind: 'number', ph: '15' }) +
          pathInput('Prazo de entrega', 'servicos.diario.prazo', cfg.servicos.diario.prazo, { ph: 'em até 2 dias úteis' }) +
        '</div><p class="adm-help">O cliente paga pelo Pix configurado acima (com o código do pedido) e envia o comprovante para o WhatsApp abaixo. Os pedidos aparecem na aba <b>Pedidos</b>.</p>' +
        '<h3 style="font-size:15px;margin-top:6px">Plano extra: Acompanhamento</h3>' +
        '<label class="opt-check"><input type="checkbox" data-path="servicos.acompanhamento.ativo" data-kind="bool"' + (cfg.servicos.acompanhamento.ativo ? ' checked' : '') + '> Oferecer também o acompanhamento semanal (o cliente escolhe o plano no pedido)</label>' +
        '<div class="adm-grid">' +
          pathInput('Preço do acompanhamento (R$)', 'servicos.acompanhamento.preco', String(cfg.servicos.acompanhamento.preco), { kind: 'number', ph: '39' }) +
          pathInput('Quantas semanas', 'servicos.acompanhamento.semanas', String(cfg.servicos.acompanhamento.semanas), { kind: 'number', ph: '4' }) +
        '</div><p class="adm-help">Você confere o Diário do cliente uma vez por semana e avisa no WhatsApp quando o nome sair. Bom para quem espera convocação.</p></div>' +
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">WhatsApp e contato (pedidos, lembretes e "Anuncie")</h2><div class="adm-grid">' +
        pathInput('WhatsApp', 'contato.whatsapp', cfg.contato.whatsapp, { kind: 'digits', ph: '5511999999999', help: 'Só números: 55 + DDD + número. Recebe os comprovantes dos pedidos e os contatos de anunciantes.' }) +
        pathInput('E-mail', 'contato.email', cfg.contato.email, { ph: 'contato@seudominio.com.br' }) +
      '</div><p class="adm-help">O e-mail também recebe os avisos de link quebrado quando o repositório estiver privado.</p></div>' +
    '</div>';
  }

  const PERIODOS = [['diario', 'Diário (1 dia)'], ['semanal', 'Semanal (7 dias)'], ['quinzenal', 'Quinzenal (15 dias)'], ['mensal', 'Mensal (1 mês)'], ['personalizado', 'Personalizado']];
  const POSICOES = [['topo', 'No topo da página'], ['meio', 'No meio do conteúdo'], ['fim', 'No fim da página']];
  const SPONSOR = [
    { k: 'titulo', label: 'Título', ph: 'Cursinho Exemplo — PM-MG' },
    { k: 'url', label: 'Link (https://…)', type: 'url', ph: 'https://' },
    { k: 'valor', label: 'Valor cobrado (R$)', type: 'number', help: 'Só para o seu controle; não aparece no site.' },
    { k: 'periodo', label: 'Período contratado', type: 'select', options: PERIODOS },
    { k: 'inicio', label: 'Começa em', type: 'date', help: 'O card só aparece a partir deste dia.' },
    { k: 'ate', label: 'Termina em', type: 'date', help: 'Calculado pelo período. Depois desta data o card some sozinho.' },
    { k: 'posicao', label: 'Posição na página', type: 'select', options: POSICOES },
    { k: 'desc', label: 'Texto do card', type: 'textarea', full: true },
    { k: 'onde', label: 'Em quais páginas aparece (Ctrl/⌘ para escolher várias)', type: 'multi', full: true }
  ];
  // Data final pelo período: diário = o próprio dia; semanal = 7 dias; mensal = até a véspera do mesmo dia do mês seguinte.
  function endDate(inicio, periodo) {
    if (!inicio || !periodo || periodo === 'personalizado') return '';
    const d = new Date(inicio + 'T12:00:00');
    if (periodo === 'mensal') { d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); }
    else d.setDate(d.getDate() + ({ diario: 0, semanal: 6, quinzenal: 14 }[periodo] || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function sponsorEdited(it, k, i, box) {
    if (k === 'inicio' || k === 'periodo') {
      const fim = endDate(it.inicio, it.periodo);
      if (fim) { it.ate = fim; const el = $('[data-i="' + i + '"][data-k="ate"]', box); if (el) el.value = fim; }
    }
    if (k === 'ate' && it.periodo && it.periodo !== 'personalizado' && it.ate !== endDate(it.inicio, it.periodo)) {
      it.periodo = 'personalizado'; const el = $('[data-i="' + i + '"][data-k="periodo"]', box); if (el) el.value = 'personalizado';
    }
  }
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

  const AREAS = [['seguranca', 'Segurança'], ['tribunais', 'Tribunais e MP'], ['fiscal', 'Fiscal e controle'], ['administrativa', 'Administrativa'], ['bancaria', 'Bancos e estatais'], ['saude-educacao', 'Saúde e educação'], ['ti', 'Tecnologia'], ['militar', 'Forças Armadas']];
  const AGENDA = [
    { k: 'orgao', label: 'Órgão', ph: 'Polícia Militar de Minas Gerais' },
    { k: 'cargo', label: 'Cargo', ph: 'Soldado' },
    { k: 'uf', label: 'Estado', type: 'select', options: [['', 'Nacional / federal']].concat(DATA.estados.map((e) => [e.uf, e.nome])) },
    { k: 'area', label: 'Área', type: 'select', options: AREAS },
    { k: 'banca', label: 'Banca', ph: 'Instituto AOCP' },
    { k: 'vagas', label: 'Vagas', type: 'number' },
    { k: 'salario', label: 'Salário (até)', ph: 'R$ 5.000' },
    { k: 'inscInicio', label: 'Inscrições: início', type: 'date' },
    { k: 'inscFim', label: 'Inscrições: fim', type: 'date' },
    { k: 'prova', label: 'Data da prova', type: 'date' },
    { k: 'edital', label: 'Link do edital', type: 'url', ph: 'https://' },
    { k: 'site', label: 'Site oficial do concurso', type: 'url', ph: 'https://' },
    { k: 'areaCandidato', label: 'Área do candidato (login da inscrição)', type: 'url', ph: 'https://', help: 'Onde o candidato faz login, gera boleto e imprime o cartão de confirmação.' },
    { k: 'linkBanca', label: 'Página do concurso na banca (convocações)', type: 'url', ph: 'https://', help: 'Onde a banca chama os candidatos. Vazio = o site procura sozinho no site da banca.' },
    { k: 'obs', label: 'Observação (opcional)', type: 'textarea', full: true }
  ];
  const BLANK_AGENDA = { id: '', orgao: '', cargo: '', uf: '', area: 'seguranca', banca: '', vagas: '', salario: '', inscInicio: '', inscFim: '', prova: '', edital: '', site: '', areaCandidato: '', linkBanca: '', obs: '' };
  function agendaStatus(x) {
    const t = today();
    if (x.inscInicio && x.inscInicio > t) return '<span class="badge accent">abre ' + esc(x.inscInicio) + '</span>';
    if (x.inscFim && x.inscFim >= t) return '<span class="badge ok">aberta</span>';
    if (x.prova && x.prova >= t) return '<span class="badge accent">prova ' + esc(x.prova) + '</span>';
    return '<span class="badge">encerrada</span>';
  }
  function viewAgenda() {
    const known = new Set(agenda.itens.map((x) => x.edital));
    const sug = (RADAR.items || []).filter((x) => !known.has(x.u)).slice(0, 8);
    return '<p class="adm-help">Cadastre os concursos com as datas do edital oficial. No Radar de Editais aparecem <b>só os que estão com inscrição aberta hoje</b>; quando a inscrição encerra, o concurso some sozinho do site. Os itens mais novos ficam no topo.</p>' +
      (sug.length ? '<section class="panel panel-pad adm-section"><h2 style="font-size:16px">Sugestões do Radar de Editais</h2><p class="adm-help">Links novos encontrados nos sites oficiais. Confira o edital e cadastre com um clique.</p><div class="list">' +
        sug.map((x, i) => '<div class="row"><div class="grow"><div class="title" style="white-space:normal">' + esc(x.t) + '</div><div class="sub">' + esc(x.n) + ' · ' + esc(x.d) + '</div></div>' +
          '<a class="icon-btn" href="' + esc(x.u) + '" target="_blank" rel="noopener" title="Abrir">↗</a><button class="btn btn-sm" data-sug="' + i + '">Cadastrar</button></div>').join('') + '</div></section>' : '') +
      listEditor('itens', AGENDA, { src: agenda, title: 'orgao', empty: 'Novo concurso', none: 'Nenhum concurso na agenda ainda.', add: 'Adicionar concurso', status: agendaStatus });
  }

  function sponsorStatus(p) {
    if (p.inicio && p.inicio > today()) return '<span class="badge accent">agendado · começa ' + esc(p.inicio) + '</span>';
    if (p.ate && p.ate < today()) return '<span class="badge">expirado</span>';
    if (p.ate && (new Date(p.ate) - new Date(today())) / 86400000 <= 7) return '<span class="badge warn">vence ' + esc(p.ate) + '</span>';
    return '<span class="badge ok">ativo</span>';
  }

  function viewPatrocinios() {
    return '<p class="adm-help">Cada patrocínio vira um card com a etiqueta <b>Patrocinado</b> nas páginas escolhidas. Escolha o período (diário, semanal ou mensal) e a data de início: a data final é calculada sozinha e o card some quando o período acaba. Veja como fica antes de publicar na aba <a href="#" data-go="teste" class="grad-text">Testar anúncios</a>.</p>' +
      listEditor('patrocinios', SPONSOR, { title: 'titulo', empty: 'Novo patrocínio', none: 'Nenhum patrocínio ainda. Que tal oferecer o "Destaque no estado" a um cursinho da sua cidade?', add: 'Adicionar patrocínio', status: sponsorStatus });
  }
  function viewRecomendados() {
    return '<h2 style="font-size:18px">Recomendados (links de afiliado)</h2><p class="adm-help">Aparecem na página inicial e em Ferramentas, sempre com o aviso de link de afiliado.</p>' +
      listEditor('recomendados', REC, { title: 'titulo', empty: 'Novo produto', none: 'Nenhum produto. Cadastre-se na Amazon Associados, Hotmart ou Kiwify e cole os links aqui.', add: 'Adicionar produto' }) +
      '<h2 style="font-size:18px;margin-top:26px">Dicas patrocinadas</h2><p class="adm-help">Substituem a "Dica do dia" da página inicial no dia escolhido (pacote de R$ 29/dia).</p>' +
      listEditor('dicasPatrocinadas', TIP, { title: 'data', empty: 'Nova dica', none: 'Nenhuma dica patrocinada agendada.', add: 'Agendar dica' });
  }
  function viewPacotes() {
    return '<div class="panel panel-pad adm-section" style="margin-bottom:16px"><h2 style="font-size:18px">Página "Anuncie" e imagem dos planos</h2>' +
        '<label class="opt-check"><input type="checkbox" data-path="mostrarAnuncie" data-kind="bool"' + (cfg.mostrarAnuncie ? ' checked' : '') + '> Mostrar a página "Anuncie" no site (menu, rodapé e "Anuncie aqui")</label>' +
        '<p class="adm-help">Desligada, ela some do site, mas o endereço direto continua funcionando: <a class="grad-text" href="' + esc(new URL('./', location.href).href + '#/anuncie') + '" target="_blank" rel="noopener">abrir a página Anuncie</a>. Quando uma empresa chamar, mande a imagem dos planos ou esse link.</p>' +
        '<div class="btn-row"><button class="btn btn-primary" type="button" id="pk-img">Baixar imagem dos planos (PNG)</button></div></div>' +
      '<p class="adm-help">Tabela de preços da página "Anuncie" e da imagem dos planos. Aumente os valores conforme as visitas crescerem.</p>' +
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
      '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Contas de usuário (Firebase)</h2>' +
        pathInput('Configuração do app web (JSON)', 'firebase', cfg.firebase ? JSON.stringify(cfg.firebase, null, 2) : '', { textarea: true, kind: 'json', full: true, help: 'Cole o objeto firebaseConfig (apiKey, authDomain, projectId, appId). Vazio = contas desligadas.' }) +
        pathInput('E-mail do administrador', 'adminEmail', cfg.adminEmail, { ph: 'contato@seudominio.com.br', help: 'A conta do site com este e-mail (confirmado) pode ver usuários, pedidos e lembretes aqui no Painel.' }) +
      '</div></div>' +
      firebaseGuide() +
      '<div class="panel panel-pad section adm-section"><h2 style="font-size:18px">Cópia de segurança</h2><p class="adm-help">Baixe o arquivo de configuração atual (inclui alterações ainda não publicadas).</p><div><button class="btn" id="adm-download">Baixar config.js</button></div></div>';
  }

  /* ---------- Testar anúncios ---------- */
  const PREVIEW_KEY = 'atlas:preview-ad';
  const EXEMPLO = { titulo: 'Cursinho Exemplo — PM-SP', url: 'https://www.exemplo.com.br', desc: 'Turma nova para Soldado PM-SP com aulas ao vivo e simulados toda semana. 20% de desconto para quem vem do Atlas.', posicao: 'topo', onde: ['home'] };
  const test = { sel: 'exemplo', page: 'home', device: 'celular' };
  const placeName = (k) => (PLACES.find((p) => p[0] === k) || [k, k])[1];
  const routeOf = (k) => k === 'home' ? '#/' : k.startsWith('c:') ? '#/c/' + k.slice(2) : k.startsWith('uf:') ? '#/uf/' + k.slice(3) : '#/' + k;
  const testAd = () => (test.sel === 'exemplo' ? EXEMPLO : cfg.patrocinios[+test.sel]) || EXEMPLO;

  function adCard(ad) {
    const ini = String(ad.titulo || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    let host = ''; try { host = new URL(ad.url).hostname.replace(/^www\./, ''); } catch (e) {}
    return '<article class="card sponsor sponsor-preview"><div class="card-top"><span class="mono">' + esc(ini) + '</span>' +
      '<div class="card-title"><h3>' + esc(ad.titulo || 'Sem título') + '</h3><span class="domain">' + esc(host) + '</span></div><span class="tag">Patrocinado</span></div>' +
      (ad.desc ? '<p class="desc">' + esc(ad.desc) + '</p>' : '') +
      '<div class="card-actions"><span class="btn btn-primary btn-sm">Conhecer ↗</span></div></article>';
  }
  function mockPage(ad, page, pos) {
    const block = (h, t) => '<div class="mock-block" style="height:' + h + 'px">' + (t ? '<span>' + esc(t) + '</span>' : '') + '</div>';
    const sponsor = '<div class="mock-sponsor"><div class="mock-label">Parceiros</div>' + adCard(ad) + '</div>';
    const head = page === 'home'
      ? '<div class="mock-hero"><b>Todos os sites de concursos públicos do Brasil</b><div class="mock-search">Buscar…</div></div>' + (test.device === 'celular' ? '<div class="mock-svcs">' + ['Inscrições abertas', 'Meu nome no Diário', 'Próxima prova', 'Sites por estado', 'Estudo de hoje', 'Links salvos'].map((t) => '<span>' + t + '</span>').join('') + '</div>' : block(70, 'Painéis: próxima prova, estudo, revisões'))
      : '<div class="mock-hero"><b>' + esc(placeName(page).replace(/^(Categoria|Estado): /, '')) + '</b><span>Título e descrição da página</span></div>';
    const body = [block(120, 'Conteúdo da página'), block(120, 'Mais conteúdo'), block(90, 'Sites e cards')];
    if (pos === 'meio') body.splice(1, 0, sponsor);
    return '<div class="mock-top"><span class="mock-dot"></span><span>Atlas Concursos</span></div>' +
      head + (pos === 'topo' || !pos ? sponsor : '') + body.join('') + (pos === 'fim' ? sponsor : '') + block(40, 'Rodapé');
  }
  function viewTeste() {
    const ad = testAd();
    const pages = (ad.onde && ad.onde.length ? ad.onde : ['home']);
    if (!PLACES.some((p) => p[0] === test.page)) test.page = 'home';
    const editable = test.sel !== 'exemplo';
    return '<p class="adm-help">Veja como o anúncio fica no celular e no computador antes de publicar. Mude a posição e as páginas aqui mesmo; as mudanças valem para o patrocínio e só vão ao ar quando você tocar em <b>Salvar e publicar</b>.</p>' +
      '<div class="test-layout">' +
        '<div class="panel panel-pad adm-section">' +
          '<label class="field">Anúncio<select class="select" id="t-sel"><option value="exemplo"' + (test.sel === 'exemplo' ? ' selected' : '') + '>Exemplo de anúncio</option>' +
            cfg.patrocinios.map((p, i) => '<option value="' + i + '"' + (String(i) === test.sel ? ' selected' : '') + '>' + esc(p.titulo || 'Patrocínio ' + (i + 1)) + '</option>').join('') + '</select></label>' +
          '<label class="field">Posição na página<select class="select" id="t-pos">' + POSICOES.map((o) => '<option value="' + o[0] + '"' + ((ad.posicao || 'topo') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' +
          '<label class="field">Página para ver<select class="select" id="t-page">' + PLACES.map((p) => '<option value="' + p[0] + '"' + (test.page === p[0] ? ' selected' : '') + '>' + esc(p[1]) + (pages.includes(p[0]) ? ' ✓' : '') + '</option>').join('') + '</select></label>' +
          (pages.includes(test.page)
            ? '<p class="adm-help">✓ Este anúncio aparece nesta página. ' + (editable && pages.length > 1 ? '<button class="btn btn-sm" id="t-off" type="button">Tirar desta página</button>' : '') + '</p>'
            : '<p class="adm-help">Este anúncio ainda não aparece nesta página. <button class="btn btn-sm" id="t-on" type="button">Mostrar também aqui</button></p>') +
          '<div class="field"><span>Aparelho</span><div class="subs">' + [['celular', 'Celular'], ['computador', 'Computador']].map((d) => '<button class="chip' + (test.device === d[0] ? ' sel' : '') + '" data-dev="' + d[0] + '" type="button">' + d[1] + '</button>').join('') + '</div></div>' +
          '<button class="btn btn-primary" id="t-open" type="button">Ver no site de verdade ↗</button>' +
          '<p class="adm-help">Abre o site com este anúncio em prévia por 30 minutos. Só você vê: os visitantes não são afetados.</p>' +
          (ad.inicio || ad.ate ? '<p class="adm-help">Período: <b>' + esc(ad.inicio || '…') + '</b> até <b>' + esc(ad.ate || '…') + '</b>.</p>' : '') +
        '</div>' +
        '<div class="test-stage"><div class="mock mock-' + test.device + '">' + mockPage(ad, test.page, ad.posicao || 'topo') + '</div></div>' +
      '</div>';
  }
  function bindTeste(root) {
    const sel = $('#t-sel', root); if (!sel) return;
    const ad = testAd();
    sel.addEventListener('change', () => { test.sel = sel.value; const a = testAd(); test.page = (a.onde && a.onde[0]) || 'home'; renderApp(); });
    $('#t-page', root).addEventListener('change', (e) => { test.page = e.target.value; renderApp(); });
    $('#t-pos', root).addEventListener('change', (e) => { ad.posicao = e.target.value; if (test.sel !== 'exemplo') setDirty(true); renderApp(); });
    const on = $('#t-on', root);
    if (on) on.addEventListener('click', () => { ad.onde = (ad.onde || []).concat([test.page]); if (test.sel !== 'exemplo') setDirty(true); renderApp(); });
    const off = $('#t-off', root);
    if (off) off.addEventListener('click', () => { ad.onde = (ad.onde || []).filter((k) => k !== test.page); setDirty(true); renderApp(); });
    $$('[data-dev]', root).forEach((b) => b.addEventListener('click', () => { test.device = b.dataset.dev; renderApp(); }));
    $('#t-open', root).addEventListener('click', () => {
      try { localStorage.setItem(PREVIEW_KEY, JSON.stringify({ exp: Date.now() + 30 * 60000, ad: Object.assign({}, ad, { onde: [test.page], posicao: ad.posicao || 'topo' }) })); }
      catch (e) { toast('O navegador bloqueou a prévia (modo anônimo?).'); return; }
      window.open(new URL('./', location.href).href + routeOf(test.page), '_blank', 'noopener');
    });
  }

  /* ---------- Usuários, pedidos e lembretes (Firebase) ---------- */
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const FB = { ready: null, auth: null, db: null, a: null, f: null, user: null, cache: {} };
  const hasFirebase = () => !!(cfg.firebase && cfg.firebase.apiKey && cfg.firebase.projectId);
  function fbInit() {
    if (FB.ready) return FB.ready;
    FB.ready = (async () => {
      const [app, auth, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
      const inst = app.initializeApp(cfg.firebase, 'atlas-admin');
      FB.a = auth; FB.f = fs; FB.auth = auth.getAuth(inst); FB.db = fs.getFirestore(inst);
      await new Promise((res) => { let first = true; auth.onAuthStateChanged(FB.auth, (u) => { FB.user = u; if (first) { first = false; res(); } else if (CLOUD_TABS.includes(tab)) renderApp(); }); });
    })();
    return FB.ready;
  }
  const CLOUD_TABS = ['pedidos', 'lembretes', 'usuarios'];
  const isAdminUser = () => FB.user && cfg.adminEmail && FB.user.email && FB.user.email.toLowerCase() === cfg.adminEmail.toLowerCase();
  const waTo = (n, text) => 'https://wa.me/' + String(n || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  const fmtW = (d) => { const m = String(d || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : (d || ''); };
  const fmtD = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
  const addD = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  const DEMO = {
    usuarios: [
      { id: 'u1', nome: 'Maria Souza', email: 'maria@exemplo.com', whatsapp: '5511987654321', aceitaWhats: true, criadoEm: today() + 'T10:00:00Z' },
      { id: 'u2', nome: 'João Lima', email: 'joao@exemplo.com', whatsapp: '', aceitaWhats: false, criadoEm: addD(today(), -2) + 'T09:00:00Z' }
    ],
    pedidos: [
      { id: 'DK3F9QAB', codigo: 'DK3F9QAB', nome: 'Maria Souza', whatsapp: '5511987654321', uf: 'SP', concurso: 'PM-SP Soldado 2025', inscricao: '123456', rg: '12.345.678', desde: '6m', obs: 'Esperando a convocação do exame médico', valor: 15, status: 'aguardando', criadoEm: today() + 'T11:00:00Z' },
      { id: 'DK2A1ZXC', codigo: 'DK2A1ZXC', nome: 'João Lima', whatsapp: '5521912345678', uf: 'RJ', concurso: 'PMERJ Soldado', valor: 15, status: 'pago', criadoEm: addD(today(), -1) + 'T15:00:00Z', pagoEm: addD(today(), -1) + 'T16:00:00Z' },
      { id: 'DK1B7MNP', codigo: 'DK1B7MNP', nome: 'Ana Pereira', whatsapp: '5531998765432', uf: 'MG', concurso: 'PC-MG Investigador', inscricao: '778899', desde: '1a', plano: 'acompanhamento', valor: 39, status: 'pago', criadoEm: addD(today(), -9) + 'T10:00:00Z', pagoEm: addD(today(), -9) + 'T12:00:00Z', conferidoEm: addD(today(), -8), conferencias: 1 }
    ],
    lembretes: [
      { id: 'l1', nome: 'Maria Souza', whatsapp: '5511987654321', concurso: 'PM-SP Soldado 2025', prova: addD(today(), 7), avisos: ['p7', 'p1'], datas: { p7: today(), p1: addD(today(), 6) }, enviados: {} },
      { id: 'l2', nome: 'João Lima', whatsapp: '5521912345678', concurso: 'TJ-RJ Técnico', inscricao: addD(today(), 1), avisos: ['insc'], datas: { insc: today() }, enviados: {} }
    ]
  };

  async function fetchCol(name) {
    if (session.demo) return clone(DEMO[name]);
    const f = FB.f;
    const col = { usuarios: 'perfis', pedidos: 'pedidos', lembretes: 'lembretes' }[name];
    const q = name === 'lembretes'
      ? f.query(f.collection(FB.db, col), f.where('ativo', '==', true), f.limit(2000))
      : f.query(f.collection(FB.db, col), f.orderBy('criadoEm', 'desc'), f.limit(1000));
    const snap = await f.getDocs(q);
    return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  }
  async function updateDocAdm(col, id, data) {
    if (session.demo) return;
    await FB.f.updateDoc(FB.f.doc(FB.db, col, id), data);
  }

  function viewCloud() {
    if (!session.demo && !hasFirebase()) {
      return '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Ative as contas para ver ' + ({ pedidos: 'os pedidos', lembretes: 'os lembretes', usuarios: 'os usuários' }[tab]) + ' aqui</h2>' +
        '<p class="adm-help">Enquanto as contas (Firebase) não estão ativas, os pedidos e os pedidos de lembrete chegam direto no seu WhatsApp. Siga o passo a passo na aba <a href="#" class="grad-text" data-go="avancado">Avançado</a> (uns 15 minutos, grátis). Para ver como fica, use o modo demonstração na tela de entrada do Painel.</p></div>';
    }
    return '<div id="cloud-view"><div class="panel panel-pad"><p class="adm-help">Carregando…</p></div></div>';
  }

  function loginCloudHtml(msg) {
    return '<form class="panel panel-pad adm-section" id="fb-login" style="max-width:520px"><h2 style="font-size:18px">Entre com a sua conta do site</h2>' +
      '<p class="adm-help">Use o e-mail e a senha da conta de administrador (' + esc(cfg.adminEmail || 'configure o e-mail em Avançado') + '). É a mesma conta criada em "Entrar → Criar conta" no site, com o e-mail confirmado.</p>' +
      (msg ? '<p class="badge danger" style="white-space:normal">' + esc(msg) + '</p>' : '') +
      '<label class="field">E-mail<input class="input" name="email" type="email" required autocomplete="username"></label>' +
      '<label class="field">Senha<input class="input" name="senha" type="password" required autocomplete="current-password"></label>' +
      '<button class="btn btn-primary" type="submit">Entrar</button></form>';
  }

  async function loadCloudTab(root) {
    const box = $('#cloud-view', root); if (!box) return;
    const myTab = tab;
    try {
      if (!session.demo) {
        await fbInit();
        if (!FB.user) {
          box.innerHTML = loginCloudHtml();
          $('#fb-login', box).addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const d = Object.fromEntries(new FormData(ev.target));
            try { await FB.a.signInWithEmailAndPassword(FB.auth, d.email.trim(), d.senha); }
            catch (e) { box.innerHTML = loginCloudHtml('E-mail ou senha incorretos.'); loadCloudTab(root); }
          });
          return;
        }
        if (!isAdminUser()) {
          box.innerHTML = '<div class="panel panel-pad adm-section"><p class="badge warn" style="white-space:normal">Você entrou como ' + esc(FB.user.email) + ', mas o e-mail do administrador configurado é ' + esc(cfg.adminEmail || '(vazio)') + '.</p><p class="adm-help">Ajuste o e-mail em Avançado (e as regras do Firestore) ou entre com a conta certa.</p><div><button class="btn" id="fb-out">Sair desta conta</button></div></div>';
          $('#fb-out', box).addEventListener('click', () => FB.a.signOut(FB.auth));
          return;
        }
      }
      const list = await fetchCol(myTab);
      const pedidos = myTab === 'lembretes' ? await fetchCol('pedidos').catch(() => []) : null;
      if (tab !== myTab) return;
      FB.cache[myTab] = list;
      ({ usuarios: drawUsers, pedidos: drawOrders, lembretes: drawReminders })[myTab](box, list, pedidos);
    } catch (e) {
      console.error(e);
      box.innerHTML = '<div class="panel panel-pad"><p class="badge danger" style="white-space:normal">Não foi possível carregar: ' + esc(e.code === 'permission-denied' ? 'sem permissão. Confira se o e-mail do administrador está confirmado e se as regras do Firestore foram publicadas com ele (aba Avançado).' : e.message || e) + '</p></div>';
    }
  }

  function drawUsers(box, list) {
    let q = '';
    const draw = () => {
      const f = list.filter((u) => !q || (u.nome + ' ' + u.email + ' ' + u.whatsapp).toLowerCase().includes(q));
      $('#u-list', box).innerHTML = f.length ? f.map((u) =>
        '<div class="row"><div class="grow"><div class="title">' + esc(u.nome || '(sem nome)') + '</div><div class="sub">' + esc(u.email || '') + ' · desde ' + esc(fmtD(u.criadoEm)) + '</div></div>' +
          (u.aceitaWhats ? '<span class="badge ok">aceita lembretes</span>' : '') +
          (u.whatsapp ? '<a class="btn btn-sm" href="' + esc(waTo(u.whatsapp, 'Olá, ' + (u.nome || '').split(' ')[0] + '! Aqui é do Atlas Concursos.')) + '" target="_blank" rel="noopener">' + esc(fmtW(u.whatsapp)) + '</a>' : '<span class="badge">sem WhatsApp</span>') +
        '</div>').join('') : '<div class="empty">Nenhum usuário encontrado.</div>';
    };
    const comW = list.filter((u) => u.whatsapp).length;
    box.innerHTML = '<div class="kpis"><div class="kpi"><b>' + list.length + '</b><span>contas criadas</span></div><div class="kpi"><b>' + list.filter((u) => String(u.criadoEm).slice(0, 10) >= addD(today(), -7)).length + '</b><span>novas nos últimos 7 dias</span></div><div class="kpi"><b>' + comW + '</b><span>com WhatsApp</span></div><div class="kpi"><b>' + list.filter((u) => u.aceitaWhats).length + '</b><span>aceitam lembretes</span></div></div>' +
      '<div class="toolbar section"><input class="input" id="u-q" type="search" placeholder="Buscar por nome, e-mail ou WhatsApp…"><button class="btn" id="u-csv">Baixar planilha (CSV)</button></div><div class="list" id="u-list"></div>';
    $('#u-q', box).addEventListener('input', (e) => { q = e.target.value.toLowerCase(); draw(); });
    $('#u-csv', box).addEventListener('click', () => {
      const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const csv = ['Nome;E-mail;WhatsApp;Aceita lembretes;Criado em'].concat(list.map((u) => [u.nome, u.email, u.whatsapp, u.aceitaWhats ? 'sim' : 'não', fmtD(u.criadoEm)].map(cell).join(';'))).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'usuarios-atlas-' + today() + '.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    draw();
  }

  const ORDER_ST = [['aguardando', 'Aguardando pagamento'], ['pago', 'Pago · pesquisar'], ['entregue', 'Entregue'], ['cancelado', 'Cancelado']];
  // Abre a "Busca da equipe" no site já preenchida com os dados do pedido.
  const teamLink = (p) => new URL('./', location.href).href + '#/equipe/busca?' + new URLSearchParams(Object.entries({
    pedido: p.codigo || p.id, nome: p.nome, rg: p.rg, insc: p.inscricao, uf: p.uf, concurso: p.concurso, desde: p.desde
  }).filter((x) => x[1])).toString();
  // Alerta do Google: e-mail automático quando o nome aparecer numa página nova.
  const alertLink = (p) => 'https://www.google.com/alerts?q=' + encodeURIComponent('"' + String(p.nome || '').trim() + '"');
  /* Acompanhamento semanal: começa no pagamento e dura N semanas; a cada 7 dias o
     pedido volta para a lista "Acompanhamentos para conferir" (aba Lembretes de hoje). */
  function acomp(p) {
    if (p.plano !== 'acompanhamento' || p.status !== 'pago') return null;
    const sem = Math.max(1, Number(cfg.servicos.acompanhamento.semanas) || 4);
    const ini = String(p.pagoEm || p.criadoEm).slice(0, 10);
    const fim = addD(ini, sem * 7);
    const feitas = Number(p.conferencias) || 0;
    const ultima = p.conferidoEm || '';
    const due = today() <= fim ? !ultima || ultima <= addD(today(), -7) : !ultima || ultima < fim;
    return { sem, ini, fim, feitas, ultima, due, semana: Math.min(sem, Math.floor((new Date(today()) - new Date(ini)) / 604800000) + 1), acabou: today() > fim };
  }
  function acompMsg(p, a) {
    const n = (p.nome || '').split(' ')[0];
    return a.acabou
      ? 'Olá, ' + n + '! Terminamos o acompanhamento do pedido ' + p.codigo + ' (' + a.sem + ' semanas). Até hoje não saiu publicação com o seu nome no Diário Oficial, no órgão nem na banca de ' + p.concurso + '. Se quiser renovar, é só responder aqui.'
      : 'Olá, ' + n + '! Conferimos de novo o Diário Oficial, o órgão e a banca de ' + p.concurso + ' (semana ' + a.semana + ' de ' + a.sem + '): ainda não saiu publicação com o seu nome. Seguimos acompanhando e avisamos assim que sair.';
  }
  const DESDE_TXT = { '3m': 'últimos 3 meses', '6m': 'últimos 6 meses', '1a': 'últimos 12 meses', tudo: 'desde o início do concurso' };
  function orderMsg(p) {
    const n = (p.nome || '').split(' ')[0];
    if (p.status === 'aguardando') return 'Olá, ' + n + '! Aqui é do Atlas Concursos. Recebemos seu pedido ' + p.codigo + ' da Pesquisa no Diário Oficial. Assim que o Pix de ' + brl(p.valor) + ' for confirmado, começamos a pesquisa.';
    if (p.status === 'pago' && p.plano === 'acompanhamento') return 'Olá, ' + n + '! Pagamento do pedido ' + p.codigo + ' confirmado. Fazemos a primeira pesquisa ' + cfg.servicos.diario.prazo + ' e depois conferimos toda semana durante ' + cfg.servicos.acompanhamento.semanas + ' semanas. Avisamos aqui assim que seu nome sair.';
    if (p.status === 'pago') return 'Olá, ' + n + '! Pagamento do pedido ' + p.codigo + ' confirmado. Já estamos procurando seu nome e enviamos o resultado ' + cfg.servicos.diario.prazo + '.';
    if (p.status === 'entregue') return 'Olá, ' + n + '! Segue o resultado da sua Pesquisa no Diário Oficial (pedido ' + p.codigo + '):\n\n';
    return 'Olá, ' + n + '! Sobre o pedido ' + p.codigo + ' do Atlas Concursos:';
  }
  function drawOrders(box, list) {
    let filt = 'ativos';
    const sum = (st) => list.filter((p) => p.status === st).reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const draw = () => {
      const f = list.filter((p) => filt === 'todos' || (filt === 'ativos' ? ['aguardando', 'pago'].includes(p.status) : p.status === filt));
      $('#o-list', box).innerHTML = f.length ? f.map((p) =>
        '<div class="panel adm-item" data-oid="' + esc(p.id) + '"><div class="adm-item-head"><h3>' + esc(p.codigo || p.id) + ' · ' + esc(p.nome) + '</h3><span class="badge">' + brl(p.valor) + '</span></div>' +
          '<div class="adm-help">' + (p.plano === 'acompanhamento' ? '<span class="badge accent">Acompanhamento</span> ' : '') + '<b>' + esc(p.concurso) + '</b>' + (p.uf ? ' (' + esc(p.uf) + ')' : '') + ' · pedido em ' + esc(fmtD(p.criadoEm)) +
            (p.inscricao ? ' · inscrição <b>' + esc(p.inscricao) + '</b>' : '') + (p.rg ? ' · RG <b>' + esc(p.rg) + '</b>' : '') + (p.desde ? ' · procurar nos ' + esc(DESDE_TXT[p.desde] || p.desde) : '') +
            (p.obs ? '<br>Obs.: ' + esc(p.obs) : '') + (p.email ? '<br>Conta: ' + esc(p.email) : '') +
            (acomp(p) ? '<br>Acompanhamento: semana <b>' + acomp(p).semana + ' de ' + acomp(p).sem + '</b> · ' + acomp(p).feitas + (acomp(p).feitas === 1 ? ' conferência' : ' conferências') + (acomp(p).ultima ? ' · última em ' + esc(fmtD(acomp(p).ultima)) : '') + ' · termina em ' + esc(fmtD(acomp(p).fim)) : '') + '</div>' +
          '<div class="btn-row"><select class="select" data-ost style="max-width:240px">' + ORDER_ST.map((o) => '<option value="' + o[0] + '"' + (p.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
            (p.whatsapp ? '<a class="btn btn-sm btn-primary" href="' + esc(waTo(p.whatsapp, orderMsg(p))) + '" target="_blank" rel="noopener">WhatsApp ' + esc(fmtW(p.whatsapp)) + '</a>' : '') +
            '<a class="btn btn-sm" href="' + esc(teamLink(p)) + '" target="_blank" rel="noopener">Abrir a busca</a>' +
            (p.status === 'pago' || p.status === 'entregue' ? '<a class="btn btn-sm" href="' + esc(alertLink(p)) + '" target="_blank" rel="noopener" title="E-mail automático quando o nome aparecer numa página nova">Alerta no Google</a>' : '') + '</div></div>').join('')
        : '<div class="empty">Nenhum pedido aqui.</div>';
    };
    box.innerHTML = '<div class="kpis"><div class="kpi"><b>' + list.filter((p) => p.status === 'aguardando').length + '</b><span>aguardando pagamento</span></div><div class="kpi"><b>' + list.filter((p) => p.status === 'pago').length + '</b><span>pagos para pesquisar</span></div><div class="kpi"><b>' + brl(sum('pago') + sum('entregue')) + '</b><span>recebido (pagos + entregues)</span></div><div class="kpi"><b>' + list.filter((p) => p.status === 'entregue').length + '</b><span>entregues</span></div></div>' +
      '<div class="adm-tabs" id="o-filt">' + [['ativos', 'Em aberto'], ['aguardando', 'Aguardando'], ['pago', 'Pagos'], ['entregue', 'Entregues'], ['todos', 'Todos']].map((x) => '<button class="chip' + (x[0] === filt ? ' sel' : '') + '" data-of="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
      '<p class="adm-help">Confirme o Pix <b>no app do banco</b> (não só pelo comprovante) antes de marcar como pago. Ao mudar a situação, o cliente vê o novo status na conta dele. <b>Abrir a busca</b> monta as pesquisas com os dados do cliente; <b>Alerta no Google</b> cria um aviso por e-mail para quando o nome aparecer numa página nova (útil no acompanhamento).</p>' +
      '<div class="adm-section" id="o-list"></div>';
    $('#o-filt', box).addEventListener('click', (e) => { const b = e.target.closest('[data-of]'); if (!b) return; filt = b.dataset.of; $$('[data-of]', box).forEach((x) => x.classList.toggle('sel', x === b)); draw(); });
    $('#o-list', box).addEventListener('change', async (e) => {
      const sel = e.target.closest('[data-ost]'); if (!sel) return;
      const p = list.find((x) => x.id === sel.closest('[data-oid]').dataset.oid);
      const prev = p.status;
      p.status = sel.value;
      const upd = { status: p.status, atualizadoEm: new Date().toISOString() };
      if (p.status === 'pago' && !p.pagoEm) upd.pagoEm = p.pagoEm = upd.atualizadoEm;   // o acompanhamento conta as semanas a partir daqui
      try { await updateDocAdm('pedidos', p.id, upd); toast('Pedido ' + (p.codigo || p.id) + ': ' + ORDER_ST.find((o) => o[0] === p.status)[1]); draw(); }
      catch (err) { p.status = prev; sel.value = prev; toast('Não foi possível salvar: ' + err.message); }
    });
    draw();
  }

  const AVISO_TXT = { insc: 'Inscrições terminam amanhã', p7: 'Prova em 7 dias', p1: 'Prova amanhã', res: 'Dia do resultado' };
  function reminderMsg(l, k) {
    const n = (l.nome || '').split(' ')[0] || 'tudo bem';
    const c = l.concurso + (l.cargo ? ' (' + l.cargo + ')' : '');
    return ({
      insc: 'Olá, ' + n + '! Lembrete do Atlas Concursos: as inscrições de ' + c + ' terminam amanhã (' + fmtD(l.inscricao) + '). Não deixe para a última hora! 😉',
      p7: 'Olá, ' + n + '! Falta 1 semana para a prova de ' + c + ' (' + fmtD(l.prova) + '). Hora de revisar os pontos mais cobrados. Você consegue! 💪',
      p1: 'Olá, ' + n + '! Amanhã é a prova de ' + c + '. Confira o local no cartão de confirmação, leve documento com foto e caneta preta. Boa prova! 🍀',
      res: 'Olá, ' + n + '! O resultado de ' + c + ' está previsto para hoje (' + fmtD(l.resultado) + '). Quer que a gente procure seu nome no Diário Oficial por ' + brl(cfg.servicos.diario.preco) + '? É só responder esta mensagem. 🔎'
    })[k] + '\n\n(Para não receber mais, responda SAIR.)';
  }
  function drawReminders(box, list, pedidos) {
    const t = today();
    const due = [], soon = [];
    list.forEach((l) => (l.avisos || []).forEach((k) => {
      const d = l.datas && l.datas[k];
      if (!d || (l.enviados && l.enviados[k])) return;
      if (d <= t && d >= addD(t, -2)) due.push({ l, k, d });
      else if (d > t && d <= addD(t, 7)) soon.push({ l, k, d });
    }));
    soon.sort((a, b) => a.d.localeCompare(b.d));
    const row = (x, send) => '<div class="row" data-lid="' + esc(x.l.id) + '" data-lk="' + x.k + '"><div class="grow"><div class="title">' + esc(x.l.nome || '(sem nome)') + ' · ' + esc(AVISO_TXT[x.k]) + '</div><div class="sub">' + esc(x.l.concurso) + ' · ' + esc(fmtD(x.d)) + ' · ' + esc(fmtW(x.l.whatsapp)) + '</div></div>' +
      (send ? '<a class="btn btn-sm btn-primary" data-send href="' + esc(waTo(x.l.whatsapp, reminderMsg(x.l, x.k))) + '" target="_blank" rel="noopener">Enviar no WhatsApp</a><button class="btn btn-sm" data-sent type="button">Marcar enviado</button>' : '') + '</div>';
    const acs = (pedidos || []).map((p) => ({ p, a: acomp(p) })).filter((x) => x.a && x.a.due);
    const acRow = (x) => '<div class="row" data-acid="' + esc(x.p.id) + '" style="flex-wrap:wrap"><div class="grow"><div class="title">' + esc(x.p.nome) + ' · ' + esc(x.p.codigo || x.p.id) + '</div>' +
      '<div class="sub">' + esc(x.p.concurso) + (x.p.uf ? ' (' + esc(x.p.uf) + ')' : '') + ' · ' + (x.a.acabou ? 'última semana encerrada' : 'semana ' + x.a.semana + ' de ' + x.a.sem) + (x.a.ultima ? ' · conferido em ' + esc(fmtD(x.a.ultima)) : ' · ainda não conferido') + '</div></div>' +
      '<a class="btn btn-sm" href="' + esc(teamLink(x.p)) + '" target="_blank" rel="noopener">Abrir a busca</a>' +
      (x.p.whatsapp ? '<a class="btn btn-sm" href="' + esc(waTo(x.p.whatsapp, acompMsg(x.p, x.a))) + '" target="_blank" rel="noopener">Avisar no WhatsApp</a>' : '') +
      '<button class="btn btn-sm btn-primary" data-conf type="button">Conferi hoje</button></div>';
    box.innerHTML = '<div class="kpis"><div class="kpi"><b>' + due.length + '</b><span>lembretes para enviar hoje</span></div><div class="kpi"><b>' + soon.length + '</b><span>nos próximos 7 dias</span></div><div class="kpi"><b>' + list.length + '</b><span>concursos com lembrete</span></div>' + (pedidos ? '<div class="kpi"><b>' + acs.length + '</b><span>acompanhamentos para conferir</span></div>' : '') + '</div>' +
      (acs.length ? '<section class="section"><div class="section-head"><h2 style="font-size:17px">Acompanhamentos para conferir</h2></div>' +
        '<p class="adm-help">Clientes do acompanhamento semanal. Abra a busca, confira as publicações da semana (e os e-mails do Alerta no Google), avise o cliente e toque em <b>Conferi hoje</b>: o pedido volta para esta lista daqui a 7 dias. Quando o nome sair, mande o resultado e marque o pedido como <b>Entregue</b> na aba Pedidos.</p>' +
        '<div class="list" id="ac-list">' + acs.map(acRow).join('') + '</div></section>' : '') +
      '<p class="adm-help">Toque em <b>Enviar no WhatsApp</b>: a mensagem já vai pronta e o lembrete é marcado como enviado. Lembretes atrasados até 2 dias também aparecem aqui.</p>' +
      '<section class="section"><div class="section-head"><h2 style="font-size:17px">Enviar hoje</h2></div><div class="list" id="l-due">' + (due.length ? due.map((x) => row(x, true)).join('') : '<div class="empty">Nenhum lembrete para hoje. 🎉</div>') + '</div></section>' +
      (soon.length ? '<section class="section"><div class="section-head"><h2 style="font-size:17px">Próximos 7 dias</h2></div><div class="list">' + soon.map((x) => row(x, false)).join('') + '</div></section>' : '');
    const mark = async (r) => {
      const l = list.find((x) => x.id === r.dataset.lid); const k = r.dataset.lk;
      l.enviados = Object.assign({}, l.enviados, { [k]: t });
      try { await updateDocAdm('lembretes', l.id, { ['enviados.' + k]: t }); r.classList.add('done'); r.querySelectorAll('[data-sent],[data-send]').forEach((b) => b.remove()); r.insertAdjacentHTML('beforeend', '<span class="badge ok">enviado</span>'); }
      catch (err) { toast('Não foi possível marcar: ' + err.message); }
    };
    const acList = $('#ac-list', box);
    if (acList) acList.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-conf]'); if (!b) return;
      const r = b.closest('[data-acid]');
      const p = pedidos.find((x) => x.id === r.dataset.acid);
      const n = (Number(p.conferencias) || 0) + 1;
      try {
        await updateDocAdm('pedidos', p.id, { conferidoEm: today(), conferencias: n, atualizadoEm: new Date().toISOString() });
        p.conferidoEm = today(); p.conferencias = n;
        r.classList.add('done'); b.remove(); r.insertAdjacentHTML('beforeend', '<span class="badge ok">conferido hoje</span>');
      } catch (err) { toast('Não foi possível marcar: ' + err.message); }
    });
    $('#l-due', box).addEventListener('click', (e) => {
      const r = e.target.closest('[data-lid]'); if (!r) return;
      if (e.target.closest('[data-send]')) setTimeout(() => mark(r), 300);
      else if (e.target.closest('[data-sent]')) mark(r);
    });
  }

  /* ---------- Guia do Firebase e regras de segurança ---------- */
  // Mesmo texto do arquivo firestore.rules, com o e-mail do administrador.
  const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() { return signedIn() && request.auth.token.email == '__ADMIN__' && request.auth.token.email_verified == true; }
    function isOwner(uid) { return signedIn() && request.auth.uid == uid; }
    function str(v, max) { return v is string && v.size() <= max; }

    // Dados sincronizados do aparelho: só o dono (até ~900 KB).
    match /users/{uid} {
      allow read: if isOwner(uid);
      allow write: if isOwner(uid) && request.resource.data.keys().hasOnly(['data', 'updatedAt', 'email']) && str(request.resource.data.data, 900000);
    }

    // Perfil (nome, e-mail, WhatsApp): o dono e o administrador.
    match /perfis/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isAdmin() || (isOwner(uid)
        && request.resource.data.keys().hasOnly(['uid', 'nome', 'email', 'whatsapp', 'aceitaWhats', 'aceitouTermosEm', 'criadoEm', 'atualizadoEm'])
        && str(request.resource.data.nome, 120) && str(request.resource.data.whatsapp, 15));
    }

    // Pedidos: o cliente cria e lê os seus e pode cancelar enquanto aguarda pagamento;
    // só o administrador marca como pago ou entregue.
    match /pedidos/{id} {
      allow create: if signedIn() && request.resource.data.uid == request.auth.uid
        && request.resource.data.status == 'aguardando' && request.resource.data.valor is number
        && request.resource.data.keys().hasOnly(['codigo', 'servico', 'plano', 'valor', 'status', 'criadoEm', 'nome', 'whatsapp', 'uf', 'concurso', 'inscricao', 'rg', 'desde', 'obs', 'uid', 'email'])
        && str(request.resource.data.nome, 120) && str(request.resource.data.concurso, 160) && str(request.resource.data.obs, 500);
      allow read: if isAdmin() || (signedIn() && resource.data.uid == request.auth.uid);
      allow update: if isAdmin() || (signedIn() && resource.data.uid == request.auth.uid && resource.data.status == 'aguardando'
        && request.resource.data.status == 'cancelado' && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'atualizadoEm']));
      allow delete: if isAdmin();
    }

    // Lembretes no WhatsApp: o dono (até 4 avisos por concurso) e o administrador.
    match /lembretes/{id} {
      allow create, update: if isAdmin() || (signedIn() && request.resource.data.uid == request.auth.uid
        && (resource == null || resource.data.uid == request.auth.uid)
        && request.resource.data.avisos.size() <= 4 && str(request.resource.data.concurso, 160));
      allow read, delete: if isAdmin() || (signedIn() && resource.data.uid == request.auth.uid);
    }
  }
}
`;
  function rulesText(email) {
    return RULES.replace('__ADMIN__', String(email || 'SEU-EMAIL-DE-ADMIN@exemplo.com').replace(/['\\]/g, ''));
  }
  function firebaseGuide() {
    const hosts = ['atlas-concursos.pages.dev', 'williancoder.github.io'];
    try { if (cfg.siteUrl) hosts.unshift(new URL(cfg.siteUrl).hostname); } catch (e) {}
    return '<details class="panel panel-pad section adm-section"' + (hasFirebase() ? '' : ' open') + '><summary style="cursor:pointer;font-weight:600">Passo a passo: ativar as contas (Firebase, grátis)</summary><ol class="adm-steps">' +
      '<li>Abra <a class="grad-text" href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a> com o e-mail do negócio e clique em <b>Criar projeto</b> (nome: <code>atlas-concursos</code>; o Google Analytics pode ficar desligado).</li>' +
      '<li><b>Authentication → Vamos começar → Método de login</b>: ative <b>E-mail/senha</b> e, se quiser, <b>Google</b>.</li>' +
      '<li><b>Authentication → Configurações → Domínios autorizados</b>: adicione ' + hosts.map((h) => '<code>' + esc(h) + '</code>').join(', ') + '.</li>' +
      '<li><b>Firestore Database → Criar banco de dados</b> → modo de produção → local <code>southamerica-east1 (São Paulo)</code>.</li>' +
      '<li>No site, crie sua conta em <b>Entrar → Criar conta</b> com o e-mail do administrador e confirme o e-mail. Preencha esse e-mail no campo acima.</li>' +
      '<li><b>Firestore → Regras</b>: apague tudo, cole as regras abaixo (já com o seu e-mail) e clique em <b>Publicar</b>.</li>' +
      '<li><b>Configurações do projeto → Seus apps → Web (&lt;/&gt;)</b> → registre o app "Atlas" → copie o objeto <code>firebaseConfig</code> e cole no campo acima. Depois toque em <b>Salvar e publicar</b>.</li>' +
      '</ol><label class="field">Regras do Firestore<textarea class="textarea" id="adm-rules" rows="10" readonly spellcheck="false" style="font-family:monospace;font-size:12px">' + esc(rulesText(cfg.adminEmail)) + '</textarea></label>' +
      '<div><button class="btn" id="adm-rules-copy" type="button">Copiar regras</button></div></details>';
  }

  /* ---------- Marca (nome e logo) ---------- */
  function viewMarca() {
    const atual = MARCAS.find((m) => m.id === cfg.marca) || MARCAS[0];
    return '<p class="adm-help">Escolha o nome e o logo do site. A troca vale para o site inteiro (títulos, textos, logo, ícone do app, imagem de prévia no WhatsApp e PDF de apresentação) e entra no ar cerca de 1 minuto depois de <b>Salvar e publicar</b>. Para voltar, é só escolher outra marca e publicar de novo — nada é apagado.</p>' +
      '<div class="marca-grid">' + MARCAS.map((m) => '<label class="panel marca' + (m.id === cfg.marca ? ' sel' : '') + '">' +
        '<input type="radio" name="marca" value="' + esc(m.id) + '"' + (m.id === cfg.marca ? ' checked' : '') + '>' +
        '<img src="assets/marcas/' + esc(m.id) + '/logo.svg" alt="" width="64" height="64">' +
        '<span class="marca-nome">' + esc(m.p1) + '<b>' + esc(m.p2) + '</b></span>' +
        '<span class="adm-help">' + esc(m.desc || '') + '</span>' +
        (m.id === cfg.marca ? '<span class="badge ok">Escolhida</span>' : '') + '</label>').join('') + '</div>' +
      '<div class="panel panel-pad section adm-section"><h2 style="font-size:17px">Prévia do link no WhatsApp</h2>' +
        '<img class="marca-og" src="assets/marcas/' + esc(atual.id) + '/og.png" alt="Imagem de prévia da marca ' + esc(atual.nome) + '">' +
        '<p class="adm-help">O endereço do site (atlas-concursos.pages.dev) continua o mesmo. Se trocar de vez, registre o domínio da marca (ex.: ' + esc(atual.p1.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() + atual.p2.toLowerCase()) + '.com.br) e confira o nome no INPI antes de divulgar.</p></div>';
  }

  /* ---------- Imagem dos planos (para mandar às empresas no WhatsApp) ---------- */
  async function plansImage() {
    const m = MARCAS.find((y) => y.id === cfg.marca) || MARCAS[0];
    const pk = cfg.pacotes.filter((p) => p.nome);
    const W = 1080, PAD = 64, CW = W - PAD * 2, IN = 34;
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const F = (w, size, fam) => w + ' ' + size + 'px "' + (fam || 'Inter') + '", system-ui, sans-serif';
    try { await Promise.all([F(700, 40, 'Space Grotesk'), F(400, 27), F(500, 24), F(600, 28)].map((f) => document.fonts.load(f))); } catch (e) { /* usa a fonte do sistema */ }
    const wrap = (t, font, max) => {
      x.font = font;
      const out = []; let line = '';
      String(t || '').split(/\s+/).filter(Boolean).forEach((w) => { const l = line ? line + ' ' + w : w; if (line && x.measureText(l).width > max) { out.push(line); line = w; } else line = l; });
      if (line) out.push(line);
      return out;
    };
    const cards = pk.map((p) => {
      x.font = F(700, 38, 'Space Grotesk');
      const pw = x.measureText(p.preco || '').width;
      const nome = wrap(p.nome, F(700, 33, 'Space Grotesk'), CW - IN * 2 - pw - 28);
      const desc = wrap(p.desc, F(400, 27), CW - IN * 2);
      const ideal = p.ideal ? wrap('Ideal para: ' + p.ideal, F(500, 24), CW - IN * 2) : [];
      return { p, nome, desc, ideal, h: IN + nome.length * 42 + 12 + desc.length * 37 + (ideal.length ? 10 + ideal.length * 32 : 0) + IN - 6 };
    });
    const HEAD = 400, FOOT = 220, GAP = 22;
    const H = HEAD + cards.reduce((t, k) => t + k.h + GAP, 0) + FOOT;
    c.width = W; c.height = H;
    const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b1020'); bg.addColorStop(1, '#121833');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W - 120, 60, 10, W - 120, 60, 560); glow.addColorStop(0, 'rgba(139,92,246,.32)'); glow.addColorStop(1, 'rgba(139,92,246,0)');
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    const grad = x.createLinearGradient(PAD, 0, W - PAD, 0); grad.addColorStop(0, '#22d3ee'); grad.addColorStop(1, '#8b5cf6');
    const box = (bx, by, bw, bh, r) => { x.beginPath(); x.moveTo(bx + r, by); x.arcTo(bx + bw, by, bx + bw, by + bh, r); x.arcTo(bx + bw, by + bh, bx, by + bh, r); x.arcTo(bx, by + bh, bx, by, r); x.arcTo(bx, by, bx + bw, by, r); x.closePath(); };
    // Marca
    const logo = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/marcas/' + m.id + '/logo.svg'; });
    let bx = PAD;
    if (logo) { x.drawImage(logo, PAD, 58, 76, 76); bx += 96; }
    x.textBaseline = 'middle';
    x.font = F(700, 42, 'Space Grotesk'); x.fillStyle = '#fff'; x.fillText(m.p1, bx, 98);
    x.fillStyle = grad; x.fillText(m.p2, bx + x.measureText(m.p1 + ' ').width, 98);
    x.textBaseline = 'alphabetic';
    // Título
    x.font = F(700, 60, 'Space Grotesk'); x.fillStyle = '#fff'; x.fillText('Anuncie para quem', PAD, 238);
    x.fillStyle = grad; x.fillText('estuda para concurso', PAD, 308);
    x.font = F(400, 28); x.fillStyle = '#aab2d5'; x.fillText('Planos de patrocínio com preço fixo · sem contrato longo', PAD, 362);
    // Planos
    let y = HEAD;
    cards.forEach((k) => {
      box(PAD, y, CW, k.h, 22); x.fillStyle = 'rgba(255,255,255,.05)'; x.fill(); x.strokeStyle = 'rgba(148,163,255,.25)'; x.lineWidth = 2; x.stroke();
      let ty = y + IN + 28;
      x.font = F(700, 38, 'Space Grotesk'); x.fillStyle = grad; x.textAlign = 'right'; x.fillText(k.p.preco || '', W - PAD - IN, ty + 2); x.textAlign = 'left';
      x.font = F(700, 33, 'Space Grotesk'); x.fillStyle = '#fff'; k.nome.forEach((l) => { x.fillText(l, PAD + IN, ty); ty += 42; });
      ty += 12 - 42 + 37;
      x.font = F(400, 27); x.fillStyle = '#c9cfea'; k.desc.forEach((l) => { x.fillText(l, PAD + IN, ty); ty += 37; });
      if (k.ideal.length) { ty += 10 - 37 + 32; x.font = F(500, 24); x.fillStyle = '#8f98c2'; k.ideal.forEach((l) => { x.fillText(l, PAD + IN, ty); ty += 32; }); }
      y += k.h + GAP;
    });
    // Contato
    y += 30;
    x.font = F(500, 26); x.fillStyle = '#aab2d5'; x.fillText('Todo anúncio leva a etiqueta "Patrocinado". Fale com a gente:', PAD, y + 20);
    x.font = F(700, 46, 'Space Grotesk'); x.fillStyle = '#fff';
    x.fillText(cfg.contato.whatsapp ? 'WhatsApp ' + fmtW(cfg.contato.whatsapp) : (cfg.contato.email || ''), PAD, y + 86);
    if (cfg.siteUrl) { x.font = F(500, 26); x.fillStyle = grad; x.fillText(String(cfg.siteUrl).replace(/^https?:\/\//, '').replace(/\/$/, ''), PAD, y + 136); }
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }

  /* ---------- Limites de uso ---------- */
  function viewLimites() {
    const L = cfg.limites;
    const n = (label, key, help) => pathInput(label, 'limites.' + key, String(L[key]), { kind: 'number', ph: '0', help });
    return '<p class="adm-help">Os limites deixam o serviço profissional e protegem o seu tempo. <b>0 = sem limite.</b> Os contadores de pedidos zeram todo dia à meia-noite. A pesquisa do nome no Diário não tem versão grátis: ela é feita pela equipe, com a <b>Busca da equipe</b> (botão "Abrir a busca" em cada pedido).</p>' +
      '<div class="tool-layout">' +
        '<div class="panel panel-pad adm-section"><h2 style="font-size:18px">Pedidos e lembretes</h2><div class="adm-grid">' +
          n('Pedidos aguardando pagamento por pessoa', 'pedidosAbertos', 'Evita pedidos falsos: só faz outro depois de pagar ou cancelar.') +
          n('Pedidos por dia por pessoa', 'pedidosDia', 'Proteção contra abuso.') +
          n('Concursos com lembrete no WhatsApp por pessoa', 'lembretes', 'Controla quantas mensagens você envia por dia.') +
        '</div></div>' +
      '</div>' +
      '<div class="panel panel-pad section adm-section"><h2 style="font-size:17px">O que a Pesquisa no Diário cobre</h2>' +
        '<p class="adm-help">Aparece na página do serviço e nos termos: <b>1 pessoa, 1 concurso, Diário Oficial do estado e da União, site do órgão e da banca, últimos 12 meses</b>. Outro concurso ou outra pessoa = outro pedido. Diários de prefeituras, área do candidato com senha e orientação jurídica não estão incluídos.</p></div>';
  }

  function renderApp() {
    $('#adm-save').hidden = false; $('#adm-logout').hidden = false;
    const views = { geral: viewGeral, agenda: viewAgenda, pix: viewPix, patrocinios: viewPatrocinios, teste: viewTeste, recomendados: viewRecomendados, pacotes: viewPacotes, anuncios: viewAnuncios, avancado: viewAvancado, pedidos: viewCloud, lembretes: viewCloud, usuarios: viewCloud, limites: viewLimites, marca: viewMarca };
    const root = $('#adm');
    root.innerHTML =
      (session.demo ? '<div class="panel panel-pad" style="margin-bottom:16px;border-color:var(--warn)"><b>Modo demonstração.</b> <span class="muted">Explore à vontade: nada aqui é publicado. Para salvar de verdade, entre com o token do GitHub no site publicado.</span></div>' : '') +
      '<div class="page-head" style="margin-bottom:0"><div><span class="eyebrow">' + esc(session.owner + '/' + session.repo) + ' · ' + esc(session.demo ? 'demonstração' : session.branch) + '</span><h1>Painel do Administrador</h1></div></div>' +
      '<nav class="adm-tabs">' + TABS.map((t) => '<button class="chip' + (tab === t[0] ? ' sel' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</nav>' +
      '<div id="adm-view">' + views[tab]() + '</div>';
    $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderApp(); }));
    $$('[data-go]', root).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); tab = b.dataset.go; renderApp(); }));
    const rb = $('#adm-radar', root);
    if (rb) rb.addEventListener('click', async () => {
      if (session.demo) { toast('Modo demonstração: no site oficial, este botão inicia a varredura.'); return; }
      rb.disabled = true; rb.textContent = 'Iniciando…';
      try {
        await gh('/repos/' + session.owner + '/' + session.repo + '/actions/workflows/radar.yml/dispatches', { method: 'POST', body: { ref: session.branch } });
        toast('Varredura iniciada! Em cerca de 5 minutos o site é atualizado.');
        rb.textContent = 'Varredura em andamento';
      } catch (e) {
        rb.disabled = false; rb.textContent = 'Atualizar o Radar agora';
        alert(e.status === 403 || e.status === 404 ? 'O token não tem permissão para iniciar automações. Crie um token com "Actions: Read and write" além de "Contents: Read and write".' : 'Não foi possível iniciar: ' + e.message);
      }
    });
    bindPaths(root);
    bindList(root, 'patrocinios', { titulo: '', url: '', desc: '', valor: 99, periodo: 'mensal', inicio: today(), ate: endDate(today(), 'mensal'), posicao: 'topo', onde: ['home'] }, null, null, sponsorEdited);
    bindList(root, 'recomendados', { titulo: '', url: '', preco: '', tag: '', desc: '' });
    bindList(root, 'dicasPatrocinadas', { data: today(), texto: '', url: '' });
    bindList(root, 'pacotes', { nome: '', preco: '', ideal: '', desc: '' });
    bindList(root, 'itens', BLANK_AGENDA, agenda, 'agenda');
    $$('[data-sug]', root).forEach((b) => b.addEventListener('click', () => {
      const known = new Set(agenda.itens.map((x) => x.edital));
      const x = (RADAR.items || []).filter((y) => !known.has(y.u))[+b.dataset.sug];
      if (!x) return;
      agenda.itens.unshift(Object.assign(clone(BLANK_AGENDA), { id: Date.now().toString(36), orgao: x.n.replace(/ — [A-Z]{2}$/, ''), uf: x.uf || '', edital: x.u, obs: x.t }));
      setDirty(true, 'agenda');
      toast('Adicionado. Complete as datas conferindo o edital.');
      renderApp();
    }));
    drawPix(root);
    bindTeste(root);
    const pi = $('#pk-img', root);
    if (pi) pi.addEventListener('click', async () => {
      const blob = await plansImage();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'planos-anuncie.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Imagem baixada. Mande no WhatsApp para a empresa.');
    });
    $$('input[name="marca"]', root).forEach((r) => r.addEventListener('change', () => { cfg.marca = r.value; setDirty(true); renderApp(); }));
    if (CLOUD_TABS.includes(tab)) loadCloudTab(root);
    const rc = $('#adm-rules-copy', root);
    if (rc) rc.addEventListener('click', async () => {
      const ta = $('#adm-rules', root);
      try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
      toast('Regras copiadas! Cole no Firestore → Regras.');
    });
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
    if (!(session && session.demo) && (dirty || dirtyAgenda) && !confirm('Há alterações não publicadas. Sair mesmo assim?')) return;
    sessionStorage.removeItem(SS); session = null; cfg = null; setDirty(false, 'all'); renderLogin();
  });

  (async function init() {
    if (!session) return renderLogin();
    try { await loadRemote(); renderApp(); }
    catch (e) { sessionStorage.removeItem(SS); session = null; renderLogin('Sessão expirada. Entre novamente.'); }
  })();
})();
