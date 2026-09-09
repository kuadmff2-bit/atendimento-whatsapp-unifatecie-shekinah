const MIN_INTERVAL_MS = Math.max(700, Number(process.env.WA_MIN_SEND_INTERVAL_MS || 1200));
const MAX_PER_MINUTE = Math.max(5, Number(process.env.WA_MAX_SENDS_PER_MINUTE || 24));
const MAX_UNIQUE_PER_HOUR = Math.max(10, Number(process.env.WA_MAX_UNIQUE_CONTACTS_PER_HOUR || 60));
const DUPLICATE_WINDOW_MS = Math.max(1000, Number(process.env.WA_DUPLICATE_WINDOW_MS || 5000));

const estados = new WeakMap();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarDestino(destino = "") {
  return String(destino || "").trim().toLowerCase();
}

function destinoBloqueado(destino = "") {
  const d = normalizarDestino(destino);
  return (
    !d ||
    d === "status@broadcast" ||
    d.endsWith("@g.us") ||
    d.endsWith("@broadcast") ||
    d.endsWith("@newsletter")
  );
}

function estadoPara(instancia) {
  let e = estados.get(instancia);
  if (!e) {
    e = {
      ultimosEnvios: new Map(),
      ultimasMensagens: new Map(),
      enviosRecentes: [],
      contatosRecentes: new Map(),
      fila: Promise.resolve(),
    };
    estados.set(instancia, e);
  }
  return e;
}

function limparJanelas(e, agora) {
  while (e.enviosRecentes.length && agora - e.enviosRecentes[0] >= 60_000) {
    e.enviosRecentes.shift();
  }
  for (const [destino, instante] of e.contatosRecentes) {
    if (agora - instante >= 60 * 60_000) e.contatosRecentes.delete(destino);
  }
  for (const [chave, instante] of e.ultimasMensagens) {
    if (agora - instante >= DUPLICATE_WINDOW_MS) e.ultimasMensagens.delete(chave);
  }
}

async function aguardarLimites(e, destino) {
  for (;;) {
    const agora = Date.now();
    limparJanelas(e, agora);
    const ultimo = e.ultimosEnvios.get(destino) || 0;
    const esperaDestino = Math.max(0, MIN_INTERVAL_MS - (agora - ultimo));
    const esperaMinuto = e.enviosRecentes.length >= MAX_PER_MINUTE
      ? Math.max(0, 60_000 - (agora - e.enviosRecentes[0]) + 50)
      : 0;
    const espera = Math.max(esperaDestino, esperaMinuto);
    if (espera <= 0) return;
    await sleep(espera);
  }
}

function instalarSenderSemAck() {
  try {
    const modulo = require("@wppconnect-team/wppconnect/dist/api/layers/sender.layer");
    const SenderLayer = modulo?.SenderLayer || modulo?.default;
    if (!SenderLayer?.prototype?.sendText) {
      throw new Error("SenderLayer.sendText não encontrado");
    }
    if (SenderLayer.prototype.sendText.__aizenNoAckV2) return true;

    const original = SenderLayer.prototype.sendText;

    async function sendTextAizen(to, content, options = {}) {
      const instancia = this;
      const e = estadoPara(instancia);
      const destino = normalizarDestino(to);
      const corpo = String(content || "");

      const tarefa = async () => {
        if (destinoBloqueado(destino)) {
          throw new Error(`Envio bloqueado por segurança para destino não privado: ${to}`);
        }

        const agora = Date.now();
        limparJanelas(e, agora);

        if (!e.contatosRecentes.has(destino) && e.contatosRecentes.size >= MAX_UNIQUE_PER_HOUR) {
          throw new Error(`Limite de ${MAX_UNIQUE_PER_HOUR} contatos únicos por hora atingido.`);
        }

        const chaveDuplicata = `${destino}\n${corpo.trim()}`;
        const igualEm = e.ultimasMensagens.get(chaveDuplicata) || 0;
        if (corpo.trim() && agora - igualEm < DUPLICATE_WINDOW_MS) {
          console.warn(`🛡️ Resposta duplicada bloqueada para ${destino}.`);
          return { skipped: true, reason: "duplicate", destination: destino };
        }

        await aguardarLimites(e, destino);

        const page = instancia?.page;
        let resultado;

        if (page && typeof page.evaluate === "function") {
          resultado = await Promise.race([
            page.evaluate(
              async ({ destinoFinal, textoFinal, opcoesFinais }) => {
                const wpp = globalThis.WPP;
                if (!wpp?.chat?.sendTextMessage) {
                  throw new Error("WPP.chat.sendTextMessage indisponível");
                }

                const enviado = await wpp.chat.sendTextMessage(destinoFinal, textoFinal, {
                  ...(opcoesFinais || {}),
                  waitForAck: false,
                });

                const serializar = (valor) => {
                  if (!valor) return "";
                  if (typeof valor === "string") return valor;
                  if (typeof valor?._serialized === "string") return valor._serialized;
                  try {
                    const s = valor?.toString?.();
                    return s && s !== "[object Object]" ? String(s) : "";
                  } catch (_) {
                    return "";
                  }
                };

                return {
                  id: serializar(enviado?.id) || `aizen-${Date.now()}`,
                  ack: Number.isFinite(Number(enviado?.ack)) ? Number(enviado.ack) : 0,
                  from: serializar(enviado?.from),
                  to: serializar(enviado?.to) || destinoFinal,
                  sendMsgResult: null,
                };
              },
              {
                destinoFinal: String(to || ""),
                textoFinal: corpo,
                opcoesFinais: options && typeof options === "object" ? options : {},
              }
            ),
            new Promise((_, reject) => {
              const timer = setTimeout(() => reject(new Error(`Timeout no envio sem ACK para ${destino}`)), 5000);
              timer.unref?.();
            }),
          ]);
        } else {
          resultado = await original.call(instancia, to, content, options);
        }

        if (!resultado) throw new Error("WhatsApp não confirmou o enfileiramento da mensagem");

        const enviadoEm = Date.now();
        e.enviosRecentes.push(enviadoEm);
        e.ultimosEnvios.set(destino, enviadoEm);
        e.contatosRecentes.set(destino, enviadoEm);
        if (corpo.trim()) e.ultimasMensagens.set(chaveDuplicata, enviadoEm);

        console.log(`⚡ Mensagem enfileirada sem aguardar ACK para ${destino}.`);
        return resultado;
      };

      const promessa = e.fila.then(tarefa, tarefa);
      e.fila = promessa.catch(() => undefined);
      return promessa;
    }

    sendTextAizen.__aizenNoAckV2 = true;
    SenderLayer.prototype.sendText = sendTextAizen;
    console.log("⚡ Transporte de texto sem espera de ACK instalado diretamente no SenderLayer.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível instalar transporte sem ACK:", error?.message || error);
    return false;
  }
}

function instalarFiltroBacklogNoListener() {
  try {
    const modulo = require("@wppconnect-team/wppconnect/dist/api/layers/listener.layer");
    const ListenerLayer = modulo?.ListenerLayer || modulo?.default;
    if (!ListenerLayer?.prototype?.onMessage) {
      throw new Error("ListenerLayer.onMessage não encontrado");
    }
    if (ListenerLayer.prototype.onMessage.__aizenBacklogV2) return true;

    const original = ListenerLayer.prototype.onMessage;

    function onMessageComFiltro(callback) {
      const retorno = original.call(this, callback);
      const page = this?.page;
      const corte = Math.floor(Date.now() / 1000) - 8;

      if (page && typeof page.evaluate === "function") {
        Promise.resolve(
          page.evaluate((corteSegundos) => {
            if (globalThis.__AIZEN_BACKLOG_FILTER_V2__) return { ok: true, status: "already-installed" };

            const ts = (m = {}) => {
              let valor = Number(
                m?.t || m?.timestamp || m?.ts || m?._data?.t || m?._data?.timestamp || m?.data?.timestamp || m?.id?.t || 0
              );
              if (!Number.isFinite(valor) || valor <= 0) return 0;
              if (valor > 100000000000) valor = Math.floor(valor / 1000);
              return valor;
            };

            const envolver = (nome) => {
              const fn = globalThis[nome];
              if (typeof fn !== "function" || fn.__aizenBacklogFilterV2) return false;
              const wrapper = (...args) => {
                const t = ts(args?.[0] || {});
                if (t && t < corteSegundos) return undefined;
                return fn(...args);
              };
              wrapper.__aizenBacklogFilterV2 = true;
              wrapper.exposed = fn.exposed;
              globalThis[nome] = wrapper;
              return true;
            };

            const a = envolver("onMessage");
            const b = envolver("onAnyMessage");
            globalThis.__AIZEN_BACKLOG_FILTER_V2__ = true;
            return { ok: true, status: "installed", onMessage: a, onAnyMessage: b };
          }, corte)
        )
          .then((r) => {
            if (r?.ok) console.log("🧹 Filtro de backlog antigo ativo nos eventos WhatsApp.");
          })
          .catch((error) => console.warn("⚠️ Falha no filtro de backlog:", error?.message || error));
      }

      return retorno;
    }

    onMessageComFiltro.__aizenBacklogV2 = true;
    ListenerLayer.prototype.onMessage = onMessageComFiltro;
    console.log("🧹 Filtro de backlog preparado no ListenerLayer.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível preparar filtro de backlog:", error?.message || error);
    return false;
  }
}

const senderInstalado = instalarSenderSemAck();
const backlogInstalado = instalarFiltroBacklogNoListener();

module.exports = {
  instalarSenderSemAck,
  instalarFiltroBacklogNoListener,
  senderInstalado,
  backlogInstalado,
};
