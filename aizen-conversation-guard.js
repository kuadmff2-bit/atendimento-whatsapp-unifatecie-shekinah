const fs = require("fs");
const path = require("path");
const Module = require("module");
const conversa = require("./conversation-core-ext");
const { RESPOSTA_CRIADOR } = require("./aizen-identity");

const NOME_PUBLICO = "Aizen";
const CAMINHO_INDEX = path.resolve(__dirname, "index.js");

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

function ehPerguntaCriador(texto = "") {
  const t = normalizar(texto);
  return /^(quem (te )?(criou|fez|desenvolveu|programou)|quem criou voce|quem fez voce|quem desenvolveu voce|quem programou voce|quem e (o )?seu criador|qual (e )?(o )?seu criador|quem esta por tras de voce|quem te inventou|quem inventou voce)$/.test(t);
}

function ehSaudacao(texto = "") {
  const t = normalizar(texto);
  return /^(oi+|ola+|opa+|opam|alo+|ei+|e ai|hey+|hello|salve|bom dia|boa tarde|boa noite)$/.test(t);
}

function mensagemIdentidade() {
  return "🤖 Meu nome é *Aizen*. Sou o assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊";
}

function mensagemCriador() {
  return `🤖 ${RESPOSTA_CRIADOR}`;
}

function mensagemSaudacao() {
  return "🤖 Oi! Eu sou o *Aizen* 😊 Como posso te ajudar?";
}

function corrigirFonteIndexAizen(codigo = "") {
  return String(codigo || "")
    .replace(
      "🤖 Eu sou o *Light*, assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊",
      "🤖 Eu sou o *Aizen*, assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊"
    )
    .replace(
      "🤖 Olá! Eu sou o *Light*, assistente da *UniFatecie Polo Barreirinha* e da *Shekinah*. 😊 Como posso ajudar?",
      "🤖 Olá! Eu sou o *Aizen*, assistente da *UniFatecie Polo Barreirinha* e da *Shekinah*. 😊 Como posso ajudar?"
    )
    .replace(
      "voltar pro light|voltar para o light",
      "voltar pro light|voltar para o light|voltar pro aizen|voltar para o aizen"
    );
}

function instalarProtecaoFonteIndex() {
  if (Module.__aizenIndexSourceGuard) return;

  const extensaoJsOriginal = Module._extensions[".js"];
  Module._extensions[".js"] = function (modulo, filename) {
    if (path.resolve(filename) === CAMINHO_INDEX) {
      const fonteOriginal = fs.readFileSync(filename, "utf8");
      const fonteCorrigida = corrigirFonteIndexAizen(fonteOriginal);
      if (fonteCorrigida !== fonteOriginal) {
        console.log("🛡️ Identidade Aizen aplicada também ao roteador principal.");
      } else {
        console.warn("⚠️ Guarda Aizen não encontrou os textos legados no index principal.");
      }
      return modulo._compile(fonteCorrigida, filename);
    }
    return extensaoJsOriginal(modulo, filename);
  };

  Object.defineProperty(Module, "__aizenIndexSourceGuard", { value: true });
}

instalarProtecaoFonteIndex();

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
      if (ehPerguntaCriador(texto)) {
        await args.responder(args.client, args.msg.from, mensagemCriador());
        return true;
      }

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
  console.log("🗣️ Conversa natural sincronizada com a identidade Aizen, incluindo autoria.");
}

function selfTest() {
  const assert = require("assert");
  assert.equal(ehPerguntaIdentidade("Qual seu nome?"), true);
  assert.equal(ehPerguntaIdentidade("quem é você?"), true);
  assert.equal(ehPerguntaCriador("Quem criou você?"), true);
  assert.equal(ehPerguntaCriador("Quem fez você?"), true);
  assert.equal(ehPerguntaCriador("Quem te programou?"), true);
  assert.equal(ehPerguntaCriador("Quem é seu criador?"), true);
  assert.equal(ehSaudacao("Boa noite"), true);
  assert.equal(ehSaudacao("Opam"), true);
  assert.match(mensagemIdentidade(), /Aizen/);
  assert.doesNotMatch(mensagemIdentidade(), /Light/);
  assert.equal(mensagemCriador(), `🤖 ${RESPOSTA_CRIADOR}`);
  assert.match(mensagemCriador(), /Carlos/);
  assert.match(mensagemSaudacao(), /Aizen/);

  const fonteTeste = `await responder(client,msg.from,"🤖 Eu sou o *Light*, assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊");\nawait responder(client,msg.from,"🤖 Olá! Eu sou o *Light*, assistente da *UniFatecie Polo Barreirinha* e da *Shekinah*. 😊 Como posso ajudar?");`;
  const fonteCorrigida = corrigirFonteIndexAizen(fonteTeste);
  assert.doesNotMatch(fonteCorrigida, /Eu sou o \*Light\*/);
  assert.match(fonteCorrigida, /Eu sou o \*Aizen\*/);

  console.log("✅ Self-test da conversa Aizen aprovado, incluindo identidade, autoria e roteador principal.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  NOME_PUBLICO,
  normalizar,
  ehPerguntaIdentidade,
  ehPerguntaCriador,
  ehSaudacao,
  mensagemIdentidade,
  mensagemCriador,
  mensagemSaudacao,
  corrigirFonteIndexAizen,
  instalarProtecaoFonteIndex,
};
