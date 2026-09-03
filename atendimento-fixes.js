const SHEKINAH_INFO = require("./shekinah-info");

function normalizar(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resetarSessao(sessao) {
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
    historicoIA: [],
    atualizadoEm: Date.now(),
  });
}

function pediuCancelamento(textoOriginal = "") {
  const original = String(textoOriginal).trim().toLowerCase();

  // "não quero cancelar" é diferente de "não, quero cancelar".
  if (/\bn[aã]o\s+quero\s+cancelar\b/.test(original)) return false;

  return /\b(quero\s+cancelar|cancelar|cancele|cancela\s+isso|cancelamento|quero\s+parar|parar\s+(?:a\s+)?matr[ií]cula|desistir\s+(?:da\s+)?matr[ií]cula)\b/.test(original);
}

function cursosShekinahNoTexto(texto = "") {
  const t = normalizar(texto);
  const encontrados = [];

  for (const curso of SHEKINAH_INFO.cursos) {
    const encontrou = curso.aliases.some((alias) => t.includes(normalizar(alias)));
    if (encontrou && !encontrados.some((item) => item.nome === curso.nome)) {
      encontrados.push(curso);
    }
  }

  return encontrados;
}

function perguntaDuracao(texto = "") {
  const t = normalizar(texto);
  return /\b(duracao|dura|duram|tempo|quanto tempo|quantos meses|meses)\b/.test(t);
}

async function tentarCorrecoesAtendimento({
  client,
  msg,
  textoOriginal,
  sessao,
  responder,
}) {
  if (!textoOriginal || !sessao) return false;

  const t = normalizar(textoOriginal);
  const cursosShekinah = cursosShekinahNoTexto(textoOriginal);

  if (pediuCancelamento(textoOriginal)) {
    resetarSessao(sessao);

    const querNovoCursoShekinah =
      /shekinah/.test(t) &&
      /quero fazer|quero estudar|quero me matricular|matricula/.test(t) &&
      cursosShekinah.length > 0;

    if (querNovoCursoShekinah) {
      sessao.instituicao = "shekinah";
      sessao.dados = { curso: cursosShekinah.map((curso) => curso.nome).join(" + ") };
      sessao.curso = sessao.dados.curso;
      sessao.etapa = "shekinah_matricula_nome";

      await responder(
        client,
        msg.from,
        `✅ Atendimento anterior cancelado.\n\n📝 Vamos iniciar sua matrícula na *Shekinah* em *${sessao.dados.curso}*. 😊\n\n👤 Qual é o *nome completo do aluno*?`
      );
      return true;
    }

    const temOutroPedido =
      /quero fazer|quero estudar|quero saber|curso|unifatecie|shekinah|financeiro|secretaria/.test(t) &&
      !/^(cancelar|cancele|cancelamento|quero cancelar|cancela isso)$/.test(t);

    if (temOutroPedido) {
      // A sessão já foi limpa. A conversa natural processará o restante da mesma mensagem.
      return false;
    }

    await responder(
      client,
      msg.from,
      "✅ Atendimento anterior cancelado. 😊\n\nPode falar comigo normalmente sobre 🎓 cursos, 📝 matrícula, 💳 financeiro ou 👩‍💼 secretaria."
    );
    return true;
  }

  if (perguntaDuracao(textoOriginal) && cursosShekinah.length > 0) {
    sessao.instituicao = "shekinah";

    const linhas = cursosShekinah.map((curso) => {
      const icone = curso.duracao === "15 meses" ? "⏳" : "📚";
      return `${icone} *${curso.nome}*: ${curso.duracao}`;
    });

    await responder(
      client,
      msg.from,
      `${linhas.join("\n")}\n\n😊 Se quiser, também posso te passar valores, frequência das aulas ou iniciar a matrícula.`
    );
    return true;
  }

  return false;
}

module.exports = {
  tentarCorrecoesAtendimento,
};
