const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarEad(texto = "") {
  return norm(texto)
    .replace(/\be\s*[-/.]?\s*a\s*[-/.]?\s*d\b/g, "ead")
    .replace(/\bensino a distancia\b/g, "ead")
    .replace(/\ba distancia\b/g, "ead")
    .replace(/\s+/g, " ")
    .trim();
}

function ehEadExplicito(texto = "") {
  const t = normalizarEad(texto);
  return /\bead\b|\bonline\b/.test(t);
}

function ehPedidoGenericoEad(texto = "") {
  const t = normalizarEad(texto);
  if (!ehEadExplicito(t)) return false;

  const stop = new Set([
    "oi","ola","opa","boa","bom","noite","tarde","dia","vcs","voces","voce","tem","temos","ha","existe",
    "curso","cursos","de","do","da","dos","das","em","no","na","um","uma","uns","umas","pra","para","por","favor",
    "ead","online","apoio","livre","livres","profissionalizante","profissionalizantes","qualificacao","qualificacoes",
    "quero","queria","gostaria","ver","saber","mostrar","mostra","mostre","me","quais","opcoes","opcao","catalogo",
    "shekinah","centro","educacional"
  ]);

  const restantes = t
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !stop.has(p));

  return restantes.length === 0;
}

function pedeShekinahPorNatureza(texto = "") {
  const t = normalizarEad(texto);
  return /\bshekinah\b|\bcurso(s)? livre(s)?\b|\bprofissionalizante(s)?\b|\bqualificacao\b|\bapoio\b/.test(t);
}

function ehPedidoProfissionalizanteShekinah(texto = "") {
  const t = norm(texto);
  if (!t) return false;

  if (/\bnao\s+(quero|procuro|busco|tenho interesse).{0,35}\b(profis[a-z]*|curso(s)? livre(s)?|qualificacao)\b/.test(t)) {
    return false;
  }

  return (
    /\bcurso(s)? livre(s)?\b/.test(t) ||
    /\bqualificacao(oes)?\b/.test(t) ||
    /\bprofissionalizante(s)?\b/.test(t) ||
    /\bprofis[a-z]{4,}\b/.test(t)
  );
}

function pedeUniFatecieExplicito(texto = "") {
  const t = normalizarEad(texto);
  return /\bunifatecie\b|\bfatecie\b|\bfaculdade\b|\bgraduacao\b|\bcurso superior\b|\bbacharelado\b|\blicenciatura\b|\btecnologo\b/.test(t);
}

function rejeitaGraduacao(texto = "") {
  const t = norm(texto);
  return (
    /\bnao\s+(quero|procuro|busco|tenho interesse).{0,30}\bgraduacao\b/.test(t) ||
    /\bnao\s+quero\s+de\s+graduacao\b/.test(t) ||
    /\bnao\s+e\s+graduacao\b/.test(t) ||
    /\bsem\s+graduacao\b/.test(t) ||
    /\b(alguma coisa|algo|curso).{0,25}\bque nao seja graduacao\b/.test(t)
  );
}

function consultaGenericaDeExistenciaEad(texto = "") {
  const t = normalizarEad(texto);
  if (!ehPedidoGenericoEad(t)) return false;
  if (pedeShekinahPorNatureza(t) || pedeUniFatecieExplicito(t)) return false;
  return /\b(tem|temos|ha|existe|quais|opcoes|catalogo|cursos)\b/.test(t);
}

function escopoEad(texto = "", sessao = {}) {
  if (pedeUniFatecieExplicito(texto)) return "unifatecie";
  if (pedeShekinahPorNatureza(texto) || ehPedidoProfissionalizanteShekinah(texto)) return "shekinah";
  const assunto = norm(sessao?.assuntoAtual);
  if (sessao?.modalidadeShekinah === "ead" || assunto.includes("shekinah_ead") || assunto.includes("shekinah_modalidade")) return "shekinah";
  if (sessao?.instituicao === "shekinah") return "shekinah";
  if (sessao?.instituicao === "unifatecie") return "unifatecie";
  return "ambiguo";
}

function marcarEscolhaEadPendente(sessao = {}) {
  sessao.assuntoAtual = "escolha_instituicao_ead";
  sessao.modalidadeShekinah = null;
  sessao.cursoAtual = null;
  sessao.eadCursoAtual = null;
  sessao.atualizadoEm = Date.now();
}

function marcarShekinahModalidadePendente(sessao = {}) {
  sessao.instituicao = "shekinah";
  sessao.modalidadeShekinah = null;
  sessao.assuntoAtual = "shekinah_modalidade_pendente";
  sessao.cursoAtual = null;
  sessao.eadCursoAtual = null;
  sessao.atualizadoEm = Date.now();
}

function escolhaInstituicaoEad(texto = "", sessao = {}) {
  if (norm(sessao?.assuntoAtual) !== "escolha_instituicao_ead") return "";
  const t = normalizarEad(texto);

  if (/^(shekinah|centro educacional shekinah|shekinah ead|cursos livres|curso livre)$/.test(t)) {
    return "shekinah";
  }
  if (/^(unifatecie|fatecie|faculdade|unifatecie ead|graduacao|graduacao ead)$/.test(t)) {
    return "unifatecie";
  }
  return "";
}

function marcarShekinahEad(sessao = {}) {
  sessao.instituicao = "shekinah";
  sessao.modalidadeShekinah = "ead";
  sessao.assuntoAtual = "shekinah_ead";
  sessao.cursoAtual = null;
  sessao.eadCursoAtual = null;
  sessao.atualizadoEm = Date.now();
}

async function responderEadShekinah({ client, msg, sessao, responder, prefixo = "" }) {
  marcarShekinahEad(sessao);

  try {
    const lista = await EAD.responder("listar cursos ead", sessao);
    if (lista) {
      await responder(
        client,
        msg.from,
        `${prefixo}${lista}\n\n💰 *Todos os cursos EAD da Shekinah:* R$ 300,00 à vista ou 2x de R$ 160,00.\n🎁 À vista, o aluno ganha +2 cursos EAD de sua escolha.`
      );
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Guard EAD: não foi possível carregar catálogo:", error?.message || error);
  }

  await responder(
    client,
    msg.from,
    `${prefixo}💻 Sim. A *Shekinah oferece cursos EAD*. 😊\n\nO catálogo está temporariamente indisponível para listagem, mas a modalidade EAD está ativa. O valor é *R$ 300 à vista* ou *2x de R$ 160*; à vista, ganha *+2 cursos EAD* de brinde.`
  );
  return true;
}

async function responderEadUniFatecie({ client, msg, sessao, responder }) {
  sessao.instituicao = "unifatecie";
  sessao.modalidadeShekinah = null;
  sessao.assuntoAtual = "unifatecie_ead";
  sessao.cursoAtual = null;
  sessao.eadCursoAtual = null;
  sessao.atualizadoEm = Date.now();

  await responder(
    client,
    msg.from,
    "🎓 Certo! Você escolheu a *UniFatecie*. Temos cursos de graduação EAD. 😊\n\nQual curso você procura?"
  );
  return true;
}

async function perguntarInstituicaoEad({ client, msg, sessao, responder }) {
  marcarEscolhaEadPendente(sessao);
  await responder(
    client,
    msg.from,
    "💻 Temos EAD nas duas instituições. 😊\n\n🎓 *UniFatecie:* cursos de graduação EAD.\n📚 *Shekinah:* cursos livres EAD.\n\nQual dos dois você quer ver?"
  );
  return true;
}

async function perguntarModalidadeShekinah({ client, msg, sessao, responder }) {
  marcarShekinahModalidadePendente(sessao);
  await responder(
    client,
    msg.from,
    "📚 Entendi. Você procura *cursos livres/profissionalizantes da Shekinah*. 😊\n\nTemos opções *presenciais* e *EAD*. Qual modalidade você prefere?"
  );
  return true;
}

async function tentarEadDireto(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;

  if (ehPedidoProfissionalizanteShekinah(textoOriginal) && !ehEadExplicito(textoOriginal)) {
    return perguntarModalidadeShekinah({ client, msg, sessao, responder });
  }

  if (rejeitaGraduacao(textoOriginal)) {
    return responderEadShekinah({
      client,
      msg,
      sessao,
      responder,
      prefixo: "Entendi. E só para não confundir: *curso tecnólogo também é graduação*. ✅\n\nComo você não quer graduação, vou te mostrar os *cursos livres EAD da Shekinah*.\n\n",
    });
  }

  const escolhaPendente = escolhaInstituicaoEad(textoOriginal, sessao);
  if (escolhaPendente === "shekinah") {
    return responderEadShekinah({ client, msg, sessao, responder });
  }
  if (escolhaPendente === "unifatecie") {
    return responderEadUniFatecie({ client, msg, sessao, responder });
  }

  if (!ehEadExplicito(textoOriginal) || !ehPedidoGenericoEad(textoOriginal)) return false;

  if (consultaGenericaDeExistenciaEad(textoOriginal)) {
    return perguntarInstituicaoEad({ client, msg, sessao, responder });
  }

  const escopo = escopoEad(textoOriginal, sessao);

  if (escopo === "unifatecie") {
    return responderEadUniFatecie({ client, msg, sessao, responder });
  }

  if (escopo === "shekinah") {
    return responderEadShekinah({ client, msg, sessao, responder });
  }

  return perguntarInstituicaoEad({ client, msg, sessao, responder });
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp &&
    typeof exp.tentarCorrecoesAtendimento === "function" &&
    !exp.__eadDirectGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarEadDireto(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__eadDirectGuard", { value: true });
  }

  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(ehEadExplicito("E A D"), true);
  assert.equal(ehEadExplicito("curso a distância"), true);
  assert.equal(ehPedidoGenericoEad("Boa noite vcs tem cursos de apoio em E A D"), true);
  assert.equal(ehPedidoGenericoEad("Tem curso de maquiagem EAD?"), false);
  assert.equal(escopoEad("cursos de apoio em E A D", { instituicao: "unifatecie" }), "shekinah");
  assert.equal(escopoEad("graduação EAD", { instituicao: "shekinah" }), "unifatecie");
  assert.equal(escopoEad("EAD", { instituicao: "shekinah" }), "shekinah");
  assert.equal(escopoEad("EAD", { instituicao: "unifatecie", assuntoAtual: "shekinah_modalidade_pendente" }), "shekinah");
  assert.equal(consultaGenericaDeExistenciaEad("Tem curso EAD?"), true);
  assert.equal(consultaGenericaDeExistenciaEad("EAD"), false);
  assert.equal(rejeitaGraduacao("Não quero de graduação"), true);
  assert.equal(rejeitaGraduacao("Quero graduação"), false);
  assert.equal(ehPedidoProfissionalizanteShekinah("Não, profisiolisantes"), true);
  assert.equal(ehPedidoProfissionalizanteShekinah("Quero profissionalizantes"), true);
  assert.equal(ehPedidoProfissionalizanteShekinah("Não quero profissionalizantes"), false);
  assert.equal(escolhaInstituicaoEad("Shekinah", { assuntoAtual: "escolha_instituicao_ead" }), "shekinah");
  assert.equal(escolhaInstituicaoEad("UniFatecie", { assuntoAtual: "escolha_instituicao_ead" }), "unifatecie");
  console.log("✅ Self-test do roteamento EAD aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  normalizarEad,
  ehEadExplicito,
  ehPedidoGenericoEad,
  ehPedidoProfissionalizanteShekinah,
  rejeitaGraduacao,
  consultaGenericaDeExistenciaEad,
  escopoEad,
  escolhaInstituicaoEad,
  tentarEadDireto,
};
