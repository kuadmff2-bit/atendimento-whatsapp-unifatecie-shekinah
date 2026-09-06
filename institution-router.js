const Module = require("module");
const originalLoad = Module._load;

function norm(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
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

function querEnsinoSuperior(t = "") {
  return /\b(unifatecie|fatecie|faculdade|graduacao|curso superior|cursos superiores|ensino superior|bacharelado|licenciatura|tecnologo|tecnologos)\b/.test(t);
}

function querListaGraduacao(t = "") {
  if (!querEnsinoSuperior(t)) return false;
  return /\b(graduacao|curso|cursos|opcao|opcoes|lista|listar|mostra|mostrar|mostre|quais|tem|oferece|oferecem|faculdade)\b/.test(t)
    || /^(de )?graduacao$/.test(t)
    || /^(e )?(de )?faculdade$/.test(t);
}

function cursoUnifatecieMencionado(t = "") {
  const aliases = [
    ["pedagogia", "Pedagogia"],
    ["administracao", "Administração"],
    ["ciencias contabeis", "Ciências Contábeis"],
    ["analise e desenvolvimento de sistemas", "Análise e Desenvolvimento de Sistemas"],
    ["ads", "Análise e Desenvolvimento de Sistemas"],
    ["gestao de recursos humanos", "Gestão de Recursos Humanos"],
    ["gestao financeira", "Gestão Financeira"],
    ["gestao publica", "Gestão Pública"],
    ["processos gerenciais", "Processos Gerenciais"],
    ["sistemas para internet", "Sistemas para Internet"],
    ["gestao da qualidade", "Gestão da Qualidade"],
    ["investigacao forense", "Investigação Forense e Perícia Criminal"],
    ["pericia criminal", "Investigação Forense e Perícia Criminal"],
    ["design grafico", "Design Gráfico"],
    ["design de moda", "Design de Moda"],
    ["biblioteconomia", "Biblioteconomia"]
  ];

  for (const [alias, nome] of aliases) {
    if (new RegExp(`\\b${alias.replace(/ /g, "\\s+")}\\b`).test(t)) return nome;
  }
  return null;
}

function ativarUnifatecie(sessao, curso = null) {
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = curso ? "unifatecie_curso" : "unifatecie_graduacao";
  sessao.modalidadeShekinah = null;
  sessao.eadCursoAtual = null;
  sessao.eadUltimaLista = null;
  sessao.eadPagina = 0;
  if (curso) {
    sessao.curso = curso;
    sessao.cursoAtual = { nome: curso };
  } else {
    sessao.curso = "";
    sessao.cursoAtual = null;
  }
  sessao.atualizadoEm = Date.now();
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp &&
    typeof exp.tentarCorrecoesAtendimento === "function" &&
    !exp.__institutionRouter
  ) {
    const original = exp.tentarCorrecoesAtendimento;

    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      const { textoOriginal, sessao } = args;
      if (!sessao || !textoOriginal || emFluxoEstruturado(sessao)) return original(args);

      const t = norm(textoOriginal);
      const curso = cursoUnifatecieMencionado(t);

      // Este arquivo agora SOMENTE define o contexto da instituição.
      // A resposta de catálogo fica a cargo do priority-router/unifatecie-catalogo,
      // evitando que uma lista local antiga de poucos cursos apareça para o aluno.
      if (querEnsinoSuperior(t) || curso) {
        ativarUnifatecie(sessao, curso);
      }

      return original(args);
    };

    Object.defineProperty(exp, "__institutionRouter", { value: true });
  }

  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(querEnsinoSuperior(norm("quero cursos de graduação")), true);
  assert.equal(querListaGraduacao(norm("mostra todos os cursos de graduação")), true);
  assert.equal(cursoUnifatecieMencionado(norm("quero saber sobre ADS")), "Análise e Desenvolvimento de Sistemas");
  assert.equal(querEnsinoSuperior(norm("curso de maquiagem da Shekinah")), false);
  console.log("✅ Self-test do roteamento de instituição aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { norm, querEnsinoSuperior, querListaGraduacao, cursoUnifatecieMencionado, ativarUnifatecie };