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

  return {
    ...config,
    shekinah: {
      ...shekinah,
      cursos: `${cursosAtuais}\n\n${SHEKINAH_INFO.textoIA}\n\n${papeis}`.trim(),
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
