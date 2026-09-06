const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);

  if (out.includes("      deviceSyncTimeout: 0,")) {
    out = out.replace("      deviceSyncTimeout: 0,", "      deviceSyncTimeout: 180000,");
  }

  const alvo = "    whatsappConectado = true;";
  if (!out.includes(alvo)) {
    console.warn("⚠️ Connection-state guard: ponto de ativação não encontrado.");
    return out;
  }

  const injecao = `${alvo}

    // Watchdog que monitoriza apenas STATUS INTERNO, não chama getConnectionState().
    // getConnectionState() causa Runtime.callFunctionOn timeout no Chromium/Railway
    // e bloqueia novos eventos de mensagem. Aqui usamos apenas state tracking interno.
    if (typeof client.getConnectionState === "function") {
      let estadoRelatadoLight = "UNKNOWN";
      let estadoUltimoEventoLight = Date.now();

      // Registra mudanças de state SYNC do WPPConnect (não chama métodos no Chromium)
      if (typeof client.onStateChange === "function") {
        try {
          client.onStateChange((state) => {
            console.log("🔄 onStateChange event: " + String(state));
            estadoRelatadoLight = String(state || "UNKNOWN");
            estadoUltimoEventoLight = Date.now();
          });
        } catch (_) {}
      }

      // Log de heartbeat simples (sem I/O Chromium)
      const heartbeatLight = setInterval(() => {
        const agora = Date.now();
        const tempoSemEvento = (agora - estadoUltimoEventoLight) / 1000;
        if (tempoSemEvento > 30) {
          console.log("ℹ️ Estado reportado: " + estadoRelatadoLight + " (há " + Math.round(tempoSemEvento) + "s sem mudança)");
        }
      }, 30000);
      heartbeatLight.unref?.();

      console.log("🩺 Watchdog de estado (sem I/O Chromium) ativo.");
    }`;

  out = out.replace(alvo, injecao);
  console.log("✅ Proteção contra getConnectionState() timeout ativa: usando apenas state eventos.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };

