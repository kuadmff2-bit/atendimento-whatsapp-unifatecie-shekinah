const URL = "https://curso.eadaulas.com/shekinah/lista_cursos.php";
const EscolaAPI = require("./escola-avancada-api");

let cache = { em: 0, cursos: [], fonte: "" };
const CACHE_MS = 20 * 60 * 1000;
const TAMANHO_LISTA = 20;

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
  const r = await fetch(URL, { headers: { "user-agent": "Mozilla/5.0 Light-Shekinah/3.0" } });
  if (!r.ok) throw new Error(`Catálogo EAD HTTP ${r.status}`);
  const cursos = extrair(await r.text());
  if (!cursos.length) throw new Error("Catálogo EAD vazio");
  return cursos;
}

function mapearCursoApi(c = {}) {
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
      id: api.id || pagina?.id || null,
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
      console.warn("⚠️ API EAD cursos:", e?.message || e);
    }
  }

  try {
    paginaCursos = await listarPaginaPublica();
  } catch (e) {
    erroPagina = e;
    console.warn("⚠️ Página pública EAD:", e?.message || e);
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

function cursosAtivos(cs) {
  const ativos = cs.filter(c => !c.status || norm(c.status) === "ativo");
  return ativos.length ? ativos : cs;
}

const STOP = new Set([
  "tem","curso","cursos","de","da","do","das","dos","ead","online","na","no","em","shekinah","oferece","oferecem",
  "voces","voce","eu","quero","queria","gostaria","sobre","um","uma","e","a","o","para","pra","me","mostra","mostrar","temos",
  "qual","quais","quanto","quantos","quanto","custa","custam","valor","valores","preco","precos","mensalidade","mensalidades","saber","ter"
]);

const ALIASES = {
  informatica: ["informatica", "tecnologia", "computador", "computadores", "windows", "office", "excel", "word", "powerpoint", "access", "programacao", "software", "canva", "autocad", "photoshop", "corel", "app", "game"],
  culinaria: ["culinaria", "culinario", "gastronomia", "confeitaria", "doces", "salgados", "panificacao", "padeiro", "bolo", "bolos", "pizzaiolo", "barista", "alimentos", "cozinheiro"],
  administracao: ["administracao", "administrativo", "gestao", "rh", "recursos humanos", "departamento pessoal", "secretariado"],
  vendas: ["vendas", "marketing", "telemarketing", "instagram", "midias sociais", "ecommerce", "loja virtual"]
};

function termosConsulta(texto) {
  const palavras = norm(texto)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(p => !STOP.has(p) && p.length > 2);
  return [...new Set(palavras)];
}

function expandirTermos(termos) {
  const saida = new Set(termos);
  for (const termo of termos) {
    for (const [chave, aliases] of Object.entries(ALIASES)) {
      if (termo === chave || aliases.includes(termo)) {
        saida.add(chave);
        aliases.forEach(a => saida.add(norm(a)));
      }
    }
  }
  return [...saida];
}

function pontuarCurso(c, termosOriginais, termosExpandidos) {
  const nome = norm(c.nome);
  const categoria = norm(`${c.categoriaInterna || ""} ${c.categoriaLoja || ""}`);
  let score = 0;

  for (const termo of termosOriginais) {
    if (nome === termo) score += 100;
    else if (nome.startsWith(termo)) score += 60;
    else if (nome.includes(termo)) score += 45;
    if (categoria.includes(termo)) score += 30;
  }

  for (const termo of termosExpandidos) {
    if (termosOriginais.includes(termo)) continue;
    if (nome === termo) score += 24;
    else if (nome.includes(termo)) score += 14;
    if (categoria.includes(termo)) score += 8;
  }

  return score;
}

function pesquisarCursos(cs, texto) {
  const termos = termosConsulta(texto);
  if (!termos.length) return [];
  const expandidos = expandirTermos(termos);
  return cs
    .map(c => ({ c, score: pontuarCurso(c, termos, expandidos) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.nome.localeCompare(b.c.nome, "pt-BR"))
    .map(x => x.c);
}

async function buscar(texto) {
  const cs = cursosAtivos(await listar());
  return pesquisarCursos(cs, texto).slice(0, 12);
}

function precoDisponivel(c) {
  return c?.precoPromocional || c?.preco || "";
}

function linhaValor(c) {
  if (norm(c.precoMostrar) !== "sim") return "";
  const valor = precoDisponivel(c);
  if (!valor) return "";
  const parcelas = c.parcelas ? ` em até ${c.parcelas} parcela(s)` : "";
  return `\n💰 *Valor:* R$ ${valor}${parcelas}`;
}

function respostaValor(c) {
  const valor = precoDisponivel(c);
  if (!valor) {
    return `💰 A plataforma não retornou um valor cadastrado para *${c.nome}* nesta consulta. Não vou inventar um preço. Posso te mostrar os detalhes do curso ou encaminhar a confirmação do valor.`;
  }
  const parcelas = c.parcelas ? `\n💳 Parcelamento cadastrado: até *${c.parcelas}x*.` : "";
  return `💰 O valor cadastrado na plataforma para *${c.nome} — EAD Shekinah* é *R$ ${valor}*.${parcelas}`;
}

function linhaCarga(c) {
  return c.cargaHoraria ? `\n⏱️ *Carga horária:* ${c.cargaHoraria}h` : "";
}

function detalhesCurso(c) {
  return `🎓 *${c.nome} — EAD Shekinah*\n\n${c.descricao || ""}\n\n📚 O curso possui *${c.quantidadeAulas} aulas*.${linhaCarga(c)}${linhaValor(c)}\n\nSe quiser, posso mostrar o conteúdo programático completo ou informar o valor. 😊`;
}

function conteudoCurso(c) {
  if (Array.isArray(c.aulas) && c.aulas.length) {
    const lista = c.aulas.map(a => `${String(a.numero).padStart(2, "0")}. ${a.titulo}`).join("\n");
    return `🎓 *${c.nome} — EAD Shekinah*\n\n📚 *${c.quantidadeAulas} aulas*${linhaCarga(c)}\n\n${lista}`;
  }
  return `📚 *${c.nome}* possui *${c.quantidadeAulas} aulas*.${linhaCarga(c)}\n\nA lista detalhada das aulas não veio disponível nesta consulta.`;
}

function paginaLista(base, pagina = 0) {
  const inicio = pagina * TAMANHO_LISTA;
  const fatia = base.slice(inicio, inicio + TAMANHO_LISTA);
  if (!fatia.length) return null;
  const linhas = fatia.map((c, i) => `${inicio + i + 1}. ${c.nome}`).join("\n");
  const temMais = inicio + TAMANHO_LISTA < base.length;
  return `🎓 A *Shekinah* tem *${base.length} cursos EAD* disponíveis na plataforma.\n\n${linhas}\n\n${temMais ? "Digite *mais* para ver os próximos cursos, ou " : ""}diga o nome ou número do curso para ver os detalhes. 📚`;
}

function cursoAtualDaSessao(cs, sessao) {
  const nome = norm(sessao?.eadCursoAtual || "");
  if (!nome) return null;
  return cs.find(c => norm(c.nome) === nome) || null;
}

function ehPerguntaValor(t) {
  return /(^|\b)(valor|preco|quanto custa|custa quanto|qual o valor|qual valor|mensalidade|parcelas|parcelamento)(\b|$)/.test(t);
}

function ehPerguntaConteudo(t) {
  return /(^|\b)(conteudo|grade|materia|materias|aulas|o que aprende|o que ensina)(\b|$)/.test(t);
}

function ehPerguntaCarga(t) {
  return /carga horaria|quantas horas|duracao|quanto tempo/.test(t);
}

async function responder(texto, sessao = {}) {
  const t = norm(texto);
  const contextoEad = sessao.assuntoAtual === "shekinah_ead" || sessao.modalidadeShekinah === "ead" || /\bead\b|online|curso\.eadaulas|cursos ead/.test(t);
  const mencionaShekinah = /shekinah/.test(t);
  const mencionaCurso = /curso|cursos|aula|aulas|conteudo|grade|materia|materias/.test(t);

  if (!contextoEad && !mencionaShekinah && !mencionaCurso) return null;

  let cs = cursosAtivos(await listar());
  let atual = cursoAtualDaSessao(cs, sessao);

  // Perguntas curtas como “e o valor?” sempre se referem ao último curso escolhido.
  if (ehPerguntaValor(t)) {
    if (atual) return respostaValor(atual);
    return "💰 Claro. De qual curso EAD da Shekinah você quer saber o valor?";
  }

  if (ehPerguntaConteudo(t) && atual && !termosConsulta(texto).length) {
    return conteudoCurso(atual);
  }

  if (ehPerguntaCarga(t) && atual) {
    const carga = atual.cargaHoraria ? `${atual.cargaHoraria}h` : "não foi informada pela plataforma nesta consulta";
    return `⏱️ A carga horária de *${atual.nome}* é *${carga}*.`;
  }

  if (/^(mais|proximos|proximo|continuar|continua)$/.test(t) && Array.isArray(sessao.eadUltimaLista)) {
    const proxima = Number(sessao.eadPagina || 0) + 1;
    const msg = paginaLista(sessao.eadUltimaLista, proxima);
    if (msg) {
      sessao.eadPagina = proxima;
      return msg;
    }
    return "📚 Você já chegou ao fim da lista de cursos EAD. Diga o nome de uma área ou curso que eu procuro para você. 😊";
  }

  if (/^\d{1,3}$/.test(t) && Array.isArray(sessao.eadUltimaLista)) {
    const c = sessao.eadUltimaLista[Number(t) - 1];
    if (c) {
      sessao.eadCursoAtual = c.nome;
      return detalhesCurso(c);
    }
  }

  if (/(quais|lista|listar|catalogo|opcoes).*(curso|ead)|(curso|cursos).*ead/.test(t)) {
    sessao.eadUltimaLista = cs;
    sessao.eadPagina = 0;
    sessao.eadCursoAtual = null;
    return paginaLista(cs, 0);
  }

  const exato = cs.find(c => t.includes(norm(c.nome)));
  if (exato) {
    sessao.eadCursoAtual = exato.nome;
    if (ehPerguntaConteudo(t)) return conteudoCurso(exato);
    if (ehPerguntaValor(t)) return respostaValor(exato);
    return detalhesCurso(exato);
  }

  const consultaDisponibilidade = /^(tem|temos|voces tem|voce tem|ha|existe)|oferece|oferecem|procuro|busco|queria.*curso|quero.*curso/.test(t) || termosConsulta(texto).length > 0;

  if (consultaDisponibilidade) {
    let achados = pesquisarCursos(cs, texto);

    // Se não encontrou, força atualização para evitar resposta baseada em cache antigo.
    if (!achados.length && EscolaAPI.configuracao().configurada) {
      try {
        cs = cursosAtivos(await listar(true));
        achados = pesquisarCursos(cs, texto);
      } catch (_) {}
    }

    if (achados.length) {
      sessao.eadUltimaLista = achados;
      sessao.eadPagina = 0;
      if (achados.length === 1) {
        sessao.eadCursoAtual = achados[0].nome;
        return detalhesCurso(achados[0]);
      }
      const top = achados.slice(0, 12);
      const linhas = top.map((c, i) => `${i + 1}. ${c.nome}`).join("\n");
      const termo = termosConsulta(texto)[0] || "essa área";
      return `✅ Encontrei opções EAD relacionadas a *${termo}* na Shekinah:\n\n${linhas}\n\nDiga o nome ou número do curso para ver os detalhes. 📚`;
    }

    const termo = termosConsulta(texto)[0] || "esse curso";
    return `🔎 Procurei *${termo}* no catálogo EAD atual da Shekinah e não encontrei um curso correspondente. Posso listar o catálogo completo para você conferir.`;
  }

  return null;
}

module.exports = {
  listar,
  buscar,
  responder,
  URL,
  apiConfigurada: () => EscolaAPI.configuracao().configurada
};
