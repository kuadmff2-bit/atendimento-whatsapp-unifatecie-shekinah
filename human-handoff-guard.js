const Module = require("module");
const originalLoad = Module._load;

function norm(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function minutosInatividadeHumana() {
  const valor = Number(process.env.HUMAN_HANDOFF_IDLE_MINUTES || 30);
  return Number.isFinite(valor) && valor >= 5 ? Math.round(valor) : 30;
}

function pediuHumanoUniFatecie(texto = "", sessao = {}) {
  const t = norm(texto);
  if (!t) return false;

  const mencionaSecretario = /\bsecretario\b/.test(t);
  const mencionaAtendenteHumano = /\b(atendente|humano|pessoa)\b/.test(t);
  const pedeContato = /\b(falar|conversar|chamar|chame|encaminhar|encaminha|quero falar|quero conversar)\b/.test(t);
  const mencionaUniFatecie = /\b(unifatecie|fatecie|faculdade)\b/.test(t);

  if (mencionaSecretario && (pedeContato || /^secretario$/.test(t))) return true;
  if (mencionaUniFatecie && mencionaAtendenteHumano && pedeContato) return true;
  if (sessao?.instituicao === "unifatecie" && mencionaAtendenteHumano && pedeContato) return true;
  return false;
}

function destinoAdmin() {
  const numero = String(process.env.BOT_ADMIN_PHONE || "").replace(/\D/g, "");
  return numero ? `${numero}@c.us` : "";
}

function nomeContato(msg = {}) {
  return String(
    msg?.sender?.pushname ||
    msg?.sender?.formattedName ||
    msg?.sender?.name ||
    "Contato sem nome"
  ).trim();
}

function identificadorContato(msg = {}) {
  const candidatos = [
    msg?.sender?.id?.user,
    msg?.from,
    msg?.author,
    msg?.chatId,
  ];
  for (const valor of candidatos) {
    const texto = String(valor || "").trim();
    if (texto) return texto.replace(/@c\.us$|@lid$/i, "");
  }
  return "não identificado";
}

async function notificarAdmin(client, msg, textoOriginal) {
  const destino = destinoAdmin();
  if (!destino || typeof client?.sendText !== "function") return false;

  const minutos = minutosInatividadeHumana();
  const aviso = [
    "🔔 *ATENDIMENTO HUMANO — UNIFATECIE*",
    "",
    `👤 Contato: ${nomeContato(msg)}`,
    `📱 Identificador: ${identificadorContato(msg)}`,
    `💬 Pedido: ${String(textoOriginal || "").trim().slice(0, 500)}`,
    "",
    "O Light foi pausado nesta conversa. Responda manualmente pelo WhatsApp do atendimento.",
    `Se a conversa ficar *${minutos} minutos sem receber novas mensagens*, o Light volta automaticamente no próximo contato.`,
    "Também é possível reativar antes com *m*, *menu* ou *retomar bot*.",
  ].join("\n");

  try {
    await client.sendText(destino, aviso);
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível notificar BOT_ADMIN_PHONE:", error?.message || error);
    return false;
  }
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp &&
    typeof exp.tentarCorrecoesAtendimento === "function" &&
    !exp.__humanHandoffGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;

    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      const { client, msg, textoOriginal, sessao, responder } = args;

      if (
        sessao &&
        msg &&
        typeof responder === "function" &&
        pediuHumanoUniFatecie(textoOriginal, sessao)
      ) {
        const agora = Date.now();
        const minutos = minutosInatividadeHumana();
        sessao.instituicao = "unifatecie";
        sessao.atendimentoHumano = true;
        sessao.etapa = "atendimento_humano";
        sessao.assuntoAtual = "atendimento_humano_solicitado";
        sessao.pausaHumanaIniciadaEm = agora;
        sessao.ultimaMensagemHumanoEm = agora;
        sessao.atualizadoEm = agora;

        const notificou = await notificarAdmin(client, msg, textoOriginal);

        await responder(
          client,
          msg.from,
          notificou
            ? `👨‍💼 Certo. *Avisei o secretário da UniFatecie* e pausei o Light nesta conversa. O robô fica em silêncio enquanto vocês conversam e volta automaticamente depois de *${minutos} minutos sem novas mensagens*.`
            : `👨‍💼 Certo. Pausei o Light para o secretário assumir. Ele volta automaticamente depois de *${minutos} minutos sem novas mensagens*.`
        );
        return true;
      }

      return original(args);
    };

    Object.defineProperty(exp, "__humanHandoffGuard", { value: true });
  }

  return exp;
};

module.exports = { pediuHumanoUniFatecie, notificarAdmin, minutosInatividadeHumana };
