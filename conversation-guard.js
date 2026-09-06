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

function mencionaPortal(t = "") {
  return /\b(portal|alunonet|ava|ambiente virtual|plataforma|area do aluno)\b/.test(t);
}

function temSinalDeProblema(t = "") {
  return /\b(problema|erro|falha|bug|travou|travando|nao funciona|nao abre|nao consigo|ajuda|duvida|dificuldade|login|senha|acessar|acesso|entrar)\b/.test(t);
}

function pedidoSuportePortal(texto = "") {
  const t = norm(texto);
  return mencionaPortal(t) && temSinalDeProblema(t);
}

function mencionaUni(t = "") {
  return /\b(unifatecie|fatecie|faculdade|alunonet)\b/.test(t);
}

function mencionaShekinah(t = "") {
  return /\bshekinah\b/.test(t);
}

function pareceConsultaDeCurso(t = "") {
  return /\b(curso|cursos|ead|online|graduacao|faculdade|valor|preco|mensalidade|duracao|aula|aulas|conteudo|grade|certificado|matricula|matricular|programacao|informatica|pedagogia|administracao|design|marketing|apoio|reforco|game|jogo)\b/.test(t);
}

function pareceConversaOuSuporte(t = "") {
  return /\b(problema|erro|falha|bug|ajuda|duvida|nao consigo|travou|travando|portal|alunonet|login|senha|conta|documento|boleto|pagamento|cancelamento|secretario|atendente|obrigado|obrigada|valeu)\b/.test(t);
}

async function tratarPortal({ client, msg, textoOriginal, sessao, responder }) {
  const t = norm(textoOriginal);

  if (sessao.assuntoAtual === "suporte_portal_escolher_instituicao") {
    if (mencionaUni(t) || /^(uni|unifatecie|fatecie)$/.test(t)) {
      limparContextoCatalogo(sessao, false);
      sessao.instituicao = "unifatecie";
      sessao.assuntoAtual = "suporte_portal_unifatecie";
      await responder(client, msg.from, "Certo. É no portal da *UniFatecie*. Me diga o que está acontecendo ou, se preferir, envie um print do erro. 😊");
      return true;
    }
    if (mencionaShekinah(t) || /^shekinah$/.test(t)) {
      limparContextoCatalogo(sessao, false);
      sessao.instituicao = "shekinah";
      sessao.assuntoAtual = "suporte_portal_shekinah";
      await responder(client, msg.from, "Certo. É na plataforma da *Shekinah*. Me diga o que está acontecendo ou envie um print do erro. 😊");
      return true;
    }
  }

  if (!pedidoSuportePortal(textoOriginal)) return false;

  limparContextoCatalogo(sessao, true);

  if (mencionaUni(t)) {
    sessao.instituicao = "unifatecie";
    sessao.assuntoAtual = "suporte_portal_unifatecie";
    await responder(client, msg.from, "Claro. Me diga o que está acontecendo no portal da *UniFatecie* ou envie um print do erro que eu tento te orientar. 😊");
    return true;
  }

  if (mencionaShekinah(t)) {
    sessao.instituicao = "shekinah";
    sessao.assuntoAtual = "suporte_portal_shekinah";
    await responder(client, msg.from, "Claro. Me diga o que está acontecendo na plataforma da *Shekinah* ou envie um print do erro que eu tento te orientar. 😊");
    return true;
  }

  sessao.assuntoAtual = "suporte_portal_escolher_instituicao";
  await responder(client, msg.from, "Claro. Esse problema é no portal da *UniFatecie* ou na plataforma da *Shekinah*? 😊");
  return true;
}

async function tentarConversaNatural(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || !textoOriginal || typeof responder !== "function") return false;
  if (emFluxoEstruturado(sessao)) return false;

  const t = norm(textoOriginal);

  // Uma saudação isolada inicia uma conversa limpa. Não deixa um catálogo antigo contaminar o próximo assunto.
  if (saudacaoPura(t)) {
    limparContextoCatalogo(sessao, true);
    return false;
  }

  if (await tratarPortal({ client, msg, textoOriginal, sessao, responder })) return true;

  // Se a pessoa muda para um assunto de suporte/conversa normal, abandona o contexto EAD antigo antes
  // de deixar as demais camadas responderem. Assim palavras como "estou", "problema" ou "portal"
  // nunca são pesquisadas como nome de curso.
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
  assert.equal(pareceConsultaDeCurso(norm("Quanto custa o curso de informática?")), true);
  assert.equal(pareceConversaOuSuporte(norm("Estou com um problema no portal")), true);
  console.log("✅ Self-test de conversa natural aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  saudacaoPura,
  pedidoSuportePortal,
  pareceConsultaDeCurso,
  pareceConversaOuSuporte,
  tentarConversaNatural,
};
