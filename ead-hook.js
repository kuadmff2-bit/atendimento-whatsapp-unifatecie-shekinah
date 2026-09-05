const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");
const Inteligencia = require("./ead-inteligencia");
const IA = require("./ia-groq");

const OFERTA_EAD = Object.freeze({
  avista: "R$ 300,00",
  parcela: "R$ 160,00",
  totalParcelado: "R$ 320,00",
  quantidadeParcelas: 2,
  brindesAvista: 2
});

function norm(s = "") {
  return Inteligencia.norm(s);
}

function ehPerguntaDeValor(t = "") {
  return /\b(valor|preco|quanto custa|custa quanto|mensalidade|parcelas?|parcelamento|a vista|avista|2x|brinde|brindes|bonus|promocao)\b/.test(t);
}

function ehPerguntaDeAcesso(t = "") {
  return /\b(quando libera|libera o acesso|liberar acesso|acesso liberado|quando posso acessar|quando comeca|quando começo|apos pagamento|depois do pagamento)\b/.test(t);
}

function ehPerguntaDeCertificado(t = "") {
  return /\b(certificado|certificacao|certifica|certificado digital|tem certificado|recebo certificado|ganho certificado|como pego o certificado|como recebo o certificado|quando libera o certificado)\b/.test(t);
}

function regraAcesso() {
  return `🔓 *Liberação do acesso:* o curso é liberado somente após a confirmação do pagamento.\n` +
    `• Pagamento à vista: após o pagamento dos *${OFERTA_EAD.avista}*.\n` +
    `• Pagamento parcelado: após o pagamento da *1ª parcela de ${OFERTA_EAD.parcela}*.`;
}

function regraCertificado() {
  return `🎓 *Certificado:* sim. Ele é liberado *automaticamente ao final do curso*, após a conclusão do curso na plataforma.`;
}

function ofertaCompleta() {
  return `💰 *Valores dos cursos EAD da Shekinah*\n\n` +
    `💵 *À vista: ${OFERTA_EAD.avista}*\n` +
    `🎁 Pagando à vista, você ganha *+${OFERTA_EAD.brindesAvista} cursos EAD de sua preferência* de brinde.\n\n` +
    `💳 *Parcelado: ${OFERTA_EAD.quantidadeParcelas}x de ${OFERTA_EAD.parcela}*\n` +
    `• 1ª parcela no início do curso\n` +
    `• 2ª parcela no fim do curso\n` +
    `• Total parcelado: *${OFERTA_EAD.totalParcelado}*\n\n` +
    regraAcesso();
}

function ofertaCurta() {
  return `💰 *Valor:* ${OFERTA_EAD.avista} à vista ou ${OFERTA_EAD.quantidadeParcelas}x de ${OFERTA_EAD.parcela} — uma parcela no início e outra no fim do curso.\n` +
    `🎁 À vista, ganha *+${OFERTA_EAD.brindesAvista} cursos EAD de sua preferência*.\n` +
    `🔓 O acesso é liberado após a confirmação do pagamento: *${OFERTA_EAD.avista} à vista* ou a *1ª parcela de ${OFERTA_EAD.parcela}*.`;
}

function aplicarOfertaComercial(resposta = "") {
  let texto = String(resposta || "");
  const tinhaValorApi = /💰\s*\*Valor:\*\s*R\$/i.test(texto) || /valor cadastrado na plataforma/i.test(texto);

  texto = texto
    .replace(/\n?💰\s*\*Valor:\*\s*R\$[^\n]*/gi, "")
    .replace(/\n?💳\s*Parcelamento cadastrado:[^\n]*/gi, "")
    .replace(/💰\s*O valor cadastrado na plataforma[^\n]*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (tinhaValorApi) texto += `\n\n${ofertaCurta()}`;
  return texto;
}

function marcarContexto(sessao) {
  sessao.instituicao = "shekinah";
  sessao.assuntoAtual = "shekinah_ead";
  sessao.modalidadeShekinah = "ead";
}

function cursoCitadoExatamente(catalogo, texto) {
  const t = norm(texto);
  return (catalogo || []).some(c => {
    const n = norm(c?.nome);
    return n && t.includes(n);
  });
}

async function responderRecomendacoes({ client, msg, sessao, catalogo, textoOriginal }) {
  let recomendados = Inteligencia.recomendar(catalogo, textoOriginal, 8);

  if (!recomendados.length && IA.iaDisponivel()) {
    const nomes = await IA.interpretarCursosCatalogo({ texto: textoOriginal, catalogo });
    if (nomes.length) {
      const mapa = new Map(catalogo.map(c => [norm(c.nome), c]));
      recomendados = nomes.map(n => mapa.get(norm(n))).filter(Boolean);
    }
  }

  if (!recomendados.length) return false;

  sessao.eadUltimaLista = recomendados;
  sessao.eadPagina = 0;
  if (recomendados.length === 1) sessao.eadCursoAtual = recomendados[0].nome;

  marcarContexto(sessao);
  await responder(client, msg.from, Inteligencia.respostaRecomendacoes(recomendados, textoOriginal));
  return true;
}

async function tentarEad(args) {
  const { client, msg, textoOriginal, sessao, responder } = args || {};
  if (!textoOriginal || !sessao || typeof responder !== "function") return false;

  const t = norm(textoOriginal);
  const eadExplicito = /\bead\b|online|curso\.eadaulas|cursos ead|curso ead/.test(t);
  const contextoEad = sessao.assuntoAtual === "shekinah_ead" || sessao.modalidadeShekinah === "ead" || eadExplicito;

  if (!contextoEad) return false;

  // O catálogo não deve sequestrar fluxos de matrícula, financeiro ou atendimento humano.
  if (Inteligencia.emFluxoObrigatorio(sessao)) return false;
  if (Inteligencia.ehPedidoMatricula(textoOriginal)) return false;

  try {
    if (ehPerguntaDeValor(t)) {
      marcarContexto(sessao);
      await responder(client, msg.from, ofertaCompleta());
      return true;
    }

    if (ehPerguntaDeAcesso(t)) {
      marcarContexto(sessao);
      await responder(client, msg.from, regraAcesso());
      return true;
    }

    if (ehPerguntaDeCertificado(t)) {
      marcarContexto(sessao);
      await responder(client, msg.from, regraCertificado());
      return true;
    }

    let catalogo = null;
    const obterCatalogo = async () => {
      if (!catalogo) catalogo = await EAD.listar();
      return catalogo;
    };

    // Entende objetivo em linguagem natural: “curso pra criar jogos”, “quero trabalhar com vídeo”, etc.
    if (Inteligencia.parecePedidoPorObjetivo(textoOriginal)) {
      const cs = await obterCatalogo();
      if (!cursoCitadoExatamente(cs, textoOriginal)) {
        if (await responderRecomendacoes({ client, msg, sessao, catalogo: cs, textoOriginal })) return true;
      }
    }

    // Frases curtas como “me mostra as opções” agora significam mostrar o catálogo,
    // e não procurar um curso chamado “opções”.
    if (Inteligencia.ehPedidoCatalogo(textoOriginal)) {
      const respostaCatalogo = await EAD.responder("listar cursos ead", sessao);
      if (respostaCatalogo) {
        marcarContexto(sessao);
        await responder(client, msg.from, aplicarOfertaComercial(respostaCatalogo));
        return true;
      }
    }

    let resposta = await EAD.responder(textoOriginal, sessao);
    if (!resposta) return false;

    // Se a busca literal falhar, tenta sinônimos, objetivo, tolerância a erros de digitação
    // e, por último, IA restrita aos nomes reais do catálogo. Nunca deixa a IA inventar curso.
    if (Inteligencia.respostaPareceFalhaDeBusca(resposta)) {
      const cs = await obterCatalogo();
      if (await responderRecomendacoes({ client, msg, sessao, catalogo: cs, textoOriginal })) return true;
    }

    resposta = aplicarOfertaComercial(resposta);
    marcarContexto(sessao);
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
