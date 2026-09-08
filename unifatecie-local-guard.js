const Module = require("module");
const originalLoad = Module._load;

const APROVADOS = Object.freeze([
  { nome: "Administração", formacao: "Bacharelado", duracao: "3 anos", valor: "R$ 112,20/mês" },
  { nome: "Ciências Contábeis", formacao: "Bacharelado", duracao: "3 anos", valor: "R$ 112,20/mês" },
  { nome: "Análise e Desenvolvimento de Sistemas", formacao: "Tecnólogo", duracao: "2 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão de Recursos Humanos", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Gestão Financeira", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Gestão Pública", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Logística", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Processos Gerenciais", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Sistemas para Internet", formacao: "Tecnólogo", duracao: "2 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão da Qualidade", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Investigação Forense e Perícia Criminal", formacao: "Tecnólogo", duracao: "3 anos", valor: "R$ 112,20/mês", restrito: true },
  { nome: "Design Gráfico", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Design de Moda", formacao: "Tecnólogo", duracao: "1,5 ano", valor: "R$ 112,20/mês" },
  { nome: "Biblioteconomia", formacao: "Bacharelado", duracao: "3 anos", valor: "R$ 112,20/mês" },
]);

const BLOQUEADOS = Object.freeze([
  "Pedagogia", "História", "Geografia", "Letras - Português/Inglês", "Letras - Português/Libras",
  "Matemática", "Artes", "Sociologia", "Música", "Educação Especial",
  "Biomedicina", "Farmácia", "Fisioterapia", "Fonoaudiologia", "Nutrição", "Terapia Ocupacional",
  "Radiologia", "Enfermagem", "Estética e Cosmética", "Gestão Hospitalar",
  "Serviço Social", "Psicopedagogia", "Gestão Ambiental", "Processos Escolares",
  "Arquitetura e Urbanismo", "Engenharia Agronômica", "Engenharia Ambiental e Sanitária",
  "Engenharia Civil", "Engenharia de Produção", "Engenharia Elétrica", "Engenharia Mecânica",
  "Engenharia de Computação", "Direito EAD"
]);

const POR_PAGINA = 7;

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/[!?.,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const APROVADOS_NORM = new Set(APROVADOS.map(c => norm(c.nome)));
const BLOQUEADOS_NORM = BLOQUEADOS.map(nome => ({ nome, n: norm(nome) }));

function emFluxoEstruturado(sessao = {}) {
  const e = String(sessao?.etapa || "");
  return e.startsWith("unifatecie_matricula_")
    || e.startsWith("shekinah_matricula_")
    || e.startsWith("financeiro_")
    || e.startsWith("shekinah_secretaria_")
    || e === "atendimento_humano";
}

function cursoBloqueadoCitado(texto = "") {
  const t = norm(texto);
  if (!t) return null;

  for (const item of BLOQUEADOS_NORM) {
    if (item.n === "direito ead") {
      if (/\bdireito\b/.test(t)) return item.nome;
      continue;
    }
    if (item.n.startsWith("letras ") && /\bletras\b/.test(t)) return item.nome;
    if (t.includes(item.n)) return item.nome;
  }
  return null;
}

function contextoUni(sessao = {}, texto = "") {
  const t = norm(texto);
  return sessao?.instituicao === "unifatecie"
    || String(sessao?.assuntoAtual || "").toLowerCase().includes("unifatecie")
    || /\b(unifatecie|fatecie|faculdade|graduacao|curso superior|cursos superiores)\b/.test(t);
}

function pedidoListaLocal(texto = "", sessao = {}) {
  const t = norm(texto);
  if (!contextoUni(sessao, texto)) return false;
  if (/^(mais|ver mais|mostra mais|mostrar mais|proximos|proximas|continuar|continua)$/.test(t)) return false;

  return /\b(quais|lista|listar|catalogo|mostrar|mostra|mostre|ver|opcoes)\b.*\b(curso|cursos|graduacao|graduacoes|opcoes)\b/.test(t)
    || /\b(curso|cursos|graduacao|graduacoes)\b.*\b(quais|lista|catalogo|opcoes|tem|oferece|oferecem)\b/.test(t)
    || /^(cursos|graduacao|graduacoes|opcoes|mais opcoes|tem mais opcoes|tem outras opcoes|outras opcoes)$/.test(t)
    || /\btem mais opcoes\b/.test(t)
    || /\bmais opcoes de (curso|cursos|graduacao)\b/.test(t);
}

function pedidoMais(texto = "", sessao = {}) {
  const t = norm(texto);
  return sessao?.assuntoAtual === "unifatecie_lista_local"
    && /^(mais|ver mais|mostra mais|mostrar mais|proximo|proxima|proximos|proximas|continuar|continua)$/.test(t);
}

function formatarPagina(pagina = 0) {
  const totalPaginas = Math.ceil(APROVADOS.length / POR_PAGINA);
  const segura = Math.min(Math.max(0, Number(pagina) || 0), totalPaginas - 1);
  const inicio = segura * POR_PAGINA;
  const parte = APROVADOS.slice(inicio, inicio + POR_PAGINA);
  const linhas = parte.map(c => {
    const restricao = c.restrito ? " — sujeito a pré-requisito profissional" : "";
    return `• *${c.nome}* — ${c.duracao} — ${c.valor}${restricao}`;
  }).join("\n");

  let texto = `🎓 *UniFatecie Polo Barreirinha — cursos liberados* (${segura + 1}/${totalPaginas})\n\n${linhas}`;
  if (segura < totalPaginas - 1) texto += "\n\nPara ver os próximos, mande apenas *mais*.";
  else texto += "\n\n✅ Esses são os cursos atualmente liberados na base do Polo Barreirinha.\n🎁 Matrícula grátis.";
  return { texto, pagina: segura, totalPaginas };
}

function marcarLista(sessao = {}, pagina = 0) {
  const p = formatarPagina(pagina);
  sessao.instituicao = "unifatecie";
  sessao.modalidadeShekinah = null;
  sessao.eadCursoAtual = null;
  sessao.cursoAtual = null;
  sessao.curso = "";
  sessao.assuntoAtual = "unifatecie_lista_local";
  sessao.unifatecieListaLocalPagina = p.pagina;
  sessao.unifatecieListaLocalTotal = p.totalPaginas;
  sessao.atualizadoEm = Date.now();
  return p;
}

function mensagemBloqueado(nome) {
  const pedagogia = norm(nome) === "pedagogia";
  const motivo = pedagogia
    ? "Na base operacional atual, *Pedagogia não está liberada para oferta pelo Polo Barreirinha*, porque a modalidade vigente exige presencialidade/estrutura que o polo não está oferecendo."
    : `Na base operacional atual, *${nome} não está liberado para oferta pelo Polo Barreirinha*.`;
  return `⚠️ ${motivo}\n\nNão vou informar matrícula ou vender esse curso como disponível no polo. Se quiser, posso mostrar somente as graduações que estão liberadas hoje.`;
}

function mensagemEhBloqueioCorreto(texto = "") {
  const t = norm(texto);
  return /\b(nao esta liberad|nao deve ser ofertad|nao e ofertad|nao esta disponivel|nao oferecemos)\b/.test(t);
}

function pareceOfertaPositiva(texto = "") {
  const t = norm(texto);
  return /\b(liberad|oferecemos|temos|mensalidade|matricula gratis|pre matricula|iniciar.*matricula|melhor opcao|recomendo|pode iniciar|curso aprovado|disponivel no polo)\b/.test(t);
}

function pareceListaLocal(texto = "") {
  const t = norm(texto);
  return /\b(polo barreirinha)\b/.test(t)
    && /\b(cursos|opcoes|graduacao|liberados|seguintes)\b/.test(t)
    && (/\n\s*[•\-*]/.test(String(texto)) || /temos as seguintes opcoes/.test(t));
}

function sanitizarSaida(texto = "", sessao = {}) {
  const bruto = String(texto || "");
  if (!bruto) return bruto;

  if (pareceListaLocal(bruto)) {
    const citados = BLOQUEADOS_NORM.filter(b => norm(bruto).includes(b.n));
    const haNaoAprovado = bruto.split(/\r?\n/).some(linha => {
      const l = norm(linha);
      if (!l || !/[•*-]/.test(linha)) return false;
      const pareceCurso = /\b(anos?|meses?|mensalidade|r\$|bacharelado|licenciatura|tecnologo)\b/.test(l);
      if (!pareceCurso) return false;
      return citados.some(b => l.includes(b.n));
    });
    if (haNaoAprovado) {
      const p = marcarLista(sessao, 0);
      return p.texto;
    }
  }

  const bloqueado = cursoBloqueadoCitado(bruto);
  if (bloqueado && pareceOfertaPositiva(bruto) && !mensagemEhBloqueioCorreto(bruto)) {
    return mensagemBloqueado(bloqueado);
  }

  return bruto;
}

function filtrarCursosIA(cursos = {}) {
  if (!cursos || typeof cursos !== "object") return cursos;
  const saida = {};
  for (const [chave, curso] of Object.entries(cursos)) {
    const nome = norm(curso?.nome || chave);
    if (APROVADOS_NORM.has(nome)) saida[chave] = curso;
  }
  return saida;
}

async function tentarLocal(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;
  if (emFluxoEstruturado(sessao)) return false;

  const bloqueado = cursoBloqueadoCitado(textoOriginal);
  if (bloqueado && (contextoUni(sessao, textoOriginal) || /\b(curso|graduacao|faculdade|mensalidade|matricula|valor|duracao|estagio)\b/.test(norm(textoOriginal)))) {
    sessao.instituicao = "unifatecie";
    sessao.modalidadeShekinah = null;
    sessao.curso = "";
    sessao.cursoAtual = null;
    sessao.assuntoAtual = "unifatecie_curso_bloqueado";
    sessao.atualizadoEm = Date.now();
    await responder(client, msg.from, mensagemBloqueado(bloqueado));
    return true;
  }

  if (pedidoMais(textoOriginal, sessao)) {
    const atual = Number(sessao.unifatecieListaLocalPagina || 0);
    const total = Number(sessao.unifatecieListaLocalTotal || Math.ceil(APROVADOS.length / POR_PAGINA));
    if (atual >= total - 1) {
      await responder(client, msg.from, "✅ Você já viu todos os cursos atualmente liberados no Polo Barreirinha. Se quiser, mande o nome de um deles para ver os detalhes.");
      return true;
    }
    const p = marcarLista(sessao, atual + 1);
    await responder(client, msg.from, p.texto);
    return true;
  }

  if (pedidoListaLocal(textoOriginal, sessao)) {
    const p = marcarLista(sessao, 0);
    await responder(client, msg.from, p.texto);
    return true;
  }

  return false;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);

  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__unifatecieLocalGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarLocal(args)) return true;
      const responderOriginal = args.responder;
      const responderSeguro = typeof responderOriginal === "function"
        ? async (client, destino, mensagem) => responderOriginal(client, destino, sanitizarSaida(mensagem, args.sessao))
        : responderOriginal;
      return original({ ...args, responder: responderSeguro });
    };
    Object.defineProperty(exp, "__unifatecieLocalGuard", { value: true });
  }

  if (
    (request === "./ia-groq-ext" || request.endsWith("/ia-groq-ext")) &&
    exp && typeof exp.tentarResponderComIA === "function" && !exp.__unifatecieLocalGuard
  ) {
    const originalIA = exp.tentarResponderComIA;
    exp.tentarResponderComIA = async function (args = {}) {
      const resposta = await originalIA({ ...args, cursosUnifatecie: filtrarCursosIA(args.cursosUnifatecie) });
      return resposta ? sanitizarSaida(resposta, args.sessao || {}) : resposta;
    };
    Object.defineProperty(exp, "__unifatecieLocalGuard", { value: true });
  }

  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(cursoBloqueadoCitado("Qual o valor de Pedagogia?"), "Pedagogia");
  assert.equal(APROVADOS_NORM.has(norm("Pedagogia")), false);
  assert.equal(APROVADOS.length, 14);
  assert.equal(pedidoListaLocal("Tem mais opções?", { instituicao: "unifatecie" }), true);
  const s = { instituicao: "unifatecie" };
  const p1 = marcarLista(s, 0);
  assert.equal(p1.texto.includes("Pedagogia"), false);
  assert.equal(p1.texto.includes("Análise e Desenvolvimento de Sistemas"), true);
  const errado = "No Polo Barreirinha temos as seguintes opções:\n• Pedagogia (Licenciatura) — 4 anos\n• Administração — 3 anos";
  const corrigido = sanitizarSaida(errado, s);
  assert.equal(corrigido.includes("Pedagogia"), false);
  assert.equal(corrigido.includes("Administração"), true);
  const cursosIA = filtrarCursosIA({ p: { nome: "Pedagogia" }, a: { nome: "Administração" } });
  assert.equal(Boolean(cursosIA.p), false);
  assert.equal(cursosIA.a.nome, "Administração");
  console.log("✅ Self-test da política local UniFatecie aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  APROVADOS,
  BLOQUEADOS,
  cursoBloqueadoCitado,
  pedidoListaLocal,
  pedidoMais,
  formatarPagina,
  sanitizarSaida,
  filtrarCursosIA,
  tentarLocal,
};
