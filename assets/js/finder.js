/*
 * Atlas Concursos — busca da equipe "Meu nome no Diário Oficial".
 * Ferramenta interna: monta as buscas certas (Diário Oficial do estado, site do
 * órgão, bancas e Diário Oficial da União) para a equipe procurar o nome de quem
 * pediu a pesquisa paga. Não aparece para o público: o Painel liga o modo equipe
 * neste aparelho (localStorage "atlas:equipe") e abre esta página já preenchida
 * com os dados do pedido. Não é uma trava de segurança — a página só monta links
 * de pesquisa —, é só para o serviço não ter uma versão grátis à mostra.
 * O endereço antigo #/meu-nome leva para o serviço pago (#/pesquisa-diario).
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { $, esc, icon, route } = A;
  const DATA = window.ATLAS_DATA;

  const BANCAS = ['cebraspe.org.br', 'fgv.br', 'concursosfcc.com.br', 'vunesp.com.br', 'cesgranrio.org.br', 'ibfc.org.br', 'institutoaocp.org.br', 'quadrix.org.br', 'idecan.org.br', 'institutoconsulplan.org.br', 'fundatec.org.br', 'iades.com.br', 'fumarc.com.br', 'fepese.org.br', 'objetivas.com.br'];
  const TIPOS_ORG = ['pm', 'pc', 'cbm', 'tj', 'mp', 'dpe', 'tre', 'sefaz', 'tce', 'al', 'gov'];
  const TEAM = 'atlas:equipe';
  const isTeam = () => { try { return localStorage.getItem(TEAM) === '1'; } catch (e) { return false; } };
  A.team = { is: isTeam, set(on) { try { if (on) localStorage.setItem(TEAM, '1'); else localStorage.removeItem(TEAM); } catch (e) {} } };
  A.navTop.push({ href: '#/pesquisa-diario', icon: 'search', label: 'Meu nome no Diário', show: () => !!(A.services && A.services.active()) });
  A.nav.push({ href: '#/equipe/busca', icon: 'shield', label: 'Busca da equipe', show: isTeam });

  // Atalho para o serviço pago em cada órgão estadual.
  A.cardBadges.push((it) => it.uf && it.tipo && it.tipo !== 'trt' && A.services && A.services.active()
    ? '<a class="chip find-chip" href="#/pesquisa-diario/' + it.uf + '">' + icon('search') + 'Procuramos seu nome no Diário</a>' : '');

  /* ---------- Formatos de documento ---------- */
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const noAccent = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  function rgVariants(rg, uf) {
    const raw = String(rg || '').trim();
    const d = digits(raw).replace(/^0+/, '') || digits(raw);
    const v = new Set();
    if (!d) return [];
    v.add(d);
    // 8 dígitos (ex.: SP, MG): 12.345.678 | 9 dígitos: 12.345.678-9 | 7: 1.234.567
    if (d.length >= 7) {
      const body = d.length === 9 ? d.slice(0, 8) : d;
      const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      v.add(d.length === 9 ? dotted + '-' + d.slice(8) : dotted);
      if (d.length === 9) v.add(dotted);
    }
    if (/[A-Za-z]/.test(raw)) v.add(raw.toUpperCase());
    if (uf) [...v].slice(0, 2).forEach((x) => v.add(uf + '-' + x));
    return [...v].slice(0, 5);
  }
  function cpfMasked(cpf) {
    const d = digits(cpf);
    if (d.length !== 11) return '';
    return d.slice(3, 6) + '.' + d.slice(6, 9);   // diários publicam ***.456.789-** (LGPD)
  }
  const q = (s) => '"' + String(s).replace(/"/g, '') + '"';
  const google = (query) => 'https://www.google.com/search?q=' + encodeURIComponent(query);
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const alerts = (term) => 'https://www.google.com/alerts?q=' + encodeURIComponent(term);
  const dou = (term) => 'https://www.in.gov.br/consulta/-/buscar/dou?q=' + encodeURIComponent(term) + '&s=todos&exactDate=all&sortType=0';

  /* ---------- Página ---------- */
  const form = { nome: '', rg: '', rgUf: '', cpf: '', insc: '', uf: '', org: '', extra: '', banca: '' };

  // Bancas ligadas ao concurso: a escolhida no formulário + as da Agenda para o mesmo órgão e estado.
  function relatedBancas() {
    const out = [];
    const push = (b) => { if (b && !out.includes(b)) out.push(b); };
    if (form.banca) push(A.bancas.list.find((b) => b.host === form.banca));
    const ag = A.agenda ? A.agenda.itens : [];
    const orgName = form.org && DATA.tipos[form.org] ? A.norm(DATA.tipos[form.org].nome) : '';
    ag.filter((x) => x.banca && (!form.uf || x.uf === form.uf) && (!orgName || A.norm(x.orgao).includes(orgName)))
      .forEach((x) => push(A.bancas.byName(x.banca)));
    return out.slice(0, 3);
  }

  // Adivinha o órgão pelo texto do pedido ("PMERJ Soldado" → PM).
  const ORG_HINTS = [['pm', /\bpm|pol[ií]cia militar|soldado/], ['cbm', /bombeir|\bcbm/], ['pc', /\bpc|pol[ií]cia civil|delegad|escriv[aã]o|investigador/], ['tj', /\btj|tribunal de justi|escrevente/],
    ['mp', /\bmp|minist[ée]rio p[úu]blico/], ['dpe', /defensoria|\bdpe/], ['tre', /\btre\b|eleitoral/], ['sefaz', /sefaz|fazenda|auditor fiscal/], ['tce', /\btce|tribunal de contas/], ['al', /assembleia/]];
  const guessOrg = (txt, e) => { const t = String(txt || '').toLowerCase(); const hit = ORG_HINTS.find((h) => h[1].test(t) && e && e.items[h[0]]); return hit ? hit[0] : ''; };
  const DESDE = { '3m': 'últimos 3 meses', '6m': 'últimos 6 meses', '1a': 'últimos 12 meses' };
  let pedido = {};   // dados do pedido que o Painel mandou (código, concurso, período)
  const toHash = () => '#/equipe/busca?' + new URLSearchParams(Object.entries(Object.assign({}, pedido, form, { cpf: '' })).filter((x) => x[1])).toString();

  // Endereço antigo da busca grátis: agora leva para o serviço pago.
  route(/^\/meu-nome(?:\/([A-Za-z]{2}))?(?:\/[a-z]+)?$/, 'meu-nome', function (uf) {
    location.replace('#/pesquisa-diario' + (uf ? '/' + uf.toUpperCase() : ''));
    return { title: 'Pesquisa no Diário Oficial', html: '' };
  });

  route(/^\/equipe\/busca(?:\?.*)?$/, 'equipe-busca', function () {
    if (!isTeam()) {
      location.replace('#/pesquisa-diario');
      return { title: 'Pesquisa no Diário Oficial', html: '' };
    }
    const qs = new URLSearchParams(location.hash.split('?')[1] || '');
    if ([...qs.keys()].length) {
      Object.keys(form).forEach((k) => { if (k !== 'cpf') form[k] = qs.get(k) || ''; });
      pedido = { pedido: qs.get('pedido') || '', concurso: qs.get('concurso') || '', desde: qs.get('desde') || '' };
      form.uf = (form.uf || '').toUpperCase();
      if (form.uf === 'BR') form.uf = '';
      if (!form.rgUf) form.rgUf = form.uf;
      if (!form.org && !qs.has('org')) form.org = guessOrg(pedido.concurso, A.ufBy[form.uf]);
    }
    const e = A.ufBy[form.uf];
    const orgOptions = e ? TIPOS_ORG.filter((k) => e.items[k]).map((k) => '<option value="' + k + '"' + (form.org === k ? ' selected' : '') + '>' + esc(DATA.tipos[k].nome) + '</option>').join('') : '';
    const info = pedido.pedido
      ? '<div class="panel panel-pad finder-order"><span class="eyebrow">' + icon('clipboard') + 'Pedido ' + esc(pedido.pedido) + '</span>' +
        '<p style="margin-top:6px"><b>' + esc(pedido.concurso || 'Concurso não informado') + '</b>' + (pedido.desde && DESDE[pedido.desde] ? ' · procurar nos ' + DESDE[pedido.desde] : '') + '</p></div>'
      : '';

    return {
      title: 'Busca da equipe',
      crumbs: [['Início', '#/'], ['Busca da equipe', '#/equipe/busca']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('shield') + 'Uso interno da equipe</span><h1>Busca do pedido no Diário Oficial</h1>' +
        '<p>Preencha com os dados do cliente (o Painel já abre esta página preenchida) e o Atlas monta as buscas certas em cada lugar, com os formatos que os diários usam.</p></div></div>' +
        info +
        '<div class="finder">' +
          '<form class="panel panel-pad finder-form" id="finder-form" autocomplete="off">' +
            '<label class="field full">Nome completo<input class="input" id="f-nome" name="nome" value="' + esc(form.nome) + '" placeholder="Como está no documento"></label>' +
            '<label class="field">RG<input class="input" id="f-rg" name="rg" value="' + esc(form.rg) + '" placeholder="Ex.: 12.345.678" inputmode="numeric"></label>' +
            '<label class="field">UF do RG<select class="select" id="f-rguf" name="rgUf"><option value="">—</option>' + DATA.estados.map((x) => '<option' + (form.rgUf === x.uf ? ' selected' : '') + '>' + x.uf + '</option>').join('') + '</select></label>' +
            '<label class="field">Nº de inscrição no concurso<input class="input" id="f-insc" name="insc" value="' + esc(form.insc) + '" placeholder="Opcional"></label>' +
            '<label class="field"><span>CPF <span class="muted">(opcional)</span></span><input class="input" id="f-cpf" name="cpf" value="' + esc(form.cpf) + '" placeholder="Usamos só os 6 dígitos do meio" inputmode="numeric"></label>' +
            '<label class="field">Estado do concurso<select class="select" id="f-uf" name="uf"><option value="">Federal / não sei</option>' + DATA.estados.map((x) => '<option value="' + x.uf + '"' + (form.uf === x.uf ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' +
            '<label class="field">Órgão<select class="select" id="f-org" name="org"><option value="">Todos do estado</option>' + orgOptions + '</select></label>' +
            '<label class="field full"><span>Banca do concurso <span class="muted">(se souber)</span></span><select class="select" id="f-banca" name="banca"><option value="">Não sei / procurar em todas</option>' +
              A.bancas.list.map((b) => '<option value="' + esc(b.host) + '"' + (form.banca === b.host ? ' selected' : '') + '>' + esc(b.n) + '</option>').join('') + '</select></label>' +
            '<label class="field full"><span>Palavra-chave do concurso <span class="muted">(opcional)</span></span><input class="input" id="f-extra" name="extra" value="' + esc(form.extra) + '" placeholder="Ex.: soldado, CFSd 2026, escrevente"></label>' +
            '<div class="btn-row full"><button class="btn btn-primary" type="submit">' + icon('search') + 'Montar as buscas</button></div>' +
            '<p class="muted small full">' + icon('shield', 'i-inline') + ' Nada é guardado nesta página. O CPF completo nunca é usado: os diários mostram só o meio dele (***.456.789-**).</p>' +
          '</form>' +
          '<div id="finder-out" class="finder-out"></div>' +
        '</div>' +
        '<section class="section panel panel-pad"><span class="eyebrow">' + icon('info') + 'Dicas para a pesquisa</span><ul class="rules">' +
          '<li>Dentro do PDF, use <b>Ctrl+F</b> (no celular: menu ⋮ → <b>Localizar na página</b>) e procure pelo <b>sobrenome</b> ou pelo <b>número de inscrição</b>: nomes podem estar sem acento ou abreviados.</li>' +
          '<li>Listas de convocação costumam estar em <b>ordem alfabética</b> ou de <b>classificação</b>. Procure pelo título "Edital de convocação", "Resultado final" ou "Homologação".</li>' +
          '<li>Se o Google ainda não encontrou, o PDF pode ser de hoje: abra o diário do dia e use a busca do próprio site com o termo copiado.</li>' +
        '</ul></section>',
      after(view) {
        const out = $('#finder-out', view);
        const read = () => Object.assign(form, Object.fromEntries(new FormData($('#finder-form', view))));

        function row(label, query, href, kind, shown, btn) {
          return '<div class="row finder-row"><div class="grow"><div class="title">' + esc(label) + '</div><code class="query" title="' + esc(query) + '">' + esc(shown || query) + '</code></div>' +
            '<button class="icon-btn" type="button" data-copy-q="' + esc(query) + '" title="Copiar termo" aria-label="Copiar termo">' + icon('copy') + '</button>' +
            '<a class="btn btn-sm ' + (kind === 'primary' ? 'btn-primary' : '') + '" href="' + esc(href) + '" target="_blank" rel="noopener">' + (btn || 'Buscar') + ' ' + icon('external') + '</a></div>';
        }
        function group(title, ic, desc, rows, link) {
          if (!rows.length) return '';
          return '<section class="panel finder-group"><div class="finder-head">' + '<span class="tile-icon">' + icon(ic) + '</span><div class="grow"><h3>' + esc(title) + '</h3><p class="muted small">' + desc + '</p></div>' +
            (link ? A.extLink(link[1], 'btn btn-sm', esc(link[0]) + ' ' + icon('external')) : '') + '</div><div class="list">' + rows.join('') + '</div></section>';
        }

        function build() {
          read();
          const nome = form.nome.trim().replace(/\s+/g, ' ');
          const rgs = rgVariants(form.rg, form.rgUf);
          const mid = cpfMasked(form.cpf);
          const insc = form.insc.trim();
          const extra = form.extra.trim();
          if (!nome && !rgs.length && !insc) {
            out.innerHTML = '<div class="empty">' + icon('search') + '<h3>Preencha pelo menos um dado</h3><p>Nome completo, RG ou número de inscrição.</p></div>';
            return;
          }
          const e = A.ufBy[form.uf];
          const ids = [];
          if (nome) ids.push({ label: 'Nome completo', term: q(nome) });
          if (nome && noAccent(nome) !== nome) ids.push({ label: 'Nome sem acentos', term: q(noAccent(nome)) });
          if (rgs.length) ids.push({ label: 'RG em ' + rgs.length + (rgs.length === 1 ? ' formato' : ' formatos'), term: rgs.map(q).join(' OR ') });
          if (insc) ids.push({ label: 'Nº de inscrição', term: q(insc) });
          if (nome && mid) ids.push({ label: 'Nome + CPF mascarado (***.' + mid + '-**)', term: q(nome) + ' ' + q(mid) });
          const kw = extra ? ' ' + q(extra) : '';
          const main = ids.filter((x) => x.label !== 'Nome sem acentos').slice(0, 3);   // grupos secundários: sem repetições

          let html = '<div class="finder-summary"><span class="badge accent">' + ids.length + ' formas de identificar o cliente</span>' +
            (e ? '<span class="badge">' + esc(e.nome) + '</span>' : '<span class="badge">Federal</span>') + '</div>';

          // 1. Diário Oficial do Estado
          if (e && e.items.doe) {
            const h = host(e.items.doe.u);
            html += group('Diário Oficial do Estado — ' + e.uf, 'newspaper', 'Onde saem convocações, resultados e nomeações dos concursos estaduais.',
              ids.map((x, i) => row(x.label, 'site:' + h + ' ' + x.term + kw, google('site:' + h + ' ' + x.term + kw), i === 0 ? 'primary' : '')),
              ['Abrir o Diário', e.items.doe.u]);
          }
          // 2. Site do órgão
          if (e) {
            const orgs = (form.org ? [form.org] : ['pm', 'pc', 'cbm', 'tj']).map((k) => e.items[k]).filter(Boolean);
            orgs.forEach((it) => {
              const h = host(it.u);
              html += group(it.short + ' — ' + e.uf, 'shield', 'Muitos órgãos publicam as listas em PDF no próprio site, antes ou junto com o diário.',
                main.map((x) => row(x.label, 'site:' + h + ' ' + x.term + kw, google('site:' + h + ' ' + x.term + kw))),
                ['Abrir o site', it.u]);
            });
          }
          // 3. Bancas ligadas ao concurso: página onde a banca chama o candidato
          const orgLabel = e && form.org && e.items[form.org] ? e.items[form.org].short + ' ' + e.uf : '';
          relatedBancas().forEach((b) => {
            const l = A.bancas.links(b, extra || orgLabel);
            html += '<section class="panel finder-group banca-group"><div class="finder-head"><span class="tile-icon">' + icon('clipboard') + '</span><div class="grow"><h3>Banca: ' + esc(b.n) + '</h3>' +
              '<p class="muted small">É aqui que a banca publica convocações, resultados e a lista de quem foi chamado.</p></div></div>' +
              '<div class="btn-row">' +
                '<a class="btn btn-primary btn-sm" href="' + esc(l.chamada) + '" target="_blank" rel="noopener">' + icon('flag') + 'Abrir onde a banca chama o candidato ' + icon('external') + '</a>' +
                A.extLink(l.abrir, 'btn btn-sm', icon('external') + 'Página de concursos da banca') + '</div>' +
              '<div class="list">' + main.map((x) => row(x.label, 'site:' + b.host + ' ' + x.term + kw, google('site:' + b.host + ' ' + x.term + kw))).join('') + '</div></section>';
          });
          const bancaSites = '(' + BANCAS.map((b) => 'site:' + b).join(' OR ') + ')';
          html += group(relatedBancas().length ? 'Outras bancas' : 'Sites das bancas organizadoras', 'clipboard', 'Resultados por etapa, notas e recursos costumam sair primeiro na banca.',
            main.map((x) => row(x.label, x.term + kw + ' ' + bancaSites, google(x.term + kw + ' ' + bancaSites), '', x.term + kw + ' — em ' + BANCAS.length + ' bancas')));
          // 4. Diário Oficial da União
          if (nome || insc) {
            html += group('Diário Oficial da União', 'landmark', 'Concursos federais (PF, PRF, INSS, CNU, tribunais federais) e Forças Armadas.',
              [nome ? row('Nome completo', q(nome), dou(q(nome))) : '', insc ? row('Nº de inscrição', q(insc), dou(q(insc))) : ''].filter(Boolean),
              ['Abrir o DOU', 'https://www.in.gov.br/consulta']);
          }
          // 5. Diários municipais e web
          html += group('Prefeituras e internet em geral', 'search', 'Diários municipais e qualquer outro lugar indexado pelo Google.',
            [nome ? row('Diários municipais (Querido Diário)', nome, 'https://queridodiario.org.br') : '',
              row('Toda a internet', ids[0].term + (rgs.length && nome ? ' ' + q(rgs[0]) : '') + kw + ' concurso', google(ids[0].term + kw + ' concurso'))].filter(Boolean));
          // 6. Alerta automático: o Google manda e-mail quando achar o nome numa página nova (bom para o acompanhamento).
          if (nome) {
            html += group('Alerta automático no Google', 'bell', 'Para acompanhamentos: o Google avisa por e-mail quando o nome aparecer numa página nova. Em "Mostrar opções", escolha "No máximo uma vez por dia" e "Todos os resultados". Se o termo não vier preenchido, cole o que foi copiado.',
              ids.filter((x) => x.label === 'Nome completo' || x.label === 'Nome sem acentos').map((x) => row(x.label, x.term, alerts(x.term), '', '', 'Criar alerta')));
          }

          out.innerHTML = html;
          A.hydrateIcons(out);
          if (window.innerWidth < 900) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        $('#finder-form', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          build();
          history.replaceState(null, '', toHash());
        });
        $('#f-uf', view).addEventListener('change', (ev) => {
          read(); form.uf = ev.target.value; form.org = ''; if (!form.rgUf) form.rgUf = form.uf;
          const next = toHash();
          if (location.hash === next) A.render(); else location.hash = next;
        });
        out.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-copy-q]'); if (!b) return;
          A.copy(b.dataset.copyQ);
        });
        if (form.nome || form.rg || form.insc) build();
        else out.innerHTML = '<div class="empty">' + icon('search') + '<h3>As buscas aparecem aqui</h3><p>Organizadas por lugar: Diário Oficial do estado, site do órgão, bancas, Diário Oficial da União e prefeituras.</p></div>';
      }
    };
  });

  // Atalho na página inicial para o serviço pago.
  A.afterRender.push((view, cur) => {
    if (cur.name !== 'home' || !A.services || !A.services.active()) return;
    const widgets = $('.widgets', view);
    if (!widgets) return;
    widgets.insertAdjacentHTML('beforeend', '<div class="panel widget"><span class="w-label">' + icon('search') + 'Meu nome no Diário</span>' +
      '<span class="w-sub">Nós procuramos sua convocação no Diário Oficial, no site do órgão e na banca. ' + A.services.brl(A.services.price()) + ' no Pix, resultado no WhatsApp.</span>' +
      '<a class="w-link" href="#/pesquisa-diario">Pedir a pesquisa →</a></div>');
  });
})();
