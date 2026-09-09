const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function isIaGroq(filename = "") {
  return /(?:^|[\\/])ia-groq\.js$/.test(String(filename));
}

function patchLegacy(codigo = "") {
  let out = String(codigo);

  // Não chamar getConnectionState() em loop durante a inicialização. Esse
  // polling estava monopolizando o canal do Puppeteer/CDP e atrasando a
  // exposição dos eventos do WPPConnect por vários minutos.
  if (out.includes("      waitForLogin: false,")) {
    out = out.replace("      waitForLogin: false,", "      waitForLogin: true,");
  }

  if (out.includes("      deviceSyncTimeout: 0,")) {
    out = out.replace("      deviceSyncTimeout: 0,", "      deviceSyncTimeout: 180000,");
  }

  const alvoPuppeteer = "    const puppeteerOptions = { timeout: 120000 };";
  if (out.includes(alvoPuppeteer)) {
    out = out.replace(
      alvoPuppeteer,
      "    const puppeteerOptions = { timeout: 120000, protocolTimeout: 180000 };"
    );
  }

  // Em versões atuais do WhatsApp Web, uma conversa recebida pode chegar como
  // @lid. Converter esse identificador para @c.us antes de responder pode
  // deixar sendText pendurado. Para respostas ao próprio chat, preserve o LID.
  const responderAntigo = `async function responder(client, destino, mensagem) {\n  await delay(900);\n\n  const destinoResolvido = await resolverDestino(client, destino);\n  return enviarTextoDireto(client, destinoResolvido, mensagem);\n}`;
  const responderNovo = `async function responder(client, destino, mensagem) {\n  await delay(350);\n\n  const destinoOriginal = String(destino || \"\");\n  const destinoResposta = destinoOriginal.endsWith(\"@lid\")\n    ? destinoOriginal\n    : await resolverDestino(client, destinoOriginal);\n\n  if (destinoOriginal.endsWith(\"@lid\")) {\n    console.log(\"📨 Respondendo diretamente ao chat LID: \" + destinoResposta);\n  }\n\n  return enviarTextoDireto(client, destinoResposta, mensagem);\n}`;

  if (out.includes(responderAntigo)) {
    out = out.replace(responderAntigo, responderNovo);
  } else {
    console.warn("⚠️ Guarda LID: função responder não encontrada para ajuste.");
  }

  console.log("✅ Inicialização estável do WhatsApp ativa: eventos livres e respostas LID diretas.");
  return out;
}

function patchIaGroq(codigo = "") {
  let out = String(codigo);

  // Evita HTTP 413 quando uma sessão persistida acumulou contexto demais.
  out = out.replace("const LIMITE_HISTORICO = 24;", "const LIMITE_HISTORICO = 8;");

  const historicoAntigo = "    ...historico.slice(-LIMITE_HISTORICO),";
  const historicoNovo = `    ...historico.slice(-LIMITE_HISTORICO).map((m) => ({\n      role: m?.role === \"assistant\" ? \"assistant\" : \"user\",\n      content: String(m?.content || \"\").slice(-1200),\n    })),`;
  if (out.includes(historicoAntigo)) out = out.replace(historicoAntigo, historicoNovo);

  // Não tente browser_search só porque o modelo principal falhou. Isso gerava
  // uma segunda requisição grande/413 em mensagens simples como "Teste Aizen".
  const webAntigo = "  if (!resposta || pareceSemInformacao(resposta) || perguntaPodePrecisarDeWeb(texto)) {";
  const webNovo = "  if (perguntaPodePrecisarDeWeb(texto) || (resposta && pareceSemInformacao(resposta))) {";
  if (out.includes(webAntigo)) out = out.replace(webAntigo, webNovo);

  console.log("🧠 Payload da IA protegido contra histórico excessivo/HTTP 413.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  let patched = content;
  if (isLegacy(filename)) patched = patchLegacy(patched);
  if (isIaGroq(filename)) patched = patchIaGroq(patched);
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");

  const baseLegacy = `async function iniciar() {\n    const puppeteerOptions = { timeout: 120000 };\n      waitForLogin: true,\n      deviceSyncTimeout: 0,\n    whatsappConectado = true;\n  }\n\nasync function responder(client, destino, mensagem) {\n  await delay(900);\n\n  const destinoResolvido = await resolverDestino(client, destino);\n  return enviarTextoDireto(client, destinoResolvido, mensagem);\n}`;
  const novoLegacy = patchLegacy(baseLegacy);
  assert.match(novoLegacy, /waitForLogin: true/);
  assert.doesNotMatch(novoLegacy, /waitForLogin: false/);
  assert.match(novoLegacy, /deviceSyncTimeout: 180000/);
  assert.match(novoLegacy, /protocolTimeout: 180000/);
  assert.match(novoLegacy, /endsWith\(\"@lid\"\)/);
  assert.match(novoLegacy, /Respondendo diretamente ao chat LID/);
  assert.doesNotMatch(novoLegacy, /getConnectionState\(\)/);

  const baseIa = `const LIMITE_HISTORICO = 24;\nconst mensagens = [\n    ...historico.slice(-LIMITE_HISTORICO),\n];\n  if (!resposta || pareceSemInformacao(resposta) || perguntaPodePrecisarDeWeb(texto)) {`;
  const novaIa = patchIaGroq(baseIa);
  assert.match(novaIa, /LIMITE_HISTORICO = 8/);
  assert.match(novaIa, /slice\(-1200\)/);
  assert.doesNotMatch(novaIa, /if \(!resposta \|\| pareceSemInformacao/);

  console.log("✅ Self-test da estabilidade WhatsApp/LID/IA aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchCodigo: patchLegacy, patchLegacy, patchIaGroq };
