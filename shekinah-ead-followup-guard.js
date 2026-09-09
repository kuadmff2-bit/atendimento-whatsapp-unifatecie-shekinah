const EAD = require("./shekinah-ead");
const fixes = require("./atendimento-fixes");

const NOME_PUBLICO = "Aizen";
const TAXA_MATRICULA_EAD = "R$ 0,00";

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CURSOS_PROMOCIONAIS = Object.freeze([
  {
    nome: "Auxiliar de Classe na Educação Infantil",
    aliases: [
      /\bauxiliar infantil\b/,
      /\bauxiliar de classe\b/,
      /\bauxiliar de classe na educacao infantil\b/,
      /\bauxiliar na educacao infantil\b/,
      /\bauxiliar educacao infantil\b/,
      /\bauxiliar de creche\b/,
    ],
  },
  {
    nome: "Operador de Caixa",
    aliases: [/\boperador de caixa\b/, /\bcurso de caixa\b/],
  },
]);

const DESTAQUES = [
  "Operador de Caixa",
  "Auxiliar de Creche",
  "Atendente de Farmácia",
  "Cuidador de Idoso",
  "Auxiliar Administrativo",
  "Recepcionista",
  "Secretariado",
  "Telemarketing",
  "Recursos Humanos",
  "Departamento Pessoal",
  "Excel",
  "Informática",
  "Marketing Pessoal",
  "Vendas",
];

function cursoPromocionalMencionado(texto = "") {
  const t = norm(texto);
  return CURSOS_PROMOCIONAIS.find((curso) => curso.aliases.some((re) => re.test(t))) || null;
}

function textoVisual(sessao = {}) {
  const marcos = Array.isArray(sessao?.memoriaLight?.marcos)
    ? sessao.memoriaLight.marcos.filter((m) => m?.tipo === "imagem").slice(-3).map((m) => m?.texto || "")
    : [];
  return norm([
    sessao?.visaoUltima?.resumo,
    sessao?.visaoUltima?.legenda,
    ...marcos,
  ].filter(Boolean).join(" "));
}

function contextoVisualEad(sessao = {}) {
  const t = textoVisual(sessao);
  if (!t) return false;
  const temMarca = /\bshekinah\b/.test(t);
  const temEad = /\bead\b|100 ead|estude onde e quando quiser|curso profissionalizante/.test(t);
  const temCursoConhecido = Boolean(cursoPromocionalMencionado(t));
  return (temMarca && (temEad || temCursoConhecido)) || (temEad && temCursoConhecido);
}

function contextoEad(sessao = {}, texto = "") {
  const t = norm(texto);
  if (sessao?.assuntoAtual === "shekinah_ead" || sessao?.modalidadeShekinah === "ead") return true;
  if (/\bshekinah\b/.test(t) && /\bead\b|online/.test(t)) return true;
  if (cursoPromocionalMencionado(t)) return true;
  if (contextoVisualEad(sessao)) return true;
  return false;
}

function marcarContexto(sessao = {}, cursoNome = "") {
  sessao.instituicao = "shekinah";
  sessao.assuntoAtual = "shekinah_ead";
  sessao.modalidadeShekinah = "ead";
  if (cursoNome) {
    sessao.eadCursoPromocional = cursoNome;
    if (!sessao.eadCursoAtual) sessao.eadCursoAtual = cursoNome;
    sessao.curso = sessao.eadCursoAtual || cursoNome;
    if (!sessao.memoriaLight || typeof sessao.memoriaLight !== "object") sessao.memoriaLight = {};
    sessao.memoriaLight.cursoAtivo = sessao.eadCursoAtual || cursoNome;
    sessao.memoriaLight.instituicao = "shekinah";
    sessao.memoriaLight.modalidade = "ead";
  }
  sessao.atualizadoEm = Date.now();
}

function ehPerguntaTaxaMatricula(texto = "") {
  const t = norm(texto);
  if (!/\bmatricul/.test(t)) return false;
  return /\b(quanto|valor|preco|custa|custo|taxa|paga|pagar|gratuita|gratis)\b/.test(t)
    || /^(matricula|valor da matricula|taxa da matricula|taxa de matricula)$/.test(t);
}

function ehPedidoMatricula(texto = "") {
  const t = norm(texto);
  if (!t || ehPerguntaTaxaMatricula(texto)) return false;
  return /\b(quero|queria|gostaria|desejo|vou|vamos|pode|podemos|pretendo)\b.{0,45}\b(matricul|inscrev|inscricao)\w*/.test(t)
    || /\b(me matricular|fazer minha matricula|iniciar a matricula|comecar a matricula|realizar a matricula|fazer a inscricao|me inscrever)\b/.test(t)
    || /^(matricular|matricular me|me matricular|quero matricula|quero me matricular|inscrever|me inscrever)$/.test(t);
}

function ehPedidoOutrosCursos(texto = "") {
  const t = norm(texto);
  return /\b(outro|outros|outra|outras)\b.*\b(curso|cursos|opcao|opcoes)\b/.test(t)
    || /\b(curso|cursos|opcao|opcoes)\b.*\b(outro|outros|outra|outras|mais)\b/.test(t)
    || /^(tem mais cursos|tem mais curso|quais mais cursos|quais outros|que mais tem|o que mais tem)$/.test(t)
    || (/\b(curso|cursos)\b/.test(t) && /\b(disponivel|disponiveis|tem|oferece|oferecem)\b/.test(t) && /\b(qual|quais|outro|outros|mais)\b/.test(t));
}

function cursoAtualDaSessao(sessao = {}) {
  const candidatos = [
    sessao?.eadCursoAtual,
    sessao?.eadCursoPromocional,
    sessao?.memoriaLight?.cursoAtivo,
    sessao?.curso,
  ];
  return String(candidatos.find((c) => typeof c === "string" && c.trim()) || "").trim();
}

function nomeCursoDoContexto(sessao = {}, texto = "") {
  const explicito = cursoPromocionalMencionado(texto);
  if (explicito) return explicito.nome;
  const atual = cursoAtualDaSessao(sessao);
  if (atual) return atual;
  const visual = cursoPromocionalMencionado(textoVisual(sessao));
  if (visual) return visual.nome;
  return "";
}

function iniciarMatriculaCursoAtual(sessao = {}, cursoNome = "") {
  const curso = String(cursoNome || cursoAtualDaSessao(sessao)).trim();
  if (!curso) return false;

  sessao.instituicao = "shekinah";
  sessao.modalidadeShekinah = "ead";
  sessao.assuntoAtual = "shekinah_ead";
  sessao.matriculaShekinahEad = true;
  sessao.eadCursoAtual = curso;
  sessao.curso = curso;
  sessao.dados = { ...(sessao.dados || {}), curso };
  sessao.etapa = "shekinah_matricula_nome";
  sessao.atendimentoHumano = false;
  if (!sessao.memoriaLight || typeof sessao.memoriaLight !== "object") sessao.memoriaLight = {};
  sessao.memoriaLight.cursoAtivo = curso;
  sessao.memoriaLight.instituicao = "shekinah";
  sessao.memoriaLight.modalidade = "ead";
  sessao.atualizadoEm = Date.now();
  return true;
}

function mensagemInicioMatricula(cursoNome = "") {
  return `📝 Certo! Vamos iniciar sua matrícula no curso *${cursoNome} — EAD Shekinah*.\n\nVou pedir os dados necessários, um de cada vez.\n\n👤 Informe o *nome completo* do aluno.\n\n❌ Se quiser cancelar este atendimento, digite *cancelar*.`;
}

function respostaTaxaMatricula(cursoNome = "") {
  if (cursoNome) {
    return `✅ No curso de *${cursoNome} — EAD Shekinah*, a matrícula está *sem taxa*.\n\n💰 Taxa de matrícula: *${TAXA_MATRICULA_EAD}*.\n\nSe quiser, também te passo o valor do curso e as formas de pagamento. 😊`;
  }
  return `✅ Nos cursos *EAD da Shekinah*, a matrícula está *sem taxa*.\n\n💰 Taxa de matrícula: *${TAXA_MATRICULA_EAD}*. 😊`;
}

function cursoAtivo(c = {}) {
  const status = norm(c?.status || "");
  return !status || status === "ativo";
}

function nomeEquivalente(a = "", b = "") {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  if (/auxiliar.*(classe|creche|infantil)/.test(na) && /auxiliar.*(classe|creche|infantil)/.test(nb)) return true;
  return false;
}

function selecionarDestaques(cursos = [], atual = "", limite = 10) {
  const base = cursos.filter((c) => c?.nome && cursoAtivo(c) && !nomeEquivalente(c.nome, atual));
  const escolhidos = [];
  const usados = new Set();

  function adicionar(curso) {
    if (!curso?.nome) return;
    const chave = norm(curso.nome);
    if (!chave || usados.has(chave)) return;
    usados.add(chave);
    escolhidos.push(curso);
  }

  for (const preferido of DESTAQUES) {
    const p = norm(preferido);
    const encontrado = base.find((c) => {
      const n = norm(c.nome);
      return n === p || n.includes(p) || p.includes(n);
    });
    if (encontrado) adicionar(encontrado);
    if (escolhidos.length >= limite) return escolhidos;
  }

  for (const curso of [...base].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))) {
    adicionar(curso);
    if (escolhidos.length >= limite) break;
  }
  return escolhidos;
}

async function respostaOutrosCursos(sessao = {}) {
  const atual = nomeCursoDoContexto(sessao, "");
  try {
    const cursos = await EAD.listar();
    const destaques = selecionarDestaques(cursos, atual, 10);
    if (destaques.length) {
      const lista = destaques.map((c) => `• ${c.nome}`).join("\n");
      const abertura = atual
        ? `Temos sim 😊 Além de *${atual}*, temos vários outros cursos EAD, por exemplo:`
        : "Temos sim 😊 Temos vários cursos EAD disponíveis, por exemplo:";
      return `${abertura}\n\n${lista}\n\nSe quiser, eu também posso te mandar a *lista completa* ou indicar cursos por área.`;
    }
  } catch (error) {
    console.warn("⚠️ Lista EAD para continuação natural indisponível:", error?.message || error);
  }

  const fallback = ["Operador de Caixa", "Auxiliar de Classe na Educação Infantil"]
    .filter((nome) => !nomeEquivalente(nome, atual));
  if (fallback.length) {
    return `Temos outros cursos EAD sim 😊\n\n${fallback.map((n) => `• ${n}`).join("\n")}\n\nA lista completa não carregou agora, então prefiro não inventar outros nomes. Posso tentar consultar novamente para você.`;
  }
  return "Temos outros cursos EAD sim 😊 A lista completa não carregou agora. Posso tentar consultar novamente para você.";
}

async function tentarFollowupEad(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!client || !msg || !textoOriginal || !sessao || typeof responder !== "function") return false;

  // Não interfere em formulários que já estão coletando dados.
  const etapa = String(sessao?.etapa || "");
  if (etapa.startsWith("shekinah_matricula_") || etapa.startsWith("unifatecie_matricula_") || etapa.startsWith("financeiro_") || etapa.startsWith("shekinah_secretaria_") || etapa === "atendimento_humano") return false;

  const curso = nomeCursoDoContexto(sessao, textoOriginal);
  const noEad = contextoEad(sessao, textoOriginal);
  if (!noEad) return false;

  marcarContexto(sessao, curso);

  if (ehPedidoMatricula(textoOriginal)) {
    const cursoSelecionado = cursoAtualDaSessao(sessao);
    if (cursoSelecionado && iniciarMatriculaCursoAtual(sessao, cursoSelecionado)) {
      await responder(client, msg.from, mensagemInicioMatricula(cursoSelecionado));
      return true;
    }
  }

  if (ehPerguntaTaxaMatricula(textoOriginal)) {
    await responder(client, msg.from, respostaTaxaMatricula(curso));
    return true;
  }

  if (ehPedidoOutrosCursos(textoOriginal)) {
    await responder(client, msg.from, await respostaOutrosCursos(sessao));
    return true;
  }

  return false;
}

if (!fixes.__shekinahEadFollowupGuard && typeof fixes.tentarCorrecoesAtendimento === "function") {
  const original = fixes.tentarCorrecoesAtendimento;
  fixes.tentarCorrecoesAtendimento = async function (args = {}) {
    if (await tentarFollowupEad(args)) return true;
    return original(args);
  };
  Object.defineProperty(fixes, "__shekinahEadFollowupGuard", { value: true });
  console.log(`🎓 ${NOME_PUBLICO}: contexto natural dos cursos EAD da Shekinah ativo.`);
}

function selfTest() {
  const assert = require("assert");
  assert.equal(ehPerguntaTaxaMatricula("Quanto a matrícula para o curso de auxiliar infantil?"), true);
  assert.equal(ehPerguntaTaxaMatricula("Quero me matricular"), false);
  assert.equal(ehPedidoMatricula("Quero me matricular"), true);
  assert.equal(ehPedidoMatricula("Gostaria de me inscrever"), true);
  assert.equal(ehPedidoMatricula("Quanto custa a matrícula?"), false);
  assert.equal(ehPedidoOutrosCursos("Qual outro curso que tem disponível?"), true);
  assert.equal(ehPedidoOutrosCursos("Tem mais cursos?"), true);
  assert.equal(cursoPromocionalMencionado("auxiliar infantil")?.nome, "Auxiliar de Classe na Educação Infantil");
  assert.equal(cursoPromocionalMencionado("operador de caixa")?.nome, "Operador de Caixa");
  assert.equal(contextoVisualEad({ visaoUltima: { resumo: "Banner Shekinah 100% EAD Operador de Caixa" } }), true);
  assert.match(respostaTaxaMatricula("Auxiliar de Classe na Educação Infantil"), /R\$ 0,00/);
  assert.match(respostaTaxaMatricula("Auxiliar de Classe na Educação Infantil"), /sem taxa/i);

  const sessaoMatricula = {
    instituicao: "shekinah",
    modalidadeShekinah: "ead",
    assuntoAtual: "shekinah_ead",
    eadCursoAtual: "Auxiliar de Creche",
  };
  assert.equal(cursoAtualDaSessao(sessaoMatricula), "Auxiliar de Creche");
  assert.equal(iniciarMatriculaCursoAtual(sessaoMatricula), true);
  assert.equal(sessaoMatricula.etapa, "shekinah_matricula_nome");
  assert.equal(sessaoMatricula.dados.curso, "Auxiliar de Creche");
  assert.equal(sessaoMatricula.matriculaShekinahEad, true);
  assert.match(mensagemInicioMatricula("Auxiliar de Creche"), /Auxiliar de Creche/);

  const selecionados = selecionarDestaques([
    { nome: "Operador de Caixa", status: "Ativo" },
    { nome: "Auxiliar de Creche", status: "Ativo" },
    { nome: "Excel", status: "Ativo" },
  ], "Auxiliar de Classe na Educação Infantil", 10);
  assert.equal(selecionados.some((c) => /auxiliar/i.test(c.nome)), false);
  assert.equal(selecionados.some((c) => c.nome === "Operador de Caixa"), true);
  console.log("✅ Self-test do contexto natural EAD Shekinah aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  cursoPromocionalMencionado,
  contextoVisualEad,
  contextoEad,
  ehPerguntaTaxaMatricula,
  ehPedidoMatricula,
  ehPedidoOutrosCursos,
  cursoAtualDaSessao,
  iniciarMatriculaCursoAtual,
  mensagemInicioMatricula,
  respostaTaxaMatricula,
  selecionarDestaques,
  tentarFollowupEad,
};
