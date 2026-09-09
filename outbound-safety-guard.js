const Module = require("module");
const originalLoad = Module._load;

const MIN_INTERVAL_MS = Math.max(900, Number(process.env.WA_MIN_SEND_INTERVAL_MS || 1400));
const MAX_PER_MINUTE = Math.max(5, Number(process.env.WA_MAX_SENDS_PER_MINUTE || 24));
const MAX_UNIQUE_PER_HOUR = Math.max(10, Number(process.env.WA_MAX_UNIQUE_CONTACTS_PER_HOUR || 60));
const DUPLICATE_WINDOW_MS = Math.max(1000, Number(process.env.WA_DUPLICATE_WINDOW_MS || 5000));

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

function instalarFiltroDeBacklog(client) {
  const page = client?.page;
  if (!page || typeof page.evaluate !== "function") return;

  const corte = Math.floor(Date.now() / 1000) - 8;
  Promise.resolve(
    page.evaluate((corteSegundos) => {
      if (globalThis.__AIZEN_EVENT_AGE_GUARD_V1__) {
        return { ok: true, status: "already-installed" };
      }

      const timestamp = (m = {}) => {
        let ts = Number(
          m?.t ||
            m?.timestamp ||
            m?.ts ||
            m?._data?.t ||
            m?._data?.timestamp ||
            m?.data?.timestamp ||
            m?.id?.t ||
            0
        );
        if (!Number.isFinite(ts) || ts <= 0) return 0;
        if (ts > 100000000000) ts = Math.floor(ts / 1000);
        return ts;
      };

      const envolver = (nome) => {
        const original = globalThis[nome];
        if (typeof original !== "function" || original.__aizenAgeGuard) return false;

        const protegido = (...args) => {
          const msg = args?.[0] || {};
          const ts = timestamp(msg);
          if (ts && ts < corteSegundos) return undefined;
          return original(...args);
        };

        protegido.__aizenAgeGuard = true;
        protegido.exposed = original.exposed;
        globalThis[nome] = protegido;
        return true;
      };

      const onMessage = envolver("onMessage");
      const onAnyMessage = envolver("onAnyMessage");
      globalThis.__AIZEN_EVENT_AGE_GUARD_V1__ = true;
      return { ok: true, status: "installed", onMessage, onAnyMessage, corteSegundos };
    }, corte)
  )
    .then((resultado) => {
      if (resultado?.ok) {
        console.log("🧹 Backlog antigo bloqueado na entrada dos eventos WhatsApp.");
      }
    })
    .catch((error) => {
      console.warn("⚠️ Não foi possível instalar filtro de backlog:", error?.message || error);
    });
}

function instalarProtecao(client) {
  if (!client || client.__outboundSafetyGuard || typeof client.sendText !== "function") return client;

  const originalSendText = client.sendText.bind(client);
  const ultimosEnvios = new Map();
  const ultimasMensagens = new Map();
  const enviosRecentes = [];
  const contatosRecentes = new Map();
  let fila = Promise.resolve();

  instalarFiltroDeBacklog(client);

  function limparJanelas(agora) {
    while (enviosRecentes.length && agora - enviosRecentes[0] >= 60_000) {
      enviosRecentes.shift();
    }
    for (const [destino, instante] of contatosRecentes) {
      if (agora - instante >= 60 * 60_000) contatosRecentes.delete(destino);
    }
    for (const [chave, instante] of ultimasMensagens) {
      if (agora - instante >= DUPLICATE_WINDOW_MS) ultimasMensagens.delete(chave);
    }
  }

  async function aguardarLimites(destino) {
    for (;;) {
      const agora = Date.now();
      limparJanelas(agora);

      const ultimo = ultimosEnvios.get(destino) || 0;
      const esperaDestino = Math.max(0, MIN_INTERVAL_MS - (agora - ultimo));
      const esperaMinuto = enviosRecentes.length >= MAX_PER_MINUTE
        ? Math.max(0, 60_000 - (agora - enviosRecentes[0]) + 50)
        : 0;
      const espera = Math.max(esperaDestino, esperaMinuto);

      if (espera <= 0) return;
      console.warn(`🛡️ Proteção de envio: aguardando ${espera}ms antes do próximo envio.`);
      await sleep(espera);
    }
  }

  async function enviarSemEsperarAck(destino, mensagem, opcoes = {}) {
    const page = client?.page;
    if (!page || typeof page.evaluate !== "function") {
      return originalSendText(destino, mensagem, opcoes);
    }

    const resultado = await Promise.race([
      page.evaluate(
        async ({ destinoFinal, textoFinal, opcoesFinais }) => {
          const wpp = globalThis.WPP;
          if (!wpp?.chat?.sendTextMessage) {
            throw new Error("WA-JS não expôs WPP.chat.sendTextMessage");
          }

          const enviado = await wpp.chat.sendTextMessage(destinoFinal, textoFinal, {
            ...(opcoesFinais || {}),
            waitForAck: false,
          });

          const serializarId = (valor) => {
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
            id: serializarId(enviado?.id) || `aizen-${Date.now()}`,
            ack: Number.isFinite(Number(enviado?.ack)) ? Number(enviado.ack) : 0,
            from: serializarId(enviado?.from),
            to: serializarId(enviado?.to) || destinoFinal,
            sendMsgResult: null,
          };
        },
        {
          destinoFinal: String(destino || ""),
          textoFinal: String(mensagem || ""),
          opcoesFinais: opcoes && typeof opcoes === "object" ? opcoes : {},
        }
      ),
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout no envio direto sem ACK")), 6500);
        timer.unref?.();
      }),
    ]);

    if (!resultado) throw new Error("WA-JS não confirmou o enfileiramento da mensagem");
    return resultado;
  }

  client.sendText = function sendTextProtegido(destino, mensagem, ...resto) {
    const tarefa = async () => {
      const d = normalizarDestino(destino);
      if (destinoBloqueado(d)) {
        throw new Error(`Envio bloqueado por segurança para destino não privado: ${destino}`);
      }

      const agora = Date.now();
      limparJanelas(agora);

      if (!contatosRecentes.has(d) && contatosRecentes.size >= MAX_UNIQUE_PER_HOUR) {
        throw new Error(
          `Circuit breaker de segurança: limite de ${MAX_UNIQUE_PER_HOUR} contatos únicos por hora atingido.`
        );
      }

      const corpo = String(mensagem || "").trim();
      const chaveDuplicata = `${d}\n${corpo}`;
      const envioIgual = ultimasMensagens.get(chaveDuplicata) || 0;
      if (corpo && agora - envioIgual < DUPLICATE_WINDOW_MS) {
        console.warn(`🛡️ Resposta duplicada bloqueada para ${d}.`);
        return { skipped: true, reason: "duplicate", destination: d };
      }

      await aguardarLimites(d);

      const opcoes = resto?.[0] && typeof resto[0] === "object" ? resto[0] : {};
      const resultado = await enviarSemEsperarAck(destino, mensagem, opcoes);
      const enviadoEm = Date.now();

      enviosRecentes.push(enviadoEm);
      ultimosEnvios.set(d, enviadoEm);
      contatosRecentes.set(d, enviadoEm);
      if (corpo) ultimasMensagens.set(chaveDuplicata, enviadoEm);

      console.log(`⚡ Mensagem enfileirada sem aguardar ACK para ${d}.`);
      return resultado;
    };

    const resultado = fila.then(tarefa, tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  };

  Object.defineProperty(client, "__outboundSafetyGuard", { value: true });
  console.log(
    `🛡️ Proteção de envio ativa: ${MIN_INTERVAL_MS}ms entre mensagens, até ${MAX_PER_MINUTE}/min e ${MAX_UNIQUE_PER_HOUR} contatos únicos/h; envio sem espera de ACK.`
  );
  return client;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "@wppconnect-team/wppconnect" || request.endsWith("/@wppconnect-team/wppconnect")) &&
    exp &&
    typeof exp.create === "function" &&
    !exp.__outboundSafetyCreatePatched
  ) {
    const originalCreate = exp.create.bind(exp);
    exp.create = async function createProtegido(...args) {
      const client = await originalCreate(...args);
      return instalarProtecao(client);
    };
    Object.defineProperty(exp, "__outboundSafetyCreatePatched", { value: true });
  }

  return exp;
};

module.exports = { instalarProtecao };
