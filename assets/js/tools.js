/*
 * Atlas Concursos — ferramentas gratuitas do concurseiro.
 * Tudo roda no navegador e é salvo na conta do usuário (Store).
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { $, $$, esc, uid, icon, toast, dateKey, addDays, daysUntil, fmtDate, fmtMin, pad, Store, route, render } = A;

  const TOOLS = [
    { id: 'pomodoro', nome: 'Pomodoro & Horas de Estudo', icone: 'clock', desc: 'Ciclos de foco e pausa, com histórico diário e meta.' },
    { id: 'edital', nome: 'Edital Verticalizado', icone: 'list', desc: 'Matérias e tópicos do edital com progresso e revisões automáticas.' },
    { id: 'revisoes', nome: 'Revisões Espaçadas', icone: 'refresh', desc: 'Revise em 1, 7 e 30 dias para não esquecer.' },
    { id: 'nota', nome: 'Calculadora de Nota', icone: 'calculator', desc: 'Cebraspe (certo/errado) e múltipla escolha, com nota de corte.' },
    { id: 'planejador', nome: 'Planejador de Estudos', icone: 'target', desc: 'Distribui suas horas semanais por matéria conforme o peso.' },
    { id: 'notas', nome: 'Bloco de Notas', icone: 'note', desc: 'Anotações rápidas salvas automaticamente.' }
  ];

  A.nav.push(
    { href: '#/concursos', icon: 'calendar', label: 'Meus concursos', count: (s) => s.exams.length },
    { href: '#/ferramentas', icon: 'toolbox', label: 'Ferramentas' }
  );
  A.pages.push({ n: 'Meus concursos (agenda de provas)', href: '#/concursos', ic: 'calendar', sub: 'Ferramenta' });
  TOOLS.forEach((t) => A.pages.push({ n: t.nome, href: '#/ferramentas/' + t.id, ic: t.icone, sub: 'Ferramenta' }));

  const crumbs = (t) => [['Início', '#/'], ['Ferramentas', '#/ferramentas'], [t.nome, '#/ferramentas/' + t.id]];
  const head = (t, extra) => '<div class="page-head"><div><span class="eyebrow">' + icon(t.icone) + 'Ferramenta gratuita</span><h1>' + esc(t.nome) + '</h1><p>' + esc(t.desc) + '</p></div>' + (extra || '') + '</div>';
  const tool = (id) => TOOLS.find((t) => t.id === id);

  /* =========================================================
     Hub de ferramentas
     ========================================================= */
  route(/^\/ferramentas$/, 'ferramentas', function () {
    return {
      title: 'Ferramentas',
      crumbs: [['Início', '#/'], ['Ferramentas', '#/ferramentas']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('toolbox') + 'Kit do concurseiro</span><h1>Ferramentas de estudo</h1>' +
        '<p>Tudo gratuito, sem cadastro e salvo na sua conta. Funciona até offline depois do primeiro acesso.</p></div></div>' +
        '<div class="tiles">' +
          '<a class="tile" href="#/concursos"><span class="tile-icon">' + icon('calendar', 'i-lg') + '</span><h3>Meus Concursos</h3><p>Agenda de inscrições e provas com contagem regressiva.</p></a>' +
          TOOLS.map((t) => '<a class="tile" href="#/ferramentas/' + t.id + '"><span class="tile-icon">' + icon(t.icone, 'i-lg') + '</span><h3>' + esc(t.nome) + '</h3><p>' + esc(t.desc) + '</p></a>').join('') +
        '</div>'
    };
  });

  /* =========================================================
     Meus concursos (agenda + contagem regressiva)
     ========================================================= */
  const STATUS = ['Interessado', 'Inscrito', 'Taxa paga', 'Prova feita', 'Aprovado', 'Não aprovado'];

  function ics(e) {
    const d = e.data.replace(/-/g, '');
    const end = addDays(e.data, 1).replace(/-/g, '');
    const txt = (s) => String(s || '').replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Atlas Concursos//PT-BR', 'BEGIN:VEVENT',
      'UID:' + e.id + '@atlas-concursos', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + end,
      'SUMMARY:' + txt('Prova: ' + e.nome), 'DESCRIPTION:' + txt([e.cargo, e.banca, e.edital].filter(Boolean).join(' · ')),
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:' + txt('Amanhã: ' + e.nome), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  route(/^\/concursos$/, 'concursos', function () {
    const s = Store.state;
    const sorted = s.exams.slice().sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));
    const upcoming = sorted.filter((e) => !e.data || daysUntil(e.data) >= 0);
    const past = sorted.filter((e) => e.data && daysUntil(e.data) < 0).reverse();

    const examCard = (e) => {
      const d = e.data ? daysUntil(e.data) : null;
      const insc = e.inscricao ? daysUntil(e.inscricao) : null;
      let countdown = '<span class="badge">Sem data de prova</span>';
      if (d !== null) countdown = d < 0 ? '<span class="badge">Prova realizada</span>' : d === 0 ? '<span class="badge danger">É hoje!</span>' : '<span class="badge ' + (d <= 7 ? 'danger' : d <= 30 ? 'warn' : 'accent') + '">' + d + ' dia' + (d > 1 ? 's' : '') + ' para a prova</span>';
      let inscB = '';
      if (insc !== null && insc >= 0 && ['Interessado', 'Inscrito'].includes(e.status)) {
        inscB = '<span class="badge ' + (insc <= 3 ? 'danger' : 'warn') + '">' + (e.status === 'Inscrito' ? 'Pagamento/inscrição' : 'Inscrições') + ' até ' + fmtDate(e.inscricao) + '</span>';
      }
      return '<article class="card" data-id="' + e.id + '">' +
        '<div class="card-top">' + A.mono(e.nome, e.id) + '<div class="card-title"><h3>' + esc(e.nome) + '</h3><span class="domain">' + esc([e.cargo, e.banca].filter(Boolean).join(' · ') || 'Concurso') + '</span></div>' +
          '<button class="icon-btn" data-ex="del" title="Excluir" aria-label="Excluir">' + icon('trash') + '</button></div>' +
        '<div class="subs">' + countdown + inscB + '</div>' +
        (e.data ? '<p class="desc">' + icon('calendar', 'i-inline') + ' Prova em ' + fmtDate(e.data) + '</p>' : '') +
        '<div class="card-actions">' +
          '<select class="select" data-ex="status" style="flex:1;padding:7px 10px">' + STATUS.map((st) => '<option' + (st === e.status ? ' selected' : '') + '>' + st + '</option>').join('') + '</select>' +
          (e.edital ? A.extLink(e.edital, 'icon-btn', icon('external')).replace('<a ', '<a title="Abrir edital" ') : '') +
          (e.data ? '<button class="icon-btn" data-ex="ics" title="Adicionar ao calendário do celular" aria-label="Adicionar ao calendário">' + icon('calendar') + '</button>' : '') +
        '</div></article>';
    };

    return {
      title: 'Meus concursos',
      crumbs: [['Início', '#/'], ['Meus concursos', '#/concursos']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('calendar') + s.exams.length + ' concursos</span><h1>Meus concursos</h1>' +
        '<p>Acompanhe inscrições, pagamentos e datas de prova em um só lugar, com contagem regressiva e lembrete no calendário.</p></div></div>' +
        '<details class="panel panel-pad"' + (s.exams.length ? '' : ' open') + '><summary style="cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px">' + icon('plus') + 'Adicionar concurso</summary>' +
          '<form id="exam-form" class="form-grid" style="margin-top:14px">' +
            '<label class="field">Concurso *<input class="input" name="nome" required placeholder="Ex.: PM-MG Soldado 2026"></label>' +
            '<label class="field">Cargo<input class="input" name="cargo" placeholder="Ex.: Soldado"></label>' +
            '<label class="field">Banca<input class="input" name="banca" list="bancas" placeholder="Ex.: Cebraspe"></label>' +
            '<label class="field">Link do edital<input class="input" name="edital" placeholder="https://…" inputmode="url"></label>' +
            '<label class="field">Inscrições até<input class="input" name="inscricao" type="date"></label>' +
            '<label class="field">Data da prova<input class="input" name="data" type="date"></label>' +
            '<label class="field">Situação<select class="select" name="status">' + STATUS.map((st) => '<option>' + st + '</option>').join('') + '</select></label>' +
            '<datalist id="bancas">' + window.ATLAS_DATA.categorias.find((c) => c.id === 'bancas').itens.map((b) => '<option value="' + esc(b.n.split(' (')[0].split(' — ')[0]) + '">').join('') + '</datalist>' +
            '<div style="display:flex;align-items:flex-end"><button class="btn btn-primary" type="submit">' + icon('plus') + 'Adicionar</button></div>' +
          '</form></details>' +
        '<section class="section"><div class="section-head"><h2>' + icon('target') + 'Próximos</h2></div>' +
          (upcoming.length ? '<div class="cards">' + upcoming.map(examCard).join('') + '</div>' : A.emptyBox('calendar', 'Nenhum concurso cadastrado', 'Adicione os concursos que você vai prestar para não perder prazos.')) +
        '</section>' +
        (past.length ? '<section class="section"><div class="section-head"><h2>' + icon('check') + 'Encerrados</h2></div><div class="cards">' + past.map(examCard).join('') + '</div></section>' : ''),
      after(view) {
        $('#exam-form', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const f = Object.fromEntries(new FormData(ev.target));
          let edital = (f.edital || '').trim();
          if (edital && !/^https?:\/\//i.test(edital)) edital = 'https://' + edital;
          Store.update((s) => s.exams.push({ id: uid(), nome: f.nome.trim(), cargo: f.cargo.trim(), banca: f.banca.trim(), edital, inscricao: f.inscricao, data: f.data, status: f.status }));
          toast('Concurso adicionado!');
          render();
        });
        view.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-ex]'); if (!b || b.tagName === 'SELECT') return;
          const id = b.closest('[data-id]').dataset.id;
          const e = Store.state.exams.find((x) => x.id === id);
          if (b.dataset.ex === 'del') {
            if (!confirm('Excluir "' + e.nome + '"?')) return;
            Store.update((s) => { s.exams = s.exams.filter((x) => x.id !== id); });
            render();
          } else if (b.dataset.ex === 'ics') {
            A.download('prova-' + e.nome.replace(/[^\w-]+/g, '-').toLowerCase() + '.ics', ics(e), 'text/calendar');
            toast('Abra o arquivo para adicionar ao calendário');
          }
        });
        view.addEventListener('change', (ev) => {
          const sel = ev.target.closest('[data-ex="status"]'); if (!sel) return;
          const id = sel.closest('[data-id]').dataset.id;
          Store.update((s) => { s.exams.find((x) => x.id === id).status = sel.value; });
          toast('Situação atualizada');
          if (sel.value === 'Aprovado') toast('🎉 Parabéns pela aprovação!');
        });
      }
    };
  });

  /* =========================================================
     Pomodoro
     ========================================================= */
  const MODES = { focus: 'Foco', short: 'Pausa curta', long: 'Pausa longa' };
  const T = { mode: 'focus', running: false, endAt: 0, left: 0, cycles: 0, acc: 0, lastTick: 0, timer: null };

  const minutesFor = (m) => (Store.state.settings.pomodoro || {})[m] || { focus: 25, short: 5, long: 15 }[m];
  T.left = minutesFor('focus') * 60;

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, .25, .5].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(.25, ctx.currentTime + t + .02);
        g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + t + .2);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .22);
      });
    } catch (e) {}
  }
  function notify(text) {
    try { if ('Notification' in window && Notification.permission === 'granted') new Notification('Atlas Concursos', { body: text, icon: 'assets/img/logo.svg' }); } catch (e) {}
  }

  function addStudy(min) {
    Store.update((s) => { const k = dateKey(); s.study[k] = (s.study[k] || 0) + min; });
  }

  function tick() {
    const now = Date.now();
    if (T.running) {
      if (T.mode === 'focus') {
        T.acc += (now - T.lastTick) / 1000;
        if (T.acc >= 60) { const m = Math.floor(T.acc / 60); T.acc -= m * 60; addStudy(m); }
      }
      T.lastTick = now;
      T.left = Math.max(0, Math.round((T.endAt - now) / 1000));
      if (T.left === 0) finish();
    }
    paintTimer();
  }

  function finish() {
    T.running = false;
    clearInterval(T.timer); T.timer = null;
    beep();
    if (T.mode === 'focus') {
      if (T.acc >= 30) addStudy(1);
      T.acc = 0;
      T.cycles++;
      notify('Ciclo de foco concluído! Hora da pausa.');
      toast('Ciclo concluído! Hora da pausa ☕');
      setMode(T.cycles % 4 === 0 ? 'long' : 'short');
    } else {
      notify('Pausa encerrada. Bora voltar ao foco!');
      toast('Pausa encerrada. Bora focar! 💪');
      setMode('focus');
    }
  }
  function setMode(m) {
    T.mode = m; T.running = false; T.left = minutesFor(m) * 60;
    clearInterval(T.timer); T.timer = null;
    paintTimer();
  }
  function start() {
    if (T.running) return;
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    T.running = true; T.endAt = Date.now() + T.left * 1000; T.lastTick = Date.now();
    clearInterval(T.timer); T.timer = setInterval(tick, 1000);
    paintTimer();
  }
  function pause() {
    if (!T.running) return;
    tick();
    T.running = false; clearInterval(T.timer); T.timer = null;
    paintTimer();
  }

  function paintTimer() {
    const mm = pad(Math.floor(T.left / 60)), ss = pad(T.left % 60);
    if (T.running) document.title = '▶ ' + mm + ':' + ss + ' · ' + MODES[T.mode] + ' · Atlas';
    else if (document.title.startsWith('▶')) document.title = 'Atlas Concursos';
    const v = $('#pomo');
    if (!v) return;
    const total = minutesFor(T.mode) * 60;
    const C = 2 * Math.PI * 120;
    $('#pomo-time').textContent = mm + ':' + ss;
    $('#pomo-mode').textContent = MODES[T.mode];
    $('#pomo-bar').style.strokeDashoffset = C * (1 - T.left / total);
    $('#pomo-toggle').innerHTML = T.running ? icon('pause') + 'Pausar' : icon('play') + (T.left < total ? 'Continuar' : 'Iniciar');
    $$('[data-mode]', v).forEach((b) => b.classList.toggle('sel', b.dataset.mode === T.mode));
    $('#pomo-cycles').textContent = T.cycles;
    const today = Store.state.study[dateKey()] || 0;
    $('#pomo-today').textContent = fmtMin(today);
  }

  function weekBars() {
    const s = Store.state;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const k = addDays(dateKey(), -i);
      days.push({ k, m: s.study[k] || 0, label: i === 0 ? 'Hoje' : new Date(k + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') });
    }
    const max = Math.max(s.settings.dailyGoal || 120, ...days.map((d) => d.m));
    const total = days.reduce((a, d) => a + d.m, 0);
    return { html: '<div class="bars">' + days.map((d) => '<div class="b" title="' + fmtMin(d.m) + '"><em>' + (d.m ? fmtMin(d.m) : '') + '</em><i style="height:' + (d.m / max * 100) + '%"></i><span>' + d.label + '</span></div>').join('') + '</div>', total };
  }

  route(/^\/ferramentas\/pomodoro$/, 'tool-pomodoro', function () {
    const t = tool('pomodoro');
    const p = Store.state.settings.pomodoro;
    const C = 2 * Math.PI * 120;
    const wb = weekBars();
    return {
      title: t.nome,
      crumbs: crumbs(t),
      html: head(t) +
        '<div class="tool-layout">' +
          '<div class="panel timer-wrap" id="pomo">' +
            '<div class="subs">' + Object.keys(MODES).map((m) => '<button class="chip" data-mode="' + m + '">' + MODES[m] + '</button>').join('') + '</div>' +
            '<div class="ring"><svg viewBox="0 0 260 260"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>' +
              '<circle class="track" cx="130" cy="130" r="120"/><circle class="bar" id="pomo-bar" cx="130" cy="130" r="120" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg>' +
              '<div class="time"><b id="pomo-time">25:00</b><span id="pomo-mode">Foco</span></div></div>' +
            '<div class="btn-row"><button class="btn btn-primary" id="pomo-toggle"></button><button class="btn" id="pomo-reset">' + icon('refresh') + 'Reiniciar</button><button class="btn btn-ghost" id="pomo-skip">Pular ' + icon('chevron') + '</button></div>' +
            '<div class="kpis" style="width:100%"><div class="kpi"><b id="pomo-today">0min</b><span>estudado hoje</span></div><div class="kpi"><b id="pomo-cycles">0</b><span>ciclos nesta sessão</span></div></div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:16px">' +
            '<div class="panel panel-pad"><div class="section-head" style="margin:0"><h2 style="font-size:17px">' + icon('graduation') + 'Últimos 7 dias</h2><span class="badge accent">' + fmtMin(wb.total) + ' no total</span></div>' + wb.html + '</div>' +
            '<form class="panel panel-pad" id="pomo-cfg" style="display:flex;flex-direction:column;gap:12px">' +
              '<h2 style="font-size:17px">Ajustes</h2>' +
              '<div class="form-grid">' +
                '<label class="field">Foco (min)<input class="input" type="number" min="5" max="120" name="focus" value="' + p.focus + '"></label>' +
                '<label class="field">Pausa curta<input class="input" type="number" min="1" max="30" name="short" value="' + p.short + '"></label>' +
                '<label class="field">Pausa longa<input class="input" type="number" min="5" max="60" name="long" value="' + p.long + '"></label>' +
              '</div>' +
              '<div class="btn-row"><button class="btn btn-sm" type="submit">' + icon('check') + 'Salvar ajustes</button></div>' +
            '</form>' +
            '<form class="panel panel-pad" id="pomo-manual" style="display:flex;flex-direction:column;gap:10px">' +
              '<h2 style="font-size:17px">Registrar estudo manual</h2><p class="muted small">Estudou fora do cronômetro? Some aqui.</p>' +
              '<div style="display:flex;gap:10px"><input class="input" type="number" name="min" min="1" max="720" placeholder="Minutos" required><button class="btn" type="submit">' + icon('plus') + 'Somar</button></div>' +
            '</form>' +
          '</div>' +
        '</div>',
      after(view) {
        paintTimer();
        $('#pomo-toggle', view).addEventListener('click', () => (T.running ? pause() : start()));
        $('#pomo-reset', view).addEventListener('click', () => { pause(); setMode(T.mode); });
        $('#pomo-skip', view).addEventListener('click', () => { pause(); if (T.mode === 'focus') { T.cycles++; setMode(T.cycles % 4 === 0 ? 'long' : 'short'); } else setMode('focus'); });
        $$('[data-mode]', view).forEach((b) => b.addEventListener('click', () => { pause(); setMode(b.dataset.mode); }));
        $('#pomo-cfg', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const f = Object.fromEntries(new FormData(ev.target));
          Store.update((s) => { s.settings.pomodoro = { focus: +f.focus || 25, short: +f.short || 5, long: +f.long || 15 }; });
          if (!T.running) setMode(T.mode);
          toast('Ajustes salvos');
        });
        $('#pomo-manual', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const m = parseInt(new FormData(ev.target).get('min'), 10);
          if (m > 0) { addStudy(m); toast(fmtMin(m) + ' adicionados'); render(); }
        });
      }
    };
  });

  /* =========================================================
     Edital verticalizado + revisões espaçadas
     ========================================================= */
  const REV_DAYS = [1, 7, 30];
  const COLORS = [190, 265, 150, 30, 330, 210, 100, 0];

  function setTopicDone(sid, tid, done) {
    Store.update((s) => {
      const sub = s.subjects.find((x) => x.id === sid);
      const t = sub && sub.topics.find((x) => x.id === tid);
      if (!t) return;
      t.done = done; t.doneAt = done ? dateKey() : '';
      s.revisions = s.revisions.filter((r) => r.topicId !== tid || r.done);
      if (done) REV_DAYS.forEach((d) => s.revisions.push({ id: uid(), topicId: tid, subjectId: sid, label: t.nome, subject: sub.nome, due: addDays(dateKey(), d), step: d, done: false }));
    });
  }

  route(/^\/ferramentas\/edital$/, 'tool-edital', function () {
    const t = tool('edital');
    const s = Store.state;
    const total = s.subjects.reduce((a, x) => a + x.topics.length, 0);
    const done = s.subjects.reduce((a, x) => a + x.topics.filter((y) => y.done).length, 0);
    const pct = total ? Math.round(done / total * 100) : 0;

    const subj = (x) => {
      const d = x.topics.filter((y) => y.done).length;
      const p = x.topics.length ? Math.round(d / x.topics.length * 100) : 0;
      return '<div class="panel subject" data-sid="' + x.id + '">' +
        '<div class="subject-head"><span class="mono" style="--h:' + x.cor + ';width:34px;height:34px;font-size:11px">' + esc(x.nome.slice(0, 2).toUpperCase()) + '</span><h3>' + esc(x.nome) + '</h3>' +
          '<span class="badge' + (p === 100 ? ' ok' : '') + '">' + d + '/' + x.topics.length + '</span>' +
          '<button class="icon-btn" data-ed="del-subject" title="Excluir matéria" aria-label="Excluir matéria">' + icon('trash') + '</button></div>' +
        '<div class="progress" style="margin:12px 0 6px"><i style="width:' + p + '%"></i></div>' +
        '<div>' + x.topics.map((y) => '<div class="topic' + (y.done ? ' done' : '') + '" data-tid="' + y.id + '">' +
          '<button class="check' + (y.done ? ' on' : '') + '" data-ed="toggle" aria-label="Marcar como estudado" aria-pressed="' + !!y.done + '">' + (y.done ? icon('check') : '') + '</button>' +
          '<span>' + esc(y.nome) + '</span>' +
          '<button class="icon-btn" style="width:28px;height:28px" data-ed="del-topic" aria-label="Remover tópico">' + icon('x') + '</button></div>').join('') + '</div>' +
        '<form data-ed="add-topics" style="margin-top:10px;display:flex;flex-direction:column;gap:8px">' +
          '<textarea class="textarea" name="topics" rows="2" style="min-height:60px" placeholder="Cole os tópicos do edital (um por linha)"></textarea>' +
          '<div><button class="btn btn-sm" type="submit">' + icon('plus') + 'Adicionar tópicos</button></div></form>' +
      '</div>';
    };

    return {
      title: t.nome,
      crumbs: crumbs(t),
      html: head(t) +
        '<div class="kpis"><div class="kpi"><b>' + pct + '%</b><span>do edital estudado</span></div><div class="kpi"><b>' + done + '/' + total + '</b><span>tópicos concluídos</span></div><div class="kpi"><b>' + s.subjects.length + '</b><span>matérias</span></div>' +
          '<div class="kpi"><b>' + s.revisions.filter((r) => !r.done && r.due <= dateKey()).length + '</b><span>revisões para hoje</span></div></div>' +
        '<form class="panel panel-pad section" id="subject-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">' +
          '<label class="field" style="flex:1;min-width:220px">Nova matéria<input class="input" name="nome" required placeholder="Ex.: Direito Constitucional"></label>' +
          '<button class="btn btn-primary" type="submit">' + icon('plus') + 'Adicionar matéria</button></form>' +
        '<p class="muted small" style="margin-top:12px">' + icon('info', 'i-inline') + ' Ao marcar um tópico como estudado, criamos revisões automáticas para daqui a 1, 7 e 30 dias.</p>' +
        '<div class="tool-layout section" id="subjects">' + (s.subjects.length ? s.subjects.map(subj).join('') : '') + '</div>' +
        (s.subjects.length ? '' : A.emptyBox('list', 'Monte seu edital verticalizado', 'Adicione as matérias do seu concurso e cole os tópicos do conteúdo programático.')),
      after(view) {
        $('#subject-form', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          const nome = new FormData(ev.target).get('nome').trim();
          if (!nome) return;
          Store.update((s) => s.subjects.push({ id: uid(), nome, cor: COLORS[s.subjects.length % COLORS.length], topics: [] }));
          render();
        });
        view.addEventListener('submit', (ev) => {
          const f = ev.target.closest('[data-ed="add-topics"]'); if (!f) return;
          ev.preventDefault();
          const sid = f.closest('[data-sid]').dataset.sid;
          const lines = new FormData(f).get('topics').split(/\n|;/).map((l) => l.replace(/^[\s\d.)\-–•]+/, '').trim()).filter(Boolean);
          if (!lines.length) return;
          Store.update((s) => { const x = s.subjects.find((y) => y.id === sid); lines.forEach((nome) => x.topics.push({ id: uid(), nome, done: false })); });
          toast(lines.length + ' tópico(s) adicionado(s)');
          render();
        });
        view.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-ed]'); if (!b || b.tagName === 'FORM') return;
          const sid = b.closest('[data-sid]') && b.closest('[data-sid]').dataset.sid;
          const tid = b.closest('[data-tid]') && b.closest('[data-tid]').dataset.tid;
          if (b.dataset.ed === 'toggle') {
            const x = Store.state.subjects.find((y) => y.id === sid).topics.find((y) => y.id === tid);
            setTopicDone(sid, tid, !x.done);
            if (!x.done) toast('Revisões agendadas: amanhã, em 7 e em 30 dias');
            render();
          } else if (b.dataset.ed === 'del-topic') {
            Store.update((s) => {
              const x = s.subjects.find((y) => y.id === sid); x.topics = x.topics.filter((y) => y.id !== tid);
              s.revisions = s.revisions.filter((r) => r.topicId !== tid);
            });
            render();
          } else if (b.dataset.ed === 'del-subject') {
            if (!confirm('Excluir a matéria e todos os tópicos?')) return;
            Store.update((s) => { s.subjects = s.subjects.filter((y) => y.id !== sid); s.revisions = s.revisions.filter((r) => r.subjectId !== sid); });
            render();
          }
        });
      }
    };
  });

  route(/^\/ferramentas\/revisoes$/, 'tool-revisoes', function () {
    const t = tool('revisoes');
    const s = Store.state;
    const today = dateKey();
    const pending = s.revisions.filter((r) => !r.done).sort((a, b) => a.due.localeCompare(b.due));
    const now = pending.filter((r) => r.due <= today);
    const soon = pending.filter((r) => r.due > today).slice(0, 30);
    const doneCount = s.revisions.filter((r) => r.done).length;
    const row = (r) => {
      const d = daysUntil(r.due);
      const when = d < 0 ? '<span class="badge danger">atrasada ' + (-d) + 'd</span>' : d === 0 ? '<span class="badge warn">hoje</span>' : '<span class="badge">' + fmtDate(r.due) + '</span>';
      return '<div class="row" data-rid="' + r.id + '"><button class="check" data-rv="done" aria-label="Marcar revisão como feita"></button>' +
        '<div class="grow"><div class="title">' + esc(r.label) + '</div><div class="sub">' + esc(r.subject) + ' · revisão de ' + r.step + ' dia' + (r.step > 1 ? 's' : '') + '</div></div>' + when + '</div>';
    };
    return {
      title: t.nome,
      crumbs: crumbs(t),
      html: head(t, '<a class="btn" href="#/ferramentas/edital">' + icon('list') + 'Edital verticalizado</a>') +
        '<div class="kpis"><div class="kpi"><b>' + now.length + '</b><span>para hoje / atrasadas</span></div><div class="kpi"><b>' + soon.length + '</b><span>próximas</span></div><div class="kpi"><b>' + doneCount + '</b><span>revisões feitas</span></div></div>' +
        '<section class="section"><div class="section-head"><h2>' + icon('refresh') + 'Revisar agora</h2></div>' +
          (now.length ? '<div class="list">' + now.map(row).join('') + '</div>' : A.emptyBox('check', 'Tudo em dia!', 'Nenhuma revisão pendente para hoje. Marque tópicos como estudados no Edital Verticalizado para gerar revisões.')) + '</section>' +
        (soon.length ? '<section class="section"><div class="section-head"><h2>' + icon('calendar') + 'Próximas revisões</h2></div><div class="list">' + soon.map(row).join('') + '</div></section>' : ''),
      after(view) {
        view.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-rv="done"]'); if (!b) return;
          const id = b.closest('[data-rid]').dataset.rid;
          Store.update((s) => { const r = s.revisions.find((x) => x.id === id); if (r) { r.done = true; r.doneAt = dateKey(); } });
          toast('Revisão concluída ✔');
          render();
        });
      }
    };
  });

  /* =========================================================
     Calculadora de nota
     ========================================================= */
  let notaMode = 'ce';
  route(/^\/ferramentas\/nota$/, 'tool-nota', function () {
    const t = tool('nota');
    const ce = notaMode === 'ce';
    return {
      title: t.nome,
      crumbs: crumbs(t),
      html: head(t) +
        '<div class="tabs"><button class="chip' + (ce ? ' sel' : '') + '" data-nm="ce">Cebraspe — Certo ou Errado</button><button class="chip' + (!ce ? ' sel' : '') + '" data-nm="me">Múltipla escolha</button></div>' +
        '<div class="tool-layout">' +
          '<form class="panel panel-pad" id="nota-form" style="display:flex;flex-direction:column;gap:12px">' +
            '<div class="form-grid">' +
              '<label class="field">Total de ' + (ce ? 'itens' : 'questões') + '<input class="input" type="number" min="1" name="total" value="' + (ce ? 120 : 60) + '"></label>' +
              '<label class="field">Acertos<input class="input" type="number" min="0" name="a" value="0"></label>' +
              (ce ? '<label class="field">Erros<input class="input" type="number" min="0" name="e" value="0"></label>' : '') +
              '<label class="field">Peso por ' + (ce ? 'item' : 'questão') + '<input class="input" type="number" min="0" step="0.1" name="peso" value="1"></label>' +
              '<label class="field">Nota de corte (opcional)<input class="input" type="number" step="0.1" name="corte" placeholder="—"></label>' +
            '</div>' +
            (ce ? '<p class="muted small">No modelo Cebraspe, cada erro anula um acerto: <b>nota = (acertos − erros) × peso</b>. Itens em branco valem zero.</p>'
                : '<p class="muted small">Na múltipla escolha tradicional não há desconto por erro: <b>nota = acertos × peso</b>.</p>') +
          '</form>' +
          '<div class="panel panel-pad" id="nota-out" style="display:flex;flex-direction:column;gap:14px"></div>' +
        '</div>',
      after(view) {
        $$('[data-nm]', view).forEach((b) => b.addEventListener('click', () => { notaMode = b.dataset.nm; render(); }));
        const form = $('#nota-form', view), out = $('#nota-out', view);
        const calc = () => {
          const f = Object.fromEntries(new FormData(form));
          const total = Math.max(1, +f.total || 1), peso = +f.peso || 0;
          let a = Math.max(0, +f.a || 0), e = Math.max(0, +f.e || 0);
          if (!ce) e = Math.max(0, total - a);
          const over = a + (ce ? e : 0) > total;
          const nota = ce ? (a - e) * peso : a * peso;
          const max = total * peso;
          const pct = max ? nota / max * 100 : 0;
          const brancos = ce ? Math.max(0, total - a - e) : 0;
          const corte = f.corte !== '' && f.corte != null ? +f.corte : null;
          const diff = corte != null ? nota - corte : null;
          out.innerHTML =
            '<span class="eyebrow">' + icon('target') + 'Resultado</span>' +
            '<div class="result-big ' + (pct >= 50 ? 'grad-text' : '') + '">' + nota.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' <span class="muted" style="font-size:18px">/ ' + max.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '</span></div>' +
            '<div class="progress"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div>' +
            (over ? '<span class="badge danger">Acertos + erros passam do total de itens</span>' : '') +
            '<div class="kpis">' +
              '<div class="kpi"><b>' + pct.toFixed(1).replace('.', ',') + '%</b><span>aproveitamento</span></div>' +
              (ce ? '<div class="kpi"><b>' + brancos + '</b><span>em branco</span></div>' : '<div class="kpi"><b>' + e + '</b><span>erros</span></div>') +
              (diff != null ? '<div class="kpi"><b style="color:' + (diff >= 0 ? 'var(--c3)' : 'var(--danger)') + '">' + (diff >= 0 ? '+' : '') + diff.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '</b><span>' + (diff >= 0 ? 'acima do corte' : 'abaixo do corte') + '</span></div>' : '') +
            '</div>' +
            (ce ? '<p class="muted small"><b>Vale chutar?</b> Na Cebraspe, um chute com 50% de chance tem valor esperado zero. Só arrisque quando tiver mais de 50% de certeza — por exemplo, quando conseguir eliminar uma das interpretações.</p>' : '');
        };
        form.addEventListener('input', calc);
        calc();
      }
    };
  });

  /* =========================================================
     Planejador de estudos
     ========================================================= */
  const planner = () => Store.state.planner || { prova: '', horasDia: 3, dias: 6, materias: [] };

  route(/^\/ferramentas\/planejador$/, 'tool-planejador', function () {
    const t = tool('planejador');
    const p = planner();
    const nextExam = Store.state.exams.filter((e) => e.data && daysUntil(e.data) > 0).sort((a, b) => a.data.localeCompare(b.data))[0];
    const matRow = (m, i) => '<div class="row" data-i="' + i + '" style="flex-wrap:wrap">' +
      '<input class="input" data-k="nome" value="' + esc(m.nome) + '" placeholder="Matéria" style="flex:2;min-width:160px">' +
      '<label class="field" style="flex-direction:row;align-items:center;gap:6px">Peso<select class="select" data-k="peso" style="width:auto">' + [1, 2, 3, 4, 5].map((n) => '<option' + (n === m.peso ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' +
      '<label class="field" style="flex-direction:row;align-items:center;gap:6px">Dificuldade<select class="select" data-k="dif" style="width:auto">' + [['1', 'Fácil'], ['2', 'Média'], ['3', 'Difícil']].map((d) => '<option value="' + d[0] + '"' + (+d[0] === m.dif ? ' selected' : '') + '>' + d[1] + '</option>').join('') + '</select></label>' +
      '<button class="icon-btn" data-pl="del" aria-label="Remover matéria">' + icon('x') + '</button></div>';
    return {
      title: t.nome,
      crumbs: crumbs(t),
      html: head(t) +
        '<div class="tool-layout">' +
          '<div class="panel panel-pad" style="display:flex;flex-direction:column;gap:14px" id="pl">' +
            '<div class="form-grid">' +
              '<label class="field">Data da prova<input class="input" type="date" id="pl-prova" value="' + esc(p.prova) + '"></label>' +
              '<label class="field">Horas por dia<input class="input" type="number" min="0.5" max="16" step="0.5" id="pl-horas" value="' + p.horasDia + '"></label>' +
              '<label class="field">Dias por semana<input class="input" type="number" min="1" max="7" id="pl-dias" value="' + p.dias + '"></label>' +
            '</div>' +
            (nextExam && !p.prova ? '<button class="btn btn-sm" id="pl-use-exam" style="align-self:flex-start">' + icon('calendar') + 'Usar data de "' + esc(nextExam.nome) + '"</button>' : '') +
            '<h3 style="font-size:16px">Matérias</h3>' +
            '<div class="list" id="pl-mats">' + p.materias.map(matRow).join('') + '</div>' +
            '<div class="btn-row"><button class="btn btn-sm" id="pl-add">' + icon('plus') + 'Adicionar matéria</button>' +
              (Store.state.subjects.length ? '<button class="btn btn-sm" id="pl-import">' + icon('list') + 'Importar do edital verticalizado</button>' : '') + '</div>' +
          '</div>' +
          '<div class="panel panel-pad" id="pl-out" style="display:flex;flex-direction:column;gap:14px"></div>' +
        '</div>',
      after(view) {
        const save = (fn) => { Store.update((s) => { s.planner = s.planner || planner(); fn(s.planner); }); };
        const calc = () => {
          const pl = planner();
          const out = $('#pl-out', view);
          const weekly = pl.horasDia * pl.dias;
          const days = pl.prova ? daysUntil(pl.prova) : null;
          const totalH = days != null && days > 0 ? Math.round(days / 7 * weekly) : null;
          const mats = pl.materias.filter((m) => m.nome.trim());
          const sum = mats.reduce((a, m) => a + m.peso * m.dif, 0) || 1;
          out.innerHTML = '<span class="eyebrow">' + icon('target') + 'Seu plano</span>' +
            '<div class="kpis"><div class="kpi"><b>' + weekly.toLocaleString('pt-BR') + 'h</b><span>por semana</span></div>' +
            (days != null ? '<div class="kpi"><b>' + (days > 0 ? days : 0) + '</b><span>dias até a prova</span></div><div class="kpi"><b>' + (totalH || 0) + 'h</b><span>de estudo até lá</span></div>' : '') + '</div>' +
            (mats.length ? '<div class="list">' + mats.map((m) => {
              const h = weekly * (m.peso * m.dif) / sum;
              return '<div class="row"><div class="grow"><div class="title">' + esc(m.nome) + '</div><div class="progress" style="margin-top:8px"><i style="width:' + (m.peso * m.dif / sum * 100) + '%"></i></div></div>' +
                '<span class="badge accent">' + fmtMin(h * 60) + '/sem</span></div>';
            }).join('') + '</div><p class="muted small">Distribuição proporcional a peso × dificuldade. Reserve ~20% do tempo para revisões e questões.</p>'
            : A.emptyBox('target', 'Adicione suas matérias', 'Informe peso e dificuldade para receber a divisão de horas.'));
        };
        calc();
        const bindInputs = () => {
          $('#pl-prova', view).onchange = (e) => { save((p) => { p.prova = e.target.value; }); calc(); };
          $('#pl-horas', view).oninput = (e) => { save((p) => { p.horasDia = Math.max(0.5, +e.target.value || 1); }); calc(); };
          $('#pl-dias', view).oninput = (e) => { save((p) => { p.dias = Math.min(7, Math.max(1, +e.target.value || 1)); }); calc(); };
        };
        bindInputs();
        const ue = $('#pl-use-exam', view);
        if (ue) ue.addEventListener('click', () => { save((p) => { p.prova = nextExam.data; }); render(); });
        $('#pl-add', view).addEventListener('click', () => { save((p) => p.materias.push({ nome: '', peso: 1, dif: 2 })); render(); });
        const imp = $('#pl-import', view);
        if (imp) imp.addEventListener('click', () => {
          save((p) => Store.state.subjects.forEach((x) => { if (!p.materias.some((m) => m.nome === x.nome)) p.materias.push({ nome: x.nome, peso: 1, dif: 2 }); }));
          render();
        });
        const mats = $('#pl-mats', view);
        const onEdit = (e) => {
          const el = e.target.closest('[data-k]'); if (!el) return;
          const i = +el.closest('[data-i]').dataset.i;
          save((p) => { p.materias[i][el.dataset.k] = el.dataset.k === 'nome' ? el.value : +el.value; });
          calc();
        };
        mats.addEventListener('input', onEdit);
        mats.addEventListener('change', onEdit);
        mats.addEventListener('click', (e) => {
          const b = e.target.closest('[data-pl="del"]'); if (!b) return;
          const i = +b.closest('[data-i]').dataset.i;
          save((p) => p.materias.splice(i, 1));
          render();
        });
      }
    };
  });

  /* =========================================================
     Bloco de notas
     ========================================================= */
  route(/^\/ferramentas\/notas$/, 'tool-notas', function () {
    const t = tool('notas');
    return {
      title: t.nome,
      crumbs: crumbs(t),
      html: head(t, '<button class="btn" id="notes-dl">' + icon('download') + 'Baixar .txt</button>') +
        '<div class="panel panel-pad"><textarea class="textarea" id="notes" style="min-height:52vh;font-size:15px" placeholder="Anote macetes, artigos de lei, dúvidas para revisar…">' + esc(Store.state.notes) + '</textarea>' +
        '<p class="muted small" style="margin-top:10px" id="notes-status">Salvo automaticamente.</p></div>',
      after(view) {
        const ta = $('#notes', view), st = $('#notes-status', view);
        let timer;
        ta.addEventListener('input', () => {
          st.textContent = 'Salvando…';
          clearTimeout(timer);
          timer = setTimeout(() => { Store.update((s) => { s.notes = ta.value; }); st.textContent = 'Salvo · ' + ta.value.length + ' caracteres'; }, 500);
        });
        $('#notes-dl', view).addEventListener('click', () => A.download('anotacoes-atlas-concursos.txt', ta.value, 'text/plain'));
      }
    };
  });
})();
