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
cp -R assets .well-known _site/
cp data/radar.js data/agenda.js _site/data/
# Páginas por estado para o Google, sitemap.xml e endereços absolutos da prévia.
# O endereço vem de SITE_URL (variável do Cloudflare), do siteUrl do config.js
# ou, por padrão, https://atlas-concursos.pages.dev/.
node scripts/seo-pages.mjs _site
echo "Site montado em _site/ ($(find _site -type f | wc -l) arquivos)"
