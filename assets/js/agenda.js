/*
 * Atlas Concursos — concursos com inscrições abertas (conferidos pela equipe).
 * Os dados vêm de data/agenda.js, editado pelo Painel do Administrador.
 * Só entra o que está com inscrição aberta hoje; encerradas nunca aparecem.
 * A página que mostra tudo isso é o Radar de Editais (radar.js).
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { esc, icon, toast, route, Store, daysUntil, uid } = A;
  const AG = window.ATLAS_AGENDA || { itens: [] };
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const fmt = (k) => { if (!k) return ''; const [y, m, d] = k.split('-'); return d + '/' + m + '/' + y; };
  const plural = (n, s) => n + ' ' + s + (n === 1 ? '' : 's');

  const itens = (AG.itens || []).filter((x) => x && x.orgao);
  const isOpen = (x) => x.inscFim && daysUntil(x.inscFim) >= 0 && (!x.inscInicio || daysUntil(x.inscInicio) <= 0);
  const abertas = itens.filter(isOpen).sort((a, b) => a.inscFim.localeCompare(b.inscFim));

  // O endereço antigo da Agenda leva ao Radar, que agora reúne tudo.
  route(/^\/agenda$/, 'agenda', function () {
    setTimeout(() => location.replace('#/radar'), 0);
    return { title: 'Radar de Editais', html: '' };
  });

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

  const banca = (x) => (A.bancas && x.banca ? A.bancas.byName(x.banca) : null);
  const cleanName = (x) => x.orgao.replace(/\s*\(exemplo\)/i, '');

  // Links úteis de um concurso: edital, área do candidato e página da banca.
  function linksOf(x) {
    const b = banca(x);
    return {
      edital: A.safeUrl(x.edital),
      area: A.safeUrl(x.areaCandidato) || (b ? A.gsearch('site:' + b.host + ' "área do candidato" OR "área do inscrito" "' + cleanName(x) + '"') : ''),
      banca: A.safeUrl(x.linkBanca) || (b ? A.bancas.links(b, cleanName(x)).chamada : ''),
      bancaNome: b ? b.n : (x.banca || '')
    };
  }

  // Cartão de um concurso com inscrição aberta.
  function item(x) {
    const [, m, d] = x.inscFim.split('-');
    const fim = daysUntil(x.inscFim);
    const tone = fim <= 3 ? 'danger' : fim <= 7 ? 'warn' : 'ok';
    const following = Store.state.exams.some((e) => e.agendaId === x.id);
    const l = linksOf(x);
    let bar = '';
    if (x.inscInicio) {
      const total = Math.max(1, daysUntil(x.inscFim) - daysUntil(x.inscInicio));
      const passed = Math.min(total, Math.max(0, -daysUntil(x.inscInicio)));
      bar = '<div class="progress ag-progress" title="Período de inscrição"><i style="width:' + Math.round(passed / total * 100) + '%"></i></div>';
    }
    const meta = [x.banca, x.uf || 'Nacional', x.vagas ? x.vagas + ' vagas' : '', x.salario ? 'até ' + x.salario : ''].filter(Boolean).map(esc).join(' · ');
    return '<article class="ag-item ag-abertas" data-id="' + esc(x.id) + '">' +
      '<div class="ag-date"><b>' + esc(d) + '</b><span>' + esc(MES[+m - 1]) + '</span><small>até</small></div>' +
      '<div class="ag-body"><div class="ag-title">' + esc(x.orgao) + (x.cargo ? ' <span class="muted">— ' + esc(x.cargo) + '</span>' : '') + '</div>' +
        '<div class="ag-meta">' + meta + '</div>' +
        '<div class="ag-dates"><span>Inscrições: ' + (x.inscInicio ? fmt(x.inscInicio) + ' a ' : 'até ') + fmt(x.inscFim) + '</span>' + (x.prova ? '<span>Prova: ' + fmt(x.prova) + '</span>' : '') + '</div>' +
        bar + (x.obs ? '<div class="ag-obs">' + esc(x.obs) + '</div>' : '') +
        '<div class="ag-links">' +
          (l.edital ? A.extLink(l.edital, 'chip', icon('note') + 'Edital') : '') +
          (l.area ? '<a class="chip" href="' + esc(l.area) + '" target="_blank" rel="noopener">' + icon('user') + 'Área do candidato</a>' : '') +
          (l.banca ? '<a class="chip" href="' + esc(l.banca) + '" target="_blank" rel="noopener">' + icon('clipboard') + 'Na banca' + (l.bancaNome ? ' (' + esc(l.bancaNome) + ')' : '') + '</a>' : '') +
          (A.shareWa ? '<a class="chip" href="' + esc(A.shareWa('Inscrições abertas: ' + x.orgao + (x.cargo ? ' — ' + x.cargo : '') + ' até ' + fmt(x.inscFim), '#/radar')) + '" target="_blank" rel="noopener">' + icon('chat') + 'Compartilhar</a>' : '') +
        '</div></div>' +
      '<div class="ag-side"><span class="badge ' + tone + '">' + (fim === 0 ? 'Último dia!' : 'Encerra em ' + plural(fim, 'dia')) + '</span><div class="ag-actions">' +
        (A.safeUrl(x.site) ? A.extLink(x.site, 'btn btn-sm btn-primary', 'Inscrever-se') : (l.edital ? A.extLink(l.edital, 'btn btn-sm btn-primary', 'Ver edital') : '')) +
        '<button class="icon-btn' + (following ? ' fav on' : '') + '" data-follow="' + esc(x.id) + '" title="' + (following ? 'Você acompanha' : 'Acompanhar em Meus concursos') + '" aria-label="Acompanhar">' + icon('star') + '</button>' +
      '</div></div></article>';
  }

  function bindFollow(root) {
    if (!root) return;
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-follow]'); if (!b) return;
      const x = itens.find((i) => String(i.id) === b.dataset.follow);
      if (x) { follow(x); b.classList.add('fav', 'on'); }
    });
  }

  // Concurso aberto do órgão de um card (mesmo estado e nome do órgão, ou mesmo site).
  function forOrg(it) {
    const name = A.norm(it.short || it.n.split(' — ')[0]);
    const host = A.hostOf(it.u);
    return abertas.find((x) => (A.safeUrl(x.site) && A.hostOf(x.site).startsWith(host)) ||
      ((!it.uf || x.uf === it.uf) && name.length > 3 && A.norm(x.orgao).includes(name))) || null;
  }

  A.agenda = { itens, abertas, item, bindFollow, linksOf, forOrg, isOpen };
})();
