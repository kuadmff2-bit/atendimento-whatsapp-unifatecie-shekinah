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

function emFluxoAtivo(sessao = {}) {
  const etapa = String(sessao.etapa || "");
  return (
    etapa.startsWith("unifatecie_matricula_") ||
    etapa.startsWith("shekinah_matricula_") ||
    etapa.startsWith("financeiro_") ||
    etapa.startsWith("shekinah_secretaria_") ||
    etapa === "atendimento_humano"
  );
}

function pediuCancelarFluxo(texto = "") {
  const t = norm(texto);
  if (!t || /nao quero cancelar/.test(t)) return false;
  return /^(cancelar|cancela|cancele|cancelar isso|cancela isso|parar|parar isso|sair|sair desse atendimento|voltar|voltar ao inicio)$/.test(t)
    || /^(quero|pode|pode) (cancelar|parar|sair)( isso| esse atendimento| essa pre matricula| essa matricula)?$/.test(t);
}

function resetar(sessao) {
  Object.assign(sessao, {
    etapa: "escolher_instituicao",
    instituicao: null,
    atendimentoHumano: false,
    nome: "",
    curso: "",
    cursoAtual: null,
    dados: {},
    menorDeIdade: false,
    acaoPendente: null,
    assuntoAtual: null,
    modalidadeShekinah: null,
    eadCursoAtual: null,
    eadUltimaLista: null,
    eadPagina: 0,
    historicoIA: [],
    atualizadoEm: Date.now()
  });
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp &&
    typeof exp.tentarCorrecoesAtendimento === "function" &&
    !exp.__flowCancelGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;

    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      const { client, msg, textoOriginal, sessao, responder } = args;

      if (
        sessao &&
        emFluxoAtivo(sessao) &&
        pediuCancelarFluxo(textoOriginal) &&
        typeof responder === "function"
      ) {
        const eraMatricula = String(sessao.etapa || "").includes("matricula_");
        resetar(sessao);
        await responder(
          client,
          msg.from,
          eraMatricula
            ? "✅ *Pré-matrícula cancelada.* Nenhuma matrícula foi cancelada na instituição. Pode falar comigo normalmente. 😊"
            : "✅ Atendimento atual cancelado. Pode falar comigo normalmente. 😊"
        );
        return true;
      }

      return original(args);
    };

    Object.defineProperty(exp, "__flowCancelGuard", { value: true });
  }

  return exp;
};
