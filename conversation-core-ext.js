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

  if (/\b(valor|preco|mensalidade|quanto custa)\b/.test(t)) campos.push(`💰 Mensalidade: *${curso.mensalidade}/mês*`);
  if (/\b(duracao|dura|tempo|quanto tempo)\b/.test(t)) campos.push(`⏳ Duração: *${curso.duracao}*`);
  if (/\b(estagio)\b/.test(t)) campos.push(`📚 Estágio: *${curso.estagio}*`);
  if (/\b(formacao|tipo de curso|bacharelado|licenciatura|tecnologo)\b/.test(t)) campos.push(`🎓 Formação: *${curso.formacao}*`);

  if (!campos.length) return null;
  return `${curso.emoji || "🎓"} *${curso.nome}*\n${campos.join("\n")}`;
}

function detalhesCurso(curso) {
  return `${curso.emoji || "🎓"} *${curso.nome}*\n💰 Mensalidade: *${curso.mensalidade}/mês*\n⏳ Duração: *${curso.duracao}*\n🎓 Formação: *${curso.formacao}*\n📚 Estágio: *${curso.estagio}*`;
}

function ajustarTratamento(mensagem = "") {
  return String(mensagem)
    .replace("👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊", "👥 Claro! Você quer falar com o secretário da *UniFatecie* ou com a secretária da *Shekinah*? 😊")
    .replace("✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼", "✅ Pronto! Seu atendimento foi encaminhado para o secretário da UniFatecie. 👨‍💼")
    .replace(/para a secretaria da UniFatecie/g, "para o secretário da UniFatecie")
    .replace(/com a secretaria da UniFatecie/g, "com o secretário da UniFatecie")
    .replace(/\n\n😊 Se quiser, pode perguntar só [“\"]duração[”\"], [“\"]estágio[”\"] ou [“\"]matrícula[”\"]\.?/gi, "")
    .trim();
}

async function tentarConversaNatural(args = {}) {
  const responder = args.responder;
  const textoOriginal = String(args.textoOriginal || "");
  const t = normalizar(textoOriginal);
  const sessao = args.sessao;

  let curso = encontrarCursoNoTexto(textoOriginal, args.cursosUnifatecie);

  // Se o usuário acabou de escolher a instituição, preserve a intenção anterior.
  if (/^(unifatecie|fatecie)$/.test(t) && sessao?.acaoPendente === "cursos") {
    sessao.instituicao = "unifatecie";
    sessao.acaoPendente = null;
    const lista = Object.values(args.cursosUnifatecie || {})
      .map((c) => `${c.emoji || "🎓"} *${c.nome}* — ${c.mensalidade}/mês`)
      .join("\n");
    await responder(args.client, args.msg.from, `🎓 *Cursos mais procurados — UniFatecie Polo Barreirinha*\n\n${lista}`);
    return true;
  }

  if (/^shekinah$/.test(t) && sessao?.acaoPendente === "cursos") {
    sessao.instituicao = "shekinah";
    sessao.acaoPendente = null;
    const lista = String(args.config?.shekinah?.cursos || "").replace(/\n\nPara iniciar[\s\S]*$/i, "");
    await responder(args.client, args.msg.from, lista);
    return true;
  }

  // "Quero valores dos cursos" -> pergunta instituição uma vez e lembra o motivo.
  if (/\b(curso|cursos)\b/.test(t) && /\b(valor|valores|preco|precos|mensalidade|mensalidades|quanto custa|lista|quais|mostrar|mostra)\b/.test(t) && !/unifatecie|fatecie|shekinah/.test(t)) {
    if (!sessao?.instituicao) {
      sessao.acaoPendente = "cursos";
      await responder(args.client, args.msg.from, "🎓 Claro! Você quer ver os cursos da *UniFatecie* ou da *Shekinah*? 😊");
      return true;
    }
  }

  // Nome de um curso sozinho é uma pergunta válida: entregue os detalhes em vez do fallback genérico.
  if (curso) {
    sessao.curso = curso.nome;
    sessao.cursoAtual = curso;
    sessao.instituicao = "unifatecie";

    const respostaCurta = respostaObjetivaCurso(textoOriginal, curso);
    await responder(args.client, args.msg.from, respostaCurta || detalhesCurso(curso));
    return true;
  }

  // Perguntas curtas continuam usando o último curso citado.
  if (!curso && sessao?.cursoAtual) {
    const ehContinuacaoCurta = /^(valor|preco|mensalidade|quanto|quanto custa|duracao|dura|tempo|quanto tempo|estagio|formacao|detalhes|mais detalhes)$/.test(t);
    if (ehContinuacaoCurta) {
      const resposta = respostaObjetivaCurso(textoOriginal, sessao.cursoAtual) || detalhesCurso(sessao.cursoAtual);
      await responder(args.client, args.msg.from, resposta);
      return true;
    }
  }

  return base.tentarConversaNatural({
    ...args,
    responder: async (client, destino, mensagem) => responder(client, destino, ajustarTratamento(mensagem)),
  });
}

module.exports = { tentarConversaNatural, ajustarTratamento };
