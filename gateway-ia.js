const wppconnect = require("@wppconnect-team/wppconnect");
const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");

const sessoes = new Map();
let contadorSintetico = 0;

const CURSOS_UNIFATECIE = {
  pedagogia: { emoji: "🎓", nome: "Pedagogia", formacao: "Licenciatura", duracao: "4 anos", mensalidade: "R$ 112,20", estagio: "Possui estágio obrigatório" },
  "analise e desenvolvimento de sistemas": { emoji: "💻", nome: "Análise e Desenvolvimento de Sistemas", formacao: "Tecnólogo", duracao: "2 anos", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "gestao de recursos humanos": { emoji: "👥", nome: "Gestão de Recursos Humanos", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "gestao financeira": { emoji: "💰", nome: "Gestão Financeira", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  logistica: { emoji: "📦", nome: "Logística", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "processos gerenciais": { emoji: "📈", nome: "Processos Gerenciais", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "sistemas para internet": { emoji: "🖥️", nome: "Sistemas para Internet", formacao: "Tecnólogo", duracao: "2 anos", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "design de moda": { emoji: "👗", nome: "Design de Moda", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
};

const CONFIG_IA = {
  unifatecie: { nome: "UniFatecie — Polo Barreirinha" },
  shekinah: {
    nome: "Centro Educacional Shekinah",
    cursos:
      "🧒 Inglês Kids — R$ 150/mês — 2 vezes por semana\n" +
      "💻 Informática Completa — R$ 150/mês — 2 vezes por semana\n" +
      "🖥️ Informática Avançada — R$ 150/mês — 2 vezes por semana\n" +
      "🎨 Desenho Artístico — R$ 150/mês — aulas aos sábados\n" +
      "🎹 Teclado — R$ 150/mês — 2 vezes por semana\n" +
      "📖 Reforço Escolar — R$ 150/mês — 2 vezes por semana\n" +
      "💼 Gestão Empresarial 6 em 1 — R$ 180/mês — 3 vezes por semana\n" +
      "🎓 EJA — informações e valores sob consulta\n" +
      "📝 Matrícula: R$ 49,90\n" +
      "🔥 Combo 2 cursos: R$ 180/mês\n" +
      "🔥 Combo 3 cursos: R$ 280/mês",
  },
};

function limpar(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function novaSessao() {
  return {
    instituicao: null,
    cursoAtual: null,
    historicoIA: [],
    acaoPendente: null,
    navegacao: 0,
    fluxoLegacy: false,
    atualizadoEm: Date.now(),
  };
}

function obterSessao(numero) {
  let sessao = sessoes.get(numero);
  if (!sessao || Date.now() - sessao.atualizadoEm > 30 * 60 * 1000) {
    sessao = novaSessao();
    sessoes.set(numero, sessao);
  }
  sessao.atualizadoEm = Date.now();
  return sessao;
}

function descobrirInstituicao(texto) {
  if (/unifatecie|fatecie|faculdade|pedagogia|analise e desenvolvimento|\bads\b|gestao de recursos humanos|gestao financeira|logistica|processos gerenciais|sistemas para internet|design de moda/.test(texto)) return "unifatecie";
  if (/shekinah|ingles|informatica|desenho|teclado|reforco|gestao empresarial|\beja\b/.test(texto)) return "shekinah";
  return null;
}

function descobrirCurso(texto) {
  for (const [chave, curso] of Object.entries(CURSOS_UNIFATECIE)) {
    if (texto.includes(chave)) return curso;
  }
  if (/\bads\b/.test(texto)) return CURSOS_UNIFATECIE["analise e desenvolvimento de sistemas"];
  return null;
}

function listaCursos() {
  return Object.values(CURSOS_UNIFATECIE)
    .map((curso) => `${curso.emoji} ${curso.nome}`)
    .join("\n");
}

async function resolverDestino(client, destino) {
  if (!String(destino).endsWith("@lid")) return destino;
  try {
    const mapeamento = await client.getPnLidEntry(destino);
    const numero = mapeamento?.phoneNumber?._serialized;
    if (numero?.endsWith("@c.us")) return numero;
  } catch (error) {
    console.warn("⚠️ Gateway: não foi possível resolver LID:", error?.message || error);
  }
  return destino;
}

async function responder(client, destino, mensagem) {
  const resolvido = await resolverDestino(client, destino);
  return client.sendText(resolvido, mensagem);
}

function mensagemSintetica(msg, body) {
  contadorSintetico += 1;
  return {
    ...msg,
    body,
    id: `gateway-${Date.now()}-${contadorSintetico}`,
    msgId: `gateway-${Date.now()}-${contadorSintetico}`,
    fromMe: false,
  };
}

async function executarSemMostrarRespostas(client, tarefa) {
  const original = client.sendText;
  let substituiu = false;
  try {
    client.sendText = async () => ({ gateway: "suprimido" });
    substituiu = client.sendText !== original;
    await tarefa();
  } finally {
    if (substituiu) client.sendText = original;
  }
}

async function prepararFluxoLegacy(client, legacyHandler, msg, sessao, acao, curso = null) {
  const numeroInstituicao = sessao.instituicao === "shekinah" ? "2" : "1";
  const numeroAcao = acao === "matricula" ? "2" : acao === "financeiro" ? "3" : "4";

  try {
    await executarSemMostrarRespostas(client, async () => {
      await legacyHandler(mensagemSintetica(msg, numeroInstituicao));
    });

    if (acao === "matricula" && curso) {
      await executarSemMostrarRespostas(client, async () => {
        await legacyHandler(mensagemSintetica(msg, numeroAcao));
      });
      await legacyHandler(mensagemSintetica(msg, curso.nome));
    } else {
      await legacyHandler(mensagemSintetica(msg, numeroAcao));
    }

    sessao.fluxoLegacy = true;
    sessao.acaoPendente = null;
    return true;
  } catch (error) {
    console.error("❌ Gateway: falha ao preparar fluxo guiado:", error?.message || error);
    sessao.fluxoLegacy = false;
    return false;
  }
}

async function responderIA(client, msg, sessao, textoOriginal) {
  const resposta = await tentarResponderComIA({
    textoOriginal,
    sessao,
    cursosUnifatecie: CURSOS_UNIFATECIE,
    config: CONFIG_IA,
  });
  if (!resposta) return false;
  await responder(client, msg.from, resposta);
  return true;
}

async function atenderConversando(client, msg, legacyHandler) {
  if (!msg || !msg.from || msg.fromMe || msg.isGroupMsg) return false;

  const textoOriginal = typeof msg.body === "string" ? msg.body.trim() : "";
  if (!textoOriginal) return false;
  const texto = limpar(textoOriginal);
  const sessao = obterSessao(msg.from);

  if (texto === "ativar secretaria") return false;

  if (/^(m|menu|menu principal|voltar ao menu|inicio)$/.test(texto)) {
    sessoes.set(msg.from, novaSessao());
    await responder(
      client,
      msg.from,
      "👋😊 Olá! Pode falar comigo normalmente.\n\n🎓 Cursos e matrícula\n💳 Financeiro e mensalidades\n👩‍💼 Secretaria\n\nÉ só me dizer o que você precisa."
    );
    return true;
  }

  if (sessao.fluxoLegacy) return false;

  if (/^[0-8]$/.test(texto)) {
    if (sessao.navegacao === 0 && (texto === "1" || texto === "2")) {
      sessao.instituicao = texto === "1" ? "unifatecie" : "shekinah";
      sessao.navegacao = 1;
    } else if (sessao.navegacao === 1) {
      if (["2", "3", "4"].includes(texto)) sessao.fluxoLegacy = true;
      if (texto === "1") sessao.navegacao = 2;
      if (texto === "0") Object.assign(sessao, novaSessao());
    }
    return false;
  }

  if (texto === "matricula" && sessao.navegacao >= 1) {
    sessao.fluxoLegacy = true;
    return false;
  }

  const instituicao = descobrirInstituicao(texto);
  if (instituicao) sessao.instituicao = instituicao;

  let curso = descobrirCurso(texto);
  if (curso) {
    sessao.cursoAtual = curso;
    sessao.instituicao = "unifatecie";
  }

  const ehContinuacaoDeCurso = /^(valor|preco|mensalidade|quanto|quanto custa|duracao|tempo|estagio|formacao|detalhes|mais detalhes|matricula)$/.test(texto);
  if (!curso && sessao.cursoAtual && ehContinuacaoDeCurso) {
    curso = sessao.cursoAtual;
    sessao.instituicao = "unifatecie";
  }

  const querMatricula = /matricul|inscri|quero entrar|quero fazer|quero estudar/.test(texto);
  const querFinanceiro = /financeir|boleto|mensalidade|pagamento|paguei|divida|segunda via|vencimento/.test(texto) && !curso;
  const querSecretaria = /secretaria|atendente|humano|falar com alguem|falar com uma pessoa/.test(texto);
  const querCursos = /(quais|lista|mostrar|mostra|tem|oferece|ofertam).*(curso|cursos)|(curso|cursos).*(tem|oferece|quais|lista)/.test(texto);
  const querDetalheCurso = /(valor|preco|mensalidade|custa|quanto|duracao|tempo|estagio|formacao|detalhe)/.test(texto);

  if (sessao.acaoPendente && sessao.instituicao) {
    const acao = sessao.acaoPendente;
    if (acao === "matricula") return prepararFluxoLegacy(client, legacyHandler, msg, sessao, acao, curso || sessao.cursoAtual);
    return prepararFluxoLegacy(client, legacyHandler, msg, sessao, acao);
  }

  if (querMatricula) {
    if (!sessao.instituicao) {
      sessao.acaoPendente = "matricula";
      await responder(client, msg.from, "📝 Claro! Sua matrícula é para a *UniFatecie* ou para a *Shekinah*? 😊");
      return true;
    }
    return prepararFluxoLegacy(client, legacyHandler, msg, sessao, "matricula", curso || sessao.cursoAtual);
  }

  if (querFinanceiro) {
    if (!sessao.instituicao) {
      sessao.acaoPendente = "financeiro";
      await responder(client, msg.from, "💳 Claro! É sobre a *UniFatecie* ou a *Shekinah*? 😊");
      return true;
    }
    return prepararFluxoLegacy(client, legacyHandler, msg, sessao, "financeiro");
  }

  if (querSecretaria) {
    if (!sessao.instituicao) {
      sessao.acaoPendente = "secretaria";
      await responder(client, msg.from, "👩‍💼 Claro! Você quer a secretaria da *UniFatecie* ou da *Shekinah*? 😊");
      return true;
    }
    return prepararFluxoLegacy(client, legacyHandler, msg, sessao, "secretaria");
  }

  if (curso && querDetalheCurso) {
    await responder(
      client,
      msg.from,
      `${curso.emoji} *${curso.nome}*\n💰 Mensalidade: *${curso.mensalidade}*\n⏳ Duração: *${curso.duracao}*\n🎓 Formação: *${curso.formacao}*\n📚 Estágio: *${curso.estagio}*\n\n😊 Quer saber mais alguma coisa sobre esse curso?`
    );
    return true;
  }

  if (!curso && ehContinuacaoDeCurso && !sessao.cursoAtual) {
    await responder(client, msg.from, "🎓 Claro! De qual curso você quer saber? 😊");
    return true;
  }

  if (querCursos && sessao.instituicao === "unifatecie") {
    await responder(
      client,
      msg.from,
      `🎓 *Cursos mais procurados no Polo de Barreirinha*\n\n${listaCursos()}\n\n😊 Quer saber o valor, duração ou detalhes de algum deles?`
    );
    return true;
  }

  if (iaDisponivel()) {
    const respondeu = await responderIA(client, msg, sessao, textoOriginal);
    if (respondeu) return true;
  }

  if (sessao.instituicao) {
    await responder(client, msg.from, "😊 Pode me explicar um pouquinho mais o que você quer saber?");
    return true;
  }

  return false;
}

const criarOriginal = wppconnect.create.bind(wppconnect);

wppconnect.create = async (...args) => {
  const client = await criarOriginal(...args);
  const onMessageOriginal = client.onMessage.bind(client);

  client.onMessage = (legacyHandler) =>
    onMessageOriginal(async (msg) => {
      try {
        const tratado = await atenderConversando(client, msg, legacyHandler);
        if (!tratado) await legacyHandler(msg);
      } catch (error) {
        console.error("❌ Gateway conversacional falhou; usando fluxo original:", error?.message || error);
        await legacyHandler(msg);
      }
    });

  return client;
};

console.log(iaDisponivel() ? "🤖 Gateway de IA ativado." : "ℹ️ Gateway carregado sem GROQ_API_KEY.");
require("./index.js");
