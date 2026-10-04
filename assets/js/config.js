/*
 * Configurações do Atlas Concursos.
 * Tudo aqui é opcional — o site funciona 100% sem preencher nada.
 */
window.ATLAS_CONFIG = {
  // Endereço público do site (usado em links de compartilhamento).
  siteUrl: '',

  // Repositório para o botão "Reportar link quebrado".
  repoUrl: 'https://github.com/WillianCoder/site-concursos-publicos-geral',

  /*
   * Propagandas (Google AdSense).
   * 1. Crie sua conta em https://adsense.google.com e aguarde a aprovação.
   * 2. Cole aqui o seu ID de editor (ex.: 'ca-pub-1234567890123456').
   * 3. Crie blocos de anúncio no painel e cole os IDs de cada espaço.
   * 4. Atualize o arquivo /ads.txt na raiz do site.
   * Enquanto `client` estiver vazio, nenhum anúncio nem banner de cookies aparece.
   */
  ads: {
    client: '',
    slots: {
      sidebar: '',   // bloco na barra lateral (desktop)
      feed: '',      // bloco entre as seções de conteúdo
      footer: ''     // bloco no rodapé
    }
  },

  /*
   * ===== Monetização =====
   * Cada bloco só aparece no site depois de preenchido.
   */

  // Doações por Pix (página "Apoie o Atlas"). Nome sem acentos, até 25 letras; cidade até 15.
  pix: {
    chave: '',          // CPF, CNPJ, e-mail, celular (+55DDDNUMERO) ou chave aleatória
    nome: '',           // ex.: 'WILLIAN SALLES'
    cidade: '',         // ex.: 'SAO PAULO'
    valores: [5, 10, 20, 50]
  },

  // Contato comercial (página "Anuncie no Atlas").
  contato: {
    email: '',          // ex.: 'contato@atlasconcursos.com.br'
    whatsapp: ''        // só números com DDI: ex.: '5511999999999'
  },

  // Pacotes de patrocínio exibidos na página "Anuncie". Ajuste os preços quando a audiência crescer.
  pacotes: [
    { nome: 'Destaque em categoria', preco: 'R$ 49/semana', desc: 'Seu card no topo de uma categoria (ex.: Estudo Gratuito, Bancas, Legislação).', ideal: 'Cursinhos, editoras, professores' },
    { nome: 'Destaque no estado', preco: 'R$ 99/mês', desc: 'Card patrocinado no hub de um estado (ex.: Minas Gerais), visto por quem presta concursos ali.', ideal: 'Cursinhos regionais e preparatórios para PM/PC' },
    { nome: 'Destaque na página inicial', preco: 'R$ 299/mês', desc: 'Card patrocinado na página inicial, a mais visitada do site.', ideal: 'Plataformas nacionais de ensino' },
    { nome: 'Dica patrocinada', preco: 'R$ 29/dia', desc: 'Sua mensagem no quadro "Dica do dia" da página inicial durante um dia.', ideal: 'Lançamentos, aulões e promoções' }
  ],

  /*
   * Patrocínios ativos. Cada um aparece como card "Patrocinado".
   * onde: 'home' | 'c:ID-da-categoria' (ex.: 'c:estudo') | 'uf:SIGLA' (ex.: 'uf:MG') | 'ferramentas'
   * ate: último dia de exibição (AAAA-MM-DD). Depois disso o card some sozinho.
   */
  patrocinios: [
    // { titulo: 'Cursinho Exemplo — PM-MG', desc: 'Turma nova com 30% de desconto.', url: 'https://...', onde: ['uf:MG'], ate: '2026-12-31' }
  ],

  /*
   * Recomendações com link de afiliado (Hotmart, Amazon, Kiwify…).
   * Aparecem em "Ferramentas" e no fim da página inicial, sempre com o aviso de link afiliado.
   */
  recomendados: [
    // { titulo: 'Vade Mecum 2026', desc: 'Legislação atualizada para concursos.', preco: 'R$ 89,90', url: 'https://amzn.to/...', tag: 'Livro' }
  ],

  // "Dica patrocinada": substitui a Dica do dia da página inicial na data indicada.
  dicasPatrocinadas: [
    // { data: '2026-11-10', texto: 'Aulão gratuito de Direito Constitucional hoje às 19h.', url: 'https://...' }
  ],

  // Link de um formulário (ex.: Google Forms) para a lista de espera do Atlas Pro. Vazio = não aparece.
  listaEsperaPro: '',

  /*
   * Login na nuvem (opcional, gratuito) com Firebase.
   * Permite que o usuário entre com a conta Google e veja os mesmos
   * links salvos no celular e no computador. Passo a passo no README.
   * Deixe `null` para usar apenas o armazenamento local do navegador.
   */
  firebase: null
  // firebase: {
  //   apiKey: '...',
  //   authDomain: 'seu-projeto.firebaseapp.com',
  //   projectId: 'seu-projeto',
  //   appId: '...'
  // }
};
