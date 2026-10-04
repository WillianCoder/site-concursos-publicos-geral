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
