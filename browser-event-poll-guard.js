function instalarFallbackBrowser() {
  try {
    const modulo = require("@wppconnect-team/wppconnect/dist/api/layers/listener.layer");
    const ListenerLayer = modulo?.ListenerLayer || modulo?.default;
    if (!ListenerLayer?.prototype?.onMessage) {
      throw new Error("ListenerLayer.onMessage não encontrado");
    }

    if (ListenerLayer.prototype.onMessage.__aizenBrowserPoll) return true;

    const anterior = ListenerLayer.prototype.onMessage;

    function onMessageComFallbackBrowser(callback) {
      const retorno = anterior.call(this, callback);
      const page = this?.page;

      if (page && typeof page.evaluate === "function") {
        Promise.resolve(
          page.evaluate(() => {
            if (globalThis.__AIZEN_WAPI_POLL_V1__) {
              return { ok: true, status: "already-installed" };
            }

            const wapi = globalThis.WAPI;
            if (!wapi) return { ok: false, status: "WAPI-unavailable" };

            const temUnread = typeof wapi.getAllUnreadMessages === "function";
            const temNew = typeof wapi.getAllNewMessages === "function";
            if (!temUnread && !temNew) {
              return {
                ok: false,
                status: "WAPI-message-retrievers-unavailable",
                methods: Object.keys(wapi).filter((k) => /message/i.test(k)).slice(0, 30),
              };
            }

            globalThis.__AIZEN_WAPI_POLL_V1__ = true;
            const iniciadoEm = Math.floor(Date.now() / 1000) - 10;
            const vistos = new Set();
            let rodando = false;

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
              let ts = Number(m?.t || m?.timestamp || m?.ts || m?._data?.t || m?._data?.timestamp || 0);
              if (!Number.isFinite(ts) || ts <= 0) return 0;
              if (ts > 100000000000) ts = Math.floor(ts / 1000);
              return ts;
            };

            const fromId = (m = {}) => {
              const valor = m?.from || m?.chatId || m?.id?.remote || m?._data?.from;
              if (!valor) return "";
              if (typeof valor === "string") return valor;
              if (typeof valor?._serialized === "string") return valor._serialized;
              if (valor?.user && valor?.server) return String(valor.user) + "@" + String(valor.server);
              try {
                const s = valor?.toString?.();
                return s && s !== "[object Object]" ? String(s) : "";
              } catch (_) {
                return "";
              }
            };

            const body = (m = {}) => {
              const candidatos = [m?.body, m?.content, m?.caption, m?.text, m?._data?.body, m?._data?.content];
              return candidatos.find((x) => typeof x === "string" && x.trim()) || "";
            };

            const emitir = (m) => {
              if (!m || m?.fromMe) return false;
              const from = fromId(m);
              if (!from || from === "status@broadcast" || from.endsWith("@g.us") || from.endsWith("@broadcast") || from.endsWith("@newsletter")) {
                return false;
              }

              const texto = body(m);
              if (!texto) return false;

              const ts = timestamp(m);
              if (ts && ts < iniciadoEm) return false;

              const chave = idMensagem(m) || [from, ts, texto].join("|");
              if (vistos.has(chave)) return false;
              vistos.add(chave);

              if (vistos.size > 2000) {
                let removidos = 0;
                for (const antiga of vistos) {
                  vistos.delete(antiga);
                  if (++removidos >= 500) break;
                }
              }

              if (typeof globalThis.onMessage === "function") {
                globalThis.onMessage(m);
                return true;
              }
              return false;
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

                for (const msg of lotes) emitir(msg);
              } finally {
                rodando = false;
              }
            };

            const timer = setInterval(() => void varrer(), 2000);
            globalThis.__AIZEN_WAPI_POLL_TIMER__ = timer;
            setTimeout(() => void varrer(), 500);

            return {
              ok: true,
              status: "installed",
              temUnread,
              temNew,
            };
          })
        )
          .then((resultado) => {
            if (resultado?.ok) {
              console.log(
                "📡 Fallback WAPI interno ativo: mensagens novas/não lidas verificadas dentro do navegador.",
                resultado.status || ""
              );
            } else {
              console.warn("⚠️ Fallback WAPI interno não pôde ser ativado:", resultado?.status || resultado);
            }
          })
          .catch((error) => {
            console.warn("⚠️ Falha ao instalar fallback WAPI interno:", error?.message || error);
          });
      }

      return retorno;
    }

    onMessageComFallbackBrowser.__aizenBrowserPoll = true;
    ListenerLayer.prototype.onMessage = onMessageComFallbackBrowser;
    console.log("📡 Fallback WAPI interno preparado no ListenerLayer.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível preparar fallback WAPI interno:", error?.message || error);
    return false;
  }
}

const preparado = instalarFallbackBrowser();

function selfTest() {
  const assert = require("assert");
  assert.equal(typeof preparado, "boolean");
  console.log("✅ Self-test do fallback WAPI interno aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { instalarFallbackBrowser };
