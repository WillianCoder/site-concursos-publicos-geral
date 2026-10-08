/*
 * Configurações do Atlas Concursos.
 * Edite pelo Painel do Administrador (admin.html) ou à mão — o conteúdo entre
 * as chaves precisa ser JSON válido (aspas duplas, sem comentários).
 * O significado de cada campo está no README.md, seção "Configurações".
 */
window.ATLAS_CONFIG = {
  "siteUrl": "",
  "repoUrl": "https://github.com/WillianCoder/site-concursos-publicos-geral",
  "ads": { "client": "", "slots": { "sidebar": "", "feed": "", "footer": "" } },
  "pix": { "chave": "", "nome": "", "cidade": "", "valores": [5, 10, 20, 50] },
  "contato": { "email": "", "whatsapp": "5511911482873" },
  "servicos": {
    "diario": { "ativo": true, "preco": 15, "prazo": "em até 2 dias úteis" },
    "acompanhamento": { "ativo": false, "preco": 39, "semanas": 4 }
  },
  "limites": { "buscasDia": 5, "buscasDiaConta": 15, "lembretes": 3, "pedidosAbertos": 2, "pedidosDia": 3 },
  "pacotes": [
    { "nome": "Destaque em categoria", "preco": "R$ 49/semana", "desc": "Seu card no topo de uma categoria (ex.: Estudo Gratuito, Bancas, Legislação).", "ideal": "Cursinhos, editoras, professores" },
    { "nome": "Destaque no estado", "preco": "R$ 99/mês", "desc": "Card patrocinado no hub de um estado (ex.: Minas Gerais), visto por quem presta concursos ali.", "ideal": "Cursinhos regionais e preparatórios para PM/PC" },
    { "nome": "Destaque na página inicial", "preco": "R$ 299/mês", "desc": "Card patrocinado na página inicial, a mais visitada do site.", "ideal": "Plataformas nacionais de ensino" },
    { "nome": "Patrocinador do Radar de Editais", "preco": "R$ 149/mês", "desc": "Seu card no Radar de Editais, a página que os concurseiros abrem todo dia para ver editais novos.", "ideal": "Cursinhos e plataformas de questões" },
    { "nome": "Patrocinador do Descubra seu concurso", "preco": "R$ 99/mês", "desc": "Apareça para quem acabou de descobrir qual carreira seguir — o momento exato de escolher um curso.", "ideal": "Cursinhos por carreira (policial, tribunais, fiscal)" },
    { "nome": "Dica patrocinada", "preco": "R$ 29/dia", "desc": "Sua mensagem no quadro \"Dica do dia\" da página inicial durante um dia.", "ideal": "Lançamentos, aulões e promoções" }
  ],
  "patrocinios": [],
  "recomendados": [],
  "dicasPatrocinadas": [],
  "listaEsperaPro": "",
  "firebase": null,
  "adminEmail": ""
};
