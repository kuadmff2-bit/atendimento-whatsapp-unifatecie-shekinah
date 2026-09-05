const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");
const Inteligencia = require("./ead-inteligencia");
const IA = require("./ia-groq");
const SHEKINAH_INFO = require("./shekinah-info");

const OFERTA_EAD = Object.freeze({
  avista: "R$ 300,00",
  parcela: "R$ 160,00",
  totalParcelado: "R$ 320,00",
  quantidadeParcelas: 2,
  brindesAvista: 2
});

const PEDAGOGIA = Object.freeze({
  nome: "Pedagogia",
  emoji: "🎓",
  formacao: "Licenciatura",
  duracao: "4 anos",
  mensalidade: "R$ 112,20",
  estagio: "Possui estágio obrigatório"
});

const CURSOS_UNIFATECIE_APROVADOS = Object.freeze([
  "Pedagogia",
  "Administração",
  "Ciências Contábeis",
  "Análise e Desenvolvimento de Sistemas",
  "Gestão de Recursos Humanos",
  "Gestão Financeira",
  "Gestão Pública",
  "Logística",
  "Processos Gerenciais",
  "Sistemas para Internet",
  "Gestão da Qualidade",
  "Investigação Forense e Perícia Criminal",
  "Design Gráfico",
  "Design de Moda",
  "Biblioteconomia"
]);

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

function ehPedidoCatalogoCompleto(t = "") {
  return /^(todos os cursos|todos cursos|me mostra todos os cursos|mostra todos os cursos|mostrar todos os cursos|quero ver todos os cursos|quero todos os cursos|quais sao todos os cursos|lista completa de cursos|listar todos os cursos|catalogo completo|quero o catalogo completo)$/.test(t)
    || /\b(todos|todas)\b.*\b(curso|cursos|opcoes)\b/.test(t)
    || /\b(catalogo|lista)\b.*\b(completo|completa)\b/.test(t);
}

function ehListaInstituicao(t = "", instituicao = "") {
  const pediuLista = /\b(curso|cursos|opcoes|catalogo)\b/.test(t) && /\b(quais|lista|listar|mostra|mostrar|mostre|ver|tem|oferece|oferecem)\b/.test(t);
  if (!pediuLista) return false;
  if (instituicao === "unifatecie") return /\b(unifatecie|fatecie|faculdade)\b/.test(t);
  if (instituicao === "shekinah") return /\bshekinah\b/.test(t) && !/\bead\b|online/.test(t);
  return false;
}

function escopoCatalogoCompleto(t = "") {
  const temFatecie = /\b(unifatecie|fatecie|faculdade)\b/.test(t);
  const temShekinah = /\bshekinah\b/.test(t);
  if (temFatecie && temShekinah) return "geral";
  if (temFatecie) return "unifatecie";
  if (temShekinah) return "shekinah";
  return "geral";
}

function listaUnifatecie() {
  return CURSOS_UNIFATECIE_APROVADOS.map(nome => `• ${nome}`).join("\n");
}

function listaShekinahPresencial() {
  return (SHEKINAH_INFO.cursos || []).map(c => `• ${c.nome}`).join("\n");
}

function cursosEadAtivos(cursos = []) {
  const ativos = cursos.filter(c => !c?.status || norm(c.status) === "ativo");
  const base = ativos.length ? ativos : cursos;
  return [...base]
    .filter(c => c?.nome)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

async function enviarEadCompleto({ client, msg, responder }) {
  let cursos;
  try {
    cursos = cursosEadAtivos(await EAD.listar());
  } catch (e) {
    console.warn("⚠️ Falha ao carregar catálogo EAD completo:", e?.message || e);
    await responder(client, msg.from, "⚠️ Não consegui carregar a lista EAD da Shekinah agora. As demais listas acima continuam válidas; tente pedir os EAD novamente em alguns instantes.");
    return;
  }

  const TAMANHO_PARTE = 28;
  const totalPartes = Math.ceil(cursos.length / TAMANHO_PARTE);
  for (let parte = 0; parte < totalPartes; parte += 1) {
    const inicio = parte * TAMANHO_PARTE;
    const fatia = cursos.slice(inicio, inicio + TAMANHO_PARTE);
    const linhas = fatia.map(c => `• ${c.nome}`).join("\n");
    const titulo = parte === 0
      ? `💻 *Shekinah — Cursos EAD* (${cursos.length} disponíveis)`
      : `💻 *Shekinah EAD — continuação ${parte + 1}/${totalPartes}*`;
    const rodape = parte === 0
      ? `\n\n💰 Todos os EAD: *${OFERTA_EAD.avista} à vista* ou *${OFERTA_EAD.quantidadeParcelas}x de ${OFERTA_EAD.parcela}*.`
      : "";
    await responder(client, msg.from, `${titulo}\n\n${linhas}${rodape}`);
  }
}

async function responderCatalogoCompleto({ client, msg, sessao, responder, escopo }) {
  sessao.cursoAtual = null;
  sessao.eadCursoAtual = null;
  sessao.acaoPendente = null;

  if (escopo === "geral" || escopo === "unifatecie") {
    sessao.instituicao = escopo === "unifatecie" ? "unifatecie" : null;
    await responder(
      client,
      msg.from,
      `🎓 *UniFatecie Polo Barreirinha — cursos liberados*\n\n${listaUnifatecie()}\n\n💰 Nos cursos com valor padrão aprovado: *R$ 112,20/mês*.\n🎁 Matrícula grátis.`
    );
  }

  if (escopo === "geral" || escopo === "shekinah") {
    sessao.instituicao = escopo === "shekinah" ? "shekinah" : null;
    await responder(
      client,
      msg.from,
      `🏫 *Centro Educacional Shekinah — cursos presenciais*\n\n${listaShekinahPresencial()}`
    );
    await enviarEadCompleto({ client, msg, responder });
  }

  sessao.assuntoAtual = escopo === "geral" ? "catalogo_geral" : `${escopo}_catalogo`;
  sessao.modalidadeShekinah = null;
  return true;
}

function perguntaPedagogia(t = "", sessao = {}) {
  const explicita = /\bpedagogia\b/.test(t);
  const emContexto = norm(sessao?.cursoAtual?.nome || sessao?.curso || "") === "pedagogia";
  const continuacao = /^(valor|preco|mensalidade|quanto|quanto custa|duracao|tempo|estagio|formacao|modalidade|ead|online|presencial|detalhes|mais detalhes|matricula|quero me matricular)$/.test(t);
  return explicita || (emContexto && continuacao);
}

function assuntoQueNaoDeveSerSequestradoPorPedagogia(t = "") {
  return /\b(cancelar|cancelamento|trancar|trancamento|financeiro|boleto|pagamento|paguei|divida|segunda via|mensalidade em aberto|requerimento)\b/.test(t);
}

function prepararContextoPedagogia(sessao) {
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = "unifatecie_pedagogia";
  sessao.modalidadeShekinah = null;
  sessao.curso = PEDAGOGIA.nome;
  sessao.cursoAtual = { ...PEDAGOGIA };
}

async function responderPedagogia({ client, msg, textoOriginal, sessao, responder }) {
  const t = norm(textoOriginal);
  if (!perguntaPedagogia(t, sessao) || assuntoQueNaoDeveSerSequestradoPorPedagogia(t)) return false;

  prepararContextoPedagogia(sessao);

  if (/\b(matricul|inscri|quero fazer|quero estudar|quero entrar)\b/.test(t)) {
    sessao.dados = { curso: PEDAGOGIA.nome };
    sessao.menorDeIdade = false;
    sessao.etapa = "unifatecie_matricula_nome";
    await responder(client, msg.from, `📝 Perfeito! Vamos iniciar a pré-matrícula em *Pedagogia*. 😊\n\n👤 Qual é o *nome completo do aluno*?`);
    return true;
  }

  if (/\b(modalidade|ead|online|presencial|aulas?)\b/.test(t)) {
    await responder(client, msg.from, "🎓 *Pedagogia está liberada para oferta pelo Polo Barreirinha.*\n\n💻 As aulas regulares são pelo ambiente online da UniFatecie. Dependendo da determinação da instituição, podem existir avaliações ou atividades presenciais. ✅");
    return true;
  }

  if (/\b(estagio)\b/.test(t)) {
    await responder(client, msg.from, "📚 *Pedagogia possui estágio obrigatório.* Quando chegar à etapa de estágio, o aluno deve seguir as orientações e documentos liberados pela UniFatecie.");
    return true;
  }

  if (/\b(duracao|tempo|quantos anos)\b/.test(t)) {
    await responder(client, msg.from, "⏳ O curso de *Pedagogia* tem duração de *4 anos*.");
    return true;
  }

  if (/\b(valor|preco|mensalidade|quanto custa|custa quanto)\b/.test(t)) {
    await responder(client, msg.from, "💰 A mensalidade de *Pedagogia* é *R$ 112,20/mês*.\n🎁 A matrícula está grátis.");
    return true;
  }

  await responder(
    client,
    msg.from,
    "🎓 *Pedagogia — UniFatecie Polo Barreirinha*\n\n✅ Curso liberado para oferta no polo\n🎓 Licenciatura\n⏳ Duração: *4 anos*\n💰 Mensalidade: *R$ 112,20/mês*\n📚 Possui estágio obrigatório\n💻 Aulas regulares pelo ambiente online; podem existir avaliações ou atividades presenciais determinadas pela instituição."
  );
  return true;
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

  // Nunca interceptar dados digitados durante fluxos estruturados.
  if (Inteligencia.emFluxoObrigatorio(sessao)) return false;

  // Pedidos de catálogo total têm prioridade sobre o contexto antigo da conversa.
  if (ehPedidoCatalogoCompleto(t)) {
    return responderCatalogoCompleto({ client, msg, sessao, responder, escopo: escopoCatalogoCompleto(t) });
  }

  // Se a pessoa pedir os cursos de uma instituição, entrega a lista correta.
  if (ehListaInstituicao(t, "unifatecie")) {
    return responderCatalogoCompleto({ client, msg, sessao, responder, escopo: "unifatecie" });
  }
  if (ehListaInstituicao(t, "shekinah")) {
    return responderCatalogoCompleto({ client, msg, sessao, responder, escopo: "shekinah" });
  }

  // Pedagogia foi liberada novamente para oferta no Polo Barreirinha.
  if (await responderPedagogia({ client, msg, textoOriginal, sessao, responder })) return true;

  const eadExplicito = /\bead\b|online|curso\.eadaulas|cursos ead|curso ead/.test(t);
  const contextoEad = sessao.assuntoAtual === "shekinah_ead" || sessao.modalidadeShekinah === "ead" || eadExplicito;

  if (!contextoEad) return false;
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

    if (Inteligencia.parecePedidoPorObjetivo(textoOriginal)) {
      const cs = await obterCatalogo();
      if (!cursoCitadoExatamente(cs, textoOriginal)) {
        if (await responderRecomendacoes({ client, msg, sessao, catalogo: cs, textoOriginal })) return true;
      }
    }

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
