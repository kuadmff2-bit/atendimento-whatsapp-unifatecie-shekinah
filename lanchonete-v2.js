const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const wppconnect = require('@wppconnect-team/wppconnect');

console.log('🍔 Módulo da lanchonete carregado no processo principal.');

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
let retry = null;
let starting = false;
const processedMessages = new Map();

fs.mkdirSync(TOKEN_DIR, { recursive: true });

function baseUrl() {
  return process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:8080';
}

function statusJson() {
  return { ok: true, connected, state, qrReady: !!qrImage, session: SESSION_NAME, lastError: lastError || null };
}

function qrHtml() {
  const content = connected
    ? '<div class="ok">✅ WhatsApp da lanchonete conectado</div><p>O robô já está pronto para atender.</p>'
    : qrImage
      ? `<div class="title">📲 Conectar WhatsApp da lanchonete</div><img src="${qrImage}" alt="QR Code"><p>WhatsApp → Aparelhos conectados → Conectar um aparelho</p><small>A página atualiza automaticamente.</small>`
      : '<div class="title">⏳ Preparando QR Code...</div><p>Aguarde alguns segundos.</p>';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>WhatsApp da lanchonete</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0d0d;color:#fff;font-family:Arial,sans-serif;padding:20px}main{width:min(100%,460px);padding:28px;background:#181818;border:1px solid #333;border-radius:20px;text-align:center}.title,.ok{font-size:21px;font-weight:800;margin-bottom:18px}.ok{color:#25d366}img{display:block;width:min(100%,340px);margin:0 auto 18px;background:#fff;padding:12px;border-radius:14px}p{color:#ccc;line-height:1.5}small{color:#888}</style></head><body><main>${content}</main></body></html>`;
}

const realCreateServer = http.createServer.bind(http);
http.createServer = function patchedCreateServer(listener) {
  return realCreateServer((req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname === '/lanchonete/status') {
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(statusJson()));
        return;
      }
      if (url.pathname === `/lanchonete/qr/${QR_TOKEN}`) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(qrHtml());
        return;
      }
    } catch (_) {}
    return listener(req, res);
  });
};

function phoneOf(msg) {
  for (const value of [msg?.sender?.id?.user, msg?.sender?.id?._serialized, msg?.from, msg?.author].filter(Boolean)) {
    let digits = String(value).split('@')[0].replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (/^55\d{10,11}$/.test(digits)) return digits;
  }
  return '';
}

function textOf(msg) {
  for (const value of [msg?.body, msg?.caption, msg?.content, msg?.text]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function messageIdOf(msg) {
  const direct = msg?.id?._serialized || msg?.id?.id || msg?.key?.id || msg?.messageId;
  if (direct) return String(direct);
  const from = String(msg?.from || msg?.author || 'unknown');
  const stamp = String(msg?.timestamp || msg?.t || '0');
  return `${from}:${stamp}:${textOf(msg).slice(0, 120)}`;
}

function seenRecently(id) {
  const now = Date.now();
  for (const [key, ts] of processedMessages) {
    if (now - ts > 10 * 60 * 1000) processedMessages.delete(key);
  }
  if (processedMessages.has(id)) return true;
  processedMessages.set(id, now);
  return false;
}

function shouldIgnore(msg, message) {
  const from = String(msg?.from || '');
  if (!from || !message) return true;
  if (msg?.fromMe === true) return true;
  if (msg?.isGroupMsg === true || from.endsWith('@g.us')) return true;
  if (from === 'status@broadcast' || from.endsWith('@broadcast')) return true;
  return false;
}

async function backendStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/robot`, { headers: { 'cache-control': 'no-cache' } });
    const data = await response.json().catch(() => ({}));
    console.log(`🧠 Backend do robô: HTTP ${response.status} | enabled=${String(data?.enabled)} | storage=${String(data?.storageConfigured)}`);
  } catch (error) {
    console.error('❌ Não foi possível consultar o backend do robô:', error.message);
  }
}

async function handleMessage(msg, source) {
  const message = textOf(msg);
  const from = String(msg?.from || '');
  const fromMe = msg?.fromMe === true;
  const group = msg?.isGroupMsg === true || from.endsWith('@g.us');
  const id = messageIdOf(msg);

  console.log(`📥 Lanchonete ${source}: from=${from || 'n/a'} fromMe=${fromMe} group=${group} texto=${JSON.stringify(message.slice(0, 80))}`);

  if (shouldIgnore(msg, message)) return;
  if (seenRecently(id)) return;
  if (!client) return;

  try {
    const headers = { 'content-type': 'application/json' };
    if (API_TOKEN) headers['x-robot-token'] = API_TOKEN;

    const payload = {
      contactId: from || phoneOf(msg),
      phone: phoneOf(msg),
      message
    };

    const response = await fetch(`${API_BASE}/api/robot/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));
    console.log(`🧠 /api/robot/chat -> HTTP ${response.status} disabled=${String(data?.disabled)} state=${String(data?.state || 'n/a')}`);

    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    if (data?.disabled) {
      console.log('🍔 Mensagem recebida, mas o robô está desligado no painel.');
      return;
    }

    const replyText = String(data?.reply || '').trim();
    if (!replyText) {
      console.log('⚠️ Backend respondeu sem texto para enviar ao cliente.');
      return;
    }

    await client.sendText(from, replyText);
    console.log(`✅ Robô da lanchonete respondeu ${phoneOf(msg) || from}. Estado: ${data?.state || 'n/a'}`);
  } catch (error) {
    lastError = String(error?.message || error);
    console.error('❌ Robô da lanchonete ao responder:', lastError);
  }
}

function removeLocks() {
  const locks = new Set(['SingletonLock', 'SingletonSocket', 'SingletonCookie']);
  const dirs = [TOKEN_DIR];
  try {
    while (dirs.length) {
      const dir = dirs.pop();
      if (!fs.existsSync(dir)) continue;
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, item.name);
        if (locks.has(item.name)) fs.rmSync(full, { force: true, recursive: true });
        else if (item.isDirectory()) dirs.push(full);
      }
    }
  } catch (error) {
    console.warn('⚠️ Lanchonete: falha ao limpar trava antiga:', error.message);
  }
}

function scheduleRetry() {
  if (retry) return;
  retry = setTimeout(() => {
    retry = null;
    startSession();
  }, 15000);
}

async function startSession() {
  if (starting) return;
  starting = true;
  connected = false;
  state = 'starting';
  lastError = '';
  try {
    removeLocks();
    const puppeteerOptions = { timeout: 120000, protocolTimeout: 180000 };
    if (fs.existsSync(CHROME_PATH)) puppeteerOptions.executablePath = CHROME_PATH;
    console.log('🍔 Iniciando segunda sessão WPPConnect da lanchonete...');

    client = await wppconnect.create({
      session: SESSION_NAME,
      catchQR: (base64Qrimg, _ascii, attempts) => {
        qrImage = String(base64Qrimg).startsWith('data:image') ? base64Qrimg : `data:image/png;base64,${base64Qrimg}`;
        connected = false;
        state = 'qr';
        console.log(`📲 QR da lanchonete pronto (tentativa ${attempts}).`);
      },
      statusFind: (s) => {
        state = String(s || 'unknown');
        if (['isLogged', 'qrReadSuccess', 'inChat'].includes(s)) {
          connected = true;
          qrImage = null;
        }
        console.log(`🍔 Estado da sessão da lanchonete: ${state}`);
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
      browserArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run']
    });

    connected = true;
    state = 'inChat';
    qrImage = null;
    console.log('✅ WhatsApp da lanchonete conectado e escutando mensagens.');

    client.onMessage((msg) => handleMessage(msg, 'onMessage'));
    if (typeof client.onAnyMessage === 'function') {
      client.onAnyMessage((msg) => handleMessage(msg, 'onAnyMessage'));
      console.log('🛟 Fallback onAnyMessage da lanchonete ativo.');
    }

    client.onStateChange((s) => {
      state = String(s || 'unknown');
      console.log(`🔄 Sessão lanchonete: ${state}`);
      if (/UNPAIRED|CONFLICT|UNLAUNCHED|DISCONNECTED|NOT_LOGGED/i.test(state)) connected = false;
    });

    await backendStatus();
  } catch (error) {
    lastError = String(error?.message || error);
    connected = false;
    state = 'error';
    console.error('❌ Falha ao iniciar sessão WhatsApp da lanchonete:', lastError);
    scheduleRetry();
  } finally {
    starting = false;
  }
}

console.log(`🔐 Página do QR da lanchonete: ${baseUrl()}/lanchonete/qr/${QR_TOKEN}`);
setTimeout(startSession, 9000);
