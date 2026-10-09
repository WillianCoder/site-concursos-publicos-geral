/*
 * Atlas Concursos — contas de usuário (e-mail e senha) e sincronização na nuvem.
 *
 * Quando `firebase` está preenchido em config.js, o visitante pode criar uma
 * conta com e-mail e senha (ou entrar com Google). Os dados do aparelho
 * (links, concursos, estudos) passam a ser guardados também no Firestore, e o
 * perfil (nome, e-mail, WhatsApp) fica disponível para o administrador
 * identificar quem pediu serviços, doou ou patrocinou.
 * Sem configuração, o site funciona normalmente com os dados no aparelho.
 *
 * Coleções do Firestore (regras em firestore.rules):
 *   users/{uid}      dados sincronizados do aparelho (só o dono)
 *   perfis/{uid}     nome, e-mail, WhatsApp e consentimentos (dono e admin)
 *   pedidos/{id}     pedidos de serviços pagos (dono lê os seus; admin gerencia)
 *   lembretes/{id}   lembretes de prova no WhatsApp (dono e admin)
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const CFG = (window.ATLAS_CONFIG || {}).firebase;
  const { $, esc, icon, toast, Store, route } = A;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const NEXT = 'atlas:next';

  const Cloud = {
    enabled: !!(CFG && CFG.apiKey && CFG.projectId),
    ready: false,
    user: null,
    profile: null,
    status: 'offline',   // offline | syncing | synced | error
    lastSync: 0,
    fb: null,
    applying: false,
    pushTimer: null
  };
  A.cloud = Cloud;

  let readyResolve;
  const readyPromise = new Promise((r) => { readyResolve = r; });
  let authKnown = false;
  // Resolve quando o Firebase carregou e já sabemos se há alguém conectado.
  Cloud.whenReady = () => (Cloud.enabled ? readyPromise : Promise.resolve(false));

  async function init() {
    if (!Cloud.enabled) return;
    try {
      const [app, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js')
      ]);
      const fbApp = app.initializeApp(CFG);
      const authInst = auth.getAuth(fbApp);
      authInst.languageCode = 'pt-BR';
      Cloud.fb = { auth, fs, authInst, db: fs.getFirestore(fbApp) };
      Cloud.ready = true;
      auth.onAuthStateChanged(authInst, async (user) => {
        Cloud.user = user;
        Cloud.profile = null;
        if (user) {
          // Durante o cadastro, o próprio formulário grava o perfil completo.
          if (!Cloud.creating) await loadProfile();
          await pull();
        } else Cloud.status = 'offline';
        if (!authKnown) { authKnown = true; readyResolve(true); }
        A.renderAccountChip();
        refreshBox();
        if (user && !Cloud.creating && A.current && A.current.name === 'entrar') goNext();
      });
    } catch (e) {
      console.error('Falha ao carregar o Firebase', e);
      Cloud.status = 'error';
      if (!authKnown) { authKnown = true; readyResolve(false); }
      refreshBox();
    }
  }

  /* ---------- Firestore: atalhos usados pelos outros módulos ---------- */
  const fsx = () => Cloud.fb.fs;
  const docOf = (col, id) => fsx().doc(Cloud.fb.db, col, id);
  Cloud.set = (col, id, data, merge) => fsx().setDoc(docOf(col, id), data, merge ? { merge: true } : undefined);
  Cloud.update = (col, id, data) => fsx().updateDoc(docOf(col, id), data);
  Cloud.remove = (col, id) => fsx().deleteDoc(docOf(col, id));
  Cloud.add = async (col, data) => (await fsx().addDoc(fsx().collection(Cloud.fb.db, col), data)).id;
  Cloud.mine = async (col) => {
    if (!Cloud.user) return [];
    const q = fsx().query(fsx().collection(Cloud.fb.db, col), fsx().where('uid', '==', Cloud.user.uid));
    const snap = await fsx().getDocs(q);
    return snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
  };
  const now = () => new Date().toISOString();

  async function loadProfile() {
    try {
      const snap = await fsx().getDoc(docOf('perfis', Cloud.user.uid));
      Cloud.profile = snap.exists() ? snap.data() : null;
      if (!Cloud.profile) {
        // Conta criada com Google (ou perfil ainda não gravado): cria o básico.
        Cloud.profile = { uid: Cloud.user.uid, nome: Cloud.user.displayName || '', email: Cloud.user.email || '', whatsapp: '', aceitaWhats: false, criadoEm: now() };
        await Cloud.set('perfis', Cloud.user.uid, Cloud.profile);
      }
      if (Cloud.profile.nome && !Store.state.profile.nome) Store.update((s) => { s.profile.nome = Cloud.profile.nome; });
    } catch (e) { console.error(e); }
  }
  Cloud.saveProfile = async (data) => {
    Object.assign(Cloud.profile || (Cloud.profile = {}), data, { atualizadoEm: now() });
    await Cloud.set('perfis', Cloud.user.uid, data, true);
  };

  /* ---------- Sincronização dos dados do aparelho ---------- */
  const userDoc = () => docOf('users', Cloud.user.uid);

  // Ao entrar: o dado mais recente vence (nuvem ou aparelho).
  async function pull() {
    Cloud.status = 'syncing'; refreshBox();
    try {
      const snap = await fsx().getDoc(userDoc());
      const remote = snap.exists() ? snap.data() : null;
      const local = Store.state;
      if (remote && remote.data && (remote.updatedAt || 0) > (local.updatedAt || 0)) {
        Cloud.applying = true;
        Store.replace(JSON.parse(remote.data), { keepTime: true, fromCloud: true });
        Cloud.applying = false;
        toast('Seus dados foram sincronizados da nuvem ☁');
        A.render();
      } else {
        await push();
      }
      Cloud.status = 'synced'; Cloud.lastSync = Date.now();
    } catch (e) {
      console.error(e);
      Cloud.status = 'error';
    }
    refreshBox();
  }

  async function push() {
    if (!Cloud.user) return;
    const s = Store.state;
    await fsx().setDoc(userDoc(), { data: JSON.stringify(s), updatedAt: s.updatedAt || Date.now(), email: Cloud.user.email || '' });
    Cloud.lastSync = Date.now();
  }

  // Envia alterações para a nuvem com um pequeno atraso (agrupa várias mudanças).
  Store.on((state, opts) => {
    if (!Cloud.user || Cloud.applying || (opts && opts.fromCloud)) return;
    clearTimeout(Cloud.pushTimer);
    Cloud.pushTimer = setTimeout(async () => {
      try { Cloud.status = 'syncing'; refreshBox(); await push(); Cloud.status = 'synced'; }
      catch (e) { console.error(e); Cloud.status = 'error'; }
      refreshBox();
    }, 1500);
  });

  /* ---------- Entrar, criar conta, recuperar senha ---------- */
  const ERRORS = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Não encontramos uma conta com este e-mail.',
    'auth/invalid-email': 'Este e-mail não parece válido.',
    'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar" ou "Esqueci minha senha".',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet. Tente de novo.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Libere pop-ups ou use e-mail e senha.',
    'auth/operation-not-allowed': 'Este tipo de login ainda não foi ativado pelo administrador.'
  };
  const errMsg = (e) => ERRORS[e && e.code] || 'Não foi possível concluir. Tente novamente.';
  const digits = (s) => String(s || '').replace(/\D/g, '');
  // WhatsApp brasileiro: aceita (11) 91234-5678 e devolve 5511912345678.
  function normWhats(s) {
    let d = digits(s);
    if (!d) return '';
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return /^55\d{10,11}$/.test(d) ? d : null;
  }
  Cloud.normWhats = normWhats;
  Cloud.fmtWhats = (d) => { d = digits(d); const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : d; };

  // Depois de entrar, volta para onde a pessoa estava (ex.: o pedido da pesquisa).
  function goNext() {
    let next = '#/conta';
    try { next = sessionStorage.getItem(NEXT) || next; sessionStorage.removeItem(NEXT); } catch (e) {}
    location.hash = next;
  }
  // Usado pelos serviços: pede login e volta para `back` depois.
  Cloud.requireLogin = (back, mode) => {
    try { sessionStorage.setItem(NEXT, back || location.hash || '#/conta'); } catch (e) {}
    location.hash = mode === 'cadastro' ? '#/entrar/cadastro' : '#/entrar';
  };

  async function loginGoogle() {
    try {
      await Cloud.fb.auth.signInWithPopup(Cloud.fb.authInst, new Cloud.fb.auth.GoogleAuthProvider());
      toast('Conectado!');
    } catch (e) {
      if (e && e.code === 'auth/popup-closed-by-user') return;
      console.error(e); toast(errMsg(e));
    }
  }
  async function logout() {
    await Cloud.fb.auth.signOut(Cloud.fb.authInst);
    toast('Você saiu da conta. Os dados continuam neste aparelho.');
    A.render();
  }

  route(/^\/entrar(?:\/(cadastro|senha))?$/, 'entrar', function (mode) {
    mode = mode || 'login';
    const tabs = [['login', 'Entrar', '#/entrar'], ['cadastro', 'Criar conta', '#/entrar/cadastro'], ['senha', 'Esqueci a senha', '#/entrar/senha']];
    const head = '<div class="page-head"><div><span class="eyebrow">' + icon('user') + 'Sua conta Atlas</span><h1>' +
      (mode === 'cadastro' ? 'Crie sua conta grátis' : mode === 'senha' ? 'Recuperar a senha' : 'Entrar na sua conta') + '</h1>' +
      '<p>Com a conta você acessa seus links, concursos e estudos no celular e no computador, recebe lembretes no WhatsApp e acompanha seus pedidos.</p></div></div>';
    if (!Cloud.enabled) {
      return {
        title: 'Entrar', crumbs: [['Início', '#/'], ['Entrar', '#/entrar']],
        html: head + '<div class="panel panel-pad auth-box"><h2 style="font-size:18px">As contas estão sendo ativadas</h2>' +
          '<p class="muted" style="margin-top:8px">Enquanto isso, tudo o que você salva fica guardado neste aparelho, sem cadastro. Para levar seus dados para outro aparelho, use o backup em <a class="grad-text" href="#/conta">Minha conta</a>.</p></div>'
      };
    }
    if (Cloud.user) setTimeout(goNext, 0);
    const field = (label, name, type, extra) => '<label class="field">' + label + '<input class="input" name="' + name + '" type="' + type + '"' + (extra || '') + '></label>';
    let form = '';
    if (mode === 'login') {
      form = '<form class="auth-form" id="auth-form" data-mode="login" novalidate>' +
        field('E-mail', 'email', 'email', ' required autocomplete="email" inputmode="email"') +
        field('Senha', 'senha', 'password', ' required autocomplete="current-password" minlength="6"') +
        '<button class="btn btn-primary" type="submit">' + icon('user') + 'Entrar</button>' +
        '<a class="small muted" href="#/entrar/senha">Esqueci minha senha</a></form>';
    } else if (mode === 'cadastro') {
      form = '<form class="auth-form" id="auth-form" data-mode="cadastro" novalidate>' +
        field('Nome completo', 'nome', 'text', ' required autocomplete="name" maxlength="80"') +
        field('E-mail', 'email', 'email', ' required autocomplete="email" inputmode="email"') +
        field('Crie uma senha (mínimo 6 caracteres)', 'senha', 'password', ' required autocomplete="new-password" minlength="6"') +
        '<label class="field"><span>WhatsApp <span class="muted">(opcional, para lembretes)</span></span><input class="input" name="whatsapp" type="tel" autocomplete="tel" inputmode="tel" placeholder="(11) 91234-5678"></label>' +
        '<label class="opt-check"><input type="checkbox" name="aceitaWhats"> Quero receber no WhatsApp lembretes das minhas provas e avisos de inscrições abertas.</label>' +
        '<label class="opt-check"><input type="checkbox" name="termos" required> Li e aceito os <a class="grad-text" href="termos.html" target="_blank" rel="noopener">termos de uso</a> e a <a class="grad-text" href="privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.</label>' +
        '<button class="btn btn-primary" type="submit">' + icon('check') + 'Criar conta grátis</button></form>';
    } else {
      form = '<form class="auth-form" id="auth-form" data-mode="senha" novalidate>' +
        '<p class="muted small">Enviaremos um link para você criar uma senha nova.</p>' +
        field('E-mail da conta', 'email', 'email', ' required autocomplete="email" inputmode="email"') +
        '<button class="btn btn-primary" type="submit">Enviar link</button></form>';
    }
    return {
      title: tabs.find((t) => t[0] === mode)[1],
      crumbs: [['Início', '#/'], ['Entrar', '#/entrar']],
      html: head +
        '<div class="panel panel-pad auth-box">' +
          '<nav class="tabs auth-tabs">' + tabs.map((t) => '<a class="chip' + (t[0] === mode ? ' sel' : '') + '" href="' + t[2] + '">' + t[1] + '</a>').join('') + '</nav>' +
          '<p class="auth-error badge danger" id="auth-error" hidden></p>' + form +
          (mode !== 'senha' ? '<div class="auth-or"><span>ou</span></div><button class="btn" type="button" id="auth-google">' + icon('user') + 'Continuar com Google</button>' : '') +
          '<p class="muted small">' + icon('shield', 'i-inline') + ' Sua senha é protegida pelo Google Firebase: nem o Atlas consegue vê-la.</p>' +
        '</div>',
      after(view) {
        const f = $('#auth-form', view);
        const errBox = $('#auth-error', view);
        const fail = (msg) => { errBox.textContent = msg; errBox.hidden = false; };
        const g = $('#auth-google', view);
        if (g) g.addEventListener('click', () => Cloud.whenReady().then(loginGoogle));
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          errBox.hidden = true;
          const d = Object.fromEntries(new FormData(f));
          const email = String(d.email || '').trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Informe um e-mail válido.');
          await Cloud.whenReady();
          if (!Cloud.ready) return fail('Não foi possível conectar. Verifique a internet e tente de novo.');
          const btn = $('button[type=submit]', f); btn.disabled = true;
          const { auth, authInst } = Cloud.fb;
          try {
            if (f.dataset.mode === 'login') {
              if (String(d.senha || '').length < 6) throw { code: 'auth/weak-password' };
              await auth.signInWithEmailAndPassword(authInst, email, d.senha);
              toast('Bem-vindo de volta!');
            } else if (f.dataset.mode === 'cadastro') {
              const nome = String(d.nome || '').trim().replace(/\s+/g, ' ');
              if (nome.length < 3) throw { msg: 'Informe seu nome completo.' };
              if (String(d.senha || '').length < 6) throw { code: 'auth/weak-password' };
              const whatsapp = normWhats(d.whatsapp);
              if (whatsapp === null) throw { msg: 'WhatsApp inválido. Use DDD + número, ex.: (11) 91234-5678.' };
              if (d.aceitaWhats && !whatsapp) throw { msg: 'Para receber lembretes, informe seu WhatsApp.' };
              if (!d.termos) throw { msg: 'Para criar a conta, aceite os termos de uso e a política de privacidade.' };
              Cloud.creating = true;
              try {
                const cred = await auth.createUserWithEmailAndPassword(authInst, email, d.senha);
                await auth.updateProfile(cred.user, { displayName: nome });
                Cloud.profile = { uid: cred.user.uid, nome, email, whatsapp, aceitaWhats: !!d.aceitaWhats, aceitouTermosEm: now(), criadoEm: now() };
                await Cloud.set('perfis', cred.user.uid, Cloud.profile);
                Store.update((s) => { s.profile.nome = nome; });
                try { await auth.sendEmailVerification(cred.user); } catch (e) { /* não impede o cadastro */ }
              } finally { Cloud.creating = false; }
              toast('Conta criada! Enviamos um e-mail para confirmar seu endereço.');
              A.renderAccountChip();
              if (A.current.name === 'entrar') goNext();
            } else {
              await auth.sendPasswordResetEmail(authInst, email);
              f.innerHTML = '<p><b>Pronto!</b> Se existir uma conta com <b>' + esc(email) + '</b>, você vai receber um e-mail com o link para criar uma senha nova. Confira também a caixa de spam.</p><a class="btn" href="#/entrar">Voltar para entrar</a>';
            }
          } catch (e) {
            if (e && !e.msg && !e.code) console.error(e);
            fail(e && e.msg ? e.msg : errMsg(e));
          } finally { btn.disabled = false; }
        });
      }
    };
  });

  /* ---------- Bloco na página "Minha conta" ---------- */
  let box = null;
  function refreshBox() {
    if (!box || !document.body.contains(box)) return;
    const title = '<h2 style="font-size:18px;display:flex;gap:8px;align-items:center">' + icon('cloud') + 'Minha conta Atlas</h2>';
    if (!Cloud.enabled) {
      box.innerHTML = title +
        '<p class="muted small" style="margin-top:8px">Seus dados estão salvos <b>neste navegador</b>. Para usar em outro aparelho, baixe o backup e restaure no outro dispositivo.</p>';
      return;
    }
    if (!Cloud.ready) {
      box.innerHTML = title + '<p class="muted small" style="margin-top:8px">' + (Cloud.status === 'error' ? 'Conta indisponível no momento. Seus dados continuam salvos neste aparelho.' : 'Carregando…') + '</p>';
      return;
    }
    if (!Cloud.user) {
      box.innerHTML = title +
        '<p class="muted small" style="margin:8px 0 14px">Crie sua conta grátis com e-mail e senha para acessar seus links, concursos e estudos no celular e no computador, receber lembretes das provas no WhatsApp e acompanhar seus pedidos.</p>' +
        '<div class="btn-row"><a class="btn btn-primary" href="#/entrar/cadastro">' + icon('user') + 'Criar conta grátis</a><a class="btn" href="#/entrar">Já tenho conta</a></div>';
      return;
    }
    const u = Cloud.user;
    const p = Cloud.profile || {};
    const st = { syncing: ['warn', 'Sincronizando…'], synced: ['ok', 'Sincronizado'], error: ['danger', 'Erro ao sincronizar'], offline: ['', 'Offline'] }[Cloud.status] || ['', ''];
    box.innerHTML = title +
      '<div class="row" style="margin:12px 0">' +
        (u.photoURL ? '<span class="avatar"><img src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer"></span>' : '<span class="avatar">' + icon('user') + '</span>') +
        '<div class="grow"><div class="title">' + esc(p.nome || u.displayName || 'Minha conta') + '</div><div class="sub">' + esc(u.email || '') + (u.emailVerified ? '' : ' · <span class="warn-text">e-mail não confirmado</span>') + '</div></div>' +
        '<span class="badge ' + st[0] + '">' + st[1] + '</span></div>' +
      '<form id="whats-form" class="auth-form" style="margin-bottom:12px">' +
        '<label class="field">WhatsApp<input class="input" name="whatsapp" type="tel" inputmode="tel" value="' + esc(p.whatsapp ? Cloud.fmtWhats(p.whatsapp) : '') + '" placeholder="(11) 91234-5678"></label>' +
        '<label class="opt-check"><input type="checkbox" name="aceitaWhats"' + (p.aceitaWhats ? ' checked' : '') + '> Receber lembretes e avisos no WhatsApp</label>' +
        '<div><button class="btn btn-sm" type="submit">' + icon('check') + 'Salvar</button></div></form>' +
      '<div class="btn-row">' +
        (u.emailVerified ? '' : '<button class="btn btn-sm" id="cloud-verify">Reenviar e-mail de confirmação</button>') +
        '<button class="btn btn-sm" id="cloud-sync">' + icon('refresh') + 'Sincronizar agora</button>' +
        '<button class="btn btn-sm btn-ghost" id="cloud-logout">' + icon('logout') + 'Sair</button></div>' +
      '<div id="my-orders"></div>';
    $('#cloud-sync', box).addEventListener('click', pull);
    $('#cloud-logout', box).addEventListener('click', logout);
    const vb = $('#cloud-verify', box);
    if (vb) vb.addEventListener('click', async () => {
      try { await Cloud.fb.auth.sendEmailVerification(u); toast('E-mail de confirmação enviado.'); } catch (e) { toast(errMsg(e)); }
    });
    $('#whats-form', box).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(ev.target));
      const w = normWhats(d.whatsapp);
      if (w === null) { toast('WhatsApp inválido. Use DDD + número.'); return; }
      if (d.aceitaWhats && !w) { toast('Informe o WhatsApp para receber lembretes.'); return; }
      try { await Cloud.saveProfile({ whatsapp: w, aceitaWhats: !!d.aceitaWhats }); toast('Dados salvos!'); }
      catch (e) { console.error(e); toast('Não foi possível salvar agora.'); }
    });
    if (A.services && A.services.renderOrders) A.services.renderOrders($('#my-orders', box));
  }
  Cloud.refreshBox = refreshBox;

  A.accountHooks.push((el) => { box = el; refreshBox(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
