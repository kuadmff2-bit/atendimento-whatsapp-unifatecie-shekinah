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

  // Evita que uma chamada presa do Chromium deixe uma conversa bloqueada por
  // vários minutos. Operações normais do WhatsApp Web concluem em segundos.
  out = out.replace(
    "    const puppeteerOptions = { timeout: 120000 };",
    "    const puppeteerOptions = { timeout: 120000, protocolTimeout: 20000 };"
  );

  // Cache compartilhado de LID -> número real. O WhatsApp atual entrega muitas
  // conversas privadas como @lid. Responder para esse identificador pode ficar
  // preso; por isso convertemos uma vez e reutilizamos o @c.us.
  const alvoResolver = `async function resolverDestino(client, destino) {\n  if (!destino.endsWith(\"@lid\")) return destino;\n\n  try {`;
  if (out.includes(alvoResolver)) {
    const novoResolver = `const cacheLidAizen = globalThis.__AIZEN_LID_CACHE__ || (globalThis.__AIZEN_LID_CACHE__ = new Map());\n\nasync function resolverDestino(client, destino) {\n  if (!destino.endsWith(\"@lid\")) return destino;\n\n  const emCache = cacheLidAizen.get(destino);\n  if (emCache?.endsWith(\"@c.us\")) {\n    console.log(\`⚡ LID em cache: \${destino} -> \${emCache}\`);\n    return emCache;\n  }\n\n  try {`;
    out = out.replace(alvoResolver, novoResolver);

    const alvoSucesso = `    if (numeroWhatsApp?.endsWith(\"@c.us\")) {\n      console.log(\`🔎 Contato LID resolvido para \${numeroWhatsApp}\`);\n      return numeroWhatsApp;\n    }`;
    const sucessoComCache = `    if (numeroWhatsApp?.endsWith(\"@c.us\")) {\n      cacheLidAizen.set(destino, numeroWhatsApp);\n      console.log(\`🔎 Contato LID resolvido para \${numeroWhatsApp}\`);\n      return numeroWhatsApp;\n    }`;
    out = out.replace(alvoSucesso, sucessoComCache);
  } else {
    console.warn("⚠️ Runtime estável: resolverDestino não encontrado.");
  }

  // Usa somente os eventos públicos do WPPConnect. Antes de entregar a mensagem
  // ao funil, converte @lid para @c.us. Isso impede que o próprio responder()
  // faça uma nova consulta LID e congele o Chromium na hora da resposta.
  const alvoListener = "    client.onMessage((msg) => processarMensagem(client, msg));";
  if (out.includes(alvoListener)) {
    const listenerNovo = `    const receberMensagemAizen = async (origem, msg) => {\n      if (!msg || msg.fromMe || msg.isGroupMsg) return;\n\n      const corpo = String(msg.body || msg.content || msg.caption || \"\").trim();\n      let origemContato = String(msg.from || msg.chatId || \"desconhecido\");\n\n      if (origemContato.endsWith(\"@lid\")) {\n        const cache = globalThis.__AIZEN_LID_CACHE__ || (globalThis.__AIZEN_LID_CACHE__ = new Map());\n        let numeroReal = cache.get(origemContato);\n\n        const candidatosEvento = [\n          msg?.sender?.id?._serialized,\n          msg?.sender?.id,\n          msg?.sender?._serialized,\n          msg?.id?.remote?._serialized,\n          msg?.id?.remote,\n          msg?.chatId?._serialized,\n          msg?.chatId,\n          msg?.author,\n        ].filter((x) => typeof x === \"string\");\n\n        if (!numeroReal) {\n          numeroReal = candidatosEvento.find((x) => x.endsWith(\"@c.us\"));\n        }\n\n        if (!numeroReal && typeof client.getPnLidEntry === \"function\") {\n          try {\n            const mapeamento = await Promise.race([\n              client.getPnLidEntry(origemContato),\n              new Promise((_, reject) => setTimeout(() => reject(new Error(\"timeout LID de 5s\")), 5000)),\n            ]);\n            numeroReal = mapeamento?.phoneNumber?._serialized || \"\";\n          } catch (error) {\n            console.warn(\`⚠️ Conversão rápida do LID falhou para \${origemContato}:\`, error?.message || error);\n          }\n        }\n\n        if (numeroReal?.endsWith(\"@c.us\")) {\n          cache.set(origemContato, numeroReal);\n          try { msg.from = numeroReal; } catch (_) {}\n          origemContato = numeroReal;\n          console.log(\`🔁 Entrada LID normalizada antes do funil: \${numeroReal}\`);\n        } else {\n          console.warn(\`⛔ Mensagem LID não processada sem número real: \${origemContato}. Evitando travar o WhatsApp.\`);\n          return;\n        }\n      }\n\n      console.log(\`📨 Aizen recebeu [\${origem}] de \${origemContato} body=\${JSON.stringify(corpo.slice(0, 120))}\`);\n\n      Promise.resolve(processarMensagem(client, msg)).catch((error) => {\n        console.error(\"❌ Falha ao processar mensagem recebida:\", error?.message || error);\n      });\n    };\n\n    client.onMessage((msg) => void receberMensagemAizen(\"onMessage\", msg));\n\n    if (typeof client.onAnyMessage === \"function\") {\n      client.onAnyMessage((msg) => void receberMensagemAizen(\"onAnyMessage\", msg));\n      console.log(\"🛟 Recepção redundante oficial ativa: onMessage + onAnyMessage.\");\n    }`;
    out = out.replace(alvoListener, listenerNovo);
  } else {
    console.warn("⚠️ Runtime estável: registro onMessage não encontrado.");
  }

  console.log(`✅ Runtime WhatsApp simplificado: Web ${WHATSAPP_WEB_COMPATIVEL}, LID normalizado e eventos nativos.`);
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
  assert.match(novo, /Entrada LID normalizada antes do funil/);
  assert.match(novo, /onAnyMessage/);
  console.log("✅ Self-test do runtime WhatsApp/LID aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchLegacy, WHATSAPP_WEB_COMPATIVEL };
