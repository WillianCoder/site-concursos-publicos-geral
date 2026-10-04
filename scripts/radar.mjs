#!/usr/bin/env node
/*
 * Radar de Editais — Atlas Concursos.
 * Visita os sites oficiais do catálogo, encontra links sobre concursos/editais
 * e registra os que apareceram pela primeira vez. Roda todo dia no GitHub Actions.
 *
 * Saídas:
 *   data/radar.js          feed público lido pelo site (window.ATLAS_RADAR)
 *   data/radar-state.json  memória do que já foi visto em cada site
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const ROOT = new URL('../', import.meta.url);
const STATE_FILE = new URL('data/radar-state.json', ROOT);
const FEED_FILE = new URL('data/radar.js', ROOT);
const KEEP_DAYS = 30;
const MAX_ITEMS = 400;
const MAX_SEEN_PER_SITE = 300;
const KEY = /(concurso|edital|editais|processo seletivo|sele[cç][aã]o p[uú]blica|inscri[cç][oõ]es abertas|convoca[cç][aã]o|nomea[cç][aã]o|homologa[cç][aã]o|gabarito)/i;
const SKIP = /\.(jpg|jpeg|png|gif|svg|webp|zip|mp4|mp3)(\?|$)/i;

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('assets/js/data.js', ROOT), 'utf8'), sandbox);
const DATA = sandbox.window.ATLAS_DATA;

const targets = [];
for (const c of DATA.categorias) {
  if (['legislacao', 'estudo', 'noticias', 'servicos'].includes(c.id)) continue;
  for (const it of c.itens) targets.push({ u: it.u, n: it.n, uf: '' });
}
for (const e of DATA.estados) {
  for (const [k, u] of Object.entries(e.links)) targets.push({ u, n: `${DATA.tipos[k]?.nome || k} — ${e.uf}`, uf: e.uf });
  e.trts.forEach((u) => targets.push({ u, n: `TRT — ${e.uf}`, uf: e.uf }));
}

const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { sites: {} };
let feed = { items: [] };
if (existsSync(FEED_FILE)) {
  try { const s = { window: {} }; vm.runInNewContext(readFileSync(FEED_FILE, 'utf8'), s); feed = s.window.ATLAS_RADAR || feed; } catch {}
}

const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/&([a-z]+);/gi, (m, n) => ({ aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç', ecirc: 'ê', ocirc: 'ô', acirc: 'â', agrave: 'à', ordm: 'º', ordf: 'ª', ndash: '–', mdash: '—' }[n.toLowerCase()] || m));
const hash = (s) => createHash('sha1').update(s).digest('base64url').slice(0, 12);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 AtlasConcursosRadar';

async function scan(t) {
  const res = await fetch(t.u, { redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'user-agent': UA, accept: 'text/html' } });
  if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null;
  const html = (await res.text()).slice(0, 3_000_000);
  const base = res.url;
  const found = new Map();
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const text = decode(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    let href;
    try { href = new URL(decode(m[1]), base).href; } catch { continue; }
    if (!/^https?:/.test(href) || SKIP.test(href)) continue;
    if (!KEY.test(text) && !KEY.test(href)) continue;
    if (text.length < 8 || text.length > 300) continue;   // ignora menus de uma palavra ("Concursos")
    if (!found.has(href)) found.set(href, text);
  }
  return found;
}

const results = { ok: 0, fail: 0, fresh: 0 };
const newItems = [];
let i = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (i < targets.length) {
    const t = targets[i++];
    let found = null;
    try { found = await scan(t); } catch { /* site bloqueou ou caiu */ }
    if (!found) { results.fail++; continue; }
    results.ok++;
    const prev = state.sites[t.u];
    const seen = new Set(prev ? prev.seen : []);
    for (const [href, text] of found) {
      const h = hash(href);
      if (seen.has(h)) continue;
      seen.add(h);
      if (prev) newItems.push({ site: t.u, n: t.n, uf: t.uf, t: text.slice(0, 180), u: href, d: today });
    }
    if (!prev) results.fresh++;
    state.sites[t.u] = { seen: [...seen].slice(-MAX_SEEN_PER_SITE), last: today };
  }
}));

const cutoff = new Date(Date.now() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
const items = newItems.concat(feed.items || []).filter((x) => x.d >= cutoff).slice(0, MAX_ITEMS);
const out = {
  updatedAt: new Date().toISOString(),
  since: feed.since || today,
  checked: targets.length,
  reachable: results.ok,
  items
};

mkdirSync(new URL('data/', ROOT), { recursive: true });
writeFileSync(STATE_FILE, JSON.stringify(state));
writeFileSync(FEED_FILE, '/* Gerado automaticamente pelo Radar de Editais (scripts/radar.mjs). Não edite à mão. */\nwindow.ATLAS_RADAR = ' + JSON.stringify(out, null, 0) + ';\n');
console.log(`Radar: ${results.ok} sites lidos, ${results.fail} sem acesso, ${results.fresh} novos na memória, ${newItems.length} novidades hoje.`);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `## Radar de Editais\n\n- Sites lidos: **${results.ok}** de ${targets.length}\n- Novidades hoje: **${newItems.length}**\n\n` +
    newItems.slice(0, 50).map((x) => `- **${x.n}**: [${x.t}](${x.u})`).join('\n') + '\n', { flag: 'a' });
}
