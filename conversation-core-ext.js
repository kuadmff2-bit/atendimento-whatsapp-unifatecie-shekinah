const base = require("./conversation-core");

function ajustarTratamento(mensagem = "") {
  let texto = String(mensagem);

  texto = texto
    .replace(
      "👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊",
      "👥 Claro! Você quer falar com o secretário da *UniFatecie* ou com a secretária da *Shekinah*? 😊"
    )
    .replace(
      "✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼",
      "✅ Pronto! Seu atendimento foi encaminhado para o secretário da UniFatecie. 👨‍💼"
    )
    .replace(/para a secretaria da UniFatecie/g, "para o secretário da UniFatecie")
    .replace(/com a secretaria da UniFatecie/g, "com o secretário da UniFatecie");

  return texto;
}

async function tentarConversaNatural(args = {}) {
  const responderOriginal = args.responder;

  return base.tentarConversaNatural({
    ...args,
    responder: async (client, destino, mensagem) =>
      responderOriginal(client, destino, ajustarTratamento(mensagem)),
  });
}

module.exports = { tentarConversaNatural, ajustarTratamento };
