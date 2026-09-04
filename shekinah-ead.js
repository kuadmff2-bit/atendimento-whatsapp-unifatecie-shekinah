const URL = "https://curso.eadaulas.com/shekinah/lista_cursos.php";
const EscolaAPI = require("./escola-avancada-api");

let cache = { em: 0, cursos: [], fonte: "" };
const CACHE_MS = 30 * 60 * 1000;

function limpar(s = "") {
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function norm(s = "") {
  return limpar(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extrair(html) {
  const cursos = [];
  const re = /<div class="modal fade" id="exampleModal(\d+)"[\s\S]*?<div class="modal-header"[\s\S]*?<i class="bi bi-mortarboard"><\/i><\/div>\s*<div[^>]*>([\s\S]*?)<\/div><hr>\s*<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="modal-body">[\s\S]*?<div class="cont">Conteúdo programático<\/div>([\s\S]*?)<div class="modal-footer">/gi;
  let m;
  while ((m = re.exec(html))) {
    const aulas = [];
    const ar = /<div class="aula"><span class="aulap">(\d+)<\/span>([\s\S]*?)<\/div>/gi;
    let a;
    while ((a = ar.exec(m[4]))) aulas.push({ numero: Number(a[1]), titulo: limpar(a[2]) });
    cursos.push({
      id: Number(m[1]),
      nome: limpar(m[2]),
      descricao: limpar(m[3]),
      quantidadeAulas: aulas.length,
      aulas,
      fonte: "pagina_publica"
    });
  }
  return cursos;
}

async function listarPaginaPublica() {
  const r = await fetch(URL, { headers: { "user-agent": "Mozilla/5.0 Light-Shekinah/2.0" } });
  if (!r.ok) throw new Error(`Catálogo EAD HTTP ${r.status}`);
  const cursos = extrair(await r.text());
  if (!cursos.length) throw new Error("Catálogo EAD vazio");
  return cursos;
}

function mapearCursoApi(c) {
  return {
    id: c.id ? Number(c.id) : null,
    nome: limpar(c.nome),
    descricao: limpar(c.obs),
    quantidadeAulas: Number(String(c.aulas || "0").replace(/\D/g, "")) || 0,
    aulas: [],
    preco: limpar(c.preco),
    precoPromocional: limpar(c.preco_promocional),
    parcelas: limpar(c.parcelas),
    status: limpar(c.status),
    categoriaInterna: limpar(c.categoria_interna),
    categoriaLoja: limpar(c.categoria_loja),
    cargaHoraria: limpar(c.carga_horaria),
    precoMostrar: limpar(c.preco_mostrar),
    capa: limpar(c.capa_image),
    fonte: "api_oficial"
  };
}

function mesclarCursos(apiCursos, paginaCursos) {
  const paginaPorNome = new Map(paginaCursos.map(c => [norm(c.nome), c]));
  const saida = [];
  const usados = new Set();

  for (const bruto of apiCursos) {
    const api = mapearCursoApi(bruto);
    if (!api.nome) continue;
    const chave = norm(api.nome);
    const pagina = paginaPorNome.get(chave);
    usados.add(chave);
    saida.push({
      ...(pagina || {}),
      ...api,
      id: pagina?.id || api.id || null,
      descricao: api.descricao || pagina?.descricao || "",
      quantidadeAulas: api.quantidadeAulas || pagina?.quantidadeAulas || 0,
      aulas: pagina?.aulas || [],
      fonte: pagina ? "api_oficial+pagina_publica" : "api_oficial"
    });
  }

  for (const pagina of paginaCursos) {
    if (!usados.has(norm(pagina.nome))) saida.push(pagina);
  }

  return saida;
}

async function listar(force = false) {
  if (!force && cache.cursos.length && Date.now() - cache.em < CACHE_MS) return cache.cursos;

  let apiCursos = [];
  let paginaCursos = [];
  let erroApi = null;
  let erroPagina = null;

  if (EscolaAPI.configuracao().configurada) {
    try {
      const r = await EscolaAPI.listarCursos();
      if (Array.isArray(r)) apiCursos = r;
    } catch (e) {
      erroApi = e;
    }
  }

  try {
    paginaCursos = await listarPaginaPublica();
  } catch (e) {
    erroPagina = e;
  }

  let cursos = [];
  let fonte = "";
  if (apiCursos.length && paginaCursos.length) {
    cursos = mesclarCursos(apiCursos, paginaCursos);
    fonte = "api_oficial+pagina_publica";
  } else if (apiCursos.length) {
    cursos = apiCursos.map(mapearCursoApi);
    fonte = "api_oficial";
  } else if (paginaCursos.length) {
    cursos = paginaCursos;
    fonte = "pagina_publica";
  }

  if (!cursos.length) {
    const detalhes = [erroApi?.message, erroPagina?.message].filter(Boolean).join(" | ");
    throw new Error(detalhes || "Catálogo EAD indisponível");
  }

  cache = { em: Date.now(), cursos, fonte };
  return cursos;
}

async function buscar(texto) {
  const q = norm(texto);
  const cs = await listar();
  return cs.filter(c => q.includes(norm(c.nome)) || norm(c.nome).includes(q)).slice(0, 5);
}

function linhaValor(c) {
  if (norm(c.precoMostrar) !== "sim") return "";
  const valor = c.precoPromocional || c.preco;
  if (!valor) return "";
  const parcelas = c.parcelas ? ` em até ${c.parcelas} parcela(s)` : "";
  return `\n💰 *Valor:* R$ ${valor}${parcelas}`;
}

function linhaCarga(c) {
  return c.cargaHoraria ? `\n⏱️ *Carga horária:* ${c.cargaHoraria}h` : "";
}

async function responder(texto) {
  const t = norm(texto);
  if (!/(ead|curso|cursos|aula|aulas|conteudo|shekinah)/.test(t)) return null;

  const cs = await listar();
  if (/(quais|lista|listar|catalogo|opcoes).*(curso|ead)|(curso|cursos).*ead/.test(t)) {
    const ativos = cs.filter(c => !c.status || norm(c.status) === "ativo");
    const base = ativos.length ? ativos : cs;
    const nomes = base.map(c => c.nome);
    const blocos = [];
    for (let i = 0; i < nomes.length; i += 20) {
      blocos.push(nomes.slice(i, i + 20).map((n, j) => `${i + j + 1}. ${n}`).join("\n"));
    }
    return `🎓 A *Shekinah* tem *${base.length} cursos EAD* disponíveis na plataforma.\n\n${blocos[0]}\n\nSe quiser, diga o nome ou número do curso que eu mostro os detalhes. 📚`;
  }

  const achados = cs.filter(c => t.includes(norm(c.nome))).slice(0, 3);
  if (!achados.length) return null;
  const c = achados[0];

  if (/(conteudo|grade|materia|materias|aulas|ensina|aprende)/.test(t)) {
    if (c.aulas?.length) {
      const lista = c.aulas.map(a => `${String(a.numero).padStart(2, "0")}. ${a.titulo}`).join("\n");
      return `🎓 *${c.nome} — EAD Shekinah*\n\n${c.descricao || ""}\n\n📚 *${c.quantidadeAulas} aulas*${linhaCarga(c)}${linhaValor(c)}\n${lista}`;
    }
    return `🎓 *${c.nome} — EAD Shekinah*\n\n${c.descricao || ""}\n\n📚 O curso possui *${c.quantidadeAulas} aulas*.${linhaCarga(c)}${linhaValor(c)}`;
  }

  return `🎓 *${c.nome} — EAD Shekinah*\n\n${c.descricao || ""}\n\n📚 O curso possui *${c.quantidadeAulas} aulas*.${linhaCarga(c)}${linhaValor(c)}\n\nSe quiser, posso mostrar o conteúdo programático completo. 😊`;
}

module.exports = {
  listar,
  buscar,
  responder,
  URL,
  apiConfigurada: () => EscolaAPI.configuracao().configurada
};
