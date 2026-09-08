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
  const etapa = String(sessao?.etapa || "");
  return etapa.startsWith("unifatecie_matricula_")
    || etapa.startsWith("shekinah_matricula_")
    || etapa.startsWith("financeiro_")
    || etapa.startsWith("shekinah_secretaria_")
    || etapa === "atendimento_humano";
}

function contemDadoSensivel(texto = "") {
  const valor = String(texto || "");
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(valor)
    || /\d(?:[\s.()\-/]*\d){7,}/.test(valor)
    || /\b(cpf|rg|senha|codigo de acesso|c[oó]digo sms|cvv|cart[aã]o|token)\b/i.test(valor);
}

function limitar(texto = "", max = 700) {
  const t = String(texto || "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function memoria(sessao = {}) {
  if (!sessao.memoriaLight || typeof sessao.memoriaLight !== "object") {
    sessao.memoriaLight = {
      versao: 2,
      instituicao: sessao.instituicao || null,
      modalidade: sessao.modalidadeShekinah || null,
      cursoAtivo: sessao.eadCursoAtual || sessao.cursoAtual?.nome || sessao.curso || null,
      assunto: sessao.assuntoAtual || null,
      ultimaMensagemUsuario: "",
      ultimaRespostaBot: "",
      ultimaPerguntaBot: "",
      ultimaIntencao: "",
      recomendacoes: [],
      marcos: [],
      atualizadoEm: Date.now(),
    };
  }
  return sessao.memoriaLight;
}

function classificarIntencao(texto = "") {
  const t = norm(texto);
  if (!t) return "";
  if (/\b(valor|preco|quanto custa|mensalidade|parcelamento|parcela)\b/.test(t)) return "valor";
  if (/\b(duracao|quanto tempo|quantos meses|quantos anos|carga horaria|horas)\b/.test(t)) return "duracao";
  if (/\b(conteudo|programatico|grade|aulas|materias|o que aprende|o que ensina)\b/.test(t)) return "conteudo";
  if (/\b(matricula|matricular|inscricao|inscrever|quero fazer|quero estudar|comecar)\b/.test(t)) return "matricula";
  if (/\b(certificado|certificacao)\b/.test(t)) return "certificado";
  if (/\b(ead|online|presencial|modalidade|precisa ir|ir ao polo|ir na escola)\b/.test(t)) return "modalidade";
  if (/\b(portal|login|senha|alunonet|erro|problema|nao consigo|travou)\b/.test(t)) return "suporte";
  if (/\b(boleto|pagamento|paguei|financeiro|mensalidade atrasada|vencimento)\b/.test(t)) return "financeiro";
  if (/\b(cancelar|cancelamento|trancar|trancamento|desistir)\b/.test(t)) return "cancelamento";
  if (/^(sim|quero|pode|vamos|isso|certo|beleza|blz|ok|okay)$/.test(t)) return "confirmacao";
  if (/^(nao|agora nao|depois|so queria saber|só queria saber)$/.test(t)) return "negacao";
  if (/^(mostra|mostrar|mostre|quero ver|pode mostrar|manda|manda ai)$/.test(t)) return "continuacao";
  return "conversa";
}

function extrairUltimaPergunta(texto = "") {
  const bruto = String(texto || "").replace(/\s+/g, " ").trim();
  if (!bruto.includes("?")) return "";
  const partes = bruto.split("?").map(s => s.trim()).filter(Boolean);
  if (!partes.length) return "";
  return limitar(`${partes[partes.length - 1]}?`, 500);
}

function sincronizarCampos(sessao = {}) {
  const m = memoria(sessao);
  m.instituicao = sessao.instituicao || m.instituicao || null;
  m.modalidade = sessao.modalidadeShekinah || m.modalidade || null;
  m.cursoAtivo = sessao.eadCursoAtual || sessao.cursoAtual?.nome || sessao.curso || m.cursoAtivo || null;
  m.assunto = sessao.assuntoAtual || m.assunto || null;
  m.atualizadoEm = Date.now();
  return m;
}

function adicionarMarco(sessao = {}, tipo, texto = "") {
  const m = memoria(sessao);
  const seguro = contemDadoSensivel(texto) ? "[conteúdo protegido]" : limitar(texto, 220);
  if (!seguro) return;
  m.marcos = [...(Array.isArray(m.marcos) ? m.marcos : []), { tipo, texto: seguro, em: Date.now() }].slice(-12);
}

function registrarUsuario(sessao = {}, texto = "") {
  const m = sincronizarCampos(sessao);
  const seguro = contemDadoSensivel(texto) ? "[dado protegido — não enviar à IA]" : limitar(texto, 700);
  m.ultimaMensagemUsuario = seguro;
  m.ultimaIntencao = classificarIntencao(texto);
  adicionarMarco(sessao, "usuario", seguro);
}

function registrarBot(sessao = {}, mensagem = "") {
  const m = sincronizarCampos(sessao);
  const seguro = contemDadoSensivel(mensagem) ? "[resposta com dados protegidos]" : limitar(mensagem, 900);
  m.ultimaRespostaBot = seguro;
  const pergunta = extrairUltimaPergunta(seguro);
  if (pergunta) m.ultimaPerguntaBot = pergunta;
  adicionarMarco(sessao, "light", seguro);
}

function cursoAtivo(sessao = {}) {
  return sessao.eadCursoAtual || sessao.cursoAtual?.nome || sessao.curso || sessao.memoriaLight?.cursoAtivo || "";
}

function escopoCurso(sessao = {}) {
  const inst = sessao.instituicao || sessao.memoriaLight?.instituicao || "";
  const mod = sessao.modalidadeShekinah || sessao.memoriaLight?.modalidade || "";
  if (inst === "unifatecie") return "da UniFatecie";
  if (inst === "shekinah" && mod === "ead") return "EAD da Shekinah";
  if (inst === "shekinah") return "da Shekinah";
  return "";
}

function respostaCurta(t = "") {
  return /^(sim|quero|pode|vamos|isso|certo|beleza|blz|ok|okay|nao|agora nao|depois|mostra|mostrar|mostre|quero ver|pode mostrar|manda|manda ai|quanto custa|quanto e|qual o valor|valor|e o valor|e quanto custa|quanto tempo|e a duracao|duracao|tem certificado|e o certificado|certificado|e online|e ead|e presencial|como funciona|e as aulas|conteudo|e o conteudo)$/.test(t);
}

function expandirFollowup(texto = "", sessao = {}) {
  if (!texto || emFluxoEstruturado(sessao)) return texto;
  const t = norm(texto);
  if (!respostaCurta(t)) return texto;

  const curso = cursoAtivo(sessao);
  const escopo = escopoCurso(sessao);
  const m = memoria(sessao);
  const anterior = norm(`${m.ultimaPerguntaBot || ""} ${m.ultimaRespostaBot || ""}`);

  if (curso) {
    if (/^(quanto custa|quanto e|qual o valor|valor|e o valor|e quanto custa)$/.test(t)) {
      return `Qual o valor do curso ${curso} ${escopo}?`;
    }
    if (/^(quanto tempo|e a duracao|duracao)$/.test(t)) {
      return `Qual a duração do curso ${curso} ${escopo}?`;
    }
    if (/^(tem certificado|e o certificado|certificado)$/.test(t)) {
      return `O curso ${curso} ${escopo} tem certificado?`;
    }
    if (/^(e online|e ead|e presencial)$/.test(t)) {
      return `Qual é a modalidade do curso ${curso} ${escopo}? ${texto}`;
    }
    if (/^(como funciona|e as aulas)$/.test(t)) {
      return `Como funciona o curso ${curso} ${escopo}?`;
    }
    if (/^(conteudo|e o conteudo)$/.test(t)) {
      return `Mostre o conteúdo programático do curso ${curso} ${escopo}.`;
    }
    if (/^(mostra|mostrar|mostre|quero ver|pode mostrar|manda|manda ai)$/.test(t)) {
      if (/conteudo|programatico|grade|aulas|materias/.test(anterior)) {
        return `Mostre o conteúdo programático do curso ${curso} ${escopo}.`;
      }
      if (/valor|preco|quanto custa/.test(anterior)) {
        return `Informe o valor do curso ${curso} ${escopo}.`;
      }
      return `Mostre os detalhes do curso ${curso} ${escopo}.`;
    }
    if (/^(sim|quero|pode|vamos|isso|certo|beleza|blz|ok|okay)$/.test(t)) {
      if (/matricula|matricular|inscricao|dar inicio|iniciar o curso|iniciar sua matricula/.test(anterior)) {
        return `Quero me matricular no curso ${curso} ${escopo}.`;
      }
      if (/conteudo|programatico|grade|aulas/.test(anterior)) {
        return `Quero ver o conteúdo programático do curso ${curso} ${escopo}.`;
      }
      if (/valor|preco/.test(anterior)) {
        return `Quero saber o valor do curso ${curso} ${escopo}.`;
      }
    }
  }

  return texto;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__memoryBridge
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      const sessao = args.sessao;
      if (!sessao) return original(args);

      registrarUsuario(sessao, args.textoOriginal || "");
      const textoOriginal = expandirFollowup(args.textoOriginal || "", sessao);
      const responderOriginal = args.responder;
      const responder = typeof responderOriginal === "function"
        ? async function (client, destino, mensagem) {
            registrarBot(sessao, mensagem);
            return responderOriginal(client, destino, mensagem);
          }
        : responderOriginal;

      const resultado = await original({ ...args, textoOriginal, responder });
      sincronizarCampos(sessao);
      return resultado;
    };
    Object.defineProperty(exp, "__memoryBridge", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  const sessao = {
    instituicao: "unifatecie",
    curso: "Análise e Desenvolvimento de Sistemas",
    cursoAtual: { nome: "Análise e Desenvolvimento de Sistemas" },
  };
  registrarBot(sessao, "Quer dar início à sua matrícula agora ou ficou com alguma dúvida sobre o curso?");
  assert.match(expandirFollowup("Quanto custa?", sessao), /Análise e Desenvolvimento de Sistemas/);
  assert.match(expandirFollowup("sim", sessao), /Quero me matricular/);

  const ead = {
    instituicao: "shekinah",
    modalidadeShekinah: "ead",
    eadCursoAtual: "Telemarketing",
  };
  registrarBot(ead, "Se quiser, posso mostrar o conteúdo programático completo ou informar o valor. 😊");
  assert.match(expandirFollowup("Mostra", ead), /conteúdo programático.*Telemarketing/i);
  assert.equal(classificarIntencao("e a duração?"), "duracao");
  assert.equal(classificarIntencao("sim"), "confirmacao");
  console.log("✅ Self-test da memória contextual aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  memoria,
  registrarUsuario,
  registrarBot,
  expandirFollowup,
  classificarIntencao,
  cursoAtivo,
};
