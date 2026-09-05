function norm(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "tem","curso","cursos","de","da","do","das","dos","um","uma","uns","umas","o","a","os","as","e","ou","pra","para","por","com",
  "eu","me","meu","minha","quero","queria","gostaria","preciso","saber","ver","mostra","mostrar","mostre","mostreme","opcao","opcoes",
  "ead","online","shekinah","voces","voce","oferece","oferecem","algum","alguma","algo","area","nessa","nesta","isso","issoai","ai"
]);

const CONCEITOS = [
  {
    nome: "jogos",
    gatilhos: ["jogo","jogos","game","games","gamedev","desenvolver jogos","criar jogos","fazer jogos","programar jogos"],
    prioridades: ["Criação de Game Profissional","Lógica de Programação","Blender 3D","3D Studio Max Básico","JavaScript"]
  },
  {
    nome: "programacao",
    gatilhos: ["programacao","programar","codigo","codar","desenvolvedor","desenvolvimento de software","software"],
    prioridades: ["Lógica de Programação","JavaScript","PHP: Do Básico ao Avançado","HTML e CSS","Criação de App Android e iOS","Criação de Game Profissional"]
  },
  {
    nome: "sites",
    gatilhos: ["site","sites","website","pagina web","web","criar site","desenvolver site","loja virtual","ecommerce","e commerce"],
    prioridades: ["HTML e CSS","JavaScript","PHP: Do Básico ao Avançado","Programação de sites Wordpress","WordPress V2","Criação de Loja Virtual"]
  },
  {
    nome: "apps",
    gatilhos: ["aplicativo","aplicativos","app","apps","android","ios","criar aplicativo","desenvolver aplicativo"],
    prioridades: ["Criação de App Android e iOS","Lógica de Programação","JavaScript"]
  },
  {
    nome: "design",
    gatilhos: ["design","arte digital","imagem","imagens","logo","logos","editar foto","foto","fotos"],
    prioridades: ["Canva","PhotoShop CC","Illustrator 2022","Corel Draw X8","InDesign"]
  },
  {
    nome: "video",
    gatilhos: ["video","videos","editar video","edicao de video","motion","efeitos visuais"],
    prioridades: ["Edição de Vídeo Premiere","After Effects","Como ser um Youtuber","Operador de Podcast"]
  },
  {
    nome: "3d",
    gatilhos: ["3d","modelagem 3d","modelar","render","animacao 3d"],
    prioridades: ["Blender 3D","3D Studio Max Básico","SketchUp","AutoCad 2D e 3D"]
  },
  {
    nome: "planilhas",
    gatilhos: ["planilha","planilhas","excel","dados","dashboard","bi","power bi"],
    prioridades: ["Excel Básico e Avançado","Power Bi","Access 2016"]
  },
  {
    nome: "informatica",
    gatilhos: ["informatica","computador","computadores","pc","windows","office","digitar","digitacao"],
    prioridades: ["Introdução à Informática","Windows 11","Microsoft Word","Excel Básico e Avançado","Power Point","Digitação Interativa"]
  },
  {
    nome: "manutencao",
    gatilhos: ["consertar celular","arrumar celular","manutencao celular","tecnico de celular","consertar computador","manutencao pc","montar pc"],
    prioridades: ["Manutenção de Celular Básico ao Avançado","Montagem e Manutenção de PC"]
  },
  {
    nome: "marketing",
    gatilhos: ["marketing","vendas online","anuncio","anuncios","trafego","dropshipping","whatsapp business","vender pela internet"],
    prioridades: ["Google Adwords","Dropshipping","WhatsApp Business","Criação de Loja Virtual","Canva"]
  },
  {
    nome: "criador",
    gatilhos: ["youtuber","youtube","podcast","criador de conteudo","conteudo digital"],
    prioridades: ["Como ser um Youtuber","Operador de Podcast","Edição de Vídeo Premiere","After Effects","Canva"]
  },
  {
    nome: "seguranca",
    gatilhos: ["seguranca digital","seguranca na internet","internet segura","cyber","ciberseguranca"],
    prioridades: ["Segurança na Internet","Linux"]
  }
];

function tokens(texto) {
  return norm(texto).split(" ").filter(p => p.length > 2 && !STOP.has(p));
}

function dice(a, b) {
  a = norm(a).replace(/\s/g, "");
  b = norm(b).replace(/\s/g, "");
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pares = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const p = a.slice(i, i + 2);
    pares.set(p, (pares.get(p) || 0) + 1);
  }
  let inter = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const p = b.slice(i, i + 2);
    const n = pares.get(p) || 0;
    if (n > 0) {
      inter += 1;
      pares.set(p, n - 1);
    }
  }
  return (2 * inter) / ((a.length - 1) + (b.length - 1));
}

function incluiExpressao(texto, expressao) {
  const t = ` ${norm(texto)} `;
  const e = ` ${norm(expressao)} `;
  return t.includes(e);
}

function detectarConceitos(texto) {
  const t = norm(texto);
  return CONCEITOS.filter(c => c.gatilhos.some(g => incluiExpressao(t, g) || t.includes(norm(g))));
}

function porNome(cursos = []) {
  return new Map(cursos.map(c => [norm(c?.nome), c]).filter(([n]) => n));
}

function recomendar(cursos = [], texto = "", limite = 8) {
  const mapa = porNome(cursos);
  const selecionados = [];
  const vistos = new Set();

  for (const conceito of detectarConceitos(texto)) {
    for (const nome of conceito.prioridades) {
      const curso = mapa.get(norm(nome));
      if (curso && !vistos.has(norm(curso.nome))) {
        selecionados.push({ curso, score: 300 - selecionados.length });
        vistos.add(norm(curso.nome));
      }
    }
  }

  const qTokens = tokens(texto);
  for (const curso of cursos) {
    const n = norm(curso?.nome);
    if (!n || vistos.has(n)) continue;
    const nTokens = n.split(" ").filter(Boolean);
    let score = 0;
    for (const q of qTokens) {
      if (nTokens.includes(q)) score += 70;
      else if (n.includes(q) || q.includes(n)) score += 45;
      else {
        const melhor = Math.max(0, ...nTokens.map(nt => dice(q, nt)));
        if (melhor >= 0.82) score += 35;
        else if (melhor >= 0.72) score += 20;
      }
    }
    if (score > 0) selecionados.push({ curso, score });
  }

  return selecionados
    .sort((a, b) => b.score - a.score || String(a.curso.nome).localeCompare(String(b.curso.nome), "pt-BR"))
    .map(x => x.curso)
    .slice(0, limite);
}

function ehPedidoCatalogo(texto = "") {
  const t = norm(texto);
  return /^(opcoes|as opcoes|quais opcoes|mostra as opcoes|me mostra as opcoes|mostre as opcoes|mostra os cursos|me mostra os cursos|quais cursos|lista os cursos|listar cursos|catalogo|ver catalogo|quero ver os cursos)$/.test(t)
    || /\b(mostra|mostrar|mostre|ver|quais|lista|listar)\b.*\b(opcoes|cursos|catalogo)\b/.test(t)
    || /\b(o que|oque) (voces|voce) (tem|oferece)\b/.test(t);
}

function ehPedidoMatricula(texto = "") {
  const t = norm(texto);
  return /\b(matricula|matricular|matricular me|me matricular|inscricao|inscrever|me inscrever|fazer minha matricula|quero matricula)\b/.test(t);
}

function emFluxoObrigatorio(sessao = {}) {
  const e = String(sessao.etapa || "");
  return e.startsWith("shekinah_matricula_") || e.startsWith("unifatecie_matricula_") || e.startsWith("financeiro_") || e.startsWith("shekinah_secretaria_") || e === "atendimento_humano";
}

function parecePedidoPorObjetivo(texto = "") {
  const t = norm(texto);
  if (detectarConceitos(t).length) return true;
  return /\b(curso|cursos|aprender|trabalhar|mexer|fazer|criar|desenvolver|programar|editar|consertar|montar)\b/.test(t)
    && /\b(pra|para|quero|queria|gostaria|aprender|trabalhar|criar|desenvolver|programar|editar|consertar|montar)\b/.test(t);
}

function respostaRecomendacoes(cursos = [], texto = "") {
  if (!cursos.length) return null;
  if (cursos.length === 1) {
    return `✅ Sim. O curso que mais combina com o que você procura é *${cursos[0].nome}*.\n\nSe quiser, eu mostro os detalhes, conteúdo e quantidade de aulas. 📚`;
  }
  const linhas = cursos.map((c, i) => `${i + 1}. ${c.nome}`).join("\n");
  return `✅ Para o que você quer fazer, estas são as opções EAD mais relacionadas que encontrei na Shekinah:\n\n${linhas}\n\nDiga o nome ou número e eu mostro os detalhes. 📚`;
}

function respostaPareceFalhaDeBusca(resposta = "") {
  const r = norm(resposta);
  return /nao encontrei|nao achei|nao localizei|nao ha curso correspondente|procurei .* catalogo/.test(r);
}

module.exports = {
  norm,
  recomendar,
  ehPedidoCatalogo,
  ehPedidoMatricula,
  emFluxoObrigatorio,
  parecePedidoPorObjetivo,
  respostaRecomendacoes,
  respostaPareceFalhaDeBusca
};