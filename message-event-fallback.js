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

  const novo = `    const encaminharEventoLight = (origem, msg) => {
      try {
        const from = String(msg?.from || msg?.chatId || "");
        const fromMe = Boolean(msg?.fromMe);
        const grupo = Boolean(msg?.isGroupMsg || String(from).endsWith("@g.us"));
        const corpo = String(msg?.body || msg?.content || "").replace(/\\s+/g, " ").slice(0, 120);
        console.log(\`📨 Evento WhatsApp [\${origem}] from=\${from || "?"} fromMe=\${fromMe} grupo=\${grupo} body=\${JSON.stringify(corpo)}\`);
      } catch (_) {}
      Promise.resolve(processarMensagem(client, msg)).catch((error) => {
        console.error("❌ Falha ao processar evento WhatsApp:", error?.message || error);
      });
    };

    // onMessage é o caminho principal. onAnyMessage fica como fallback sem fazer
    // varreduras periódicas na página do WhatsApp. O polling por
    // getAllUnreadMessages foi removido porque, no Chromium do Railway, ele podia
    // prender Runtime.callFunctionOn por vários minutos e impedir o recebimento
    // de novas mensagens.
    client.onMessage((msg) => encaminharEventoLight("onMessage", msg));
    if (typeof client.onAnyMessage === "function") {
      client.onAnyMessage((msg) => {
        if (!msg?.fromMe) encaminharEventoLight("onAnyMessage", msg);
      });
      console.log("🛟 Fallback onAnyMessage ativo para mensagens recebidas.");
    }
    console.log("📥 Polling de não lidas desativado para preservar a estabilidade da sessão.");`;

  out = out.replace(alvo, novo);
  console.log("🛟 Proteção de eventos WhatsApp ativa: onMessage + onAnyMessage, sem I/O Chromium.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };

