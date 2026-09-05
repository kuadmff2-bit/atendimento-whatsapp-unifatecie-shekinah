// Guard operacional do Gemini.
// O arquivo manteve o nome antigo para não quebrar o comando de inicialização,
// mas agora REATIVA o Gemini com proteção de timeout, compatibilidade 3.8 e fallback rápido.

const GEMINI_HOST = "generativelanguage.googleapis.com";
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
const originalFetch = global.fetch.bind(globalThis);

function numeroSeguro(valor, padrao, min, max) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

const GEMINI_TIMEOUT_MS = numeroSeguro(process.env.GEMINI_TIMEOUT_MS, 7000, 2500, 15000);
const CIRCUIT_RETRY_MS = numeroSeguro(process.env.GEMINI_CIRCUIT_RETRY_MS, 10 * 60 * 1000, 60 * 1000, 60 * 60 * 1000);

const estado = {
  falhasConsecutivas: 0,
  abertoAte: 0,
  ultimoStatus: null,
  ultimaFalha: "",
};

function urlTexto(input) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return String(input?.url || "");
}

function ehGemini(input) {
  try {
    return new URL(urlTexto(input)).hostname === GEMINI_HOST;
  } catch (_) {
    return false;
  }
}

function ehGenerateContent(input) {
  return ehGemini(input) && /:generateContent(?:\?|$)/i.test(urlTexto(input));
}

function textoParte(parte) {
  if (!parte || typeof parte !== "object") return "";
  return typeof parte.text === "string" ? parte.text.trim() : "";
}

function normalizarContents(contents) {
  if (!Array.isArray(contents)) return [];

  const limpos = [];
  for (const item of contents) {
    const role = item?.role === "model" ? "model" : item?.role === "user" ? "user" : null;
    if (!role) continue;

    const parts = Array.isArray(item?.parts)
      ? item.parts.filter((p) => textoParte(p))
      : [];
    if (!parts.length) continue;

    const anterior = limpos[limpos.length - 1];
    if (anterior?.role === role) {
      anterior.parts.push({ text: "\n" });
      anterior.parts.push(...parts);
    } else {
      limpos.push({ role, parts: [...parts] });
    }
  }

  // Gemini 3.x exige conversa válida: começa no usuário e termina no usuário.
  while (limpos.length && limpos[0].role !== "user") limpos.shift();
  while (limpos.length && limpos[limpos.length - 1].role !== "user") limpos.pop();
  return limpos;
}

function sanitizarBodyGemini(bodyOriginal, url = "") {
  if (typeof bodyOriginal !== "string" || !bodyOriginal.trim()) return bodyOriginal;

  try {
    const body = JSON.parse(bodyOriginal);
    const modelo38 = /gemini-3\.8-/i.test(url) || /gemini-3\.8-/i.test(GEMINI_MODEL);

    if (Array.isArray(body.contents)) {
      const contents = normalizarContents(body.contents);
      if (contents.length) body.contents = contents;
    }

    body.generationConfig = body.generationConfig && typeof body.generationConfig === "object"
      ? body.generationConfig
      : {};

    if (modelo38) {
      // Gemini 3.8 não aceita os parâmetros de amostragem legados.
      delete body.generationConfig.temperature;
      delete body.generationConfig.topP;
      delete body.generationConfig.topK;
      delete body.generationConfig.candidateCount;

      const nivel = String(body.generationConfig?.thinkingConfig?.thinkingLevel || "medium").toLowerCase();
      body.generationConfig.thinkingConfig = {
        thinkingLevel: ["low", "medium", "high"].includes(nivel) ? nivel : "medium",
      };
    }

    return JSON.stringify(body);
  } catch (_) {
    return bodyOriginal;
  }
}

function abrirCircuito(motivo, duracao = CIRCUIT_RETRY_MS) {
  estado.falhasConsecutivas += 1;
  estado.ultimaFalha = String(motivo || "falha desconhecida").slice(0, 180);
  estado.abertoAte = Date.now() + duracao;
  console.warn(`🛟 Gemini em fail-safe por ${Math.ceil(duracao / 60000)} min: ${estado.ultimaFalha}. Groq assumirá automaticamente.`);
}

function fecharCircuito() {
  if (estado.abertoAte || estado.falhasConsecutivas) {
    console.log("🧠 Gemini 3.8 Flash respondeu normalmente; circuito fechado.");
  }
  estado.falhasConsecutivas = 0;
  estado.abertoAte = 0;
  estado.ultimaFalha = "";
  estado.ultimoStatus = 200;
}

function circuitoAberto() {
  if (!estado.abertoAte) return false;
  if (Date.now() >= estado.abertoAte) {
    estado.abertoAte = 0;
    return false;
  }
  return true;
}

function combinarSinal(sinalOriginal, controlador) {
  if (!sinalOriginal) return controlador.signal;
  if (typeof AbortSignal?.any === "function") {
    return AbortSignal.any([sinalOriginal, controlador.signal]);
  }
  if (sinalOriginal.aborted) controlador.abort(sinalOriginal.reason);
  else sinalOriginal.addEventListener("abort", () => controlador.abort(sinalOriginal.reason), { once: true });
  return controlador.signal;
}

async function fetchProtegido(input, init = {}) {
  if (!ehGenerateContent(input)) return originalFetch(input, init);

  if (circuitoAberto()) {
    const erro = new Error("Gemini temporariamente em fail-safe; usar fallback Groq");
    erro.code = "GEMINI_CIRCUIT_OPEN";
    throw erro;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Gemini timeout")), GEMINI_TIMEOUT_MS);
  timer.unref?.();

  try {
    const initSeguro = {
      ...init,
      body: sanitizarBodyGemini(init?.body, urlTexto(input)),
      signal: combinarSinal(init?.signal, controller),
    };

    const resposta = await originalFetch(input, initSeguro);
    estado.ultimoStatus = resposta.status;

    if (resposta.ok) {
      fecharCircuito();
      return resposta;
    }

    // Erros de chave, modelo, payload e cota não devem travar cada mensagem do WhatsApp.
    const longa = [400, 401, 403, 404, 429].includes(resposta.status);
    abrirCircuito(`HTTP ${resposta.status}`, longa ? CIRCUIT_RETRY_MS : 2 * 60 * 1000);
    return resposta;
  } catch (error) {
    const motivo = error?.name === "AbortError" ? `timeout após ${GEMINI_TIMEOUT_MS}ms` : (error?.message || error);
    abrirCircuito(motivo, 2 * 60 * 1000);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

if (!global.__LIGHT_GEMINI_SAFE_FETCH__) {
  global.__LIGHT_GEMINI_SAFE_FETCH__ = true;
  global.fetch = fetchProtegido;

  if (process.env.GEMINI_API_KEY) {
    process.env.GEMINI_MODEL = GEMINI_MODEL;
    console.log(`🧠 Gemini reativado com fail-safe: ${GEMINI_MODEL} (timeout ${GEMINI_TIMEOUT_MS}ms) + fallback GPT-OSS 120B.`);
  } else {
    console.log("ℹ️ GEMINI_API_KEY ausente; Light continuará usando Groq GPT-OSS 120B.");
  }
}

function executarSelfTest() {
  const assert = require("assert");
  const exemplo = JSON.stringify({
    contents: [
      { role: "model", parts: [{ text: "ignorar início inválido" }] },
      { role: "user", parts: [{ text: "Oi" }] },
      { role: "user", parts: [{ text: "Tudo bem?" }] },
    ],
    generationConfig: {
      temperature: 0.12,
      topP: 0.9,
      topK: 10,
      candidateCount: 2,
      thinkingConfig: { thinkingLevel: "medium" },
    },
  });

  const limpo = JSON.parse(sanitizarBodyGemini(exemplo, "/models/gemini-3.8-flash:generateContent"));
  assert.equal(limpo.contents[0].role, "user");
  assert.equal(limpo.contents[limpo.contents.length - 1].role, "user");
  assert.equal(limpo.generationConfig.temperature, undefined);
  assert.equal(limpo.generationConfig.topP, undefined);
  assert.equal(limpo.generationConfig.topK, undefined);
  assert.equal(limpo.generationConfig.candidateCount, undefined);
  assert.equal(limpo.generationConfig.thinkingConfig.thinkingLevel, "medium");
  console.log("✅ Self-test Gemini fail-safe aprovado.");
}

if (process.argv.includes("--self-test")) executarSelfTest();

module.exports = {
  sanitizarBodyGemini,
  normalizarContents,
  circuitoAberto,
  estado,
};
