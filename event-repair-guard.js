const Module = require("module");
const previousCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function removerPollingNode(codigo = "") {
  let out = String(codigo);
  const inicioMarcador = "    const inicioPollingLight = Math.floor(Date.now() / 1000) - 12;";
  const fimMarcador = '    console.log("🛰️ Polling fallback de mensagens privadas ativo a cada 2,5 s.");\n';
  const inicio = out.indexOf(inicioMarcador);
  if (inicio < 0) return out;

  const fimInicio = out.indexOf(fimMarcador, inicio);
  if (fimInicio < 0) {
    console.warn("⚠️ Ponte de eventos: polling antigo encontrado, mas o fim do bloco não foi localizado.");
    return out;
  }

  let corteInicio = inicio;
  const comentario = out.lastIndexOf("\n    // Alguns builds recentes", inicio);
  if (comentario >= 0 && inicio - comentario < 600) corteInicio = comentario + 1;

  const corteFim = fimInicio + fimMarcador.length;
  out =
    out.slice(0, corteInicio) +
    '    console.log("🛰️ Polling Node desativado; fallback agora roda dentro do WhatsApp Web.");\n' +
    out.slice(corteFim);

  console.log("🧹 Polling Node bloqueante removido do fluxo principal.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? removerPollingNode(content) : content;
  return previousCompile.call(this, patched, filename);
};

function instalarPonteNoListener() {
  try {
    const modulo = require("@wppconnect-team/wppconnect/dist/api/layers/listener.layer");
    const ListenerLayer = modulo?.ListenerLayer || modulo?.default;
    if (!ListenerLayer?.prototype?.onMessage) {
      throw new Error("ListenerLayer.onMessage não encontrado");
    }

    if (ListenerLayer.prototype.onMessage.__aizenEventRepair) return true;

    const original = ListenerLayer.prototype.onMessage;

    function onMessageReparado(callback) {
      const retorno = original.call(this, callback);
      const page = this?.page;

      if (page && typeof page.evaluate === "function") {
        Promise.resolve(
          page.evaluate(() => {
            if (globalThis.__AIZEN_EVENT_BRIDGE_V2__) {
              return { ok: true, status: "already-installed" };
            }

            const WPPGlobal = globalThis.WPP;
            const WAPIGlobal = globalThis.WAPI;
            const chat = WPPGlobal?.chat;
            if (!chat || typeof chat.on !== "function") {
              return {
                ok: false,
                status: "WPP.chat.on-unavailable",
                wppReady: Boolean(WPPGlobal),
                chatReady: Boolean(chat),
              };
            }

            globalThis.__AIZEN_EVENT_BRIDGE_V2__ = true;
            const iniciadoEm = Math.floor(Date.now() / 1000) - 15;
            const vistos = new Set();
            let varreduraEmAndamento = false;

            const wid = (valor) => {
              if (!valor) return "";
              if (typeof valor === "string") return valor;
              if (typeof valor?._serialized === "string") return valor._serialized;
              if (typeof valor?.serialized === "string") return valor.serialized;
              if (valor?.user && valor?.server) return String(valor.user) + "@" + String(valor.server);
              try {
                const s = valor?.toString?.();
                return s && s !== "[object Object]" ? String(s) : "";
              } catch (_) {
                return "";
              }
            };

            const timestamp = (m = {}) => {
              let ts = Number(m?.t || m?.timestamp || m?.ts || m?._data?.t || m?._data?.timestamp || 0);
              if (!Number.isFinite(ts) || ts <= 0) return 0;
              if (ts > 100000000000) ts = Math.floor(ts / 1000);
              return ts;
            };

            const idMensagem = (m = {}) => {
              const candidatos = [
                m?.id?._serialized,
                m?.id?.serialized,
                m?.id?.id,
                typeof m?.id === "string" ? m.id : "",
                m?.key?._serialized,
                m?.key?.id,
                m?.messageId,
              ];
              return candidatos.find((x) => typeof x === "string" && x) || "";
            };

            const texto = (m = {}) => {
              const candidatos = [m?.body, m?.content, m?.caption, m?.text, m?._data?.body, m?._data?.content];
              return candidatos.find((x) => typeof x === "string" && x.trim()) || "";
            };

            const normalizar = (m) => {
              if (!m) return null;
              try {
                if (WAPIGlobal?.processMessageObj && m?.id && !m?.fromMe && typeof m?.isSentByMe !== "undefined") {
                  const serializada = WAPIGlobal.processMessageObj(m, false, false);
                  if (serializada) return serializada;
                }
              } catch (_) {}
              return m;
            };

            const emitir = (origem, bruto) => {
              try {
                const m = normalizar(bruto);
                if (!m) return false;

                const fromMe = Boolean(m?.fromMe || m?.isSentByMe);
                const from = wid(m?.from) || wid(m?.chatId) || wid(m?.id?.remote) || wid(bruto?.from);
                if (fromMe || !from || from === "status@broadcast" || from.endsWith("@g.us") || from.endsWith("@broadcast") || from.endsWith("@newsletter")) {
                  return false;
                }

                const ts = timestamp(m) || timestamp(bruto);
                if (ts && ts < iniciadoEm) return false;

                const body = texto(m) || texto(bruto);
                if (!body) return false;

                const chave = idMensagem(m) || idMensagem(bruto) || [from, ts, body].join("|");
                if (vistos.has(chave)) return false;
                vistos.add(chave);
                if (vistos.size > 1500) {
                  let n = 0;
                  for (const antiga of vistos) {
                    vistos.delete(antiga);
                    if (++n >= 400) break;
                  }
                }

                try {
                  if (!m.from && from) m.from = from;
                  if (!m.body && body) m.body = body;
                } catch (_) {}

                if (typeof globalThis.onMessage === "function") {
                  globalThis.onMessage(m);
                  return true;
                }
              } catch (_) {}
              return false;
            };

            const comTimeout = (promessa, ms = 3500) =>
              Promise.race([
                Promise.resolve(promessa),
                new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
              ]);

            const buscarNaoLidasDoChat = async (chatId, maximo = 5) => {
              if (!chatId || typeof chat.getMessages !== "function") return;
              try {
                const mensagens = await comTimeout(chat.getMessages(chatId, { count: maximo, onlyUnread: true }), 3500);
                if (!Array.isArray(mensagens)) return;
                for (const m of mensagens) emitir("browser-unread", m);
              } catch (_) {}
            };

            chat.on("chat.new_message", (msg) => emitir("WPP.chat.new_message", msg));

            try {
              chat.on("chat.unread_count_changed", (evento) => {
                const atual = Number(evento?.unreadCount || evento?.chat?.unreadCount || 0);
                const anterior = Number(evento?.previousUnreadCount || 0);
                if (atual <= 0 || atual < anterior) return;
                const chatId = wid(evento?.chat?.id) || wid(evento?.chatId);
                void buscarNaoLidasDoChat(chatId, Math.min(Math.max(atual, 1), 5));
              });
            } catch (_) {}

            const timer = setInterval(async () => {
              if (varreduraEmAndamento) return;
              varreduraEmAndamento = true;
              try {
                if (typeof chat.list !== "function") return;
                const chats = await comTimeout(chat.list({ onlyUsers: true, count: 30 }), 3500);
                if (!Array.isArray(chats)) return;
                for (const item of chats) {
                  const unread = Number(item?.unreadCount || 0);
                  if (unread <= 0) continue;
                  const chatId = wid(item?.id);
                  await buscarNaoLidasDoChat(chatId, Math.min(unread, 5));
                }
              } catch (_) {
              } finally {
                varreduraEmAndamento = false;
              }
            }, 3000);

            globalThis.__AIZEN_EVENT_BRIDGE_TIMER__ = timer;
            return {
              ok: true,
              status: "installed",
              hasChatOn: typeof chat.on === "function",
              hasChatList: typeof chat.list === "function",
              hasGetMessages: typeof chat.getMessages === "function",
            };
          })
        )
          .then((resultado) => {
            if (resultado?.ok) {
              console.log(
                "🌉 Ponte WPP.chat ativa: eventos nativos + fallback interno de mensagens não lidas.",
                resultado.status || ""
              );
            } else {
              console.warn("⚠️ Ponte WPP.chat não pôde ser instalada:", resultado?.status || resultado);
            }
          })
          .catch((error) => {
            console.warn("⚠️ Falha ao instalar ponte WPP.chat:", error?.message || error);
          });
      }

      return retorno;
    }

    onMessageReparado.__aizenEventRepair = true;
    ListenerLayer.prototype.onMessage = onMessageReparado;
    console.log("🌉 Reparo de eventos WPP.chat instalado no ListenerLayer.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível preparar o reparo WPP.chat:", error?.message || error);
    return false;
  }
}

const pontePreparada = instalarPonteNoListener();

function selfTest() {
  const assert = require("assert");
  const base = `x\n    // Alguns builds recentes do WhatsApp Web entram em MAIN\n    const inicioPollingLight = Math.floor(Date.now() / 1000) - 12;\n    let pollingLightEmAndamento = false;\n    console.log("🛰️ Polling fallback de mensagens privadas ativo a cada 2,5 s.");\n    console.log("fim");`;
  const novo = removerPollingNode(base);
  assert.doesNotMatch(novo, /inicioPollingLight/);
  assert.match(novo, /Polling Node desativado/);
  assert.match(novo, /console\.log\("fim"\)/);
  assert.equal(typeof pontePreparada, "boolean");
  console.log("✅ Self-test da ponte de eventos WPP.chat aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { removerPollingNode, instalarPonteNoListener };
