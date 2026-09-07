const Module = require("module");
const originalLoad = Module._load;
const CATALOGO = require("./unifatecie-catalogo");

const TAMANHO_PAGINA = Math.max(5, Number(process.env.UNIFATECIE_CURSOS_POR_PAGINA || 8));

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ehMais(texto = "") {
  const t = norm(texto).replace(/\*/g, "").trim();
  return /^(mais|ver mais|mostrar mais|mostra mais|proximo|proxima|proximos|proximas|continuar|continua)$/.test(t);
}

function ehPedidoListaGraduacao(texto = "", sessao = {}) {
  const t = norm(texto);
  const mencionaUni = /\b(unifatecie|fatecie|faculdade)\b/.test(t) || sessao?.instituicao === "unifatecie";
  const mencionaGraduacao = /\b(graduacao|graduacoes|curso superior|cursos superiores)\b/.test(t);
  const pedeCursos = /\b(cursos|curso|lista|catalogo|opcoes|opcao|quais|mostrar|mostra|ver)\b/.test(t);

  if (/\b(qual|quanto|valor|preco|mensalidade|duracao|tempo|estagio)\b/.test(t) && !/\b(quais|cursos|lista|catalogo)\b/.test(t)) {
    return false;
  }

  if (/\btem curso de\b/.test(t) && !/\bcursos\b/.test(t)) return false;

  return (
    (mencionaGraduacao && pedeCursos) ||
    (mencionaUni && /\b(cursos|lista de cursos|catalogo|opcoes de curso)\b/.test(t)) ||
    /\bcursos de graduacao\b/.test(t)
  );
}

async function cursosOrdenados() {
  const cursos = await CATALOGO.listar();
  return [...cursos].sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
}

function formatarPagina(cursos, pagina) {
  const totalPaginas = Math.max(1, Math.ceil(cursos.length / TAMANHO_PAGINA));
  const paginaSegura = Math.min(Math.max(0, pagina), totalPaginas - 1);
  const inicio = paginaSegura * TAMANHO_PAGINA;
  const parte = cursos.slice(inicio, inicio + TAMANHO_PAGINA);

  const linhas = parte.map((curso) => {
    const nome = curso?.nome || "Curso";
    const habilitacao = curso?.habilitacao || "Graduação";
    const duracao = curso?.duracao || "duração a confirmar";
    const valor = curso?.valor || "valor a confirmar";
    return `• *${nome}* — ${habilitacao} — ${duracao} — ${valor}`;
  });

  let texto = `🎓 *UniFatecie — Graduação EAD* (${paginaSegura + 1}/${totalPaginas})\n\n${linhas.join("\n")}`;

  if (paginaSegura < totalPaginas - 1) {
    texto += "\n\nPara ver a próxima parte, mande apenas *mais*.";
  } else {
    texto += "\n\n✅ Essa foi a última parte. Se quiser informações de algum curso, mande o *nome do curso*.";
  }

  return { texto, totalPaginas, pagina: paginaSegura };
}

async function enviarPagina({ client, msg, sessao, responder, pagina }) {
  const cursos = await cursosOrdenados();
  if (!cursos.length) return false;

  const resultado = formatarPagina(cursos, pagina);
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = "unifatecie_catalogo_paginado";
  sessao.unifatecieCatalogoPagina = resultado.pagina;
  sessao.unifatecieCatalogoTotalPaginas = resultado.totalPaginas;
  sessao.atualizadoEm = Date.now();

  await responder(client, msg.from, resultado.texto);
  return true;
}

async function tentarPaginacao(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;

  if (ehPedidoListaGraduacao(textoOriginal, sessao)) {
    return enviarPagina({ client, msg, sessao, responder, pagina: 0 });
  }

  if (ehMais(textoOriginal) && sessao.assuntoAtual === "unifatecie_catalogo_paginado") {
    const atual = Number(sessao.unifatecieCatalogoPagina || 0);
    const total = Number(sessao.unifatecieCatalogoTotalPaginas || 1);

    if (atual >= total - 1) {
      await responder(
        client,
        msg.from,
        "✅ Você já viu todos os cursos dessa lista. Se quiser, mande o *nome de um curso* para eu mostrar os detalhes."
      );
      return true;
    }

    return enviarPagina({ client, msg, sessao, responder, pagina: atual + 1 });
  }

  return false;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp &&
    typeof exp.tentarCorrecoesAtendimento === "function" &&
    !exp.__unifateciePaginationGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarPaginacao(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__unifateciePaginationGuard", { value: true });
  }

  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(ehPedidoListaGraduacao("Quais cursos de graduação vocês têm?", {}), true);
  assert.equal(ehPedidoListaGraduacao("Quero ver os cursos da UniFatecie", {}), true);
  assert.equal(ehPedidoListaGraduacao("Tem curso de Pedagogia?", {}), false);
  assert.equal(ehMais("mais"), true);
  assert.equal(ehMais("mais*"), true);
  assert.equal(ehMais("ver mais"), true);

  const amostra = Array.from({ length: TAMANHO_PAGINA + 1 }, (_, i) => ({
    nome: `Curso ${i + 1}`,
    habilitacao: "Tecnólogo",
    duracao: "2 anos",
    valor: "R$ 112,20/mês",
  }));
  const primeira = formatarPagina(amostra, 0);
  const ultima = formatarPagina(amostra, 1);
  assert.ok(primeira.texto.includes("mande apenas *mais*"));
  assert.ok(ultima.texto.includes("última parte"));
  assert.equal(primeira.totalPaginas, 2);
  console.log("✅ Self-test da paginação de cursos UniFatecie aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { ehPedidoListaGraduacao, ehMais, formatarPagina, tentarPaginacao };
