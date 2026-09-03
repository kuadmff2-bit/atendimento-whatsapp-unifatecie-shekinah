// =====================================
// IMPORTAÇÕES
// =====================================
const wppconnect = require("@wppconnect-team/wppconnect");
const fs = require("fs");
const path = require("path");

// =====================================
// TEXTOS E VALORES EDITÁVEIS
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
// NAVEGADOR NO WINDOWS / WINDOWS ARM64
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

// =====================================
// SESSÕES DO ATENDIMENTO
// =====================================
const sessoes = new Map();
const mensagensProcessadas = new Set();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

function obterIdMensagem(msg) {
  if (typeof msg.id === "string") return msg.id;
  if (msg.id?._serialized) return msg.id._serialized;
  if (msg.msgId) return String(msg.msgId);
  return `${msg.from}:${msg.timestamp || Date.now()}:${msg.body || ""}`;
}

function mensagemJaProcessada(msg) {
  const id = obterIdMensagem(msg);
  if (mensagensProcessadas.has(id)) return true;

  mensagensProcessadas.add(id);
  const limpeza = setTimeout(() => mensagensProcessadas.delete(id), 2 * 60 * 1000);
  limpeza.unref();
  return false;
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

function primeiroNome(nomeCompleto) {
  return nomeCompleto.trim().split(/\s+/)[0];
}

function nomeValido(nome) {
  return nome.length >= 5 && nome.includes(" ") && /^[A-Za-zÀ-ÿ' -]+$/.test(nome);
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
  return (
    `Você está no atendimento: *${CONFIG[instituicao].nome}* ✅\n\n` +
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

async function responder(client, destino, mensagem) {
  await delay(900);
  await client.sendText(destino, mensagem);
}

// =====================================
// FUNIL DE ATENDIMENTO
// =====================================
async function processarMensagem(client, msg) {
  try {
    if (!msg || !msg.from || msg.fromMe || msg.isGroupMsg) return;
    if (mensagemJaProcessada(msg)) return;

    const remetente = msg.from.toLowerCase();
    if (
      remetente === "status@broadcast" ||
      remetente.endsWith("@g.us") ||
      remetente.endsWith("@broadcast") ||
      remetente.endsWith("@newsletter")
    ) {
      return;
    }

    const textoOriginal = typeof msg.body === "string" ? msg.body.trim() : "";
    if (!textoOriginal) return;

    const previa = textoOriginal.replace(/\s+/g, " ").slice(0, 80);
    console.log(`📩 Mensagem privada recebida de ${msg.from}: ${previa}`);

    const texto = limparTexto(textoOriginal);
    const comandoMenu = /^(menu|inicio|comecar|recomecar|oi|ola|bom dia|boa tarde|boa noite)$/.test(texto);

    if (comandoMenu) {
      sessoes.set(msg.from, novaSessao());
      await responder(client, msg.from, menuInicial());
      return;
    }

    const sessao = obterSessao(msg.from);
    if (sessao.atendimentoHumano) return;

    if (sessao.etapa === "escolher_instituicao") {
      if (texto === "1" || texto.includes("unifatecie")) {
        sessao.instituicao = "unifatecie";
        sessao.etapa = "menu_instituicao";
        await responder(client, msg.from, menuInstituicao("unifatecie"));
        return;
      }

      if (texto === "2" || texto.includes("shekinah")) {
        sessao.instituicao = "shekinah";
        sessao.etapa = "menu_instituicao";
        await responder(client, msg.from, menuInstituicao("shekinah"));
        return;
      }

      await responder(
        client,
        msg.from,
        "Não consegui identificar a instituição. 😊\n\nDigite:\n*1* para UniFatecie\n*2* para Shekinah"
      );
      return;
    }

    if (sessao.etapa === "menu_instituicao") {
      if (texto === "0") {
        sessao.etapa = "escolher_instituicao";
        sessao.instituicao = null;
        await responder(client, msg.from, menuInicial());
        return;
      }

      if (texto === "1") {
        await responder(
          client,
          msg.from,
          CONFIG[sessao.instituicao].cursos + orientacaoVoltar()
        );
        return;
      }

      if (texto === "2") {
        sessao.etapa = "matricula_nome";
        await responder(
          client,
          msg.from,
          "📝 *SOLICITAÇÃO DE MATRÍCULA*\n\nPara começar, informe o *nome completo do aluno*."
        );
        return;
      }

      if (texto === "3") {
        sessao.etapa = "financeiro_nome";
        await responder(
          client,
          msg.from,
          "💳 *FINANCEIRO E MENSALIDADES*\n\nInforme o *nome completo do aluno*."
        );
        return;
      }

      if (texto === "4") {
        sessao.atendimentoHumano = true;
        sessao.etapa = "atendimento_humano";
        await responder(
          client,
          msg.from,
          "👩‍💼 Pronto! Seu atendimento foi encaminhado.\n\nUm atendente responderá por esta mesma conversa assim que estiver disponível.\n\nSe quiser voltar ao atendimento automático, digite *menu*."
        );
        return;
      }

      await responder(
        client,
        msg.from,
        "Opção inválida. Digite um número de *1 a 4* ou *0* para trocar de instituição."
      );
      return;
    }

    if (sessao.etapa === "matricula_nome") {
      if (!nomeValido(textoOriginal)) {
        await responder(
          client,
          msg.from,
          "Por favor, informe o *nome completo do aluno*, com nome e sobrenome."
        );
        return;
      }

      sessao.nome = textoOriginal;
      sessao.etapa = "matricula_curso";
      await responder(
        client,
        msg.from,
        `Obrigado, ${primeiroNome(sessao.nome)}! 😊\n\nQual *curso* você deseja fazer?`
      );
      return;
    }

    if (sessao.etapa === "matricula_curso") {
      if (textoOriginal.length < 2 || textoOriginal.length > 100) {
        await responder(client, msg.from, "Digite o nome do curso desejado.");
        return;
      }

      sessao.curso = textoOriginal;
      sessao.atendimentoHumano = true;
      sessao.etapa = "atendimento_humano";

      await responder(
        client,
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

    if (sessao.etapa === "financeiro_nome") {
      if (!nomeValido(textoOriginal)) {
        await responder(
          client,
          msg.from,
          "Por favor, informe o *nome completo do aluno*, com nome e sobrenome."
        );
        return;
      }

      sessao.nome = textoOriginal;
      sessao.etapa = "financeiro_assunto";
      await responder(
        client,
        msg.from,
        "Conte resumidamente o que você precisa.\n\n" +
          "Exemplos: segunda via, vencimento, mensalidade em aberto ou confirmação de pagamento.\n\n" +
          "🔒 Não envie senha, código de acesso ou dados do cartão."
      );
      return;
    }

    if (sessao.etapa === "financeiro_assunto") {
      if (textoOriginal.length < 3 || textoOriginal.length > 500) {
        await responder(
          client,
          msg.from,
          "Descreva o pedido em uma mensagem de até 500 caracteres."
        );
        return;
      }

      sessao.atendimentoHumano = true;
      sessao.etapa = "atendimento_humano";

      await responder(
        client,
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

    sessoes.set(msg.from, novaSessao());
    await responder(client, msg.from, menuInicial());
  } catch (error) {
    console.error("❌ Erro no processamento da mensagem:", error);
  }
}

// =====================================
// INICIALIZAÇÃO DO WHATSAPP
// =====================================
async function iniciar() {
  try {
    if (caminhoNavegador) {
      console.log(`🌐 Navegador detectado: ${caminhoNavegador}`);
    }

    console.log("🚀 Iniciando atendimento pelo WPPConnect...");

    const puppeteerOptions = { timeout: 120000 };
    if (caminhoNavegador) puppeteerOptions.executablePath = caminhoNavegador;

    const client = await wppconnect.create({
      session: "atendimento-unifatecie-shekinah",
      headless: true,
      useChrome: true,
      logQR: true,
      autoClose: 0,
      deviceSyncTimeout: 0,
      waitForLogin: true,
      disableWelcome: true,
      updatesLog: true,
      puppeteerOptions,
      browserArgs: windows
        ? ["--disable-extensions", "--no-first-run", "--no-default-browser-check"]
        : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    console.log("✅ Tudo certo! WhatsApp conectado e atendimento ativo.");

    client.onMessage((msg) => processarMensagem(client, msg));

    client.onStateChange((estado) => {
      console.log(`🔄 Estado do WhatsApp: ${estado}`);
    });
  } catch (error) {
    console.error("❌ Não foi possível iniciar o atendimento:", error);
    process.exitCode = 1;
  }
}

iniciar();
