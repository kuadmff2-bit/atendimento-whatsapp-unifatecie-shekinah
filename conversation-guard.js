const Module = require("module");
const originalLoad = Module._load;

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emFluxoEstruturado(sessao = {}) {
  const e = String(sessao.etapa || "");
  return e.startsWith("unifatecie_matricula_") ||
    e.startsWith("shekinah_matricula_") ||
    e.startsWith("financeiro_") ||
    e.startsWith("shekinah_secretaria_") ||
    e === "atendimento_humano";
}

function saudacaoPura(texto = "") {
  const t = norm(texto);
  return /^(oi|ola|opa|e ai|eae|bom dia|boa tarde|boa noite|hello|hey)$/.test(t);
}

function limparContextoCatalogo(sessao = {}, limparInstituicao = true) {
  if (emFluxoEstruturado(sessao)) return;
  sessao.assuntoAtual = null;
  sessao.modalidadeShekinah = null;
  sessao.eadCursoAtual = null;
  sessao.eadUltimaLista = null;
  sessao.eadPagina = 0;
  sessao.cursoAtual = null;
  sessao.curso = "";
  sessao.acaoPendente = null;
  sessao.historicoIA = [];
  if (limparInstituicao) sessao.instituicao = null;
  sessao.atualizadoEm = Date.now();
}

function contextoEad(sessao = {}) {
  const a = norm(sessao.assuntoAtual || "");
  return sessao.modalidadeShekinah === "ead" || a.includes("shekinah ead") || a.includes("ead shekinah");
}

function contextoSuporte(sessao = {}) {
  const a = String(sessao.assuntoAtual || "").toLowerCase();
  return a.startsWith("suporte_") || a.startsWith("financeiro_");
}

function mencionaPortal(t = "") {
  return /\b(portal|alunonet|ava|ambiente virtual|area do aluno)\b/.test(t);
}

function temSinalDeProblema(t = "") {
  return /\b(problema|erro|falha|bug|travou|travando|nao funciona|nao abre|nao consigo|ajuda|duvida|dificuldade|login|senha|acessar|acesso|entrar)\b/.test(t);
}

function pedidoSuportePortal(texto = "") {
  const t = norm(texto);
  return mencionaPortal(t) && temSinalDeProblema(t);
}

function pedidoPagamentoNaoCompensado(texto = "") {
  const t = norm(texto);
  const falouPagamento = /\b(paguei|pago|pagamento|mensalidade|parcela|boleto)\b/.test(t);
  const continuaAberto = /\b(ainda|continua|continuou|segue|aparece|consta)\b.*\b(abert|pendente|pagar|cobr|nao pago)/.test(t)
    || /\b(abert|pendente|pagar|cobr)\w*\b.*\b(ainda|continua|aparece|consta)\b/.test(t);
  const naoBaixou = /\b(nao|nunca)\b.*\b(baixou|compensou|reconheceu|constou)\b/.test(t)
    || /\bpagamento\b.*\bnao compens/.test(t);
  return falouPagamento && (continuaAberto || naoBaixou);
}

function pareceConsultaDeCurso(t = "") {
  return /\b(curso|cursos|ead|online|graduacao|curso superior|ensino superior|bacharelado|licenciatura|tecnologo|duracao|aulas|conteudo|grade|certificado|matricular|programacao|informatica|pedagogia|administracao|design|marketing|apoio|reforco|game|jogo|engenharia)\b/.test(t);
}

function pareceConversaOuSuporte(t = "") {
  return /\b(problema|erro|falha|bug|ajuda|duvida|nao consigo|travou|travando|portal|alunonet|login|senha|conta|documento|boleto|pagamento|paguei|mensalidade|parcela|financeiro|cancelamento|secretario|atendente|obrigado|obrigada|valeu)\b/.test(t);
}

function querHumano(t = "") {
  return /\b(secretario|atendente|humano|pessoa|falar com alguem|falar com o secretario|falar com atendente)\b/.test(t);
}

async function tratarPortal({ client, msg, textoOriginal, sessao, responder }) {
  const t = norm(textoOriginal);

  // Compatibilidade com sessoes antigas que ainda ficaram na pergunta de instituicao.
  if (sessao.assuntoAtual === "suporte_portal_escolher_instituicao" || sessao.assuntoAtual === "suporte_portal_shekinah") {
    sessao.instituicao = "unifatecie";
    sessao.assuntoAtual = "suporte_portal_unifatecie";
    sessao.atualizadoEm = Date.now();
    await responder(
      client,
      msg.from,
      "Certo. *Portal é somente o da UniFatecie.* A Shekinah não possui portal próprio. Me diga o que está acontecendo no portal da UniFatecie ou envie um print do erro. 😊"
    );
    return true;
  }

  if (sessao.assuntoAtual === "suporte_portal_unifatecie") {
    if (querHumano(t)) return false;
    if (pedidoPagamentoNaoCompensado(textoOriginal)) {
      sessao.instituicao = "unifatecie";
      sessao.assuntoAtual = "suporte_pagamento_unifatecie";
      await responder(
        client,
        msg.from,
        "Entendi. Se você *já pagou a mensalidade* e ela ainda aparece em aberto, *não faça outro pagamento agora*. Pode ser que o pagamento ainda não tenha sido compensado no sistema.\n\nPara conferir, me informe *RA, CPF, data do pagamento e valor pago*. Se tiver o comprovante, pode enviar também. ✅"
      );
      return true;
    }

    // Outros problemas de portal ficam no fluxo seguro do bot e nunca viram oferta de curso.
    if (pareceConversaOuSuporte(t) && !pareceConsultaDeCurso(t)) return false;
  }

  if (sessao.assuntoAtual === "suporte_pagamento_unifatecie") {
    if (querHumano(t)) return false;
    sessao.instituicao = "unifatecie";
    sessao.atualizadoEm = Date.now();
    return false;
  }

  if (!pedidoSuportePortal(textoOriginal)) return false;

  limparContextoCatalogo(sessao, true);
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = "suporte_portal_unifatecie";
  sessao.atualizadoEm = Date.now();

  await responder(
    client,
    msg.from,
    "Claro. Como você falou em *portal*, já sei que é da *UniFatecie*. A Shekinah não possui portal próprio.\n\nMe diga o que está acontecendo no portal da UniFatecie ou, se preferir, envie um print do erro. 😊"
  );
  return true;
}

async function tentarConversaNatural(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || !textoOriginal || typeof responder !== "function") return false;
  if (emFluxoEstruturado(sessao)) return false;

  const t = norm(textoOriginal);

  if (saudacaoPura(t)) {
    limparContextoCatalogo(sessao, true);
    return false;
  }

  if (await tratarPortal({ client, msg, textoOriginal, sessao, responder })) return true;

  if (contextoEad(sessao) && pareceConversaOuSuporte(t) && !pareceConsultaDeCurso(t)) {
    limparContextoCatalogo(sessao, true);
  }

  return false;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__conversationGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarConversaNatural(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__conversationGuard", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(saudacaoPura("Boa noite"), true);
  assert.equal(pedidoSuportePortal("Estou com um problema no meu portal"), true);
  assert.equal(pedidoSuportePortal("Quero saber o valor do curso"), false);
  assert.equal(pedidoPagamentoNaoCompensado("Eu paguei uma mensalidade mas ela continua aberta pra eu pagar"), true);
  assert.equal(pareceConsultaDeCurso(norm("Quanto custa o curso de informatica?")), true);
  assert.equal(pareceConversaOuSuporte(norm("Perdi meu RA e minha senha")), true);
  console.log("✅ Self-test de conversa natural aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  saudacaoPura,
  pedidoSuportePortal,
  pedidoPagamentoNaoCompensado,
  pareceConsultaDeCurso,
  pareceConversaOuSuporte,
  contextoSuporte,
  tentarConversaNatural,
};
