const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);
  const alvo = `      statusFind: (statusSession) => {\n        if (["isLogged", "qrReadSuccess", "inChat"].includes(statusSession)) {\n          whatsappConectado = true;\n          qrCodeImagem = null;\n        }\n        console.log(\`🔐 Estado da autenticação: \${statusSession}\`);\n      },`;

  if (!out.includes(alvo)) {
    console.warn("⚠️ Number-switch guard: trecho de autenticação não encontrado; nenhuma alteração aplicada.");
    return out;
  }

  const novo = `      statusFind: (statusSession) => {\n        if (["isLogged", "qrReadSuccess", "inChat"].includes(statusSession)) {\n          whatsappConectado = true;\n          qrCodeImagem = null;\n        }\n        if (statusSession === "qrReadSuccess") {\n          try {\n            sessoes.clear();\n            persistirSessoes(sessoes);\n            console.log("🧹 Novo WhatsApp conectado: sessões antigas de conversa foram limpas.");\n          } catch (error) {\n            console.warn("⚠️ Não foi possível limpar sessões antigas após trocar o número:", error?.message || error);\n          }\n        }\n        console.log(\`🔐 Estado da autenticação: \${statusSession}\`);\n      },`;

  out = out.replace(alvo, novo);
  console.log("📱 Proteção de troca de número ativa: nova leitura de QR zera contextos antigos.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };
