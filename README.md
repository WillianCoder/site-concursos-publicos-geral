# Atlas Concursos

**Todos os sites de concursos públicos do Brasil em um só lugar — grátis.**

O Atlas Concursos reúne os endereços oficiais que todo concurseiro precisa: bancas organizadoras, Diário Oficial da União e dos estados, polícias, tribunais, Ministério Público, Defensorias, Secretarias da Fazenda, Tribunais de Contas, Assembleias, bancos e estatais, além da legislação seca no site do Planalto. Também traz ferramentas de estudo gratuitas.

## O que tem no site

| Área | O que faz |
|---|---|
| **Busca global** (`Ctrl K` ou `/`) | Busca instantânea em mais de 430 sites oficiais e nas páginas do próprio Atlas. Entende siglas: "pm mg", "tj rj", "prf", "cnu", "lei 8112". |
| **Categorias** | Órgãos federais, bancas, diários oficiais, segurança e Forças Armadas, tribunais/MP/Defensoria, fiscal e controle, legislativo, bancos e estatais, lei seca, estudo gratuito, notícias e documentos do candidato. |
| **Hubs dos 27 estados** | Cada estado reúne seus "subsites": PM, Polícia Civil, Bombeiros, TJ, MP, Defensoria, TRE, TRT, TRF, Sefaz, TCE, Assembleia, Governo e Diário Oficial. Cada órgão tem atalho para "Editais no Diário Oficial" e para buscar "concurso/edital" dentro do próprio site. |
| **Radar de Editais** ⭐ | Exclusivo: todo dia um robô gratuito (GitHub Actions) visita os sites oficiais e mostra os **links novos** de edital, concurso, convocação e gabarito. Os cards dos órgãos com novidade ganham um selo. |
| **Descubra seu concurso** ⭐ | Teste de 4 perguntas que indica as carreiras ideais e os sites oficiais certos (inclusive do estado escolhido), com botão para salvar tudo e compartilhar. |
| **Meus links** | Salve qualquer site com a ★, crie links próprios (ex.: a prefeitura da sua cidade), organize em pastas e escreva anotações. |
| **Meus concursos** | Agenda de inscrições e provas com contagem regressiva e arquivo `.ics` para colocar no calendário do celular. |
| **Pomodoro** | Ciclos de foco e pausa, notificação, horas estudadas por dia e gráfico da semana. |
| **Edital verticalizado** | Matérias e tópicos com progresso. Ao concluir um tópico, agenda revisões para 1, 7 e 30 dias. |
| **Revisões espaçadas** | Lista do que revisar hoje, atrasado e nos próximos dias. |
| **Calculadora de nota** | Modelo Cebraspe (certo/errado, um erro anula um acerto) e múltipla escolha, com nota de corte. |
| **Planejador de estudos** | Divide suas horas semanais entre as matérias conforme peso e dificuldade. |
| **Bloco de notas** | Salvo automaticamente, exporta `.txt`. |
| **Minha conta** | Perfil, meu estado, meta diária, backup/restauração e login na nuvem (opcional). |

Mais: tema escuro e claro, layout para celular com barra inferior, funciona offline (PWA, pode ser instalado como aplicativo), sem rastreadores por padrão, termos de uso e política de privacidade.

## Como funciona a "conta" do usuário

- **Sem configurar nada:** tudo é salvo no navegador do usuário (`localStorage`). Não precisa de cadastro nem de servidor. Para usar em outro aparelho, o usuário baixa o backup e restaura no outro dispositivo.
- **Com o login Google (opcional e gratuito):** quando você preenche o Firebase no `config.js`, aparece o botão **Entrar com Google** em *Minha conta* e os dados sincronizam entre celular e computador.

### Ativar o login na nuvem (Firebase, plano gratuito)

1. Acesse <https://console.firebase.google.com>, crie um projeto e adicione um **App da Web**.
2. Em **Authentication → Sign-in method**, ative o provedor **Google**.
3. Em **Authentication → Settings → Authorized domains**, adicione o domínio do site (ex.: `williancoder.github.io`).
4. Em **Firestore Database**, crie o banco (modo produção) e cole estas regras:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

5. Copie a configuração do app (apiKey, authDomain, projectId, appId) para `firebase` em `assets/js/config.js`.

> A `apiKey` do Firebase para web é pública por design; a segurança vem das regras acima.

## Painel do Administrador (`/admin.html`)

Edite **Pix, contato, patrocínios, links de afiliado, dicas patrocinadas, preços, AdSense e Firebase** pelo navegador — no computador ou no celular — sem mexer em código.

1. Crie um token em <https://github.com/settings/personal-access-tokens/new>: *Only select repositories* → este repositório; *Permissions → Contents: Read and write*; validade de 90 dias.
2. Abra `https://SEU-SITE/admin.html`, cole o token e entre.
3. Edite e clique em **Salvar e publicar**: o painel grava `assets/js/config.js` no GitHub e o site atualiza em ~1 minuto.

O token fica só na aba do navegador (some ao fechar), a página não é indexada pelo Google e nunca entra no cache offline. A aba *Visão geral* mostra a receita mensal dos patrocínios ativos, quem vence em 7 dias e um checklist para começar a faturar.

## Radar de Editais

- `scripts/radar.mjs` + `.github/workflows/radar.yml` rodam todo dia às 07:23 (Brasília).
- A primeira execução só memoriza o que já existe; a partir da segunda, cada link novo vira um item em `data/radar.js` (mantém 30 dias).
- Quando o Radar encontra novidades, o site é republicado automaticamente.
- Para rodar na hora: *Actions → Radar de Editais → Run workflow*.

## Monetização com preço justo

Tudo é configurado pelo **Painel do Administrador** (ou em `assets/js/config.js`) e só aparece no site depois de preenchido:

| Bloco | O que faz | O que preencher |
|---|---|---|
| **Apoie o Atlas** (`#/apoie`) | Doação por Pix com QR Code e "copia e cola" gerados no navegador (padrão BR Code do Banco Central), com valores sugeridos de R$ 5 a R$ 50 ou valor livre. | `pix.chave`, `pix.nome`, `pix.cidade` |
| **Anuncie no Atlas** (`#/anuncie`) | Página comercial com pacotes de patrocínio a preço fixo (a partir de R$ 29), regras de transparência e botão de WhatsApp/e-mail. | `contato.whatsapp` e/ou `contato.email`; preços em `pacotes` |
| **Cards "Patrocinado"** | Aparecem na página inicial, Radar, Descubra, categorias, hubs dos estados ou Ferramentas e somem sozinhos na data final. | `patrocinios` |
| **Dica patrocinada** | Substitui a "Dica do dia" num dia específico. | `dicasPatrocinadas` |
| **Recomendados (afiliados)** | Livros, cursos e materiais com link de afiliado, sempre com aviso de transparência. | `recomendados` |
| **Lista de espera do Atlas Pro** | Chamada para um futuro plano pago (alertas de edital). | `listaEsperaPro` (link de um Google Forms) |

## Propagandas (Google AdSense)

O site já tem espaços de anúncio prontos (barra lateral, entre seções e rodapé) e um aviso de cookies (LGPD). Eles ficam **desligados** até você configurar:

1. Publique o site em um **domínio próprio** (ex.: `atlasconcursos.com.br`, registrado no Registro.br) e aponte para o GitHub Pages.
2. Peça a aprovação em <https://adsense.google.com>.
3. Depois de aprovado, preencha `ads.client` e os `ads.slots` em `assets/js/config.js`.
4. Edite o `ads.txt` na raiz com o seu ID de editor.

O guia completo de monetização está na página do Notion criada junto com o projeto.

## Publicar no ar (GitHub Pages, grátis)

1. No GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Cada push na branch `main` publica o site automaticamente (workflow `.github/workflows/pages.yml`).
3. O endereço fica parecido com `https://williancoder.github.io/site-concursos-publicos-geral/`. Para usar domínio próprio, configure em **Settings → Pages → Custom domain**.

## Segurança

Resumo em [SECURITY.md](SECURITY.md). Principais camadas: site estático (sem servidor nem banco para invadir), política de conteúdo (CSP) em todas as páginas, cabeçalhos HTTP de segurança em `_headers` (Cloudflare Pages/Netlify), proteção contra clickjacking, links aceitos apenas em `http(s)`, backups higienizados, painel autenticado pelo GitHub, `security.txt`, `robots.txt` e Dependabot.

> Para ter **todos** os cabeçalhos de segurança e ainda manter o repositório privado de graça, publique pelo **Cloudflare Pages** (conecte o repositório, sem comando de build, pasta `/`).

## Rodar no computador

Não há build nem dependências. Basta servir a pasta:

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Manter o catálogo atualizado

- Todos os sites ficam em [`assets/js/data.js`](assets/js/data.js), em um formato simples de editar.
- O workflow **Verificar links do catálogo** roda toda segunda-feira (e em PRs que mudam o catálogo) e publica um relatório com os links que não responderam. Alguns sites do governo bloqueiam robôs — confira manualmente antes de remover.
- Rodar localmente: `node scripts/check-links.mjs` (ou `--list` para só listar).
- Os visitantes podem reportar links quebrados pelo botão ⚑ de cada card, que abre uma issue já preenchida (ou um e-mail, se `repoUrl` estiver vazio).

## Estrutura

```
index.html              página única (SPA com rotas #/...)
privacidade.html        política de privacidade (exigida pelo AdSense)
assets/css/styles.css   visual (tema escuro/claro, responsivo)
assets/js/config.js     configurações: anúncios, Firebase, repositório
assets/js/data.js       catálogo de sites oficiais
assets/js/app.js        núcleo: conta, rotas, busca, catálogo, estados, links, anúncios
assets/js/tools.js      ferramentas de estudo
assets/js/monetize.js   Pix, página de anúncios, patrocínios e afiliados
assets/js/features.js   Radar de Editais e Descubra seu concurso
assets/js/admin.js      Painel do Administrador (admin.html)
data/radar.js           novidades do Radar (gerado automaticamente)
scripts/radar.mjs       robô do Radar de Editais
assets/js/cloud.js      sincronização opcional com Firebase
assets/js/vendor/       QR Code Generator (MIT, Kazuhiko Arase)
termos.html             termos de uso
sw.js                   funcionamento offline
scripts/check-links.mjs verificador de links
```

## Aviso

Projeto independente, sem vínculo com órgãos públicos ou bancas. Sempre confirme datas, valores e regras no edital oficial.

## Direitos

© 2026 Willian Salles. **Todos os direitos reservados** — veja [LICENSE](LICENSE) e os [Termos de Uso](termos.html). Não é permitido copiar, republicar ou explorar comercialmente o código, o design ou o catálogo sem autorização por escrito. Para licenças e versões personalizadas, entre em contato.
