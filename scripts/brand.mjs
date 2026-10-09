// Aplica a marca escolhida no Painel (config.js → "marca") ao site montado em _site/.
// O código-fonte continua com "Atlas Concursos"; aqui trocamos o nome nos textos
// e copiamos de assets/marcas/<id>/ o logo, a imagem de prévia, os ícones e o PDF.
// Para voltar ao nome original: Painel → Marca → "Atlas Concursos" → publicar.
// Uso: node scripts/brand.mjs _site
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const OUT = process.argv[2] || '_site';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const load = (file) => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx); return ctx.window; };
const CFG = load('assets/js/config.js').ATLAS_CONFIG || {};
const MARCAS = load('assets/js/marcas.js').ATLAS_MARCAS || [];
const M = MARCAS.find((m) => m.id === (process.env.MARCA || CFG.marca)) || MARCAS.find((m) => m.id === 'atlas');
const dir = (id) => path.join(ROOT, 'assets/marcas', id);

// 1. Arquivos da marca (cai no Atlas quando a marca não tem algum deles).
fs.mkdirSync(path.join(OUT, 'assets/docs'), { recursive: true });
for (const f of ['logo.svg', 'og.png', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'apresentacao.pdf']) {
  const src = fs.existsSync(path.join(dir(M.id), f)) ? path.join(dir(M.id), f) : path.join(dir('atlas'), f);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(OUT, f === 'apresentacao.pdf' ? 'assets/docs' : 'assets/img', f));
}

// 2. Nome nos textos (só frases para o visitante; o objeto window.Atlas do código não muda).
let changed = 0;
if (M.id !== 'atlas') {
  const swap = (s) => s
    .split('Atlas<b>Concursos</b>').join(M.p1 + '<b>' + M.p2 + '</b>')
    .split('Atlas Concursos').join(M.nome)
    .split('Atlas Pro').join(M.curto + ' Pro')
    .split("· Atlas'").join("· " + M.curto + "'")
    .split('Painel Atlas').join('Painel ' + M.curto)
    .replace(/\b(o|O|do|no|ao|Serviço|conta|Conta)\s+Atlas\b(?!\.\w|[\w(])/g, (m, w) => w + ' ' + M.nome);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const file of walk(OUT)) {
    if (!/\.(html|js|webmanifest|txt|xml)$/.test(file) || file.includes(path.join('js', 'vendor')) || file.endsWith('marcas.js')) continue;   // a lista de marcas fica intacta
    const before = fs.readFileSync(file, 'utf8');
    let after = swap(before);
    if (file.endsWith('.webmanifest')) {
      const man = JSON.parse(after); man.name = M.nome; man.short_name = M.curto; after = JSON.stringify(man, null, 2) + '\n';
    }
    if (after !== before) { fs.writeFileSync(file, after); changed++; }
  }
}
console.log(`Marca: ${M.nome} (${M.id}) — ${changed} arquivos com o nome trocado`);
