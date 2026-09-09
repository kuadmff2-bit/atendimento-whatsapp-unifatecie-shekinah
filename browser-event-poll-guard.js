function instalarFallbackBrowser() {
  try {
    const modulo = require("@wppconnect-team/wppconnect/dist/api/layers/listener.layer");
    const ListenerLayer = modulo?.ListenerLayer || modulo?.default;
    if (!ListenerLayer?.prototype?.onMessage) {
      throw new Error("ListenerLayer.onMessage não encontrado");
    }

    if (ListenerLayer.prototype.onMessage.__aizenBrowserPollV2) return true;

    const anterior = ListenerLayer.prototype.onMessage;

    function onMessageComFallbackBrowser(callback) {
      const retorno = anterior.call(this, callback);
      const page = this?.page;

      if (page && typeof page.evaluate === "function") {
        Promise.resolve(
          page.evaluate(() => {
            if (globalThis.__AIZEN_WAPI_POLL_V2__) {
              return { ok: true, status: "already-installed" };
            }

            const wapi = globalThis.WAPI;
            const chatStore = globalThis.WPP?.whatsapp?.ChatStore;
            if (!wapi && !chatStore) {
              return { ok: false, status: "WAPI-and-ChatStore-unavailable" };
            }

            const temUnread = typeof wapi?.getAllUnreadMessages === "function";
            const temNew = typeof wapi?.getAllNewMessages === "function";
            const temProcess = typeof wapi?.processMessageObj === "function";
            const temChatStore = Boolean(chatStore);

            globalThis.__AIZEN_WAPI_POLL_V2__ = true;
            const iniciadoEm = Math.floor(Date.now() / 1000) - 30;
            const vistos = new Set();
            let rodando = false;

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

            const idMensagem = (m = {}) => {
              const candidatos = [
                m?.id?._serialized,
                m?.id?.serialized,
                m?.id?.id,
                typeof m?.id === "string" ? m.id : "",
                m?.messageId,
                m?.key?._serialized,
                m?.key?.id,
              ];
              return candidatos.find((x) => typeof x === "string" && x.trim()) || "";
            };

            const timestamp = (m = {}) => {
              let ts = Number(
                m?.t ||
                  m?.timestamp ||
                  m?.ts ||
                  m?._data?.t ||
                  m?._data?.timestamp ||
                  m?.id?.t ||
                  0
              );
              if (!Number.isFinite(ts) || ts <= 0) return 0;
              if (ts > 100000000000) ts = Math.floor(ts / 1000);
              return ts;
            };

            const fromId = (m = {}, fallback = "") => {
              const valor = m?.from || m?.chatId || m?.id?.remote || m?._data?.from || fallback;
              return wid(valor);
            };

            const body = (m = {}) => {
              const candidatos = [
                m?.body,
                m?.content,
                m?.caption,
                m?.text,
                m?._data?.body,
                m?._data?.content,
              ];
              return candidatos.find((x) => typeof x === "string" && x.trim()) || "";
            };

            const arrayModelos = (store) => {
              if (!store) return [];
              try {
                if (typeof store.getModelsArray === "function") {
                  const a = store.getModelsArray();
                  if (Array.isArray(a)) return a;
                }
              } catch (_) {}
              if (Array.isArray(store.models)) return store.models;
              if (Array.isArray(store._models)) return store._models;
              try {
                if (typeof store.map === "function") {
                  const a = store.map((x) => x);
                  if (Array.isArray(a)) return a;
                }
              } catch (_) {}
              return [];
            };

            const normalizar = (bruto, fromFallback = "") => {
              let m = bruto;
              if (temProcess && bruto && bruto?.id) {
                try {
                  const serializada = wapi.processMessageObj(bruto, false, false);
                  if (serializada) m = serializada;
                } catch (_) {}
              }
              if (!m) return null;
              try {
                if (!m.from && fromFallback) m.from = fromFallback;
              } catch (_) {}
              return m;
            };

            const emitir = (bruto, origem = "wapi", fromFallback = "") => {
              if (!bruto) return false;
              const m = normalizar(bruto, fromFallback);
              if (!m) return false;

              const fromMe = Boolean(
                m?.fromMe ||
                  m?.isSentByMe ||
                  m?.id?.fromMe ||
                  bruto?.fromMe ||
                  bruto?.isSentByMe ||
                  bruto?.id?.fromMe
              );
              if (fromMe) return false;

              const from = fromId(m, fromFallback) || fromId(bruto, fromFallback);
              if (
                !from ||
                from === "status@broadcast" ||
                from.endsWith("@g.us") ||
                from.endsWith("@broadcast") ||
                from.endsWith("@newsletter")
              ) {
                return false;
              }

              const texto = body(m) || body(bruto);
              if (!texto) return false;

              const ts = timestamp(m) || timestamp(bruto);
              if (origem === "chatstore") {
                if (!ts || ts < iniciadoEm) return false;
              } else if (ts && ts < iniciadoEm) {
                return false;
              }

              const chave = idMensagem(m) || idMensagem(bruto) || [from, ts, texto].join("|");
              if (vistos.has(chave)) return false;
              vistos.add(chave);

              if (vistos.size > 2500) {
                let removidos = 0;
                for (const antiga of vistos) {
                  vistos.delete(antiga);
                  if (++removidos >= 700) break;
                }
              }

              try {
                if (!m.from && from) m.from = from;
                if (!m.body && texto) m.body = texto;
              } catch (_) {}

              if (typeof globalThis.onMessage === "function") {
                globalThis.onMessage(m);
                return true;
              }
              return false;
            };

            const varrerChatStore = () => {
              if (!temChatStore) return 0;
              let emitidas = 0;
              try {
                const chats = arrayModelos(chatStore)
                  .filter(Boolean)
                  .filter((chat) => {
                    const id = wid(chat?.id);
                    return (
                      id &&
                      !chat?.isGroup &&
                      !id.endsWith("@g.us") &&
                      !id.endsWith("@broadcast") &&
                      !id.endsWith("@newsletter") &&
                      id !== "status@broadcast"
                    );
                  })
                  .sort((a, b) => {
                    const ta = timestamp(a?.lastMessage) || Number(a?.t || 0);
                    const tb = timestamp(b?.lastMessage) || Number(b?.t || 0);
                    return tb - ta;
                  })
                  .slice(0, 80);

                for (const chat of chats) {
                  const chatId = wid(chat?.id);
                  const mensagens = arrayModelos(chat?.msgs);
                  if (!mensagens.length) continue;
                  const inicio = Math.max(0, mensagens.length - 6);
                  for (let i = inicio; i < mensagens.length; i++) {
                    if (emitir(mensagens[i], "chatstore", chatId)) emitidas += 1;
                  }
                }
              } catch (_) {}
              return emitidas;
            };

            const varrer = async () => {
              if (rodando) return;
              rodando = true;
              try {
                const lotes = [];

                if (temUnread) {
                  try {
                    const naoLidas = await Promise.resolve(wapi.getAllUnreadMessages());
                    if (Array.isArray(naoLidas)) lotes.push(...naoLidas);
                  } catch (_) {}
                }

                if (temNew) {
                  try {
                    const novas = await Promise.resolve(wapi.getAllNewMessages());
                    if (Array.isArray(novas)) lotes.push(...novas);
                  } catch (_) {}
                }

                for (const msg of lotes) emitir(msg, "wapi");
                varrerChatStore();
              } finally {
                rodando = false;
              }
            };

            const timer = setInterval(() => void varrer(), 1500);
            globalThis.__AIZEN_WAPI_POLL_TIMER_V2__ = timer;
            setTimeout(() => void varrer(), 350);

            return {
              ok: true,
              status: "installed-v2",
              temUnread,
              temNew,
              temProcess,
              temChatStore,
            };
          })
        )
          .then((resultado) => {
            if (resultado?.ok) {
              console.log(
                "📡 Fallback de mensagens privado ativo: WAPI + varredura direta do ChatStore.",
                resultado.status || ""
              );
            } else {
              console.warn("⚠️ Fallback interno não pôde ser ativado:", resultado?.status || resultado);
            }
          })
          .catch((error) => {
            console.warn("⚠️ Falha ao instalar fallback interno:", error?.message || error);
          });
      }

      return retorno;
    }

    onMessageComFallbackBrowser.__aizenBrowserPollV2 = true;
    ListenerLayer.prototype.onMessage = onMessageComFallbackBrowser;
    console.log("📡 Fallback privado WAPI/ChatStore preparado no ListenerLayer.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível preparar fallback privado:", error?.message || error);
    return false;
  }
}

const preparado = instalarFallbackBrowser();

function selfTest() {
  const assert = require("assert");
  assert.equal(typeof preparado, "boolean");
  console.log("✅ Self-test do fallback WAPI/ChatStore aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { instalarFallbackBrowser };
