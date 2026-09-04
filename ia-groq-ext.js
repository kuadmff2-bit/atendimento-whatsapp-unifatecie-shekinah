const iaBase = require("./ia-groq");
const SHEKINAH_INFO = require("./shekinah-info");
const { contextoDinamicoIA } = require("./autonomia");

function enriquecerConfig(config = {}) {
  const shekinah = config.shekinah || {};
  const cursosAtuais = String(shekinah.cursos || "");
  const papeis = [
    "PAPÉIS DO ATENDIMENTO HUMANO",
    "- UniFatecie Polo Barreirinha: o responsável humano é homem. Use 'o secretário da UniFatecie' ou 'o atendente da UniFatecie'.",
    "- Centro Educacional Shekinah: a responsável humana é mulher. Use 'a secretária da Shekinah'.",
  ].join("\n");

  const regrasCriticas = [
    "REGRAS CRÍTICAS DO POLO BARREIRINHA",
    "- A base operacional aprovada pelo Carlos tem prioridade sobre regras antigas do código e sobre respostas genéricas da internet.",
    "- Não afirmar que EAD significa ausência total de presencialidade. Em 2026 podem existir avaliações presenciais para alunos/cursos selecionados.",
    "- Ofertar apenas cursos que estejam explicitamente aprovados na base operacional do Light.",
    "- Bloquear semipresenciais, saúde, cursos com práticas/laboratórios/MegaPolo incompatíveis e Direito EAD.",
    "- Única promoção comercial a anunciar: matrícula grátis. Não mencionar percentual de desconto, voucher ou cálculo promocional.",
    "- R$ 112,20/mês só vale para os cursos confirmados na base. Curso fora da lista exige verificação.",
    "- Reajuste: pode ocorrer anualmente conforme contrato/campanha; não prometer preço fixo nem percentual.",
    "- Primeira mensalidade: não inventar data. Depois do RA, consultar Financeiro/Ficha Financeira.",
    "- Nunca fingir que consultou CRM, Portal, Financeiro ou situação individual se não houve integração real.",
    "- Não repetir informação já respondida quando a pergunta é apenas continuação do mesmo assunto.",
  ].join("\n");

  const dinamico = contextoDinamicoIA();
  const prioridadeDinamica = dinamico
    ? [
        "REGRAS DA BASE DINÂMICA",
        "- As informações abaixo foram cadastradas diretamente pelo administrador do bot.",
        "- Se não conflitarem com a base operacional aprovada, use-as como atualização local mais recente.",
        dinamico,
      ].join("\n")
    : "";

  return {
    ...config,
    shekinah: {
      ...shekinah,
      cursos: `${cursosAtuais}\n\n${SHEKINAH_INFO.textoIA}\n\n${papeis}\n\n${regrasCriticas}\n\n${prioridadeDinamica}`.trim(),
    },
  };
}

function ajustarGeneroResposta(resposta = "") {
  return String(resposta)
    .replace(/a secretária da UniFatecie/gi, "o secretário da UniFatecie")
    .replace(/a secretaria da UniFatecie/gi, "o secretário da UniFatecie")
    .replace(/para a secretária da UniFatecie/gi, "para o secretário da UniFatecie")
    .replace(/para a secretaria da UniFatecie/gi, "para o secretário da UniFatecie");
}

async function tentarResponderComIA(args = {}) {
  const resposta = await iaBase.tentarResponderComIA({
    ...args,
    config: enriquecerConfig(args.config),
  });
  return resposta ? ajustarGeneroResposta(resposta) : resposta;
}

module.exports = { iaDisponivel: iaBase.iaDisponivel, tentarResponderComIA };
