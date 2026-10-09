/*
 * Atlas Concursos — serviços pagos e lembretes.
 *  - "Pesquisa no Diário Oficial": o candidato faz o pedido, paga por Pix e
 *    envia o comprovante no WhatsApp; a equipe procura e devolve o resultado.
 *  - Pedidos ficam no aparelho e, com a conta ativa, também no Firestore
 *    (o administrador acompanha pelo Painel, aba "Pedidos").
 *  - Lembretes de prova no WhatsApp (gravados em "lembretes" no Firestore).
 * Preço, prazo e WhatsApp vêm de config.js (servicos.diario, servicos.acompanhamento
 * e contato.whatsapp). Os limites de uso (lembretes por pessoa, pedidos em
 * aberto e por dia) vêm de config.limites — 0 significa "sem limite".
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const CFG = window.ATLAS_CONFIG || {};
  const DATA = window.ATLAS_DATA;
  const { $, esc, icon, toast, route, Store, fmtDate, addDays } = A;

  const SV = Object.assign({ ativo: true, preco: 15, prazo: 'em até 2 dias úteis' }, (CFG.servicos || {}).diario || {});
  const AC = Object.assign({ ativo: false, preco: 39, semanas: 4 }, (CFG.servicos || {}).acompanhamento || {});
  const LIM = Object.assign({ lembretes: 3, pedidosAbertos: 2, pedidosDia: 3 }, CFG.limites || {});
  const WA = String((CFG.contato || {}).whatsapp || '').replace(/\D/g, '');
  const DRAFT = 'atlas:pedido-rascunho';
  const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const ativo = () => SV.ativo !== false && !!WA && Number(SV.preco) > 0;
  const waLink = (text, to) => 'https://wa.me/' + (to || WA) + '?text=' + encodeURIComponent(text);
  const cloud = () => A.cloud || { enabled: false };
  // Link para compartilhar no WhatsApp (o principal canal dos concurseiros).
  const siteBase = () => String(CFG.siteUrl || (location.origin + location.pathname)).replace(/#.*$/, '');
  A.shareWa = (text, hash) => 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + siteBase() + (hash || ''));
  const hasPix = () => !!(A.pix && A.pix.ready());
  const newCode = () => 'D' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase();
  // Período da pesquisa. "tudo" = todo o período que os sites oficiais deixam consultar (desde o edital do concurso).
  const DESDE = [['tudo', 'Todo o período disponível (desde o edital)'], ['2a', 'Últimos 2 anos'], ['1a', 'Últimos 12 meses'], ['6m', 'Últimos 6 meses'], ['3m', 'Últimos 3 meses']];
  // Planos do serviço: a pesquisa avulsa e, se ativado no Painel, o acompanhamento semanal.
  const PLANOS = () => [
    { id: 'avulsa', nome: 'Pesquisa completa', preco: Number(SV.preco), resumo: 'Uma pesquisa completa, com o resultado explicado no WhatsApp ' + SV.prazo + '.' },
    AC.ativo ? { id: 'acompanhamento', nome: 'Acompanhamento por ' + Number(AC.semanas) + ' semanas', preco: Number(AC.preco), resumo: 'A pesquisa completa e mais uma conferência por semana durante ' + AC.semanas + ' semanas. Avisamos no WhatsApp assim que seu nome sair.' } : null
  ].filter((x) => x && x.preco > 0);
  const planoOf = (id) => PLANOS().find((x) => x.id === id) || PLANOS()[0];
  const menorPreco = () => Math.min.apply(null, PLANOS().map((x) => x.preco));
  // O que o serviço cobre (aparece na página e nos termos).
  const INCLUI = ['1 pessoa: nome completo, RG e nº de inscrição', '1 concurso, no estado escolhido', 'Diário Oficial do estado e Diário Oficial da União', 'Site do órgão e da banca organizadora', 'Todo o período disponível nos sites oficiais, desde o edital (ou o período que você escolher)', 'Resultado explicado no WhatsApp, com os links'];
  const NAO_INCLUI = ['Outros concursos ou outras pessoas (faça um pedido para cada)', 'Diários de prefeituras (consulte no WhatsApp)', 'Acesso à área do candidato ou a sistemas com senha', 'Recursos, defesas ou orientação jurídica', 'Garantia de aprovação ou de nomeação'];
  const STATUS = {
    aguardando: ['warn', 'Aguardando pagamento'],
    pago: ['accent', 'Pago · pesquisa em andamento'],
    entregue: ['ok', 'Entregue'],
    cancelado: ['', 'Cancelado']
  };

  A.pages.push({ n: 'Pesquisa no Diário Oficial feita por nós (R$ ' + SV.preco + ')', href: '#/pesquisa-diario', ic: 'search', sub: 'Serviço' });

  /* ---------- Pedidos ---------- */
  const orders = () => (Array.isArray(Store.state.pedidos) ? Store.state.pedidos : []);

  /* ---------- Limites de uso (contados por dia neste aparelho) ---------- */
  function usage() { const d = A.dateKey(); const u = Store.state.uso; return u && u.dia === d ? u : { dia: d, pedidos: 0 }; }
  function bump(k) { Store.update((s) => { const u = usage(); u[k] = (u[k] || 0) + 1; s.uso = u; }); }
  const Limits = {
    remindMax: () => Number(LIM.lembretes) || 0,
    canRemind(exceptId) {
      const m = Limits.remindMax();
      return !m || Store.state.exams.filter((e) => e.id !== exceptId && e.lembrete && e.lembrete.on).length < m;
    },
    orderBlock() {
      const open = orders().filter((p) => p.status === 'aguardando').length;
      if (Number(LIM.pedidosAbertos) && open >= Number(LIM.pedidosAbertos)) return 'Você já tem ' + open + (open === 1 ? ' pedido aguardando' : ' pedidos aguardando') + ' pagamento. Conclua o pagamento ou cancele um deles em "Meus pedidos" para fazer outro.';
      if (Number(LIM.pedidosDia) && (usage().pedidos || 0) >= Number(LIM.pedidosDia)) return 'Você atingiu o limite de ' + LIM.pedidosDia + ' pedidos por dia. Tente de novo amanhã ou fale com a gente no WhatsApp.';
      return '';
    }
  };
  A.limits = Limits;

  function waMessage(p) {
    return [
      'Olá! Fiz o pedido *' + p.codigo + '* — ' + (planoOf(p.plano) || {}).nome + ' no Diário Oficial (' + brl(p.valor) + ').',
      'Nome: ' + p.nome,
      'Concurso: ' + p.concurso + (p.uf ? ' (' + p.uf + ')' : ''),
      p.inscricao ? 'Inscrição: ' + p.inscricao : '',
      p.rg ? 'RG: ' + p.rg : '',
      'Procurar: ' + ((DESDE.find((d) => d[0] === p.desde) || [])[1] || ''),
      p.obs ? 'Obs.: ' + p.obs : '',
      hasPix() ? 'Segue o comprovante do Pix.' : 'Como faço o pagamento?'
    ].filter(Boolean).join('\n');
  }

  async function createOrder(f) {
    const plano = planoOf(f.plano);
    const p = {
      codigo: newCode(), servico: 'diario', plano: plano.id, valor: plano.preco, status: 'aguardando', criadoEm: new Date().toISOString(),
      nome: f.nome, whatsapp: f.whatsapp, uf: f.uf, concurso: f.concurso, inscricao: f.inscricao, rg: f.rg, desde: f.desde, obs: f.obs
    };
    const c = cloud();
    if (c.enabled && c.user) {
      p.uid = c.user.uid;
      p.email = c.user.email || '';
      await c.set('pedidos', p.codigo, p);
    }
    Store.update((s) => { s.pedidos = (Array.isArray(s.pedidos) ? s.pedidos : []).concat([p]).slice(-30); });
    bump('pedidos');
    return p;
  }

  // Atualiza o status dos pedidos com o que o administrador marcou no Painel.
  async function refreshStatuses() {
    const c = cloud();
    if (!c.enabled || !c.user) return false;
    try {
      const remote = await c.mine('pedidos');
      if (!remote.length) return false;
      const byCode = {};
      remote.forEach((r) => { byCode[r.codigo || r.id] = r; });
      let changed = false;
      Store.update((s) => {
        const list = Array.isArray(s.pedidos) ? s.pedidos : (s.pedidos = []);
        list.forEach((p) => { const r = byCode[p.codigo]; if (r && r.status !== p.status) { p.status = r.status; changed = true; } delete byCode[p.codigo]; });
        Object.values(byCode).forEach((r) => { list.push(r); changed = true; });   // pedidos feitos em outro aparelho
      });
      return changed;
    } catch (e) { console.error(e); return false; }
  }

  function orderRow(p) {
    const st = STATUS[p.status] || STATUS.aguardando;
    return '<div class="row order-row"><span class="tile-icon">' + icon('newspaper') + '</span>' +
      '<div class="grow"><div class="title">' + esc(p.plano === 'acompanhamento' ? 'Acompanhamento no Diário' : 'Pesquisa no Diário') + ' · ' + esc(p.codigo) + '</div>' +
      '<div class="sub">' + esc(p.concurso || '') + (p.uf ? ' · ' + esc(p.uf) : '') + ' · ' + esc(fmtDate(String(p.criadoEm).slice(0, 10))) + ' · ' + brl(p.valor) + '</div></div>' +
      '<span class="badge ' + st[0] + '">' + st[1] + '</span>' +
      (p.status === 'aguardando' && WA ? '<a class="btn btn-sm" href="' + esc(waLink(waMessage(p))) + '" target="_blank" rel="noopener">' + icon('chat') + 'Enviar comprovante</a>' : '') +
      (p.status === 'aguardando' ? '<button class="btn btn-sm btn-ghost" type="button" data-cancel="' + esc(p.codigo) + '">Cancelar</button>' : '') +
      '</div>';
  }

  function renderOrders(el) {
    if (!el) return;
    const draw = () => {
      const list = orders().slice().reverse();
      el.innerHTML = list.length ? '<h3 style="font-size:15px;margin:16px 0 8px">Meus pedidos</h3><div class="list">' + list.map(orderRow).join('') + '</div>' : '';
      A.hydrateIcons(el);
    };
    draw();
    refreshStatuses().then((ch) => { if (ch && document.body.contains(el)) draw(); });
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', async (ev) => {
      const b = ev.target.closest('[data-cancel]'); if (!b) return;
      if (!confirm('Cancelar o pedido ' + b.dataset.cancel + '? Se você já pagou, fale com a gente no WhatsApp em vez de cancelar.')) return;
      const code = b.dataset.cancel;
      const c = cloud();
      try {
        if (c.enabled && c.user) await c.update('pedidos', code, { status: 'cancelado', atualizadoEm: new Date().toISOString() });
      } catch (e) { console.error(e); toast('Não foi possível cancelar agora. Tente de novo.'); return; }
      Store.update((s) => { (s.pedidos || []).forEach((p) => { if (p.codigo === code) p.status = 'cancelado'; }); });
      if (last && last.codigo === code) last = null;
      toast('Pedido ' + code + ' cancelado.');
      draw();
    });
  }

  /* ---------- Página do serviço ---------- */
  let last = null;   // pedido recém-criado (mostra a tela de pagamento)

  function payPanel(p) {
    const code = hasPix() ? A.pix.payload(p.valor, { txid: p.codigo, info: 'Pesquisa Diario ' + p.codigo }) : '';
    return '<div class="panel panel-pad pay-panel" id="pay-panel">' +
      '<span class="eyebrow">' + icon('check') + 'Pedido ' + esc(p.codigo) + ' registrado</span>' +
      '<h2>' + (code ? 'Falta pouco: pague e envie o comprovante' : 'Falta pouco: combine o pagamento no WhatsApp') + '</h2>' +
      (code
        ? '<div class="pay-grid"><div class="pix-qr">' + A.pix.qr(code) + '</div><div class="pay-steps">' +
            '<p><b>1.</b> Abra o app do seu banco → <b>Pix</b> → <b>Ler QR Code</b> ou <b>Copia e Cola</b>.</p>' +
            '<p><b>2.</b> Confira o valor de <b>' + brl(p.valor) + '</b> e o recebedor <b>' + esc(A.pix.nome()) + '</b>.</p>' +
            '<label class="field">Pix copia e cola<textarea class="textarea" id="pay-code" rows="3" readonly style="min-height:72px;font-family:monospace;font-size:12px">' + esc(code) + '</textarea></label>' +
            '<button class="btn" id="pay-copy" type="button">' + icon('copy') + 'Copiar código Pix</button>' +
            '<p><b>3.</b> Envie o comprovante no WhatsApp com o código do pedido:</p>' +
          '</div></div>'
        : '<p class="muted">O pagamento de <b>' + brl(p.valor) + '</b> é feito por Pix. Toque no botão abaixo: enviamos a chave Pix pelo WhatsApp junto com a confirmação do seu pedido.</p>') +
      '<a class="btn btn-primary btn-wa" href="' + esc(waLink(waMessage(p))) + '" target="_blank" rel="noopener">' + icon('chat') + (code ? 'Enviar comprovante no WhatsApp' : 'Combinar o pagamento no WhatsApp') + '</a>' +
      '<p class="muted small">Você recebe o resultado <b>' + esc(SV.prazo) + '</b> depois da confirmação do pagamento, no WhatsApp ' + esc(A.cloud && A.cloud.fmtWhats ? A.cloud.fmtWhats(p.whatsapp) : p.whatsapp) + '. Guarde o código <b>' + esc(p.codigo) + '</b>.</p>' +
      '<button class="btn btn-ghost btn-sm" id="pay-new" type="button">Fazer outro pedido</button>' +
    '</div>';
  }

  route(/^\/pesquisa-diario(?:\/([A-Za-z]{2}))?$/, 'pesquisa-diario', function (ufArg) {
    const c = cloud();
    const prof = (c.user && c.profile) || {};
    let draft = {};
    try { draft = JSON.parse(sessionStorage.getItem(DRAFT) || '{}'); } catch (e) {}
    const watch = Store.state.nameWatch || {};
    const v = (k, fb) => esc(draft[k] != null ? draft[k] : fb || '');
    const ufSel = draft.uf || (ufArg ? ufArg.toUpperCase() : '') || watch.uf || Store.state.profile.uf || '';
    const needLogin = c.enabled && !c.user;
    const benefits = [
      ['newspaper', 'Diário Oficial do seu estado e da União', 'Procuramos pelo seu nome, RG e número de inscrição em todos os formatos que os diários usam.'],
      ['shield', 'Site do órgão e da banca', 'Convocações, resultados, exame médico, TAF, investigação social e nomeação.'],
      ['chat', 'Resultado explicado no WhatsApp', 'Os links das publicações com a página onde seu nome aparece e o que fazer em seguida, com os prazos.'],
      ['check', 'Sem publicação ainda?', 'Você recebe a lista de onde procuramos e como acompanhar as próximas publicações.']
    ];
    const steps = ['Preencha seus dados', 'Pague no Pix (o código do pedido já vai junto)', 'Envie o comprovante no WhatsApp', 'Receba o resultado ' + SV.prazo];
    const planos = PLANOS();
    const planoSel = (planoOf(draft.plano) || planos[0]).id;
    const planPick = planos.length > 1
      ? '<div class="plan-pick full" role="radiogroup" aria-label="Escolha o plano">' + planos.map((x) => '<label class="plan"><input type="radio" name="plano" value="' + x.id + '"' + (x.id === planoSel ? ' checked' : '') + '>' +
          '<span class="plan-top"><b>' + esc(x.nome) + '</b><span class="plan-price">' + brl(x.preco) + '</span></span><small>' + esc(x.resumo) + '</small></label>').join('') + '</div>'
      : '<input type="hidden" name="plano" value="' + planos[0].id + '">';
    const scope = '<div class="panel panel-pad scope"><span class="eyebrow">' + icon('clipboard') + 'O que está incluído</span>' +
      '<ul class="scope-list ok">' + INCLUI.map((x) => '<li>' + icon('check') + esc(x) + '</li>').join('') + '</ul>' +
      '<span class="eyebrow" style="margin-top:12px">' + icon('x') + 'Não está incluído</span>' +
      '<ul class="scope-list no">' + NAO_INCLUI.map((x) => '<li>' + icon('x') + esc(x) + '</li>').join('') + '</ul>' +
      '<p class="muted small" style="margin-top:12px">' + icon('info', 'i-inline') + ' Os diários oficiais são públicos e gratuitos. Você paga pelo nosso trabalho de procurar em todos os lugares, nos formatos certos, e explicar o resultado. Não somos órgão do governo nem da banca.</p></div>';

    const intro =
      '<div class="page-head service-head"><div><span class="eyebrow">' + icon('sparkle') + 'Serviço Atlas · ' + (PLANOS().length > 1 ? 'a partir de ' : '') + brl(menorPreco()) + '</span>' +
      '<h1>Nós procuramos <span class="grad-text">seu nome no Diário Oficial</span></h1>' +
      '<p>Convocação, resultado, exame médico, nomeação: as publicações saem em PDFs enormes e é fácil perder um prazo. Você faz o pedido, paga ' + brl(menorPreco()) + ' no Pix e recebe no WhatsApp tudo o que encontramos.</p></div></div>';

    if (!ativo()) {
      return {
        title: 'Pesquisa no Diário Oficial', crumbs: [['Início', '#/'], ['Pesquisa no Diário', '#/pesquisa-diario']],
        html: intro + '<div class="panel panel-pad"><h2 style="font-size:18px">Serviço temporariamente indisponível</h2><p class="muted" style="margin-top:8px">Estamos organizando a agenda de pesquisas. Volte em breve' + (WA ? ' ou <a class="grad-text" href="' + esc(waLink('Olá! Quero saber quando a pesquisa no Diário Oficial volta.')) + '" target="_blank" rel="noopener">fale com a gente no WhatsApp</a>' : '') + '.</p></div>'
      };
    }

    const form =
      '<form class="panel panel-pad service-form" id="order-form" autocomplete="on" novalidate>' +
        '<h2 style="font-size:18px">Fazer meu pedido</h2>' + planPick +
        '<label class="field full">Nome completo *<input class="input" name="nome" required maxlength="90" value="' + v('nome', prof.nome || watch.nome || Store.state.profile.nome) + '" placeholder="Como está no documento" autocomplete="name"></label>' +
        '<label class="field">WhatsApp para receber o resultado *<input class="input" name="whatsapp" type="tel" inputmode="tel" required value="' + v('whatsapp', prof.whatsapp ? c.fmtWhats(prof.whatsapp) : '') + '" placeholder="(11) 91234-5678" autocomplete="tel"></label>' +
        '<label class="field">Estado do concurso *<select class="select" name="uf" required><option value="">Selecione…</option><option value="BR"' + (ufSel === 'BR' ? ' selected' : '') + '>Federal (União)</option>' +
          DATA.estados.map((e) => '<option value="' + e.uf + '"' + (ufSel === e.uf ? ' selected' : '') + '>' + esc(e.nome) + '</option>').join('') + '</select></label>' +
        '<label class="field full">Concurso e cargo *<input class="input" name="concurso" required maxlength="120" value="' + v('concurso', watch.extra) + '" placeholder="Ex.: PM-SP Soldado 2025, TJ-RJ Técnico"></label>' +
        '<label class="field"><span>Nº de inscrição <span class="muted">(se tiver)</span></span><input class="input" name="inscricao" maxlength="40" value="' + v('inscricao', watch.insc) + '"></label>' +
        '<label class="field"><span>RG <span class="muted">(opcional)</span></span><input class="input" name="rg" maxlength="20" value="' + v('rg', watch.rg) + '" inputmode="numeric"></label>' +
        '<label class="field">Procurar publicações<select class="select" name="desde">' + DESDE.map((d) => '<option value="' + d[0] + '"' + ((draft.desde || 'tudo') === d[0] ? ' selected' : '') + '>' + d[1] + '</option>').join('') + '</select></label>' +
        '<label class="field full"><span>Algo mais que devemos saber? <span class="muted">(opcional)</span></span><textarea class="textarea" name="obs" rows="2" maxlength="400" style="min-height:60px" placeholder="Ex.: estou esperando a convocação para o exame médico">' + v('obs') + '</textarea></label>' +
        '<label class="opt-check full"><input type="checkbox" name="lgpd" required' + (draft.lgpd ? ' checked' : '') + '> Autorizo o Atlas a usar estes dados somente para fazer esta pesquisa e falar comigo no WhatsApp (<a class="grad-text" href="privacidade.html" target="_blank" rel="noopener">privacidade</a>).</label>' +
        '<p class="badge danger full auth-error" id="order-error" hidden></p>' +
        (needLogin ? '<p class="muted small full">' + icon('user', 'i-inline') + ' Para acompanhar o pedido, você vai entrar ou criar sua conta grátis em seguida. Seus dados preenchidos ficam guardados.</p>' : '') +
        '<button class="btn btn-primary btn-lg full" type="submit" id="order-submit">' + icon('check') + 'Fazer pedido · ' + brl(planoOf(planoSel).preco) + '</button>' +
        '<p class="muted small full">' + icon('shield', 'i-inline') + ' Não pedimos CPF, senha nem dados do cartão. O pagamento é só por Pix' + (hasPix() ? ' para <b>' + esc(A.pix.nome()) + '</b>' : '') + '.</p>' +
      '</form>';

    return {
      title: 'Pesquisa no Diário Oficial',
      crumbs: [['Início', '#/'], ['Pesquisa no Diário', '#/pesquisa-diario']],
      html: intro +
        '<div class="service-layout">' +
          '<div class="service-info">' +
            '<div class="panel panel-pad"><span class="eyebrow">' + icon('list') + 'Como funciona</span><ol class="steps">' + steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol></div>' +
            '<div class="benefits">' + benefits.map((b) => '<div class="benefit"><span class="tile-icon">' + icon(b[0]) + '</span><div><h3>' + esc(b[1]) + '</h3><p>' + esc(b[2]) + '</p></div></div>').join('') + '</div>' +
            scope +
          '</div>' +
          '<div id="order-box">' + (last ? payPanel(last) : form) + '</div>' +
        '</div>' +
        '<div id="order-list" class="section"></div>',
      after(view) {
        const box = $('#order-box', view);
        renderOrders($('#order-list', view));
        const bindPay = () => {
          const cp = $('#pay-copy', view);
          if (cp) cp.addEventListener('click', () => { A.copy($('#pay-code', view).value); toast('Código Pix copiado! Cole no app do seu banco.'); });
          const nw = $('#pay-new', view);
          if (nw) nw.addEventListener('click', () => { last = null; A.render(); });
        };
        bindPay();
        const f = $('#order-form', view);
        if (!f) return;
        const errBox = $('#order-error', view);
        const fail = (m) => { errBox.textContent = m; errBox.hidden = false; errBox.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
        f.addEventListener('change', (ev) => {
          if (ev.target.name !== 'plano') return;
          $('#order-submit', view).innerHTML = icon('check') + 'Fazer pedido · ' + brl(planoOf(ev.target.value).preco);
        });
        f.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          errBox.hidden = true;
          const d = Object.fromEntries(new FormData(f));
          Object.keys(d).forEach((k) => { if (typeof d[k] === 'string') d[k] = d[k].trim().replace(/\s+/g, ' '); });
          const whats = c.normWhats ? c.normWhats(d.whatsapp) : String(d.whatsapp).replace(/\D/g, '');
          if (d.nome.length < 5 || !/\s/.test(d.nome)) return fail('Informe seu nome completo, como está no documento.');
          if (!whats) return fail('Informe um WhatsApp válido com DDD, ex.: (11) 91234-5678.');
          if (!d.uf) return fail('Escolha o estado do concurso.');
          if (d.concurso.length < 3) return fail('Informe o concurso e o cargo.');
          if (!d.lgpd) return fail('Para fazer o pedido, marque a autorização de uso dos dados.');
          d.whatsapp = whats;
          const blocked = Limits.orderBlock();
          if (blocked) return fail(blocked);
          if (c.enabled) {
            await c.whenReady();
            if (!c.user) {
              try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) {}
              toast('Entre ou crie sua conta grátis para concluir o pedido.');
              c.requireLogin('#/pesquisa-diario', 'cadastro');
              return;
            }
          }
          const btn = $('button[type=submit]', f); btn.disabled = true;
          try {
            last = await createOrder(d);
            try { sessionStorage.removeItem(DRAFT); } catch (e) {}
            box.innerHTML = payPanel(last);
            A.hydrateIcons(box);
            bindPay();
            renderOrders($('#order-list', view));
            box.scrollIntoView({ block: 'start', behavior: 'smooth' });
          } catch (e) {
            console.error(e);
            fail('Não foi possível registrar o pedido agora. Verifique a internet e tente de novo.');
            btn.disabled = false;
          }
        });
      }
    };
  });

  /* =========================================================
     Lembretes de prova no WhatsApp
     ========================================================= */
  const AVISOS = [
    ['insc', 'Inscrições terminando (1 dia antes)'],
    ['p7', '7 dias antes da prova'],
    ['p1', 'Véspera da prova'],
    ['res', 'Dia do resultado']
  ];
  // Datas em que cada aviso deve sair (AAAA-MM-DD).
  function eventDates(e) {
    const out = {};
    if (e.inscricao) out.insc = addDays(e.inscricao, -1);
    if (e.data) { out.p7 = addDays(e.data, -7); out.p1 = addDays(e.data, -1); }
    if (e.resultado) out.res = e.resultado;
    return out;
  }
  const remId = (e) => (cloud().user ? cloud().user.uid + '_' + e.id : '');

  // Grava (ou atualiza) o lembrete no Firestore. Retorna 'cloud', 'whatsapp' (sem conta) ou 'login'.
  async function syncReminder(e) {
    const c = cloud();
    const l = e.lembrete;
    if (!l || !l.on) return removeReminder(e);
    if (!c.enabled) {
      // Sem contas ativadas: o pedido de lembrete vai direto para o WhatsApp do Atlas.
      if (!WA) return 'off';
      const msg = ['Olá! Quero receber lembretes da minha prova no WhatsApp.', 'Concurso: ' + e.nome + (e.cargo ? ' — ' + e.cargo : ''),
        e.inscricao ? 'Inscrições até: ' + fmtDate(e.inscricao) : '', e.data ? 'Prova: ' + fmtDate(e.data) : '', e.resultado ? 'Resultado: ' + fmtDate(e.resultado) : '',
        'Avisos: ' + l.avisos.map((k) => (AVISOS.find((a) => a[0] === k) || [k, k])[1]).join(', ')].filter(Boolean).join('\n');
      window.open(waLink(msg), '_blank', 'noopener');
      return 'whatsapp';
    }
    await c.whenReady();
    if (!c.user) return 'login';
    await c.set('lembretes', remId(e), {
      uid: c.user.uid, nome: (c.profile && c.profile.nome) || Store.state.profile.nome || '', whatsapp: l.whatsapp,
      concurso: e.nome, cargo: e.cargo || '', inscricao: e.inscricao || '', prova: e.data || '', resultado: e.resultado || '',
      avisos: l.avisos, datas: eventDates(e), ativo: true, atualizadoEm: new Date().toISOString()
    }, true);
    if (c.profile && !c.profile.whatsapp) c.saveProfile({ whatsapp: l.whatsapp, aceitaWhats: true }).catch(() => {});
    return 'cloud';
  }
  async function removeReminder(e) {
    const c = cloud();
    if (!c.enabled || !c.user) return 'off';
    try { await c.remove('lembretes', remId(e)); } catch (err) { /* já não existia */ }
    return 'off';
  }

  // Ao entrar na conta, envia os lembretes que foram pedidos antes do login.
  async function flushPending() {
    const c = cloud();
    if (!c.enabled) return;
    await c.whenReady();
    if (!c.user) return;
    const pend = Store.state.exams.filter((e) => e.lembrete && e.lembrete.on && e.lembrete.pendente);
    for (const e of pend) {
      try { if (await syncReminder(e) === 'cloud') Store.update((s) => { const x = s.exams.find((y) => y.id === e.id); if (x) delete x.lembrete.pendente; }); }
      catch (err) { console.error(err); }
    }
  }
  A.afterRender.push((view, cur) => { if (cur.name === 'concursos' || cur.name === 'conta') flushPending(); });

  A.services = { renderOrders, price: menorPreco, planos: PLANOS, inclui: INCLUI, naoInclui: NAO_INCLUI, limits: LIM, prazo: () => SV.prazo, active: ativo, brl, AVISOS, eventDates, syncReminder, removeReminder, whatsapp: () => WA };
})();
