const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function textoMensagem(msg = {}) {
  const candidatos = [
    msg?.body,
    msg?.content,
    msg?.caption,
    msg?.text,
    msg?.message?.conversation,
    msg?.message?.extendedTextMessage?.text,
    msg?.raw?.body,
    msg?.raw?.content,
  ];
  for (const valor of candidatos) {
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return "";
}

function idsMensagem(msg = {}) {
  return [...new Set([
    msg?.id?._serialized,
    msg?.id?.serialized,
    msg?.id?.id,
    typeof msg?.id === "string" ? msg.id : null,
    msg?.messageId,
    msg?.msgId,
    msg?.key?._serialized,
    msg?.key?.id,
  ].filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()))];
}

function timestampMensagem(msg = {}) {
  const n = Number(msg?.t || msg?.timestamp || msg?.ts || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function mesmaMensagem(a = {}, b = {}) {
  const idsA = new Set(idsMensagem(a));
  if (idsMensagem(b).some((id) => idsA.has(id))) return true;
  const ta = timestampMensagem(a);
  const tb = timestampMensagem(b);
  return Boolean(ta && tb && Math.abs(ta - tb) <= 3);
}

async function recuperarTextoEvento(client, msg = {}) {
  const direto = textoMensagem(msg);
  if (direto) return direto;

  if (typeof client?.getMessageById === "function") {
    for (const id of idsMensagem(msg)) {
      try {
        const atualizada = await client.getMessageById(id);
        const texto = textoMensagem(atualizada || {});
        if (texto) {
          console.log("🛟 Texto recuperado pelo ID da mensagem.");
          return texto;
        }
      } catch (error) {
        console.warn("⚠️ Falha ao recuperar texto pelo ID:", error?.message || error);
      }
    }
  }

  const chatId = String(msg?.from || msg?.chatId?._serialized || msg?.chatId || "").trim();
  if (chatId && typeof client?.getMessages === "function") {
    try {
      const mensagens = await client.getMessages(chatId, { count: 10 });
      if (Array.isArray(mensagens)) {
        const privadasRecebidas = mensagens.filter((m) => !m?.fromMe && textoMensagem(m));
        const correspondente = privadasRecebidas.find((m) => mesmaMensagem(m, msg));
        const candidata = correspondente || privadasRecebidas[privadasRecebidas.length - 1];
        const texto = textoMensagem(candidata || {});
        if (texto) {
          console.log("🛟 Texto recuperado pelo histórico recente do chat.");
          return texto;
        }
      }
    } catch (error) {
      console.warn("⚠️ Falha ao recuperar texto pelo histórico:", error?.message || error);
    }
  }

  return "";
}

function patchCodigo(codigo = "") {
  let out = String(codigo);
  const alvo = "    client.onMessage((msg) => processarMensagem(client, msg));";

  if (!out.includes(alvo)) {
    console.warn("⚠️ Message-event fallback: registro onMessage não encontrado; nenhuma alteração aplicada.");
    return out;
  }

  const novo = `    const encaminharEventoLight = async (origem, msg) => {\n      try {\n        const from = String(msg?.from || msg?.chatId || \"\");\n        const fromMe = Boolean(msg?.fromMe);\n        const grupo = Boolean(msg?.isGroupMsg || String(from).endsWith(\"@g.us\"));\n        let corpoCompleto = textoMensagem(msg);\n\n        // Algumas versões do WhatsApp Web/WPPConnect passaram a emitir mensagens\n        // privadas com body/content vazios. Recarregamos a mensagem antes de\n        // entregar ao roteador para o Aizen não ficar silencioso.\n        if (!fromMe && !grupo && !corpoCompleto) {\n          corpoCompleto = await recuperarTextoEvento(client, msg);\n          if (corpoCompleto) {\n            try { msg.body = corpoCompleto; } catch (_) {}\n            try { if (!msg.content) msg.content = corpoCompleto; } catch (_) {}\n          }\n        }\n\n        const corpoLog = String(corpoCompleto || \"\").replace(/\\s+/g, \" \" ).slice(0, 120);\n        console.log(\`📨 Evento WhatsApp [\${origem}] from=\${from || \"?\"} fromMe=\${fromMe} grupo=\${grupo} body=\${JSON.stringify(corpoLog)}\`);\n\n        if (!fromMe && !grupo && !corpoCompleto) {\n          console.warn(\"⚠️ Mensagem privada recebida sem texto recuperável; evento ignorado para evitar resposta incorreta.\");\n          return;\n        }\n      } catch (error) {\n        console.warn(\"⚠️ Falha ao normalizar evento WhatsApp:\", error?.message || error);\n      }\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar evento WhatsApp:\", error?.message || error);\n      });\n    };\n\n    // onMessage é o caminho principal. onAnyMessage fica como fallback sem fazer\n    // varreduras periódicas na página do WhatsApp. O polling por\n    // getAllUnreadMessages foi removido porque, no Chromium do Railway, ele podia\n    // prender Runtime.callFunctionOn por vários minutos e impedir o recebimento\n    // de novas mensagens.\n    client.onMessage((msg) => encaminharEventoLight(\"onMessage\", msg));\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => {\n        if (!msg?.fromMe) encaminharEventoLight(\"onAnyMessage\", msg);\n      });\n      console.log(\"🛟 Fallback onAnyMessage ativo para mensagens recebidas.\");\n    }\n    console.log(\"📥 Polling de não lidas desativado para preservar a estabilidade da sessão.\");\n\n    if (typeof client.getHostDevice === \"function\") {\n      Promise.resolve(client.getHostDevice())\n        .then((host) => {\n          const id = host?.id?._serialized || host?.id?.user || host?.id || host?.wid?._serialized || host?.wid || \"não identificado\";\n          const nome = host?.pushname || host?.formattedName || host?.name || \"\";\n          console.log(\`📱 WhatsApp realmente conectado: id=\${String(id)} nome=\${String(nome)}\`);\n        })\n        .catch((error) => console.warn(\"⚠️ Não foi possível identificar o host conectado:\", error?.message || error));\n    }`;

  out = out.replace(alvo, novo);
  console.log("🛟 Proteção de eventos WhatsApp ativa: onMessage + onAnyMessage, com recuperação de texto vazio.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo, textoMensagem, idsMensagem, mesmaMensagem, recuperarTextoEvento };
