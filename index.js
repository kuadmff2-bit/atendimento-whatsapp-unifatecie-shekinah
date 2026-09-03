// =====================================
// IMPORTAÇÕES
// =====================================
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

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
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  },
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

client.initialize();

// =====================================
// FUNÇÕES AUXILIARES
// =====================================
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// As sessões ficam separadas por número de WhatsApp.
const sessoes = new Map();

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
client.on("message", async (msg) => {
  try {
    // Ignora mensagens próprias, grupos, status e outros formatos de conversa.
    if (msg.fromMe || !msg.from || !msg.from.endsWith("@c.us")) return;

    const chat = await msg.getChat();
    if (chat.isGroup) return;

    const textoOriginal = msg.body ? msg.body.trim() : "";
    if (!textoOriginal) return;

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
    console.error("❌ Erro no processamento da mensagem:", error);
  }
});

