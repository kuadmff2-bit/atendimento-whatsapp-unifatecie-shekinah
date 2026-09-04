const iaBase = require("./ia-groq");
const SHEKINAH_INFO = require("./shekinah-info");

function enriquecerConfig(config = {}) {
  const shekinah = config.shekinah || {};
  const cursosAtuais = String(shekinah.cursos || "");
  const papeis = [
    "PAPÉIS DO ATENDIMENTO HUMANO",
    "- UniFatecie Polo Barreirinha: o responsável humano é homem. Use sempre 'o secretário da UniFatecie' ou 'o atendente da UniFatecie'. Nunca diga 'a secretária da UniFatecie'.",
    "- Centro Educacional Shekinah: a responsável humana é mulher. Use 'a secretária da Shekinah'.",
  ].join("\n");

  const modalidadeUnifatecie = [
    "REGRA ABSOLUTA SOBRE A MODALIDADE DA UNIFATECIE — POLO BARREIRINHA",
    "- As aulas dos cursos EAD atendidos pelo Polo de Barreirinha são 100% online pelo portal da UniFatecie.",
    "- Quando perguntarem se as aulas são online, responda claramente que SIM: as aulas são 100% online e acessadas pelo portal da UniFatecie.",
    "- NÃO acrescente por conta própria que provas, aulas, encontros ou atividades de extensão são presenciais.",
    "- Se perguntarem especificamente sobre provas, estágio, extensão ou outra atividade, responda apenas com informação confirmada na base do atendimento; se não estiver confirmada, diga que o secretário da UniFatecie pode verificar.",
    "- Nunca transforme a resposta 'as aulas são 100% online' em uma afirmação contraditória sobre aulas presenciais.",
  ].join("\n");

  return {
    ...config,
    shekinah: {
      ...shekinah,
      cursos: `${cursosAtuais}\n\n${SHEKINAH_INFO.textoIA}\n\n${papeis}\n\n${modalidadeUnifatecie}`.trim(),
    },
  };
}

function ajustarGeneroResposta(resposta = "") {
  return String(resposta)
    .replace(/a secretária da UniFatecie/gi, "o secretário da UniFatecie")
    .replace(/a secretaria da UniFatecie/gi, "o secretário da UniFatecie")
    .replace(/para a secretária da UniFatecie/gi, "para o secretário da UniFatecie")
    .replace(/para a secretaria da UniFatecie/gi, "para o secretário da UniFatecie");
}

async function tentarResponderComIA(args = {}) {
  const resposta = await iaBase.tentarResponderComIA({
    ...args,
    config: enriquecerConfig(args.config),
  });

  return resposta ? ajustarGeneroResposta(resposta) : resposta;
}

module.exports = {
  iaDisponivel: iaBase.iaDisponivel,
  tentarResponderComIA,
};
