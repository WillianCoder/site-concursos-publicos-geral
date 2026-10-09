# Busquei Concursos

**Todos os sites de concursos públicos do Brasil em um só lugar — grátis.**

> No ar com a marca **Busquei Concursos**. O código usa o nome interno "Atlas Concursos"; a marca publicada é escolhida no Painel (aba "Marca e logo") e aplicada no build — veja a seção "Marca (nome e logo)".

O Atlas Concursos reúne os endereços oficiais que todo concurseiro precisa: bancas organizadoras, Diário Oficial da União e dos estados, polícias, tribunais, Ministério Público, Defensorias, Secretarias da Fazenda, Tribunais de Contas, Assembleias, bancos e estatais, além da legislação seca no site do Planalto. Também traz ferramentas de estudo gratuitas.

## O que tem no site

| Área | O que faz |
|---|---|
| **Busca global** (`Ctrl K` ou `/`) | Busca instantânea em mais de 430 sites oficiais e nas páginas do próprio Atlas. Entende siglas: "pm mg", "tj rj", "prf", "cnu", "lei 8112". |
| **Categorias** | Órgãos federais, bancas, diários oficiais, segurança e Forças Armadas, tribunais/MP/Defensoria, fiscal e controle, legislativo, bancos e estatais, lei seca, estudo gratuito, notícias e documentos do candidato. |
| **Hubs dos 27 estados** | Cada estado reúne seus "subsites": PM, Polícia Civil, Bombeiros, TJ, MP, Defensoria, TRE, TRT, TRF, Sefaz, TCE, Assembleia, Governo e Diário Oficial. Cada órgão tem atalho para "Editais no Diário Oficial" e para buscar "concurso/edital" dentro do próprio site. |
| **Radar de Editais** ⭐ | A página dos **concursos com inscrição aberta hoje**: os conferidos pela equipe (cadastrados no painel) e os que o robô diário encontra nos sites oficiais com "inscrições abertas" ou "edital de abertura". Inscrição encerrada, resultado e gabarito não aparecem. Inclui a busca **"Procurar inscrições abertas nos sites oficiais"**, organizada por tipo de órgão (Polícias Militares, Polícias Civis, Bombeiros, TJs…) com botões por estado, começando por SP, RJ e MG. |
| **Bancas ligadas ao concurso** ⭐ | Cada banca tem atalhos para *Inscrições abertas* e *Convocações e resultados*. Na Agenda, em "Meu nome no Diário" e no Radar, o botão **"Na banca"** abre a página onde a banca chama o candidato (link cadastrado no painel ou pesquisa no site da banca). |
| **Meu nome no Diário Oficial** ⭐ | Busca avançada: o candidato informa nome, RG, nº de inscrição e estado, e o Atlas monta as buscas certas no Diário Oficial do estado, no site do órgão (ex.: PM), nas bancas, no DOU e nas prefeituras — com o RG em vários formatos e o CPF mascarado como os diários publicam (o CPF completo nunca é usado). Atalho "Procurar meu nome nos editais" em cada órgão estadual. |
| **Edital e Área do candidato** | Cada órgão tem atalhos para o edital e para a área do candidato (login da inscrição). Se houver concurso aberto cadastrado, os links vão direto para ele. |
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

- **Sem configurar nada:** tudo é salvo no navegador do usuário (`localStorage`). Não precisa de cadastro nem de servidor. Os pedidos do serviço pago e os pedidos de lembrete vão direto para o WhatsApp do atendimento (`contato.whatsapp`).
- **Com contas (Firebase, grátis):** aparece **Entrar / Criar conta** com **e-mail e senha** (e Google como opção). Os dados sincronizam entre aparelhos e o Painel passa a mostrar **Usuários**, **Pedidos** e **Lembretes de hoje**.

Coleções do Firestore: `users/{uid}` (dados do aparelho, só o dono), `perfis/{uid}` (nome, e-mail, WhatsApp, consentimentos), `pedidos/{código}` (serviço pago) e `lembretes/{uid_concurso}` (lembretes de prova). As regras de segurança estão em [`firestore.rules`](firestore.rules); o Painel (aba *Avançado*) gera o texto pronto com o seu e-mail de administrador.

### Ativar as contas (Firebase, plano gratuito)

O passo a passo completo está no Painel, aba **Avançado**. Resumo:

1. Em <https://console.firebase.google.com>, crie o projeto.
2. **Authentication → Método de login:** ative **E-mail/senha** (e Google, se quiser).
3. **Authentication → Configurações → Domínios autorizados:** adicione os domínios do site (ex.: `atlas-concursos.pages.dev`, `williancoder.github.io` e o domínio próprio).
4. **Firestore Database:** crie o banco em modo produção (`southamerica-east1`).
5. Crie sua conta no site com o e-mail do administrador, confirme o e-mail e preencha **E-mail do administrador** no Painel.
6. **Firestore → Regras:** cole as regras geradas pelo Painel e publique.
7. Copie o `firebaseConfig` do app web para o campo **Configuração do app web** no Painel e publique.

> A `apiKey` do Firebase para web é pública por design; a segurança vem das regras. Só a conta com o e-mail de administrador **confirmado** lê os dados de todos.

## Serviços pagos e lembretes

- **Pesquisa no Diário Oficial** (`#/pesquisa-diario`): o candidato preenche nome, WhatsApp, estado e concurso, recebe um **código de pedido** e o **Pix com o valor e o código** (QR Code e copia e cola), e envia o comprovante no WhatsApp com a mensagem pronta. Preço, prazo e ativação ficam no Painel (*Pix, serviços e contato*). Com contas ativas, o pedido exige login e aparece no Painel, aba **Pedidos**, onde você muda a situação (aguardando → pago → entregue) e responde pelo WhatsApp com um toque.
- **Lembretes no WhatsApp** (`#/concursos`): ao cadastrar um concurso, o candidato pode pedir avisos (fim das inscrições, 7 dias e véspera da prova, dia do resultado). Na aba **Lembretes de hoje** do Painel, cada aviso do dia vem com a mensagem pronta para enviar no WhatsApp.

## Marca (nome e logo)

O nome e o logo do site são escolhidos no Painel, aba **Marca e logo** (`marca` no `config.js`). As marcas prontas ficam em `assets/js/marcas.js` e os arquivos de cada uma (logo, imagem de prévia, ícones e PDF de apresentação) em `assets/marcas/<id>/`. O código-fonte continua com "Atlas Concursos"; o build (`scripts/brand.mjs`) troca o nome nos textos e copia os arquivos da marca escolhida. Para voltar ao original, escolha **Atlas Concursos** no Painel e publique.

## Limites de uso

Configuráveis no Painel, aba **Limites de uso** (`limites` no `config.js`, 0 = sem limite; contadores zeram à meia-noite):

| Limite | Padrão |
|---|---|
| Buscas grátis por dia no "Meu nome no Diário" (visitante / com conta) | 5 / 15 |
| Pedidos aguardando pagamento por pessoa | 2 |
| Pedidos por dia por pessoa | 3 |
| Concursos com lembrete no WhatsApp por pessoa | 3 |

Cada pedido da Pesquisa no Diário cobre 1 pessoa, 1 concurso, o Diário Oficial do estado e da União, o site do órgão e da banca e os últimos 12 meses (escrito na página do serviço e nos termos). O plano **Acompanhamento** (`servicos.acompanhamento`) fica desligado até você ativar no Painel.

## Google e compartilhamento

O build (`scripts/build-site.sh`) roda `scripts/seo-pages.mjs`, que gera `estados/<uf>.html` (uma página por estado com os sites oficiais e as inscrições abertas do dia), `estados/index.html`, `sitemap.xml` e os endereços absolutos da imagem de prévia (`assets/img/og.png`). O endereço vem da variável `SITE_URL`, do `siteUrl` do `config.js` ou, por padrão, `https://atlas-concursos.pages.dev/`. Como o robô do Radar publica todo dia, essas páginas se atualizam sozinhas. A apresentação para clientes fica em `assets/docs/atlas-concursos-apresentacao.pdf` (link na página "Anuncie").

## Painel do Administrador (`/admin.html`)

Edite a **Agenda de Inscrições**, **Pix, serviços, contato, patrocínios (com período, posição e prévia), links de afiliado, dicas patrocinadas, preços, AdSense e Firebase** e acompanhe **pedidos, usuários e lembretes** pelo navegador — no computador ou no celular — sem mexer em código.

1. Crie um token em <https://github.com/settings/personal-access-tokens/new>: *Only select repositories* → este repositório; *Permissions → Contents: Read and write* e *Actions: Read and write* (para o botão "Atualizar o Radar agora"); validade de 90 dias.
2. Abra `https://SEU-SITE/admin.html`, cole o token e entre.
3. Edite e clique em **Salvar e publicar**: o painel grava `assets/js/config.js` e `data/agenda.js` no GitHub e o site atualiza em ~1 minuto. Na aba *Concursos abertos*, as novidades do Radar aparecem como sugestões para cadastrar com um clique; só aparecem no site os concursos com inscrição aberta hoje. Na *Visão geral*, o botão **Atualizar o Radar agora** roda a varredura na hora.

O token fica só na aba do navegador (some ao fechar), a página não é indexada pelo Google e nunca entra no cache offline. A aba *Visão geral* mostra a receita mensal dos patrocínios ativos, quem vence em 7 dias e um checklist para começar a faturar.

## Radar de Editais

- `scripts/radar.mjs` + `.github/workflows/radar.yml` rodam todo dia às 07:23 (Brasília).
- Cada execução guarda em `data/radar.js` as **inscrições abertas** encontradas hoje em cada site (já na primeira varredura) e os **editais novos** desde a anterior (mantém 30 dias). Links com encerrada, resultado, gabarito ou convocação são descartados.
- Quando o Radar encontra novidades, o site é republicado automaticamente.
- Para rodar na hora: *Actions → Radar de Editais → Run workflow*.

## Monetização com preço justo

Tudo é configurado pelo **Painel do Administrador** (ou em `assets/js/config.js`) e só aparece no site depois de preenchido:

| Bloco | O que faz | O que preencher |
|---|---|---|
| **Apoie o Atlas** (`#/apoie`) | Doação por Pix com QR Code e "copia e cola" gerados no navegador (padrão BR Code do Banco Central), com valores sugeridos de R$ 5 a R$ 50 ou valor livre. | `pix.chave`, `pix.nome`, `pix.cidade` |
| **Anuncie no Atlas** (`#/anuncie`) | Página comercial com pacotes de patrocínio a preço fixo (a partir de R$ 29), regras de transparência e botão de WhatsApp/e-mail. | `contato.whatsapp` e/ou `contato.email`; preços em `pacotes` |
| **Cards "Patrocinado"** | Aparecem nas páginas escolhidas (início, Radar, Descubra, categorias, estados ou Ferramentas), no topo, no meio ou no fim. Período diário, semanal, quinzenal, mensal ou personalizado: entram na data de início e somem sozinhos na data final. A aba **Testar anúncios** mostra a prévia no celular e no computador e abre o site com o anúncio só para você. | `patrocinios` |
| **Pesquisa no Diário Oficial** | Serviço pago (R$ 15) com Pix por pedido e atendimento no WhatsApp. | `servicos.diario`, `contato.whatsapp`, `pix` |
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

> Para ter **todos** os cabeçalhos de segurança e ainda manter o repositório privado de graça, publique pelo **Cloudflare Pages** (passo a passo abaixo).

Em qualquer hospedagem, só vão ao ar os arquivos montados por `scripts/build-site.sh` (páginas, `assets/`, `data/radar.js`, `data/agenda.js`, `_headers`, `security.txt`). O código do robô, o README e o estado interno do Radar ficam só no repositório.

### Publicar pelo Cloudflare Pages (repositório privado, grátis)

1. Crie uma conta em cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** e autorize só este repositório.
2. Configure: **Production branch** `main` · **Framework preset** None · **Build command** `bash scripts/build-site.sh` · **Build output directory** `_site`.
3. Abra o endereço `https://<nome>.pages.dev` e confira o site e o `admin.html`.
4. Só depois disso torne o repositório privado (**Settings → General → Danger Zone → Change visibility**) e desative o GitHub Pages (**Settings → Pages**); apague `.github/workflows/pages.yml` para ele não tentar publicar.
5. Cada commit em `main` (inclusive os do robô do Radar e os do Painel) republica o site sozinho.
6. No Painel, aba **Avançado**, preencha o **endereço do site** com o novo link. O token do Painel precisa continuar com acesso a este repositório (Contents e Actions: Read and write).

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
assets/js/finder.js     Meu nome no Diário Oficial
assets/js/agenda.js     concursos abertos conferidos (dados do painel)
assets/js/radar.js      página Radar de Editais
data/agenda.js          concursos abertos (editado pelo painel)
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
