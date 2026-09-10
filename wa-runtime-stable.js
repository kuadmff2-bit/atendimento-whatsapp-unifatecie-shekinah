const Module = require("module");
const originalCompile = Module.prototype._compile;

const WHATSAPP_WEB_COMPATIVEL = "2.3000.1047113681-alpha";

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchLegacy(codigo = "") {
  let out = String(codigo);

  const alvoVersao = "      updatesLog: true,";
  if (out.includes(alvoVersao) && !out.includes("      whatsappVersion:")) {
    out = out.replace(
      alvoVersao,
      `${alvoVersao}\n      whatsappVersion: \"${WHATSAPP_WEB_COMPATIVEL}\",`
    );
  }

  out = out.replace(
    "    const puppeteerOptions = { timeout: 120000 };",
    "    const puppeteerOptions = { timeout: 120000, protocolTimeout: 20000 };"
  );

  const alvoResolver = `async function resolverDestino(client, destino) {\n  if (!destino.endsWith(\"@lid\")) return destino;\n\n  try {`;
  if (out.includes(alvoResolver)) {
    const novoResolver = `const cacheLidAizen = globalThis.__AIZEN_LID_CACHE__ || (globalThis.__AIZEN_LID_CACHE__ = new Map());\n\nasync function resolverDestino(client, destino) {\n  if (!destino.endsWith(\"@lid\")) return destino;\n\n  const emCache = cacheLidAizen.get(destino);\n  if (emCache?.endsWith(\"@c.us\")) {\n    return emCache;\n  }\n\n  try {`;
    out = out.replace(alvoResolver, novoResolver);

    const alvoSucesso = `    if (numeroWhatsApp?.endsWith(\"@c.us\")) {\n      console.log(\`🔎 Contato LID resolvido para \${numeroWhatsApp}\`);\n      return numeroWhatsApp;\n    }`;
    const sucessoComCache = `    if (numeroWhatsApp?.endsWith(\"@c.us\")) {\n      cacheLidAizen.set(destino, numeroWhatsApp);\n      console.log(\`🔎 Contato LID resolvido para \${numeroWhatsApp}\`);\n      return numeroWhatsApp;\n    }`;
    out = out.replace(alvoSucesso, sucessoComCache);
  } else {
    console.warn("⚠️ Runtime estável: resolverDestino não encontrado.");
  }

  const alvoListener = "    client.onMessage((msg) => processarMensagem(client, msg));";
  if (out.includes(alvoListener)) {
    const listenerNovo = `    const eventosAizenVistos = globalThis.__AIZEN_EVENTOS_VISTOS__ || (globalThis.__AIZEN_EVENTOS_VISTOS__ = new Map());\n\n    const idEventoAizen = (msg, origemContato, corpo) => {\n      const id = msg?.id?._serialized || msg?.id?.serialized || msg?.id?.id || (typeof msg?.id === \"string\" ? msg.id : \"\");\n      if (id) return String(id);\n      const ts = msg?.t || msg?.timestamp || msg?.ts || \"\";\n      return [origemContato, ts, corpo].join(\"|\");\n    };\n\n    const eventoJaVistoAizen = (chave) => {\n      const agora = Date.now();\n      const anterior = eventosAizenVistos.get(chave);\n      eventosAizenVistos.set(chave, agora);\n\n      if (eventosAizenVistos.size > 1200) {\n        for (const [k, quando] of eventosAizenVistos) {\n          if (agora - quando > 120000) eventosAizenVistos.delete(k);\n        }\n      }\n\n      return Boolean(anterior && agora - anterior < 120000);\n    };\n\n    const receberMensagemAizen = async (origem, msg) => {\n      if (!msg || msg.fromMe || msg.isGroupMsg) return;\n\n      const corpo = String(msg.body || msg.content || msg.caption || \"\").trim();\n      let origemContato = String(msg.from || msg.chatId || \"\");\n\n      // Status, canais, listas e broadcasts geravam centenas de eventos e logs\n      // desnecessários. Filtramos antes de qualquer resolução LID ou processamento.\n      if (\n        !origemContato ||\n        origemContato === \"status@broadcast\" ||\n        origemContato.endsWith(\"@g.us\") ||\n        origemContato.endsWith(\"@broadcast\") ||\n        origemContato.endsWith(\"@newsletter\")\n      ) return;\n\n      const chaveEvento = idEventoAizen(msg, origemContato, corpo);\n      if (eventoJaVistoAizen(chaveEvento)) return;\n\n      if (origemContato.endsWith(\"@lid\")) {\n        const cache = globalThis.__AIZEN_LID_CACHE__ || (globalThis.__AIZEN_LID_CACHE__ = new Map());\n        let numeroReal = cache.get(origemContato);\n\n        const candidatosEvento = [\n          msg?.sender?.id?._serialized,\n          msg?.sender?.id,\n          msg?.sender?._serialized,\n          msg?.id?.remote?._serialized,\n          msg?.id?.remote,\n          msg?.chatId?._serialized,\n          msg?.chatId,\n          msg?.author,\n        ].filter((x) => typeof x === \"string\");\n\n        if (!numeroReal) {\n          numeroReal = candidatosEvento.find((x) => x.endsWith(\"@c.us\"));\n        }\n\n        if (!numeroReal && typeof client.getPnLidEntry === \"function\") {\n          try {\n            const mapeamento = await Promise.race([\n              client.getPnLidEntry(origemContato),\n              new Promise((_, reject) => setTimeout(() => reject(new Error(\"timeout LID de 5s\")), 5000)),\n            ]);\n            numeroReal = mapeamento?.phoneNumber?._serialized || \"\";\n          } catch (error) {\n            console.warn(\`⚠️ Conversão rápida do LID falhou para \${origemContato}:\`, error?.message || error);\n          }\n        }\n\n        if (numeroReal?.endsWith(\"@c.us\")) {\n          cache.set(origemContato, numeroReal);\n          try { msg.from = numeroReal; } catch (_) {}\n          origemContato = numeroReal;\n          console.log(\`🔁 Entrada LID normalizada antes do funil: \${numeroReal}\`);\n        } else {\n          console.warn(\`⛔ Mensagem LID não processada sem número real: \${origemContato}.\`);\n          return;\n        }\n      }\n\n      console.log(\`📨 Aizen recebeu [\${origem}] de \${origemContato} body=\${JSON.stringify(corpo.slice(0, 120))}\`);\n\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar mensagem recebida:\", error?.message || error);\n      });\n    };\n\n    client.onMessage((msg) => void receberMensagemAizen(\"onMessage\", msg));\n\n    // Mantém onAnyMessage apenas como contingência. O deduplicador acima impede\n    // que a mesma mensagem privada seja processada duas vezes.\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => void receberMensagemAizen(\"onAnyMessage\", msg));\n      console.log(\"🛟 Recepção redundante ativa com deduplicação de eventos.\");\n    }\n\n    // Watchdog oficial do WPPConnect: monitora a conexão com o telefone sem\n    // fazer polling manual no Chromium nem interferir nos eventos de mensagem.\n    if (typeof client.startPhoneWatchdog === \"function\") {\n      try {\n        client.startPhoneWatchdog(30000);\n        console.log(\"💓 Phone watchdog oficial ativo a cada 30s.\");\n      } catch (error) {\n        console.warn(\"⚠️ Não foi possível iniciar phone watchdog:\", error?.message || error);\n      }\n    }\n\n    if (typeof client.onStateChange === \"function\") {\n      let timerRecuperacao = null;\n      const estadosCriticos = new Set([\"DISCONNECTED\", \"UNPAIRED\", \"UNPAIRED_IDLE\", \"CONFLICT\", \"TIMEOUT\"]);\n\n      client.onStateChange((estado) => {\n        const atual = String(estado || \"\").toUpperCase();\n        console.log(\`💓 Estado WhatsApp: \${atual || \"desconhecido\"}\`);\n\n        if (!estadosCriticos.has(atual)) {\n          if (timerRecuperacao) {\n            clearTimeout(timerRecuperacao);\n            timerRecuperacao = null;\n            console.log(\"✅ Conexão do WhatsApp se recuperou sem reinício.\");\n          }\n          return;\n        }\n\n        if (timerRecuperacao) return;\n        console.warn(\`⚠️ Estado crítico \${atual}; aguardando 45s para recuperação automática.\`);\n        timerRecuperacao = setTimeout(() => {\n          console.error(\`♻️ WhatsApp permaneceu em \${atual}. Reiniciando o processo para restaurar a sessão persistida.\`);\n          process.exit(1);\n        }, 45000);\n      });\n    }`;
    out = out.replace(alvoListener, listenerNovo);
  } else {
    console.warn("⚠️ Runtime estável: registro onMessage não encontrado.");
  }

  console.log(`✅ Runtime WhatsApp estável: Web ${WHATSAPP_WEB_COMPATIVEL}, deduplicação, filtro de broadcasts e auto-recuperação.`);
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchLegacy(content) : content;
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = `async function resolverDestino(client, destino) {\n  if (!destino.endsWith(\"@lid\")) return destino;\n\n  try {\n    const mapeamento = await client.getPnLidEntry(destino);\n    const numeroWhatsApp = mapeamento?.phoneNumber?._serialized;\n\n    if (numeroWhatsApp?.endsWith(\"@c.us\")) {\n      console.log(\`🔎 Contato LID resolvido para \${numeroWhatsApp}\`);\n      return numeroWhatsApp;\n    }\n  } catch (error) {}\n\n  return destino;\n}\n\nasync function iniciar() {\n    const puppeteerOptions = { timeout: 120000 };\n    const client = await wppconnect.create({\n      updatesLog: true,\n    });\n    client.onMessage((msg) => processarMensagem(client, msg));\n}`;
  const novo = patchLegacy(base);
  assert.match(novo, /2\.3000\.1047113681-alpha/);
  assert.match(novo, /protocolTimeout: 20000/);
  assert.match(novo, /cacheLidAizen/);
  assert.match(novo, /status@broadcast/);
  assert.match(novo, /eventosAizenVistos/);
  assert.match(novo, /startPhoneWatchdog\(30000\)/);
  assert.match(novo, /process\.exit\(1\)/);
  console.log("✅ Self-test do runtime WhatsApp estável aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchLegacy, WHATSAPP_WEB_COMPATIVEL };
