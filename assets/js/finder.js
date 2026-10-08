/*
 * Atlas Concursos — "Meu nome no Diário Oficial".
 * Monta buscas avançadas e organizadas para o candidato achar o próprio nome,
 * RG ou número de inscrição em diários oficiais, sites dos órgãos e bancas.
 * Nada é enviado para servidores do Atlas: os dados ficam no aparelho.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const { $, $$, esc, icon, toast, route, Store } = A;
  const DATA = window.ATLAS_DATA;

  const BANCAS = ['cebraspe.org.br', 'fgv.br', 'concursosfcc.com.br', 'vunesp.com.br', 'cesgranrio.org.br', 'ibfc.org.br', 'institutoaocp.org.br', 'quadrix.org.br', 'idecan.org.br', 'institutoconsulplan.org.br', 'fundatec.org.br', 'iades.com.br', 'fumarc.com.br', 'fepese.org.br', 'objetivas.com.br'];
  const TIPOS_ORG = ['pm', 'pc', 'cbm', 'tj', 'mp', 'dpe', 'tre', 'sefaz', 'tce', 'al', 'gov'];

  A.navTop.push({ href: '#/meu-nome', icon: 'search', label: 'Meu nome no Diário' });
  A.pages.push({ n: 'Meu nome no Diário Oficial (procurar RG, inscrição, convocação)', href: '#/meu-nome', ic: 'search', sub: 'Ferramenta' });

  // Atalho "Procurar meu nome" em cada órgão estadual.
  A.cardBadges.push((it) => it.uf && it.tipo && it.tipo !== 'trt'
    ? '<a class="chip find-chip" href="#/meu-nome/' + it.uf + '/' + it.tipo + '">' + icon('search') + 'Procurar meu nome nos editais</a>' : '');

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

  route(/^\/meu-nome(?:\/([A-Za-z]{2}))?(?:\/([a-z]+))?$/, 'meu-nome', function (uf, org) {
    const saved = Store.state.nameWatch || {};
    if (!form.nome && saved.nome) Object.assign(form, saved, { cpf: '' });
    if (uf) form.uf = uf.toUpperCase();
    if (org) form.org = org;
    if (!form.uf) form.uf = Store.state.profile.uf || '';
    if (!form.rgUf) form.rgUf = form.uf;
    const e = A.ufBy[form.uf];
    const orgOptions = e ? TIPOS_ORG.filter((k) => e.items[k]).map((k) => '<option value="' + k + '"' + (form.org === k ? ' selected' : '') + '>' + esc(DATA.tipos[k].nome) + '</option>').join('') : '';

    return {
      title: 'Meu nome no Diário Oficial',
      crumbs: [['Início', '#/'], ['Meu nome no Diário Oficial', '#/meu-nome']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('search') + 'Busca avançada grátis</span><h1>Encontre seu nome no Diário Oficial</h1>' +
        '<p>Convocação, resultado, exame médico, nomeação: tudo sai em diário oficial, em PDFs enormes. Informe seus dados e o Atlas monta as buscas certas em cada lugar, já com os formatos que os diários usam.</p></div></div>' +
        (A.services ? A.services.promo() : '') +
        '<div class="finder">' +
          '<form class="panel panel-pad finder-form" id="finder-form" autocomplete="off">' +
            '<label class="field full">Nome completo<input class="input" id="f-nome" name="nome" value="' + esc(form.nome) + '" placeholder="Como está no documento" autocomplete="name"></label>' +
            '<label class="field">RG<input class="input" id="f-rg" name="rg" value="' + esc(form.rg) + '" placeholder="Ex.: 12.345.678" inputmode="numeric"></label>' +
            '<label class="field">UF do RG<select class="select" id="f-rguf" name="rgUf"><option value="">—</option>' + DATA.estados.map((x) => '<option' + (form.rgUf === x.uf ? ' selected' : '') + '>' + x.uf + '</option>').join('') + '</select></label>' +
            '<label class="field">Nº de inscrição no concurso<input class="input" id="f-insc" name="insc" value="' + esc(form.insc) + '" placeholder="Opcional"></label>' +
            '<label class="field"><span>CPF <span class="muted">(opcional)</span></span><input class="input" id="f-cpf" name="cpf" value="' + esc(form.cpf) + '" placeholder="Usamos só os 6 dígitos do meio" inputmode="numeric"></label>' +
            '<label class="field">Estado do concurso<select class="select" id="f-uf" name="uf"><option value="">Federal / não sei</option>' + DATA.estados.map((x) => '<option value="' + x.uf + '"' + (form.uf === x.uf ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select></label>' +
            '<label class="field">Órgão<select class="select" id="f-org" name="org"><option value="">Todos do estado</option>' + orgOptions + '</select></label>' +
            '<label class="field full"><span>Banca do concurso <span class="muted">(se souber)</span></span><select class="select" id="f-banca" name="banca"><option value="">Não sei / procurar em todas</option>' +
              A.bancas.list.map((b) => '<option value="' + esc(b.host) + '"' + (form.banca === b.host ? ' selected' : '') + '>' + esc(b.n) + '</option>').join('') + '</select></label>' +
            '<label class="field full"><span>Palavra-chave do concurso <span class="muted">(opcional)</span></span><input class="input" id="f-extra" name="extra" value="' + esc(form.extra) + '" placeholder="Ex.: soldado, CFSd 2026, escrevente"></label>' +
            '<div class="btn-row full"><button class="btn btn-primary" type="submit">' + icon('search') + 'Montar minhas buscas</button>' +
              '<button class="btn" type="button" id="f-save">' + icon('star') + 'Salvar para buscar de novo</button><span class="muted small" id="finder-left"></span></div>' +
            '<p class="muted small full">' + icon('shield', 'i-inline') + ' Seus dados ficam só neste aparelho. Ao tocar em "Buscar", o termo vai para o site escolhido como qualquer pesquisa. O CPF completo nunca é usado: os diários mostram só o meio dele (***.456.789-**).</p>' +
          '</form>' +
          '<div id="finder-out" class="finder-out"></div>' +
        '</div>' +
        '<section class="section panel panel-pad"><span class="eyebrow">' + icon('info') + 'Dicas de quem já passou por isso</span><ul class="rules">' +
          '<li>Dentro do PDF, use <b>Ctrl+F</b> (no celular: menu ⋮ → <b>Localizar na página</b>) e procure pelo <b>sobrenome</b> ou pelo <b>número de inscrição</b>: nomes podem estar sem acento ou abreviados.</li>' +
          '<li>Listas de convocação costumam estar em <b>ordem alfabética</b> ou de <b>classificação</b>. Procure pelo título "Edital de convocação", "Resultado final" ou "Homologação".</li>' +
          '<li>Se o Google ainda não encontrou, o PDF pode ser de hoje: abra o diário do dia e use a busca do próprio site com o termo copiado.</li>' +
          '<li>Crie um alerta grátis no Google Alerts com o seu nome entre aspas para ser avisado por e-mail.</li>' +
        '</ul></section>',
      after(view) {
        const out = $('#finder-out', view);
        const read = () => Object.assign(form, Object.fromEntries(new FormData($('#finder-form', view))));

        function row(label, query, href, kind, shown) {
          return '<div class="row finder-row"><div class="grow"><div class="title">' + esc(label) + '</div><code class="query" title="' + esc(query) + '">' + esc(shown || query) + '</code></div>' +
            '<button class="icon-btn" type="button" data-copy-q="' + esc(query) + '" title="Copiar termo" aria-label="Copiar termo">' + icon('copy') + '</button>' +
            '<a class="btn btn-sm ' + (kind === 'primary' ? 'btn-primary' : '') + '" href="' + esc(href) + '" target="_blank" rel="noopener">Buscar ' + icon('external') + '</a></div>';
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

          let html = '<div class="finder-summary"><span class="badge accent">' + ids.length + ' formas de identificar você</span>' +
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

          out.innerHTML = html;
          A.hydrateIcons(out);
          if (window.innerWidth < 900) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Cada "Montar minhas buscas" conta uma busca grátis do dia (limite definido no Painel).
        const left = $('#finder-left', view);
        const showLeft = () => {
          if (!left || !A.limits) return;
          const n = A.limits.searchLeft();
          left.textContent = n === Infinity ? '' : n + (n === 1 ? ' busca grátis restante hoje' : ' buscas grátis restantes hoje');
        };
        showLeft();
        $('#finder-form', view).addEventListener('submit', (ev) => {
          ev.preventDefault();
          if (A.limits && !A.limits.useSearch()) {
            out.innerHTML = A.limits.searchLimitHtml();
            A.hydrateIcons(out);
            out.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          showLeft();
          build();
        });
        $('#f-uf', view).addEventListener('change', (ev) => {
          read(); form.uf = ev.target.value; form.org = ''; if (!form.rgUf) form.rgUf = form.uf;
          const next = '#/meu-nome' + (form.uf ? '/' + form.uf : '');
          if (location.hash === next) A.render(); else location.hash = next;
        });
        $('#f-save', view).addEventListener('click', () => {
          read();
          Store.update((s) => { s.nameWatch = { nome: form.nome, rg: form.rg, rgUf: form.rgUf, insc: form.insc, uf: form.uf, org: form.org, extra: form.extra, banca: form.banca }; });
          toast('Busca salva neste aparelho. Ela aparece na página inicial.');
        });
        out.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-copy-q]'); if (!b) return;
          A.copy(b.dataset.copyQ);
        });
        if (form.nome || form.rg || form.insc) build();
        else out.innerHTML = '<div class="empty">' + icon('search') + '<h3>Suas buscas aparecem aqui</h3><p>Organizadas por lugar: Diário Oficial do estado, site do órgão, bancas, Diário Oficial da União e prefeituras.</p></div>';
      }
    };
  });

  // Atalho na página inicial para quem salvou a busca.
  A.afterRender.push((view, cur) => {
    if (cur.name !== 'home') return;
    const w = Store.state.nameWatch;
    const widgets = $('.widgets', view);
    if (!widgets) return;
    const html = w && (w.nome || w.rg || w.insc)
      ? '<div class="panel widget"><span class="w-label">' + icon('search') + 'Meu nome no Diário</span><span class="w-value" style="font-size:20px">' + esc((w.nome || 'RG ' + w.rg).split(' ')[0]) + '</span><span class="w-sub">Busca salva' + (w.uf ? ' · ' + esc(w.uf) : '') + '. Confira toda semana.</span><a class="w-link" href="#/meu-nome">Buscar de novo →</a></div>'
      : '<div class="panel widget"><span class="w-label">' + icon('search') + 'Meu nome no Diário</span><span class="w-sub">Procure sua convocação pelo nome, RG ou inscrição em todos os diários de uma vez.</span><a class="w-link" href="#/meu-nome">Procurar agora →</a></div>';
    widgets.insertAdjacentHTML('beforeend', html);
  });
})();
