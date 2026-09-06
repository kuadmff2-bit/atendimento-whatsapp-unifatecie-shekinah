const Module = require("module");
const originalLoad = Module._load;
const Catalogo = require("./unifatecie-catalogo");

const LIBERADOS_BARREIRINHA = new Set([
  "pedagogia",
  "administracao",
  "ciencias contabeis",
  "analise e desenvolvimento de sistemas",
  "gestao de recursos humanos",
  "gestao financeira",
  "gestao publica",
  "logistica",
  "processos gerenciais",
  "sistemas para internet",
  "gestao da qualidade",
  "investigacao forense e pericia criminal",
  "design grafico",
  "design de moda",
  "biblioteconomia"
]);

const BLOQUEADOS_BARREIRINHA = [
  /arquitetura/, /biomedicina/, /farmacia/, /fisioterapia/, /fonoaudiologia/, /nutricao/, /terapia ocupacional/,
  /servico social/, /gestao hospitalar/, /estetica e cosmetica/, /gestao ambiental/, /processos escolares/,
  /engenharia agronomica/, /engenharia ambiental/, /engenharia civil/, /engenharia eletrica/, /engenharia mecanica/,
  /engenharia de producao/, /engenharia de computacao/, /^direito$/
];

function norm(s = "") {
  return Catalogo.norm(s);
}

function emFluxoEstruturado(sessao = {}) {
  const e = String(sessao.etapa || "");
  return e.startsWith("unifatecie_matricula_") ||
    e.startsWith("shekinah_matricula_") ||
    e.startsWith("financeiro_") ||
    e.startsWith("shekinah_secretaria_") ||
    e === "atendimento_humano";
}

function encerrarAtendimento(t = "") {
  return /^(encerrar|encerrar atendimento|finalizar atendimento|fim|finalizar|sair do atendimento)$/.test(t);
}

function resetar(sessao = {}) {
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

function contextoShekinahEad(sessao = {}) {
  return sessao.modalidadeShekinah === "ead" || norm(sessao.assuntoAtual).includes("shekinah ead");
}

function perguntaSePrecisaIr(texto = "") {
  const t = norm(texto);
  return /\b(tenho que|tem que|precisa|preciso|necessario|necessaria|vou ter que|devo)\b.*\b(ir|comparecer|presencial|instituicao|escola|polo|sair)\b/.test(t)
    || /\b(ir|comparecer)\b.*\b(instituicao|escola|polo)\b/.test(t)
    || /\b(sair de casa|presencial|precisa ir|ir na instituicao|ir a instituicao)\b/.test(t);
}

function intencaoUniFatecie(texto = "", sessao = {}) {
  const t = norm(texto);
  const explicita = /\b(unifatecie|fatecie|faculdade|graduacao|curso superior|cursos superiores|ensino superior|bacharelado|licenciatura|tecnologo|segunda graduacao|2 graduacao)\b/.test(t);
  const contexto = sessao.instituicao === "unifatecie" || norm(sessao.assuntoAtual).includes("unifatecie");
  const perguntaCurso = /\b(curso|cursos|valor|preco|mensalidade|duracao|dura|tempo|anos|meses|graduacao|bacharelado|licenciatura|tecnologo|engenharia|pedagogia|administracao|gestao|sistemas|design|contabeis|biblioteconomia|marketing|logistica)\b/.test(t);
  return explicita || (contexto && perguntaCurso);
}

function pedidoQuantidade(t = "") {
  return /\b(quantos|quantidade|numero de)\b.*\b(curso|cursos|graduacao|graduacoes)\b/.test(t);
}

function pedidoLista(t = "") {
  return /\b(todos|todas)\b.*\b(curso|cursos|graduacao|graduacoes)\b/.test(t)
    || /\b(lista|listar|mostra|mostrar|mostre|quais|catalogo)\b.*\b(curso|cursos|graduacao|graduacoes)\b/.test(t)
    || /^(cursos|graduacao|cursos de graduacao|de graduacao)$/.test(t);
}

function pediuSegundaGraduacao(t = "") {
  return /\b(segunda graduacao|2 graduacao|portador de diploma)\b/.test(t);
}

function marcarUni(sessao = {}, curso = null) {
  sessao.instituicao = "unifatecie";
  sessao.modalidadeShekinah = null;
  sessao.eadCursoAtual = null;
  sessao.eadUltimaLista = null;
  sessao.eadPagina = 0;
  sessao.assuntoAtual = curso ? "unifatecie_curso" : "unifatecie_graduacao";
  if (curso) {
    sessao.curso = curso.nome;
    sessao.cursoAtual = { ...curso };
  }
  sessao.atualizadoEm = Date.now();
}

function statusPolo(curso = {}) {
  const n = norm(curso.nome);
  if (LIBERADOS_BARREIRINHA.has(n)) return "liberado";
  if (BLOQUEADOS_BARREIRINHA.some(re => re.test(n))) return "nao_ofertar";
  return "confirmar";
}

function detalheCurso(curso) {
  const status = statusPolo(curso);
  const linhas = [
    `🎓 *${curso.nome} — UniFatecie*`,
    "",
    `📘 Formação: *${curso.habilitacao || "Graduação"}*`,
    `⏳ Duração: *${curso.duracao || "a confirmar"}*`,
    `💰 Valor exibido no catálogo oficial: *${curso.valor || "a confirmar"}*`
  ];

  if (status === "liberado") {
    linhas.push("✅ Curso liberado na base do *Polo Barreirinha*.");
    linhas.push("🎁 Matrícula grátis na campanha local vigente.");
  } else if (status === "nao_ofertar") {
    linhas.push("⚠️ Esse curso aparece no catálogo geral da UniFatecie, mas *não deve ser ofertado pelo Polo Barreirinha* na configuração atual.");
  } else {
    linhas.push("📍 Esse é o catálogo geral da UniFatecie. A disponibilidade para matrícula pelo *Polo Barreirinha* precisa ser confirmada antes de fechar a matrícula.");
  }
  return linhas.join("\n");
}

async function enviarListaCompleta({ client, msg, responder, segunda = false }) {
  let cursos = await Catalogo.listar();
  cursos = cursos.filter(c => Catalogo.ehSegundaGraduacao(c) === segunda);
  cursos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const POR_MENSAGEM = 22;
  const totalPartes = Math.max(1, Math.ceil(cursos.length / POR_MENSAGEM));
  for (let p = 0; p < totalPartes; p += 1) {
    const fatia = cursos.slice(p * POR_MENSAGEM, (p + 1) * POR_MENSAGEM);
    const linhas = fatia.map(c => `• *${c.nome}* — ${c.habilitacao} — ${c.duracao} — ${c.valor}`).join("\n");
    const titulo = segunda
      ? `🎓 *UniFatecie — 2ª Graduação EAD*${totalPartes > 1 ? ` (${p + 1}/${totalPartes})` : ""}`
      : `🎓 *UniFatecie — Graduação EAD*${totalPartes > 1 ? ` (${p + 1}/${totalPartes})` : ""}`;
    await responder(client, msg.from, `${titulo}\n\n${linhas}`);
  }
  await responder(client, msg.from, "📍 Os valores acima são os exibidos no catálogo oficial geral. Para matrícula pelo *Polo Barreirinha*, o Light confere também se o curso está liberado para oferta local.");
  return true;
}

async function responderQuantidade({ client, msg, responder }) {
  const cursos = await Catalogo.listar();
  const regulares = cursos.filter(c => !Catalogo.ehSegundaGraduacao(c));
  const segundas = cursos.filter(c => Catalogo.ehSegundaGraduacao(c));
  await responder(
    client,
    msg.from,
    `🎓 No catálogo carregado da UniFatecie eu tenho *${regulares.length} cursos de graduação EAD regulares* com valor e duração, além de *${segundas.length} opções de 2ª graduação/portador de diploma*.\n\n📚 Total armazenado no catálogo do Light: *${cursos.length} opções*.`
  );
  return true;
}

async function responderCurso({ client, msg, textoOriginal, sessao, responder }) {
  let encontrados = await Catalogo.buscar(textoOriginal, 10);

  if (!encontrados.length && sessao?.cursoAtual?.nome) {
    encontrados = await Catalogo.buscar(sessao.cursoAtual.nome, 10);
  }
  if (!encontrados.length) return false;

  const t = norm(textoOriginal);
  const exato = encontrados.find(c => t.includes(norm(c.nome)));
  const escolhido = exato || (encontrados.length === 1 ? encontrados[0] : null);

  if (escolhido) {
    marcarUni(sessao, escolhido);
    await responder(client, msg.from, detalheCurso(escolhido));
    return true;
  }

  marcarUni(sessao);
  const top = encontrados.slice(0, 8);
  await responder(
    client,
    msg.from,
    `🎓 Encontrei estas opções de graduação na UniFatecie:\n\n${top.map((c, i) => `${i + 1}. *${c.nome}* — ${c.duracao} — ${c.valor}`).join("\n")}\n\nDiga o nome do curso e eu mostro todos os detalhes.`
  );
  return true;
}

async function tentarPrioridade(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || !textoOriginal || typeof responder !== "function") return false;
  const t = norm(textoOriginal);

  // Comandos de controle nunca podem virar pesquisa de curso EAD.
  if (encerrarAtendimento(t)) {
    resetar(sessao);
    await responder(client, msg.from, "✅ Atendimento encerrado. Se precisar de algo depois, é só chamar. 😊");
    return true;
  }

  // Durante coleta de dados, nenhum catálogo/IA deve sequestrar a resposta do campo atual.
  if (emFluxoEstruturado(sessao)) return false;

  // Regra comercial da Shekinah EAD: o aluno faz tudo de casa.
  if (contextoShekinahEad(sessao) && perguntaSePrecisaIr(textoOriginal)) {
    sessao.instituicao = "shekinah";
    sessao.modalidadeShekinah = "ead";
    sessao.assuntoAtual = "shekinah_ead";
    await responder(
      client,
      msg.from,
      "💻 *Não precisa ir à instituição.* Os cursos EAD da *Shekinah são totalmente online*: você faz as aulas pela plataforma e pode estudar de casa, sem precisar sair para assistir ao curso. 😊"
    );
    return true;
  }

  if (!intencaoUniFatecie(textoOriginal, sessao)) return false;
  marcarUni(sessao);

  if (pedidoQuantidade(t)) return responderQuantidade({ client, msg, responder });
  if (pedidoLista(t)) return enviarListaCompleta({ client, msg, responder, segunda: pediuSegundaGraduacao(t) });
  if (await responderCurso({ client, msg, textoOriginal, sessao, responder })) return true;

  return false;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__priorityRouter
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarPrioridade(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__priorityRouter", { value: true });
  }
  return exp;
};

// Pré-carrega o catálogo em segundo plano; se o site estiver fora, usa o último cache local.
Catalogo.aquecer();

function selfTest() {
  const assert = require("assert");
  assert.equal(encerrarAtendimento("Encerrar atendimento"), true);
  assert.equal(perguntaSePrecisaIr("Tenho que ir na instituição?"), true);
  assert.equal(intencaoUniFatecie("Qual o valor de Engenharia de Software?", { instituicao: "unifatecie" }), true);
  assert.equal(pedidoLista("mostra todos os cursos de graduação"), true);
  console.log("✅ Self-test do roteador prioritário aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { tentarPrioridade, perguntaSePrecisaIr, intencaoUniFatecie, pedidoLista };
