// =====================================
// IMPORTAÇÕES
// =====================================
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require("fs");
const path = require("path");

// =====================================
// TEXTOS E VALORES EDITÁVEIS
// Altere somente esta área quando houver mudança de preço ou informação.
// =====================================
const CONFIG = {
  nomeAtendimento: "Atendimento UniFatecie e Centro Educacional Shekinah",

  unifatecie: {
    nome: "UniFatecie — Polo Barreirinha",
    cursos:
      "🎓 *CURSOS E VALORES — UNIFATECIE*\n\n" +
      "✅ Graduação 100% EAD\n" +
      "✅ Pedagogia\n" +
      "✅ Administração\n" +
      "✅ Análise e Desenvolvimento de Sistemas\n" +
      "✅ Engenharia de Software\n" +
      "✅ Gestão Financeira\n" +
      "✅ Diversas licenciaturas, bacharelados e tecnólogos\n\n" +
      "💰 Mensalidades a partir de *R$ 112,20*.\n" +
      "O valor pode variar conforme o curso e a campanha vigente.\n\n" +
      "Para consultar um curso específico, digite *2* e faça uma solicitação de matrícula.",
  },

  shekinah: {
    nome: "Centro Educacional Shekinah",
    cursos:
      "📚 *CURSOS E VALORES — SHEKINAH*\n\n" +
      "💻 Informática completa — *R$ 150,00*\n" +
      "🇬🇧 Inglês básico — *R$ 150,00*\n" +
      "🧒 Inglês Kids — *R$ 150,00*\n" +
      "🎨 Desenho — *R$ 150,00*\n" +
      "💼 Gestão Empresarial 6 em 1 — *R$ 180,00*\n" +
      "📖 EJA — valor sob consulta\n\n" +
      "🔥 *Combos*\n" +
      "2 cursos — *R$ 180,00*\n" +
      "3 cursos — *R$ 280,00*\n\n" +
      "Para iniciar sua matrícula, digite *2*.",
  },
};

// =====================================
// CONFIGURAÇÃO DO CLIENTE
// =====================================
const windows = process.platform === "win32";

function encontrarNavegadorWindows() {
  if (!windows) return null;

  const candidatos = [
    process.env.CHROME_PATH,
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);

  return candidatos.find((caminho) => fs.existsSync(caminho)) || null;
}

const caminhoNavegador = encontrarNavegadorWindows();

const opcoesPuppeteer = {
  headless: true,
  // O Puppeteer usa 30 segundos por padrão. Em computadores ARM ou mais
  // lentos, o navegador pode precisar de mais tempo para iniciar.
  timeout: 120000,
  args: windows
    ? ["--disable-extensions", "--no-first-run", "--no-default-browser-check"]
    : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
};

// No Windows, prioriza o Chrome/Edge já instalado. Isso evita incompatibilidade
// do navegador baixado pelo Puppeteer em computadores Windows ARM64.
if (caminhoNavegador) {
  opcoesPuppeteer.executablePath = caminhoNavegador;
  console.log(`🌐 Navegador detectado: ${caminhoNavegador}`);
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: opcoesPuppeteer,
});

// =====================================
// QR CODE E CONEXÃO
// =====================================
client.on("qr", (qr) => {
  console.log("📲 Escaneie o QR Code abaixo:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("🔐 WhatsApp autenticado.");
});

client.on("ready", () => {
  console.log("✅ Tudo certo! WhatsApp conectado.");
});

client.on("auth_failure", (erro) => {
  console.error("❌ Falha na autenticação:", erro);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Desconectado:", reason);
});

client.initialize().catch((error) => {
  console.error("❌ Não foi possível iniciar o navegador do WhatsApp.");
  console.error(error);

  if (windows) {
    console.error(
      "\nConfira se o Google Chrome ou o Microsoft Edge está instalado e totalmente fechado antes de tentar novamente."
    );
  }

  process.exitCode = 1;
});

// =====================================
// FUNÇÕES AUXILIARES
// =====================================
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// As sessões ficam separadas por número de WhatsApp.
const sessoes = new Map();
const mensagensProcessadas = new Set();

function marcarMensagemComoProcessada(id) {
  if (!id) return false;
  if (mensagensProcessadas.has(id)) return true;

  mensagensProcessadas.add(id);
  const limpeza = setTimeout(() => mensagensProcessadas.delete(id), 2 * 60 * 1000);
  limpeza.unref();
  return false;
}

function novaSessao() {
  return {
    etapa: "escolher_instituicao",
    instituicao: null,
    atendimentoHumano: false,
    nome: "",
    curso: "",
    atualizadoEm: Date.now(),
  };
}

function obterSessao(numero) {
  const LIMITE_SESSAO = 30 * 60 * 1000;
  let sessao = sessoes.get(numero);

  if (!sessao || Date.now() - sessao.atualizadoEm > LIMITE_SESSAO) {
    sessao = novaSessao();
    sessoes.set(numero, sessao);
  }

  sessao.atualizadoEm = Date.now();
  return sessao;
}

function limparTexto(texto = "") {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function obterSaudacao() {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Manaus",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );

  if (hora >= 5 && hora < 12) return "Bom dia";
  if (hora >= 12 && hora < 18) return "Boa tarde";
  return "Boa noite";
}

async function enviarDigitando(chat, destino, mensagem) {
  await chat.sendStateTyping();
  await delay(1200);
  await client.sendMessage(destino, mensagem);
  await chat.clearState();
}

function menuInicial() {
  return (
    `${obterSaudacao()}! 👋\n\n` +
    `Bem-vindo ao *${CONFIG.nomeAtendimento}*.\n\n` +
    "Qual instituição você deseja falar?\n\n" +
    "1️⃣ UniFatecie\n" +
    "2️⃣ Centro Educacional Shekinah\n\n" +
    "Digite apenas *1* ou *2*."
  );
}

function menuInstituicao(instituicao) {
  const nome = CONFIG[instituicao].nome;

  return (
    `Você está no atendimento: *${nome}* ✅\n\n` +
    "Escolha uma opção:\n\n" +
    "1️⃣ Cursos e valores\n" +
    "2️⃣ Matrícula\n" +
    "3️⃣ Financeiro e mensalidades\n" +
    "4️⃣ Falar com um atendente\n\n" +
    "0️⃣ Trocar de instituição\n\n" +
    "Digite apenas o número da opção."
  );
}

function orientacaoVoltar() {
  return "\n\nDigite *menu* para voltar ao menu principal.";
}

function primeiroNome(nomeCompleto) {
  return nomeCompleto.trim().split(/\s+/)[0];
}

function nomeValido(nome) {
  return nome.length >= 5 && nome.includes(" ") && /^[A-Za-zÀ-ÿ' -]+$/.test(nome);
}

// =====================================
// FUNIL DE ATENDIMENTO — SOMENTE PRIVADO
// =====================================
async function processarMensagem(msg) {
  const idMensagem = msg.id?._serialized || null;

  try {
    // Algumas contas entregam a mensagem em "message", outras também usam
    // "message_create". O ID impede que a mesma mensagem seja respondida duas vezes.
    if (marcarMensagemComoProcessada(idMensagem)) return;

    console.log(
      `🔎 Evento recebido: origem=${msg.from || "desconhecida"} ` +
        `própria=${msg.fromMe ? "sim" : "não"} tipo=${msg.type || "desconhecido"}`
    );

    // Ignora mensagens próprias, grupos, status, canais e listas de transmissão.
    // Conversas privadas atuais podem terminar em @c.us ou @lid.
    if (msg.fromMe || !msg.from) return;

    const remetente = msg.from.toLowerCase();
    if (
      remetente === "status@broadcast" ||
      remetente.endsWith("@g.us") ||
      remetente.endsWith("@broadcast") ||
      remetente.endsWith("@newsletter")
    ) {
      return;
    }

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const textoOriginal = msg.body ? msg.body.trim() : "";
    if (!textoOriginal) return;

    const previa = textoOriginal.replace(/\s+/g, " ").slice(0, 80);
    console.log(`📩 Mensagem privada recebida de ${msg.from}: ${previa}`);

    const texto = limparTexto(textoOriginal);
    const comandoMenu = /^(menu|inicio|comecar|recomecar|oi|ola|bom dia|boa tarde|boa noite)$/.test(texto);

    // "menu" sempre encerra o fluxo atual e recomeça o atendimento.
    if (comandoMenu) {
      sessoes.set(msg.from, novaSessao());
      await enviarDigitando(chat, msg.from, menuInicial());
      return;
    }

    const sessao = obterSessao(msg.from);

    // Enquanto estiver com um atendente, o robô não interrompe a conversa.
    if (sessao.atendimentoHumano) return;

    // -------------------------------------
    // ESCOLHA DA INSTITUIÇÃO
    // -------------------------------------
    if (sessao.etapa === "escolher_instituicao") {
      if (texto === "1" || texto.includes("unifatecie")) {
        sessao.instituicao = "unifatecie";
        sessao.etapa = "menu_instituicao";
        await enviarDigitando(chat, msg.from, menuInstituicao("unifatecie"));
        return;
      }

      if (texto === "2" || texto.includes("shekinah")) {
        sessao.instituicao = "shekinah";
        sessao.etapa = "menu_instituicao";
        await enviarDigitando(chat, msg.from, menuInstituicao("shekinah"));
        return;
      }

      await enviarDigitando(
        chat,
        msg.from,
        "Não consegui identificar a instituição. 😊\n\nDigite:\n*1* para UniFatecie\n*2* para Shekinah"
      );
      return;
    }

    // -------------------------------------
    // MENU DA INSTITUIÇÃO
    // -------------------------------------
    if (sessao.etapa === "menu_instituicao") {
      if (texto === "0") {
        sessao.etapa = "escolher_instituicao";
        sessao.instituicao = null;
        await enviarDigitando(chat, msg.from, menuInicial());
        return;
      }

      if (texto === "1") {
        await enviarDigitando(
          chat,
          msg.from,
          CONFIG[sessao.instituicao].cursos + orientacaoVoltar()
        );
        return;
      }

      if (texto === "2") {
        sessao.etapa = "matricula_nome";
        await enviarDigitando(
          chat,
          msg.from,
          "📝 *SOLICITAÇÃO DE MATRÍCULA*\n\nPara começar, informe o *nome completo do aluno*."
        );
        return;
      }

      if (texto === "3") {
        sessao.etapa = "financeiro_nome";
        await enviarDigitando(
          chat,
          msg.from,
          "💳 *FINANCEIRO E MENSALIDADES*\n\nInforme o *nome completo do aluno*."
        );
        return;
      }

      if (texto === "4") {
        sessao.atendimentoHumano = true;
        sessao.etapa = "atendimento_humano";
        await enviarDigitando(
          chat,
          msg.from,
          "👩‍💼 Pronto! Seu atendimento foi encaminhado.\n\nUm atendente responderá por esta mesma conversa assim que estiver disponível.\n\nSe quiser voltar ao atendimento automático, digite *menu*."
        );
        return;
      }

      await enviarDigitando(
        chat,
        msg.from,
        "Opção inválida. Digite um número de *1 a 4* ou *0* para trocar de instituição."
      );
      return;
    }

    // -------------------------------------
    // MATRÍCULA
    // -------------------------------------
    if (sessao.etapa === "matricula_nome") {
      if (!nomeValido(textoOriginal)) {
        await enviarDigitando(
          chat,
          msg.from,
          "Por favor, informe o *nome completo do aluno*, com nome e sobrenome."
        );
        return;
      }

      sessao.nome = textoOriginal;
      sessao.etapa = "matricula_curso";
      await enviarDigitando(
        chat,
        msg.from,
        `Obrigado, ${primeiroNome(sessao.nome)}! 😊\n\nQual *curso* você deseja fazer?`
      );
      return;
    }

    if (sessao.etapa === "matricula_curso") {
      if (textoOriginal.length < 2 || textoOriginal.length > 100) {
        await enviarDigitando(chat, msg.from, "Digite o nome do curso desejado.");
        return;
      }

      sessao.curso = textoOriginal;
      sessao.atendimentoHumano = true;
      sessao.etapa = "atendimento_humano";

      await enviarDigitando(
        chat,
        msg.from,
        "✅ *SOLICITAÇÃO REGISTRADA*\n\n" +
          `🏫 Instituição: ${CONFIG[sessao.instituicao].nome}\n` +
          `👤 Aluno: ${sessao.nome}\n` +
          `📚 Curso: ${sessao.curso}\n\n` +
          "Agora um atendente continuará sua matrícula por esta conversa.\n" +
          "Para voltar ao atendimento automático, digite *menu*."
      );
      return;
    }

    // -------------------------------------
    // FINANCEIRO
    // -------------------------------------
    if (sessao.etapa === "financeiro_nome") {
      if (!nomeValido(textoOriginal)) {
        await enviarDigitando(
          chat,
          msg.from,
          "Por favor, informe o *nome completo do aluno*, com nome e sobrenome."
        );
        return;
      }

      sessao.nome = textoOriginal;
      sessao.etapa = "financeiro_assunto";
      await enviarDigitando(
        chat,
        msg.from,
        "Conte resumidamente o que você precisa.\n\n" +
          "Exemplos: segunda via, vencimento, mensalidade em aberto ou confirmação de pagamento.\n\n" +
          "🔒 Não envie senha, código de acesso ou dados do cartão."
      );
      return;
    }

    if (sessao.etapa === "financeiro_assunto") {
      if (textoOriginal.length < 3 || textoOriginal.length > 500) {
        await enviarDigitando(
          chat,
          msg.from,
          "Descreva o pedido em uma mensagem de até 500 caracteres."
        );
        return;
      }

      sessao.atendimentoHumano = true;
      sessao.etapa = "atendimento_humano";

      await enviarDigitando(
        chat,
        msg.from,
        "✅ *SOLICITAÇÃO FINANCEIRA RECEBIDA*\n\n" +
          `🏫 Instituição: ${CONFIG[sessao.instituicao].nome}\n` +
          `👤 Aluno: ${sessao.nome}\n` +
          `📝 Solicitação: ${textoOriginal}\n\n` +
          "Um atendente verificará as informações e responderá por esta conversa.\n" +
          "Para voltar ao atendimento automático, digite *menu*."
      );
      return;
    }

    // Proteção para qualquer estado inesperado.
    sessoes.set(msg.from, novaSessao());
    await enviarDigitando(chat, msg.from, menuInicial());
  } catch (error) {
    // Permite uma nova tentativa caso o primeiro evento tenha falhado.
    if (idMensagem) mensagensProcessadas.delete(idMensagem);
    console.error("❌ Erro no processamento da mensagem:", error);
  }
}

client.on("message", processarMensagem);
client.on("message_create", processarMensagem);
