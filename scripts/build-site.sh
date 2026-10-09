#!/usr/bin/env bash
# Monta em _site/ só os arquivos públicos do site.
# Código do robô, README, histórico e estado interno do Radar não são publicados.
# Usado pelo GitHub Pages (.github/workflows/pages.yml) e pelo Cloudflare Pages
# (comando de build: bash scripts/build-site.sh · pasta de saída: _site).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site/data
cp index.html admin.html privacidade.html termos.html sw.js manifest.webmanifest \
   robots.txt ads.txt _headers .nojekyll _site/
cp -R assets _site/
cp data/radar.js data/agenda.js _site/data/
# Páginas por estado para o Google, sitemap.xml e endereços absolutos da prévia.
# O endereço vem de SITE_URL (variável do Cloudflare), do siteUrl do config.js
# ou, por padrão, https://atlas-concursos.pages.dev/.
node scripts/seo-pages.mjs _site
# Marca escolhida no Painel (nome, logo, imagem de prévia, ícones e PDF).
node scripts/brand.mjs _site
# Código publicado "embaralhado" (minificado, sem comentários): mais leve e bem mais
# difícil de ler e copiar. O código-fonte do repositório continua legível.
# Se o minificador não puder ser baixado, o site sai com os arquivos originais.
ESBUILD="npx --yes esbuild@0.24.0"
if $ESBUILD --version >/dev/null 2>&1; then
  $ESBUILD _site/assets/js/*.js _site/sw.js --minify --legal-comments=none --charset=utf8 \
    --outdir=_site --outbase=_site --allow-overwrite --log-level=warning
  $ESBUILD _site/assets/css/*.css --minify --legal-comments=none --charset=utf8 \
    --outdir=_site/assets/css --allow-overwrite --log-level=warning
  echo "Código minificado (esbuild)"
else
  echo "Aviso: minificador indisponível, publicando o código sem minificar"
fi
echo "Site montado em _site/ ($(find _site -type f | wc -l) arquivos)"
