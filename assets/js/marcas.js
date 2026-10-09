/*
 * Marcas prontas para o site. A ativa é escolhida no Painel (aba "Marca"),
 * que grava o id em config.js ("marca"). Ao publicar, o build aplica o nome
 * e os arquivos de assets/marcas/<id>/ (logo, imagem de prévia, ícones e PDF).
 * Para voltar ao Atlas é só escolher "Atlas Concursos" e publicar.
 */
window.ATLAS_MARCAS = [
  { id: 'atlas', nome: 'Atlas Concursos', p1: 'Atlas', p2: 'Concursos', curto: 'Atlas', desc: 'Nome original do site.' },
  { id: 'busquei', nome: 'Busquei Concursos', p1: 'Busquei', p2: 'Concursos', curto: 'Busquei', desc: '"Busquei, achei": lupa com o check. Mais perto de "busca concursos", sem copiar quem já existe.' },
  { id: 'bussola', nome: 'Bússola Concursos', p1: 'Bússola', p2: 'Concursos', curto: 'Bússola', desc: 'Nome mais diferente dos concorrentes: o mais fácil de registrar como marca.' },
  { id: 'geral', nome: 'Concurso Geral', p1: 'Concurso', p2: 'Geral', curto: 'Concurso Geral', desc: 'Tudo de concurso num lugar. Nome simples, mas mais genérico.' }
];
