/*
 * Regras do Radar de Editais, usadas pelo robô (Node) e pelo site (navegador):
 * decidem se um link é mesmo de concurso, se o prazo já venceu e de qual estado é.
 */
(function (root) {
  'use strict';
  const MESES = { janeiro: 1, fevereiro: 2, marco: 3, 'março': 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const NOT_CONCURSO = /(est[aá]gio|estagi[aá]ri|pr[eê]mio|award|bolsa de|bolsas|curso de|cursos|evento|semin[aá]rio|workshop|hackathon|vestibular|olimp[ií]ada|fomento|mentoria|webin[aá]rio|encontro|congresso|f[oó]rum|palestra|capacita[cç][aã]o|oficina|live\b|vagas limitadas)/i;
  const CONCURSO_CTX = /(concurso|processo seletivo|sele[cç][aã]o|edital|vagas|cargo|cadastro reserva)/i;
  const GENERIC = /^\s*(inscri[cç][oõ]es abertas|abertas|concursos abertos|inscri[cç][oõ]es)\s*$/i;

  // Datas citadas no trecho sobre inscrição (antes de "prova", "aplicação" ou "resultado").
  function inscricaoDates(text, now) {
    const year = (now || new Date()).getFullYear();
    const part = String(text).split(/prova|aplica[cç][aã]o|resultado|gabarito/i)[0];
    const out = [];
    part.replace(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g, (_, d, m, y) => { y = +y < 100 ? 2000 + +y : +y; out.push(new Date(y, +m - 1, +d)); return _; });
    part.replace(/(\d{1,2})(?:º)?\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/gi, (_, d, mes, y) => {
      const m = MESES[mes.toLowerCase()];
      if (m) out.push(new Date(y ? +y : year, m - 1, +d));
      return _;
    });
    return out.filter((d) => !isNaN(d));
  }
  // Prazo vencido: a data mais distante citada para a inscrição já passou.
  function expired(text, now) {
    const today = now ? new Date(now) : new Date();
    today.setHours(0, 0, 0, 0);
    const ds = inscricaoDates(text, today);
    if (!ds.length) return false;
    return Math.max.apply(null, ds.map(Number)) < +today;
  }
  // Link de concurso? Bancas sempre publicam concursos; nos outros sites o texto precisa citar concurso/seleção/edital.
  function isConcurso(text, fromBanca) {
    if (NOT_CONCURSO.test(text)) return false;
    return fromBanca || CONCURSO_CTX.test(text);
  }
  // Estado citado no texto: "Itatiba / SP", "JACUTINGA/RS", "Porto Alegre - RS".
  function ufFromText(text) {
    const m = String(text).match(/(?:\/|\s[-–]\s?)\s?([A-Z]{2})\b/g) || [];
    for (const raw of m) { const uf = raw.replace(/[^A-Z]/g, ''); if (UFS.includes(uf)) return uf; }
    return '';
  }
  const isGeneric = (text) => GENERIC.test(String(text).trim());
  const clean = (text) => String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const hasContext = (text) => CONCURSO_CTX.test(text);

  root.ATLAS_RADAR_RULES = { expired, isConcurso, ufFromText, isGeneric, inscricaoDates, clean, hasContext };
  if (typeof module !== 'undefined') module.exports = root.ATLAS_RADAR_RULES;
})(typeof window !== 'undefined' ? window : globalThis);
