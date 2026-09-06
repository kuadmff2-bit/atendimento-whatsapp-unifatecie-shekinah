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

function destinoAdmin() {
  const numero = String(process.env.BOT_ADMIN_PHONE || "").replace(/\D/g, "");
  return numero ? `${numero}@c.us` : "";
}

function nomeContato(msg = {}) {
  return String(msg?.sender?.pushname || msg?.sender?.formattedName || msg?.sender?.name || "Contato sem nome").trim();
}

function identificadorContato(msg = {}) {
  for (const valor of [msg?.sender?.id?.user, msg?.from, msg?.author, msg?.chatId]) {
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
    identificacaoSuporteParcial: null,
    dadosFinanceirosParciais: null,
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

function blocosNumericos(texto = "") {
  return String(texto || "")
    .split(/[\s,;]+/)
    .map(raw => ({ raw, digits: raw.replace(/\D/g, "") }))
    .filter(x => x.digits);
}

function temCpfNoTexto(texto = "") {
  return blocosNumericos(texto).some(x => x.digits.length === 11);
}

function camposFinanceiros(texto = "") {
  const bruto = String(texto || "").trim();
  const blocos = blocosNumericos(bruto);
  const temCpf = blocos.some(x => x.digits.length === 11);
  const temValor = /\b\d{1,5}\s*[,.]\s*\d{2}\b/.test(bruto);
  const temRaRotulado = /\bra\b\s*[:#-]?\s*\d{4,12}\b/i.test(bruto);
  const temRaSolto = blocos.some(x => {
    const n = x.digits.length;
    const pareceData = /^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(x.raw);
    return n >= 5 && n <= 10 && !pareceData;
  });
  return { temCpf, temValor, temRa: temRaRotulado || temRaSolto };
}

function pareceDadosFinanceiros(texto = "") {
  const c = camposFinanceiros(texto);
  return c.temCpf && c.temValor && c.temRa;
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

function temNomeProvavel(texto = "") {
  const semNumeros = norm(texto)
    .replace(/\b(cpf|ra|meu|nome|completo|sou|me chamo)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return semNumeros.split(" ").filter(p => /^[a-z]{2,}$/.test(p)).length >= 2;
}

function pareceIdentificacaoAluno(texto = "") {
  const bruto = String(texto || "").trim();
  return Boolean(bruto && temCpfNoTexto(bruto) && temNomeProvavel(bruto));
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

function juntarParcial(anterior, atual) {
  const a = String(anterior || "").trim();
  const b = removerSenhaDeclarada(String(atual || "").trim());
  if (!a) return b.slice(0, 1800);
  if (!b) return a.slice(0, 1800);
  return `${a}\n${b}`.slice(0, 1800);
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
    removerSenhaDeclarada(informacoes || "").slice(0, 1800),
    "",
    "Assuma a conversa manualmente quando puder."
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
  sessao.identificacaoSuporteParcial = null;
  sessao.dadosFinanceirosParciais = null;
  await responder(
    client,
    msg.from,
    notificou
      ? "✅ Recebi suas informações e já passei tudo para o atendente da UniFatecie. 👨‍💼\n\nJá já um atendente vai entrar em contato por aqui para resolver seu problema."
      : "✅ Recebi suas informações e deixei seu caso para atendimento. 👨‍💼\n\nJá já um atendente vai entrar em contato por aqui."
  );
  return true;
}

async function tentarEncaminharSuporte(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;

  const assunto = String(sessao.assuntoAtual || "");
  const emSuporte = assunto === "suporte_portal_unifatecie" || assunto === "suporte_pagamento_unifatecie" || assunto === "suporte_identificacao_unifatecie";
  if (!emSuporte) return false;

  if (pediuEncerrarSuporte(textoOriginal)) {
    resetarSuporte(sessao);
    await responder(client, msg.from, "✅ *Atendimento encerrado.* Não precisa enviar mais nenhum dado. Se precisar de outra coisa depois, é só me chamar. 😊");
    return true;
  }

  if (assunto === "suporte_portal_unifatecie" && pedidoPagamentoNaoCompensado(textoOriginal)) {
    sessao.instituicao = "unifatecie";
    sessao.assuntoAtual = "suporte_pagamento_unifatecie";
    sessao.dadosFinanceirosParciais = null;
    sessao.atualizadoEm = Date.now();
    await responder(
      client,
      msg.from,
      "Entendi. Se você *já pagou a mensalidade* e ela ainda aparece em aberto, *não faça outro pagamento agora*.\n\nMe envie *RA, CPF e valor pago*. Se souber a data aproximada, pode mandar também. Se tiver comprovante, pode enviar. Depois eu passo as informações para o atendente conferir. 👨‍💼"
    );
    return true;
  }

  if (assunto === "suporte_pagamento_unifatecie") {
    const combinado = juntarParcial(sessao.dadosFinanceirosParciais, textoOriginal);
    sessao.dadosFinanceirosParciais = combinado;
    const campos = camposFinanceiros(combinado);
    if (!(campos.temCpf && campos.temRa && campos.temValor)) {
      const faltam = [];
      if (!campos.temRa) faltam.push("RA");
      if (!campos.temCpf) faltam.push("CPF");
      if (!campos.temValor) faltam.push("valor pago");
      await responder(
        client,
        msg.from,
        `Certo. Para eu passar o caso ao atendente, falta me informar *${faltam.join(", ")}*. Se souber a data aproximada do pagamento, pode mandar também. 👨‍💼\n\nSe não quiser continuar, diga *encerrar atendimento*.`
      );
      return true;
    }
    return concluirEncaminhamento({
      client, msg, sessao, responder,
      problema: "Aluno informa que já pagou a mensalidade, mas ela continua aparecendo em aberto.",
      informacoes: combinado,
      titulo: "SUPORTE FINANCEIRO — UNIFATECIE",
      assuntoHumano: "atendimento_humano_suporte_financeiro"
    });
  }

  if (assunto === "suporte_identificacao_unifatecie") {
    const combinado = juntarParcial(sessao.identificacaoSuporteParcial, textoOriginal);
    sessao.identificacaoSuporteParcial = combinado;
    if (!pareceIdentificacaoAluno(combinado)) {
      const temCpf = temCpfNoTexto(combinado);
      const temNome = temNomeProvavel(combinado);
      const faltam = [];
      if (!temNome) faltam.push("nome completo");
      if (!temCpf) faltam.push("CPF");
      await responder(
        client,
        msg.from,
        `Para eu passar seu problema ao atendente, falta me informar *${faltam.join(" e ")}*. Se souber o RA, pode mandar também.\n\n🔒 *Não envie sua senha.*`
      );
      return true;
    }
    return concluirEncaminhamento({
      client, msg, sessao, responder,
      problema: sessao.problemaSuporteOriginal || "Problema de acesso ao portal da UniFatecie.",
      informacoes: combinado,
      titulo: "SUPORTE DE PORTAL — UNIFATECIE",
      assuntoHumano: "atendimento_humano_suporte_portal"
    });
  }

  if (assunto === "suporte_portal_unifatecie") {
    sessao.instituicao = "unifatecie";
    sessao.problemaSuporteOriginal = removerSenhaDeclarada(String(textoOriginal || "").trim().slice(0, 900));
    sessao.assuntoAtual = "suporte_identificacao_unifatecie";
    sessao.identificacaoSuporteParcial = null;
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
  if ((request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) && exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__supportHandoffGuard) {
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
  assert.equal(pedidoPagamentoNaoCompensado("Eu paguei uma mensalidade mas ela continua aberta pra eu pagar"), true);
  assert.equal(pareceDadosFinanceiros("278732, 07792688224, eu nao sei o dia exato, paguei 112,20"), true);
  assert.equal(pareceDadosFinanceiros("07792688224"), false);
  assert.equal(pareceIdentificacaoAluno("Carlos Olimpio, CPF 07792688224"), true);
  assert.equal(pareceIdentificacaoAluno("CPF 07792688224"), false);
  assert.equal(problemaDeAcesso("Perdi meu RA e minha senha"), true);
  assert.equal(pediuEncerrarSuporte("Encerrar"), true);
  assert.equal(pediuEncerrarSuporte("Encerrar atendimento"), true);
  assert.equal(pediuEncerrarSuporte("nao quero encerrar"), false);
  assert.equal(removerSenhaDeclarada("minha senha: abc123").includes("abc123"), false);
  console.log("✅ Self-test do encaminhamento de suporte aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  camposFinanceiros,
  pareceDadosFinanceiros,
  pedidoPagamentoNaoCompensado,
  pareceIdentificacaoAluno,
  problemaDeAcesso,
  pediuEncerrarSuporte,
  tentarEncaminharSuporte
};