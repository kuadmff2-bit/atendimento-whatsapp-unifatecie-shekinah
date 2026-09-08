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
  "tem","tenho","ter","curso","cursos","de","da","do","das","dos","um","uma","uns","umas","o","a","os","as","e","ou","pra","para","por","com","sobre",
  "eu","me","meu","minha","quero","queria","gostaria","preciso","saber","ver","conhecer","mostra","mostrar","mostre","mostreme","fala","falar","diz","dizer",
  "opcao","opcoes","lista","listar","catalogo","informacao","informacoes","detalhe","detalhes","disponivel","disponiveis","oferta","ofertas",
  "qual","quais","que","ead","online","shekinah","voces","voce","oferece","oferecem","algum","alguma","algo","area","nessa","nesta","isso","issoai","ai",
  "outra","outras","outro","outros","mais","tambem","tambem"
]);

// Cada conceito tem gatilhos de linguagem natural e também sinais que podem existir
// no nome/categoria/descrição REAL do catálogo. Assim o Light não precisa adivinhar
// nomes de cursos: ele só recomenda cursos que realmente vieram da plataforma.
const CONCEITOS = [
  {
    nome: "idiomas",
    rotulo: "Idiomas",
    gatilhos: ["idioma","idiomas","lingua","linguas","lingua estrangeira","linguas estrangeiras","ingles","espanhol","frances","italiano","alemao","portugues para estrangeiros"],
    categorias: ["idioma","idiomas"],
    termosCurso: ["ingles","espanhol","frances","italiano","alemao","libras","idioma","portugues"]
  },
  {
    nome: "informatica",
    rotulo: "Informática e tecnologia",
    gatilhos: ["informatica","tecnologia","computador","computadores","pc","windows","office","digitar","digitacao","word","excel","power point","powerpoint"],
    categorias: ["informatica","tecnologia","informatica e tecnologia"],
    termosCurso: ["informatica","windows","word","excel","power point","powerpoint","access","digitacao","linux","office"]
  },
  {
    nome: "programacao",
    rotulo: "Programação e desenvolvimento",
    gatilhos: ["programacao","programar","codigo","codar","desenvolvedor","desenvolvimento de software","software","dev","frontend","backend","full stack"],
    categorias: ["informatica","tecnologia","informatica e tecnologia"],
    termosCurso: ["logica de programacao","javascript","php","html","css","python","java","programacao","app android","android e ios","wordpress"]
  },
  {
    nome: "sites",
    rotulo: "Sites e web",
    gatilhos: ["site","sites","website","pagina web","web","criar site","desenvolver site","loja virtual","ecommerce","e commerce","wordpress"],
    categorias: ["informatica","tecnologia","informatica e tecnologia"],
    termosCurso: ["html","css","javascript","php","wordpress","site","loja virtual","web"]
  },
  {
    nome: "apps",
    rotulo: "Aplicativos",
    gatilhos: ["aplicativo","aplicativos","app","apps","android","ios","criar aplicativo","desenvolver aplicativo"],
    categorias: ["informatica","tecnologia","informatica e tecnologia"],
    termosCurso: ["app","android","ios","programacao","javascript"]
  },
  {
    nome: "jogos",
    rotulo: "Jogos e games",
    gatilhos: ["jogo","jogos","game","games","gamedev","desenvolver jogos","criar jogos","fazer jogos","programar jogos"],
    categorias: ["informatica","tecnologia","informatica e tecnologia"],
    termosCurso: ["game","jogo","blender","3d","logica de programacao","javascript"]
  },
  {
    nome: "design",
    rotulo: "Design e criação",
    gatilhos: ["design","arte digital","imagem","imagens","logo","logos","editar foto","foto","fotos","criacao grafica","artes graficas"],
    categorias: ["informatica","tecnologia","design","diversas areas"],
    termosCurso: ["canva","photoshop","illustrator","corel","indesign","design","arte"]
  },
  {
    nome: "video",
    rotulo: "Vídeo e conteúdo digital",
    gatilhos: ["video","videos","editar video","edicao de video","motion","efeitos visuais","premiere","after effects"],
    categorias: ["informatica","tecnologia","diversas areas"],
    termosCurso: ["premiere","after effects","video","youtuber","podcast"]
  },
  {
    nome: "3d",
    rotulo: "3D, desenho técnico e projetos",
    gatilhos: ["3d","modelagem 3d","modelar","render","animacao 3d","autocad","sketchup"],
    categorias: ["informatica","tecnologia","diversas areas"],
    termosCurso: ["blender","3d studio","sketchup","autocad","3d"]
  },
  {
    nome: "administrativo",
    rotulo: "Administrativo e escritório",
    gatilhos: ["administrativo","administracao","escritorio","secretaria","secretariado","recepcao","recepcionista","auxiliar administrativo","assistente administrativo"],
    categorias: ["administrativo","administracao"],
    termosCurso: ["administracao","administrativo","secretariado","recepcionista","recepcao","almoxarifado","arquivologia"]
  },
  {
    nome: "rh",
    rotulo: "Recursos Humanos e departamento pessoal",
    gatilhos: ["rh","recursos humanos","departamento pessoal","dp","folha de pagamento","recrutamento","selecao","lideranca"],
    categorias: ["administrativo","administracao"],
    termosCurso: ["recursos humanos","departamento pessoal","folha","recrutamento","lideranca","gestao de pessoas"]
  },
  {
    nome: "financeiro",
    rotulo: "Financeiro e finanças",
    gatilhos: ["financeiro","financas","gestao financeira","dinheiro","caixa","contas a pagar","contas a receber","fluxo de caixa","contabilidade"],
    categorias: ["administrativo","administracao"],
    termosCurso: ["financeira","financeiro","financas","caixa","contabilidade","contabil","credito","cobranca"]
  },
  {
    nome: "comercio_vendas",
    rotulo: "Comércio, vendas e atendimento",
    gatilhos: ["comercio","vendas","vendedor","atendimento","atendente","operador de caixa","caixa","telemarketing","loja","cliente","comercial"],
    categorias: ["administrativo","administracao","diversas areas"],
    termosCurso: ["vendas","operador de caixa","atendente","telemarketing","comercial","marketing pessoal","farmacia","secretariado"]
  },
  {
    nome: "marketing",
    rotulo: "Marketing e vendas online",
    gatilhos: ["marketing","marketing digital","vendas online","anuncio","anuncios","trafego","dropshipping","whatsapp business","vender pela internet","midias sociais","redes sociais","instagram"],
    categorias: ["administrativo","informatica","tecnologia","diversas areas"],
    termosCurso: ["marketing","adwords","dropshipping","whatsapp business","loja virtual","canva","instagram","midias sociais"]
  },
  {
    nome: "educacao",
    rotulo: "Educação e apoio escolar",
    gatilhos: ["apoio","curso de apoio","cursos de apoio","apoio escolar","apoio pedagogico","reforco","reforco escolar","pedagogico","educacao","ensino","aprendizagem","creche","auxiliar de classe","professor","escola"],
    categorias: ["diversas areas","educacao","preparatorio","preparatorios"],
    termosCurso: ["pedagog","creche","educacao","reforco","auxiliar de classe","supervisao","escolar","professor"]
  },
  {
    nome: "preparatorios",
    rotulo: "Preparatórios e estudos",
    gatilhos: ["preparatorio","preparatorios","concurso","concursos","enem","vestibular","prova","matematica","portugues","redacao","historia","geografia"],
    categorias: ["preparatorio","preparatorios"],
    termosCurso: ["matematica","portugues","redacao","historia","geografia","preparatorio","concurso","enem"]
  },
  {
    nome: "saude",
    rotulo: "Saúde e cuidados",
    gatilhos: ["saude","cuidador","idoso","cuidador de idoso","farmacia","atendente de farmacia","agente de saude","primeiros socorros","enfermagem","radiologia","hospital"],
    categorias: ["diversas areas","saude"],
    termosCurso: ["cuidador","idoso","farmacia","saude","primeiros socorros","radiologia","hospital","agente comunitario"]
  },
  {
    nome: "beleza",
    rotulo: "Beleza e estética",
    gatilhos: ["beleza","estetica","manicure","pedicure","maquiagem","cabelo","cabeleireiro","barbeiro","barbearia","sobrancelha","unha","unhas"],
    categorias: ["diversas areas","beleza","estetica"],
    termosCurso: ["manicure","pedicure","maquiagem","cabeleireiro","barbeiro","sobrancelha","estetica","beleza","unha"]
  },
  {
    nome: "culinaria",
    rotulo: "Culinária e alimentos",
    gatilhos: ["culinaria","culinario","gastronomia","confeitaria","doces","salgados","panificacao","padeiro","bolo","bolos","pizzaiolo","barista","alimentos","cozinheiro","cozinha"],
    categorias: ["diversas areas","culinaria","gastronomia"],
    termosCurso: ["culinaria","gastronomia","confeitaria","bolo","salgado","panificacao","padeiro","pizzaiolo","barista","cozinheiro"]
  },
  {
    nome: "eletrica",
    rotulo: "Elétrica e manutenção",
    gatilhos: ["eletrica","eletricista","eletricidade","instalacao eletrica","manutencao eletrica","refrigeracao","ar condicionado"],
    categorias: ["diversas areas"],
    termosCurso: ["eletricista","eletrica","eletricidade","refrigeracao","ar condicionado"]
  },
  {
    nome: "manutencao",
    rotulo: "Manutenção de equipamentos",
    gatilhos: ["consertar celular","arrumar celular","manutencao celular","tecnico de celular","consertar computador","manutencao pc","montar pc","manutencao de computador","hardware"],
    categorias: ["informatica","tecnologia","diversas areas"],
    termosCurso: ["manutencao de celular","montagem e manutencao","hardware","manutencao"]
  },
  {
    nome: "logistica",
    rotulo: "Logística, estoque e transporte",
    gatilhos: ["logistica","estoque","almoxarifado","transporte","armazem","armazenagem","expedicao","compras"],
    categorias: ["administrativo","diversas areas"],
    termosCurso: ["logistica","estoque","almoxarifado","transporte","armazenagem","expedicao","compras"]
  },
  {
    nome: "seguranca_trabalho",
    rotulo: "Segurança e trabalho",
    gatilhos: ["seguranca do trabalho","epi","prevencao de acidentes","nr10","nr 10","nr35","nr 35","brigadista","bombeiro civil"],
    categorias: ["diversas areas","seguranca"],
    termosCurso: ["seguranca do trabalho","nr10","nr 10","nr35","nr 35","brigadista","bombeiro"]
  },
  {
    nome: "seguranca_digital",
    rotulo: "Segurança digital",
    gatilhos: ["seguranca digital","seguranca na internet","internet segura","cyber","ciberseguranca","hacker","hacking"],
    categorias: ["informatica","tecnologia","informatica e tecnologia"],
    termosCurso: ["seguranca na internet","linux","seguranca digital","cyber"]
  },
  {
    nome: "comunicacao",
    rotulo: "Comunicação e expressão",
    gatilhos: ["comunicacao","oratoria","falar em publico","jornalismo","escrita","redacao profissional","apresentacao"],
    categorias: ["diversas areas","administrativo"],
    termosCurso: ["oratoria","jornalismo","comunicacao","redacao","apresentacao"]
  },
  {
    nome: "criador",
    rotulo: "Criação de conteúdo",
    gatilhos: ["youtuber","youtube","podcast","criador de conteudo","conteudo digital","influenciador"],
    categorias: ["informatica","tecnologia","diversas areas"],
    termosCurso: ["youtuber","podcast","video","canva","marketing"]
  },
  {
    nome: "empreendedorismo",
    rotulo: "Empreendedorismo e negócios",
    gatilhos: ["empreendedorismo","empreender","negocio","negocios","empresa","abrir empresa","trabalhar por conta","autonomo","mei"],
    categorias: ["administrativo","diversas areas"],
    termosCurso: ["empreendedor","negocio","administracao","marketing","vendas","gestao"]
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

function textoCurso(curso = {}) {
  return norm([
    curso?.nome,
    curso?.categoriaInterna,
    curso?.categoriaLoja,
    curso?.descricao,
  ].filter(Boolean).join(" "));
}

function conceitoPontuaCurso(conceito, curso) {
  const nome = norm(curso?.nome);
  const categoria = norm(`${curso?.categoriaInterna || ""} ${curso?.categoriaLoja || ""}`);
  const descricao = norm(curso?.descricao || "");
  let score = 0;

  for (const cat of conceito.categorias || []) {
    const c = norm(cat);
    if (c && categoria.includes(c)) score += 320;
  }
  for (const termo of conceito.termosCurso || []) {
    const q = norm(termo);
    if (!q) continue;
    if (nome === q) score += 360;
    else if (nome.includes(q)) score += 240;
    else if (categoria.includes(q)) score += 150;
    else if (descricao.includes(q)) score += 55;
  }
  return score;
}

function recomendar(cursos = [], texto = "", limite = 12) {
  const mapa = porNome(cursos);
  const selecionados = new Map();
  const conceitos = detectarConceitos(texto);

  // Nomes prioritários quando existirem exatamente no catálogo.
  for (const conceito of conceitos) {
    for (const nome of conceito.prioridades || []) {
      const curso = mapa.get(norm(nome));
      if (curso) selecionados.set(norm(curso.nome), { curso, score: 1000 });
    }
  }

  // Entendimento por área/categoria real da plataforma.
  for (const curso of cursos) {
    const chave = norm(curso?.nome);
    if (!chave) continue;
    let score = selecionados.get(chave)?.score || 0;
    for (const conceito of conceitos) score += conceitoPontuaCurso(conceito, curso);
    if (score > 0) selecionados.set(chave, { curso, score });
  }

  // Similaridade lexical para pedidos livres, erros de digitação e nomes incompletos.
  const qTokens = tokens(texto);
  for (const curso of cursos) {
    const chave = norm(curso?.nome);
    if (!chave) continue;
    const base = textoCurso(curso);
    const baseTokens = base.split(" ").filter(Boolean);
    let score = selecionados.get(chave)?.score || 0;
    for (const q of qTokens) {
      if (baseTokens.includes(q)) score += 90;
      else if (base.includes(q)) score += 55;
      else {
        const melhor = Math.max(0, ...baseTokens.map(nt => dice(q, nt)));
        if (melhor >= 0.84) score += 42;
        else if (melhor >= 0.74) score += 24;
      }
    }
    if (score > 0) selecionados.set(chave, { curso, score });
  }

  return [...selecionados.values()]
    .sort((a, b) => b.score - a.score || String(a.curso.nome).localeCompare(String(b.curso.nome), "pt-BR"))
    .map(x => x.curso)
    .slice(0, limite);
}

function mencionaCatalogoOuCursos(t) {
  return /\b(curso|cursos|opcao|opcoes|catalogo|lista)\b/.test(t);
}

function ehPedidoCatalogo(texto = "") {
  const t = norm(texto);
  if (!t) return false;
  if (mencionaCatalogoOuCursos(t) && tokens(t).length === 0) return true;
  return /^(opcoes|as opcoes|cursos|os cursos|catalogo|lista de cursos)$/.test(t)
    || /\b(mostra|mostrar|mostre|ver|quais|lista|listar|saber|conhecer|fala|falar|informacao|informacoes)\b.*\b(opcoes|cursos|catalogo|lista)\b/.test(t)
    || /\b(que|quais) cursos? (voces|voce)? ?(tem|oferece|oferecem)?\b/.test(t)
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
  if (ehPedidoCatalogo(t)) return false;
  if (detectarConceitos(t).length) return true;
  if (!tokens(t).length) return false;
  return /\b(curso|cursos|aprender|trabalhar|mexer|fazer|criar|desenvolver|programar|editar|consertar|montar|apoio|reforco|area|ramo|setor)\b/.test(t)
    && /\b(pra|para|quero|queria|gostaria|aprender|trabalhar|criar|desenvolver|programar|editar|consertar|montar|apoio|reforco|area|ramo|setor)\b/.test(t);
}

function rotuloDoPedido(texto = "") {
  const conceitos = detectarConceitos(texto);
  return conceitos.length === 1 ? conceitos[0].rotulo : "o que você procura";
}

function respostaRecomendacoes(cursos = [], texto = "") {
  if (!cursos.length) return null;
  const rotulo = rotuloDoPedido(texto);
  if (cursos.length === 1) {
    return `✅ Na área de *${rotulo}*, encontrei este curso EAD da Shekinah:\n\n1. *${cursos[0].nome}*\n\nSe quiser, eu mostro os detalhes, conteúdo, quantidade de aulas e valor. 📚`;
  }
  const linhas = cursos.map((c, i) => `${i + 1}. ${c.nome}`).join("\n");
  return `✅ Na área de *${rotulo}*, encontrei estas opções EAD da Shekinah:\n\n${linhas}\n\nDiga o nome ou número e eu mostro os detalhes. 📚`;
}

function respostaPareceFalhaDeBusca(resposta = "") {
  const r = norm(resposta);
  return /nao encontrei|nao achei|nao localizei|nao ha curso correspondente|procurei .* catalogo/.test(r);
}

function selfTest() {
  const assert = require("assert");
  const catalogo = [
    { nome: "Inglês", categoriaLoja: "IDIOMAS" },
    { nome: "Espanhol", categoriaLoja: "IDIOMAS" },
    { nome: "Operador de Caixa", categoriaLoja: "ADMINISTRATIVO" },
    { nome: "Excel Básico e Avançado", categoriaLoja: "INFORMÁTICA E TECNOLOGIA" },
    { nome: "Cuidador de Idoso", categoriaLoja: "DIVERSAS ÁREAS" },
  ];
  assert.equal(detectarConceitos("Idiomas")[0]?.nome, "idiomas");
  assert.equal(parecePedidoPorObjetivo("Idiomas"), true);
  assert.deepEqual(recomendar(catalogo, "Idiomas", 10).map(c => c.nome), ["Espanhol", "Inglês"]);
  assert.ok(recomendar(catalogo, "quero algo de informática", 10).some(c => c.nome === "Excel Básico e Avançado"));
  assert.ok(recomendar(catalogo, "saúde e cuidados", 10).some(c => c.nome === "Cuidador de Idoso"));
  console.log("✅ Self-test de inteligência EAD por áreas aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  tokens,
  detectarConceitos,
  recomendar,
  ehPedidoCatalogo,
  ehPedidoMatricula,
  emFluxoObrigatorio,
  parecePedidoPorObjetivo,
  respostaRecomendacoes,
  respostaPareceFalhaDeBusca,
  rotuloDoPedido,
};
