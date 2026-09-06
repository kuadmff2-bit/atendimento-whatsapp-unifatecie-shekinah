const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);
  const alvo = "    client.onMessage((msg) => processarMensagem(client, msg));";

  if (!out.includes(alvo)) {
    console.warn("⚠️ Message-event fallback: registro onMessage não encontrado; nenhuma alteração aplicada.");
    return out;
  }

  const novo = `    const encaminharEventoLight = (origem, msg) => {\n      try {\n        const from = String(msg?.from || msg?.chatId || \"\");\n        const fromMe = Boolean(msg?.fromMe);\n        const grupo = Boolean(msg?.isGroupMsg || String(from).endsWith(\"@g.us\"));\n        const corpo = String(msg?.body || msg?.content || \"\").replace(/\\s+/g, \" \" ).slice(0, 120);\n        console.log(\`📨 Evento WhatsApp [\${origem}] from=\${from || \"?\"} fromMe=\${fromMe} grupo=\${grupo} body=\${JSON.stringify(corpo)}\`);\n      } catch (_) {}\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar evento WhatsApp:\", error?.message || error);\n      });\n    };\n\n    // onMessage é o caminho principal. onAnyMessage fica como fallback sem fazer\n    // varreduras periódicas na página do WhatsApp. O polling por\n    // getAllUnreadMessages foi removido porque, no Chromium do Railway, ele podia\n    // prender Runtime.callFunctionOn por vários minutos e impedir o recebimento\n    // de novas mensagens.\n    client.onMessage((msg) => encaminharEventoLight(\"onMessage\", msg));\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => {\n        if (!msg?.fromMe) encaminharEventoLight(\"onAnyMessage\", msg);\n      });\n      console.log(\"🛟 Fallback onAnyMessage ativo para mensagens recebidas.\");\n    }\n    console.log(\"📥 Polling de não lidas desativado para preservar a estabilidade da sessão.\");\n\n    if (typeof client.getHostDevice === \"function\") {\n      Promise.resolve(client.getHostDevice())\n        .then((host) => {\n          const id = host?.id?._serialized || host?.id?.user || host?.id || host?.wid?._serialized || host?.wid || \"não identificado\";\n          const nome = host?.pushname || host?.formattedName || host?.name || \"\";\n          console.log(\`📱 WhatsApp realmente conectado: id=\${String(id)} nome=\${String(nome)}\`);\n        })\n        .catch((error) => console.warn(\"⚠️ Não foi possível identificar o host conectado:\", error?.message || error));\n    }`;

  out = out.replace(alvo, novo);
  console.log("🛟 Proteção de eventos WhatsApp ativa: onMessage + onAnyMessage, sem polling bloqueante.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };
