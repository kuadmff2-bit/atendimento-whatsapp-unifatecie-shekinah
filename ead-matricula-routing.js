const Module = require("module");
const originalCompile = Module.prototype._compile;

const DESTINO_MATRICULAS_EAD_SHEKINAH = "559291572214";

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);

  // Marca a matrícula como EAD assim que o fluxo da Shekinah começa a processar
  // uma conversa que já estava no contexto EAD.
  out = out.replace(
    /async function processarMatriculaShekinah\(client, msg, textoOriginal, sessao\) \{\s*const d = sessao\.dados;/,
    (match) => `${match}\n  if (sessao.modalidadeShekinah === "ead" || sessao.assuntoAtual === "shekinah_ead") {\n    sessao.matriculaShekinahEad = true;\n  }`
  );

  // Matrículas EAD da Shekinah vão SEMPRE para o contato oficial configurado aqui.
  // Não usa BOT_ADMIN_PHONE, porque essa variável pode apontar para outro número.
  out = out.replace(
    /await encaminharPreMatriculaShekinah\(\{sessao,enviarMensagemParaSecretaria:\(mensagem\)=>enviarMensagemParaSecretaria\(client,mensagem\)\}\);/g,
    `const matriculaEadShekinah = Boolean(sessao.matriculaShekinahEad || sessao.modalidadeShekinah === "ead" || sessao.assuntoAtual === "shekinah_ead");\n      if (matriculaEadShekinah) {\n        const destinoMatriculaEad = "${DESTINO_MATRICULAS_EAD_SHEKINAH}@c.us";\n        await encaminharPreMatriculaShekinah({\n          sessao,\n          enviarMensagemParaSecretaria: (mensagem) => responder(\n            client,\n            destinoMatriculaEad,\n            String(mensagem)\n              .replace("🆕 *NOVA PRÉ-MATRÍCULA — SHEKINAH*", "🆕 *NOVA MATRÍCULA EAD — SHEKINAH*")\n              .replace("✅ Pré-matrícula preenchida pelo bot. A secretaria pode continuar o atendimento com o aluno.", "✅ Matrícula EAD coletada pelo Aizen para continuidade do atendimento.")\n          )\n        });\n      } else {\n        await encaminharPreMatriculaShekinah({sessao,enviarMensagemParaSecretaria:(mensagem)=>enviarMensagemParaSecretaria(client,mensagem)});\n      }`
  );

  // Reescreve apenas a confirmação enviada ao aluno EAD, removendo qualquer afirmação
  // incorreta sobre o destino do encaminhamento.
  out = out.replace(
    /mensagem = String\(mensagem \|\| ""\)\.trim\(\);/,
    (match) => `${match}\n  if (sessaoDestino?.matriculaShekinahEad && /PRÉ-MATRÍCULA RECEBIDA|PRE-MATRICULA RECEBIDA/i.test(mensagem)) {\n    mensagem = mensagem\n      .replace("👩‍💼 A secretária da Shekinah recebeu os dados e dará continuidade quando necessário.", "✅ Seus dados da matrícula EAD foram encaminhados ao atendimento da Shekinah.")\n      .replace("📨 *Os dados também foram enviados automaticamente para a secretária da Shekinah.* ✅", "📥 *Os dados foram encaminhados ao atendimento da Shekinah.* ✅")\n      .replace("Agora a secretaria conferirá os dados e continuará a matrícula por esta conversa.", "Os dados foram registrados para continuidade da matrícula EAD.")\n      .replace("Para voltar ao atendimento automático, digite *m*.", "🤖 Você pode continuar falando comigo normalmente por aqui.");\n  }`
  );

  // Limpa a marca depois da conclusão para não contaminar uma matrícula presencial futura.
  out = out.replace(
    /sessao\.historicoIA=\[\]; sessao\.atualizadoEm=Date\.now\(\); persistirSessoes\(sessoes\);/g,
    `sessao.historicoIA=[]; sessao.matriculaShekinahEad=false; sessao.modalidadeShekinah=null; sessao.assuntoAtual=null; sessao.atualizadoEm=Date.now(); persistirSessoes(sessoes);`
  );

  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  if (isLegacy(filename) && patched !== content) {
    console.log(`🔀 Matrículas EAD da Shekinah roteadas para ${DESTINO_MATRICULAS_EAD_SHEKINAH}.`);
  }
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = `await encaminharPreMatriculaShekinah({sessao,enviarMensagemParaSecretaria:(mensagem)=>enviarMensagemParaSecretaria(client,mensagem)});`;
  const novo = patchCodigo(base);
  assert.match(novo, /559291572214@c\.us/);
  assert.doesNotMatch(novo, /BOT_ADMIN_PHONE/);
  assert.match(novo, /destinoMatriculaEad/);
  console.log("✅ Self-test do destino das matrículas EAD Shekinah aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { DESTINO_MATRICULAS_EAD_SHEKINAH, patchCodigo };
