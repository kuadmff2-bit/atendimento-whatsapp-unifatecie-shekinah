const iaBase = require("./ia-groq");
const SHEKINAH_INFO = require("./shekinah-info");

function enriquecerConfig(config = {}) {
  const shekinah = config.shekinah || {};
  const cursosAtuais = String(shekinah.cursos || "");

  return {
    ...config,
    shekinah: {
      ...shekinah,
      cursos: `${cursosAtuais}\n\n${SHEKINAH_INFO.textoIA}`.trim(),
    },
  };
}

async function tentarResponderComIA(args = {}) {
  return iaBase.tentarResponderComIA({
    ...args,
    config: enriquecerConfig(args.config),
  });
}

module.exports = {
  iaDisponivel: iaBase.iaDisponivel,
  tentarResponderComIA,
};
