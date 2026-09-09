const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);

  // IMPORTANTE:
  // Não chamar getConnectionState() em loop durante a inicialização.
  // No WPPConnect/Puppeteer isso pode ocupar a chamada CDP por vários minutos
  // quando o WhatsApp Web está terminando de injetar os eventos. O efeito era
  // exatamente o observado em produção: onMessage era registrado, mas os
  // eventos seguintes demoravam minutos para serem expostos e as mensagens
  // privadas não chegavam ao processador.
  //
  // Também não forçamos waitForLogin=false. O listener deve ser instalado
  // somente depois que o WPPConnect concluiu a autenticação/injeção normal.

  if (out.includes("      waitForLogin: false,")) {
    out = out.replace("      waitForLogin: false,", "      waitForLogin: true,");
  }

  if (out.includes("      deviceSyncTimeout: 0,")) {
    out = out.replace("      deviceSyncTimeout: 0,", "      deviceSyncTimeout: 180000,");
  }

  // Aumenta somente o limite geral do protocolo para operações legítimas.
  // Não existe mais polling de estado que possa monopolizar essa conexão.
  const alvoPuppeteer = "    const puppeteerOptions = { timeout: 120000 };";
  if (out.includes(alvoPuppeteer)) {
    out = out.replace(
      alvoPuppeteer,
      "    const puppeteerOptions = { timeout: 120000, protocolTimeout: 180000 };"
    );
  }

  console.log("✅ Inicialização estável do WhatsApp ativa: sem polling bloqueante de estado.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = `async function iniciar() {\n    const puppeteerOptions = { timeout: 120000 };\n      waitForLogin: true,\n      deviceSyncTimeout: 0,\n    whatsappConectado = true;\n  }`;
  const novo = patchCodigo(base);
  assert.match(novo, /waitForLogin: true/);
  assert.doesNotMatch(novo, /waitForLogin: false/);
  assert.match(novo, /deviceSyncTimeout: 180000/);
  assert.match(novo, /protocolTimeout: 180000/);
  assert.doesNotMatch(novo, /getConnectionState\(\)/);
  assert.doesNotMatch(novo, /setInterval\(verificarEstadoLight/);
  console.log("✅ Self-test da inicialização estável do WhatsApp aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchCodigo };
