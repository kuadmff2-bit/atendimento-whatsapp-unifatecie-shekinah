const wppconnect = require("@wppconnect-team/wppconnect");

const NOME_ANTIGO = "Light";
const NOME_PUBLICO = "Aizen";

function corrigirNomePublico(texto) {
  if (typeof texto !== "string" || !texto.trim()) return texto;

  let saida = texto;

  // Corrige formas explícitas de autoidentificação herdadas de camadas antigas.
  const padroes = [
    [/\bEu sou o \*?Light\*?\b/gi, "Eu sou o Aizen"],
    [/\bEu sou \*?Light\*?\b/gi, "Eu sou Aizen"],
    [/\bMeu nome é \*?Light\*?\b/gi, "Meu nome é Aizen"],
    [/\bMeu nome e \*?Light\*?\b/gi, "Meu nome é Aizen"],
    [/\bSou o \*?Light\*?\b/gi, "Sou o Aizen"],
    [/\bSou \*?Light\*?\b/gi, "Sou Aizen"],
    [/\bLight, assistente virtual\b/gi, "Aizen, assistente virtual"],
    [/\bLight, assistente da\b/gi, "Aizen, assistente da"],
    [/\bLight, assistente do\b/gi, "Aizen, assistente do"],
  ];

  for (const [regex, substituicao] of padroes) {
    saida = saida.replace(regex, substituicao);
  }

  if (/^\s*\*?Light\*?[.!]?\s*$/i.test(saida)) return NOME_PUBLICO;
  return saida;
}

function protegerCliente(client) {
  if (!client || client.__aizenOutputGuard) return client;

  if (typeof client.sendText === "function") {
    const sendTextOriginal = client.sendText.bind(client);
    client.sendText = function (destino, texto, ...resto) {
      return sendTextOriginal(destino, corrigirNomePublico(texto), ...resto);
    };
  }

  if (typeof client.reply === "function") {
    const replyOriginal = client.reply.bind(client);
    client.reply = function (destino, texto, idMensagem, ...resto) {
      return replyOriginal(destino, corrigirNomePublico(texto), idMensagem, ...resto);
    };
  }

  Object.defineProperty(client, "__aizenOutputGuard", { value: true });
  return client;
}

if (!wppconnect.__aizenCreateGuard && typeof wppconnect.create === "function") {
  const createOriginal = wppconnect.create.bind(wppconnect);
  wppconnect.create = async function (...args) {
    const client = await createOriginal(...args);
    protegerCliente(client);
    return client;
  };
  Object.defineProperty(wppconnect, "__aizenCreateGuard", { value: true });
  console.log("🛡️ Guarda de identidade pública Aizen ativo.");
}

function selfTest() {
  const assert = require("assert");
  assert.equal(
    corrigirNomePublico("🤖 Olá! Eu sou o Light, assistente da UniFatecie Polo Barreirinha e da Shekinah. 😊"),
    "🤖 Olá! Eu sou o Aizen, assistente da UniFatecie Polo Barreirinha e da Shekinah. 😊"
  );
  assert.equal(corrigirNomePublico("Meu nome é *Light*."), "Meu nome é Aizen.");
  assert.equal(corrigirNomePublico("Light"), "Aizen");
  assert.equal(corrigirNomePublico("A palavra light significa luz."), "A palavra light significa luz.");
  console.log("✅ Self-test do guarda de saída Aizen aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  NOME_ANTIGO,
  NOME_PUBLICO,
  corrigirNomePublico,
  protegerCliente,
};
