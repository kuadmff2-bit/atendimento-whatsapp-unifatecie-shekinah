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

  const novo = `    const textoEventoLight = (m = {}) => {\n      const candidatos = [\n        m?.body,\n        m?.content,\n        m?.caption,\n        m?.text,\n        m?.message?.conversation,\n        m?.message?.extendedTextMessage?.text,\n        m?.raw?.body,\n        m?.raw?.content,\n      ];\n      for (const valor of candidatos) {\n        if (typeof valor === \"string\" && valor.trim()) return valor.trim();\n      }\n      return \"\";\n    };\n\n    const idsEventoLight = (m = {}) => [...new Set([\n      m?.id?._serialized,\n      m?.id?.serialized,\n      m?.id?.id,\n      typeof m?.id === \"string\" ? m.id : null,\n      m?.messageId,\n      m?.msgId,\n      m?.key?._serialized,\n      m?.key?.id,\n    ].filter((v) => typeof v === \"string\" && v.trim()).map((v) => v.trim()))];\n\n    const recuperarTextoEventoLight = async (m = {}) => {\n      const direto = textoEventoLight(m);\n      if (direto) return direto;\n\n      if (typeof client?.getMessageById === \"function\") {\n        for (const id of idsEventoLight(m)) {\n          try {\n            const atualizada = await client.getMessageById(id);\n            const texto = textoEventoLight(atualizada || {});\n            if (texto) {\n              console.log(\"🛟 Texto recuperado pelo ID da mensagem.\");\n              return texto;\n            }\n          } catch (error) {\n            console.warn(\"⚠️ Falha ao recuperar texto pelo ID:\", error?.message || error);\n          }\n        }\n      }\n\n      const chatId = String(m?.from || m?.chatId?._serialized || m?.chatId || \"\").trim();\n      if (chatId && typeof client?.getMessages === \"function\") {\n        try {\n          const mensagens = await client.getMessages(chatId, { count: 8 });\n          if (Array.isArray(mensagens)) {\n            const recebidasComTexto = mensagens.filter((x) => !x?.fromMe && textoEventoLight(x));\n            if (recebidasComTexto.length) {\n              const tsOriginal = Number(m?.t || m?.timestamp || m?.ts || 0);\n              let candidata = null;\n              if (tsOriginal) {\n                candidata = recebidasComTexto.find((x) => {\n                  const ts = Number(x?.t || x?.timestamp || x?.ts || 0);\n                  return ts && Math.abs(ts - tsOriginal) <= 5;\n                }) || null;\n              }\n              candidata = candidata || recebidasComTexto[recebidasComTexto.length - 1];\n              const texto = textoEventoLight(candidata || {});\n              if (texto) {\n                console.log(\"🛟 Texto recuperado pelo histórico recente do chat.\");\n                return texto;\n              }\n            }\n          }\n        } catch (error) {\n          console.warn(\"⚠️ Falha ao recuperar texto pelo histórico:\", error?.message || error);\n        }\n      }\n\n      return \"\";\n    };\n\n    const eventosLightEmProcessamento = new Set();\n\n    const encaminharEventoLight = async (origem, msg) => {\n      try {\n        const from = String(msg?.from || msg?.chatId || \"\");\n        const fromMe = Boolean(msg?.fromMe);\n        const grupo = Boolean(msg?.isGroupMsg || String(from).endsWith(\"@g.us\"));\n        let corpoCompleto = textoEventoLight(msg);\n\n        if (!fromMe && !grupo && !corpoCompleto) {\n          corpoCompleto = await recuperarTextoEventoLight(msg);\n          if (corpoCompleto) {\n            try { msg.body = corpoCompleto; } catch (_) {}\n            try { if (!msg.content) msg.content = corpoCompleto; } catch (_) {}\n          }\n        }\n\n        const corpoLog = String(corpoCompleto || \"\").replace(/\\s+/g, \" \" ).slice(0, 120);\n        console.log(\`📨 Evento WhatsApp [\${origem}] from=\${from || \"?\"} fromMe=\${fromMe} grupo=\${grupo} body=\${JSON.stringify(corpoLog)}\`);\n\n        if (!fromMe && !grupo && !corpoCompleto) {\n          console.warn(\"⚠️ Mensagem privada recebida sem texto recuperável; evento ignorado para evitar resposta incorreta.\");\n          return;\n        }\n\n        const ids = idsEventoLight(msg);\n        const chave = ids[0] || [from, Number(msg?.t || msg?.timestamp || msg?.ts || 0), corpoCompleto].join(\"|\");\n        if (eventosLightEmProcessamento.has(chave)) return;\n        eventosLightEmProcessamento.add(chave);\n        setTimeout(() => eventosLightEmProcessamento.delete(chave), 15000).unref?.();\n      } catch (error) {\n        console.warn(\"⚠️ Falha ao normalizar evento WhatsApp:\", error?.message || error);\n      }\n\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar evento WhatsApp:\", error?.message || error);\n      });\n    };\n\n    client.onMessage((msg) => encaminharEventoLight(\"onMessage\", msg));\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => {\n        if (!msg?.fromMe) encaminharEventoLight(\"onAnyMessage\", msg);\n      });\n      console.log(\"🛟 Fallback onAnyMessage ativo para mensagens recebidas.\");\n    }\n    console.log(\"📥 Polling de não lidas desativado para preservar a estabilidade da sessão.\");\n\n    if (typeof client.getHostDevice === \"function\") {\n      Promise.resolve(client.getHostDevice())\n        .then((host) => {\n          const id = host?.id?._serialized || host?.id?.user || host?.id || host?.wid?._serialized || host?.wid || \"não identificado\";\n          const nome = host?.pushname || host?.formattedName || host?.name || \"\";\n          console.log(\`📱 WhatsApp realmente conectado: id=\${String(id)} nome=\${String(nome)}\`);\n        })\n        .catch((error) => console.warn(\"⚠️ Não foi possível identificar o host conectado:\", error?.message || error));\n    }`;

  out = out.replace(alvo, novo);
  console.log("🛟 Proteção de eventos WhatsApp ativa: onMessage + onAnyMessage, com recuperação autocontida de texto vazio.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = "async function x(){\n    client.onMessage((msg) => processarMensagem(client, msg));\n}";
  const novo = patchCodigo(base);
  assert.match(novo, /const textoEventoLight/);
  assert.match(novo, /const recuperarTextoEventoLight/);
  assert.match(novo, /textoEventoLight\(msg\)/);
  assert.doesNotMatch(novo, /textoMensagem\(msg\)/);
  console.log("✅ Self-test do fallback de eventos WhatsApp aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchCodigo };
