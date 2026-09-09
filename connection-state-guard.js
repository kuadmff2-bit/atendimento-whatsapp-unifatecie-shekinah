const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);

  // O WPPConnect 2.3.x pode ficar preso em waitForLogin()/isAuthenticated
  // mesmo quando o WhatsApp já chegou em inChat. Não bloqueamos mais a
  // inicialização nesse ponto: o client é devolvido, o onMessage é registrado
  // imediatamente e o statusFind continua acompanhando autenticação/QR.
  if (out.includes("      waitForLogin: true,")) {
    out = out.replace("      waitForLogin: true,", "      waitForLogin: false,");
    console.log("⚡ Inicialização não bloqueante do WhatsApp ativa (waitForLogin=false).");
  }

  if (out.includes("      deviceSyncTimeout: 0,")) {
    out = out.replace("      deviceSyncTimeout: 0,", "      deviceSyncTimeout: 180000,");
  }

  const alvo = "    whatsappConectado = true;";
  if (!out.includes(alvo)) {
    console.warn("⚠️ Connection-state guard: ponto de ativação não encontrado.");
    return out;
  }

  const injecao = `${alvo}\n\n    if (typeof client.getConnectionState === \"function\") {\n      let estadoConexaoLight = \"DESCONHECIDO\";\n      let desdeEstadoRuimLight = Date.now();\n      let recargasLight = 0;\n      let verificandoEstadoLight = false;\n\n      const estadosRuinsLight = new Set([\"SYNCING\", \"PAIRING\", \"OPENING\", \"TIMEOUT\"]);\n\n      const lerEstadoLight = async () => {\n        try {\n          const atual = String(await client.getConnectionState() || \"DESCONHECIDO\").toUpperCase();\n          if (atual !== estadoConexaoLight) {\n            estadoConexaoLight = atual;\n            console.log(\"📡 Estado real do WhatsApp: \" + atual);\n          }\n          return atual;\n        } catch (error) {\n          console.warn(\"⚠️ Não foi possível ler o estado real do WhatsApp:\", error?.message || error);\n          return \"ERRO\";\n        }\n      };\n\n      const verificarEstadoLight = async () => {\n        if (verificandoEstadoLight) return;\n        verificandoEstadoLight = true;\n        try {\n          const estado = await lerEstadoLight();\n          if (estado === \"CONNECTED\") {\n            desdeEstadoRuimLight = Date.now();\n            recargasLight = 0;\n            return;\n          }\n\n          if (!estadosRuinsLight.has(estado)) {\n            desdeEstadoRuimLight = Date.now();\n            return;\n          }\n\n          const presoPor = Date.now() - desdeEstadoRuimLight;\n          if (presoPor < 15000 || recargasLight >= 2) return;\n\n          recargasLight += 1;\n          desdeEstadoRuimLight = Date.now();\n          console.warn(\"⚠️ WhatsApp preso em \" + estado + \"; recarregando a sessão (tentativa \" + recargasLight + \"/2).\");\n\n          if (client.page && typeof client.page.reload === \"function\") {\n            try {\n              await client.page.reload({ waitUntil: \"domcontentloaded\", timeout: 60000 });\n              await delay(5000);\n            } catch (error) {\n              console.warn(\"⚠️ Falha ao recarregar a sessão do WhatsApp:\", error?.message || error);\n            }\n          }\n        } finally {\n          verificandoEstadoLight = false;\n        }\n      };\n\n      verificarEstadoLight().catch(() => {});\n      const watchdogConexaoLight = setInterval(verificarEstadoLight, 5000);\n      watchdogConexaoLight.unref?.();\n      console.log(\"🩺 Watchdog de sincronização do WhatsApp ativo.\");\n    }`;

  out = out.replace(alvo, injecao);
  console.log("🩺 Proteção contra sessão presa em SYNCING ativa.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = `async function iniciar() {\n      waitForLogin: true,\n      deviceSyncTimeout: 0,\n    whatsappConectado = true;\n  }`;
  const novo = patchCodigo(base);
  assert.match(novo, /waitForLogin: false/);
  assert.doesNotMatch(novo, /waitForLogin: true/);
  assert.match(novo, /deviceSyncTimeout: 180000/);
  console.log("✅ Self-test da inicialização não bloqueante do WhatsApp aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchCodigo };
