const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emFluxoEstruturado(sessao = {}) {
  const etapa = String(sessao.etapa || "");
  return etapa.startsWith("unifatecie_matricula_") ||
    etapa.startsWith("shekinah_matricula_") ||
    etapa.startsWith("financeiro_") ||
    etapa.startsWith("shekinah_secretaria_") ||
    etapa === "atendimento_humano";
}

function pedidoCatalogoShekinah(texto = "") {
  const t = norm(texto);
  if (!/\bshekinah\b/.test(t)) return false;

  return /^(cursos|os cursos|catalogo|opcoes)( da| de)? shekinah$/.test(t) ||
    /\b(quero|queria|gostaria|quais|lista|listar|mostra|mostrar|mostre|ver|conhecer)\b.*\b(curso|cursos|catalogo|opcoes)\b.*\bshekinah\b/.test(t) ||
    /\bshekinah\b.*\b(quais|lista|listar|mostra|mostrar|mostre|ver|tem|oferece|oferecem)\b.*\b(curso|cursos|catalogo|opcoes)\b/.test(t);
}

function pedidoCatalogoUniFatecie(texto = "") {
  const t = norm(texto);
  if (/\bshekinah\b/.test(t) && !/\b(unifatecie|fatecie|faculdade)\b/.test(t)) return false;

  const graduacaoGenerica = /\b(curso|cursos) de graduacao\b/.test(t) ||
    /\bgraduacoes\b/.test(t) ||
    /\b(curso|cursos) superiores\b/.test(t);

  const uniExplicita = /\b(unifatecie|fatecie|faculdade)\b/.test(t) && (
    /\b(cursos|catalogo|opcoes)\b/.test(t) ||
    /\b(quais|lista|listar|mostra|mostrar|mostre|ver)\b.*\bcurso|cursos\b/.test(t)
  );

  return graduacaoGenerica || uniExplicita;
}

const PALAVRAS_GENERICAS_PEDIDO = new Set([
  "a", "ao", "aos", "as", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os",
  "para", "pra", "por", "um", "uma", "uns", "umas", "me", "mim", "vc", "voce", "voces", "poderia", "pode",
  "consegue", "conseguiria", "quero", "queria", "gostaria", "saber", "informa", "informar", "informe", "dizer", "diz",
  "fala", "falar", "mostra", "mostrar", "mostre", "ver", "curso", "cursos", "ead", "online", "shekinah", "centro",
  "educacional", "valor", "valores", "preco", "precos", "quanto", "custa", "custam", "mensalidade", "mensalidades",
  "parcela", "parcelas", "parcelamento", "conteudo", "programatico", "grade", "aula", "aulas", "materia", "materias",
  "carga", "horaria", "horario", "duracao", "tempo", "detalhe", "detalhes", "sobre", "desse", "deste", "dessa", "desta"
]);

function tokensRelevantes(texto = "") {
  return norm(texto)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => p.length > 1 && !PALAVRAS_GENERICAS_PEDIDO.has(p));
}

function mencionaEnsinoSuperior(texto = "") {
  const t = norm(texto);
  return /\b(unifatecie|fatecie|faculdade|graduacao|graduacoes|curso superior|cursos superiores|bacharelado|licenciatura|tecnologo|tecnologos)\b/.test(t) ||
    /\b(pedagogia|administracao|ciencias contabeis|ads|analise e desenvolvimento de sistemas|gestao financeira|gestao publica|recursos humanos|processos gerenciais|biblioteconomia)\b/.test(t);
}

function mencionaPresencial(texto = "") {
  const t = norm(texto);
  return /\bpresencial|presenciais|na escola|na instituicao|em sala\b/.test(t) && !/\bead|online\b/.test(t);
}

function resolverCursoEadDireto(cursos = [], texto = "") {
  const t = norm(texto);
  if (!t || !Array.isArray(cursos) || !cursos.length) return null;

  const porNomeCompleto = cursos
    .filter((curso) => {
      const nome = norm(curso?.nome);
      return nome && (t === nome || t.includes(nome));
    })
    .sort((a, b) => norm(b.nome).length - norm(a.nome).length);
  if (porNomeCompleto.length) return porNomeCompleto[0];

  const consulta = [...new Set(tokensRelevantes(texto))];
  if (!consulta.length) return null;

  const candidatos = cursos.filter((curso) => {
    const nomeTokens = new Set(tokensRelevantes(curso?.nome));
    if (!nomeTokens.size) return false;
    return consulta.every((token) => nomeTokens.has(token));
  });

  if (candidatos.length !== 1) return null;

  const nomeTokens = tokensRelevantes(candidatos[0]?.nome);
  // Para um único termo, só aceitamos quando ele representa o nome inteiro do curso.
  // Isso evita confundir, por exemplo, "administração" com uma graduação da UniFatecie.
  if (consulta.length === 1 && nomeTokens.length > 1) return null;
  return candidatos[0];
}

function pedidoMatricula(texto = "") {
  const t = norm(texto);
  return /\b(matricula|matricular|inscricao|inscrever|quero fazer|quero estudar|quero comecar|quero iniciar|como faco para fazer)\b/.test(t);
}

function prepararShekinahEad(sessao = {}, curso = null) {
  limparContextoCatalogo(sessao);
  sessao.instituicao = "shekinah";
  sessao.modalidadeShekinah = "ead";
  sessao.assuntoAtual = "shekinah_ead";
  sessao.eadCursoAtual = curso?.nome || null;
  sessao.curso = curso?.nome || "";
  sessao.cursoAtual = null;
  sessao.atualizadoEm = Date.now();
}

async function tentarPedidoDiretoCursoEad({ client, msg, textoOriginal, sessao, responder }) {
  if (!textoOriginal || !sessao || !msg || typeof responder !== "function") return false;
  if (mencionaEnsinoSuperior(textoOriginal) && !/\bshekinah|\bead|\bonline/.test(norm(textoOriginal))) return false;
  if (mencionaPresencial(textoOriginal)) return false;

  let cursos;
  try {
    cursos = await EAD.listar();
  } catch (error) {
    console.warn("⚠️ Pedido direto EAD: catálogo indisponível:", error?.message || error);
    return false;
  }

  const curso = resolverCursoEadDireto(cursos, textoOriginal);
  if (!curso) return false;

  prepararShekinahEad(sessao, curso);
  console.log(`🎯 Pedido direto identificado: ${curso.nome} — EAD Shekinah.`);

  if (pedidoMatricula(textoOriginal)) {
    sessao.atendimentoHumano = false;
    sessao.matriculaShekinahEad = true;
    sessao.dados = { curso: curso.nome };
    sessao.etapa = "shekinah_matricula_nome";
    await responder(
      client,
      msg.from,
      `📝 Perfeito! Vamos iniciar sua matrícula no curso *${curso.nome} — EAD Shekinah*. 😊\n\n👤 Informe o *nome completo do aluno*.`
    );
    return true;
  }

  try {
    const resposta = await EAD.responder(textoOriginal, sessao);
    if (resposta) {
      await responder(client, msg.from, resposta);
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Pedido direto EAD: falha ao responder:", error?.message || error);
  }

  return false;
}

function limparContextoCatalogo(sessao = {}) {
  sessao.curso = "";
  sessao.cursoAtual = null;
  sessao.eadCursoAtual = null;
  sessao.eadUltimaLista = null;
  sessao.eadPagina = 0;
  sessao.unifatecieCatalogoPagina = null;
  sessao.unifatecieCatalogoTotalPaginas = null;
  sessao.acaoPendente = null;
}

function prepararShekinah(sessao = {}) {
  limparContextoCatalogo(sessao);
  sessao.instituicao = "shekinah";
  sessao.assuntoAtual = "shekinah_catalogo";
  sessao.modalidadeShekinah = null;
  sessao.atualizadoEm = Date.now();
}

function prepararUniFatecie(sessao = {}) {
  limparContextoCatalogo(sessao);
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = "unifatecie_catalogo";
  sessao.modalidadeShekinah = null;
  sessao.atualizadoEm = Date.now();
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp &&
    typeof exp.tentarCorrecoesAtendimento === "function" &&
    !exp.__catalogRouterGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;

    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      const { textoOriginal, sessao } = args;
      if (!sessao || !textoOriginal || emFluxoEstruturado(sessao)) return original(args);

      // Se a própria mensagem já contém um curso EAD identificável, atende de imediato.
      // Ex.: "qual o valor do curso de operador de caixa?" não deve perguntar qual instituição.
      if (await tentarPedidoDiretoCursoEad(args)) return true;

      if (pedidoCatalogoShekinah(textoOriginal)) {
        prepararShekinah(sessao);
        console.log("🏫 Troca explícita de catálogo: Shekinah.");
        return original({ ...args, textoOriginal: "quais cursos da shekinah" });
      }

      if (pedidoCatalogoUniFatecie(textoOriginal)) {
        prepararUniFatecie(sessao);
        console.log("🎓 Catálogo solicitado: somente cursos liberados da UniFatecie Polo Barreirinha.");
        // Esta formulação passa direto para o catálogo aprovado do ead-hook e evita
        // a paginação antiga baseada no catálogo geral da instituição.
        return original({ ...args, textoOriginal: "quais opcoes da unifatecie" });
      }

      return original(args);
    };

    Object.defineProperty(exp, "__catalogRouterGuard", { value: true });
  }

  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(pedidoCatalogoShekinah("Cursos da Shekinah"), true);
  assert.equal(pedidoCatalogoShekinah("quero ver os cursos da Shekinah"), true);
  assert.equal(pedidoCatalogoShekinah("curso de informática da Shekinah"), false);
  assert.equal(pedidoCatalogoUniFatecie("Quero cursos de graduação"), true);
  assert.equal(pedidoCatalogoUniFatecie("Quais cursos da UniFatecie?"), true);
  assert.equal(pedidoCatalogoUniFatecie("Cursos da Shekinah"), false);

  const fake = [
    { nome: "Operador de Caixa" },
    { nome: "Telemarketing" },
    { nome: "Programação de sites Wordpress" },
  ];
  assert.equal(resolverCursoEadDireto(fake, "Vc poderia me informar o valor do curso de operador de caixa")?.nome, "Operador de Caixa");
  assert.equal(resolverCursoEadDireto(fake, "quanto custa telemarketing?")?.nome, "Telemarketing");
  assert.equal(resolverCursoEadDireto(fake, "curso de programação de sites Wordpress")?.nome, "Programação de sites Wordpress");
  assert.equal(mencionaEnsinoSuperior("valor do curso de pedagogia"), true);
  assert.equal(pedidoMatricula("quero me matricular em operador de caixa"), true);
  console.log("✅ Self-test do roteador de catálogos aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  pedidoCatalogoShekinah,
  pedidoCatalogoUniFatecie,
  resolverCursoEadDireto,
  tentarPedidoDiretoCursoEad,
  prepararShekinah,
  prepararUniFatecie,
};
