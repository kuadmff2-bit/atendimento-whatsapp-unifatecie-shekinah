// =====================================
// IMPORTAÇÕES
// =====================================
const wppconnect = require("@wppconnect-team/wppconnect");
const fs = require("fs");
const path = require("path");
const http = require("http");
const crypto = require("crypto");

// =====================================
// TEXTOS E VALORES EDITÁVEIS
// =====================================
const CONFIG = {
  nomeAtendimento: "Atendimento UniFatecie e Centro Educacional Shekinah",

  unifatecie: {
    nome: "UniFatecie — Polo Barreirinha",
    cursos:
      "🎓 *CURSOS E VALORES — UNIFATECIE*\n\n" +
      "Estude de onde estiver com cursos de graduação *100% EAD*. Temos opções como:\n\n" +
      "📘 Pedagogia\n" +
      "📊 Administração\n" +
      "💻 Análise e Desenvolvimento de Sistemas\n" +
      "🧑‍💻 Engenharia de Software\n" +
      "💰 Gestão Financeira\n" +
      "🎓 Além de diversas licenciaturas, bacharelados e tecnólogos.\n\n" +
      "💵 Mensalidades a partir de *R$ 112,20*.\n" +
      "O valor pode variar conforme o curso e a campanha vigente.\n\n" +
      "⚠️ *ATENÇÃO:* cursos da área da Saúde não podem ser oferecidos em nosso Polo de Barreirinha.\n\n" +
      "Quer consultar a disponibilidade de um curso e iniciar sua matrícula? Digite *2*.",
  },

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
      "3 cursos — *R$ 280/mês*\n\n" +
      "Para iniciar sua matrícula, digite *2*.",
  },
};

// =====================================
// NAVEGADOR NO WINDOWS, LINUX E DOCKER
// =====================================
const windows = process.platform === "win32";

function encontrarNavegador() {
  const candidatos = [
    process.env.CHROME_PATH,
    windows && process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    windows && process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    windows && process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    windows && process.env.PROGRAMFILES &&
      path.join(process.env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
    windows && process.env["PROGRAMFILES(X86)"] &&
      path.join(process.env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    windows && process.env.LOCALAPPDATA &&
      path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
    !windows && "/usr/bin/chromium",
    !windows && "/usr/bin/chromium-browser",
    !windows && "/usr/bin/google-chrome",
    !windows && "/usr/bin/google-chrome-stable",
  ].filter(Boolean);

  return candidatos.find((caminho) => fs.existsSync(caminho)) || null;
}

const caminhoNavegador = encontrarNavegador();

// =====================================
// PÁGINA SEGURA DO QR CODE
// =====================================
let qrCodeImagem = null;
let whatsappConectado = false;
const acessoQr = process.env.QR_ACCESS_TOKEN || crypto.randomBytes(18).toString("hex");

function criarPaginaQr() {
  let conteudo;

  if (whatsappConectado) {
    conteudo =
      '<div class="status sucesso">✅ WhatsApp conectado!</div>' +
      "<p>O atendimento já está funcionando. Você pode fechar esta página.</p>";
  } else if (qrCodeImagem) {
    conteudo =
      '<div class="status">📲 Escaneie o QR Code</div>' +
      '<img src="' + qrCodeImagem + '" alt="QR Code para conectar o WhatsApp">' +
      "<p>WhatsApp Business → Aparelhos conectados → Conectar um aparelho</p>" +
      "<small>Esta página atualiza automaticamente.</small>";
  } else {
    conteudo =
      '<div class="status">⏳ Preparando o QR Code...</div>' +
      "<p>Aguarde alguns segundos. Esta página atualizará automaticamente.</p>";
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="5">
  <title>Conectar WhatsApp</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b141a;color:#e9edef;font-family:Arial,sans-serif;padding:20px}
    main{width:min(100%,460px);background:#202c33;border:1px solid #34444d;border-radius:20px;padding:28px;text-align:center;box-shadow:0 18px 50px #0008}
    h1{font-size:25px;margin:0 0 22px}
    .status{font-size:20px;font-weight:700;margin-bottom:18px}
    .sucesso{color:#25d366}
    img{display:block;width:min(100%,340px);height:auto;margin:0 auto 20px;background:#fff;padding:14px;border-radius:12px}
    p{line-height:1.5;color:#d1d7db}
    small{color:#8696a0}
  </style>
</head>
<body>
  <main>
    <h1>Atendimento UniFatecie e Shekinah</h1>
    ${conteudo}
  </main>
</body>
</html>`;
}

function iniciarServidorQr() {
  const porta = Number(process.env.PORT || 3000);
  const caminhoQr = `/qr/${acessoQr}`;

  const servidor = http.createServer((req, res) => {
    const caminhoSolicitado = new URL(req.url, "http://localhost").pathname;

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");

    if (caminhoSolicitado !== "/" && caminhoSolicitado !== caminhoQr) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Página não encontrada.");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(criarPaginaQr());
  });

  servidor.listen(porta, "0.0.0.0", () => {
    const dominio = process.env.RAILWAY_PUBLIC_DOMAIN;
    const endereco = dominio
      ? `https://${dominio}${caminhoQr}`
      : `http://localhost:${porta}${caminhoQr}`;

    console.log(`🔐 Página segura do QR Code: ${endereco}`);
  });
}

iniciarServidorQr();

function removerTravasAntigasDoChromium() {
  if (windows) return;

  const pastaTokens = path.join(process.cwd(), "tokens");
  const nomesTrava = new Set(["SingletonLock", "SingletonSocket", "SingletonCookie"]);
  const pastasPendentes = [pastaTokens];
  let removidas = 0;

  try {
    if (!fs.existsSync(pastaTokens)) return;

    while (pastasPendentes.length > 0) {
      const pastaAtual = pastasPendentes.pop();
      const itens = fs.readdirSync(pastaAtual, { withFileTypes: true });

      for (const item of itens) {
        const caminhoItem = path.join(pastaAtual, item.name);

        if (nomesTrava.has(item.name)) {
          fs.rmSync(caminhoItem, { recursive: true, force: true });
          removidas += 1;
        } else if (item.isDirectory()) {
          pastasPendentes.push(caminhoItem);
        }
      }
    }

    if (removidas > 0) {
      console.log(`🧹 ${removidas} trava(s) antiga(s) do Chromium removida(s).`);
    }
  } catch (error) {
    console.warn("⚠️ Não foi possível limpar uma trava antiga do Chromium:", error.message);
  }
}

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
    dados: {},
    menorDeIdade: false,
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

function somenteNumeros(valor = "") {
  return valor.replace(/\D/g, "");
}

function formatarCpf(valor) {
  const cpf = somenteNumeros(valor);
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function cpfValido(valor) {
  const cpf = somenteNumeros(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (quantidade) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i += 1) {
      soma += Number(cpf[i]) * (quantidade + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

function dataNascimentoValida(valor) {
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!correspondencia) return null;

  const dia = Number(correspondencia[1]);
  const mes = Number(correspondencia[2]);
  const ano = Number(correspondencia[3]);
  const data = new Date(ano, mes - 1, dia, 12, 0, 0);
  const agora = new Date();

  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia ||
    data > agora ||
    ano < 1900
  ) {
    return null;
  }

  return data;
}

function verificarMenorDeIdade(dataNascimento) {
  const hoje = new Date();
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const aniversarioAindaNaoPassou =
    hoje.getMonth() < dataNascimento.getMonth() ||
    (hoje.getMonth() === dataNascimento.getMonth() && hoje.getDate() < dataNascimento.getDate());
  if (aniversarioAindaNaoPassou) idade -= 1;
  return idade < 18;
}

function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) && valor.length <= 120;
}

function telefoneValido(valor) {
  const telefone = somenteNumeros(valor);
  return telefone.length >= 10 && telefone.length <= 13;
}

function cepValido(valor) {
  return somenteNumeros(valor).length === 8;
}

function formatarCep(valor) {
  return somenteNumeros(valor).replace(/(\d{5})(\d{3})/, "$1-$2");
}

function textoDentroDoLimite(valor, minimo, maximo) {
  return valor.length >= minimo && valor.length <= maximo;
}

function mensagemPrivacidade(instituicao) {
  return (
    `📝 *PRÉ-MATRÍCULA — ${CONFIG[instituicao].nome.toUpperCase()}*\n\n` +
    "Vou pedir os dados necessários, um de cada vez. Eles serão usados somente pela secretaria para atender sua matrícula.\n\n" +
    "Você pode digitar *menu* a qualquer momento para cancelar e voltar ao início.\n\n" +
    "Para continuar, informe o *curso desejado*."
  );
}

function finalizarMatriculaUnifatecie(sessao) {
  const d = sessao.dados;
  return (
    "✅ *PRÉ-MATRÍCULA RECEBIDA — UNIFATECIE*\n\n" +
    "👤 *Dados pessoais*\n" +
    `Nome completo: ${d.nome}\n` +
    `CPF: ${d.cpf}\n` +
    `Data de nascimento: ${d.nascimento}\n` +
    `E-mail: ${d.email}\n` +
    `Telefone/WhatsApp: ${d.telefone}\n\n` +
    "🏠 *Endereço*\n" +
    `Rua/Avenida: ${d.rua}\n` +
    `Número: ${d.numero}\n` +
    `Bairro: ${d.bairro}\n` +
    `Cidade: ${d.cidade}\n` +
    `Estado: ${d.estado}\n` +
    `CEP: ${d.cep}\n\n` +
    `📚 Curso desejado: ${d.curso}\n` +
    `📅 Vencimento escolhido: dia ${d.vencimento}\n\n` +
    "Agora um atendente conferirá os dados e continuará a matrícula por esta conversa.\n" +
    "Para voltar ao atendimento automático, digite *menu*."
  );
}

function finalizarMatriculaShekinah(sessao) {
  const d = sessao.dados;
  return (
    "✅ *PRÉ-MATRÍCULA RECEBIDA — SHEKINAH*\n\n" +
    `📚 Curso(s): ${d.curso}\n` +
    `👤 Nome completo: ${d.nome}\n` +
    `📅 Data de nascimento: ${d.nascimento}\n` +
    `🪪 CPF: ${d.cpf}\n` +
    `🪪 RG ou CIN: ${d.rg}\n` +
    `📱 Telefone principal: ${d.telefone}\n` +
    `☎️ Segundo telefone: ${d.telefone2}\n` +
    `🏠 Endereço completo: ${d.endereco}\n` +
    `🧒 Aluno menor de 18 anos: ${sessao.menorDeIdade ? "Sim" : "Não"}\n` +
    (sessao.menorDeIdade
      ? `👨 CPF do pai: ${d.cpfPai}\n👩 CPF da mãe: ${d.cpfMae}\n`
      : "") +
    "\nAgora a secretaria conferirá os dados e continuará a matrícula por esta conversa.\n" +
    "Para voltar ao atendimento automático, digite *menu*."
  );
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

async function processarMatriculaUnifatecie(client, msg, textoOriginal, sessao) {
  const d = sessao.dados;

  if (sessao.etapa === "unifatecie_matricula_curso") {
    if (!textoDentroDoLimite(textoOriginal, 2, 100)) {
      await responder(client, msg.from, "Digite o nome do curso desejado.");
      return true;
    }

    const curso = limparTexto(textoOriginal);
    const termosSaude = [
      "enfermagem", "farmacia", "biomedicina", "fisioterapia", "nutricao",
      "odontologia", "medicina", "terapia ocupacional", "fonoaudiologia",
      "radiologia", "estetica", "educacao fisica",
    ];
    if (termosSaude.some((termo) => curso.includes(termo))) {
      await responder(
        client,
        msg.from,
        "⚠️ Esse curso pertence à área da Saúde e não pode ser oferecido em nosso Polo de Barreirinha.\n\n" +
          "Você pode informar outro curso ou digitar *menu* para voltar ao início."
      );
      return true;
    }

    d.curso = textoOriginal;
    sessao.etapa = "unifatecie_matricula_nome";
    await responder(client, msg.from, "👤 *Dados pessoais*\n\nInforme o *nome completo* do aluno.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_nome") {
    if (!nomeValido(textoOriginal)) {
      await responder(client, msg.from, "Informe o nome completo, com nome e sobrenome.");
      return true;
    }
    d.nome = textoOriginal;
    sessao.nome = textoOriginal;
    sessao.etapa = "unifatecie_matricula_cpf";
    await responder(client, msg.from, `Obrigado, ${primeiroNome(d.nome)}! 😊\n\nInforme o *CPF* do aluno.`);
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_cpf") {
    if (!cpfValido(textoOriginal)) {
      await responder(client, msg.from, "CPF inválido. Digite os *11 números do CPF*.");
      return true;
    }
    d.cpf = formatarCpf(textoOriginal);
    sessao.etapa = "unifatecie_matricula_nascimento";
    await responder(client, msg.from, "Informe a *data de nascimento* no formato *DD/MM/AAAA*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_nascimento") {
    if (!dataNascimentoValida(textoOriginal)) {
      await responder(client, msg.from, "Data inválida. Digite no formato *DD/MM/AAAA*.");
      return true;
    }
    d.nascimento = textoOriginal;
    sessao.etapa = "unifatecie_matricula_email";
    await responder(client, msg.from, "Informe o *e-mail* do aluno.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_email") {
    if (!emailValido(textoOriginal)) {
      await responder(client, msg.from, "E-mail inválido. Digite um endereço como *nome@exemplo.com*.");
      return true;
    }
    d.email = textoOriginal.toLowerCase();
    sessao.etapa = "unifatecie_matricula_telefone";
    await responder(client, msg.from, "Informe o *telefone/WhatsApp com DDD*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_telefone") {
    if (!telefoneValido(textoOriginal)) {
      await responder(client, msg.from, "Telefone inválido. Digite o número com DDD.");
      return true;
    }
    d.telefone = textoOriginal;
    sessao.etapa = "unifatecie_matricula_rua";
    await responder(client, msg.from, "🏠 *Endereço*\n\nInforme a *Rua ou Avenida*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_rua") {
    if (!textoDentroDoLimite(textoOriginal, 2, 120)) {
      await responder(client, msg.from, "Informe o nome da Rua ou Avenida em até 120 caracteres.");
      return true;
    }
    d.rua = textoOriginal;
    sessao.etapa = "unifatecie_matricula_numero";
    await responder(client, msg.from, "Informe o *número* do endereço. Se não houver, digite *S/N*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_numero") {
    if (!textoDentroDoLimite(textoOriginal, 1, 20)) {
      await responder(client, msg.from, "Informe um número válido ou digite *S/N*.");
      return true;
    }
    d.numero = textoOriginal;
    sessao.etapa = "unifatecie_matricula_bairro";
    await responder(client, msg.from, "Informe o *bairro*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_bairro") {
    if (!textoDentroDoLimite(textoOriginal, 2, 80)) {
      await responder(client, msg.from, "Informe um bairro válido.");
      return true;
    }
    d.bairro = textoOriginal;
    sessao.etapa = "unifatecie_matricula_cidade";
    await responder(client, msg.from, "Informe a *cidade*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_cidade") {
    if (!textoDentroDoLimite(textoOriginal, 2, 80)) {
      await responder(client, msg.from, "Informe uma cidade válida.");
      return true;
    }
    d.cidade = textoOriginal;
    sessao.etapa = "unifatecie_matricula_estado";
    await responder(client, msg.from, "Informe o *Estado* ou a sigla, por exemplo: *Amazonas* ou *AM*.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_estado") {
    if (!/^[A-Za-zÀ-ÿ ]{2,30}$/.test(textoOriginal)) {
      await responder(client, msg.from, "Informe um Estado válido, por exemplo: *Amazonas* ou *AM*.");
      return true;
    }
    d.estado = textoOriginal.toUpperCase();
    sessao.etapa = "unifatecie_matricula_cep";
    await responder(client, msg.from, "Informe o *CEP* com 8 números.");
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_cep") {
    if (!cepValido(textoOriginal)) {
      await responder(client, msg.from, "CEP inválido. Digite os *8 números do CEP*.");
      return true;
    }
    d.cep = formatarCep(textoOriginal);
    sessao.etapa = "unifatecie_matricula_vencimento";
    await responder(
      client,
      msg.from,
      "💳 *Escolha o dia de vencimento da mensalidade:*\n\n" +
        "1️⃣ Dia 05\n" +
        "2️⃣ Dia 07\n" +
        "3️⃣ Dia 10\n\n" +
        "Digite apenas *1*, *2* ou *3*."
    );
    return true;
  }

  if (sessao.etapa === "unifatecie_matricula_vencimento") {
    const vencimentos = { "1": "05", "2": "07", "3": "10", "05": "05", "07": "07", "10": "10" };
    if (!vencimentos[textoOriginal]) {
      await responder(client, msg.from, "Opção inválida. Digite *1* para dia 05, *2* para dia 07 ou *3* para dia 10.");
      return true;
    }
    d.vencimento = vencimentos[textoOriginal];
    sessao.atendimentoHumano = true;
    sessao.etapa = "atendimento_humano";
    await responder(client, msg.from, finalizarMatriculaUnifatecie(sessao));
    return true;
  }

  return false;
}

async function processarMatriculaShekinah(client, msg, textoOriginal, sessao) {
  const d = sessao.dados;
  const texto = limparTexto(textoOriginal);

  if (sessao.etapa === "shekinah_matricula_curso") {
    if (!textoDentroDoLimite(textoOriginal, 2, 150)) {
      await responder(client, msg.from, "Informe o curso ou os cursos desejados.");
      return true;
    }
    d.curso = textoOriginal;
    sessao.etapa = "shekinah_matricula_nome";
    await responder(client, msg.from, "👤 Informe o *nome completo* do aluno.");
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_nome") {
    if (!nomeValido(textoOriginal)) {
      await responder(client, msg.from, "Informe o nome completo, com nome e sobrenome.");
      return true;
    }
    d.nome = textoOriginal;
    sessao.nome = textoOriginal;
    sessao.etapa = "shekinah_matricula_nascimento";
    await responder(client, msg.from, `Obrigado, ${primeiroNome(d.nome)}! 😊\n\nInforme a *data de nascimento* no formato *DD/MM/AAAA*.`);
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_nascimento") {
    const nascimento = dataNascimentoValida(textoOriginal);
    if (!nascimento) {
      await responder(client, msg.from, "Data inválida. Digite no formato *DD/MM/AAAA*.");
      return true;
    }
    d.nascimento = textoOriginal;
    sessao.menorDeIdade = verificarMenorDeIdade(nascimento);
    sessao.etapa = "shekinah_matricula_cpf";
    await responder(client, msg.from, "Informe o *CPF* do aluno.");
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_cpf") {
    if (!cpfValido(textoOriginal)) {
      await responder(client, msg.from, "CPF inválido. Digite os *11 números do CPF*.");
      return true;
    }
    d.cpf = formatarCpf(textoOriginal);
    sessao.etapa = "shekinah_matricula_rg";
    await responder(
      client,
      msg.from,
      "Informe o *RG ou a nova Carteira de Identidade Nacional (CIN)*.\n\n" +
        "Na nova identidade, o número pode ser o mesmo do CPF."
    );
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_rg") {
    if (!textoDentroDoLimite(textoOriginal, 5, 20)) {
      await responder(client, msg.from, "Informe um RG ou CIN válido, com no máximo 20 caracteres.");
      return true;
    }
    d.rg = textoOriginal;
    sessao.etapa = "shekinah_matricula_telefone";
    await responder(client, msg.from, "Informe o *telefone principal com DDD*.");
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_telefone") {
    if (!telefoneValido(textoOriginal)) {
      await responder(client, msg.from, "Telefone inválido. Digite o número com DDD.");
      return true;
    }
    d.telefone = textoOriginal;
    sessao.etapa = "shekinah_matricula_telefone2";
    await responder(
      client,
      msg.from,
      "Informe um *segundo telefone com DDD*. Se não quiser informar, digite *não*."
    );
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_telefone2") {
    if (["nao", "pular", "nenhum"].includes(texto)) {
      d.telefone2 = "Não informado";
    } else if (telefoneValido(textoOriginal)) {
      d.telefone2 = textoOriginal;
    } else {
      await responder(client, msg.from, "Digite um telefone com DDD ou responda *não*.");
      return true;
    }
    sessao.etapa = "shekinah_matricula_endereco";
    await responder(client, msg.from, "Informe o *endereço completo*: rua, número, bairro ou comunidade.");
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_endereco") {
    if (!textoDentroDoLimite(textoOriginal, 5, 180)) {
      await responder(client, msg.from, "Informe o endereço completo em até 180 caracteres.");
      return true;
    }
    d.endereco = textoOriginal;
    if (sessao.menorDeIdade) {
      sessao.etapa = "shekinah_matricula_cpf_pai";
      await responder(
        client,
        msg.from,
        "🧒 Como o aluno tem menos de 18 anos, precisamos dos dados dos responsáveis.\n\nInforme o *CPF do pai*."
      );
      return true;
    }

    sessao.atendimentoHumano = true;
    sessao.etapa = "atendimento_humano";
    await responder(client, msg.from, finalizarMatriculaShekinah(sessao));
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_cpf_pai") {
    if (!cpfValido(textoOriginal)) {
      await responder(client, msg.from, "CPF inválido. Digite os *11 números do CPF do pai*.");
      return true;
    }
    d.cpfPai = formatarCpf(textoOriginal);
    sessao.etapa = "shekinah_matricula_cpf_mae";
    await responder(client, msg.from, "Agora informe o *CPF da mãe*.");
    return true;
  }

  if (sessao.etapa === "shekinah_matricula_cpf_mae") {
    if (!cpfValido(textoOriginal)) {
      await responder(client, msg.from, "CPF inválido. Digite os *11 números do CPF da mãe*.");
      return true;
    }
    d.cpfMae = formatarCpf(textoOriginal);
    sessao.atendimentoHumano = true;
    sessao.etapa = "atendimento_humano";
    await responder(client, msg.from, finalizarMatriculaShekinah(sessao));
    return true;
  }

  return false;
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

    console.log(`📩 Mensagem privada recebida de ${msg.from}`);

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
        sessao.dados = {};
        sessao.menorDeIdade = false;
        sessao.etapa =
          sessao.instituicao === "unifatecie"
            ? "unifatecie_matricula_curso"
            : "shekinah_matricula_curso";
        await responder(
          client,
          msg.from,
          mensagemPrivacidade(sessao.instituicao)
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

    if (sessao.etapa.startsWith("unifatecie_matricula_")) {
      if (await processarMatriculaUnifatecie(client, msg, textoOriginal, sessao)) return;
    }

    if (sessao.etapa.startsWith("shekinah_matricula_")) {
      if (await processarMatriculaShekinah(client, msg, textoOriginal, sessao)) return;
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
    removerTravasAntigasDoChromium();

    const puppeteerOptions = { timeout: 120000 };
    if (caminhoNavegador) puppeteerOptions.executablePath = caminhoNavegador;

    const client = await wppconnect.create({
      session: "atendimento-unifatecie-shekinah",
      catchQR: (base64Qrimg, _asciiQR, attempts) => {
        qrCodeImagem = base64Qrimg.startsWith("data:image")
          ? base64Qrimg
          : `data:image/png;base64,${base64Qrimg}`;
        whatsappConectado = false;
        console.log(`📲 QR Code atualizado (tentativa ${attempts}). Abra a página segura acima.`);
      },
      statusFind: (statusSession) => {
        if (["isLogged", "qrReadSuccess", "inChat"].includes(statusSession)) {
          whatsappConectado = true;
          qrCodeImagem = null;
        }
        console.log(`🔐 Estado da autenticação: ${statusSession}`);
      },
      headless: true,
      useChrome: true,
      logQR: false,
      autoClose: 0,
      deviceSyncTimeout: 0,
      waitForLogin: true,
      disableWelcome: true,
      updatesLog: true,
      tokenStore: "file",
      folderNameToken: path.join(process.cwd(), "tokens"),
      puppeteerOptions,
      browserArgs: windows
        ? ["--disable-extensions", "--no-first-run", "--no-default-browser-check"]
        : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    whatsappConectado = true;
    qrCodeImagem = null;
    console.log("✅ Tudo certo! WhatsApp conectado e atendimento ativo.");

    client.onMessage((msg) => processarMensagem(client, msg));

    client.onStateChange((estado) => {
      console.log(`🔄 Estado do WhatsApp: ${estado}`);
    });
  } catch (error) {
    console.error("❌ Não foi possível iniciar o atendimento:", error);
    setTimeout(() => process.exit(1), 1500);
  }
}

iniciar();
