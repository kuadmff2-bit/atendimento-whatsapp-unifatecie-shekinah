/**
 * Guard global que impede operações I/O bloqueantes em Chromium.
 * Problemas causados por Runtime.callFunctionOn timeout no Chromium do Railway:
 * - getConnectionState()
 * - getAllUnreadMessages()
 * - getHostDevice()
 * - Qualquer method() que espere por resposta da página Chromium
 *
 * Solução: Usar apenas eventos (onMessage, onAnyMessage, onStateChange) e dados já em memória.
 */

const Module = require("module");
const originalRequire = Module.prototype.require;

// Lista de operações que causam deadlock no Railway Chromium
const OPERACOES_BLOQUEANTES = new Set([
  "getAllUnreadMessages",
  "getConnectionState",
  "getHostDevice",
  "getChats",
  "getContact",
  "getChatById",
  "getMessageById",
  "downloadMedia"
]);

function safeProxy(obj, nomeFuncao) {
  if (typeof obj[nomeFuncao] !== "function") {
    return obj[nomeFuncao];
  }

  return function (...args) {
    console.warn(
      `⚠️ BLOQUEADA: Operação ${nomeFuncao}() pode causar Runtime.callFunctionOn timeout. ` +
      `Use eventos (onMessage, onStateChange) em vez disso.`
    );
    // Retorna Promise rejeitada ou undefined para não quebrar fluxo
    if (args[args.length - 1]?.constructor?.name === "Function") {
      // Última arg é callback
      const cb = args.pop();
      return setImmediate(() => cb(new Error(`${nomeFuncao} bloqueado por segurança`)));
    }
    return Promise.reject(new Error(`${nomeFuncao} bloqueado por segurança`));
  };
}

console.log("🔒 Guard de I/O bloqueante ativa: impedindo operações que causam timeout.");

module.exports = { safeProxy, OPERACOES_BLOQUEANTES };

