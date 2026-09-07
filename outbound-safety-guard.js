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

function instalarProtecao(client) {
  if (!client || client.__outboundSafetyGuard || typeof client.sendText !== "function") return client;

  const originalSendText = client.sendText.bind(client);
  const ultimosEnvios = new Map();
  const ultimasMensagens = new Map();
  const enviosRecentes = [];
  const contatosRecentes = new Map();
  let fila = Promise.resolve();

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
      const resultado = await originalSendText(destino, mensagem, ...resto);
      const enviadoEm = Date.now();

      enviosRecentes.push(enviadoEm);
      ultimosEnvios.set(d, enviadoEm);
      contatosRecentes.set(d, enviadoEm);
      if (corpo) ultimasMensagens.set(chaveDuplicata, enviadoEm);

      return resultado;
    };

    const resultado = fila.then(tarefa, tarefa);
    fila = resultado.catch(() => undefined);
    return resultado;
  };

  Object.defineProperty(client, "__outboundSafetyGuard", { value: true });
  console.log(
    `🛡️ Proteção de envio ativa: ${MIN_INTERVAL_MS}ms entre mensagens, até ${MAX_PER_MINUTE}/min e ${MAX_UNIQUE_PER_HOUR} contatos únicos/h.`
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
