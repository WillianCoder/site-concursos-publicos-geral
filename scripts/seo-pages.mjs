// Gera páginas estáticas que o Google consegue ler (o app usa rotas com "#",
// que os buscadores não indexam): uma página por estado com os sites oficiais
// e as inscrições abertas do dia, o índice dos estados, o sitemap.xml e os
// endereços absolutos da imagem de prévia (WhatsApp, Facebook).
// Uso: node scripts/seo-pages.mjs _site https://endereco-do-site/
// Roda no build (scripts/build-site.sh); o robô do Radar republica todo dia.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const OUT = process.argv[2] || '_site';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const load = (file) => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
  return ctx.window;
};
const CFG = load('assets/js/config.js').ATLAS_CONFIG || {};
const DATA = load('assets/js/data.js').ATLAS_DATA;
const RADAR = fs.existsSync(path.join(ROOT, 'data/radar.js')) ? load('data/radar.js').ATLAS_RADAR || {} : {};
const AGENDA = fs.existsSync(path.join(ROOT, 'data/agenda.js')) ? load('data/agenda.js').ATLAS_AGENDA || {} : {};
const RULES = load('assets/js/radar-rules.js').ATLAS_RADAR_RULES;   // mesmas regras do Radar: nada vencido, só concurso
let BASE = String(process.argv[3] || process.env.SITE_URL || CFG.siteUrl || 'https://atlas-concursos.pages.dev/').trim();
if (!BASE.endsWith('/')) BASE += '/';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // horário de Brasília
const fmt = (k) => (k ? k.split('-').reverse().join('/') : '');
const slug = (uf) => uf.toLowerCase();
const preco = Number(((CFG.servicos || {}).diario || {}).preco) || 15;
const ufRank = { SP: 0, RJ: 1, MG: 2, BA: 3, PR: 4, RS: 5 };

const GROUPS = [
  ['Segurança Pública', ['pm', 'pc', 'cbm']],
  ['Justiça', ['tj', 'mp', 'dpe', 'tre']],
  ['Fiscal e controle', ['sefaz', 'tce']],
  ['Governo e Legislativo', ['doe', 'gov', 'al']]
];

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests";

function page({ title, desc, canonical, body, depth }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="pt-BR" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Atlas Concursos">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${BASE}assets/img/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#070a12">
  <link rel="icon" href="${up}assets/img/logo.svg" type="image/svg+xml">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${up}assets/css/styles.css">
  <script src="${up}assets/js/theme.js"></script>
  <style>
    .doc { max-width: 900px; margin: 0 auto; padding: 28px 16px 70px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 18px; }
    .doc h1 { font-size: clamp(26px, 4.4vw, 40px); letter-spacing: -.02em; }
    .doc h2 { font-size: 19px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .doc .lead { color: var(--muted); font-size: 16px; max-width: 720px; }
    .doc .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
    .doc .org { display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
    .doc .org b { font-size: 15px; }
    .doc .org span { font-size: 13px; color: var(--muted); word-break: break-all; }
    .doc .open { display: flex; flex-direction: column; gap: 8px; }
    .doc .open a { display: block; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); }
    .doc .open small { display: block; color: var(--muted); margin-top: 2px; }
    .doc .ctas { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .doc .cta { display: flex; flex-direction: column; gap: 6px; padding: 16px; border-radius: 16px; border: 1.5px solid transparent; background: linear-gradient(var(--panel-solid), var(--panel-solid)) padding-box, var(--grad) border-box; }
    .doc .cta span { color: var(--muted); font-size: 14px; }
    .doc .ufs { display: flex; flex-wrap: wrap; gap: 8px; }
    .doc nav.crumbs { font-size: 13px; color: var(--muted); display: flex; gap: 6px; flex-wrap: wrap; }
    .doc footer { color: var(--muted); font-size: 13px; border-top: 1px solid var(--border); padding-top: 16px; display: flex; gap: 14px; flex-wrap: wrap; }
  </style>
</head>
<body>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-glow" aria-hidden="true"></div>
  <main class="doc">
    <a class="brand" href="${up}"><img src="${up}assets/img/logo.svg" alt="" width="34" height="34"><span class="brand-text">Atlas<b>Concursos</b></span></a>
${body}
    <footer><span><b>Atlas Concursos</b> — projeto independente, não é site do governo. Confirme sempre no edital oficial.</span>
      <a href="${up}">Início</a><a href="${up}estados/">Estados</a><a href="${up}privacidade.html">Privacidade</a><a href="${up}termos.html">Termos</a></footer>
  </main>
</body>
</html>
`;
}

// Inscrições abertas hoje por estado: conferidas no Painel + encontradas pelo robô.
function openFor(uf) {
  const conf = (AGENDA.itens || []).filter((x) => x && x.uf === uf && x.inscFim && x.inscFim >= today && (!x.inscInicio || x.inscInicio <= today))
    .map((x) => ({ t: x.orgao + (x.cargo ? ' — ' + x.cargo : ''), sub: 'Inscrições até ' + fmt(x.inscFim) + (x.banca ? ' · ' + x.banca : ''), u: x.edital || x.site }));
  const rob = (RADAR.abertas || []).filter((x) => x && /^https?:\/\//.test(x.u) && (x.uf || RULES.ufFromText(x.t)) === uf && !RULES.expired(x.t) && RULES.isConcurso(x.t, !!x.banca))
    .map((x) => ({ t: RULES.clean(x.t).slice(0, 160), sub: x.n, u: x.u }));
  return conf.concat(rob).slice(0, 25);
}

function statePage(e) {
  const name = e.nome;
  const title = `Concursos públicos em ${name} (${e.uf}): PM, Polícia Civil, TJ e Diário Oficial | Atlas Concursos`;
  const desc = `Sites oficiais dos órgãos que fazem concurso em ${name}: Polícia Militar, Polícia Civil, Bombeiros, Tribunal de Justiça, MP, Defensoria, Sefaz e Diário Oficial do Estado. Veja as inscrições abertas hoje.`;
  const canonical = `${BASE}estados/${slug(e.uf)}.html`;
  const open = openFor(e.uf);
  const groups = GROUPS.map(([g, tipos]) => {
    const orgs = tipos.filter((k) => e.links[k]).map((k) => `<a class="org" href="${esc(e.links[k])}" rel="noopener" target="_blank"><b>${esc(DATA.tipos[k].nome)} — ${e.uf}</b><span>${esc(e.links[k].replace(/^https?:\/\//, ''))}</span></a>`);
    if (g === 'Justiça') (e.trts || []).forEach((u) => orgs.push(`<a class="org" href="${esc(u)}" rel="noopener" target="_blank"><b>Tribunal Regional do Trabalho</b><span>${esc(u.replace(/^https?:\/\//, ''))}</span></a>`));
    return orgs.length ? `    <section><h2>${esc(g)}</h2><div class="grid">${orgs.join('')}</div></section>` : '';
  }).join('\n');
  const body = `    <nav class="crumbs"><a href="../">Início</a><span>/</span><a href="./">Estados</a><span>/</span><b>${esc(name)}</b></nav>
    <div><span class="eyebrow">${esc(e.regiao)} · capital ${esc(e.capital)}</span><h1>Concursos públicos em ${esc(name)}</h1>
    <p class="lead">Todos os sites oficiais dos órgãos que fazem concurso em ${esc(name)}, num só lugar. Os editais estaduais saem no <b>Diário Oficial do Estado</b>${e.links.doe ? ` (<a class="grad-text" href="${esc(e.links.doe)}" rel="noopener" target="_blank">abrir</a>)` : ''}.</p></div>
    <div class="ctas">
      <a class="cta" href="../#/uf/${e.uf}"><b>Abrir ${esc(name)} no Atlas</b><span>Busca, links salvos e atalhos para o Diário Oficial.</span></a>
      <a class="cta" href="../#/meu-nome/${e.uf}"><b>Procurar meu nome no Diário Oficial</b><span>Convocação, resultado e nomeação: buscas prontas grátis.</span></a>
      <a class="cta" href="../#/pesquisa-diario"><b>Nós procuramos para você · R$ ${preco}</b><span>Resultado explicado no WhatsApp.</span></a>
    </div>
    <section><h2>Inscrições abertas hoje em ${esc(name)}</h2>${open.length
      ? `<div class="open">${open.map((x) => `<a href="${esc(x.u)}" rel="noopener" target="_blank">${esc(x.t)}<small>${esc(x.sub)}</small></a>`).join('')}</div><p class="lead" style="font-size:14px;margin-top:8px">Atualizado em ${fmt(today)}. Confirme datas e requisitos no edital oficial.</p>`
      : `<p class="lead">Nenhuma inscrição aberta encontrada hoje nos sites oficiais de ${esc(name)}. Veja o <a class="grad-text" href="../#/radar">Radar de Editais</a> do Brasil todo.</p>`}</section>
${groups}`;
  return page({ title, desc, canonical, body, depth: 1 });
}

function indexPage(list) {
  const sorted = list.slice().sort((a, b) => (ufRank[a.uf] ?? 9) - (ufRank[b.uf] ?? 9) || a.nome.localeCompare(b.nome));
  const body = `    <nav class="crumbs"><a href="../">Início</a><span>/</span><b>Estados</b></nav>
    <div><span class="eyebrow">27 unidades da federação</span><h1>Concursos públicos por estado</h1>
    <p class="lead">Escolha o estado para ver os sites oficiais da Polícia Militar, Polícia Civil, Bombeiros, Tribunal de Justiça, MP, Sefaz e Diário Oficial, e as inscrições abertas hoje.</p></div>
    <div class="grid">${sorted.map((e) => `<a class="org" href="${slug(e.uf)}.html"><b>${esc(e.nome)} (${e.uf})</b><span>${openFor(e.uf).length ? openFor(e.uf).length + ' inscrições abertas hoje' : 'Sites oficiais e Diário Oficial'}</span></a>`).join('')}</div>`;
  return page({ title: 'Concursos públicos por estado: PM, Polícia Civil, TJ e Diário Oficial | Atlas Concursos', desc: 'Sites oficiais de concursos públicos dos 27 estados do Brasil, com as inscrições abertas hoje.', canonical: BASE + 'estados/', body, depth: 1 });
}

fs.mkdirSync(path.join(OUT, 'estados'), { recursive: true });
DATA.estados.forEach((e) => fs.writeFileSync(path.join(OUT, 'estados', slug(e.uf) + '.html'), statePage(e)));
fs.writeFileSync(path.join(OUT, 'estados', 'index.html'), indexPage(DATA.estados));

const urls = ['', 'estados/'].concat(DATA.estados.map((e) => 'estados/' + slug(e.uf) + '.html'), ['privacidade.html', 'termos.html']);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${BASE}${u}</loc><lastmod>${today}</lastmod><changefreq>${u.startsWith('estados/') && u !== 'estados/' ? 'daily' : 'weekly'}</changefreq></url>`).join('\n') + '\n</urlset>\n');

const robots = path.join(OUT, 'robots.txt');
fs.writeFileSync(robots, fs.readFileSync(robots, 'utf8').trimEnd() + `\n\nSitemap: ${BASE}sitemap.xml\n`);

// Endereços absolutos para a prévia do link (WhatsApp e redes sociais exigem).
const idx = path.join(OUT, 'index.html');
fs.writeFileSync(idx, fs.readFileSync(idx, 'utf8')
  .replace('content="assets/img/og.png"', `content="${BASE}assets/img/og.png"`)
  .replace('<meta property="og:url" content="./">', `<meta property="og:url" content="${BASE}">`)
  .replace('<link rel="canonical" href="./">', `<link rel="canonical" href="${BASE}">`));

console.log(`SEO: ${DATA.estados.length} páginas de estado, sitemap com ${urls.length} endereços, base ${BASE}`);
