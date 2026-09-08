const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");
const Inteligencia = require("./ead-inteligencia");

const PAGINA = 10;

function norm(texto = "") {
  return Inteligencia.norm(texto);
}

function emFluxo(sessao = {}) {
  return typeof Inteligencia.emFluxoObrigatorio === "function" && Inteligencia.emFluxoObrigatorio(sessao);
}

function contextoEad(sessao = {}) {
  return sessao?.instituicao === "shekinah" && (
    sessao?.modalidadeShekinah === "ead" ||
    sessao?.assuntoAtual === "shekinah_ead" ||
    Boolean(sessao?.eadCursoAtual) ||
    Boolean(sessao?.eadAreaAtual)
  );
}

function ativos(cursos = []) {
  const a = cursos.filter(c => !c?.status || norm(c.status) === "ativo");
  return (a.length ? a : cursos).filter(c => c?.nome);
}

function conceitos(texto = "") {
  return typeof Inteligencia.detectarConceitos === "function"
    ? Inteligencia.detectarConceitos(texto)
    : [];
}

function pedidoArea(texto = "") {
  const t = norm(texto);
  if (!t) return false;
  if (conceitos(t).length) return true;
  return /^(outra area|outras areas|outra categoria|outras categorias)$/.test(t);
}

function pedidoOutrasOpcoes(texto = "") {
  const t = norm(texto);
  return /^(outra opcao|outras opcoes|mais opcoes|tem outras|tem mais|outros cursos|mais cursos|e outros|e outras)$/.test(t);
}

function pedidoMais(texto = "") {
  const t = norm(texto);
  return /^(mais|mais opcoes|proximos|proximo|continuar|continua|outras|outros)$/.test(t);
}

function categoria(c = {}) {
  return norm(`${c?.categoriaLoja || ""} ${c?.categoriaInterna || ""}`);
}

function cursoAtual(catalogo = [], sessao = {}) {
  const nome = norm(sessao?.eadCursoAtual || sessao?.curso || "");
  if (!nome) return null;
  return catalogo.find(c => norm(c.nome) === nome) || null;
}

function similaresAoCurso(catalogo = [], atual = null) {
  if (!atual) return [];
  const cat = categoria(atual);
  let semelhantes = [];

  if (cat) {
    semelhantes = catalogo.filter(c => norm(c.nome) !== norm(atual.nome) && categoria(c) && (
      categoria(c) === cat || categoria(c).includes(cat) || cat.includes(categoria(c))
    ));
  }

  if (!semelhantes.length) {
    semelhantes = Inteligencia.recomendar(catalogo, atual.nome, 100)
      .filter(c => norm(c.nome) !== norm(atual.nome));
  }

  return semelhantes;
}

function rotulo(texto = "") {
  if (typeof Inteligencia.rotuloDoPedido === "function") {
    const r = Inteligencia.rotuloDoPedido(texto);
    if (r && r !== "o que você procura") return r;
  }
  return "essa área";
}

function mensagemPagina(lista = [], offset = 0, titulo = "Opções EAD") {
  const fatia = lista.slice(offset, offset + PAGINA);
  if (!fatia.length) return null;
  const linhas = fatia.map((c, i) => `${offset + i + 1}. ${c.nome}`).join("\n");
  const temMais = offset + PAGINA < lista.length;
  return `📚 *${titulo}*\n\n${linhas}\n\n${temMais ? "Digite *mais* para ver as próximas opções. " : ""}Diga o nome ou número do curso e eu mostro os detalhes.`;
}

function salvarLista(sessao, lista, area, offset = 0) {
  sessao.instituicao = "shekinah";
  sessao.modalidadeShekinah = "ead";
  sessao.assuntoAtual = "shekinah_ead";
  sessao.eadUltimaLista = lista;
  sessao.eadPagina = 0;
  sessao.eadCursoAtual = null;
  sessao.eadAreaAtual = area || null;
  sessao.eadAreaResultados = lista;
  sessao.eadAreaOffset = offset;
  sessao.atualizadoEm = Date.now();
}

async function responderArea(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!client || !msg || !sessao || typeof responder !== "function") return false;
  if (!contextoEad(sessao) || emFluxo(sessao)) return false;

  const t = norm(textoOriginal);

  if (pedidoMais(t) && Array.isArray(sessao.eadAreaResultados) && sessao.eadAreaResultados.length) {
    const atualOffset = Number(sessao.eadAreaOffset || 0);
    const proximo = atualOffset + PAGINA;
    const mensagem = mensagemPagina(
      sessao.eadAreaResultados,
      proximo,
      sessao.eadAreaAtual ? `Shekinah EAD — ${sessao.eadAreaAtual}` : "Shekinah EAD — mais opções"
    );
    if (mensagem) {
      sessao.eadAreaOffset = proximo;
      sessao.atualizadoEm = Date.now();
      await responder(client, msg.from, mensagem);
      return true;
    }
  }

  let catalogo;
  try {
    catalogo = ativos(await EAD.listar());
  } catch (e) {
    console.warn("⚠️ EAD área: catálogo indisponível:", e?.message || e);
    return false;
  }

  if (/^(outra area|outras areas|outra categoria|outras categorias)$/.test(t)) {
    await responder(
      client,
      msg.from,
      "Qual área você procura? Pode escrever normalmente, por exemplo: *idiomas, informática, programação, administrativo, vendas, saúde, beleza, educação, culinária, logística ou marketing*."
    );
    return true;
  }

  if (conceitos(t).length) {
    const lista = Inteligencia.recomendar(catalogo, textoOriginal, 100);
    if (!lista.length) return false;
    const area = rotulo(textoOriginal);
    salvarLista(sessao, lista, area, 0);
    await responder(client, msg.from, mensagemPagina(lista, 0, `Shekinah EAD — ${area}`));
    return true;
  }

  if (pedidoOutrasOpcoes(t)) {
    const atual = cursoAtual(catalogo, sessao);
    if (!atual) return false;
    const lista = similaresAoCurso(catalogo, atual);
    if (!lista.length) return false;

    let area = "cursos relacionados";
    const c = conceitos(atual.nome);
    if (c.length === 1) area = c[0].rotulo || area;
    else if (atual.categoriaLoja || atual.categoriaInterna) area = atual.categoriaLoja || atual.categoriaInterna;

    salvarLista(sessao, lista, area, 0);
    await responder(client, msg.from, mensagemPagina(lista, 0, `Outras opções relacionadas a ${atual.nome}`));
    return true;
  }

  return false;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__eadAreaGuard
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await responderArea(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__eadAreaGuard", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(pedidoArea("Idiomas"), true);
  assert.equal(pedidoArea("programação"), true);
  assert.equal(pedidoOutrasOpcoes("Outras opções"), true);
  assert.equal(pedidoMais("mais"), true);
  const catalogo = [
    { nome: "Operador de Caixa", categoriaLoja: "ADMINISTRATIVO" },
    { nome: "Telemarketing", categoriaLoja: "ADMINISTRATIVO" },
    { nome: "Inglês", categoriaLoja: "IDIOMAS" },
    { nome: "Espanhol", categoriaLoja: "IDIOMAS" },
  ];
  assert.deepEqual(
    Inteligencia.recomendar(catalogo, "Idiomas", 20).map(c => c.nome),
    ["Espanhol", "Inglês"]
  );
  assert.deepEqual(similaresAoCurso(catalogo, catalogo[0]).map(c => c.nome), ["Telemarketing"]);
  console.log("✅ Self-test de continuidade por áreas EAD aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  pedidoArea,
  pedidoOutrasOpcoes,
  pedidoMais,
  responderArea,
  similaresAoCurso,
  mensagemPagina,
};
