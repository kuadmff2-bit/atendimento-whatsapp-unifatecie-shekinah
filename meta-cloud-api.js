const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");

const PORT = Number(process.env.PORT || 8080);
const GRAPH_VERSION = String(process.env.META_GRAPH_VERSION || "v23.0").trim();
const ACCESS_TOKEN = String(process.env.META_WHATSAPP_TOKEN || "").trim();
const PHONE_NUMBER_ID = String(process.env.META_PHONE_NUMBER_ID || "").trim();
const VERIFY_TOKEN = String(process.env.META_VERIFY_TOKEN || "").trim();
const APP_SECRET = String(process.env.META_APP_SECRET || "").trim();
const BOT_ADMIN_PHONE = somenteNumeros(process.env.BOT_ADMIN_PHONE || "");
const TOKENS_DIR = process.env.TOKENS_DIR || path.join(process.cwd(), "tokens");
const SESSOES_FILE = path.join(TOKENS_DIR, "meta-sessoes.json");

const CURSOS_UNIFATECIE = {
  "1": { emoji: "🎓", nome: "Pedagogia", formacao: "Licenciatura", duracao: "4 anos", mensalidade: "R$ 112,20", estagio: "Possui estágio obrigatório" },
  "2": { emoji: "💻", nome: "Análise e Desenvolvimento de Sistemas", formacao: "Tecnólogo", duracao: "2 anos", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "3": { emoji: "👥", nome: "Gestão de Recursos Humanos", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "4": { emoji: "💰", nome: "Gestão Financeira", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "5": { emoji: "📦", nome: "Logística", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "6": { emoji: "📈", nome: "Processos Gerenciais", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "7": { emoji: "🖥️", nome: "Sistemas para Internet", formacao: "Tecnólogo", duracao: "2 anos", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "8": { emoji: "👗", nome: "Design de Moda", formacao: "Tecnólogo", duracao: "1 ano e 6 meses", mensalidade: "R$ 112,20", estagio: "Sem estágio obrigatório" },
  "9": { emoji: "🏢", nome: "Administração", formacao: "Bacharelado", duracao: "3 anos", mensalidade: "R$ 112,20", estagio: "Confirmar com a secretaria" },
};

const CONFIG = {
  unifatecie: { nome: "UniFatecie — Polo Barreirinha" },
  shekinah: {
    nome: "Centro Educacional Shekinah",
    cursos:
      "📚 *CURSOS E VALORES — SHEKINAH*\n\n" +
      "🧒 Inglês Kids — *R$ 150/mês* | 2 vezes por semana\n" +
      "💻 Informática Completa — *R$ 150/mês* | 2 vezes por semana\n" +
      "🖥️ Informática Avançada — *R$ 150/mês* | 2 vezes por semana\n" +
      "🎨 Desenho Artístico — *R$ 150/mês* | aulas aos sábados\n" +
      "🎹 Teclado — *R$ 150/mês* | 2 vezes por semana\n" +
      "📖 Reforço Escolar — *R$ 150/mês* | 2 vezes por semana\n" +
      "💼 Gestão Empresarial 6 em 1 — *R$ 180/mês* | 3 vezes por semana\n" +
      "🎓 EJA — informações e valores sob consulta\n\n" +
      "📝 Matrícula: *R$ 49,90*\n\n" +
      "🔥 *Combos*\n" +
      "2 cursos — *R$ 180/mês*\n" +
      "3 cursos — *R$ 280/mês*"
  }
};

const SHEKINAH_CURSOS = [
  "Inglês Kids",
  "Informática Completa",
  "Informática Avançada",
  "Desenho Artístico",
  "Teclado",
  "Reforço Escolar",
  "Gestão Empresarial 6 em 1",
  "EJA",
];

const sessoes = new Map();
const processadas = new Set();
carregarSessoes();

function somenteNumeros(v = "") { return String(v).replace(/\D/g, ""); }
function limparTexto(v = "") {
  return String(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
function cpfValido(v = "") { return somenteNumeros(v).length === 11; }
function telefoneValido(v = "") { const n = somenteNumeros(v); return n.length >= 10 && n.length <= 13; }
function emailValido(v = "") { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); }
function cepValido(v = "") { return somenteNumeros(v).length === 8; }
function nomeValido(v = "") { return String(v).trim().split(/\s+/).filter(Boolean).length >= 2; }
function dataNascimentoValida(v = "") {
  const m = String(v).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mes = Number(m[2]), ano = Number(m[3]);
  const dt = new Date(ano, mes - 1, d);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== d) return null;
  if (dt > new Date() || ano < 1900) return null;
  return dt;
}
function menorDeIdade(dt) {
  const hoje = new Date();
  let idade = hoje.getFullYear() - dt.getFullYear();
  const m = hoje.getMonth() - dt.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dt.getDate())) idade--;
  return idade < 18;
}
function formatarCpf(v) { const n = somenteNumeros(v); return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); }
function formatarCep(v) { const n = somenteNumeros(v); return n.replace(/(\d{5})(\d{3})/, "$1-$2"); }
function primeiroNome(v = "") { return String(v).trim().split(/\s+/)[0] || ""; }

function carregarSessoes() {
  try {
    if (!fs.existsSync(SESSOES_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(SESSOES_FILE, "utf8"));
    for (const [k, v] of Object.entries(obj || {})) sessoes.set(k, v);
    console.log(`💾 ${sessoes.size} sessão(ões) Meta restaurada(s).`);
  } catch (e) { console.warn("⚠️ Não foi possível restaurar sessões Meta:", e.message); }
}
function persistirSessoes() {
  try {
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
    const tmp = `${SESSOES_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(sessoes), null, 2));
    fs.renameSync(tmp, SESSOES_FILE);
  } catch (e) { console.warn("⚠️ Falha ao salvar sessões Meta:", e.message); }
}
function novaSessao() { return { etapa: "inicio", instituicao: null, dados: {}, atendimentoHumano: false, historicoIA: [], atualizadoEm: Date.now() }; }
function sessaoDe(numero) {
  let s = sessoes.get(numero);
  if (!s) { s = novaSessao(); sessoes.set(numero, s); }
  s.atualizadoEm = Date.now();
  return s;
}
function resetar(numero) { const s = novaSessao(); sessoes.set(numero, s); persistirSessoes(); return s; }

function menuInicial() {
  return "👋 Olá! Eu sou o *Light*, assistente virtual.\n\n" +
    "Posso ajudar com:\n" +
    "1️⃣ UniFatecie — Polo Barreirinha\n" +
    "2️⃣ Centro Educacional Shekinah\n\n" +
    "Digite *1* ou *2*, ou escreva o que você precisa.";
}
function menuInstituicao(inst) {
  const nome = CONFIG[inst].nome;
  return `🏫 *${nome}*\n\n1️⃣ Ver cursos e valores\n2️⃣ Fazer matrícula\n3️⃣ Financeiro / falar com atendente\n0️⃣ Trocar de instituição\n\nVocê também pode escrever sua dúvida normalmente.`;
}
function menuCursosUnifatecie() {
  return "🎓 *CURSOS MAIS PROCURADOS — UNIFATECIE*\n\n" + Object.entries(CURSOS_UNIFATECIE)
    .map(([n, c]) => `${n}. ${c.emoji} *${c.nome}* — ${c.mensalidade}`)
    .join("\n") + "\n\nDigite o número de um curso para ver detalhes, *2* para matrícula ou *m* para o menu.";
}
function detalheCurso(c) {
  return `${c.emoji} *${c.nome}*\n\n🎓 Formação: ${c.formacao}\n⏳ Duração: ${c.duracao}\n💰 Mensalidade: ${c.mensalidade}\n📌 ${c.estagio}\n\nSe quiser se matricular, escreva *matrícula*.`;
}

function cursoUnifateciePorTexto(texto) {
  const t = limparTexto(texto);
  if (CURSOS_UNIFATECIE[t]) return CURSOS_UNIFATECIE[t];
  return Object.values(CURSOS_UNIFATECIE).find(c => t.includes(limparTexto(c.nome)) || limparTexto(c.nome).includes(t));
}
function cursoShekinahPorTexto(texto) {
  const t = limparTexto(texto);
  return SHEKINAH_CURSOS.find(c => t.includes(limparTexto(c)) || limparTexto(c).includes(t));
}

async function metaRequest(body) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) throw new Error("META_WHATSAPP_TOKEN ou META_PHONE_NUMBER_ID ausente");
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(PHONE_NUMBER_ID)}/messages`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Meta HTTP ${r.status}: ${txt.slice(0, 400)}`);
  try { return JSON.parse(txt); } catch (_) { return txt; }
}
async function enviarTexto(destino, mensagem) {
  const to = somenteNumeros(destino);
  if (!to) return;
  await metaRequest({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: String(mensagem).slice(0, 4000) } });
}
async function marcarComoLida(id) {
  if (!id) return;
  try { await metaRequest({ messaging_product: "whatsapp", status: "read", message_id: id }); } catch (_) {}
}

async function avisarAdmin(texto) {
  if (!BOT_ADMIN_PHONE) return false;
  try { await enviarTexto(BOT_ADMIN_PHONE, texto); return true; }
  catch (e) { console.error("❌ Falha ao avisar administrador:", e.message); return false; }
}

function resumoMatriculaUnifatecie(s) {
  const d = s.dados;
  return "✅ *PRÉ-MATRÍCULA RECEBIDA — UNIFATECIE*\n\n" +
    `📚 Curso: ${d.curso}\n👤 Nome: ${d.nome}\n🪪 CPF: ${d.cpf}\n📅 Nascimento: ${d.nascimento}\n✉️ E-mail: ${d.email}\n📱 Telefone: ${d.telefone}\n` +
    `🏠 Endereço: ${d.rua}, ${d.numero} — ${d.bairro}, ${d.cidade}/${d.estado} — CEP ${d.cep}\n💳 Vencimento: dia ${d.vencimento}\n\n` +
    "A equipe continuará a matrícula por esta conversa.";
}
function resumoMatriculaShekinah(s) {
  const d = s.dados;
  return "✅ *PRÉ-MATRÍCULA RECEBIDA — SHEKINAH*\n\n" +
    `📚 Curso: ${d.curso}\n👤 Nome: ${d.nome}\n🪪 CPF: ${d.cpf}\n📱 Telefone: ${d.telefone}\n✉️ E-mail: ${d.email}\n📅 Nascimento: ${d.nascimento}\n` +
    (d.cpfResponsavel ? `👨‍👩‍👧 CPF responsável: ${d.cpfResponsavel}\n` : "") +
    "\nA secretaria continuará a matrícula por esta conversa.";
}

async function processarMatriculaUnifatecie(numero, texto, s) {
  const d = s.dados;
  switch (s.etapa) {
    case "unifatecie_matricula_curso": {
      const c = cursoUnifateciePorTexto(texto);
      if (!c && String(texto).trim().length < 2) return enviarTexto(numero, "Informe o curso desejado.");
      d.curso = c?.nome || String(texto).trim();
      s.etapa = "unifatecie_matricula_nome";
      return enviarTexto(numero, "👤 Informe o *nome completo* do aluno.");
    }
    case "unifatecie_matricula_nome":
      if (!nomeValido(texto)) return enviarTexto(numero, "Informe nome e sobrenome.");
      d.nome = String(texto).trim(); s.etapa = "unifatecie_matricula_cpf";
      return enviarTexto(numero, `Obrigado, ${primeiroNome(d.nome)}! 😊\n\nInforme o *CPF* do aluno.`);
    case "unifatecie_matricula_cpf":
      if (!cpfValido(texto)) return enviarTexto(numero, "CPF inválido. Digite os 11 números.");
      d.cpf = formatarCpf(texto); s.etapa = "unifatecie_matricula_nascimento";
      return enviarTexto(numero, "📅 Informe a *data de nascimento* em DD/MM/AAAA.");
    case "unifatecie_matricula_nascimento":
      if (!dataNascimentoValida(texto)) return enviarTexto(numero, "Data inválida. Use DD/MM/AAAA.");
      d.nascimento = String(texto).trim(); s.etapa = "unifatecie_matricula_email";
      return enviarTexto(numero, "✉️ Informe o *e-mail* do aluno.");
    case "unifatecie_matricula_email":
      if (!emailValido(texto)) return enviarTexto(numero, "E-mail inválido. Tente novamente.");
      d.email = String(texto).trim().toLowerCase(); s.etapa = "unifatecie_matricula_telefone";
      return enviarTexto(numero, "📱 Informe o *telefone com DDD*.");
    case "unifatecie_matricula_telefone":
      if (!telefoneValido(texto)) return enviarTexto(numero, "Telefone inválido. Digite com DDD.");
      d.telefone = somenteNumeros(texto); s.etapa = "unifatecie_matricula_rua";
      return enviarTexto(numero, "🏠 Informe o nome da *Rua ou Avenida*.");
    case "unifatecie_matricula_rua":
      if (String(texto).trim().length < 2) return enviarTexto(numero, "Informe a rua ou avenida.");
      d.rua = String(texto).trim(); s.etapa = "unifatecie_matricula_numero";
      return enviarTexto(numero, "Informe o *número*. Se não houver, digite *S/N*.");
    case "unifatecie_matricula_numero":
      d.numero = String(texto).trim(); s.etapa = "unifatecie_matricula_bairro";
      return enviarTexto(numero, "Informe o *bairro ou comunidade*.");
    case "unifatecie_matricula_bairro":
      if (String(texto).trim().length < 2) return enviarTexto(numero, "Informe o bairro ou comunidade.");
      d.bairro = String(texto).trim(); s.etapa = "unifatecie_matricula_cidade";
      return enviarTexto(numero, "Informe a *cidade*.");
    case "unifatecie_matricula_cidade":
      if (String(texto).trim().length < 2) return enviarTexto(numero, "Informe a cidade.");
      d.cidade = String(texto).trim(); s.etapa = "unifatecie_matricula_estado";
      return enviarTexto(numero, "Informe o *Estado* ou sigla, por exemplo *AM*.");
    case "unifatecie_matricula_estado":
      if (String(texto).trim().length < 2) return enviarTexto(numero, "Informe o Estado ou sigla.");
      d.estado = String(texto).trim().toUpperCase(); s.etapa = "unifatecie_matricula_cep";
      return enviarTexto(numero, "Informe o *CEP* com 8 números.");
    case "unifatecie_matricula_cep":
      if (!cepValido(texto)) return enviarTexto(numero, "CEP inválido. Digite 8 números.");
      d.cep = formatarCep(texto); s.etapa = "unifatecie_matricula_vencimento";
      return enviarTexto(numero, "💳 Escolha o vencimento:\n\n1️⃣ Dia 05\n2️⃣ Dia 07\n3️⃣ Dia 10");
    case "unifatecie_matricula_vencimento": {
      const mapa = { "1": "05", "2": "07", "3": "10", "05": "05", "07": "07", "10": "10" };
      const v = mapa[String(texto).trim()];
      if (!v) return enviarTexto(numero, "Digite *1*, *2* ou *3*.");
      d.vencimento = v; s.etapa = "atendimento_humano"; s.atendimentoHumano = true;
      const resumo = resumoMatriculaUnifatecie(s);
      await enviarTexto(numero, resumo);
      await avisarAdmin(`📥 NOVA PRÉ-MATRÍCULA\nNúmero do aluno: ${numero}\n\n${resumo}`);
      return;
    }
  }
}

async function processarMatriculaShekinah(numero, texto, s) {
  const d = s.dados;
  switch (s.etapa) {
    case "shekinah_matricula_curso": {
      const c = cursoShekinahPorTexto(texto);
      d.curso = c || String(texto).trim();
      if (d.curso.length < 2) return enviarTexto(numero, "Informe o curso desejado.");
      s.etapa = "shekinah_matricula_nome";
      return enviarTexto(numero, "👤 Informe o *nome completo* do aluno.");
    }
    case "shekinah_matricula_nome":
      if (!nomeValido(texto)) return enviarTexto(numero, "Informe nome e sobrenome.");
      d.nome = String(texto).trim(); s.etapa = "shekinah_matricula_cpf";
      return enviarTexto(numero, `Obrigado, ${primeiroNome(d.nome)}! 😊\n\nInforme o *CPF* do aluno.`);
    case "shekinah_matricula_cpf":
      if (!cpfValido(texto)) return enviarTexto(numero, "CPF inválido. Digite os 11 números.");
      d.cpf = formatarCpf(texto); s.etapa = "shekinah_matricula_telefone";
      return enviarTexto(numero, "📱 Informe o *telefone/WhatsApp com DDD*.");
    case "shekinah_matricula_telefone":
      if (!telefoneValido(texto)) return enviarTexto(numero, "Telefone inválido. Digite com DDD.");
      d.telefone = somenteNumeros(texto); s.etapa = "shekinah_matricula_email";
      return enviarTexto(numero, "✉️ Informe o *e-mail* do aluno.");
    case "shekinah_matricula_email":
      if (!emailValido(texto)) return enviarTexto(numero, "E-mail inválido. Tente novamente.");
      d.email = String(texto).trim().toLowerCase(); s.etapa = "shekinah_matricula_nascimento";
      return enviarTexto(numero, "📅 Informe a *data de nascimento* em DD/MM/AAAA.");
    case "shekinah_matricula_nascimento": {
      const dt = dataNascimentoValida(texto);
      if (!dt) return enviarTexto(numero, "Data inválida. Use DD/MM/AAAA.");
      d.nascimento = String(texto).trim();
      if (menorDeIdade(dt)) { s.etapa = "shekinah_matricula_cpf_responsavel"; return enviarTexto(numero, "🧒 Como o aluno é menor de 18 anos, informe o *CPF de um responsável*."); }
      s.etapa = "atendimento_humano"; s.atendimentoHumano = true;
      const resumo = resumoMatriculaShekinah(s);
      await enviarTexto(numero, resumo);
      await avisarAdmin(`📥 NOVA PRÉ-MATRÍCULA SHEKINAH\nNúmero do aluno: ${numero}\n\n${resumo}`);
      return;
    }
    case "shekinah_matricula_cpf_responsavel":
      if (!cpfValido(texto)) return enviarTexto(numero, "CPF inválido. Digite os 11 números do responsável.");
      d.cpfResponsavel = formatarCpf(texto); s.etapa = "atendimento_humano"; s.atendimentoHumano = true;
      {
        const resumo = resumoMatriculaShekinah(s);
        await enviarTexto(numero, resumo);
        await avisarAdmin(`📥 NOVA PRÉ-MATRÍCULA SHEKINAH\nNúmero do aluno: ${numero}\n\n${resumo}`);
      }
      return;
  }
}

async function processarMensagem(numero, textoOriginal) {
  const texto = String(textoOriginal || "").trim();
  const t = limparTexto(texto);
  let s = sessaoDe(numero);

  if (["m", "menu", "inicio", "início", "cancelar"].includes(t)) {
    s = resetar(numero);
    await enviarTexto(numero, t === "cancelar" ? "✅ Atendimento cancelado.\n\n" + menuInicial() : menuInicial());
    return;
  }

  if (s.etapa.startsWith("unifatecie_matricula_")) { await processarMatriculaUnifatecie(numero, texto, s); persistirSessoes(); return; }
  if (s.etapa.startsWith("shekinah_matricula_")) { await processarMatriculaShekinah(numero, texto, s); persistirSessoes(); return; }

  if (s.etapa === "financeiro_nome") {
    if (!nomeValido(texto)) return enviarTexto(numero, "Informe o *nome completo do aluno*.");
    s.dados.nomeFinanceiro = texto; s.etapa = "financeiro_assunto"; persistirSessoes();
    return enviarTexto(numero, "Conte resumidamente o que você precisa. Ex.: segunda via, vencimento, mensalidade em aberto ou confirmação de pagamento.");
  }
  if (s.etapa === "financeiro_assunto") {
    const msg = `💳 SOLICITAÇÃO DE ATENDIMENTO\nInstituição: ${CONFIG[s.instituicao]?.nome || "Não definida"}\nAluno: ${s.dados.nomeFinanceiro}\nNúmero: ${numero}\nAssunto: ${texto}`;
    await avisarAdmin(msg);
    s.etapa = "atendimento_humano"; s.atendimentoHumano = true; persistirSessoes();
    return enviarTexto(numero, "✅ Solicitação recebida. Um atendente continuará por esta conversa.\n\nPara voltar ao robô, digite *m*.");
  }
  if (s.etapa === "atendimento_humano") {
    await avisarAdmin(`💬 MENSAGEM PARA ATENDENTE\nNúmero: ${numero}\n${texto}`);
    return;
  }

  if (!s.instituicao) {
    const cUni = cursoUnifateciePorTexto(texto);
    const cShe = cursoShekinahPorTexto(texto);
    if (t === "1" || t.includes("unifatecie") || cUni) s.instituicao = "unifatecie";
    else if (t === "2" || t.includes("shekinah") || cShe) s.instituicao = "shekinah";
    else {
      await enviarTexto(numero, menuInicial());
      return;
    }
    s.etapa = "menu_instituicao"; persistirSessoes();
    if (t.includes("matricula") || t.includes("matrícula")) {
      s.dados = {}; s.etapa = `${s.instituicao}_matricula_curso`; persistirSessoes();
      return enviarTexto(numero, "📚 Qual curso você deseja fazer?");
    }
    if (cUni && s.instituicao === "unifatecie") return enviarTexto(numero, detalheCurso(cUni));
    if (cShe && s.instituicao === "shekinah") return enviarTexto(numero, CONFIG.shekinah.cursos);
    return enviarTexto(numero, menuInstituicao(s.instituicao));
  }

  if (s.etapa === "menu_instituicao") {
    if (t === "0" || t.includes("trocar")) { s = resetar(numero); return enviarTexto(numero, menuInicial()); }
    if (t === "1" || t.includes("curso") || t.includes("valor")) {
      return enviarTexto(numero, s.instituicao === "unifatecie" ? menuCursosUnifatecie() : CONFIG.shekinah.cursos + "\n\nSe quiser se matricular, escreva *matrícula*.");
    }
    if (t === "2" || t.includes("matricula") || t.includes("matrícula")) {
      s.dados = {}; s.etapa = `${s.instituicao}_matricula_curso`; persistirSessoes();
      return enviarTexto(numero, "📚 Qual curso você deseja fazer?");
    }
    if (t === "3" || t.includes("financeiro") || t.includes("atendente") || t.includes("secretaria") || t.includes("humano")) {
      s.etapa = "financeiro_nome"; persistirSessoes();
      return enviarTexto(numero, "👤 Informe o *nome completo do aluno*.");
    }
    if (s.instituicao === "unifatecie") {
      const c = cursoUnifateciePorTexto(texto);
      if (c) return enviarTexto(numero, detalheCurso(c));
    }
    if (s.instituicao === "shekinah" && cursoShekinahPorTexto(texto)) return enviarTexto(numero, CONFIG.shekinah.cursos);

    if (iaDisponivel()) {
      try {
        const resposta = await tentarResponderComIA({ textoOriginal: texto, sessao: s, cursosUnifatecie: CURSOS_UNIFATECIE, config: CONFIG });
        if (resposta) { persistirSessoes(); return enviarTexto(numero, resposta); }
      } catch (e) { console.warn("⚠️ IA indisponível:", e.message); }
    }
    return enviarTexto(numero, menuInstituicao(s.instituicao));
  }

  return enviarTexto(numero, menuInicial());
}

function validarAssinatura(raw, assinatura) {
  if (!APP_SECRET) return true;
  if (!assinatura || !assinatura.startsWith("sha256=")) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(assinatura);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function tratarWebhook(payload) {
  const entradas = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entradas) {
    for (const change of entry?.changes || []) {
      const value = change?.value;
      for (const msg of value?.messages || []) {
        const id = String(msg?.id || "");
        const from = somenteNumeros(msg?.from || "");
        if (!from || !id || processadas.has(id)) continue;
        processadas.add(id);
        if (processadas.size > 1500) processadas.delete(processadas.values().next().value);
        await marcarComoLida(id);
        if (msg?.type !== "text") {
          await enviarTexto(from, "Por enquanto, envie sua solicitação em *texto*. Se quiser o menu, digite *m*.");
          continue;
        }
        console.log(`📩 Meta Cloud API: mensagem recebida de ${from}`);
        try { await processarMensagem(from, msg?.text?.body || ""); }
        catch (e) { console.error("❌ Erro ao processar mensagem Meta:", e); }
        persistirSessoes();
      }
    }
  }
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && u.pathname === "/health") {
    const configured = Boolean(ACCESS_TOKEN && PHONE_NUMBER_ID && VERIFY_TOKEN);
    res.writeHead(configured ? 200 : 503, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, provider: "meta-whatsapp-cloud-api", configured, graphVersion: GRAPH_VERSION }));
  }

  if (req.method === "GET" && u.pathname === "/webhook") {
    const mode = u.searchParams.get("hub.mode");
    const token = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(challenge || "");
    }
    res.writeHead(403); return res.end("Forbidden");
  }

  if (req.method === "POST" && u.pathname === "/webhook") {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);
      if (!validarAssinatura(raw, req.headers["x-hub-signature-256"])) { res.writeHead(401); return res.end("invalid signature"); }
      let payload;
      try { payload = JSON.parse(raw.toString("utf8")); }
      catch (_) { res.writeHead(400); return res.end("invalid json"); }
      res.writeHead(200, { "Content-Type": "text/plain" }); res.end("EVENT_RECEIVED");
      tratarWebhook(payload).catch(e => console.error("❌ Webhook Meta:", e));
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Light Meta Cloud API ouvindo na porta ${PORT}.`);
  console.log(`🔐 Configuração Meta: ${ACCESS_TOKEN && PHONE_NUMBER_ID && VERIFY_TOKEN ? "PRONTA" : "PENDENTE"}.`);
  if (!APP_SECRET) console.warn("⚠️ META_APP_SECRET ainda não configurado; assinatura do webhook não será validada.");
});
