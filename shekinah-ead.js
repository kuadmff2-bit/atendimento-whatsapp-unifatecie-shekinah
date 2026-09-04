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
  const r = await fetch(URL, { headers: { "user-agent": "Mozilla/5.0 Light-Shekinah/3.1" } });
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
  "qual","quais","quanto","quantos","custa","custam","valor","valores","preco","precos","mensalidade","mensalidades","saber","ter",
  "por","favor","fala","falar","diz","dizer","desse","dessa","este","esta","esse","essa"
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

function pesquisarCursosComScore(cs, texto) {
  const termos = termosConsulta(texto);
  if (!termos.length) return [];
  const expandidos = expandirTermos(termos);
  return cs
    .map(c => ({ c, score: pontuarCurso(c, termos, expandidos) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.nome.localeCompare(b.c.nome, "pt-BR"));
}

function pesquisarCursos(cs, texto) {
  return pesquisarCursosComScore(cs, texto).map(x => x.c);
}

function cursoMencionadoNaMensagem(cs, texto) {
  const t = norm(texto);

  // Melhor caso: a mensagem contém o nome completo cadastrado do curso.
  const completos = cs
    .filter(c => {
      const n = norm(c.nome);
      return n && t.includes(n);
    })
    .sort((a, b) => norm(b.nome).length - norm(a.nome).length);
  if (completos.length) return completos[0];

  const termos = termosConsulta(texto);
  if (!termos.length) return null;

  // Se todos os termos úteis da pergunta aparecem no nome de um único curso,
  // é uma referência explícita ao curso, mesmo com pontuação ou ordem diferente.
  const todosNoNome = cs.filter(c => {
    const nome = norm(c.nome);
    return termos.every(termo => nome.includes(termo));
  });
  if (todosNoNome.length === 1) return todosNoNome[0];
  if (todosNoNome.length > 1) {
    return todosNoNome.sort((a, b) => norm(a.nome).length - norm(b.nome).length)[0];
  }

  // Para pequenas variações de escrita, só assume o primeiro resultado quando
  // ele tem vantagem clara sobre o segundo. Isso evita trocar de curso por engano.
  const ranqueados = pesquisarCursosComScore(cs, texto);
  if (!ranqueados.length) return null;
  const primeiro = ranqueados[0];
  const segundo = ranqueados[1];
  if (primeiro.score >= 80 && (!segundo || primeiro.score >= segundo.score + 30)) return primeiro.c;
  return null;
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
  let mencionado = cursoMencionadoNaMensagem(cs, texto);

  // Se a própria mensagem cita um curso, esse curso tem prioridade sobre o
  // contexto anterior. Ex.: “Lógica de Programação, quanto custa?”.
  if (mencionado) {
    sessao.eadCursoAtual = mencionado.nome;
    atual = mencionado;
  }

  if (ehPerguntaValor(t)) {
    if (mencionado || (atual && !termosConsulta(texto).length)) return respostaValor(mencionado || atual);

    // A pessoa escreveu um nome/termo de curso junto com a pergunta de preço,
    // mas não houve correspondência segura. Não pergunta genericamente “de qual curso?”.
    const termos = termosConsulta(texto);
    if (termos.length) {
      let achados = pesquisarCursos(cs, texto);
      if (!achados.length && EscolaAPI.configuracao().configurada) {
        try {
          cs = cursosAtivos(await listar(true));
          mencionado = cursoMencionadoNaMensagem(cs, texto);
          if (mencionado) {
            sessao.eadCursoAtual = mencionado.nome;
            return respostaValor(mencionado);
          }
          achados = pesquisarCursos(cs, texto);
        } catch (_) {}
      }

      if (achados.length === 1) {
        sessao.eadCursoAtual = achados[0].nome;
        return respostaValor(achados[0]);
      }
      if (achados.length > 1) {
        sessao.eadUltimaLista = achados;
        sessao.eadPagina = 0;
        const top = achados.slice(0, 6);
        const linhas = top.map((c, i) => `${i + 1}. ${c.nome}`).join("\n");
        return `💰 Encontrei mais de um curso que pode corresponder ao que você escreveu:\n\n${linhas}\n\nDiga o nome ou número e eu informo o valor exato.`;
      }

      return `🔎 Não encontrei no catálogo EAD um curso correspondente a *${termos.join(" ")}*. Se quiser, posso listar os cursos disponíveis.`;
    }

    if (atual) return respostaValor(atual);
    return "💰 Claro. De qual curso EAD da Shekinah você quer saber o valor?";
  }

  if (ehPerguntaConteudo(t)) {
    if (mencionado) return conteudoCurso(mencionado);
    if (atual && !termosConsulta(texto).length) return conteudoCurso(atual);
  }

  if (ehPerguntaCarga(t)) {
    if (mencionado || (atual && !termosConsulta(texto).length)) {
      const c = mencionado || atual;
      const carga = c.cargaHoraria ? `${c.cargaHoraria}h` : "não foi informada pela plataforma nesta consulta";
      return `⏱️ A carga horária de *${c.nome}* é *${carga}*.`;
    }
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

  if (mencionado) {
    if (ehPerguntaConteudo(t)) return conteudoCurso(mencionado);
    return detalhesCurso(mencionado);
  }

  const consultaDisponibilidade = /^(tem|temos|voces tem|voce tem|ha|existe)|oferece|oferecem|procuro|busco|queria.*curso|quero.*curso/.test(t) || termosConsulta(texto).length > 0;

  if (consultaDisponibilidade) {
    let achados = pesquisarCursos(cs, texto);

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
