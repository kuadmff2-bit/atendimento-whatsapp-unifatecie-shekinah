function norm(s = "") {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

const STOP = new Set((
  "tem tenho ter curso cursos de da do das dos um uma uns umas o a os as e ou pra para por com sobre " +
  "eu me meu minha quero queria gostaria preciso saber ver conhecer mostra mostrar mostre fala falar diz dizer " +
  "opcao opcoes lista listar catalogo informacao informacoes detalhe detalhes disponivel disponiveis oferta ofertas " +
  "qual quais que ead online shekinah voces voce oferece oferecem algum alguma algo area nessa nesta isso ai " +
  "outra outras outro outros mais tambem"
).split(" "));

const C = (nome, rotulo, gatilhos, categorias = [], termos = [], prioridades = []) => ({
  nome, rotulo, gatilhos, categorias, termos, prioridades
});

const CONCEITOS = [
  C("apoio_educacional", "Educação e apoio escolar",
    ["apoio","curso de apoio","cursos de apoio","apoio escolar","apoio pedagogico","reforco","reforco escolar","pedagogico","educacao","ensino","aprendizagem","creche","auxiliar de classe"],
    ["educacao","preparatorio"], ["supervisao pedagogica","auxiliar de creche","educacao especial","reforco escolar","auxiliar de classe"],
    ["Supervisão Pedagógica","Auxiliar de Creche","Educação Especial","Reforço Escolar"]),

  C("idiomas", "Idiomas",
    ["idioma","idiomas","lingua","linguas","lingua estrangeira","ingles","espanhol","frances","italiano","alemao","libras"],
    ["idioma","idiomas"], ["ingles","espanhol","frances","italiano","alemao","libras","portugues"]),

  C("informatica", "Informática e tecnologia",
    ["informatica","tecnologia","computador","computadores","pc","windows","office","digitacao","word","excel","powerpoint","power point"],
    ["informatica","tecnologia"], ["informatica","windows","word","excel","power point","access","digitacao","linux","office"],
    ["Introdução à Informática","Windows 11","Microsoft Word","Excel Básico e Avançado","Power Point","Digitação Interativa"]),

  C("programacao", "Programação e desenvolvimento",
    ["programacao","programar","codigo","codar","desenvolvedor","desenvolvimento de software","software","frontend","backend","full stack"],
    ["informatica","tecnologia"], ["logica de programacao","javascript","php","html","css","python","java","programacao","app android","wordpress"],
    ["Lógica de Programação","JavaScript","PHP: Do Básico ao Avançado","HTML e CSS","Criação de App Android e iOS","Criação de Game Profissional"]),

  C("sites", "Sites e web",
    ["site","sites","website","pagina web","web","criar site","desenvolver site","loja virtual","ecommerce","wordpress"],
    ["informatica","tecnologia"], ["html","css","javascript","php","wordpress","site","loja virtual","web"],
    ["HTML e CSS","JavaScript","PHP: Do Básico ao Avançado","Programação de sites Wordpress","WordPress V2","Criação de Loja Virtual"]),

  C("apps", "Aplicativos",
    ["aplicativo","aplicativos","app","apps","android","ios","criar aplicativo","desenvolver aplicativo"],
    ["informatica","tecnologia"], ["app","android","ios","programacao","javascript"],
    ["Criação de App Android e iOS","Lógica de Programação","JavaScript"]),

  C("jogos", "Jogos e games",
    ["jogo","jogos","game","games","gamedev","desenvolver jogos","criar jogos","fazer jogos","programar jogos"],
    ["informatica","tecnologia"], ["game","jogo","blender","3d","logica de programacao","javascript"],
    ["Criação de Game Profissional","Lógica de Programação","Blender 3D","3D Studio Max Básico","JavaScript"]),

  C("design", "Design e criação",
    ["design","arte digital","imagem","imagens","logo","logos","editar foto","foto","fotos","criacao grafica"],
    ["design","informatica","tecnologia"], ["canva","photoshop","illustrator","corel","indesign","design","arte"],
    ["Canva","PhotoShop CC","Illustrator 2022","Corel Draw X8","InDesign"]),

  C("video", "Vídeo e conteúdo digital",
    ["video","videos","editar video","edicao de video","motion","efeitos visuais","premiere","after effects","youtube","podcast"],
    ["informatica","tecnologia"], ["premiere","after effects","video","youtuber","podcast"],
    ["Edição de Vídeo Premiere","After Effects","Como ser um Youtuber","Operador de Podcast"]),

  C("tres_d", "3D, desenho técnico e projetos",
    ["3d","modelagem 3d","modelar","render","animacao 3d","autocad","sketchup"],
    ["informatica","tecnologia"], ["blender","3d studio","sketchup","autocad","3d"],
    ["Blender 3D","3D Studio Max Básico","SketchUp","AutoCad 2D e 3D"]),

  C("administrativo", "Administrativo e escritório",
    ["administrativo","administracao","escritorio","secretaria","secretariado","recepcao","recepcionista","auxiliar administrativo","assistente administrativo"],
    ["administrativo","administracao"], ["administracao","administrativo","secretariado","recepcionista","recepcao","almoxarifado","arquivologia"]),

  C("rh", "Recursos Humanos e departamento pessoal",
    ["rh","recursos humanos","departamento pessoal","folha de pagamento","recrutamento","selecao","lideranca"],
    ["administrativo","administracao"], ["recursos humanos","departamento pessoal","folha","recrutamento","lideranca","gestao de pessoas"]),

  C("financeiro", "Financeiro e finanças",
    ["financeiro","financas","gestao financeira","contas a pagar","contas a receber","fluxo de caixa","contabilidade"],
    ["administrativo","administracao"], ["financeira","financeiro","financas","contabilidade","contabil","credito","cobranca"]),

  C("comercio_vendas", "Comércio, vendas e atendimento",
    ["comercio","vendas","vendedor","atendimento ao cliente","atendente","operador de caixa","caixa","telemarketing","loja","cliente","comercial"],
    ["administrativo","administracao"], ["vendas","operador de caixa","atendente","telemarketing","comercial","marketing pessoal","farmacia","secretariado"]),

  C("marketing", "Marketing e vendas online",
    ["marketing","marketing digital","vendas online","anuncio","anuncios","trafego","dropshipping","whatsapp business","vender pela internet","midias sociais","redes sociais","instagram"],
    ["administrativo","informatica","tecnologia"], ["marketing","adwords","dropshipping","whatsapp business","loja virtual","canva","instagram","midias sociais"]),

  C("preparatorios", "Preparatórios e estudos",
    ["preparatorio","preparatorios","concurso","concursos","enem","vestibular","matematica","portugues","redacao","historia","geografia"],
    ["preparatorio"], ["matematica","portugues","redacao","historia","geografia","preparatorio","concurso","enem"]),

  C("saude", "Saúde e cuidados",
    ["saude","cuidador","idoso","cuidador de idoso","farmacia","atendente de farmacia","agente de saude","primeiros socorros","enfermagem","radiologia","hospital"],
    ["saude"], ["cuidador","idoso","farmacia","saude","primeiros socorros","radiologia","hospital","agente comunitario"]),

  C("beleza", "Beleza e estética",
    ["beleza","estetica","manicure","pedicure","maquiagem","cabelo","cabeleireiro","barbeiro","barbearia","sobrancelha","unha","unhas"],
    ["beleza","estetica"], ["manicure","pedicure","maquiagem","cabeleireiro","barbeiro","sobrancelha","estetica","beleza","unha"]),

  C("culinaria", "Culinária e alimentos",
    ["culinaria","gastronomia","confeitaria","doces","salgados","panificacao","padeiro","bolo","bolos","pizzaiolo","barista","alimentos","cozinheiro","cozinha"],
    ["culinaria","gastronomia"], ["culinaria","gastronomia","confeitaria","bolo","salgado","panificacao","padeiro","pizzaiolo","barista","cozinheiro"]),

  C("eletrica", "Elétrica e manutenção",
    ["eletrica","eletricista","eletricidade","instalacao eletrica","refrigeracao","ar condicionado"],
    ["eletrica"], ["eletricista","eletrica","eletricidade","refrigeracao","ar condicionado"]),

  C("manutencao", "Manutenção de equipamentos",
    ["consertar celular","arrumar celular","manutencao celular","tecnico de celular","consertar computador","manutencao pc","montar pc","hardware"],
    ["informatica","tecnologia"], ["manutencao de celular","montagem e manutencao","hardware","manutencao"]),

  C("logistica", "Logística, estoque e transporte",
    ["logistica","estoque","almoxarifado","transporte","armazem","armazenagem","expedicao","compras"],
    ["logistica","administrativo"], ["logistica","estoque","almoxarifado","transporte","armazenagem","expedicao","compras"]),

  C("seguranca_trabalho", "Segurança e trabalho",
    ["seguranca do trabalho","epi","prevencao de acidentes","nr10","nr 10","nr35","nr 35","brigadista","bombeiro civil"],
    ["seguranca"], ["seguranca do trabalho","nr10","nr35","brigadista","bombeiro"]),

  C("seguranca_digital", "Segurança digital",
    ["seguranca digital","seguranca na internet","internet segura","cyber","ciberseguranca","hacker","hacking"],
    ["informatica","tecnologia"], ["seguranca na internet","linux","seguranca digital","cyber"]),

  C("comunicacao", "Comunicação e expressão",
    ["comunicacao","oratoria","falar em publico","jornalismo","escrita","redacao profissional"],
    ["comunicacao"], ["oratoria","jornalismo","comunicacao","redacao","apresentacao"]),

  C("empreendedorismo", "Empreendedorismo e negócios",
    ["empreendedorismo","empreender","negocio","negocios","empresa","abrir empresa","trabalhar por conta","autonomo","mei"],
    ["administrativo","administracao"], ["empreendedor","negocio","administracao","marketing","vendas","gestao"])
];

function tokens(texto) {
  return norm(texto).split(" ").filter(p => p.length > 2 && !STOP.has(p));
}

function dice(a, b) {
  a = norm(a).replace(/\s/g, ""); b = norm(b).replace(/\s/g, "");
  if (!a || !b) return 0; if (a === b) return 1; if (a.length < 2 || b.length < 2) return 0;
  const m = new Map();
  for (let i = 0; i < a.length - 1; i++) { const p = a.slice(i, i + 2); m.set(p, (m.get(p) || 0) + 1); }
  let inter = 0;
  for (let i = 0; i < b.length - 1; i++) { const p = b.slice(i, i + 2), n = m.get(p) || 0; if (n) { inter++; m.set(p, n - 1); } }
  return (2 * inter) / ((a.length - 1) + (b.length - 1));
}

function fraseContem(texto, termo) { return ` ${norm(texto)} `.includes(` ${norm(termo)} `); }
function detectarConceitos(texto = "") {
  const t = norm(texto);
  return t ? CONCEITOS.filter(c => c.gatilhos.some(g => fraseContem(t, g))) : [];
}

function baseCurso(c = {}) { return norm([c.nome, c.categoriaInterna, c.categoriaLoja, c.descricao].filter(Boolean).join(" ")); }

function scoreConceito(c, curso) {
  const nome = norm(curso?.nome), categoria = norm(`${curso?.categoriaInterna || ""} ${curso?.categoriaLoja || ""}`), descricao = norm(curso?.descricao || "");
  let score = 0;
  for (const cat of c.categorias || []) if (cat && categoria.includes(norm(cat))) score += 300;
  for (const termo of c.termos || []) {
    const q = norm(termo); if (!q) continue;
    if (nome === q) score += 420; else if (nome.includes(q)) score += 250; else if (categoria.includes(q)) score += 130; else if (descricao.includes(q)) score += 45;
  }
  return score;
}

function mapaPrioridades(conceitos, cursos) {
  const disponiveis = new Set(cursos.map(c => norm(c?.nome)).filter(Boolean)), ranks = new Map();
  conceitos.forEach((c, bloco) => (c.prioridades || []).forEach((nome, i) => {
    const k = norm(nome); if (!disponiveis.has(k)) return;
    const rank = bloco * 100 + i; if (!ranks.has(k) || rank < ranks.get(k)) ranks.set(k, rank);
  }));
  return ranks;
}

function recomendar(cursos = [], texto = "", limite = 12) {
  if (!Array.isArray(cursos) || !cursos.length) return [];
  const conceitos = detectarConceitos(texto), qTokens = tokens(texto), ranks = mapaPrioridades(conceitos, cursos), arr = [];
  for (const curso of cursos) {
    if (!curso?.nome) continue;
    const k = norm(curso.nome), base = baseCurso(curso), bt = base.split(" ").filter(Boolean);
    let score = conceitos.reduce((s, c) => s + scoreConceito(c, curso), 0);
    for (const q of qTokens) {
      if (bt.includes(q)) score += 90; else if (base.includes(q)) score += 55; else {
        const melhor = Math.max(0, ...bt.map(x => dice(q, x))); if (melhor >= .84) score += 42; else if (melhor >= .74) score += 24;
      }
    }
    const rank = ranks.has(k) ? ranks.get(k) : Infinity;
    if (score > 0 || Number.isFinite(rank)) arr.push({ curso, score, rank });
  }
  return arr.sort((a, b) => {
    const ap = Number.isFinite(a.rank), bp = Number.isFinite(b.rank);
    if (ap && bp && a.rank !== b.rank) return a.rank - b.rank;
    if (ap !== bp) return ap ? -1 : 1;
    return b.score - a.score || String(a.curso.nome).localeCompare(String(b.curso.nome), "pt-BR");
  }).map(x => x.curso).slice(0, Math.max(1, Number(limite) || 12));
}

function ehPedidoCatalogo(texto = "") {
  const t = norm(texto); if (!t) return false;
  if (/\b(curso|cursos|opcao|opcoes|catalogo|lista)\b/.test(t) && tokens(t).length === 0) return true;
  return /^(opcoes|as opcoes|cursos|os cursos|catalogo|lista de cursos)$/.test(t)
    || /\b(mostra|mostrar|mostre|ver|quais|lista|listar|saber|conhecer|fala|falar|informacao|informacoes)\b.*\b(opcoes|cursos|catalogo|lista)\b/.test(t)
    || /\b(que|quais) cursos? (voces|voce)? ?(tem|oferece|oferecem)?\b/.test(t)
    || /\b(o que|oque) (voces|voce) (tem|oferece)\b/.test(t);
}

function ehPedidoMatricula(texto = "") { return /\b(matricula|matricular|me matricular|inscricao|inscrever|me inscrever|fazer minha matricula|quero matricula)\b/.test(norm(texto)); }
function emFluxoObrigatorio(sessao = {}) {
  const e = String(sessao.etapa || "");
  return e.startsWith("shekinah_matricula_") || e.startsWith("unifatecie_matricula_") || e.startsWith("financeiro_") || e.startsWith("shekinah_secretaria_") || e === "atendimento_humano";
}

function intencaoOperacionalNaoCurso(t) {
  if (/\b(encerrar|encerrado|finalizar atendimento|fim do atendimento|parar atendimento|sair do atendimento)\b/.test(t)) return true;
  const suporte = /\b(problema|erro|falha|travou|portal|alunonet|senha|ra|boleto|pagamento|mensalidade|financeiro|cancelamento|trancamento|requerimento|atendente|secretario|humano)\b/.test(t);
  const curso = /\b(curso|cursos|aprender|estudar|formacao|capacitar|qualificacao)\b/.test(t);
  return suporte && !curso;
}

function parecePedidoPorObjetivo(texto = "") {
  const t = norm(texto); if (!t || ehPedidoCatalogo(t) || intencaoOperacionalNaoCurso(t)) return false;
  if (detectarConceitos(t).length) return true;
  if (!tokens(t).length) return false;
  return /\b(curso|cursos|aprender|trabalhar|mexer|fazer|criar|desenvolver|programar|editar|consertar|montar|apoio|reforco|area|ramo|setor)\b/.test(t)
    && /\b(pra|para|quero|queria|gostaria|aprender|trabalhar|criar|desenvolver|programar|editar|consertar|montar|apoio|reforco|area|ramo|setor)\b/.test(t);
}

function rotuloDoPedido(texto = "") {
  const cs = detectarConceitos(texto); return cs.length === 1 ? cs[0].rotulo : cs.length > 1 ? cs.slice(0, 3).map(c => c.rotulo).join(" / ") : "o que você procura";
}
function respostaRecomendacoes(cursos = [], texto = "") {
  if (!cursos.length) return null; const rotulo = rotuloDoPedido(texto);
  if (cursos.length === 1) return `✅ Na área de *${rotulo}*, encontrei este curso EAD da Shekinah:\n\n1. *${cursos[0].nome}*\n\nSe quiser, eu mostro os detalhes, conteúdo, quantidade de aulas e valor. 📚`;
  return `✅ Na área de *${rotulo}*, encontrei estas opções EAD da Shekinah:\n\n${cursos.map((c, i) => `${i + 1}. ${c.nome}`).join("\n")}\n\nDiga o nome ou número e eu mostro os detalhes. 📚`;
}
function respostaPareceFalhaDeBusca(resposta = "") { return /nao encontrei|nao achei|nao localizei|nao ha curso correspondente|procurei .* catalogo/.test(norm(resposta)); }

function selfTest() {
  const assert = require("assert");
  const catalogo = [
    { nome: "Inglês", categoriaLoja: "IDIOMAS" }, { nome: "Espanhol", categoriaLoja: "IDIOMAS" },
    { nome: "Supervisão Pedagógica" }, { nome: "Auxiliar de Creche" },
    { nome: "Operador de Caixa", categoriaLoja: "ADMINISTRATIVO" }, { nome: "Excel Básico e Avançado", categoriaLoja: "INFORMÁTICA E TECNOLOGIA" },
    { nome: "Cuidador de Idoso", categoriaLoja: "DIVERSAS ÁREAS" }, { nome: "Criação de Game Profissional" }, { nome: "Lógica de Programação" }, { nome: "Blender 3D" }
  ];
  assert.equal(detectarConceitos("Idiomas")[0]?.nome, "idiomas");
  assert.equal(parecePedidoPorObjetivo("Idiomas"), true);
  assert.equal(parecePedidoPorObjetivo("encerrar atendimento"), false);
  assert.equal(parecePedidoPorObjetivo("estou com um problema no meu portal"), false);
  assert.deepEqual(recomendar(catalogo, "Idiomas", 10).map(c => c.nome), ["Espanhol", "Inglês"]);
  assert.equal(recomendar(catalogo, "quero um curso de apoio", 4)[0]?.nome, "Supervisão Pedagógica");
  assert.equal(recomendar(catalogo, "quero desenvolver jogos", 4)[0]?.nome, "Criação de Game Profissional");
  console.log("✅ Self-test de inteligência EAD por áreas aprovado.");
}
if (process.argv.includes("--self-test")) selfTest();

module.exports = { norm, tokens, detectarConceitos, recomendar, ehPedidoCatalogo, ehPedidoMatricula, emFluxoObrigatorio, parecePedidoPorObjetivo, respostaRecomendacoes, respostaPareceFalhaDeBusca, rotuloDoPedido };
