const Module = require("module");
const originalLoad = Module._load;

const OFERTA = Object.freeze({
  avista: "R$ 250,00",
  parcela: "R$ 150,00",
  totalParcelado: "R$ 300,00",
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
    `🎁 Pagando à vista, você ganha *+${OFERTA.brindes} cursos EAD* da sua preferência como brinde.\n\n` +
    `💳 Parcelado: *${OFERTA.parcelas}x de ${OFERTA.parcela}*\n` +
    `• 1ª parcela no início do curso\n` +
    `• 2ª parcela no final do curso\n` +
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

function sanitizarPrecoEmDetalhes(mensagem = "", sessao = {}) {
  let texto = String(mensagem || "");
  if (!contextoEadShekinah(sessao)) return texto;

  // Remove preço individual vindo da plataforma e aplica a regra comercial única da Shekinah EAD.
  texto = texto.replace(/\n?💰\s*\*?Valor:?\*?\s*R\$\s*[\d.,]+(?:\s*em até\s*\d+\s*parcela\(s\))?/gi,
    `\n💰 *Valor:* ${OFERTA.avista} à vista ou ${OFERTA.parcelas}x de ${OFERTA.parcela}`);

  // Elimina referências à regra comercial anterior caso alguma resposta antiga escape de outro módulo.
  texto = texto
    .replace(/R\$\s*300,00\s*à vista/gi, OFERTA.avista + " à vista")
    .replace(/2x\s*de\s*R\$\s*160,00/gi, `${OFERTA.parcelas}x de ${OFERTA.parcela}`)
    .replace(/total parcelado:?\s*\*?R\$\s*320,00\*?/gi, `total parcelado: *${OFERTA.totalParcelado}*`);

  return texto;
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

            const segura = sanitizarPrecoEmDetalhes(mensagem, args.sessao || {});
            return responderOriginal(client, destino, segura);
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
  assert.match(respostaValor("Operador de Caixa"), /R\$ 250,00/);
  assert.match(respostaValor("Operador de Caixa"), /2x de R\$ 150,00/);
  assert.match(respostaValor("Operador de Caixa"), /R\$ 300,00/);
  assert.match(respostaValor("Operador de Caixa"), /\+2 cursos EAD/);
  console.log("✅ Self-test do valor EAD Shekinah aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { perguntaValor, contextoEadShekinah, respostaValor, deveAplicar, sanitizarPrecoEmDetalhes };
