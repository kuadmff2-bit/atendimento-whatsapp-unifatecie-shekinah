const base = require("./conversation-core");

function normalizar(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function encontrarCursoNoTexto(texto, cursos = {}) {
  const t = normalizar(texto);

  if (/\bads\b/.test(t)) {
    return Object.values(cursos).find((curso) =>
      normalizar(curso.nome).includes("analise e desenvolvimento de sistemas")
    ) || null;
  }

  return Object.values(cursos).find((curso) =>
    t.includes(normalizar(curso.nome))
  ) || null;
}

function respostaObjetivaCurso(textoOriginal, curso) {
  if (!curso) return null;

  const t = normalizar(textoOriginal);
  const campos = [];

  if (/\b(valor|preco|mensalidade|quanto custa)\b/.test(t)) {
    campos.push(`💰 Mensalidade: *${curso.mensalidade}/mês*`);
  }
  if (/\b(duracao|dura|tempo|quanto tempo)\b/.test(t)) {
    campos.push(`⏳ Duração: *${curso.duracao}*`);
  }
  if (/\b(estagio)\b/.test(t)) {
    campos.push(`📚 Estágio: *${curso.estagio}*`);
  }
  if (/\b(formacao|tipo de curso|bacharelado|licenciatura|tecnologo)\b/.test(t)) {
    campos.push(`🎓 Formação: *${curso.formacao}*`);
  }

  if (campos.length === 0) return null;

  return `${curso.emoji || "🎓"} *${curso.nome}*\n${campos.join("\n")}`;
}

function ajustarTratamento(mensagem = "") {
  let texto = String(mensagem);

  texto = texto
    .replace(
      "👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊",
      "👥 Claro! Você quer falar com o secretário da *UniFatecie* ou com a secretária da *Shekinah*? 😊"
    )
    .replace(
      "✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼",
      "✅ Pronto! Seu atendimento foi encaminhado para o secretário da UniFatecie. 👨‍💼"
    )
    .replace(/para a secretaria da UniFatecie/g, "para o secretário da UniFatecie")
    .replace(/com a secretaria da UniFatecie/g, "com o secretário da UniFatecie")
    .replace(/\n\n😊 Se quiser, pode perguntar só [“\"]duração[”\"], [“\"]estágio[”\"] ou [“\"]matrícula[”\"]\.?/gi, "");

  return texto.trim();
}

async function tentarConversaNatural(args = {}) {
  const responderOriginal = args.responder;
  const textoOriginal = String(args.textoOriginal || "");
  const t = normalizar(textoOriginal);

  let curso = encontrarCursoNoTexto(textoOriginal, args.cursosUnifatecie);

  // Mensagens curtas como "estágio" e "duração" continuam usando o último curso citado.
  if (!curso && args.sessao?.cursoAtual) {
    const ehContinuacaoCurta = /^(valor|preco|mensalidade|quanto custa|duracao|tempo|quanto tempo|estagio|formacao)$/.test(t);
    if (ehContinuacaoCurta) curso = args.sessao.cursoAtual;
  }

  const respostaCurta = respostaObjetivaCurso(textoOriginal, curso);
  if (respostaCurta) {
    if (args.sessao && curso) {
      args.sessao.curso = curso.nome;
      args.sessao.cursoAtual = curso;
      args.sessao.instituicao = "unifatecie";
    }

    await responderOriginal(args.client, args.msg.from, respostaCurta);
    return true;
  }

  return base.tentarConversaNatural({
    ...args,
    responder: async (client, destino, mensagem) =>
      responderOriginal(client, destino, ajustarTratamento(mensagem)),
  });
}

module.exports = { tentarConversaNatural, ajustarTratamento };
