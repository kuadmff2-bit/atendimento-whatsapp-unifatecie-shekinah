const Module = require("module");
const originalLoad = Module._load;

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function minutosInatividadeHumana() {
  const valor = Number(process.env.HUMAN_HANDOFF_IDLE_MINUTES || 30);
  return Number.isFinite(valor) && valor >= 5 ? Math.round(valor) : 30;
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
  const candidatos = [msg?.sender?.id?.user, msg?.from, msg?.author, msg?.chatId];
  for (const valor of candidatos) {
    const texto = String(valor || "").trim();
    if (texto) return texto.replace(/@c\.us$|@lid$/i, "");
  }
  return "não identificado";
}

function pediuEncerrarSuporte(texto = "") {
  const t = norm(texto);
  if (!t) return false;

  // Evita interpretar a negação literal como pedido de encerramento.
  if (/\bnao quero (encerrar|finalizar|parar|sair)\b/.test(t)) return false;

  if (/^(encerrar|encerrar atendimento|finalizar|finalizar atendimento|parar|parar atendimento|sair|sair do atendimento|fim)$/.test(t)) return true;
  if (/\b(quero|pode|pode sim|favor|por favor)\b.*\b(encerrar|finalizar|parar|sair)\b/.test(t)) return true;
  if (/\b(encerrar|finalizar)\b.*\batendimento\b/.test(t)) return true;
  if (/\bnao quero mais\b/.test(t)) return true;
  return false;
}

function resetarSuporte(sessao = {}) {
  Object.assign(sessao, {
    etapa: "escolher_instituicao",
    instituicao: null,
    atendimentoHumano: false,
    assuntoAtual: null,
    acaoPendente: null,
    curso: "",
    cursoAtual: null,
    modalidadeShekinah: null,
    eadCursoAtual: null,
    eadUltimaLista: null,
    eadPagina: 0,
    historicoIA: [],
    pausaHumanaIniciadaEm: null,
    ultimaMensagemHumanoEm: null,
    atualizadoEm: Date.now()
  });
}

function pareceDadosFinanceiros(texto = "") {
  const bruto = String(texto || "").trim();
  if (!bruto) return false;

  const grupos = bruto.match(/\d[\d.\-\/\s,]{2,}\d/g) || [];
  const comprimentos = grupos.map(g => g.replace(/\D/g, "").length);
  const temCpf = comprimentos.some(n => n === 11);
  const temRa = comprimentos.some(n => n >= 5 && n <= 10);
  const temValor = /\b\d{1,5}\s*[,.]\s*\d{2}\b/.test(bruto);
  const t = norm(bruto);
  const citouCampos = /\b(ra|cpf|valor|paguei|pagamento|mensalidade)\b/.test(t);

  return temCpf || (temRa && temValor) || (temRa && citouCampos);
}

async function notificarAtendente(client, msg, textoOriginal) {
  const destino = destinoAdmin();
  if (!destino || typeof client?.sendText !== "function") return false;

  const aviso = [
    "🔔 *SUPORTE FINANCEIRO — UNIFATECIE*",
    "",
    `👤 Contato: ${nomeContato(msg)}`,
    `📱 Identificador: ${identificadorContato(msg)}`,
    "⚠️ Problema: aluno informa que já pagou a mensalidade, mas ela continua aparecendo em aberto.",
    "",
    "📋 *Informações enviadas pelo aluno:*",
    String(textoOriginal || "").trim().slice(0, 1200),
    "",
    "O Light pausou esta conversa para o atendente conferir e resolver manualmente."
  ].join("\n");

  try {
    await client.sendText(destino, aviso);
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível encaminhar o suporte financeiro ao atendente:", error?.message || error);
    return false;
  }
}

function ativarAtendimentoHumano(sessao = {}) {
  const agora = Date.now();
  sessao.instituicao = "unifatecie";
  sessao.atendimentoHumano = true;
  sessao.etapa = "atendimento_humano";
  sessao.assuntoAtual = "atendimento_humano_suporte_financeiro";
  sessao.pausaHumanaIniciadaEm = agora;
  sessao.ultimaMensagemHumanoEm = agora;
  sessao.atualizadoEm = agora;
}

async function tentarEncaminharSuporte(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;
  if (sessao.assuntoAtual !== "suporte_pagamento_unifatecie") return false;

  // Comando de saída tem prioridade absoluta sobre a coleta de dados.
  if (pediuEncerrarSuporte(textoOriginal)) {
    resetarSuporte(sessao);
    await responder(
      client,
      msg.from,
      "✅ *Atendimento encerrado.* Não precisa enviar mais nenhum dado. Se precisar de outra coisa depois, é só me chamar. 😊"
    );
    return true;
  }

  if (!pareceDadosFinanceiros(textoOriginal)) {
    await responder(
      client,
      msg.from,
      "Pode me enviar as informações que você tiver: *RA, CPF, data aproximada do pagamento e valor pago*. Se não souber a data exata, tudo bem. Assim que você mandar os dados, eu passo as informações para o atendente conferir e resolver. 👨‍💼\n\nSe não quiser continuar, é só dizer *encerrar atendimento*."
    );
    return true;
  }

  const notificou = await notificarAtendente(client, msg, textoOriginal);
  ativarAtendimentoHumano(sessao);
  const minutos = minutosInatividadeHumana();

  await responder(
    client,
    msg.from,
    notificou
      ? `✅ Recebi as informações e *já passei tudo para o atendente da UniFatecie* conferir e resolver seu problema. 👨‍💼\n\nO Light vai ficar em silêncio enquanto o atendente cuida disso e volta automaticamente depois de *${minutos} minutos sem novas mensagens*.`
      : `✅ Recebi suas informações e deixei a conversa em *atendimento humano* para conferência. 👨‍💼\n\nO Light vai ficar em silêncio enquanto o atendente cuida disso e volta automaticamente depois de *${minutos} minutos sem novas mensagens*.`
  );
  return true;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__supportHandoffGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarEncaminharSuporte(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__supportHandoffGuard", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(pareceDadosFinanceiros("278732, 07792688224, eu não sei o dia exato, paguei 112, 20"), true);
  assert.equal(pareceDadosFinanceiros("não sei a data exata"), false);
  assert.equal(pareceDadosFinanceiros("meu RA é 278732 e paguei 112,20"), true);
  assert.equal(pediuEncerrarSuporte("Encerrar"), true);
  assert.equal(pediuEncerrarSuporte("Encerrar atendimento"), true);
  assert.equal(pediuEncerrarSuporte("Em encerrar atendimento, não quero mais"), true);
  assert.equal(pediuEncerrarSuporte("não quero encerrar"), false);
  console.log("✅ Self-test do encaminhamento financeiro aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { pareceDadosFinanceiros, pediuEncerrarSuporte, tentarEncaminharSuporte };
