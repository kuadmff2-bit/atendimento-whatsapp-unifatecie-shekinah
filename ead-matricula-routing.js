const Module = require("module");
const originalCompile = Module.prototype._compile;

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

  // EAD não vai para a secretária presencial. Vai direto para o número administrador
  // configurado em BOT_ADMIN_PHONE (Carlos), para ele próprio processar a matrícula.
  out = out.replace(
    /await encaminharPreMatriculaShekinah\(\{sessao,enviarMensagemParaSecretaria:\(mensagem\)=>enviarMensagemParaSecretaria\(client,mensagem\)\}\);/g,
    `const matriculaEadShekinah = Boolean(sessao.matriculaShekinahEad || sessao.modalidadeShekinah === "ead" || sessao.assuntoAtual === "shekinah_ead");\n      if (matriculaEadShekinah) {\n        const numeroAdminEad = String(process.env.BOT_ADMIN_PHONE || "").replace(/\\D/g, "");\n        if (!numeroAdminEad) throw new Error("BOT_ADMIN_PHONE não configurado para receber matrículas EAD da Shekinah.");\n        await encaminharPreMatriculaShekinah({\n          sessao,\n          enviarMensagemParaSecretaria: (mensagem) => responder(\n            client,\n            numeroAdminEad + "@c.us",\n            String(mensagem)\n              .replace("🆕 *NOVA PRÉ-MATRÍCULA — SHEKINAH*", "🆕 *NOVA MATRÍCULA EAD — SHEKINAH*")\n              .replace("✅ Pré-matrícula preenchida pelo bot. A secretaria pode continuar o atendimento com o aluno.", "✅ Matrícula EAD coletada pelo Light para você processar.")\n          )\n        });\n      } else {\n        await encaminharPreMatriculaShekinah({sessao,enviarMensagemParaSecretaria:(mensagem)=>enviarMensagemParaSecretaria(client,mensagem)});\n      }`
  );

  // Reescreve apenas a confirmação enviada ao aluno EAD, removendo qualquer afirmação
  // de que os dados foram para a secretária da Shekinah.
  out = out.replace(
    /mensagem = String\(mensagem \|\| ""\)\.trim\(\);/,
    (match) => `${match}\n  if (sessaoDestino?.matriculaShekinahEad && /PRÉ-MATRÍCULA RECEBIDA|PRE-MATRICULA RECEBIDA/i.test(mensagem)) {\n    mensagem = mensagem\n      .replace("👩‍💼 A secretária da Shekinah recebeu os dados e dará continuidade quando necessário.", "✅ Seus dados da matrícula EAD foram recebidos pelo responsável dos cursos EAD.")\n      .replace("📨 *Os dados também foram enviados automaticamente para a secretária da Shekinah.* ✅", "📥 *Os dados foram enviados diretamente para o responsável pelos cursos EAD.* ✅")\n      .replace("Agora a secretaria conferirá os dados e continuará a matrícula por esta conversa.", "Os dados foram registrados para continuidade da matrícula EAD.")\n      .replace("Para voltar ao atendimento automático, digite *m*.", "🤖 Você pode continuar falando comigo normalmente por aqui.");\n  }`
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
    console.log("🔀 Matrículas EAD da Shekinah roteadas para o administrador, não para a secretária.");
  }
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };
