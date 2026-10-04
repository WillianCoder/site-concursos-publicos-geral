/*
 * Atlas Concursos — monetização com preço justo.
 *  - "Apoie o Atlas": doação por Pix com QR Code e copia e cola (gerados no navegador).
 *  - "Anuncie no Atlas": pacotes de patrocínio e contato comercial.
 *  - Cards "Patrocinado" na página inicial, categorias, estados e ferramentas.
 *  - Recomendações com link de afiliado.
 * Tudo é configurado em config.js e só aparece depois de preenchido.
 */
(function () {
  'use strict';
  const A = window.Atlas;
  const CFG = window.ATLAS_CONFIG || {};
  const { $, $$, esc, icon, toast, dateKey, route } = A;

  const pix = CFG.pix || {};
  const contato = CFG.contato || {};
  const hasPix = () => !!(pix.chave && pix.nome && pix.cidade);
  const hasContato = () => !!(contato.email || contato.whatsapp);

  /* =========================================================
     Pix "copia e cola" (BR Code estático, padrão do Banco Central)
     ========================================================= */
  const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
  function crc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }
  const ascii = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-]/g, '').trim();
  function pixPayload(valor) {
    const conta = tlv('00', 'br.gov.bcb.pix') + tlv('01', String(pix.chave).trim()) + tlv('02', 'Apoio Atlas Concursos');
    const p = tlv('00', '01') + tlv('26', conta) + tlv('52', '0000') + tlv('53', '986') +
      (valor > 0 ? tlv('54', Number(valor).toFixed(2)) : '') +
      tlv('58', 'BR') + tlv('59', ascii(pix.nome).toUpperCase().slice(0, 25)) + tlv('60', ascii(pix.cidade).toUpperCase().slice(0, 15)) +
      tlv('62', tlv('05', 'ATLAS')) + '6304';
    return p + crc16(p);
  }
  function qrSvg(text) {
    if (typeof window.qrcode !== 'function') return '';
    const q = window.qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }
  A.pix = { payload: pixPayload, crc16 };

  /* =========================================================
     Navegação, busca e rodapé
     ========================================================= */
  A.navProject.push(
    { href: '#/apoie', icon: 'sparkle', label: 'Apoie o Atlas', show: hasPix },
    { href: '#/anuncie', icon: 'target', label: 'Anuncie no Atlas', show: hasContato }
  );
  if (hasPix()) A.pages.push({ n: 'Apoie o Atlas (Pix)', href: '#/apoie', ic: 'sparkle', sub: 'Projeto' });
  if (hasContato()) A.pages.push({ n: 'Anuncie no Atlas', href: '#/anuncie', ic: 'target', sub: 'Projeto' });

  function footerLinks() {
    const box = document.querySelector('.footer-links');
    if (!box || box.dataset.monet) return;
    box.dataset.monet = '1';
    if (hasPix()) box.insertAdjacentHTML('afterbegin', '<a href="#/apoie">Apoie</a>');
    if (hasContato()) box.insertAdjacentHTML('beforeend', '<a href="#/anuncie">Anuncie</a>');
  }

  /* =========================================================
     Cards patrocinados e recomendações
     ========================================================= */
  const ativos = () => (CFG.patrocinios || []).filter((p) => p && A.safeUrl(p.url) && (!p.ate || p.ate >= dateKey()));
  const sponsorCard = (p) =>
    '<article class="card sponsor">' +
      '<div class="card-top">' + A.mono(p.titulo, p.url) +
        '<div class="card-title"><h3>' + esc(p.titulo) + '</h3><span class="domain">' + esc(A.hostOf(p.url)) + '</span></div>' +
        '<span class="tag">Patrocinado</span></div>' +
      (p.desc ? '<p class="desc">' + esc(p.desc) + '</p>' : '') +
      '<div class="card-actions"><a class="btn btn-primary btn-sm btn-open" href="' + esc(p.url) + '" target="_blank" rel="sponsored noopener">Conhecer ' + icon('external') + '</a></div>' +
    '</article>';

  function recomendadosHtml() {
    const list = (CFG.recomendados || []).filter((r) => r && A.safeUrl(r.url));
    if (!list.length) return '';
    return '<section class="section" data-monet="rec"><div class="section-head"><h2>' + icon('star') + 'Recomendados para concurseiros</h2></div>' +
      '<div class="cards">' + list.map((r) =>
        '<article class="card">' +
          '<div class="card-top">' + A.mono(r.titulo, r.url) + '<div class="card-title"><h3>' + esc(r.titulo) + '</h3><span class="domain">' + esc(r.tag || A.hostOf(r.url)) + '</span></div>' +
          (r.preco ? '<span class="badge accent">' + esc(r.preco) + '</span>' : '') + '</div>' +
          (r.desc ? '<p class="desc">' + esc(r.desc) + '</p>' : '') +
          '<div class="card-actions"><a class="btn btn-sm btn-open" href="' + esc(r.url) + '" target="_blank" rel="sponsored nofollow noopener">Ver oferta ' + icon('external') + '</a></div>' +
        '</article>').join('') + '</div>' +
      '<p class="muted small" style="margin-top:10px">Links de afiliado: o Atlas pode receber uma comissão se você comprar, sem nenhum custo extra para você. Isso ajuda a manter o site gratuito.</p></section>';
  }

  function placementKey(cur) {
    if (cur.name === 'home') return 'home';
    if (cur.name === 'categoria') return 'c:' + cur.params[0];
    if (cur.name === 'uf') return 'uf:' + String(cur.params[0]).toUpperCase();
    if (cur.name === 'ferramentas') return 'ferramentas';
    if (cur.name === 'radar') return 'radar';
    if (cur.name === 'descubra') return 'descubra';
    return '';
  }

  A.afterRender.push((view, cur) => {
    footerLinks();
    const key = placementKey(cur);
    if (!key) return;

    const sp = ativos().filter((p) => (p.onde || []).includes(key));
    if (sp.length) {
      const html = '<section class="section" data-monet="sponsor"><div class="section-head"><h2>' + icon('sparkle') + 'Parceiros</h2><a class="link-more" href="#/anuncie">Anuncie aqui</a></div><div class="cards">' + sp.map(sponsorCard).join('') + '</div></section>';
      const anchor = key === 'home' ? $('.widgets', view) : $('.page-head', view);
      if (anchor) anchor.insertAdjacentHTML('afterend', html);
      else view.insertAdjacentHTML('afterbegin', html);
    }

    if (key === 'home' || key === 'ferramentas') {
      const rec = recomendadosHtml();
      if (rec) {
        const tip = $('#tip-of-day', view);
        if (tip) tip.insertAdjacentHTML('beforebegin', rec); else view.insertAdjacentHTML('beforeend', rec);
      }
    }

    if (key === 'home') {
      const dica = (CFG.dicasPatrocinadas || []).find((d) => d && d.data === dateKey() && d.texto);
      const tip = $('#tip-of-day', view);
      if (dica && tip) {
        tip.innerHTML = '<span class="eyebrow">' + icon('info') + 'Dica do dia · <span class="tag">Patrocinado</span></span>' +
          '<p style="font-size:16px">' + esc(dica.texto) + '</p>' +
          (dica.url ? '<a class="btn btn-sm" style="margin-top:12px" href="' + esc(dica.url) + '" target="_blank" rel="sponsored noopener">Saiba mais ' + icon('external') + '</a>' : '');
      }
      if (CFG.listaEsperaPro) {
        const anchor = $('#tip-of-day', view);
        const pro = '<section class="section panel panel-pad pro-box"><span class="eyebrow">' + icon('sparkle') + 'Em breve · Atlas Pro</span>' +
          '<h2 style="font-size:20px">Receba um aviso quando sair edital dos órgãos que você salvou</h2>' +
          '<p class="muted" style="margin:8px 0 14px">Alertas por e-mail e WhatsApp, sem anúncios e com sincronização na nuvem — por um preço de cafezinho.</p>' +
          '<a class="btn btn-primary" href="' + esc(CFG.listaEsperaPro) + '" target="_blank" rel="noopener">Entrar na lista de espera</a></section>';
        if (anchor) anchor.insertAdjacentHTML('afterend', pro);
      }
    }
  });

  /* =========================================================
     Página: Apoie o Atlas (Pix)
     ========================================================= */
  route(/^\/apoie$/, 'apoie', function () {
    const valores = (pix.valores && pix.valores.length ? pix.valores : [5, 10, 20, 50]);
    const labels = { 5: 'um cafezinho', 10: 'um lanche', 20: 'uma apostila', 50: 'um mês de servidor' };
    const share = '<button class="btn" id="share-btn">' + icon('link') + 'Compartilhar o Atlas</button>';
    return {
      title: 'Apoie o Atlas',
      crumbs: [['Início', '#/'], ['Apoie o Atlas', '#/apoie']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('sparkle') + 'Projeto independente</span><h1>Ajude a manter o Atlas gratuito</h1>' +
        '<p>O Atlas é gratuito para todo concurseiro. Seu apoio paga o domínio, a hospedagem e as horas de atualização semanal dos links. Qualquer valor ajuda — e quem não pode contribuir ajuda muito só compartilhando.</p></div></div>' +
        (hasPix()
          ? '<div class="tool-layout">' +
              '<div class="panel panel-pad" style="display:flex;flex-direction:column;gap:14px">' +
                '<h2 style="font-size:18px">Escolha um valor</h2>' +
                '<div class="subs" id="pix-values">' + valores.map((v, i) => '<button class="chip' + (i === 1 ? ' sel' : '') + '" data-v="' + v + '">R$ ' + v + (labels[v] ? ' · ' + labels[v] : '') + '</button>').join('') +
                  '<button class="chip" data-v="0">Valor livre</button></div>' +
                '<label class="field" id="pix-free" hidden>Outro valor (R$)<input class="input" type="number" min="1" step="1" id="pix-amount" placeholder="Ex.: 15"></label>' +
                '<p class="muted small">Abra o app do seu banco → <b>Pix</b> → <b>Ler QR Code</b> ou <b>Pix Copia e Cola</b>. O pagamento vai direto para o responsável pelo projeto: <b>' + esc(pix.nome) + '</b>.</p>' +
                '<label class="field">Pix copia e cola<textarea class="textarea" id="pix-code" rows="3" readonly style="min-height:84px;font-family:monospace;font-size:12px"></textarea></label>' +
                '<div class="btn-row"><button class="btn btn-primary" id="pix-copy">' + icon('copy') + 'Copiar código Pix</button>' + share + '</div>' +
              '</div>' +
              '<div class="panel panel-pad" style="display:flex;flex-direction:column;align-items:center;gap:12px">' +
                '<div id="pix-qr" class="pix-qr"></div><span class="badge accent" id="pix-label"></span>' +
              '</div>' +
            '</div>'
          : '<div class="panel panel-pad"><h2 style="font-size:18px;margin-bottom:8px">Doações em breve</h2><p class="muted">Enquanto isso, a melhor forma de ajudar é compartilhar o Atlas com quem estuda para concurso.</p><div class="btn-row" style="margin-top:14px">' + share + '</div></div>') +
        '<section class="section"><div class="section-head"><h2>' + icon('target') + 'Outras formas de ajudar</h2></div><div class="tiles">' +
          '<div class="tile"><span class="tile-icon">' + icon('link', 'i-lg') + '</span><h3>Compartilhe</h3><p>Mande o link nos grupos de estudo do WhatsApp e do Telegram.</p></div>' +
          '<div class="tile"><span class="tile-icon">' + icon('flag', 'i-lg') + '</span><h3>Reporte links</h3><p>Use o botão ⚑ quando um site mudar de endereço.</p></div>' +
          '<a class="tile" href="#/anuncie"><span class="tile-icon">' + icon('briefcase', 'i-lg') + '</span><h3>Indique um anunciante</h3><p>Conhece um cursinho? Ele pode patrocinar o Atlas a partir de R$ 29.</p></a>' +
        '</div></section>',
      after(view) {
        const sb = $('#share-btn', view);
        if (sb) sb.addEventListener('click', async () => {
          const url = CFG.siteUrl || location.origin + location.pathname;
          const data = { title: 'Atlas Concursos', text: 'Todos os sites de concursos públicos do Brasil em um só lugar, grátis:', url };
          if (navigator.share) { try { await navigator.share(data); } catch (e) {} }
          else A.copy(data.text + ' ' + url);
        });
        if (!hasPix()) return;
        let valor = valores[1] || valores[0];
        const draw = () => {
          const code = pixPayload(valor);
          $('#pix-code', view).value = code;
          $('#pix-qr', view).innerHTML = qrSvg(code);
          $('#pix-label', view).textContent = valor > 0 ? 'R$ ' + Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : 'Valor livre — digite no app do banco';
        };
        draw();
        $('#pix-values', view).addEventListener('click', (e) => {
          const b = e.target.closest('[data-v]'); if (!b) return;
          $$('[data-v]', view).forEach((x) => x.classList.toggle('sel', x === b));
          const free = b.dataset.v === '0';
          $('#pix-free', view).hidden = !free;
          valor = free ? (+$('#pix-amount', view).value || 0) : +b.dataset.v;
          draw();
        });
        $('#pix-amount', view).addEventListener('input', (e) => { valor = Math.max(0, +e.target.value || 0); draw(); });
        $('#pix-copy', view).addEventListener('click', () => { A.copy($('#pix-code', view).value); toast('Código Pix copiado! Cole no app do seu banco.'); });
      }
    };
  });

  /* =========================================================
     Página: Anuncie no Atlas
     ========================================================= */
  route(/^\/anuncie$/, 'anuncie', function () {
    const pacotes = CFG.pacotes || [];
    const msg = 'Olá! Tenho interesse em anunciar no Atlas Concursos.';
    const wa = contato.whatsapp ? 'https://wa.me/' + String(contato.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(msg) : '';
    const mail = contato.email ? 'mailto:' + contato.email + '?subject=' + encodeURIComponent('Anunciar no Atlas Concursos') : '';
    const cta = (wa ? '<a class="btn btn-primary" href="' + esc(wa) + '" target="_blank" rel="noopener">' + icon('external') + 'Falar no WhatsApp</a>' : '') +
      (mail ? '<a class="btn" href="' + esc(mail) + '">' + icon('note') + 'Enviar e-mail</a>' : '');
    return {
      title: 'Anuncie no Atlas',
      crumbs: [['Início', '#/'], ['Anuncie no Atlas', '#/anuncie']],
      html:
        '<div class="page-head"><div><span class="eyebrow">' + icon('target') + 'Para cursinhos, editoras e professores</span><h1>Anuncie para quem estuda para concurso</h1>' +
        '<p>Quem usa o Atlas está procurando edital, banca e material de estudo — exatamente o público do seu curso. Você escolhe a categoria ou o estado e paga um valor fixo e justo, sem leilão de cliques.</p></div>' +
        (cta ? '<div class="btn-row">' + cta + '</div>' : '') + '</div>' +
        '<div class="cards">' + pacotes.map((p) =>
          '<article class="card"><div class="card-top"><span class="tile-icon">' + icon('sparkle') + '</span><div class="card-title"><h3>' + esc(p.nome) + '</h3><span class="domain">' + esc(p.ideal || '') + '</span></div></div>' +
          '<div class="result-big grad-text" style="font-size:28px">' + esc(p.preco) + '</div>' +
          '<p class="desc">' + esc(p.desc) + '</p></article>').join('') + '</div>' +
        '<p class="muted small" style="margin-top:12px">Preços de lançamento. Pagamento por Pix, sem fidelidade. Os valores acompanham o crescimento da audiência e quem entra agora mantém o preço por 3 meses.</p>' +
        '<section class="section panel panel-pad"><span class="eyebrow">' + icon('shield') + 'Regras para manter a confiança</span><ul class="rules">' +
          '<li>Todo anúncio aparece com a etiqueta <b>Patrocinado</b>.</li>' +
          '<li>Não aceitamos promessa de aprovação garantida, venda de material pirata nem páginas que imitem sites do governo ou de bancas.</li>' +
          '<li>Os links oficiais continuam em primeiro lugar: patrocínio nunca substitui nem esconde um site oficial.</li>' +
          '<li>O Atlas pode recusar ou retirar anúncios que prejudiquem o concurseiro.</li></ul></section>' +
        (cta ? '' : '<div class="panel panel-pad section"><p class="muted">Contato comercial em breve.</p></div>')
    };
  });
})();
