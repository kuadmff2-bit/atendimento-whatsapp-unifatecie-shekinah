const SHEKINAH_INFO = require("./shekinah-info");
const { tratarComandoAdmin } = require("./autonomia");

function normalizar(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pareceComandoAdmin(texto = "") {
  const t = normalizar(texto);
  return /^(admin ajuda|comandos admin|ajuda admin|status bot|status do bot|trocar numero do robo|trocar numero robo|confirmar troca numero|cancelar troca numero|cancelar troca do numero|listar fatos|listar erros|definir fato|remover fato|promocao|remover promocao|atualizar curso)/.test(t);
}

function adicionarIdentidade(set, valor, profundidade = 0) {
  if (valor == null || profundidade > 4) return;

  if (typeof valor === "string" || typeof valor === "number") {
    const texto = String(valor).trim();
    if (texto) set.add(texto);
    return;
  }

  if (Array.isArray(valor)) {
    for (const item of valor) adicionarIdentidade(set, item, profundidade + 1);
    return;
  }

  if (typeof valor !== "object") return;

  const chavesPermitidas = [
    "phoneNumber",
    "pn",
    "lid",
    "id",
    "_serialized",
    "user",
    "contact",
    "contactId",
    "wid",
  ];

  for (const chave of chavesPermitidas) {
    if (Object.prototype.hasOwnProperty.call(valor, chave)) {
      adicionarIdentidade(set, valor[chave], profundidade + 1);
    }
  }
}

async function tentarComandoAdminComMapeamento({ client, msg, textoOriginal, responder }) {
  if (!pareceComandoAdmin(textoOriginal)) return false;

  const identidades = new Set();
  adicionarIdentidade(identidades, msg?.from);
  adicionarIdentidade(identidades, msg?.sender?.id);
  adicionarIdentidade(identidades, msg?.id?.remote);
  adicionarIdentidade(identidades, msg?.author);
  adicionarIdentidade(identidades, msg?.chatId);

  if (typeof client?.getPnLidEntry === "function") {
    const bases = [...identidades];

    for (const base of bases) {
      const id = String(base || "").trim();
      if (!id || (!id.includes("@lid") && !id.includes("@c.us"))) continue;

      try {
        const mapeamento = await client.getPnLidEntry(id);
        adicionarIdentidade(identidades, mapeamento);
      } catch (error) {
        console.warn(
          "⚠️ Não foi possível resolver LID/telefone para comando admin:",
          error?.message || error
        );
      }
    }
  }

  for (const identidade of identidades) {
    const resposta = tratarComandoAdmin(textoOriginal, identidade);
    if (!resposta) continue;

    await responder(client, msg.from, resposta);
    return true;
  }

  return false;
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

function perguntaRedesSociaisShekinah(texto = "", sessao) {
  const t = normalizar(texto);
  const perguntouRede = /\b(instagram|facebook|rede social|redes sociais|perfil|pagina|página)\b/.test(t);
  const contextoShekinah = /\bshekinah\b/.test(t) || sessao?.instituicao === "shekinah";
  return perguntouRede && contextoShekinah;
}

function perguntaModalidadeUnifatecie(texto = "", sessao) {
  const t = normalizar(texto);
  const perguntouModalidade =
    /\b(aula|aulas|online|ead|presencial|presenciais|portal|plataforma|estudar de casa|estuda de casa)\b/.test(t) &&
    /\b(online|ead|presencial|presenciais|portal|plataforma|casa)\b/.test(t);

  const contextoUnifatecie =
    /\b(unifatecie|fatecie|faculdade|pedagogia|administracao|ads|analise e desenvolvimento de sistemas|gestao financeira|gestao de recursos humanos|logistica|processos gerenciais|sistemas para internet|design de moda)\b/.test(t) ||
    sessao?.instituicao === "unifatecie";

  return perguntouModalidade && contextoUnifatecie;
}

function querMatriculaShekinah(texto = "", sessao, cursos = []) {
  const t = normalizar(texto);
  const mencionaMatricula = /\b(quero fazer|quero estudar|quero me matricular|quero matricular|fazer o curso|fazer os cursos|matricula|matricular)\b/.test(t);
  const contextoShekinah =
    /\bshekinah\b/.test(t) ||
    sessao?.instituicao === "shekinah" ||
    cursos.length > 0;

  return mencionaMatricula && contextoShekinah;
}

function iniciarMatriculaShekinahComCursos(sessao, cursos) {
  sessao.instituicao = "shekinah";
  sessao.atendimentoHumano = false;
  sessao.dados = {
    curso: cursos.map((curso) => curso.nome).join(" + "),
  };
  sessao.curso = sessao.dados.curso;
  sessao.cursoAtual = null;
  sessao.acaoPendente = null;
  sessao.menorDeIdade = false;
  sessao.etapa = "shekinah_matricula_nome";
}

function resumoDuracoesShekinah() {
  return (
    "⏳ *Duração dos cursos da Shekinah*\n\n" +
    "💻 Informática Básica/Completa: *15 meses*\n" +
    "🖥️ Informática Avançada: *15 meses*\n" +
    "💼 Gestão Empresarial 6 em 1: *15 meses*\n\n" +
    "📚 Inglês Kids, Desenho Artístico, Teclado, Reforço Escolar e EJA têm duração *variável*, conforme a evolução do aluno e a decisão do aluno ou responsável de continuar. 😊"
  );
}

async function tentarCorrecoesAtendimento({
  client,
  msg,
  textoOriginal,
  sessao,
  responder,
}) {
  if (!textoOriginal || !sessao) return false;

  if (
    await tentarComandoAdminComMapeamento({
      client,
      msg,
      textoOriginal,
      responder,
    })
  ) {
    return true;
  }

  const t = normalizar(textoOriginal);
  const cursosShekinah = cursosShekinahNoTexto(textoOriginal);

  if (pediuCancelamento(textoOriginal)) {
    resetarSessao(sessao);

    const querNovoCursoShekinah =
      querMatriculaShekinah(textoOriginal, sessao, cursosShekinah) && cursosShekinah.length > 0;

    if (querNovoCursoShekinah) {
      iniciarMatriculaShekinahComCursos(sessao, cursosShekinah);

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

    if (temOutroPedido) return false;

    await responder(
      client,
      msg.from,
      "✅ Atendimento anterior cancelado. 😊\n\nPode falar comigo normalmente sobre 🎓 cursos, 📝 matrícula, 💳 financeiro ou 👩‍💼 secretaria."
    );
    return true;
  }

  if (perguntaModalidadeUnifatecie(textoOriginal, sessao)) {
    sessao.instituicao = "unifatecie";
    await responder(
      client,
      msg.from,
      "💻 Sim. As aulas são *100% online* e o aluno acessa tudo pelo *portal da UniFatecie*. ✅"
    );
    return true;
  }

  if (perguntaRedesSociaisShekinah(textoOriginal, sessao)) {
    sessao.instituicao = "shekinah";

    const instagram = SHEKINAH_INFO?.redesSociais?.instagram;
    const facebook = SHEKINAH_INFO?.redesSociais?.facebook;

    await responder(
      client,
      msg.from,
      `📱 *Redes sociais oficiais da Shekinah*\n\n📸 Instagram:\n${instagram}\n\n📘 Facebook:\n${facebook}`
    );
    return true;
  }

  if (querMatriculaShekinah(textoOriginal, sessao, cursosShekinah) && cursosShekinah.length > 0) {
    iniciarMatriculaShekinahComCursos(sessao, cursosShekinah);

    const plural = cursosShekinah.length > 1;
    await responder(
      client,
      msg.from,
      `📝 Perfeito! Vamos iniciar sua matrícula na *Shekinah* ${plural ? "nos cursos" : "no curso"} *${sessao.dados.curso}*. 😊\n\n👤 Qual é o *nome completo do aluno*?`
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

  if (
    perguntaDuracao(textoOriginal) &&
    (/\bshekinah\b/.test(t) || sessao.instituicao === "shekinah")
  ) {
    sessao.instituicao = "shekinah";
    await responder(client, msg.from, resumoDuracoesShekinah());
    return true;
  }

  return false;
}

module.exports = {
  tentarCorrecoesAtendimento,
};
