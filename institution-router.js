const Module = require("module");
const originalLoad = Module._load;

const CURSOS_UNIFATECIE = [
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
];

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
}

function textoGraduacoes() {
  return `🎓 *Cursos de graduação — UniFatecie Polo Barreirinha*\n\n${CURSOS_UNIFATECIE.map(c => `• ${c}`).join("\n")}\n\n💰 Nos cursos com valor padrão aprovado: *R$ 112,20/mês*.\n🎁 Matrícula grátis.\n\nMe diga o nome do curso que você quer conhecer melhor. 😊`;
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
      const { client, msg, textoOriginal, sessao, responder } = args;
      if (!sessao || !textoOriginal || emFluxoEstruturado(sessao)) return original(args);

      const t = norm(textoOriginal);
      const curso = cursoUnifatecieMencionado(t);

      // Palavras de ensino superior sempre tiram a conversa do catálogo de cursos livres da Shekinah.
      if (querEnsinoSuperior(t)) {
        ativarUnifatecie(sessao, curso);
        if (querListaGraduacao(t) && !curso && typeof responder === "function") {
          await responder(client, msg.from, textoGraduacoes());
          return true;
        }
        return original(args);
      }

      // Cursos claramente universitários também mudam o contexto automaticamente.
      if (curso) {
        ativarUnifatecie(sessao, curso);
        return original(args);
      }

      return original(args);
    };

    Object.defineProperty(exp, "__institutionRouter", { value: true });
  }

  return exp;
};

module.exports = { norm, querEnsinoSuperior, querListaGraduacao, cursoUnifatecieMencionado };
