const fs = require("fs");
const path = require("path");
const Module = require("module");
const originalCompile = Module.prototype._compile;

const PASTA_TOKENS = path.join(process.cwd(), "tokens");
const ARQUIVO_SESSOES = path.join(PASTA_TOKENS, "sessoes.json");
const MARCADOR_LIMPEZA = path.join(PASTA_TOKENS, ".numero-trocado-sessoes-limpas-v1");

function limparSessoesPersistidasUmaVez() {
  try {
    fs.mkdirSync(PASTA_TOKENS, { recursive: true });
    if (fs.existsSync(MARCADOR_LIMPEZA)) return;

    if (fs.existsSync(ARQUIVO_SESSOES)) {
      fs.rmSync(ARQUIVO_SESSOES, { force: true });
      console.log("🧹 Sessões persistidas antigas removidas após a troca do número.");
    }

    fs.writeFileSync(MARCADOR_LIMPEZA, new Date().toISOString(), "utf8");
  } catch (error) {
    console.warn("⚠️ Não foi possível executar a limpeza única de sessões após a troca do número:", error?.message || error);
  }
}

// Esta correção roda antes de index.js carregar sessoes.json.
// É única e serve para a troca de número que já aconteceu antes deste guard existir.
limparSessoesPersistidasUmaVez();

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

module.exports = { patchCodigo, limparSessoesPersistidasUmaVez };
