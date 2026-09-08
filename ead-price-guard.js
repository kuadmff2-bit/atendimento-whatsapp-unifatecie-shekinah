const Module = require("module");
const originalLoad = Module._load;

const OFERTA = Object.freeze({
  avista: "R$ 300,00",
  parcela: "R$ 160,00",
  totalParcelado: "R$ 320,00",
  parcelas: 2,
  brindes: 2,
});

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function perguntaValor(texto = "") {
  const t = norm(texto);
  return /\b(valor|preco|quanto custa|custa quanto|qual o valor|mensalidade|parcelas?|parcelamento|a vista|avista)\b/.test(t);
}

function contextoEadShekinah(sessao = {}) {
  return sessao?.instituicao === "shekinah" && (
    sessao?.modalidadeShekinah === "ead" ||
    norm(sessao?.assuntoAtual || "").includes("shekinah ead") ||
    Boolean(sessao?.eadCursoAtual)
  );
}

function cursoAtual(sessao = {}, mensagem = "") {
  const salvo = String(sessao?.eadCursoAtual || sessao?.curso || "").trim();
  if (salvo) return salvo;

  const m = String(mensagem || "").match(/para\s+\*([^*]+)\*/i)
    || String(mensagem || "").match(/\*([^*]+?)\s*[—-]\s*EAD Shekinah\*/i);
  return m?.[1]?.trim() || "o curso escolhido";
}

function respostaValor(curso) {
  return `💰 *${curso} — EAD Shekinah*\n\n` +
    `💵 À vista: *${OFERTA.avista}*\n` +
    `🎁 Pagando à vista, você ganha *+${OFERTA.brindes} cursos EAD* de sua escolha como brinde.\n\n` +
    `💳 Parcelado: *${OFERTA.parcelas}x de ${OFERTA.parcela}*\n` +
    `• 1ª parcela no início\n` +
    `• 2ª parcela no fim do curso\n` +
    `• Total parcelado: *${OFERTA.totalParcelado}*\n\n` +
    `🔓 O acesso é liberado após a confirmação do pagamento à vista ou da 1ª parcela.`;
}

function respostaAntigaSemPreco(mensagem = "") {
  const t = norm(mensagem);
  return t.includes("plataforma nao retornou um valor cadastrado")
    || t.includes("nao vou inventar um preco")
    || t.includes("encaminhar a confirmacao do valor");
}

function respostaComPrecoDaPlataforma(mensagem = "") {
  const t = norm(mensagem);
  return t.includes("valor cadastrado na plataforma")
    || /\bvalor\b.*\br\$\s*\d/.test(t);
}

function deveAplicar({ textoOriginal = "", sessao = {}, mensagem = "" }) {
  if (!perguntaValor(textoOriginal)) return false;
  if (!contextoEadShekinah(sessao)) return false;

  // A regra comercial aprovada vale para todos os cursos EAD da Shekinah,
  // independentemente de a API individual do curso trazer ou não um preço.
  return respostaAntigaSemPreco(mensagem)
    || respostaComPrecoDaPlataforma(mensagem)
    || norm(mensagem).includes("ead shekinah");
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__eadPriceGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;

    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      const responderOriginal = args.responder;
      let corrigido = false;

      const responder = typeof responderOriginal === "function"
        ? async function (client, destino, mensagem) {
            if (!corrigido && deveAplicar({ ...args, mensagem })) {
              corrigido = true;
              const curso = cursoAtual(args.sessao, mensagem);
              return responderOriginal(client, destino, respostaValor(curso));
            }
            return responderOriginal(client, destino, mensagem);
          }
        : responderOriginal;

      return original({ ...args, responder });
    };

    Object.defineProperty(exp, "__eadPriceGuard", { value: true });
  }

  return exp;
};

function selfTest() {
  const assert = require("assert");
  const sessao = {
    instituicao: "shekinah",
    modalidadeShekinah: "ead",
    assuntoAtual: "shekinah_ead",
    eadCursoAtual: "Operador de Caixa",
  };

  assert.equal(perguntaValor("Vc poderia me informar o valor do curso de operador de caixa"), true);
  assert.equal(contextoEadShekinah(sessao), true);
  assert.equal(deveAplicar({
    textoOriginal: "quanto custa operador de caixa?",
    sessao,
    mensagem: "A plataforma não retornou um valor cadastrado para Operador de Caixa nesta consulta. Não vou inventar um preço.",
  }), true);
  assert.match(respostaValor("Operador de Caixa"), /R\$ 300,00/);
  assert.match(respostaValor("Operador de Caixa"), /2x de R\$ 160,00/);
  assert.match(respostaValor("Operador de Caixa"), /R\$ 320,00/);
  console.log("✅ Self-test do valor EAD Shekinah aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { perguntaValor, contextoEadShekinah, respostaValor, deveAplicar };
