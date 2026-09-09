const conversa = require("./conversation-core-ext");

const NOME_PUBLICO = "Aizen";

function normalizar(texto = "") {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ehPerguntaIdentidade(texto = "") {
  const t = normalizar(texto);
  return /^(qual (e )?(o )?seu nome|como voce se chama|quem e voce|quem voce e|seu nome|nome|qual seu nome|quem e vc|quem vc e)$/.test(t);
}

function ehSaudacao(texto = "") {
  const t = normalizar(texto);
  return /^(oi+|ola+|opa+|opam|alo+|ei+|e ai|hey+|hello|salve|bom dia|boa tarde|boa noite)$/.test(t);
}

function mensagemIdentidade() {
  return "🤖 Meu nome é *Aizen*. Sou o assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊";
}

function mensagemSaudacao() {
  return "🤖 Oi! Eu sou o *Aizen* 😊 Como posso te ajudar?";
}

if (!conversa.__aizenConversationGuard && typeof conversa.tentarConversaNatural === "function") {
  const original = conversa.tentarConversaNatural;

  conversa.tentarConversaNatural = async function (args = {}) {
    const texto = String(args.textoOriginal || args.texto || "").trim();

    if (
      args.sessao &&
      typeof args.responder === "function" &&
      args.client &&
      args.msg?.from
    ) {
      if (ehPerguntaIdentidade(texto)) {
        await args.responder(args.client, args.msg.from, mensagemIdentidade());
        return true;
      }

      if (ehSaudacao(texto)) {
        await args.responder(args.client, args.msg.from, mensagemSaudacao());
        return true;
      }
    }

    return original(args);
  };

  Object.defineProperty(conversa, "__aizenConversationGuard", { value: true });
  console.log("🗣️ Conversa natural sincronizada com a identidade Aizen.");
}

function selfTest() {
  const assert = require("assert");
  assert.equal(ehPerguntaIdentidade("Qual seu nome?"), true);
  assert.equal(ehPerguntaIdentidade("quem é você?"), true);
  assert.equal(ehSaudacao("Boa noite"), true);
  assert.equal(ehSaudacao("Opam"), true);
  assert.match(mensagemIdentidade(), /Aizen/);
  assert.doesNotMatch(mensagemIdentidade(), /Light/);
  assert.match(mensagemSaudacao(), /Aizen/);
  console.log("✅ Self-test da conversa Aizen aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  NOME_PUBLICO,
  normalizar,
  ehPerguntaIdentidade,
  ehSaudacao,
  mensagemIdentidade,
  mensagemSaudacao,
};
