function montarMensagemPreMatriculaShekinah(sessao) {
  const d = sessao?.dados || {};

  return (
    "🆕 *NOVA PRÉ-MATRÍCULA — SHEKINAH*\n\n" +
    `📚 Curso(s): ${d.curso || sessao?.curso || "Não informado"}\n` +
    `👤 Nome completo: ${d.nome || "Não informado"}\n` +
    `📅 Data de nascimento: ${d.nascimento || "Não informado"}\n` +
    `🪪 CPF: ${d.cpf || "Não informado"}\n` +
    `🪪 RG ou CIN: ${d.rg || "Não informado"}\n` +
    `📱 Telefone principal: ${d.telefone || "Não informado"}\n` +
    `☎️ Segundo telefone: ${d.telefone2 || "Não informado"}\n` +
    `🏠 Endereço completo: ${d.endereco || "Não informado"}\n` +
    `🧒 Aluno menor de 18 anos: ${sessao?.menorDeIdade ? "Sim" : "Não"}\n` +
    (sessao?.menorDeIdade
      ? `👨 CPF do pai: ${d.cpfPai || "Não informado"}\n👩 CPF da mãe: ${d.cpfMae || "Não informado"}\n`
      : "") +
    "\n✅ Pré-matrícula preenchida pelo bot. A secretaria pode continuar o atendimento com o aluno."
  );
}

async function encaminharPreMatriculaShekinah({ sessao, enviarMensagemParaSecretaria }) {
  if (!sessao || typeof enviarMensagemParaSecretaria !== "function") {
    throw new Error("Dados insuficientes para encaminhar a pré-matrícula.");
  }

  const mensagem = montarMensagemPreMatriculaShekinah(sessao);
  await enviarMensagemParaSecretaria(mensagem);
  return true;
}

module.exports = {
  montarMensagemPreMatriculaShekinah,
  encaminharPreMatriculaShekinah,
};
