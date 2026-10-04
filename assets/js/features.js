/*
 * Atlas Concursos — diferenciais.
 *  - Radar de Editais: novidades detectadas todo dia nos sites oficiais (data/radar.js).
 *  - Descubra seu concurso: teste rápido que indica carreiras e os sites oficiais certos.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { $, $$, esc, icon, toast, dateKey, daysUntil, fmtDate, route, Store } = A;
  const DATA = window.ATLAS_DATA;
  const R = window.ATLAS_RADAR || { items: [] };
  const items = (R.items || []).filter((x) => x && A.safeUrl(x.u));
  const recentBySite = new Map();
  items.forEach((x) => { if (daysUntil(x.d) >= -7 && !recentBySite.has(x.site)) recentBySite.set(x.site, x); });
  const last7 = items.filter((x) => daysUntil(x.d) >= -7).length;

  /* =========================================================
     Radar de Editais
     ========================================================= */
  A.navTop.push({ href: '#/radar', icon: 'radar', label: 'Radar de Editais', count: () => last7 || null });
  A.pages.push({ n: 'Radar de Editais (novidades nos sites oficiais)', href: '#/radar', ic: 'radar', sub: 'Diferencial' });

  // Selo "Novidade no Radar" nos cards dos sites que publicaram algo nos últimos 7 dias.
  A.cardBadges.push((it) => {
    const x = recentBySite.get(it.u);
    return x ? '<a class="radar-badge" href="#/radar" title="' + esc(x.t) + '">' + icon('radar') + 'Novidade detectada ' + (daysUntil(x.d) === 0 ? 'hoje' : 'em ' + fmtDate(x.d)) + '</a>' : '';
  });

  const ui = { uf: '', mine: false, q: '' };
  const when = (d) => { const n = -daysUntil(d); return n === 0 ? 'Hoje' : n === 1 ? 'Ontem' : fmtDate(d); };

  route(/^\/radar$/, 'radar', function () {
    const ufs = Array.from(new Set(items.map((x) => x.uf).filter(Boolean))).sort();
    const myUf = Store.state.profile.uf;
    const updated = R.updatedAt ? new Date(R.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
    return {
      title: 'Radar de Editais',
      crumbs: [['Início', '#/'], ['Radar de Editais', '#/radar']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('radar') + 'Exclusivo do Atlas</span><h1>Radar de Editais</h1>' +
        '<p>Todo dia, o Atlas visita os sites oficiais do catálogo e mostra aqui os <b>links novos</b> com "edital", "concurso", "processo seletivo", "convocação" ou "gabarito". Você fica sabendo sem precisar abrir site por site.</p></div></div>' +
        '<div class="kpis">' +
          '<div class="kpi"><b>' + (R.checked || DATA.estados.length) + '</b><span>sites vigiados</span></div>' +
          '<div class="kpi"><b>' + last7 + '</b><span>novidades em 7 dias</span></div>' +
          '<div class="kpi"><b>' + (updated || '—') + '</b><span>última varredura</span></div>' +
        '</div>' +
        '<div class="toolbar section" style="margin-top:20px">' +
          '<div class="filter-input">' + icon('search') + '<input class="input" id="rq" type="search" placeholder="Filtrar: PM, TJ, agente, Minas…" value="' + esc(ui.q) + '"></div>' +
          '<button class="chip' + (ui.mine ? ' sel' : '') + '" id="rmine">' + icon('star') + 'Só dos meus links salvos</button>' +
        '</div>' +
        '<div class="subs" id="rufs" style="margin-bottom:14px"><button class="chip' + (!ui.uf ? ' sel' : '') + '" data-uf="">Todos</button>' +
          (myUf ? '<button class="chip' + (ui.uf === myUf ? ' sel' : '') + '" data-uf="' + myUf + '">' + icon('flag') + 'Meu estado (' + myUf + ')</button>' : '') +
          '<button class="chip' + (ui.uf === 'BR' ? ' sel' : '') + '" data-uf="BR">Federais</button>' +
          ufs.filter((u) => u !== myUf).map((u) => '<button class="chip' + (ui.uf === u ? ' sel' : '') + '" data-uf="' + u + '">' + u + '</button>').join('') +
        '</div>' +
        '<div id="rfeed"></div>' +
        '<p class="muted small" style="margin-top:16px">' + icon('info', 'i-inline') + ' O Radar lê só a página principal de cada site e alguns órgãos bloqueiam robôs, por isso ele complementa (não substitui) a leitura do Diário Oficial. Sempre confirme no edital.</p>',
      after(view) {
        const draw = () => {
          const q = A.norm(ui.q);
          const favs = Store.state.favs;
          const list = items.filter((x) =>
            (!ui.uf || (ui.uf === 'BR' ? !x.uf : x.uf === ui.uf)) &&
            (!ui.mine || favs[x.site]) &&
            (!q || q.split(/\s+/).every((t) => A.norm(x.n + ' ' + x.t + ' ' + x.uf).includes(t))));
          if (!list.length) {
            $('#rfeed', view).innerHTML = items.length
              ? A.emptyBox('radar', 'Nada com esses filtros', 'Tente outro estado ou desmarque "Só dos meus links".')
              : A.emptyBox('radar', 'O Radar está ligando os motores', 'A primeira varredura memoriza o que já existe em cada site. A partir da segunda, todo link novo de edital aparece aqui.');
            return;
          }
          let html = '', day = '';
          list.slice(0, 200).forEach((x) => {
            if (x.d !== day) { if (day) html += '</div>'; day = x.d; html += '<div class="p-group" style="padding-left:2px">' + when(x.d) + '</div><div class="list">'; }
            html += '<div class="row">' + A.mono(x.n, x.site) +
              '<div class="grow"><div class="title" style="white-space:normal">' + esc(x.t) + '</div><div class="sub">' + esc(x.n) + ' · ' + esc(A.hostOf(x.u)) + '</div></div>' +
              A.extLink(x.u, 'btn btn-sm btn-primary', 'Abrir') +
              '<button class="icon-btn fav' + (A.isFav(x.site) ? ' on' : '') + '" data-action="fav" data-url="' + esc(x.site) + '" title="Salvar o site do órgão" aria-label="Salvar">' + icon('star') + '</button></div>';
          });
          $('#rfeed', view).innerHTML = html + '</div>';
        };
        draw();
        $('#rq', view).addEventListener('input', (e) => { ui.q = e.target.value; draw(); });
        $('#rmine', view).addEventListener('click', (e) => { ui.mine = !ui.mine; e.currentTarget.classList.toggle('sel', ui.mine); draw(); });
        $('#rufs', view).addEventListener('click', (e) => {
          const b = e.target.closest('[data-uf]'); if (!b) return;
          ui.uf = b.dataset.uf;
          $$('[data-uf]', view).forEach((x) => x.classList.toggle('sel', x === b));
          draw();
        });
      }
    };
  });

  // Destaque do Radar na página inicial.
  A.afterRender.push((view, cur) => {
    if (cur.name !== 'home') return;
    const widgets = $('.widgets', view);
    if (!widgets) return;
    const my = Store.state.profile.uf;
    const top = items.filter((x) => !my || !x.uf || x.uf === my).slice(0, 5);
    const html = '<section class="section"><div class="section-head"><h2>' + icon('radar') + 'Radar de Editais' + (last7 ? ' <span class="badge accent">' + last7 + ' novidades</span>' : '') + '</h2><a class="link-more" href="#/radar">Ver tudo ' + icon('chevron') + '</a></div>' +
      (top.length
        ? '<div class="list">' + top.map((x) => '<div class="row">' + A.mono(x.n, x.site) + '<div class="grow"><div class="title">' + esc(x.t) + '</div><div class="sub">' + esc(x.n) + ' · ' + when(x.d) + '</div></div>' + A.extLink(x.u, 'icon-btn', icon('external')) + '</div>').join('') + '</div>'
        : '<div class="panel panel-pad"><p class="muted">Todo dia o Atlas vigia os sites oficiais e mostra aqui os editais novos. <a class="grad-text" href="#/radar">Saiba como funciona →</a></p></div>') +
      '</section>';
    widgets.insertAdjacentHTML('afterend', html);
  });

  /* =========================================================
     Descubra seu concurso
     ========================================================= */
  A.navTop.push({ href: '#/descubra', icon: 'target', label: 'Descubra seu concurso' });
  A.pages.push({ n: 'Descubra seu concurso (teste rápido)', href: '#/descubra', ic: 'target', sub: 'Diferencial' });

  const ESC = [['medio', 'Ensino médio'], ['superior', 'Superior (qualquer área)'], ['direito', 'Superior em Direito'], ['ti', 'Superior em TI / Exatas'], ['saude', 'Superior em Saúde']];
  const AREAS = [['seguranca', 'Segurança e ação'], ['juridica', 'Jurídica'], ['fiscal', 'Fiscal e contas'], ['admin', 'Administrativa'], ['bancaria', 'Bancária'], ['educacao', 'Educação e saúde'], ['ti', 'Tecnologia']];
  const PRIO = [['salario', 'Maior salário'], ['perto', 'Trabalhar no meu estado'], ['vagas', 'Muitas vagas'], ['rapido', 'Começar logo']];

  // nivel: requisito mínimo · sal / vagas: 1 a 3 · local: carreira do estado · st: órgãos do hub estadual · fed: links federais
  const CARREIRAS = [
    { n: 'Soldado da Polícia Militar', a: ['seguranca'], nivel: 'medio', sal: 2, vagas: 3, local: true, st: ['pm', 'doe'], d: 'A carreira com mais vagas na segurança pública. Escolaridade e altura mínima variam conforme o estado.' },
    { n: 'Agente / Escrivão da Polícia Civil', a: ['seguranca', 'juridica'], nivel: 'superior', sal: 2, vagas: 2, local: true, st: ['pc', 'doe'], d: 'Investigação e cartório policial. Costuma exigir nível superior em qualquer área.' },
    { n: 'Delegado de Polícia', a: ['seguranca', 'juridica'], nivel: 'direito', sal: 3, vagas: 1, local: true, st: ['pc', 'doe'], d: 'Chefia da investigação. Exige bacharelado em Direito.' },
    { n: 'Bombeiro Militar', a: ['seguranca', 'educacao'], nivel: 'medio', sal: 2, vagas: 2, local: true, st: ['cbm', 'doe'], d: 'Salvamento, combate a incêndio e atendimento pré-hospitalar.' },
    { n: 'Policial Rodoviário Federal', a: ['seguranca'], nivel: 'superior', sal: 3, vagas: 2, local: false, fed: ['https://www.gov.br/prf/pt-br', 'https://www.cebraspe.org.br'], d: 'Fiscalização das rodovias federais. Exige nível superior e CNH categoria B.' },
    { n: 'Agente / Escrivão da Polícia Federal', a: ['seguranca'], nivel: 'superior', sal: 3, vagas: 1, local: false, fed: ['https://www.gov.br/pf/pt-br', 'https://www.cebraspe.org.br'], d: 'Uma das carreiras mais desejadas do país.' },
    { n: 'Escolas militares (EsPCEx, ESA, Marinha, FAB)', a: ['seguranca'], nivel: 'medio', sal: 1, vagas: 2, local: false, fed: ['https://www.eb.mil.br', 'https://www.marinha.mil.br', 'https://www.fab.mil.br'], d: 'Formação de oficiais e sargentos. Atenção aos limites de idade.' },
    { n: 'Técnico / Escrevente do Tribunal de Justiça', a: ['admin', 'juridica'], nivel: 'medio', sal: 2, vagas: 3, local: true, st: ['tj'], d: 'Atendimento e andamento de processos. Ótima porta de entrada.' },
    { n: 'Analista e técnico da Justiça Eleitoral, do Trabalho e Federal', a: ['juridica', 'admin'], nivel: 'superior', sal: 3, vagas: 2, local: true, st: ['tre', 'trt'], d: 'TREs, TRTs e TRFs, com remuneração entre as melhores do Judiciário.' },
    { n: 'Oficial de Justiça', a: ['juridica'], nivel: 'superior', sal: 2, vagas: 2, local: true, st: ['tj'], d: 'Cumpre mandados e diligências. Em vários estados exige Direito.' },
    { n: 'Promotor, Juiz ou Defensor Público', a: ['juridica'], nivel: 'direito', sal: 3, vagas: 1, local: true, st: ['mp', 'tj', 'dpe'], d: 'O topo das carreiras jurídicas. Exige Direito e 3 anos de atividade jurídica.' },
    { n: 'Auditor fiscal estadual (Sefaz)', a: ['fiscal'], nivel: 'superior', sal: 3, vagas: 1, local: true, st: ['sefaz', 'doe'], d: 'Fiscalização de impostos estaduais como o ICMS.' },
    { n: 'Auditor de controle externo (TCE)', a: ['fiscal', 'juridica'], nivel: 'superior', sal: 3, vagas: 1, local: true, st: ['tce'], d: 'Fiscaliza o uso do dinheiro público no estado e nos municípios.' },
    { n: 'Receita Federal, TCU e CGU', a: ['fiscal'], nivel: 'superior', sal: 3, vagas: 1, local: false, fed: ['https://www.gov.br/receitafederal/pt-br', 'https://portal.tcu.gov.br', 'https://www.gov.br/cgu/pt-br'], d: 'Elite do fisco e do controle federal.' },
    { n: 'Concurso Nacional Unificado (CNU)', a: ['admin', 'fiscal', 'educacao', 'ti'], nivel: 'medio', sal: 2, vagas: 3, local: false, fed: ['https://www.gov.br/gestao/pt-br/concursonacional'], d: 'Uma prova para vários órgãos federais, aplicada em todo o país.' },
    { n: 'INSS — técnico e analista do seguro social', a: ['admin'], nivel: 'medio', sal: 2, vagas: 3, local: false, fed: ['https://www.gov.br/inss/pt-br'], d: 'Muitas vagas e lotação no país inteiro.' },
    { n: 'Assembleia Legislativa, Câmara e Senado', a: ['admin', 'juridica'], nivel: 'superior', sal: 3, vagas: 1, local: true, st: ['al'], fed: ['https://www.camara.leg.br', 'https://www12.senado.leg.br'], d: 'Carreiras legislativas, com salários muito altos e poucas vagas.' },
    { n: 'Escriturário de banco (BB, Caixa, regionais)', a: ['bancaria', 'admin'], nivel: 'medio', sal: 2, vagas: 3, local: false, fed: ['https://www.bb.com.br', 'https://www.caixa.gov.br', 'https://www.cesgranrio.org.br'], d: 'Regime CLT, com participação nos lucros. Exige ensino médio.' },
    { n: 'Analista de TI (Serpro, Dataprev, tribunais)', a: ['ti'], nivel: 'ti', sal: 3, vagas: 2, local: false, fed: ['https://www.serpro.gov.br', 'https://www.dataprev.gov.br'], d: 'Desenvolvimento, infraestrutura e dados no setor público.' },
    { n: 'Saúde nos hospitais federais (EBSERH)', a: ['educacao'], nivel: 'saude', sal: 2, vagas: 3, local: false, fed: ['https://www.gov.br/ebserh/pt-br'], d: 'Médicos, enfermeiros e técnicos nos hospitais universitários.' },
    { n: 'Professor da rede estadual', a: ['educacao'], nivel: 'superior', sal: 1, vagas: 3, local: true, st: ['gov', 'doe'], d: 'Licenciatura na disciplina. Concursos frequentes em quase todos os estados.' }
  ];
  const LEVEL = { medio: 0, superior: 1, direito: 2, ti: 2, saude: 2 };
  function eligible(c, esc) {
    if (c.nivel === 'medio') return true;
    if (esc === 'medio') return false;
    if (c.nivel === 'superior') return true;
    return c.nivel === esc;
  }

  const quiz = { esc: '', area: '', uf: '', prio: '' };
  route(/^\/descubra$/, 'descubra', function () {
    if (!quiz.uf) quiz.uf = Store.state.profile.uf || '';
    const q = (key, title, opts) => '<div class="panel panel-pad quiz-q"><h3>' + title + '</h3><div class="subs" data-q="' + key + '">' +
      opts.map((o) => '<button class="chip' + (quiz[key] === o[0] ? ' sel' : '') + '" data-v="' + o[0] + '">' + esc(o[1]) + '</button>').join('') + '</div></div>';
    return {
      title: 'Descubra seu concurso',
      crumbs: [['Início', '#/'], ['Descubra seu concurso', '#/descubra']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('target') + 'Teste de 30 segundos</span><h1>Descubra seu concurso</h1>' +
        '<p>Responda 4 perguntas e veja as carreiras que combinam com você, com os sites oficiais certos para acompanhar — inclusive os do seu estado.</p></div></div>' +
        '<div class="quiz">' +
          q('esc', '1. Qual é a sua escolaridade?', ESC) +
          q('area', '2. O que mais te atrai?', AREAS) +
          '<div class="panel panel-pad quiz-q"><h3>3. Em qual estado você quer trabalhar?</h3><select class="select" id="quiz-uf" style="max-width:320px"><option value="">Tanto faz / qualquer lugar</option>' +
            DATA.estados.map((e) => '<option value="' + e.uf + '"' + (quiz.uf === e.uf ? ' selected' : '') + '>' + esc(e.nome) + '</option>').join('') + '</select></div>' +
          q('prio', '4. O que é mais importante agora?', PRIO) +
        '</div>' +
        '<div id="quiz-out" class="section"></div>',
      after(view) {
        const out = $('#quiz-out', view);
        const draw = () => {
          if (!quiz.esc || !quiz.area || !quiz.prio) {
            out.innerHTML = '<p class="muted">Responda as perguntas 1, 2 e 4 para ver o resultado.</p>';
            return;
          }
          const e = A.ufBy[quiz.uf];
          const ranked = CARREIRAS.filter((c) => eligible(c, quiz.esc)).map((c) => {
            let s = c.a[0] === quiz.area ? 12 : c.a.includes(quiz.area) ? 7 : 0;
            if (quiz.prio === 'salario') s += c.sal * 3;
            if (quiz.prio === 'perto') s += c.local ? 6 : 0;
            if (quiz.prio === 'vagas') s += c.vagas * 3;
            if (quiz.prio === 'rapido') s += c.vagas * 2 + (c.local ? 2 : 0);
            if (c.nivel !== 'medio' && LEVEL[c.nivel] === LEVEL[quiz.esc] && c.nivel === quiz.esc) s += 3;
            return { c, s };
          }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6);

          const linksFor = (c) => {
            const l = [];
            if (e) (c.st || []).forEach((k) => {
              if (k === 'trt') e.trtItems.forEach((it) => l.push(it));
              else if (e.items[k]) l.push(e.items[k]);
            });
            (c.fed || []).forEach((u) => { const it = A.REG.get(u); if (it) l.push(it); });
            return l;
          };
          const stars = (n) => '<span title="' + n + ' de 3">' + '●'.repeat(n) + '<span style="opacity:.25">' + '●'.repeat(3 - n) + '</span></span>';
          out.innerHTML = '<div class="section-head"><h2>' + icon('sparkle') + 'Carreiras que combinam com você</h2>' +
            '<div class="btn-row"><button class="btn btn-sm" id="quiz-save">' + icon('star') + 'Salvar todos os sites</button><button class="btn btn-sm" id="quiz-share">' + icon('link') + 'Compartilhar</button></div></div>' +
            (ranked.length ? '<div class="cards">' + ranked.map(({ c }, i) => {
              const l = linksFor(c);
              return '<article class="card"><div class="card-top"><span class="tile-icon"><b>' + (i + 1) + '</b></span><div class="card-title"><h3>' + esc(c.n) + '</h3><span class="domain">' + (c.local ? (e ? 'No estado: ' + esc(e.nome) : 'Carreira estadual') : 'Carreira federal / nacional') + '</span></div></div>' +
                '<p class="desc">' + esc(c.d) + '</p>' +
                '<div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><b>' + stars(c.sal) + '</b><span>remuneração</span></div><div class="kpi"><b>' + stars(c.vagas) + '</b><span>volume de vagas</span></div></div>' +
                (l.length ? '<div class="subs">' + l.map((it) => A.extLink(it.u, 'chip', icon('external') + esc(it.short || it.n), it.n)).join('') + '</div>'
                  : (c.local && !e ? '<p class="muted small">Escolha um estado na pergunta 3 para ver os sites oficiais.</p>' : '')) +
                '</article>';
            }).join('') + '</div>' : A.emptyBox('target', 'Nenhuma carreira encontrada', 'Tente outra área ou prioridade.')) +
            '<p class="muted small" style="margin-top:12px">Indicação geral para começar a pesquisar. Requisitos, remuneração e vagas mudam a cada edital — sempre confira o edital oficial.</p>';
          A.hydrateIcons(out);
          const all = [].concat(...ranked.map(({ c }) => linksFor(c)));
          $('#quiz-save', out).addEventListener('click', () => {
            let n = 0;
            Store.update((s) => all.forEach((it) => { if (!s.favs[it.u]) { s.favs[it.u] = { u: it.u, n: it.n, d: it.d || '', folder: 'Meu concurso', note: '', at: Date.now() }; n++; } if (!s.folders.includes('Meu concurso')) s.folders.push('Meu concurso'); }));
            A.renderNav();
            toast(n ? n + ' sites salvos na pasta "Meu concurso"' : 'Esses sites já estavam salvos');
          });
          $('#quiz-share', out).addEventListener('click', async () => {
            const text = 'Fiz o teste "Descubra seu concurso" no Atlas Concursos e deu: ' + ranked.slice(0, 3).map(({ c }) => c.n).join(', ') + '. Faça o seu:';
            const url = ((window.ATLAS_CONFIG || {}).siteUrl || location.origin + location.pathname) + '#/descubra';
            if (navigator.share) { try { await navigator.share({ title: 'Descubra seu concurso', text, url }); } catch (err) {} }
            else A.copy(text + ' ' + url);
          });
        };
        draw();
        view.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-q] [data-v]'); if (!b) return;
          const key = b.parentElement.dataset.q;
          quiz[key] = b.dataset.v;
          $$('[data-v]', b.parentElement).forEach((x) => x.classList.toggle('sel', x === b));
          draw();
          if (quiz.esc && quiz.area && quiz.prio && key === 'prio') out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        $('#quiz-uf', view).addEventListener('change', (ev) => { quiz.uf = ev.target.value; draw(); });
      }
    };
  });
})();
