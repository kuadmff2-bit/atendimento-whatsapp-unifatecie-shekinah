const Module = require("module");
const originalLoad = Module._load;

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
  console.log("✅ Self-test do roteador de catálogos aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  pedidoCatalogoShekinah,
  pedidoCatalogoUniFatecie,
  prepararShekinah,
  prepararUniFatecie,
};
