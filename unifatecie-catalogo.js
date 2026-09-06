const fs = require("fs");
const path = require("path");

const URL = "https://site.unifatecie.edu.br/cursos-graduacao-ead/";
const CACHE_MS = 12 * 60 * 60 * 1000;
const CACHE_FILE = process.env.UNIFATECIE_CATALOGO_CACHE || "/app/tokens/unifatecie-catalogo.json";

let memoria = { em: 0, cursos: [], fonte: "" };

const FALLBACK = [
  { nome: "Administração", habilitacao: "Bacharelado", duracao: "3 anos", valor: "R$ 112,20/mês" },
  { nome: "Análise e Desenvolvimento de Sistemas", habilitacao: "Tecnólogo", duracao: "2 anos", valor: "R$ 112,20/mês" },
  { nome: "Biblioteconomia", habilitacao: "Bacharelado", duracao: "3 anos", valor: "R$ 112,20/mês" },
  { nome: "Ciências Contábeis", habilitacao: "Bacharelado", duracao: "3 anos", valor: "R$ 112,20/mês" },
  { nome: "Design Gráfico", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Design de Moda", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão da Qualidade", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão Financeira", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão Pública", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão de Recursos Humanos", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Investigação Forense e Perícia Criminal", habilitacao: "Tecnólogo", duracao: "3 anos", valor: "R$ 112,20/mês" },
  { nome: "Logística", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Pedagogia", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Processos Gerenciais", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Sistemas para Internet", habilitacao: "Tecnólogo", duracao: "2 anos", valor: "R$ 112,20/mês" },
  { nome: "Engenharia de Software", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 169,66/mês" },
  { nome: "Ciências Econômicas", habilitacao: "Bacharelado", duracao: "3 anos", valor: "R$ 101,66/mês" },
  { nome: "Arquitetura e Urbanismo", habilitacao: "Bacharelado", duracao: "5 anos", valor: "R$ 271,66/mês" },
  { nome: "Biomedicina", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 292,06/mês" },
  { nome: "Farmácia", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 292,06/mês" },
  { nome: "Fisioterapia", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 292,06/mês" },
  { nome: "Fonoaudiologia", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 292,06/mês" },
  { nome: "Nutrição", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 292,06/mês" },
  { nome: "Terapia Ocupacional", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 292,06/mês" },
  { nome: "Química – Bacharelado", habilitacao: "Bacharelado", duracao: "3,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Publicidade e Propaganda", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Sistemas de Informação", habilitacao: "Bacharelado", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Teologia", habilitacao: "Bacharelado", duracao: "3 anos", valor: "R$ 101,66/mês" },
  { nome: "Artes", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Ciências Biológicas", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Educação Especial", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Educação Física – Licenciatura", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Filosofia", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Geografia", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "História", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Letras – Português/Inglês", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Letras – Português/Libras", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Matemática", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Música", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Sociologia", habilitacao: "Licenciatura", duracao: "4 anos", valor: "R$ 112,20/mês" },
  { nome: "Comércio Exterior", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Design de Interiores", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Design de Produto", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 76,50/mês" },
  { nome: "Estética e Cosmética", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 169,66/mês" },
  { nome: "Hotelaria", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Inteligência Artificial e Machine Learning", habilitacao: "Tecnólogo", duracao: "2 anos", valor: "R$ 112,20/mês" },
  { nome: "Jogos Digitais", habilitacao: "Tecnólogo", duracao: "2 anos", valor: "R$ 76,50/mês" },
  { nome: "Marketing", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Negócios Imobiliários", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Podologia", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 292,06/mês" },
  { nome: "Processos Escolares", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 101,66/mês" },
  { nome: "Segurança do Trabalho", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão Comercial", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão do Agronegócio", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão de Produção Industrial", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Gestão de Segurança Privada", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Secretariado", habilitacao: "Tecnólogo", duracao: "1,5 anos", valor: "R$ 112,20/mês" },
  { nome: "Terapias Integrativas e Complementares", habilitacao: "Tecnólogo", duracao: "2,5 anos", valor: "R$ 169,66/mês" }
];

function norm(s = "") {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(s = "") {
  return String(s)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú");
}

function htmlParaLinhas(html = "") {
  return decodeHtml(String(html))
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(/<(?:br|\/h[1-6]|\/p|\/div|\/li|\/article|\/section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map(x => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function habilitacaoDaLinha(linha = "") {
  const n = norm(linha);
  if (n === "bacharelado") return "Bacharelado";
  if (n === "licenciatura") return "Licenciatura";
  if (n === "tecnologo" || n === "tecnologia") return "Tecnólogo";
  return null;
}

function duracaoDaLinha(linha = "") {
  const m = String(linha).match(/^\s*(\d+(?:[,.]\d+)?)\s*(anos?|meses?)\s*$/i);
  return m ? `${m[1]} ${m[2].toLowerCase()}` : null;
}

function valorDaLinha(linha = "") {
  const m = String(linha).match(/R\$\s*([0-9.]+,[0-9]{2})\s*(?:\/\s*)?m[eê]s/i);
  return m ? `R$ ${m[1]}/mês` : null;
}

function linhaPodeSerNome(linha = "") {
  if (!linha || linha.length < 3 || linha.length > 140) return false;
  const n = norm(linha);
  if (!n) return false;
  if (/^(matricular|fazer matricula|mais informacoes|quero mais informacoes|image|curso|cursos|graduacao ead|modalidade|habilitacao|duracao|de|por apenas)$/.test(n)) return false;
  if (/^(input|select|todos cursos|bacharelado licenciatura)/.test(n)) return false;
  if (valorDaLinha(linha) || duracaoDaLinha(linha) || habilitacaoDaLinha(linha)) return false;
  return /[a-zA-ZÀ-ÿ]/.test(linha);
}

function parseCatalogo(html = "") {
  const linhas = htmlParaLinhas(html);
  const cursos = [];
  let estado = null;

  for (const linha of linhas) {
    const habil = habilitacaoDaLinha(linha);
    if (habil) {
      estado = { habilitacao: habil, duracao: null, nome: null };
      continue;
    }
    if (!estado) continue;

    if (!estado.duracao) {
      const duracao = duracaoDaLinha(linha);
      if (duracao) estado.duracao = duracao;
      continue;
    }

    if (!estado.nome) {
      if (linhaPodeSerNome(linha)) estado.nome = linha;
      continue;
    }

    const valor = valorDaLinha(linha);
    if (valor) {
      cursos.push({
        nome: estado.nome,
        habilitacao: estado.habilitacao,
        duracao: estado.duracao,
        valor,
        segundaGraduacao: /2\s*[aª]?\s*graduacao|para licenciados|para bachareis/i.test(norm(estado.nome).replace(/ /g, " ")),
        fonte: "site_oficial"
      });
      estado = null;
    }
  }

  const mapa = new Map();
  for (const curso of cursos) {
    const chave = norm(curso.nome);
    if (!chave || mapa.has(chave)) continue;
    mapa.set(chave, curso);
  }
  return [...mapa.values()];
}

function carregarDisco() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (!Array.isArray(data?.cursos) || data.cursos.length < 20) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function salvarDisco(cursos) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ em: Date.now(), cursos, fonte: "site_oficial" }, null, 2));
  } catch (e) {
    console.warn("⚠️ Não consegui salvar cache da UniFatecie:", e?.message || e);
  }
}

async function buscarSite() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(URL, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 LightBot/1.0",
        accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    const cursos = parseCatalogo(html);
    if (cursos.length < 40) throw new Error(`catálogo incompleto: ${cursos.length} cursos extraídos`);
    return cursos;
  } finally {
    clearTimeout(timeout);
  }
}

async function listar(force = false) {
  if (!force && memoria.cursos.length && Date.now() - memoria.em < CACHE_MS) return memoria.cursos;

  const disco = carregarDisco();
  if (!force && disco?.cursos?.length && Date.now() - Number(disco.em || 0) < CACHE_MS) {
    memoria = disco;
    return memoria.cursos;
  }

  try {
    const cursos = await buscarSite();
    memoria = { em: Date.now(), cursos, fonte: "site_oficial" };
    salvarDisco(cursos);
    console.log(`✅ Catálogo UniFatecie carregado: ${cursos.length} cursos.`);
    return cursos;
  } catch (e) {
    console.warn("⚠️ Catálogo oficial UniFatecie indisponível:", e?.message || e);
    if (disco?.cursos?.length) {
      memoria = disco;
      return disco.cursos;
    }
    memoria = { em: Date.now(), cursos: FALLBACK.map(c => ({ ...c, fonte: "fallback_local" })), fonte: "fallback_local" };
    return memoria.cursos;
  }
}

function scoreCurso(curso, texto) {
  const q = norm(texto);
  const n = norm(curso.nome);
  if (!q || !n) return 0;
  if (q === n) return 1000;
  if (q.includes(n)) return 900 + n.length;
  const qt = q.split(" ").filter(x => x.length > 2 && !["curso","cursos","valor","preco","mensalidade","duracao","tempo","unifatecie","fatecie","graduacao","faculdade","tem","quero","saber","qual","quanto","custa","de","da","do"].includes(x));
  if (!qt.length) return 0;
  let score = 0;
  for (const t of qt) {
    if (n.split(" ").includes(t)) score += 80;
    else if (n.includes(t)) score += 45;
  }
  return score;
}

async function buscar(texto, limite = 8) {
  const cursos = await listar();
  return cursos
    .map(c => ({ c, score: scoreCurso(c, texto) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.nome.localeCompare(b.c.nome, "pt-BR"))
    .slice(0, limite)
    .map(x => x.c);
}

function ehSegundaGraduacao(curso = {}) {
  const n = norm(curso.nome);
  return curso.segundaGraduacao === true || n.includes("2 graduacao") || n.includes("para licenciados") || n.includes("para bachareis");
}

function fonteAtual() {
  return memoria.fonte || "";
}

async function aquecer() {
  try { await listar(); } catch (_) {}
}

function selfTest() {
  const assert = require("assert");
  const sample = `
    <h3>Bacharelado</h3><div>3 anos</div><h2>Administração</h2><div>R$ 112,20 /mês</div><a>Matricular</a>
    <h3>Tecnólogo</h3><div>2 anos</div><h2>Análise e Desenvolvimento de Sistemas</h2><div>R$ 112,20 /mês</div>
    <h3>Licenciatura</h3><div>4 anos</div><h2>Pedagogia</h2><div>R$ 112,20 /mês</div>
  `;
  const cs = parseCatalogo(sample);
  assert.equal(cs.length, 3);
  assert.equal(cs[0].nome, "Administração");
  assert.equal(cs[1].duracao, "2 anos");
  assert.equal(cs[2].valor, "R$ 112,20/mês");
  console.log("✅ Self-test do catálogo UniFatecie aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { URL, listar, buscar, aquecer, parseCatalogo, ehSegundaGraduacao, fonteAtual, norm, FALLBACK };
