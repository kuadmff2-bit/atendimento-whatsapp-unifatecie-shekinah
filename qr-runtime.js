const fs = require("fs");
const path = require("path");
const http = require("http");

const PASTA_TOKENS = path.join(process.cwd(), "tokens");
const ARQUIVO_QR = path.join(PASTA_TOKENS, "qr-atual.png");

let estadoConexao = "iniciando";
let whatsappConectado = false;
let ultimoQrEm = null;
let ultimoStatusEm = null;

function garantirPasta() {
  fs.mkdirSync(PASTA_TOKENS, { recursive: true });
}

function removerQrAtual() {
  try {
    fs.rmSync(ARQUIVO_QR, { force: true });
  } catch (_) {}
}

function salvarQrComoPng(qr) {
  try {
    const valor = String(qr || "").trim();
    if (!valor) return false;

    const base64 = valor.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!base64 || base64.length < 100) return false;

    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return false;

    garantirPasta();
    const temporario = `${ARQUIVO_QR}.tmp`;
    fs.writeFileSync(temporario, buffer);
    fs.renameSync(temporario, ARQUIVO_QR);
    ultimoQrEm = new Date().toISOString();
    console.log(`🖼️ QR Code salvo para a página web (${buffer.length} bytes).`);
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível salvar o QR Code como PNG:", error?.message || error);
    return false;
  }
}

function registrarQr(qr, tentativa) {
  whatsappConectado = false;
  estadoConexao = `aguardando QR (tentativa ${tentativa || "?"})`;
  ultimoStatusEm = new Date().toISOString();
  const salvo = salvarQrComoPng(qr);
  console.log(`📲 Runtime recebeu QR | tentativa=${tentativa || "?"} | salvo=${salvo}`);
}

function registrarStatus(status) {
  const atual = String(status || "desconhecido");
  estadoConexao = atual;
  ultimoStatusEm = new Date().toISOString();

  if (["isLogged", "inChat"].includes(atual)) {
    whatsappConectado = true;
    removerQrAtual();
  } else if (
    [
      "notLogged",
      "qrReadFail",
      "disconnectedMobile",
      "deleteToken",
      "browserClose",
      "serverClose",
      "autocloseCalled",
    ].includes(atual)
  ) {
    whatsappConectado = false;
  }

  console.log(`🔎 Runtime QR recebeu status: ${atual}`);
}

function paginaQr() {
  const temQr = fs.existsSync(ARQUIVO_QR);
  let conteudo;

  if (whatsappConectado) {
    conteudo =
      '<div class="status sucesso">✅ WhatsApp conectado e pronto!</div>' +
      '<p>O atendimento automático já pode receber mensagens.</p>' +
      `<small>Estado: ${estadoConexao}</small>`;
  } else if (temQr) {
    conteudo =
      '<div class="status">📲 Escaneie o QR Code</div>' +
      `<img src="/qr.png?t=${Date.now()}" alt="QR Code do WhatsApp">` +
      '<p>WhatsApp → Aparelhos conectados → Conectar um aparelho</p>' +
      `<small>Estado atual: ${estadoConexao}. A página atualiza automaticamente.</small>`;
  } else {
    conteudo =
      '<div class="status">⏳ Preparando o QR Code...</div>' +
      '<p>Aguarde alguns segundos. O WhatsApp ainda não confirmou uma sessão ativa.</p>' +
      `<small>Estado atual: ${estadoConexao}</small>`;
  }

  const diagnostico =
    `<div class="diag">Último status: ${ultimoStatusEm || "ainda não recebido"}<br>` +
    `Último QR: ${ultimoQrEm || "ainda não recebido"}</div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="3">
  <title>Conectar WhatsApp</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b141a;color:#e9edef;font-family:Arial,sans-serif;padding:20px}
    main{width:min(100%,520px);background:#202c33;border:1px solid #34444d;border-radius:20px;padding:28px;text-align:center;box-shadow:0 18px 50px #0008}
    h1{font-size:25px;margin:0 0 22px}
    .status{font-size:21px;font-weight:700;margin-bottom:18px}
    .sucesso{color:#25d366}
    img{display:block;width:min(100%,400px);height:auto;aspect-ratio:1/1;object-fit:contain;margin:0 auto 20px;background:white;padding:18px;border-radius:14px;image-rendering:pixelated}
    p{line-height:1.5;color:#d1d7db}
    small{color:#8696a0}
    .diag{margin-top:18px;padding-top:14px;border-top:1px solid #34444d;color:#8696a0;font-size:12px;line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>Atendimento UniFatecie e Shekinah</h1>
    ${conteudo}
    ${diagnostico}
  </main>
</body>
</html>`;
}

function responderQrPng(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!fs.existsSync(ARQUIVO_QR)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("QR Code ainda não disponível.");
    return;
  }

  res.writeHead(200, { "Content-Type": "image/png" });
  fs.createReadStream(ARQUIVO_QR).pipe(res);
}

function responderPaginaQr(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(paginaQr());
}

removerQrAtual();
console.log("🧩 Runtime de QR carregado.");

// A exportação `create` do WPPConnect pode não aceitar sobrescrita direta.
// Por isso substituímos a exportação do módulo no cache do Node por um Proxy.
// Todo require() posterior recebe esse Proxy e, portanto, os callbacks reais
// catchQR/statusFind passam obrigatoriamente por este runtime.
try {
  const caminhoModulo = require.resolve("@wppconnect-team/wppconnect");
  const wppconnectOriginal = require(caminhoModulo);
  const criarOriginal = wppconnectOriginal.create.bind(wppconnectOriginal);

  const criarInterceptado = (opcoes = {}) => {
    const catchQrOriginal = opcoes.catchQR;
    const statusOriginal = opcoes.statusFind;

    return criarOriginal({
      ...opcoes,
      catchQR: (qr, asciiQR, tentativa, urlCode) => {
        registrarQr(qr, tentativa);
        if (typeof catchQrOriginal === "function") {
          return catchQrOriginal(qr, asciiQR, tentativa, urlCode);
        }
      },
      statusFind: (status, sessao) => {
        registrarStatus(status);
        if (typeof statusOriginal === "function") {
          return statusOriginal(status, sessao);
        }
      },
    });
  };

  const proxy = new Proxy(wppconnectOriginal, {
    get(alvo, propriedade, receptor) {
      if (propriedade === "create") return criarInterceptado;
      return Reflect.get(alvo, propriedade, receptor);
    },
  });

  if (require.cache[caminhoModulo]) {
    require.cache[caminhoModulo].exports = proxy;
  }

  console.log("🪝 Captura de QR/status instalada via Proxy do módulo WPPConnect.");
} catch (error) {
  console.error("❌ Não foi possível instalar a captura do QR:", error?.message || error);
}

// Intercepta as requisições no nível do servidor HTTP.
const emitirOriginal = http.Server.prototype.emit;
http.Server.prototype.emit = function emitirComRotasQr(evento, ...args) {
  if (evento === "request") {
    const [req, res] = args;
    let pathname = "/";

    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch (_) {}

    if (pathname === "/qr.png") {
      responderQrPng(res);
      return true;
    }

    if (pathname === "/" || pathname === "/qr-view") {
      responderPaginaQr(res);
      return true;
    }
  }

  return emitirOriginal.call(this, evento, ...args);
};
