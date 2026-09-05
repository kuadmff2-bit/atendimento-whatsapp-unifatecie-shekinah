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

function emColetaEstruturada(sessao = {}) {
  const etapa = String(sessao?.etapa || "");
  return etapa.startsWith("unifatecie_matricula_")
    || etapa.startsWith("shekinah_matricula_")
    || etapa.startsWith("financeiro_")
    || etapa.startsWith("shekinah_secretaria_");
}

function comandoGlobal(texto = "") {
  const t = norm(texto);
  return /^(cancelar|cancela|cancele|cancelar isso|sair|parar|menu|m|voltar|voltar ao inicio)$/.test(t);
}

function envolverFuncao(exp, nome, marca) {
  if (!exp || typeof exp[nome] !== "function" || exp[marca]) return;
  const original = exp[nome];

  exp[nome] = async function (args = {}) {
    const { sessao, textoOriginal } = args;

    // Durante formulários, a mensagem deve ir para o campo que está sendo pedido.
    // Isso evita, por exemplo, "Rua 4 Assunção" ser confundido com uma pergunta
    // sobre o endereço do polo e impede IA/catálogo de roubar respostas do formulário.
    if (emColetaEstruturada(sessao) && !comandoGlobal(textoOriginal)) {
      return false;
    }

    return original(args);
  };

  Object.defineProperty(exp, marca, { value: true });
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) {
    envolverFuncao(exp, "tentarCorrecoesAtendimento", "__structuredFlowFaqGuard");
  }

  if (request === "./conversation-core-ext" || request.endsWith("/conversation-core-ext")) {
    envolverFuncao(exp, "tentarConversaNatural", "__structuredFlowNaturalGuard");
  }

  return exp;
};

module.exports = { emColetaEstruturada, comandoGlobal };