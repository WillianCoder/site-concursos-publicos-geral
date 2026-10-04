#!/usr/bin/env node
/*
 * Verifica se todos os links do catálogo (assets/js/data.js) respondem.
 * Uso: node scripts/check-links.mjs [--list]
 *   --list  apenas lista os links, sem acessar a internet.
 * Gera um relatório em Markdown (e no resumo do GitHub Actions, se disponível).
 */
import { readFileSync, appendFileSync } from 'node:fs';
import vm from 'node:vm';

const src = readFileSync(new URL('../assets/js/data.js', import.meta.url), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const DATA = sandbox.window.ATLAS_DATA;

const links = new Map();
const add = (u, label) => { if (!links.has(u)) links.set(u, label); };
for (const c of DATA.categorias) {
  for (const it of c.itens) {
    add(it.u, `${c.nome} › ${it.n}`);
    for (const [n, u] of it.s) add(u, `${c.nome} › ${it.n} › ${n}`);
  }
}
for (const e of DATA.estados) {
  for (const [k, u] of Object.entries(e.links)) add(u, `${e.uf} › ${DATA.tipos[k]?.nome || k}`);
  for (const u of e.trts) add(u, `${e.uf} › TRT`);
}

// Validação estrutural (roda sempre, sem rede).
const problems = [];
for (const [u, label] of links) {
  try { const x = new URL(u); if (!/^https?:$/.test(x.protocol)) throw 0; }
  catch { problems.push(`URL inválida: ${u} (${label})`); }
}
console.log(`${links.size} links únicos no catálogo.`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
if (process.argv.includes('--list')) { for (const [u, l] of links) console.log(`${u}\t${l}`); process.exit(0); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 AtlasConcursosLinkCheck';
async function check(u) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(u, { method, redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
      if (res.ok) return { ok: true, status: res.status, final: res.url };
      if (method === 'GET') return { ok: false, status: res.status, final: res.url };
    } catch (err) {
      if (method === 'GET') return { ok: false, status: err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code || err.message) };
    }
  }
}

const entries = [...links];
const results = [];
let i = 0;
await Promise.all(Array.from({ length: 10 }, async () => {
  while (i < entries.length) {
    const [u, label] = entries[i++];
    const r = await check(u);
    results.push({ u, label, ...r });
    process.stdout.write(r.ok ? '.' : 'x');
  }
}));
console.log('\n');

// Erros que indicam link realmente errado (domínio inexistente, página removida,
// certificado que não cobre o endereço). O resto costuma ser bloqueio de robôs,
// acesso de fora do Brasil ou certificado ICP-Brasil — funciona no navegador.
const BROKEN = new Set(['ENOTFOUND', 'ERR_TLS_CERT_ALTNAME_INVALID', 404, 410]);
const failed = results.filter((r) => !r.ok).sort((a, b) => a.label.localeCompare(b.label));
const broken = failed.filter((r) => BROKEN.has(r.status));
const bad = failed.filter((r) => !BROKEN.has(r.status));
const moved = results.filter((r) => r.ok && r.final && new URL(r.final).hostname !== new URL(r.u).hostname);
let md = `## Verificação de links — Atlas Concursos\n\n`;
md += `**${results.length - failed.length}/${results.length}** links responderam com sucesso.\n\n`;
if (broken.length) {
  md += `### ❌ Quebrados — corrigir (${broken.length})\n\n| Órgão | Link | Status |\n|---|---|---|\n`;
  md += broken.map((r) => `| ${r.label} | ${r.u} | ${r.status} |`).join('\n') + '\n\n';
} else {
  md += `### ✅ Nenhum link quebrado de verdade\n\n`;
}
if (bad.length) {
  md += `### ⚠️ Inconclusivos (${bad.length})\n\nBloqueio de robôs (403/429), sites que não respondem a servidores fora do Brasil (timeout) ou certificados ICP-Brasil. Normalmente funcionam no navegador; confira manualmente antes de mexer.\n\n| Órgão | Link | Status |\n|---|---|---|\n`;
  md += bad.map((r) => `| ${r.label} | ${r.u} | ${r.status} |`).join('\n') + '\n\n';
}
if (moved.length) {
  md += `### ↪️ Redirecionados para outro domínio (${moved.length})\n\n| Órgão | Link | Destino |\n|---|---|---|\n`;
  md += moved.map((r) => `| ${r.label} | ${r.u} | ${r.final} |`).join('\n') + '\n';
}
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
