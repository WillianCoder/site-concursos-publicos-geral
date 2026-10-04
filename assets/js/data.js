/*
 * Atlas Concursos — catálogo de sites oficiais.
 * Copyright (c) 2026 Willian Salles. Todos os direitos reservados.
 *
 * Formato de cada item:  L(nome, url, descrição, [tags], [[subsite, url], ...])
 * Para sugerir um link novo ou corrigir um quebrado, use o botão "Reportar link"
 * no site ou abra uma issue no repositório.
 */
(function (root) {
  'use strict';

  const L = (n, u, d, t, s) => ({ n, u, d: d || '', t: t || [], s: s || [] });
  const P = 'https://www.planalto.gov.br/ccivil_03/';

  const categorias = [
    {
      id: 'federal',
      nome: 'Órgãos Federais',
      icone: 'landmark',
      desc: 'Ministérios, autarquias e portais do Governo Federal que realizam concursos.',
      itens: [
        L('Concurso Nacional Unificado (CNU)', 'https://www.gov.br/gestao/pt-br/concursonacional', 'O "Enem dos concursos": vários órgãos federais em uma única prova.', ['cnu', 'federal', 'unificado']),
        L('Portal do Servidor', 'https://www.gov.br/servidor/pt-br', 'Informações oficiais sobre carreira, remuneração e concursos federais.', ['servidor', 'carreira']),
        L('Ministério da Gestão (MGI)', 'https://www.gov.br/gestao/pt-br', 'Autoriza os concursos federais e publica as portarias.', ['autorização', 'portarias']),
        L('INSS', 'https://www.gov.br/inss/pt-br', 'Instituto Nacional do Seguro Social — técnico e analista do seguro social.', ['previdência']),
        L('IBGE', 'https://www.ibge.gov.br', 'Concursos para recenseadores, agentes e analistas.', ['censo', 'temporário']),
        L('AGU — Advocacia-Geral da União', 'https://www.gov.br/agu/pt-br', 'Advogado da União, procurador federal e área administrativa.', ['jurídica']),
        L('PGFN', 'https://www.gov.br/pgfn/pt-br', 'Procuradoria-Geral da Fazenda Nacional.', ['jurídica', 'fiscal']),
        L('ABIN', 'https://www.gov.br/abin/pt-br', 'Agência Brasileira de Inteligência — oficial e agente de inteligência.', ['inteligência']),
        L('Itamaraty (Ministério das Relações Exteriores)', 'https://www.gov.br/mre/pt-br', 'Carreira diplomática (Instituto Rio Branco) e oficial de chancelaria.', ['diplomacia']),
        L('Ministério do Trabalho e Emprego', 'https://www.gov.br/trabalho-e-emprego/pt-br', 'Auditor-fiscal do trabalho.', ['auditor', 'fiscal']),
        L('EBSERH', 'https://www.gov.br/ebserh/pt-br', 'Hospitais universitários federais — saúde e área administrativa.', ['saúde', 'hospital']),
        L('Fiocruz', 'https://fiocruz.br', 'Fundação Oswaldo Cruz — pesquisa, saúde e gestão.', ['saúde', 'pesquisa']),
        L('INCA', 'https://www.gov.br/inca/pt-br', 'Instituto Nacional de Câncer.', ['saúde']),
        L('Anvisa', 'https://www.gov.br/anvisa/pt-br', 'Agência Nacional de Vigilância Sanitária.', ['agência reguladora', 'saúde']),
        L('Anatel', 'https://www.gov.br/anatel/pt-br', 'Agência Nacional de Telecomunicações.', ['agência reguladora']),
        L('ANEEL', 'https://www.gov.br/aneel/pt-br', 'Agência Nacional de Energia Elétrica.', ['agência reguladora']),
        L('ANP', 'https://www.gov.br/anp/pt-br', 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis.', ['agência reguladora']),
        L('ANTT', 'https://www.gov.br/antt/pt-br', 'Agência Nacional de Transportes Terrestres.', ['agência reguladora']),
        L('IBAMA', 'https://www.gov.br/ibama/pt-br', 'Analista e técnico ambiental.', ['meio ambiente']),
        L('ICMBio', 'https://www.gov.br/icmbio/pt-br', 'Instituto Chico Mendes de Conservação da Biodiversidade.', ['meio ambiente']),
        L('INCRA', 'https://www.gov.br/incra/pt-br', 'Instituto Nacional de Colonização e Reforma Agrária.', ['agrário']),
        L('FUNAI', 'https://www.gov.br/funai/pt-br', 'Fundação Nacional dos Povos Indígenas.', ['indigenista']),
        L('INPI', 'https://www.gov.br/inpi/pt-br', 'Instituto Nacional da Propriedade Industrial.', ['patentes']),
        L('DNIT', 'https://www.gov.br/dnit/pt-br', 'Departamento Nacional de Infraestrutura de Transportes.', ['engenharia']),
        L('CAPES', 'https://www.gov.br/capes/pt-br', 'Coordenação de Aperfeiçoamento de Pessoal de Nível Superior.', ['educação']),
        L('CNPq', 'https://www.gov.br/cnpq/pt-br', 'Conselho Nacional de Desenvolvimento Científico e Tecnológico.', ['pesquisa']),
        L('Ministério da Educação (MEC)', 'https://www.gov.br/mec/pt-br', 'Institutos e universidades federais publicam editais próprios.', ['educação', 'professor'])
      ]
    },
    {
      id: 'bancas',
      nome: 'Bancas Organizadoras',
      icone: 'clipboard',
      desc: 'Onde ficam as inscrições, editais, gabaritos, recursos e resultados.',
      itens: [
        L('Cebraspe (antigo Cespe/UnB)', 'https://www.cebraspe.org.br', 'Provas de Certo ou Errado — PF, PRF, tribunais, Receita e muito mais.', ['cespe', 'certo errado'], [
          ['Concursos', 'https://www.cebraspe.org.br/concursos']
        ]),
        L('FGV Conhecimento', 'https://conhecimento.fgv.br/concursos', 'Fundação Getulio Vargas — OAB, tribunais, fiscos e prefeituras.', ['fgv', 'oab']),
        L('FCC — Fundação Carlos Chagas', 'https://www.concursosfcc.com.br', 'Tradicional em tribunais (TRTs, TRFs) e secretarias de fazenda.', ['fcc']),
        L('Vunesp', 'https://www.vunesp.com.br', 'Principal banca de São Paulo — PMSP, PCSP, TJSP, prefeituras.', ['sp']),
        L('Cesgranrio', 'https://www.cesgranrio.org.br', 'Banco do Brasil, Petrobras, Transpetro, IBGE e estatais.', ['bancos', 'estatais']),
        L('IBFC', 'https://www.ibfc.org.br', 'Instituto Brasileiro de Formação e Capacitação.', ['ibfc']),
        L('Instituto AOCP', 'https://www.institutoaocp.org.br', 'Saúde, polícias e órgãos estaduais.', ['aocp']),
        L('Quadrix', 'https://www.quadrix.org.br', 'Conselhos profissionais (CRM, CREA, CRC…) e órgãos do DF.', ['conselhos']),
        L('IDECAN', 'https://www.idecan.org.br', 'Instituto de Desenvolvimento Educacional, Cultural e Assistencial Nacional.', ['idecan']),
        L('Instituto Consulplan', 'https://www.institutoconsulplan.org.br', 'Cartórios, tribunais e prefeituras.', ['consulplan', 'cartório']),
        L('FUNDATEC', 'https://www.fundatec.org.br', 'Forte no Rio Grande do Sul.', ['rs']),
        L('IADES', 'https://www.iades.com.br', 'Instituto Americano de Desenvolvimento — DF e órgãos federais.', ['df']),
        L('FUMARC', 'https://www.fumarc.com.br', 'Fundação da PUC Minas — órgãos de Minas Gerais.', ['mg']),
        L('FEPESE', 'https://fepese.org.br', 'Fundação da UFSC — Santa Catarina.', ['sc']),
        L('Objetiva Concursos', 'https://www.objetivas.com.br', 'Prefeituras do Sul do país.', ['sul']),
        L('Legalle Concursos', 'https://www.legalleconcursos.com.br', 'Prefeituras e câmaras no Sul.', ['sul']),
        L('Instituto Mais', 'https://www.institutomais.org.br', 'Prefeituras de São Paulo e região.', ['sp']),
        L('NC-UFPR', 'https://servicos.nc.ufpr.br/PortalNC/', 'Núcleo de Concursos da UFPR — Paraná.', ['pr']),
        L('COPS-UEL', 'https://www.cops.uel.br', 'Coordenadoria de Processos Seletivos da UEL — Paraná.', ['pr']),
        L('Comperve (UFRN)', 'https://www.comperve.ufrn.br', 'Concursos e processos seletivos do Rio Grande do Norte.', ['rn'])
      ]
    },
    {
      id: 'diarios',
      nome: 'Diários Oficiais',
      icone: 'newspaper',
      desc: 'Todo edital é publicado em diário oficial. Aqui estão os nacionais; os estaduais ficam em cada estado.',
      itens: [
        L('Diário Oficial da União (DOU)', 'https://www.in.gov.br', 'Imprensa Nacional — editais de todos os concursos federais.', ['dou', 'federal'], [
          ['Pesquisa avançada', 'https://www.in.gov.br/consulta'],
          ['Leitura do jornal do dia', 'https://www.in.gov.br/leiturajornal']
        ]),
        L('Querido Diário', 'https://queridodiario.ok.org.br', 'Busca gratuita em diários oficiais de centenas de municípios. Ótimo para concursos de prefeituras.', ['municipal', 'prefeitura', 'busca']),
        L('Diário de Justiça Eletrônico Nacional (DJEN)', 'https://comunica.pje.jus.br', 'Comunicações processuais de todos os tribunais (CNJ).', ['justiça']),
        L('Diário Oficial dos Municípios (vários estados)', 'https://www.diariomunicipal.com.br', 'Diários de associações de municípios (PE, MA, MT, RN e outros).', ['municipal', 'prefeitura']),
        L('Diário Oficial dos Municípios de SC (DOM/SC)', 'https://www.diariomunicipal.sc.gov.br', 'Todos os municípios catarinenses consorciados.', ['municipal', 'sc'])
      ]
    },
    {
      id: 'seguranca',
      nome: 'Segurança & Forças Armadas',
      icone: 'shield',
      desc: 'Polícias federais e Forças Armadas. As polícias estaduais (PM, PC, Bombeiros) estão em cada estado.',
      itens: [
        L('Polícia Federal', 'https://www.gov.br/pf/pt-br', 'Agente, escrivão, papiloscopista, perito e delegado.', ['pf', 'polícia']),
        L('Polícia Rodoviária Federal', 'https://www.gov.br/prf/pt-br', 'Policial rodoviário federal.', ['prf', 'polícia']),
        L('Polícia Penal Federal (Senappen)', 'https://www.gov.br/senappen/pt-br', 'Secretaria Nacional de Políticas Penais.', ['penal', 'polícia']),
        L('Exército Brasileiro', 'https://www.eb.mil.br', 'Portal do Exército — ingresso como oficial, sargento e temporário.', ['exército', 'militar'], [
          ['EsPCEx — Escola Preparatória de Cadetes', 'https://www.espcex.eb.mil.br'],
          ['ESA — Escola de Sargentos das Armas', 'https://esa.eb.mil.br']
        ]),
        L('Marinha do Brasil', 'https://www.marinha.mil.br', 'Escola Naval, Colégio Naval, fuzileiros, aprendizes-marinheiros.', ['marinha', 'militar']),
        L('Força Aérea Brasileira', 'https://www.fab.mil.br', 'EPCAR, AFA, EEAR e quadros complementares.', ['fab', 'aeronáutica', 'militar']),
        L('Ministério da Justiça e Segurança Pública', 'https://www.gov.br/mj/pt-br', 'Órgão ao qual PF, PRF e Senappen são vinculados.', ['mjsp'])
      ]
    },
    {
      id: 'justica',
      nome: 'Tribunais, MP & Defensoria',
      icone: 'scale',
      desc: 'Tribunais superiores, Justiça Federal, Ministério Público da União e Defensoria. TJs, TREs e MPs estaduais estão em cada estado.',
      itens: [
        L('STF — Supremo Tribunal Federal', 'https://portal.stf.jus.br', 'Analista e técnico judiciário.', ['tribunal superior']),
        L('STJ — Superior Tribunal de Justiça', 'https://www.stj.jus.br', 'Analista e técnico judiciário.', ['tribunal superior']),
        L('TST — Tribunal Superior do Trabalho', 'https://www.tst.jus.br', 'Justiça do Trabalho.', ['tribunal superior', 'trabalho']),
        L('TSE — Tribunal Superior Eleitoral', 'https://www.tse.jus.br', 'Justiça Eleitoral (também emite a certidão de quitação eleitoral).', ['tribunal superior', 'eleitoral']),
        L('STM — Superior Tribunal Militar', 'https://www.stm.jus.br', 'Justiça Militar da União.', ['tribunal superior', 'militar']),
        L('CNJ — Conselho Nacional de Justiça', 'https://www.cnj.jus.br', 'Também organiza o Exame Nacional da Magistratura (ENAM).', ['magistratura', 'enam']),
        L('TRF1 — 1ª Região', 'https://www.trf1.jus.br', 'DF, GO, TO, MT, BA, PI, MA, PA, AP, AM, RR, RO e AC.', ['justiça federal']),
        L('TRF2 — 2ª Região', 'https://www.trf2.jus.br', 'RJ e ES.', ['justiça federal']),
        L('TRF3 — 3ª Região', 'https://www.trf3.jus.br', 'SP e MS.', ['justiça federal']),
        L('TRF4 — 4ª Região', 'https://www.trf4.jus.br', 'RS, SC e PR.', ['justiça federal']),
        L('TRF5 — 5ª Região', 'https://www.trf5.jus.br', 'PE, CE, AL, SE, RN e PB.', ['justiça federal']),
        L('TRF6 — 6ª Região', 'https://www.trf6.jus.br', 'Minas Gerais.', ['justiça federal']),
        L('MPF — Ministério Público Federal', 'https://www.mpf.mp.br', 'Procurador da República, analista e técnico do MPU.', ['mpu']),
        L('MPT — Ministério Público do Trabalho', 'https://mpt.mp.br', 'Procurador do trabalho.', ['mpu', 'trabalho']),
        L('CNMP — Conselho Nacional do MP', 'https://www.cnmp.mp.br', 'Conselho Nacional do Ministério Público.', ['mp']),
        L('DPU — Defensoria Pública da União', 'https://www.dpu.def.br', 'Defensor público federal e apoio administrativo.', ['defensoria'])
      ]
    },
    {
      id: 'controle',
      nome: 'Fiscal & Controle',
      icone: 'calculator',
      desc: 'As carreiras mais disputadas: fiscos, controle e área financeira.',
      itens: [
        L('Receita Federal', 'https://www.gov.br/receitafederal/pt-br', 'Auditor-fiscal e analista-tributário.', ['fiscal', 'auditor']),
        L('TCU — Tribunal de Contas da União', 'https://portal.tcu.gov.br', 'Auditor federal de controle externo.', ['controle', 'auditor']),
        L('CGU — Controladoria-Geral da União', 'https://www.gov.br/cgu/pt-br', 'Auditor federal de finanças e controle.', ['controle']),
        L('Banco Central do Brasil', 'https://www.bcb.gov.br', 'Analista e técnico do BACEN.', ['bacen', 'financeiro']),
        L('Tesouro Nacional', 'https://www.gov.br/tesouronacional/pt-br', 'Auditor federal de finanças e controle (STN).', ['stn']),
        L('CVM — Comissão de Valores Mobiliários', 'https://www.gov.br/cvm/pt-br', 'Analista e inspetor.', ['financeiro']),
        L('Susep', 'https://www.gov.br/susep/pt-br', 'Superintendência de Seguros Privados.', ['financeiro'])
      ]
    },
    {
      id: 'legislativo',
      nome: 'Legislativo',
      icone: 'building',
      desc: 'Câmara e Senado pagam alguns dos maiores salários do país. Assembleias estaduais estão em cada estado.',
      itens: [
        L('Câmara dos Deputados', 'https://www.camara.leg.br', 'Analista legislativo, consultor e técnico.', ['câmara']),
        L('Senado Federal', 'https://www12.senado.leg.br', 'Consultor, analista, advogado e policial legislativo.', ['senado'])
      ]
    },
    {
      id: 'estatais',
      nome: 'Bancos & Estatais',
      icone: 'briefcase',
      desc: 'Empresas públicas e sociedades de economia mista (regime CLT).',
      itens: [
        L('Banco do Brasil', 'https://www.bb.com.br', 'Escriturário — agente comercial e de tecnologia.', ['banco']),
        L('Caixa Econômica Federal', 'https://www.caixa.gov.br', 'Técnico bancário e carreiras de nível superior.', ['banco']),
        L('BNDES', 'https://www.bndes.gov.br', 'Banco Nacional de Desenvolvimento Econômico e Social.', ['banco']),
        L('Banco do Nordeste', 'https://www.bnb.gov.br', 'Analista bancário.', ['banco', 'nordeste']),
        L('Banco da Amazônia', 'https://www.bancoamazonia.com.br', 'Técnico bancário.', ['banco', 'norte']),
        L('BRB — Banco de Brasília', 'https://www.brb.com.br', 'Escriturário e carreiras de TI.', ['banco', 'df']),
        L('Banrisul', 'https://www.banrisul.com.br', 'Banco do Estado do Rio Grande do Sul.', ['banco', 'rs']),
        L('Petrobras', 'https://petrobras.com.br', 'Técnicos e profissionais de nível superior.', ['petróleo']),
        L('Transpetro', 'https://transpetro.com.br', 'Subsidiária de logística da Petrobras.', ['petróleo']),
        L('Correios', 'https://www.correios.com.br', 'Agente de correios e analista.', ['correios']),
        L('Serpro', 'https://www.serpro.gov.br', 'Tecnologia da informação do governo.', ['ti']),
        L('Dataprev', 'https://www.dataprev.gov.br', 'Tecnologia da previdência social.', ['ti']),
        L('Embrapa', 'https://www.embrapa.br', 'Pesquisa agropecuária.', ['pesquisa']),
        L('Casa da Moeda', 'https://www.casadamoeda.gov.br', 'Casa da Moeda do Brasil.', ['indústria']),
        L('Conab', 'https://www.gov.br/conab/pt-br', 'Companhia Nacional de Abastecimento.', ['agro'])
      ]
    },
    {
      id: 'legislacao',
      nome: 'Legislação (Lei Seca)',
      icone: 'book',
      desc: 'Textos oficiais e atualizados no Planalto — a fonte que as bancas usam.',
      itens: [
        L('Constituição Federal', P + 'constituicao/constituicao.htm', 'CF/88 compilada.', ['cf', 'constitucional']),
        L('Lei 8.112/90 — Servidores Federais', P + 'leis/l8112cons.htm', 'Regime jurídico dos servidores públicos civis da União.', ['administrativo']),
        L('Lei 14.133/21 — Licitações e Contratos', P + '_ato2019-2022/2021/lei/l14133.htm', 'Nova Lei de Licitações.', ['administrativo', 'licitação']),
        L('Lei 9.784/99 — Processo Administrativo', P + 'leis/l9784.htm', 'Processo administrativo federal.', ['administrativo']),
        L('Lei 8.429/92 — Improbidade Administrativa', P + 'leis/l8429.htm', 'Com as alterações da Lei 14.230/21.', ['administrativo']),
        L('Lei 12.527/11 — Acesso à Informação', P + '_ato2011-2014/2011/lei/l12527.htm', 'LAI.', ['administrativo']),
        L('Lei 13.709/18 — LGPD', P + '_ato2015-2018/2018/lei/l13709.htm', 'Lei Geral de Proteção de Dados.', ['lgpd']),
        L('Código Penal', P + 'decreto-lei/del2848compilado.htm', 'Decreto-Lei 2.848/40.', ['penal']),
        L('Código de Processo Penal', P + 'decreto-lei/del3689compilado.htm', 'Decreto-Lei 3.689/41.', ['processo penal']),
        L('Lei 11.343/06 — Lei de Drogas', P + '_ato2004-2006/2006/lei/l11343.htm', 'Sistema Nacional de Políticas sobre Drogas.', ['penal', 'legislação especial']),
        L('Lei 10.826/03 — Estatuto do Desarmamento', P + 'leis/2003/l10.826.htm', 'Registro, posse e porte de armas.', ['penal', 'legislação especial']),
        L('Lei 11.340/06 — Maria da Penha', P + '_ato2004-2006/2006/lei/l11340.htm', 'Violência doméstica e familiar contra a mulher.', ['penal', 'legislação especial']),
        L('Lei 13.869/19 — Abuso de Autoridade', P + '_ato2019-2022/2019/lei/l13869.htm', 'Crimes de abuso de autoridade.', ['penal', 'legislação especial']),
        L('Lei 9.099/95 — Juizados Especiais', P + 'leis/l9099.htm', 'Juizados Especiais Cíveis e Criminais.', ['processo']),
        L('Código Civil', P + 'leis/2002/l10406compilada.htm', 'Lei 10.406/02.', ['civil']),
        L('Código de Processo Civil', P + '_ato2015-2018/2015/lei/l13105.htm', 'Lei 13.105/15.', ['processo civil']),
        L('Código Tributário Nacional', P + 'leis/l5172compilado.htm', 'Lei 5.172/66.', ['tributário']),
        L('CLT — Consolidação das Leis do Trabalho', P + 'decreto-lei/del5452.htm', 'Decreto-Lei 5.452/43.', ['trabalho']),
        L('Código de Defesa do Consumidor', P + 'leis/l8078compilado.htm', 'Lei 8.078/90.', ['consumidor']),
        L('ECA — Estatuto da Criança e do Adolescente', P + 'leis/l8069.htm', 'Lei 8.069/90.', ['eca']),
        L('Código de Trânsito Brasileiro', P + 'leis/l9503compilado.htm', 'Lei 9.503/97 — muito cobrado em PRF e Detrans.', ['trânsito', 'prf']),
        L('LexML — busca de normas', 'https://www.lexml.gov.br', 'Pesquise qualquer lei, decreto ou jurisprudência.', ['busca'])
      ]
    },
    {
      id: 'estudo',
      nome: 'Estudo Gratuito & Provas',
      icone: 'graduation',
      desc: 'Cursos oficiais gratuitos com certificado, provas anteriores e bancos de questões.',
      itens: [
        L('Escola Virtual.Gov (EV.G)', 'https://www.escolavirtual.gov.br', 'Centenas de cursos gratuitos com certificado — português, administração, direito.', ['cursos', 'certificado', 'grátis']),
        L('ENAP', 'https://www.enap.gov.br', 'Escola Nacional de Administração Pública.', ['cursos', 'grátis']),
        L('Saberes — Senado Federal', 'https://saberes.senado.leg.br', 'Cursos gratuitos do Senado (direito constitucional, redação oficial…).', ['cursos', 'grátis']),
        L('Domínio Público', 'http://www.dominiopublico.gov.br', 'Biblioteca digital gratuita do MEC.', ['livros', 'grátis']),
        L('PCI Concursos — Provas anteriores', 'https://www.pciconcursos.com.br/provas/', 'Milhares de provas e gabaritos para baixar.', ['provas', 'gabaritos']),
        L('Qconcursos', 'https://www.qconcursos.com', 'Banco de questões (plano gratuito com limite diário).', ['questões', 'freemium']),
        L('TEC Concursos', 'https://www.tecconcursos.com.br', 'Banco de questões comentadas (freemium).', ['questões', 'freemium'])
      ]
    },
    {
      id: 'noticias',
      nome: 'Notícias & Agregadores',
      icone: 'radar',
      desc: 'Sites que reúnem os concursos abertos e previstos. Confirme sempre no edital oficial.',
      itens: [
        L('PCI Concursos', 'https://www.pciconcursos.com.br', 'Lista diária de concursos abertos por estado.', ['abertos']),
        L('JC Concursos', 'https://jcconcursos.com.br', 'Notícias e concursos previstos.', ['notícias']),
        L('Concursos no Brasil', 'https://concursosnobrasil.com', 'Notícias organizadas por região.', ['notícias'])
      ]
    },
    {
      id: 'servicos',
      nome: 'Documentos do Candidato',
      icone: 'id',
      desc: 'Certidões e serviços que costumam ser exigidos na inscrição e na posse.',
      itens: [
        L('Conta gov.br', 'https://www.gov.br', 'Login único para serviços do governo — muitas bancas aceitam.', ['login']),
        L('Situação Cadastral do CPF', 'https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp', 'Comprovante de regularidade do CPF.', ['cpf']),
        L('Certidão de Antecedentes Criminais (PF)', 'https://www.gov.br/pt-br/servicos/emitir-certidao-de-antecedentes-criminais', 'Emitida gratuitamente pela Polícia Federal.', ['certidão']),
        L('Quitação Eleitoral (TSE)', 'https://www.tse.jus.br', 'Certidão de quitação eleitoral — exigida na posse.', ['certidão', 'eleitoral']),
        L('Cadastro Único (isenção de taxa)', 'https://www.gov.br/mds/pt-br/acoes-e-programas/cadastro-unico', 'Inscritos no CadÚnico (NIS) podem pedir isenção da taxa de inscrição.', ['isenção', 'nis']),
        L('Portal da Transparência — Servidores', 'https://portaldatransparencia.gov.br/servidores', 'Veja remuneração real de cargos federais.', ['salário', 'remuneração'])
      ]
    }
  ];

  /* ---------- Estados: cada um vira um "hub" com seus subsites ---------- */

  const TIPOS = {
    gov: { nome: 'Governo do Estado', icone: 'landmark' },
    doe: { nome: 'Diário Oficial do Estado', icone: 'newspaper' },
    pm: { nome: 'Polícia Militar', icone: 'shield' },
    pc: { nome: 'Polícia Civil', icone: 'shield' },
    cbm: { nome: 'Corpo de Bombeiros', icone: 'flame' },
    tj: { nome: 'Tribunal de Justiça', icone: 'scale' },
    mp: { nome: 'Ministério Público', icone: 'scale' },
    dpe: { nome: 'Defensoria Pública', icone: 'scale' },
    tre: { nome: 'Tribunal Regional Eleitoral', icone: 'scale' },
    trt: { nome: 'Tribunal Regional do Trabalho', icone: 'scale' },
    sefaz: { nome: 'Secretaria da Fazenda', icone: 'calculator' },
    tce: { nome: 'Tribunal de Contas do Estado', icone: 'calculator' },
    al: { nome: 'Assembleia Legislativa', icone: 'building' }
  };

  // Cobertura de cada TRT (tribunal do trabalho) por estado.
  const TRT = {
    RJ: [1], SP: [2, 15], MG: [3], RS: [4], BA: [5], PE: [6], CE: [7], PA: [8], AP: [8],
    PR: [9], DF: [10], TO: [10], AM: [11], RR: [11], SC: [12], PB: [13], RO: [14], AC: [14],
    MA: [16], ES: [17], GO: [18], AL: [19], SE: [20], RN: [21], PI: [22], MT: [23], MS: [24]
  };
  const TRF = {
    RJ: 2, ES: 2, SP: 3, MS: 3, RS: 4, SC: 4, PR: 4, PE: 5, CE: 5, AL: 5, SE: 5, RN: 5, PB: 5, MG: 6
  };

  function E(uf, nome, regiao, capital, links) {
    const u = uf.toLowerCase();
    const l = Object.assign({
      tj: 'https://www.tj' + u + '.jus.br',
      mp: 'https://www.mp' + u + '.mp.br',
      tre: 'https://www.tre-' + u + '.jus.br'
    }, links);
    const trts = (TRT[uf] || []).map(n => 'https://www.trt' + n + '.jus.br');
    return { uf, nome, regiao, capital, links: l, trts, trf: TRF[uf] || 1 };
  }

  const estados = [
    E('AC', 'Acre', 'Norte', 'Rio Branco', {
      gov: 'https://www.ac.gov.br', doe: 'https://www.diario.ac.gov.br', tce: 'https://www.tce.ac.gov.br', al: 'https://www.al.ac.leg.br'
    }),
    E('AL', 'Alagoas', 'Nordeste', 'Maceió', {
      gov: 'https://www.alagoas.al.gov.br', pm: 'https://www.pm.al.gov.br', pc: 'https://www.pc.al.gov.br',
      sefaz: 'https://www.sefaz.al.gov.br', tce: 'https://tce.al.gov.br', al: 'https://www.al.al.leg.br'
    }),
    E('AP', 'Amapá', 'Norte', 'Macapá', {
      gov: 'https://www.portal.ap.gov.br', sefaz: 'https://www.sefaz.ap.gov.br', tce: 'https://www.tce.ap.gov.br', al: 'https://www.al.ap.gov.br'
    }),
    E('AM', 'Amazonas', 'Norte', 'Manaus', {
      gov: 'https://www.amazonas.am.gov.br', doe: 'https://diario.imprensaoficial.am.gov.br', pc: 'https://www.policiacivil.am.gov.br',
      sefaz: 'https://www.sefaz.am.gov.br', tce: 'https://www.tceam.tc.br', al: 'https://www.aleam.gov.br'
    }),
    E('BA', 'Bahia', 'Nordeste', 'Salvador', {
      gov: 'https://www.ba.gov.br', doe: 'https://dool.egba.ba.gov.br', pm: 'https://www.pm.ba.gov.br', pc: 'https://www.ba.gov.br/policiacivil/',
      cbm: 'https://www.cbm.ba.gov.br', sefaz: 'https://www.sefaz.ba.gov.br', tce: 'https://www.tce.ba.gov.br', al: 'https://www.al.ba.gov.br',
      dpe: 'https://www.defensoria.ba.def.br'
    }),
    E('CE', 'Ceará', 'Nordeste', 'Fortaleza', {
      gov: 'https://www.ceara.gov.br', doe: 'https://www.ceara.gov.br/diario-oficial/', pm: 'https://www.pm.ce.gov.br',
      pc: 'https://www.policiacivil.ce.gov.br', cbm: 'https://www.bombeiros.ce.gov.br', sefaz: 'https://www.sefaz.ce.gov.br',
      tce: 'https://www.tce.ce.gov.br', al: 'https://www.al.ce.gov.br', dpe: 'https://www.defensoria.ce.def.br'
    }),
    E('DF', 'Distrito Federal', 'Centro-Oeste', 'Brasília', {
      gov: 'https://www.df.gov.br', doe: 'https://www.dodf.df.gov.br', pm: 'https://pmdf.df.gov.br', pc: 'https://www.pcdf.df.gov.br',
      cbm: 'https://www.cbm.df.gov.br', sefaz: 'https://www.economia.df.gov.br', tce: 'https://www.tc.df.gov.br',
      al: 'https://www.cl.df.gov.br', dpe: 'https://www.defensoria.df.gov.br',
      tj: 'https://www.tjdft.jus.br', mp: 'https://www.mpdft.mp.br'
    }),
    E('ES', 'Espírito Santo', 'Sudeste', 'Vitória', {
      gov: 'https://www.es.gov.br', doe: 'https://ioes.dio.es.gov.br', pm: 'https://pm.es.gov.br', pc: 'https://pc.es.gov.br',
      cbm: 'https://cb.es.gov.br', sefaz: 'https://sefaz.es.gov.br', tce: 'https://www.tcees.tc.br', al: 'https://www.al.es.gov.br',
      dpe: 'https://www.defensoria.es.def.br'
    }),
    E('GO', 'Goiás', 'Centro-Oeste', 'Goiânia', {
      gov: 'https://www.goias.gov.br', doe: 'https://diariooficial.abc.go.gov.br', pm: 'https://goias.gov.br/policiamilitar/',
      pc: 'https://goias.gov.br/policiacivil/', cbm: 'https://www.bombeiros.go.gov.br', sefaz: 'https://goias.gov.br/economia/',
      tce: 'https://portal.tce.go.gov.br', al: 'https://portal.al.go.leg.br'
    }),
    E('MA', 'Maranhão', 'Nordeste', 'São Luís', {
      gov: 'https://www.ma.gov.br', pm: 'https://www.pm.ma.gov.br', sefaz: 'https://www.sefaz.ma.gov.br', al: 'https://www.al.ma.leg.br'
    }),
    E('MT', 'Mato Grosso', 'Centro-Oeste', 'Cuiabá', {
      gov: 'https://portal.mt.gov.br', doe: 'https://www.iomat.mt.gov.br', pc: 'https://www.pjc.mt.gov.br',
      sefaz: 'https://www.sefaz.mt.gov.br', tce: 'https://www.tce.mt.gov.br', al: 'https://www.al.mt.gov.br'
    }),
    E('MS', 'Mato Grosso do Sul', 'Centro-Oeste', 'Campo Grande', {
      gov: 'https://www.ms.gov.br', doe: 'https://www.diariooficial.ms.gov.br', pm: 'https://www.pm.ms.gov.br', pc: 'https://www.pc.ms.gov.br',
      cbm: 'https://www.bombeiros.ms.gov.br', sefaz: 'https://www.sefaz.ms.gov.br', tce: 'https://www.tce.ms.gov.br', al: 'https://www.al.ms.gov.br'
    }),
    E('MG', 'Minas Gerais', 'Sudeste', 'Belo Horizonte', {
      gov: 'https://www.mg.gov.br', doe: 'https://www.jornalminasgerais.mg.gov.br', pm: 'https://www.policiamilitar.mg.gov.br',
      pc: 'https://www.policiacivil.mg.gov.br', cbm: 'https://www.bombeiros.mg.gov.br', sefaz: 'https://www.fazenda.mg.gov.br',
      tce: 'https://www.tce.mg.gov.br', al: 'https://www.almg.gov.br', dpe: 'https://defensoria.mg.def.br'
    }),
    E('PA', 'Pará', 'Norte', 'Belém', {
      gov: 'https://www.pa.gov.br', doe: 'https://www.ioepa.com.br', pm: 'https://www.pm.pa.gov.br',
      cbm: 'https://www.bombeiros.pa.gov.br', sefaz: 'https://www.sefa.pa.gov.br', tce: 'https://www.tcepa.tc.br', al: 'https://www.alepa.pa.gov.br'
    }),
    E('PB', 'Paraíba', 'Nordeste', 'João Pessoa', {
      gov: 'https://paraiba.pb.gov.br', doe: 'https://auniao.pb.gov.br', pm: 'https://www.pm.pb.gov.br',
      sefaz: 'https://www.sefaz.pb.gov.br', tce: 'https://tce.pb.gov.br', al: 'https://www.al.pb.leg.br'
    }),
    E('PR', 'Paraná', 'Sul', 'Curitiba', {
      gov: 'https://www.parana.pr.gov.br', doe: 'https://documentos.dioe.pr.gov.br', pm: 'https://www.pmpr.pr.gov.br',
      pc: 'https://www.policiacivil.pr.gov.br', cbm: 'https://www.bombeiros.pr.gov.br', sefaz: 'https://www.fazenda.pr.gov.br',
      tce: 'https://www1.tce.pr.gov.br', al: 'https://www.assembleia.pr.leg.br', dpe: 'https://www.defensoriapublica.pr.def.br'
    }),
    E('PE', 'Pernambuco', 'Nordeste', 'Recife', {
      gov: 'https://www.pe.gov.br', doe: 'https://diariooficial.cepe.com.br', pm: 'https://www.pm.pe.gov.br',
      pc: 'https://www.policiacivil.pe.gov.br', cbm: 'https://www.bombeiros.pe.gov.br', sefaz: 'https://www.sefaz.pe.gov.br',
      tce: 'https://www.tce.pe.gov.br', al: 'https://www.alepe.pe.gov.br', dpe: 'https://www.defensoria.pe.def.br'
    }),
    E('PI', 'Piauí', 'Nordeste', 'Teresina', {
      gov: 'https://www.pi.gov.br', doe: 'https://www.diario.pi.gov.br', pm: 'https://www.pm.pi.gov.br',
      pc: 'https://www.policiacivil.pi.gov.br', sefaz: 'https://portal.sefaz.pi.gov.br', tce: 'https://www.tcepi.tc.br', al: 'https://www.al.pi.leg.br'
    }),
    E('RJ', 'Rio de Janeiro', 'Sudeste', 'Rio de Janeiro', {
      gov: 'https://www.rj.gov.br', doe: 'https://www.ioerj.com.br', pm: 'https://www.pmerj.rj.gov.br',
      pc: 'https://www.policiacivil.rj.gov.br', cbm: 'https://www.cbmerj.rj.gov.br', sefaz: 'https://www.fazenda.rj.gov.br',
      tce: 'https://www.tcerj.tc.br', al: 'https://www.alerj.rj.gov.br', dpe: 'https://defensoria.rj.def.br'
    }),
    E('RN', 'Rio Grande do Norte', 'Nordeste', 'Natal', {
      gov: 'https://www.rn.gov.br', doe: 'http://diariooficial.rn.gov.br', pm: 'https://www.pm.rn.gov.br',
      pc: 'https://www.policiacivil.rn.gov.br', sefaz: 'https://www.set.rn.gov.br', tce: 'https://www.tce.rn.gov.br', al: 'https://www.al.rn.leg.br'
    }),
    E('RS', 'Rio Grande do Sul', 'Sul', 'Porto Alegre', {
      gov: 'https://www.estado.rs.gov.br', doe: 'https://www.diariooficial.rs.gov.br', pm: 'https://www.brigadamilitar.rs.gov.br',
      pc: 'https://www.pc.rs.gov.br', cbm: 'https://www.bombeiros.rs.gov.br', sefaz: 'https://fazenda.rs.gov.br',
      tce: 'https://tcers.tc.br', al: 'https://www.al.rs.gov.br', dpe: 'https://www.defensoria.rs.def.br'
    }),
    E('RO', 'Rondônia', 'Norte', 'Porto Velho', {
      gov: 'https://rondonia.ro.gov.br', doe: 'https://diof.ro.gov.br', pm: 'https://www.pm.ro.gov.br',
      sefaz: 'https://www.sefin.ro.gov.br', tce: 'https://www.tce.ro.gov.br', al: 'https://www.al.ro.leg.br'
    }),
    E('RR', 'Roraima', 'Norte', 'Boa Vista', {
      gov: 'https://portal.rr.gov.br', doe: 'https://www.imprensaoficial.rr.gov.br', pm: 'https://www.pm.rr.gov.br',
      sefaz: 'https://www.sefaz.rr.gov.br', tce: 'https://www.tcerr.tc.br', al: 'https://al.rr.leg.br'
    }),
    E('SC', 'Santa Catarina', 'Sul', 'Florianópolis', {
      gov: 'https://www.sc.gov.br', doe: 'https://doe.sea.sc.gov.br', pm: 'https://www.pm.sc.gov.br', pc: 'https://www.pc.sc.gov.br',
      cbm: 'https://www.cbm.sc.gov.br', sefaz: 'https://www.sef.sc.gov.br', tce: 'https://www.tcesc.tc.br', al: 'https://www.alesc.sc.gov.br',
      dpe: 'https://www.defensoria.sc.def.br'
    }),
    E('SP', 'São Paulo', 'Sudeste', 'São Paulo', {
      gov: 'https://www.sp.gov.br', doe: 'https://www.doe.sp.gov.br', pm: 'https://www.policiamilitar.sp.gov.br',
      pc: 'https://www.policiacivil.sp.gov.br', cbm: 'https://www.corpodebombeiros.sp.gov.br', sefaz: 'https://www.sfp.sp.gov.br/sefaz',
      tce: 'https://www.tce.sp.gov.br', al: 'https://www.al.sp.gov.br', dpe: 'https://www.defensoria.sp.def.br'
    }),
    E('SE', 'Sergipe', 'Nordeste', 'Aracaju', {
      gov: 'https://www.se.gov.br', sefaz: 'https://www.sefaz.se.gov.br', tce: 'https://www.tce.se.gov.br', al: 'https://al.se.leg.br'
    }),
    E('TO', 'Tocantins', 'Norte', 'Palmas', {
      gov: 'https://www.to.gov.br', doe: 'https://diariooficial.to.gov.br', pm: 'https://www.pm.to.gov.br',
      sefaz: 'https://www.sefaz.to.gov.br', tce: 'https://www.tceto.tc.br', al: 'https://www.al.to.leg.br'
    })
  ];

  // Observações exibidas no card de alguns órgãos estaduais.
  const notas = {
    'RS.pm': 'No Rio Grande do Sul, a Polícia Militar se chama Brigada Militar.',
    'MT.pc': 'Em Mato Grosso, a Polícia Civil se chama Polícia Judiciária Civil (PJC).',
    'DF.al': 'No DF, o legislativo é a Câmara Legislativa (CLDF).',
    'DF.tce': 'Tribunal de Contas do Distrito Federal (TCDF).',
    'DF.sefaz': 'Secretaria de Economia do DF (auditor fiscal da Receita do DF).',
    'GO.sefaz': 'Secretaria da Economia de Goiás.',
    'SP.sefaz': 'Secretaria da Fazenda e Planejamento de São Paulo.',
    'PA.sefaz': 'Secretaria da Fazenda do Pará (SEFA).',
    'RN.sefaz': 'Secretaria de Tributação / Fazenda do Rio Grande do Norte.',
    'RO.sefaz': 'Secretaria de Finanças de Rondônia (SEFIN).',
    'PB.doe': 'O Diário Oficial da Paraíba é publicado pelo jornal A União.',
    'MG.doe': 'Diário Oficial de Minas Gerais ("Minas Gerais").'
  };

  root.ATLAS_DATA = { categorias, estados, tipos: TIPOS, notas };
})(typeof window !== 'undefined' ? window : globalThis);
