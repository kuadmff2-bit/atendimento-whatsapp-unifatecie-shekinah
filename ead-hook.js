const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");

const OFERTA_EAD = Object.freeze({
  avista: "R$ 300,00",
  parcela: "R$ 160,00",
  totalParcelado: "R$ 320,00",
  quantidadeParcelas: 2,
  brindesAvista: 2
});

function norm(s = "") {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function ehPerguntaDeValor(t = "") {
  return /\b(valor|preco|quanto custa|custa quanto|mensalidade|parcelas?|parcelamento|a vista|avista|2x|brinde|brindes|bonus|promocao)\b/.test(t);
}

function ofertaCompleta() {
  return `💰 *Valores dos cursos EAD da Shekinah*\n\n` +
    `💵 *À vista: ${OFERTA_EAD.avista}*\n` +
    `🎁 Pagando à vista, você ganha *+${OFERTA_EAD.brindesAvista} cursos EAD de sua preferência* de brinde.\n\n` +
    `💳 *Parcelado: ${OFERTA_EAD.quantidadeParcelas}x de ${OFERTA_EAD.parcela}*\n` +
    `• 1ª parcela no início do curso\n` +
    `• 2ª parcela no fim do curso\n` +
    `• Total parcelado: *${OFERTA_EAD.totalParcelado}*`;
}

function ofertaCurta() {
  return `💰 *Valor:* ${OFERTA_EAD.avista} à vista ou ${OFERTA_EAD.quantidadeParcelas}x de ${OFERTA_EAD.parcela} — uma parcela no início e outra no fim do curso.\n` +
    `🎁 À vista, ganha *+${OFERTA_EAD.brindesAvista} cursos EAD de sua preferência*.`;
}

function aplicarOfertaComercial(resposta = "") {
  let texto = String(resposta || "");
  const tinhaValorApi = /💰\s*\*Valor:\*\s*R\$/i.test(texto) || /valor cadastrado na plataforma/i.test(texto);

  // Os preços individuais cadastrados na plataforma não são usados na oferta comercial atual.
  texto = texto
    .replace(/\n?💰\s*\*Valor:\*\s*R\$[^\n]*/gi, "")
    .replace(/\n?💳\s*Parcelamento cadastrado:[^\n]*/gi, "")
    .replace(/💰\s*O valor cadastrado na plataforma[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (tinhaValorApi) texto += `\n\n${ofertaCurta()}`;
  return texto;
}

async function tentarEad(args) {
  const { client, msg, textoOriginal, sessao, responder } = args || {};
  if (!textoOriginal || !sessao || typeof responder !== "function") return false;

  const t = norm(textoOriginal);
  const eadExplicito = /\bead\b|online|curso\.eadaulas|cursos ead|curso ead/.test(t);
  const contextoEad = sessao.assuntoAtual === "shekinah_ead" || sessao.modalidadeShekinah === "ead" || eadExplicito;

  // Não intercepta conversas apenas por serem da Shekinah; presencial e EAD ficam separados.
  if (!contextoEad) return false;

  try {
    // Todos os cursos EAD têm a mesma regra comercial. Por isso perguntas de
    // preço não precisam descobrir primeiro qual é o curso.
    if (ehPerguntaDeValor(t)) {
      sessao.instituicao = "shekinah";
      sessao.assuntoAtual = "shekinah_ead";
      sessao.modalidadeShekinah = "ead";
      sessao.cursoAtual = null;
      await responder(client, msg.from, ofertaCompleta());
      return true;
    }

    let resposta = await EAD.responder(textoOriginal, sessao);
    if (!resposta) return false;
    resposta = aplicarOfertaComercial(resposta);

    sessao.instituicao = "shekinah";
    sessao.assuntoAtual = "shekinah_ead";
    sessao.modalidadeShekinah = "ead";
    sessao.cursoAtual = null;

    await responder(client, msg.from, resposta);
    return true;
  } catch (e) {
    console.warn("⚠️ Catálogo EAD Shekinah:", e?.message || e);
    return false;
  }
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if ((request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) && exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__eadWrapped) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args) {
      if (await tentarEad(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__eadWrapped", { value: true });
  }
  return exp;
};
