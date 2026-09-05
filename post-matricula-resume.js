const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function patchCodigo(codigo = "") {
  let out = String(codigo);
  let alteracoes = 0;

  // A pré-matrícula da UniFatecie não deve deixar o Light permanentemente em silêncio.
  // Depois de receber o vencimento, mantém o contexto da conversa, mas volta o bot ao modo automático.
  out = out.replace(
    /d\.vencimento = vencimentos\[textoOriginal\];\s*sessao\.atendimentoHumano = true;\s*sessao\.etapa = "atendimento_humano";\s*await responder\(client, msg\.from, finalizarMatriculaUnifatecie\(sessao\)\);\s*return true;/g,
    `d.vencimento = vencimentos[textoOriginal];\n    const resumoFinalUnifatecie = String(finalizarMatriculaUnifatecie(sessao))\n      .replace(/\\n\\nAgora um atendente[\\s\\S]*?digite \\*m\\*\\./i, "\\n\\n✅ Seus dados foram recebidos para conferência e continuidade da pré-matrícula.\\n🤖 Você pode continuar falando comigo normalmente por aqui.");\n    sessao.atendimentoHumano = false;\n    sessao.etapa = "menu_unifatecie";\n    sessao.assuntoAtual = "pos_matricula_unifatecie";\n    sessao.atualizadoEm = Date.now();\n    try { persistirSessoes(sessoes); } catch (_) {}\n    await responder(client, msg.from, resumoFinalUnifatecie);\n    return true;`
  );
  if (out !== codigo) alteracoes += 1;

  // Recupera automaticamente sessões antigas que ficaram presas em atendimento_humano
  // após uma pré-matrícula UniFatecie concluída. Atendimento humano solicitado de verdade continua silencioso.
  const alvo = `const comandoRetomarBot = /^(m|menu|menu principal|voltar ao menu|inicio|retomar bot|voltar pro light|voltar para o light)$/i.test(texto);`;
  if (out.includes(alvo)) {
    out = out.replace(
      alvo,
      `${alvo}\n    const preMatriculaUnifatecieConcluida = Boolean(\n      (sessao.atendimentoHumano || sessao.etapa === "atendimento_humano") &&\n      sessao.instituicao === "unifatecie" &&\n      sessao.dados && sessao.dados.vencimento &&\n      (sessao.curso || sessao.dados.curso)\n    );\n    if (preMatriculaUnifatecieConcluida) {\n      sessao.atendimentoHumano = false;\n      sessao.etapa = "menu_unifatecie";\n      sessao.assuntoAtual = "pos_matricula_unifatecie";\n      sessao.atualizadoEm = Date.now();\n      try { persistirSessoes(sessoes); } catch (_) {}\n      console.log("🔓 Sessão liberada após pré-matrícula UniFatecie concluída.");\n    }`
    );
    alteracoes += 1;
  }

  if (alteracoes > 0) {
    console.log(`🔓 Pós-matrícula automática ativa (${alteracoes} ajuste(s)).`);
  }
  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = isLegacy(filename) ? patchCodigo(content) : content;
  return originalCompile.call(this, patched, filename);
};

module.exports = { patchCodigo };
