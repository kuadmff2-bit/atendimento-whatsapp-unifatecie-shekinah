const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const wppconnect = require('@wppconnect-team/wppconnect');

const API_BASE = String(process.env.LANCHONETE_ROBOT_API_BASE || 'https://lanchonete-site.kuadmff2.workers.dev').replace(/\/$/, '');
const API_TOKEN = String(process.env.LANCHONETE_ROBOT_WEBHOOK_TOKEN || '');
const QR_TOKEN = String(process.env.LANCHONETE_QR_TOKEN || crypto.randomBytes(20).toString('hex'));
const SESSION_NAME = String(process.env.LANCHONETE_WPP_SESSION || 'lanchonete-whatsapp');
const TOKEN_DIR = path.join(process.env.LANCHONETE_TOKEN_DIR || '/app/tokens', 'lanchonete');
const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/chromium';

let client = null;
let connected = false;
let qrImage = null;
let state = 'starting';
let lastError = '';
let starting = false;
let retryTimer = null;

fs.mkdirSync(TOKEN_DIR, { recursive: true });

function publicBase() {
  return process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:8080';
}

function statusObject() {
  return {
    ok: true,
    connected,
    state,
    qrReady: Boolean(qrImage),
    session: SESSION_NAME,
    apiBase: API_BASE,
    lastError: lastError || null,
  };
}

function qrHtml() {
  let body;
  if (connected) {
    body = '<div class="ok">✅ WhatsApp da lanchonete conectado</div><p>O robô já está pronto para responder os clientes.</p>';
  } else if (qrImage) {
    body = `<div class="title">📲 Conectar WhatsApp da lanchonete</div><img src="${qrImage}" alt="QR Code"><p>WhatsApp → Aparelhos conectados → Conectar um aparelho</p><small>A página atualiza automaticamente.</small>`;
  } else {
    body = '<div class="title">⏳ Preparando QR Code...</div><p>Aguarde alguns segundos.</p>';
  }

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>Robô da lanchonete</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0d;color:#fff;font-family:Arial,sans-serif;padding:20px}main{width:min(100%,460px);padding:28px;background:#181818;border:1px solid #333;border-radius:20px;text-align:center}.title,.ok{font-size:21px;font-weight:800;margin-bottom:18px}.ok{color:#25d366}img{display:block;width:min(100%,340px);height:auto;margin:0 auto 18px;background:#fff;padding:12px;border-radius:14px}p{color:#ccc;line-height:1.5}small{color:#888}</style></head><body><main>${body}</main></body></html>`;
}

// Acrescenta rotas da lanchonete ao mesmo servidor HTTP do bot existente,
// sem abrir uma segunda porta no Railway.
const originalCreateServer = http.createServer.bind(http);
http.createServer = function patchedCreateServer(listener) {
  return originalCreateServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/lanchonete/status') {
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(statusObject()));
        return;
      }

      if (url.pathname === `/lanchonete/qr/${QR_TOKEN}`) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(qrHtml());
        return;
      }
    } catch (_) {}

    return listener(req, res);
  });
};

function phoneFromMessage(msg) {
  const candidates = [msg?.sender?.id?.user, msg?.sender?.id?._serialized, msg?.from].filter(Boolean);
  for (const candidate of candidates) {
    let digits = String(candidate).split('@')[0].replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (/^55\d{10,11}$/.test(digits)) return digits;
  }
  return '';
}

function ignoreMessage(msg) {
  const from = String(msg?.from || '');
  return !from || Boolean(msg?.fromMe) || Boolean(msg?.isGroupMsg) || from.endsWith('@g.us') || from === 'status@broadcast' || from.endsWith('@broadcast');
}

async function processMessage(msg) {
  if (!client || ignoreMessage(msg)) return;
  const message = String(msg?.body || '').trim();
  if (!message) return;

  try {
    const headers = { 'content-type': 'application/json' };
    if (API_TOKEN) headers['x-robot-token'] = API_TOKEN;

    const response = await fetch(`${API_BASE}/api/robot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contactId: String(msg.from || phoneFromMessage(msg)),
        phone: phoneFromMessage(msg),
        message,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    if (data?.disabled) return;

    const reply = String(data?.reply || '').trim();
    if (reply) {
      await client.sendText(msg.from, reply);
      console.log(`🍔 Robô lanchonete respondeu ${phoneFromMessage(msg) || msg.from} (${data?.state || 'sem estado'}).`);
    }
  } catch (error) {
    lastError = String(error?.message || error);
    console.error('❌ Robô lanchonete - mensagem:', lastError);
  }
}

function clearChromiumLocks() {
  const names = new Set(['SingletonLock', 'SingletonSocket', 'SingletonCookie']);
  const stack = [TOKEN_DIR];
  try {
    while (stack.length) {
      const current = stack.pop();
      if (!fs.existsSync(current)) continue;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const target = path.join(current, entry.name);
        if (names.has(entry.name)) fs.rmSync(target, { recursive: true, force: true });
        else if (entry.isDirectory()) stack.push(target);
      }
    }
  } catch (error) {
    console.warn('⚠️ Robô lanchonete - limpeza de trava:', error.message);
  }
}

function retryLater() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startSession();
  }, 15000);
  retryTimer.unref();
}

async function startSession() {
  if (starting) return;
  starting = true;
  connected = false;
  state = 'starting';
  lastError = '';

  try {
    clearChromiumLocks();
    const puppeteerOptions = { timeout: 120000 };
    if (fs.existsSync(CHROME_PATH)) puppeteerOptions.executablePath = CHROME_PATH;

    client = await wppconnect.create({
      session: SESSION_NAME,
      catchQR: (base64Qrimg, _asciiQR, attempts) => {
        qrImage = String(base64Qrimg).startsWith('data:image') ? base64Qrimg : `data:image/png;base64,${base64Qrimg}`;
        connected = false;
        state = 'qr';
        console.log(`📲 QR da lanchonete atualizado (tentativa ${attempts}).`);
      },
      statusFind: (statusSession) => {
        state = String(statusSession || 'unknown');
        if (['isLogged', 'qrReadSuccess', 'inChat'].includes(statusSession)) {
          connected = true;
          qrImage = null;
        }
        console.log(`🍔 Estado WhatsApp lanchonete: ${state}`);
      },
      headless: true,
      devtools: false,
      useChrome: true,
      debug: false,
      logQR: false,
      autoClose: 0,
      deviceSyncTimeout: 0,
      waitForLogin: true,
      disableWelcome: true,
      updatesLog: true,
      tokenStore: 'file',
      folderNameToken: TOKEN_DIR,
      puppeteerOptions,
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run'],
    });

    connected = true;
    qrImage = null;
    state = 'inChat';
    console.log('✅ WhatsApp da lanchonete conectado.');
    client.onMessage(processMessage);
    client.onStateChange((nextState) => {
      state = String(nextState || 'unknown');
      console.log(`🔄 Estado da sessão lanchonete: ${state}`);
      if (/UNPAIRED|CONFLICT|UNLAUNCHED|DISCONNECTED|NOT_LOGGED/i.test(state)) connected = false;
    });
  } catch (error) {
    lastError = String(error?.message || error);
    connected = false;
    state = 'error';
    console.error('❌ Não foi possível iniciar WhatsApp da lanchonete:', lastError);
    retryLater();
  } finally {
    starting = false;
  }
}

setTimeout(() => {
  console.log(`🔐 QR da lanchonete: ${publicBase()}/lanchonete/qr/${QR_TOKEN}`);
  startSession();
}, 6000).unref();
