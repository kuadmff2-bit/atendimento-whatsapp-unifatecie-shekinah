const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);
  const alvo = "      statusFind: (statusSession) => {";

  if (!out.includes(alvo)) {
    console.warn("⚠️ Number-switch guard: trecho de autenticação não encontrado; nenhuma alteração aplicada.");
    return out;
  }

  const injecao = `${alvo}\n        if (statusSession === "qrReadSuccess") {\n          try {\n            sessoes.clear();\n            persistirSessoes(sessoes);\n            console.log("🧹 Novo WhatsApp conectado: sessões antigas de conversa foram limpas.");\n          } catch (error) {\n            console.warn("⚠️ Não foi possível limpar sessões antigas após trocar o número:", error?.message || error);\n          }\n        }`;

  out = out.replace(alvo, injecao);
  console.log("📱 Proteção de troca de número ativa: nova leitura de QR zera contextos antigos.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };
