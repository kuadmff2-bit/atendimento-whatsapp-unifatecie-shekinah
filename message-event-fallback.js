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

  const novo = `    const inicioEscutaLight = Date.now();\n    const vistosPollingLight = new Map();\n    const TTL_VISTOS_POLLING = 6 * 60 * 60 * 1000;\n\n    const timestampMsLight = (msg) => {\n      const bruto = Number(msg?.timestamp || msg?.t || 0);\n      if (!Number.isFinite(bruto) || bruto <= 0) return 0;\n      return bruto < 1e12 ? bruto * 1000 : bruto;\n    };\n\n    const chaveMensagemLight = (msg) => {\n      try { return obterIdMensagem(msg); } catch (_) {}\n      if (typeof msg?.id === \"string\") return msg.id;\n      if (msg?.id?._serialized) return msg.id._serialized;\n      if (msg?.msgId) return String(msg.msgId);\n      return \`${'${String(msg?.from || msg?.chatId || "?")}:${String(msg?.timestamp || msg?.t || "?")}:${String(msg?.body || msg?.content || "")}'}\`;\n    };\n\n    const encaminharEventoLight = (origem, msg) => {\n      try {\n        const from = String(msg?.from || msg?.chatId || \"\");\n        const fromMe = Boolean(msg?.fromMe);\n        const grupo = Boolean(msg?.isGroupMsg || String(from).endsWith(\"@g.us\"));\n        const corpo = String(msg?.body || msg?.content || \"\").replace(/\\s+/g, \" \" ).slice(0, 120);\n        console.log(\`📨 Evento WhatsApp [\${origem}] from=\${from || \"?\"} fromMe=\${fromMe} grupo=\${grupo} body=\${JSON.stringify(corpo)}\`);\n      } catch (_) {}\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar evento WhatsApp:\", error?.message || error);\n      });\n    };\n\n    client.onMessage((msg) => encaminharEventoLight(\"onMessage\", msg));\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => {\n        if (!msg?.fromMe) encaminharEventoLight(\"onAnyMessage\", msg);\n      });\n      console.log(\"🛟 Fallback onAnyMessage ativo para mensagens recebidas.\");\n    }\n\n    if (typeof client.getAllUnreadMessages === \"function\") {\n      let pollingEmAndamentoLight = false;\n\n      const buscarNaoLidasLight = async () => {\n        if (pollingEmAndamentoLight) return;\n        pollingEmAndamentoLight = true;\n        try {\n          const mensagens = await client.getAllUnreadMessages();\n          if (!Array.isArray(mensagens) || mensagens.length === 0) return;\n\n          const agora = Date.now();\n          for (const [id, quando] of vistosPollingLight) {\n            if (agora - quando > TTL_VISTOS_POLLING) vistosPollingLight.delete(id);\n          }\n\n          const recebidas = mensagens\n            .filter((msg) => msg && !msg.fromMe && !msg.isGroupMsg && msg.from)\n            .sort((a, b) => timestampMsLight(a) - timestampMsLight(b));\n\n          for (const msg of recebidas) {\n            const id = chaveMensagemLight(msg);\n            if (vistosPollingLight.has(id)) continue;\n            vistosPollingLight.set(id, agora);\n\n            const ts = timestampMsLight(msg);\n            // Não ressuscita conversas antigas depois de um restart, mas recupera\n            // mensagens que chegaram logo antes/durante a inicialização do bot.\n            if (ts && ts < inicioEscutaLight - 2 * 60 * 1000) continue;\n\n            const corpo = String(msg?.body || msg?.content || \"\").replace(/\\s+/g, \" \" ).slice(0, 120);\n            console.log(\`📥 Polling recuperou mensagem não lida from=\${String(msg.from)} body=\${JSON.stringify(corpo)}\`);\n            await processarMensagem(client, msg);\n\n            if (typeof client.sendSeen === \"function\") {\n              try { await client.sendSeen(msg.from); } catch (_) {}\n            }\n          }\n        } catch (error) {\n          console.warn(\"⚠️ Polling de mensagens não lidas falhou:\", error?.message || error);\n        } finally {\n          pollingEmAndamentoLight = false;\n        }\n      };\n\n      const inicioPollingLight = setTimeout(buscarNaoLidasLight, 800);\n      inicioPollingLight.unref?.();\n      const intervaloPollingLight = setInterval(buscarNaoLidasLight, 2500);\n      intervaloPollingLight.unref?.();\n      console.log(\"📥 Polling de mensagens não lidas ativo a cada 2,5s.\");\n    } else {\n      console.warn(\"⚠️ getAllUnreadMessages não disponível; polling de segurança não foi ativado.\");\n    }\n\n    if (typeof client.getHostDevice === \"function\") {\n      Promise.resolve(client.getHostDevice())\n        .then((host) => {\n          const id = host?.id?._serialized || host?.id?.user || host?.id || host?.wid?._serialized || host?.wid || \"não identificado\";\n          const nome = host?.pushname || host?.formattedName || host?.name || \"\";\n          console.log(\`📱 WhatsApp realmente conectado: id=\${String(id)} nome=\${String(nome)}\`);\n        })\n        .catch((error) => console.warn(\"⚠️ Não foi possível identificar o host conectado:\", error?.message || error));\n    }`;

  out = out.replace(alvo, novo);
  console.log("🛟 Proteção de eventos WhatsApp ativa: eventos + polling de não lidas.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };
