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
  if (/\bnao quero (encerrar|finalizar|parar|sair)\b/.test(t)) return false;
  if (/^(encerrar|encerrar atendimento|finalizar|finalizar atendimento|parar|parar atendimento|sair|sair do atendimento|fim)$/.test(t)) return true;
  if (/\b(quero|pode|favor|por favor)\b.*\b(encerrar|finalizar|parar|sair)\b/.test(t)) return true;
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
    problemaSuporteOriginal: null,
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

function gruposNumericos(texto = "") {
  return String(texto || "").match(/\d[\d.\-\/\s,]{2,}\d/g) || [];
}

function pareceDadosFinanceiros(texto = "") {
  const bruto = String(texto || "").trim();
  if (!bruto) return false;
  const comprimentos = gruposNumericos(bruto).map(g => g.replace(/\D/g, "").length);
  const temCpf = comprimentos.some(n => n === 11);
  const temRa = comprimentos.some(n => n >= 5 && n <= 10);
  const temValor = /\b\d{1,5}\s*[,.]\s*\d{2}\b/.test(bruto);
  const t = norm(bruto);
  const citouCampos = /\b(ra|cpf|valor|paguei|pagamento|mensalidade)\b/.test(t);
  return temCpf || (temRa && temValor) || (temRa && citouCampos);
}

function pareceIdentificacaoAluno(texto = "") {
  const bruto = String(texto || "").trim();
  if (!bruto) return false;
  const comprimentos = gruposNumericos(bruto).map(g => g.replace(/\D/g, "").length);
  const temCpf = comprimentos.some(n => n === 11);
  const temRa = comprimentos.some(n => n >= 5 && n <= 10);
  const t = norm(bruto);
  const informouNome = /\b(meu nome|nome completo|sou|me chamo)\b/.test(t) && t.length >= 8;
  return temCpf || (temRa && informouNome);
}

function problemaDeAcesso(texto = "") {
  const t = norm(texto);
  return /\b(perdi|esqueci|nao lembro|nao sei|recuperar|recuperacao|sem acesso|nao consigo entrar)\b.*\b(ra|senha|login|acesso)\b/.test(t)
    || /\b(ra|senha|login|acesso)\b.*\b(perdi|esqueci|nao lembro|nao sei|recuperar|bloquead|nao consigo)\b/.test(t);
}

function removerSenhaDeclarada(texto = "") {
  return String(texto || "")
    .replace(/\b(senha)\s*[:=]\s*[^\s,;]+/gi, "$1: [REMOVIDA]")
    .replace(/\b(minha senha e|minha senha é)\s+[^\s,;]+/gi, "minha senha: [REMOVIDA]");
}

async function notificarAtendente(client, msg, problema, informacoes, titulo = "SUPORTE — UNIFATECIE") {
  const destino = destinoAdmin();
  if (!destino || typeof client?.sendText !== "function") return false;

  const aviso = [
    `🔔 *${titulo}*`,
    "",
    `👤 Contato: ${nomeContato(msg)}`,
    `📱 Identificador: ${identificadorContato(msg)}`,
    `⚠️ Problema: ${removerSenhaDeclarada(problema || "Problema no portal da UniFatecie").slice(0, 700)}`,
    "",
    "📋 *Informações enviadas pelo aluno:*",
    removerSenhaDeclarada(informacoes || "").slice(0, 1200),
    "",
    "O Light pausou esta conversa para o atendente conferir e resolver manualmente."
  ].join("\n");

  try {
    await client.sendText(destino, aviso);
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível encaminhar o suporte ao atendente:", error?.message || error);
    return false;
  }
}

function ativarAtendimentoHumano(sessao = {}, assunto = "atendimento_humano_suporte") {
  const agora = Date.now();
  sessao.instituicao = "unifatecie";
  sessao.atendimentoHumano = true;
  sessao.etapa = "atendimento_humano";
  sessao.assuntoAtual = assunto;
  sessao.pausaHumanaIniciadaEm = agora;
  sessao.ultimaMensagemHumanoEm = agora;
  sessao.atualizadoEm = agora;
}

async function concluirEncaminhamento({ client, msg, sessao, responder, problema, informacoes, titulo, assuntoHumano }) {
  const notificou = await notificarAtendente(client, msg, problema, informacoes, titulo);
  ativarAtendimentoHumano(sessao, assuntoHumano);
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

async function tentarEncaminharSuporte(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;

  const assunto = String(sessao.assuntoAtual || "");
  const emSuporte = assunto === "suporte_portal_unifatecie" ||
    assunto === "suporte_pagamento_unifatecie" ||
    assunto === "suporte_identificacao_unifatecie";
  if (!emSuporte) return false;

  if (pediuEncerrarSuporte(textoOriginal)) {
    resetarSuporte(sessao);
    await responder(
      client,
      msg.from,
      "✅ *Atendimento encerrado.* Não precisa enviar mais nenhum dado. Se precisar de outra coisa depois, é só me chamar. 😊"
    );
    return true;
  }

  // Pagamento ja feito e ainda aberto.
  if (assunto === "suporte_pagamento_unifatecie") {
    if (!pareceDadosFinanceiros(textoOriginal)) {
      await responder(
        client,
        msg.from,
        "Pode me enviar as informações que você tiver: *RA, CPF, data aproximada do pagamento e valor pago*. Se não souber a data exata, tudo bem. Assim que você mandar os dados, eu passo tudo para o atendente conferir e resolver. 👨‍💼\n\nSe não quiser continuar, diga *encerrar atendimento*."
      );
      return true;
    }

    return concluirEncaminhamento({
      client,
      msg,
      sessao,
      responder,
      problema: "Aluno informa que já pagou a mensalidade, mas ela continua aparecendo em aberto.",
      informacoes: textoOriginal,
      titulo: "SUPORTE FINANCEIRO — UNIFATECIE",
      assuntoHumano: "atendimento_humano_suporte_financeiro"
    });
  }

  // A conversa ja esta aguardando identificacao para um problema de portal.
  if (assunto === "suporte_identificacao_unifatecie") {
    if (!pareceIdentificacaoAluno(textoOriginal)) {
      await responder(
        client,
        msg.from,
        "Para eu passar seu problema ao atendente, me informe *nome completo e CPF*. Se souber o RA, pode mandar também.\n\n🔒 *Não envie sua senha.*"
      );
      return true;
    }

    return concluirEncaminhamento({
      client,
      msg,
      sessao,
      responder,
      problema: sessao.problemaSuporteOriginal || "Problema de acesso ao portal da UniFatecie.",
      informacoes: textoOriginal,
      titulo: "SUPORTE DE PORTAL — UNIFATECIE",
      assuntoHumano: "atendimento_humano_suporte_portal"
    });
  }

  // Qualquer problema real informado dentro do portal da UniFatecie e tratado aqui,
  // sem mandar dados pessoais ou credenciais para a IA.
  if (assunto === "suporte_portal_unifatecie") {
    if (pareceDadosFinanceiros(textoOriginal)) return false;

    sessao.instituicao = "unifatecie";
    sessao.problemaSuporteOriginal = String(textoOriginal || "").trim().slice(0, 900);
    sessao.assuntoAtual = "suporte_identificacao_unifatecie";
    sessao.atualizadoEm = Date.now();

    if (problemaDeAcesso(textoOriginal)) {
      await responder(
        client,
        msg.from,
        "Entendi. Se você perdeu o *RA* ou a *senha* do portal da UniFatecie, eu passo o caso para o atendente resolver. 👨‍💼\n\nMe informe *nome completo e CPF*. Se ainda souber o RA, pode mandar também.\n\n🔒 *Não envie sua senha por aqui.*"
      );
      return true;
    }

    await responder(
      client,
      msg.from,
      "Entendi o problema no portal da *UniFatecie*. Vou passar para o atendente verificar e resolver. 👨‍💼\n\nMe informe *nome completo e CPF*. Se souber o RA, pode mandar também.\n\n🔒 Não envie senha ou código de acesso."
    );
    return true;
  }

  return false;
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
  assert.equal(pareceDadosFinanceiros("278732, 07792688224, eu nao sei o dia exato, paguei 112,20"), true);
  assert.equal(pareceIdentificacaoAluno("Carlos Olimpio, CPF 07792688224"), true);
  assert.equal(problemaDeAcesso("Perdi meu RA e minha senha"), true);
  assert.equal(pediuEncerrarSuporte("Encerrar"), true);
  assert.equal(pediuEncerrarSuporte("Encerrar atendimento"), true);
  assert.equal(pediuEncerrarSuporte("nao quero encerrar"), false);
  assert.equal(removerSenhaDeclarada("minha senha: abc123").includes("abc123"), false);
  console.log("✅ Self-test do encaminhamento de suporte aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  pareceDadosFinanceiros,
  pareceIdentificacaoAluno,
  problemaDeAcesso,
  pediuEncerrarSuporte,
  tentarEncaminharSuporte
};
