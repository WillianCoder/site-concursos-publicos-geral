/*
 * Atlas Concursos — Agenda de Inscrições.
 * Mostra inscrições abertas, as que abrem em breve, provas próximas e as encerradas.
 * Os dados vêm de data/agenda.js, editado pelo Painel do Administrador.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { $, $$, esc, icon, toast, route, Store, daysUntil, uid } = A;
  const DATA = window.ATLAS_DATA;
  const AG = window.ATLAS_AGENDA || { itens: [] };

  const AREAS = [['seguranca', 'Segurança'], ['tribunais', 'Tribunais e MP'], ['fiscal', 'Fiscal e controle'], ['administrativa', 'Administrativa'], ['bancaria', 'Bancos e estatais'], ['saude-educacao', 'Saúde e educação'], ['ti', 'Tecnologia'], ['militar', 'Forças Armadas']];
  const areaName = Object.fromEntries(AREAS);
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const fmt = (k) => { if (!k) return ''; const [y, m, d] = k.split('-'); return d + '/' + m + '/' + y; };
  const plural = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');

  const itens = (AG.itens || []).filter((x) => x && x.orgao && (x.inscFim || x.inscInicio || x.prova));

  // Situação de cada concurso a partir das datas.
  function status(x) {
    const ini = x.inscInicio ? daysUntil(x.inscInicio) : null;
    const fim = x.inscFim ? daysUntil(x.inscFim) : null;
    const prova = x.prova ? daysUntil(x.prova) : null;
    if (ini !== null && ini > 0) return { key: 'breve', pill: 'Abre em ' + plural(ini, 'dia'), tone: 'accent', date: x.inscInicio, dateLabel: 'abre' };
    if (fim !== null && fim >= 0) return { key: 'abertas', pill: fim === 0 ? 'Último dia!' : 'Encerra em ' + plural(fim, 'dia'), tone: fim <= 3 ? 'danger' : fim <= 7 ? 'warn' : 'ok', date: x.inscFim, dateLabel: 'até' };
    if (prova !== null && prova >= 0) return { key: 'prova', pill: prova === 0 ? 'Prova hoje' : 'Prova em ' + plural(prova, 'dia'), tone: 'accent', date: x.prova, dateLabel: 'prova' };
    if (fim !== null && fim >= -60) return { key: 'encerradas', pill: 'Encerrada', tone: '', date: x.inscFim, dateLabel: 'encerrou' };
    return null;
  }
  const withStatus = itens.map((x) => ({ x, s: status(x) })).filter((r) => r.s);
  const count = (k) => withStatus.filter((r) => r.s.key === k).length;

  A.navTop.push({ href: '#/agenda', icon: 'calendar', label: 'Agenda de Inscrições', count: () => count('abertas') || null });
  A.pages.push({ n: 'Agenda de Inscrições (abertas, em breve, encerradas)', href: '#/agenda', ic: 'calendar', sub: 'Acompanhamento' });

  function follow(x) {
    let added = false;
    Store.update((s) => {
      if (s.exams.some((e) => e.agendaId === x.id)) return;
      s.exams.push({ id: uid(), agendaId: x.id, nome: x.orgao + (x.cargo ? ' — ' + x.cargo : ''), cargo: x.cargo || '', banca: x.banca || '', edital: A.safeUrl(x.edital), inscricao: x.inscFim || '', data: x.prova || '', status: 'Interessado' });
      added = true;
    });
    A.renderNav();
    toast(added ? 'Adicionado aos Meus concursos, com contagem regressiva' : 'Você já acompanha este concurso');
  }

  function item({ x, s }) {
    const [y, m, d] = (s.date || '').split('-');
    const following = Store.state.exams.some((e) => e.agendaId === x.id);
    let bar = '';
    if (s.key === 'abertas' && x.inscInicio && x.inscFim) {
      const total = Math.max(1, daysUntil(x.inscFim) - daysUntil(x.inscInicio));
      const passed = Math.min(total, Math.max(0, -daysUntil(x.inscInicio)));
      bar = '<div class="progress ag-progress" title="Período de inscrição"><i style="width:' + Math.round(passed / total * 100) + '%"></i></div>';
    }
    const meta = [x.banca, x.uf || 'Nacional', x.vagas ? x.vagas + ' vagas' : '', x.salario ? 'até ' + x.salario : ''].filter(Boolean).map(esc).join(' · ');
    return '<article class="ag-item ag-' + s.key + '" data-id="' + esc(x.id) + '">' +
      '<div class="ag-date"><b>' + esc(d || '—') + '</b><span>' + esc(m ? MES[+m - 1] : '') + '</span><small>' + esc(s.dateLabel) + '</small></div>' +
      '<div class="ag-body"><div class="ag-title">' + esc(x.orgao) + (x.cargo ? ' <span class="muted">— ' + esc(x.cargo) + '</span>' : '') + '</div>' +
        '<div class="ag-meta">' + meta + '</div>' +
        '<div class="ag-dates">' +
          (x.inscInicio || x.inscFim ? '<span>Inscrições: ' + (x.inscInicio ? fmt(x.inscInicio) + ' a ' : 'até ') + fmt(x.inscFim) + '</span>' : '') +
          (x.prova ? '<span>Prova: ' + fmt(x.prova) + '</span>' : '') + '</div>' +
        bar + (x.obs ? '<div class="ag-obs">' + esc(x.obs) + '</div>' : '') + '</div>' +
      '<div class="ag-side"><span class="badge ' + s.tone + '">' + esc(s.pill) + '</span><div class="ag-actions">' +
        (A.safeUrl(x.edital) ? A.extLink(x.edital, 'btn btn-sm btn-primary', 'Edital') : '') +
        (A.safeUrl(x.site) ? A.extLink(x.site, 'icon-btn', icon('external')).replace('<a ', '<a title="Site oficial" ') : '') +
        (s.key !== 'encerradas' ? '<button class="icon-btn' + (following ? ' fav on' : '') + '" data-follow="' + esc(x.id) + '" title="' + (following ? 'Você acompanha' : 'Acompanhar em Meus concursos') + '" aria-label="Acompanhar">' + icon('star') + '</button>' : '') +
      '</div></div></article>';
  }

  function sectionsHtml(list, compact) {
    const by = (k) => list.filter((r) => r.s.key === k);
    const asc = (a, b) => (a.s.date || '').localeCompare(b.s.date || '');
    const block = (k, title, ic, rows, open) => rows.length
      ? (k === 'encerradas' && !open
        ? '<details class="section ag-section"><summary class="section-head"><h2>' + icon(ic) + title + ' <span class="badge">' + rows.length + '</span></h2></summary><div class="ag-list">' + rows.map(item).join('') + '</div></details>'
        : '<section class="section ag-section"><div class="section-head"><h2>' + icon(ic) + title + ' <span class="badge">' + rows.length + '</span></h2></div><div class="ag-list">' + rows.map(item).join('') + '</div></section>')
      : '';
    if (compact) return '<div class="ag-list">' + by('abertas').sort(asc).slice(0, 4).map(item).join('') + '</div>';
    return block('abertas', 'Inscrições abertas', 'check', by('abertas').sort(asc)) +
      block('breve', 'Abrem em breve', 'clock', by('breve').sort(asc)) +
      block('prova', 'Provas chegando', 'target', by('prova').sort(asc)) +
      block('encerradas', 'Encerradas nos últimos 60 dias', 'flag', by('encerradas').sort(asc).reverse());
  }

  function bindFollow(root) {
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-follow]'); if (!b) return;
      const x = itens.find((i) => String(i.id) === b.dataset.follow);
      if (x) { follow(x); b.classList.add('fav', 'on'); }
    });
  }

  /* ---------- Página ---------- */
  const ui = { uf: '', area: '', q: '' };
  route(/^\/agenda$/, 'agenda', function () {
    const my = Store.state.profile.uf;
    const ufs = Array.from(new Set(itens.map((x) => x.uf).filter(Boolean))).sort();
    const soon7 = withStatus.filter((r) => r.s.key === 'abertas' && daysUntil(r.x.inscFim) <= 7).length;
    const prova30 = withStatus.filter((r) => r.x.prova && daysUntil(r.x.prova) >= 0 && daysUntil(r.x.prova) <= 30).length;
    return {
      title: 'Agenda de Inscrições',
      crumbs: [['Início', '#/'], ['Agenda de Inscrições', '#/agenda']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('calendar') + 'Acompanhamento</span><h1>Agenda de Inscrições</h1>' +
        '<p>Quais concursos estão com inscrições abertas, quais abrem em breve e quando são as provas. Toque na ★ para acompanhar com contagem regressiva.</p></div>' +
        (AG.atualizadoEm ? '<span class="badge">Atualizada em ' + esc(fmt(AG.atualizadoEm)) + '</span>' : '') + '</div>' +
        '<div class="kpis ag-kpis">' +
          '<div class="kpi"><b>' + count('abertas') + '</b><span>inscrições abertas</span></div>' +
          '<div class="kpi"><b style="color:' + (soon7 ? 'var(--warn)' : 'inherit') + '">' + soon7 + '</b><span>encerram em 7 dias</span></div>' +
          '<div class="kpi"><b>' + count('breve') + '</b><span>abrem em breve</span></div>' +
          '<div class="kpi"><b>' + prova30 + '</b><span>provas em 30 dias</span></div>' +
        '</div>' +
        '<div class="toolbar section">' +
          '<div class="filter-input">' + icon('search') + '<input class="input" id="ag-q" type="search" placeholder="Buscar órgão, cargo ou banca" value="' + esc(ui.q) + '"></div>' +
          '<select class="select" id="ag-uf" style="width:auto"><option value="">Todo o Brasil</option><option value="BR"' + (ui.uf === 'BR' ? ' selected' : '') + '>Só nacionais</option>' +
            (my ? '<option value="' + my + '"' + (ui.uf === my ? ' selected' : '') + '>Meu estado (' + my + ')</option>' : '') +
            ufs.filter((u) => u !== my).map((u) => '<option' + (ui.uf === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select>' +
        '</div>' +
        '<div class="subs" id="ag-areas"><button class="chip' + (!ui.area ? ' sel' : '') + '" data-area="">Todas as áreas</button>' +
          AREAS.filter((a) => itens.some((x) => x.area === a[0])).map((a) => '<button class="chip' + (ui.area === a[0] ? ' sel' : '') + '" data-area="' + a[0] + '">' + a[1] + '</button>').join('') + '</div>' +
        '<div id="ag-out"></div>' +
        '<p class="muted small" style="margin-top:18px">' + icon('info', 'i-inline') + ' Datas conferidas nos editais oficiais pela equipe do Atlas. Prazos podem ser prorrogados ou retificados: confirme sempre no edital antes de pagar a inscrição.</p>',
      after(view) {
        const out = $('#ag-out', view);
        const draw = () => {
          const q = A.norm(ui.q);
          const list = withStatus.filter(({ x }) =>
            (!ui.uf || (ui.uf === 'BR' ? !x.uf : x.uf === ui.uf)) &&
            (!ui.area || x.area === ui.area) &&
            (!q || A.norm([x.orgao, x.cargo, x.banca, x.uf, areaName[x.area]].join(' ')).includes(q)));
          out.innerHTML = list.length ? sectionsHtml(list) : (itens.length
            ? A.emptyBox('calendar', 'Nada com esses filtros', 'Tente outro estado ou área.')
            : A.emptyBox('calendar', 'A agenda está sendo montada', 'Em breve, os concursos com inscrições abertas e as próximas provas aparecem aqui. Enquanto isso, veja o <a class="grad-text" href="#/radar">Radar de Editais</a>.'));
          A.hydrateIcons(out);
        };
        draw();
        bindFollow(out);
        $('#ag-q', view).addEventListener('input', (e) => { ui.q = e.target.value; draw(); });
        $('#ag-uf', view).addEventListener('change', (e) => { ui.uf = e.target.value; draw(); });
        $('#ag-areas', view).addEventListener('click', (e) => {
          const b = e.target.closest('[data-area]'); if (!b) return;
          ui.area = b.dataset.area;
          $$('[data-area]', view).forEach((x) => x.classList.toggle('sel', x === b));
          draw();
        });
      }
    };
  });

  /* ---------- Na página inicial e nos estados ---------- */
  A.afterRender.push((view, cur) => {
    if (cur.name === 'home' && count('abertas')) {
      const widgets = $('.widgets', view);
      if (widgets) {
        widgets.insertAdjacentHTML('afterend', '<section class="section"><div class="section-head"><h2>' + icon('calendar') + 'Inscrições abertas <span class="badge ok">' + count('abertas') + '</span></h2><a class="link-more" href="#/agenda">Agenda completa ' + icon('chevron') + '</a></div>' + sectionsHtml(withStatus, true) + '</section>');
        bindFollow(widgets.nextElementSibling);
      }
    }
    if (cur.name === 'uf') {
      const uf = String(cur.params[0]).toUpperCase();
      const list = withStatus.filter((r) => r.x.uf === uf && r.s.key !== 'encerradas');
      const anchor = $('.panel', view);
      if (list.length && anchor) {
        anchor.insertAdjacentHTML('afterend', '<section class="section"><div class="section-head"><h2>' + icon('calendar') + 'Agenda de ' + esc(uf) + '</h2><a class="link-more" href="#/agenda">Ver todos ' + icon('chevron') + '</a></div>' + sectionsHtml(list).replace(/<section class="section ag-section">/g, '<section class="ag-section">') + '</section>');
        bindFollow(anchor.nextElementSibling);
      }
    }
  });

  A.agenda = { itens, status, AREAS };
})();
