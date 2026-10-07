/*
 * Atlas Concursos — Radar de Editais.
 * Uma página só para "o que está com inscrição aberta agora":
 *  1. concursos conferidos pela equipe (painel → data/agenda.js);
 *  2. inscrições abertas que o robô encontrou hoje nos sites oficiais (data/radar.js);
 *  3. busca organizada por tipo de órgão nos sites oficiais;
 *  4. editais novos da semana.
 * Inscrições encerradas nunca aparecem.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { $, $$, esc, icon, route, Store, daysUntil, fmtDate } = A;
  const DATA = window.ATLAS_DATA;
  const R = window.ATLAS_RADAR || {};
  const CLOSED = /(encerrad|resultado|gabarito|homologa|convoca|nomea|classifica|recurso|aprovados)/i;
  const RULES = window.ATLAS_RADAR_RULES;
  const valid = (x) => x && A.safeUrl(x.u) && !CLOSED.test(x.t || '');
  const isBancaSite = (u) => !!(A.bancas && A.bancas.list.some((b) => b.u === u));
  // Revalida no navegador todo dia: prazo vencido some mesmo antes da próxima varredura.
  const robotOpen = (R.abertas || []).filter((x) => valid(x) && (!RULES || (!RULES.expired(x.t) && RULES.isConcurso(x.t, x.banca || isBancaSite(x.site)))))
    .map((x) => Object.assign({}, x, {
      uf: x.uf || (RULES ? RULES.ufFromText(x.t) : ''),
      t: (() => {
        const t = RULES ? RULES.clean(x.t) : x.t;
        const banca = x.n.split(' (')[0];
        if (RULES && RULES.isGeneric(t)) return 'Concursos com inscrições abertas — página da ' + banca;
        if (RULES && !RULES.hasContext(t)) return banca + ': ' + t;   // ex.: "Instituto Mais: inscrições de 08/09 a 08/10"
        return t;
      })()
    }));
  const novidades = (R.items || []).filter((x) => valid(x) && daysUntil(x.d) >= -7);
  const confirmed = () => (A.agenda ? A.agenda.abertas : []);
  const totalOpen = () => confirmed().length + robotOpen.length;
  A.radarOpen = totalOpen;

  // Estados com mais procura primeiro.
  const UF_ORDER = ['SP', 'RJ', 'MG', 'BA', 'PR', 'RS', 'PE', 'CE', 'DF', 'GO', 'SC', 'ES', 'PA', 'AM', 'MA', 'PB', 'RN', 'AL', 'PI', 'MT', 'MS', 'SE', 'RO', 'TO', 'AC', 'AP', 'RR'];
  const ufRank = (uf) => { const i = UF_ORDER.indexOf(uf); return i < 0 ? 99 : i; };
  const ufOptions = (sel, all) => (all ? '<option value="">' + all + '</option>' : '') +
    UF_ORDER.filter((uf) => A.ufBy[uf]).map((uf) => '<option value="' + uf + '"' + (sel === uf ? ' selected' : '') + '>' + esc(A.ufBy[uf].nome) + '</option>').join('');

  A.navTop.unshift({ href: '#/radar', icon: 'radar', label: 'Radar de Editais', count: () => totalOpen() || null });
  A.pages.push({ n: 'Radar de Editais — inscrições abertas agora', href: '#/radar', ic: 'radar', sub: 'Concursos abertos' });

  /* ---------- Busca organizada por tipo de órgão ---------- */
  const OPEN_Q = '("inscrições abertas" OR "edital de abertura" OR "abertura de inscrições") -encerradas -encerrado -"resultado final"';
  const STATE_TYPES = [['pm', 'Polícias Militares'], ['pc', 'Polícias Civis'], ['cbm', 'Corpos de Bombeiros'], ['tj', 'Tribunais de Justiça'], ['mp', 'Ministérios Públicos'],
    ['dpe', 'Defensorias Públicas'], ['tre', 'Tribunais Eleitorais (TRE)'], ['trt', 'Tribunais do Trabalho (TRT)'], ['sefaz', 'Secretarias da Fazenda'], ['tce', 'Tribunais de Contas'],
    ['al', 'Assembleias Legislativas'], ['doe', 'Diários Oficiais dos estados'], ['gov', 'Governos estaduais']];
  const FED_GROUPS = [['seguranca', 'Polícia Federal, PRF e Forças Armadas'], ['federal', 'Órgãos federais (INSS, IBGE, agências, MEC…)'], ['justica', 'Tribunais superiores, Justiça Federal e MPU'],
    ['controle', 'Receita, TCU, CGU e Banco Central'], ['legislativo', 'Câmara e Senado'], ['estatais', 'Bancos e estatais'], ['bancas', 'Bancas organizadoras']];
  const site = (it) => A.hostOf(it.u);
  // Nome curto para os botões: sigla entre parênteses, parte antes do travessão ou as duas primeiras palavras.
  function shortName(it) {
    if (it.uf) return it.uf;
    const m = it.n.match(/\(([A-Z][A-Z0-9./-]{1,9})\)/);
    if (m) return m[1];
    const h = it.n.split(' — ')[0].split(' (')[0];
    if (h.length <= 18) return h;
    const w = h.split(' ');
    const n = /^(do|da|dos|das|de|e)$/i.test(w[1] || '') ? 3 : 2;   // "Câmara dos Deputados", não "Câmara dos"
    return w.slice(0, n).join(' ');
  }

  function chunks(list, size) { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; }
  function searchLink(list, recent) {
    const sites = Array.from(new Set(list.map(site).filter((h) => h && h.length < 60)));
    return A.gsearch(OPEN_Q + ' (' + sites.map((h) => 'site:' + h).join(' OR ') + ')', recent);
  }
  function stateRows(uf) {
    const items = Array.from(A.REG.values());
    return STATE_TYPES.map(([tipo, nome]) => {
      const list = items.filter((it) => it.tipo === tipo && (!uf || it.uf === uf)).sort((a, b) => ufRank(a.uf) - ufRank(b.uf));
      return { nome: uf ? (list[0] ? list[0].short + ' — ' + uf : nome) : nome, list };
    }).filter((g) => g.list.length);
  }
  function fedRows() {
    const items = Array.from(A.REG.values());
    return FED_GROUPS.map(([cat, nome]) => ({ nome, list: items.filter((it) => it.cat === cat) })).filter((g) => g.list.length);
  }
  function rowHtml(g, recent, uf) {
    const parts = chunks(g.list, 8);
    const names = (part) => {
      const n = Array.from(new Set(part.map((it) => (uf && it.short ? it.short : shortName(it)))));
      return n.length > 4 && !part[0].uf ? n.slice(0, 3).join(', ') + ' e mais ' + (n.length - 3) : n.join(', ');
    };
    return '<div class="os-row"><div class="os-info"><div class="title">' + esc(g.nome) + '</div>' +
      '<div class="sub">' + (parts.length === 1 && !uf && !g.list[0].uf ? esc(names(g.list)) : g.list.length + (g.list.length === 1 ? ' site oficial' : ' sites oficiais')) + '</div></div>' +
      '<div class="os-parts">' + parts.map((p) => '<a class="chip os-chip" href="' + esc(searchLink(p, recent)) + '" target="_blank" rel="noopener" title="Sites: ' + esc(p.map(site).join(', ')) + '">' + icon('search') +
        esc(parts.length === 1 ? 'Pesquisar' : names(p)) + '</a>').join('') + '</div></div>';
  }

  /* ---------- Página ---------- */
  const ui = { uf: '', q: '', searchUf: '', recent: true };

  route(/^\/radar$/, 'radar', function () {
    if (!ui.searchUf && Store.state.profile.uf) ui.searchUf = Store.state.profile.uf;
    const updated = R.updatedAt ? new Date(R.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const any = totalOpen() > 0;
    return {
      title: 'Radar de Editais',
      crumbs: [['Início', '#/'], ['Radar de Editais', '#/radar']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('radar') + 'Inscrições abertas agora</span><h1>Radar de Editais</h1>' +
        '<p>Concursos com <b>inscrição aberta hoje</b>: os conferidos pela equipe do Atlas e os que o robô encontra todo dia nos sites oficiais. Inscrição encerrada não aparece aqui.</p></div>' +
        '<div class="btn-row">' + (updated ? '<span class="badge">Atualizado em ' + esc(updated) + '</span>' : '') +
          '<a class="btn btn-sm" href="' + esc(A.shareWa('📢 ' + (totalOpen() ? totalOpen() + ' concursos com inscrição aberta hoje' : 'Radar de Editais') + ' — veja no Atlas Concursos:', '#/radar')) + '" target="_blank" rel="noopener">' + icon('chat') + 'Compartilhar no WhatsApp</a></div></div>' +
        (any ? '<div class="toolbar"><div class="filter-input">' + icon('search') + '<input class="input" id="rq" type="search" placeholder="Filtrar: PM, soldado, TJ, escrevente…" value="' + esc(ui.q) + '"></div>' +
          '<select class="select" id="ruf" style="width:auto">' + ufOptions(ui.uf, 'Todo o Brasil') + '</select></div>' +
          '<div id="r-open"></div>' : '') +
        '<section class="section panel panel-pad open-search" id="open-search"><div class="finder-head"><span class="tile-icon">' + icon('search') + '</span><div class="grow">' +
          '<h3>' + (any ? 'Procurar mais inscrições abertas nos sites oficiais' : 'Procurar inscrições abertas nos sites oficiais') + '</h3>' +
          '<p class="muted small">Cada botão abre uma pesquisa no Google <b>só nos sites oficiais</b> daquele tipo de órgão, procurando "inscrições abertas" e "edital de abertura" e <b>deixando de fora</b> inscrições encerradas e resultados.</p></div></div>' +
          '<div class="toolbar" style="margin:0"><select class="select" id="os-uf" style="width:auto">' + ufOptions(ui.searchUf, 'Todos os estados') + '</select>' +
            '<label class="chip" style="cursor:pointer"><input type="checkbox" id="os-recent"' + (ui.recent ? ' checked' : '') + ' style="margin:0 4px 0 0">Só publicados no último mês</label></div>' +
          '<div id="os-out" class="os-out"></div></section>' +
        (novidades.length ? '<details class="section ag-section"><summary class="section-head"><h2>' + icon('newspaper') + 'Editais novos desta semana <span class="badge">' + novidades.length + '</span></h2></summary><div class="list" id="r-new"></div></details>' : '') +
        '<p class="muted small" style="margin-top:18px">' + icon('info', 'i-inline') + ' O robô lê a página principal de cada site oficial todo dia às 7h. Confirme sempre as datas no edital antes de pagar a inscrição.</p>',
      after(view) {
        // 1 + 2. Inscrições abertas (conferidas + robô)
        const drawOpen = () => {
          const box = $('#r-open', view); if (!box) return;
          const q = A.norm(ui.q);
          const match = (txt, uf) => (!ui.uf || uf === ui.uf) && (!q || q.split(/\s+/).every((t) => A.norm(txt).includes(t)));
          const conf = confirmed().filter((x) => match([x.orgao, x.cargo, x.banca, x.uf].join(' '), x.uf));
          const rob = robotOpen.filter((x) => match(x.n + ' ' + x.t + ' ' + x.uf, x.uf)).sort((a, b) => ufRank(a.uf) - ufRank(b.uf) || (b.d || '').localeCompare(a.d || ''));
          let html = '';
          if (conf.length) html += '<section class="section ag-section"><div class="section-head"><h2>' + icon('check') + 'Inscrições abertas <span class="badge ok">' + conf.length + '</span></h2><span class="muted small">Conferidas pela equipe, com datas do edital</span></div><div class="ag-list">' + conf.map(A.agenda.item).join('') + '</div></section>';
          if (rob.length) html += '<section class="section ag-section"><div class="section-head"><h2>' + icon('radar') + 'Encontradas hoje nos sites oficiais <span class="badge accent">' + rob.length + '</span></h2><span class="muted small">Links com "inscrições abertas" ou "edital de abertura"</span></div><div class="list">' +
            rob.slice(0, 120).map((x) => {
              const bs = A.bancas ? A.bancas.find(x.t) : [];
              return '<div class="row">' + A.mono(x.n, x.site) + '<div class="grow"><div class="title" style="white-space:normal">' + esc(x.t) + '</div><div class="sub">' + esc(x.n) + ' · desde ' + esc(fmtDate(x.d)) + '</div>' +
                (bs.length ? '<div class="subs" style="margin-top:6px">' + bs.map((b) => '<a class="chip find-chip" href="' + esc(A.bancas.links(b, x.n.replace(/ — [A-Z]{2}$/, '')).chamada) + '" target="_blank" rel="noopener">' + icon('clipboard') + 'Na banca (' + esc(b.n) + ')</a>').join('') + '</div>' : '') + '</div>' +
                A.extLink(x.u, 'btn btn-sm btn-primary', 'Abrir') +
                '<a class="icon-btn" href="' + esc(A.shareWa('Inscrições abertas: ' + x.t + ' (' + x.n + ')', '#/radar')) + '" target="_blank" rel="noopener" title="Enviar para um amigo no WhatsApp" aria-label="Compartilhar no WhatsApp">' + icon('chat') + '</a>' +
                '<button class="icon-btn fav' + (A.isFav(x.site) ? ' on' : '') + '" data-action="fav" data-url="' + esc(x.site) + '" title="Salvar o site do órgão" aria-label="Salvar">' + icon('star') + '</button></div>';
            }).join('') + '</div></section>';
          box.innerHTML = html || A.emptyBox('search', 'Nada aberto com esse filtro', 'Tente outro estado ou outra palavra.');
          A.hydrateIcons(box);
        };
        drawOpen();
        if (A.agenda) A.agenda.bindFollow($('#r-open', view));
        const rq = $('#rq', view), ruf = $('#ruf', view);
        if (rq) rq.addEventListener('input', (e) => { ui.q = e.target.value; drawOpen(); });
        if (ruf) ruf.addEventListener('change', (e) => { ui.uf = e.target.value; drawOpen(); });

        // 3. Busca por tipo de órgão
        const drawSearch = () => {
          const out = $('#os-out', view);
          const uf = ui.searchUf;
          const rows = stateRows(uf);
          out.innerHTML = '<div class="os-group-title">' + (uf ? 'Órgãos de ' + esc(A.ufBy[uf].nome) : 'Órgãos estaduais <span class="muted">· botões por estado, começando por SP, RJ e MG</span>') + '</div>' +
            rows.slice(0, 5).map((g) => rowHtml(g, ui.recent, uf)).join('') +
            (rows.length > 5 ? '<details class="os-more"><summary class="chip">' + icon('plus') + 'Ver mais tipos de órgão (' + (rows.length - 5) + ')</summary><div class="os-out">' + rows.slice(5).map((g) => rowHtml(g, ui.recent, uf)).join('') + '</div></details>' : '') +
            '<div class="os-group-title">Órgãos federais e bancas</div>' + fedRows().map((g) => rowHtml(g, ui.recent, '')).join('');
          A.hydrateIcons(out);
        };
        drawSearch();
        $('#os-uf', view).addEventListener('change', (e) => { ui.searchUf = e.target.value; drawSearch(); });
        $('#os-recent', view).addEventListener('change', (e) => { ui.recent = e.target.checked; drawSearch(); });

        // 4. Editais novos
        const nb = $('#r-new', view);
        if (nb) nb.innerHTML = novidades.slice(0, 60).map((x) => '<div class="row">' + A.mono(x.n, x.site) + '<div class="grow"><div class="title" style="white-space:normal">' + esc(x.t) + '</div><div class="sub">' + esc(x.n) + ' · ' + esc(fmtDate(x.d)) + '</div></div>' + A.extLink(x.u, 'icon-btn', icon('external')) + '</div>').join('');
      }
    };
  });

  /* ---------- Página inicial e estados: só aparece se houver inscrição aberta ---------- */
  function openFor(uf) {
    const conf = confirmed().filter((x) => !uf || x.uf === uf);
    const rob = robotOpen.filter((x) => !uf || x.uf === uf).sort((a, b) => ufRank(a.uf) - ufRank(b.uf));
    return { conf, rob };
  }
  function compact({ conf, rob }, max) {
    const rows = conf.slice(0, max).map((x) => A.agenda.item(x));
    rob.slice(0, Math.max(0, max - rows.length)).forEach((x) => rows.push('<div class="row">' + A.mono(x.n, x.site) + '<div class="grow"><div class="title">' + esc(x.t) + '</div><div class="sub">' + esc(x.n) + '</div></div>' + A.extLink(x.u, 'btn btn-sm btn-primary', 'Abrir') + '</div>'));
    return rows.join('');
  }
  A.afterRender.push((view, cur) => {
    if (cur.name === 'home') {
      const o = openFor('');
      const n = o.conf.length + o.rob.length;
      const widgets = $('.widgets', view);
      if (!n || !widgets) return;
      widgets.insertAdjacentHTML('afterend', '<section class="section"><div class="section-head"><h2>' + icon('radar') + 'Inscrições abertas agora <span class="badge ok">' + n + '</span></h2><a class="link-more" href="#/radar">Ver no Radar ' + icon('chevron') + '</a></div><div class="ag-list">' + compact(o, 4) + '</div></section>');
      if (A.agenda) A.agenda.bindFollow(widgets.nextElementSibling);
    }
    if (cur.name === 'uf') {
      const uf = String(cur.params[0]).toUpperCase();
      const o = openFor(uf);
      const anchor = $('.panel', view);
      if (!(o.conf.length + o.rob.length) || !anchor) return;
      anchor.insertAdjacentHTML('afterend', '<section class="section"><div class="section-head"><h2>' + icon('radar') + 'Inscrições abertas em ' + esc(uf) + '</h2><a class="link-more" href="#/radar">Ver no Radar ' + icon('chevron') + '</a></div><div class="ag-list">' + compact(o, 6) + '</div></section>');
      if (A.agenda) A.agenda.bindFollow(anchor.nextElementSibling);
    }
  });

  /* ---------- Edital e Área do candidato em cada órgão ---------- */
  const WITH_LINKS = ['federal', 'seguranca', 'justica', 'controle', 'legislativo', 'estatais'];
  A.cardBadges.push((it) => {
    const isState = it.uf && it.tipo && !['doe', 'gov'].includes(it.tipo);
    if (!isState && !WITH_LINKS.includes(it.cat)) return '';
    const nome = (it.short || it.n.split(' — ')[0].split(' (')[0]) + (it.ufNome ? ' ' + it.ufNome : '');
    const m = A.agenda ? A.agenda.forOrg(it) : null;
    const l = m ? A.agenda.linksOf(m) : {};
    const edital = l.edital || A.gsearch('site:' + site(it) + ' edital concurso ("inscrições abertas" OR "edital de abertura")', false);
    const area = l.area || A.gsearch('"área do candidato" concurso "' + nome + '"', false);
    return '<div class="subs card-links">' +
      '<a class="chip" href="' + esc(edital) + '" target="_blank" rel="noopener" title="' + (l.edital ? 'Edital do concurso aberto' : 'Procurar o edital no site oficial') + '">' + icon('note') + (m ? 'Edital aberto' : 'Edital') + '</a>' +
      '<a class="chip" href="' + esc(area) + '" target="_blank" rel="noopener" title="Onde o candidato faz login, imprime boleto e cartão de confirmação">' + icon('user') + 'Área do candidato</a>' +
      (m ? '<a class="chip find-chip" href="#/radar">' + icon('radar') + 'Inscrições abertas</a>' : '') + '</div>';
  });
  A.cardBadges.push((it) => {
    if (it.cat !== 'bancas' || !A.bancas) return '';
    const b = A.bancas.list.find((x) => x.u === it.u); if (!b) return '';
    return '<div class="subs card-links"><a class="chip" href="' + esc(A.gsearch('site:' + b.host + ' "área do candidato"', false)) + '" target="_blank" rel="noopener">' + icon('user') + 'Área do candidato</a></div>';
  });
})();
