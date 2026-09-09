const Module = require("module");
const originalCompile = Module.prototype._compile;

const WHATSAPP_WEB_COMPATIVEL = "2.3000.1047113681-alpha";

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchLegacy(codigo = "") {
  let out = String(codigo);

  // O padrão antigo do WPPConnect (2.3000.10305x) não está mais disponível.
  // Usamos uma build publicada hoje pelo próprio wa-version, evitando cair em
  // um "latest" diferente a cada reinício do container.
  const alvoVersao = "      updatesLog: true,";
  if (out.includes(alvoVersao) && !out.includes("      whatsappVersion:")) {
    out = out.replace(
      alvoVersao,
      `${alvoVersao}\n      whatsappVersion: \"${WHATSAPP_WEB_COMPATIVEL}\",`
    );
  }

  // Usa somente os eventos públicos do WPPConnect. O fluxo principal já tem
  // deduplicação por ID, então onAnyMessage funciona como redundância segura.
  const alvoListener = "    client.onMessage((msg) => processarMensagem(client, msg));";
  if (out.includes(alvoListener)) {
    const listenerNovo = `    const receberMensagemAizen = (origem, msg) => {\n      if (!msg || msg.fromMe || msg.isGroupMsg) return;\n\n      const corpo = String(msg.body || msg.content || msg.caption || \"\").trim();\n      const origemContato = String(msg.from || msg.chatId || \"desconhecido\");\n      console.log(\`📨 Aizen recebeu [\${origem}] de \${origemContato} body=\${JSON.stringify(corpo.slice(0, 120))}\`);\n\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar mensagem recebida:\", error?.message || error);\n      });\n    };\n\n    client.onMessage((msg) => receberMensagemAizen(\"onMessage\", msg));\n\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => receberMensagemAizen(\"onAnyMessage\", msg));\n      console.log(\"🛟 Recepção redundante oficial ativa: onMessage + onAnyMessage.\");\n    }`;
    out = out.replace(alvoListener, listenerNovo);
  } else {
    console.warn("⚠️ Runtime estável: registro onMessage não encontrado.");
  }

  console.log(`✅ Runtime WhatsApp simplificado: Web ${WHATSAPP_WEB_COMPATIVEL}, WA-JS estável e eventos nativos.`);
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchLegacy(content) : content;
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = `const client = await wppconnect.create({\n      updatesLog: true,\n    });\n    client.onMessage((msg) => processarMensagem(client, msg));`;
  const novo = patchLegacy(base);
  assert.match(novo, /2\.3000\.1047113681-alpha/);
  assert.match(novo, /onAnyMessage/);
  assert.match(novo, /Aizen recebeu/);
  console.log("✅ Self-test do runtime WhatsApp simplificado aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchLegacy, WHATSAPP_WEB_COMPATIVEL };
