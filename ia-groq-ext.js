const iaBase = require("./ia-groq");
const SHEKINAH_INFO = require("./shekinah-info");
const { contextoDinamicoIA } = require("./autonomia");

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizarBaseAntigaShekinah(texto = "") {
  return String(texto || "")
    .split("\n")
    .filter((linha) => {
      const l = norm(linha);
      if (!l) return true;
      if (/matricula.*49[,.]90/.test(l)) return false;
      if (/^🔥?\s*\*?combos?/.test(l)) return false;
      if (/\b2 cursos\b.*\b180\b/.test(l)) return false;
      if (/\b3 cursos\b.*\b280\b/.test(l)) return false;
      if (/\beja\b.*(sob consulta|informacoes e valores sob consulta)/.test(l)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enriquecerConfig(config = {}) {
  const shekinah = config.shekinah || {};
  const cursosAtuais = sanitizarBaseAntigaShekinah(shekinah.cursos || "");

  const regrasEadShekinah = [
    "SHEKINAH EAD — REGRA ABSOLUTA E ATUAL",
    "- O Centro Educacional Shekinah OFERECE cursos livres EAD. Nunca diga que a Shekinah só possui cursos presenciais e nunca direcione automaticamente todo pedido de EAD para a UniFatecie.",
    "- Quando a pessoa estiver falando da Shekinah e disser apenas 'EAD', 'E A D', 'online', 'a distância', 'cursos EAD' ou equivalente, entenda como os cursos EAD da Shekinah e mostre/consulte o catálogo EAD real.",
    "- Todos os cursos EAD da Shekinah têm a mesma regra comercial: R$ 300,00 à vista OU 2x de R$ 160,00 (1ª parcela no início e 2ª no fim; total parcelado R$ 320,00).",
    "- Pagando R$ 300,00 à vista, o aluno ganha +2 cursos EAD de sua escolha como brinde.",
    "- O acesso ao curso é liberado somente após confirmação do pagamento: R$ 300,00 no à vista ou a primeira parcela de R$ 160,00 no parcelado.",
    "- O certificado é liberado automaticamente ao final, depois da conclusão do curso na plataforma.",
    "- Matrículas EAD da Shekinah são tratadas pelo responsável EAD/Carlos; não diga que são enviadas para a secretária da Shekinah.",
    "- Não invente taxa de matrícula nem combos para a Shekinah. As antigas informações de matrícula R$ 49,90 e combos 2 por R$ 180 / 3 por R$ 280 NÃO estão autorizadas e não devem ser mencionadas.",
    "- EJA presencial: R$ 900,00 à vista ou 2x de R$ 500,00, conforme a base operacional atual.",
  ].join("\n");

  const papeis = [
    "PAPÉIS DO ATENDIMENTO HUMANO",
    "- UniFatecie Polo Barreirinha: o responsável humano é homem. Use 'o secretário da UniFatecie' ou 'o atendente da UniFatecie'.",
    "- Centro Educacional Shekinah: a responsável humana presencial é mulher. Use 'a secretária da Shekinah'.",
    "- Shekinah EAD: o responsável é Carlos; não encaminhar a pré-matrícula EAD para a secretária presencial.",
  ].join("\n");

  const regrasCriticas = [
    "REGRAS CRÍTICAS DO POLO BARREIRINHA",
    "- A base operacional aprovada pelo Carlos tem prioridade sobre regras antigas do código, histórico antigo da conversa e respostas genéricas da internet.",
    "- Não afirmar que EAD significa ausência total de presencialidade. Em 2026 podem existir avaliações presenciais para alunos/cursos selecionados da UniFatecie.",
    "- Ofertar na UniFatecie apenas cursos que estejam explicitamente aprovados na base operacional do Light.",
    "- Bloquear na UniFatecie cursos semipresenciais, saúde, cursos com práticas/laboratórios/MegaPolo incompatíveis e Direito EAD, salvo atualização explícita da base.",
    "- UniFatecie: única promoção comercial a anunciar é matrícula grátis. Não mencionar percentual de desconto, voucher ou cálculo promocional.",
    "- R$ 112,20/mês só vale para os cursos UniFatecie confirmados na base. Curso fora da lista exige verificação.",
    "- Reajuste UniFatecie: pode ocorrer anualmente conforme contrato/campanha; não prometer preço fixo nem percentual.",
    "- Primeira mensalidade UniFatecie: não inventar data. Depois do RA, consultar Financeiro/Ficha Financeira.",
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
      cursos: `${cursosAtuais}\n\n${SHEKINAH_INFO.textoIA}\n\n${regrasEadShekinah}\n\n${papeis}\n\n${regrasCriticas}\n\n${prioridadeDinamica}`.trim(),
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

function corrigirFatosAntigosShekinah(resposta = "", args = {}) {
  let texto = String(resposta || "");
  const pergunta = norm(args?.textoOriginal || "").replace(/\be\s+a\s+d\b/g, "ead");
  const contextoShekinah = args?.sessao?.instituicao === "shekinah"
    || args?.sessao?.modalidadeShekinah === "ead"
    || norm(args?.sessao?.assuntoAtual || "").includes("shekinah");
  const perguntaEad = /\bead\b|\bonline\b|\ba distancia\b/.test(pergunta);

  const negacaoEadShekinah = /shekinah[\s\S]{0,160}(nao oferece|nao possui|nao tem)[\s\S]{0,80}\bead\b/i.test(norm(texto))
    || /shekinah[\s\S]{0,180}todos[\s\S]{0,40}presenciais/i.test(norm(texto));

  if (negacaoEadShekinah || (contextoShekinah && perguntaEad && /todos (sao|os cursos sao) presenciais/i.test(norm(texto)))) {
    return "💻 Sim. A *Shekinah oferece cursos EAD*. 😊\n\nPosso te mostrar o catálogo EAD atual. Todos têm a regra de *R$ 300 à vista* ou *2x de R$ 160*; no pagamento à vista, você ganha *+2 cursos EAD* de brinde.";
  }

  texto = texto
    .split("\n")
    .filter((linha) => {
      const l = norm(linha);
      if (/matricula.*49[,.]90/.test(l)) return false;
      if (/\bcombos?\b.*(180|280)/.test(l)) return false;
      if (/\b2 cursos\b.*\b180\b/.test(l)) return false;
      if (/\b3 cursos\b.*\b280\b/.test(l)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return texto;
}

async function tentarResponderComIA(args = {}) {
  const resposta = await iaBase.tentarResponderComIA({
    ...args,
    config: enriquecerConfig(args.config),
  });
  if (!resposta) return resposta;
  return corrigirFatosAntigosShekinah(ajustarGeneroResposta(resposta), args);
}

module.exports = {
  iaDisponivel: iaBase.iaDisponivel,
  tentarResponderComIA,
  enriquecerConfig,
  corrigirFatosAntigosShekinah,
};
