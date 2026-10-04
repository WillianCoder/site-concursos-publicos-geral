/*
 * Atlas Concursos — sincronização na nuvem (opcional).
 *
 * Quando `firebase` está preenchido em config.js, o usuário pode entrar
 * com a conta Google e os dados (links salvos, concursos, estudos) passam
 * a ser guardados também no Firestore, sincronizando entre aparelhos.
 * Sem configuração, este módulo apenas mostra as opções de backup.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const CFG = (window.ATLAS_CONFIG || {}).firebase;
  const { $, esc, icon, toast, Store } = A;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

  const Cloud = {
    enabled: !!(CFG && CFG.apiKey && CFG.projectId),
    ready: false,
    user: null,
    status: 'offline',   // offline | syncing | synced | error
    lastSync: 0,
    fb: null,
    applying: false,
    pushTimer: null
  };
  A.cloud = Cloud;

  async function init() {
    if (!Cloud.enabled) return;
    try {
      const [app, auth, fs] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-auth.js'),
        import(SDK + 'firebase-firestore.js')
      ]);
      const fbApp = app.initializeApp(CFG);
      Cloud.fb = { auth, fs, authInst: auth.getAuth(fbApp), db: fs.getFirestore(fbApp) };
      Cloud.ready = true;
      auth.onAuthStateChanged(Cloud.fb.authInst, async (user) => {
        Cloud.user = user;
        A.renderAccountChip();
        if (user) await pull();
        else Cloud.status = 'offline';
        refreshBox();
      });
    } catch (e) {
      console.error('Falha ao carregar o Firebase', e);
      Cloud.status = 'error';
      refreshBox();
    }
  }

  const docRef = () => Cloud.fb.fs.doc(Cloud.fb.db, 'users', Cloud.user.uid);

  // Ao entrar: o dado mais recente vence (nuvem ou aparelho).
  async function pull() {
    Cloud.status = 'syncing'; refreshBox();
    try {
      const snap = await Cloud.fb.fs.getDoc(docRef());
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
    await Cloud.fb.fs.setDoc(docRef(), {
      data: JSON.stringify(s),
      updatedAt: s.updatedAt || Date.now(),
      email: Cloud.user.email || ''
    });
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

  async function login() {
    try {
      const provider = new Cloud.fb.auth.GoogleAuthProvider();
      await Cloud.fb.auth.signInWithPopup(Cloud.fb.authInst, provider);
      toast('Conectado! Seus dados agora ficam salvos na nuvem.');
    } catch (e) {
      if (e && e.code === 'auth/popup-closed-by-user') return;
      console.error(e);
      toast('Não foi possível entrar. Tente novamente.');
    }
  }
  async function logout() {
    await Cloud.fb.auth.signOut(Cloud.fb.authInst);
    toast('Você saiu da conta. Os dados continuam neste aparelho.');
  }

  /* ---------- Bloco na página "Minha conta" ---------- */
  let box = null;
  function refreshBox() {
    if (!box || !document.body.contains(box)) return;
    const title = '<h2 style="font-size:18px;display:flex;gap:8px;align-items:center">' + icon('cloud') + 'Conta na nuvem</h2>';
    if (!Cloud.enabled) {
      box.innerHTML = title +
        '<p class="muted small" style="margin-top:8px">Seus dados estão salvos <b>neste navegador</b>. Para usar em outro aparelho, baixe o backup e restaure no outro dispositivo.</p>';
      return;
    }
    if (!Cloud.ready) {
      box.innerHTML = title + '<p class="muted small" style="margin-top:8px">' + (Cloud.status === 'error' ? 'Sincronização indisponível no momento.' : 'Carregando…') + '</p>';
      return;
    }
    if (!Cloud.user) {
      box.innerHTML = title +
        '<p class="muted small" style="margin:8px 0 14px">Entre com sua conta Google para salvar seus links, concursos e estudos na nuvem e acessar do celular e do computador. É grátis.</p>' +
        '<button class="btn btn-primary" id="cloud-login">' + icon('user') + 'Entrar com Google</button>';
      $('#cloud-login', box).addEventListener('click', login);
      return;
    }
    const u = Cloud.user;
    const st = { syncing: ['warn', 'Sincronizando…'], synced: ['ok', 'Sincronizado'], error: ['danger', 'Erro ao sincronizar'], offline: ['', 'Offline'] }[Cloud.status] || ['', ''];
    box.innerHTML = title +
      '<div class="row" style="margin:12px 0">' +
        (u.photoURL ? '<span class="avatar"><img src="' + esc(u.photoURL) + '" alt="" referrerpolicy="no-referrer"></span>' : '<span class="avatar">' + icon('user') + '</span>') +
        '<div class="grow"><div class="title">' + esc(u.displayName || 'Conta Google') + '</div><div class="sub">' + esc(u.email || '') + '</div></div>' +
        '<span class="badge ' + st[0] + '">' + st[1] + '</span></div>' +
      '<div class="btn-row"><button class="btn btn-sm" id="cloud-sync">' + icon('refresh') + 'Sincronizar agora</button>' +
      '<button class="btn btn-sm btn-ghost" id="cloud-logout">' + icon('logout') + 'Sair</button></div>';
    $('#cloud-sync', box).addEventListener('click', pull);
    $('#cloud-logout', box).addEventListener('click', logout);
  }

  A.accountHooks.push((el) => { box = el; refreshBox(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
