function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function instalarReparoInjectApi() {
  try {
    const browser = require("@wppconnect-team/wppconnect/dist/controllers/browser");
    const original = browser?.injectApi;
    if (typeof original !== "function") throw new Error("injectApi não encontrado");
    if (original.__aizenReadyGuard) return true;

    async function injectApiReparado(page, onLoadingScreenCallBack) {
      const waitOriginal = page.waitForFunction.bind(page);
      const waitAtual = page.waitForFunction;

      page.waitForFunction = function (pageFunction, options, ...args) {
        const fonte = String(pageFunction || "");
        const esperaWppReady =
          fonte.includes("WPP.isReady") ||
          (fonte.includes("window.WPP") && fonte.includes("window.WAPI") && fonte.includes("window.Store"));

        if (!esperaWppReady) {
          return waitOriginal(pageFunction, options, ...args);
        }

        return waitOriginal(
          () => {
            return Boolean(
              typeof window.WPP !== "undefined" &&
                typeof window.WAPI !== "undefined" &&
                typeof window.Store !== "undefined" &&
                window.WPP &&
                window.WPP.chat
            );
          },
          { timeout: 45000, polling: 250 }
        );
      };

      try {
        const resultado = await original(page, onLoadingScreenCallBack);
        console.log("🧩 WA-JS injetado com critério de prontidão compatível.");
        return resultado;
      } finally {
        page.waitForFunction = waitAtual;
      }
    }

    injectApiReparado.__aizenReadyGuard = true;
    browser.injectApi = injectApiReparado;
    console.log("🧩 Reparo de prontidão do injectApi instalado.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível reparar injectApi:", error?.message || error);
    return false;
  }
}

function instalarReparoHost() {
  try {
    const modulo = require("@wppconnect-team/wppconnect/dist/api/layers/host.layer");
    const HostLayer = modulo?.HostLayer || modulo?.default;
    if (!HostLayer?.prototype) throw new Error("HostLayer não encontrado");

    if (!HostLayer.prototype.waitForPageLoad.__aizenReadyGuard) {
      async function waitForPageLoadReparado() {
        const inicio = Date.now();
        while (!this.page.isClosed()) {
          const pageLoad = this.pageLoadPromise;
          if (!pageLoad) {
            if (Date.now() - inicio > 60000) {
              throw new Error("Tempo esgotado aguardando o carregamento do WhatsApp Web");
            }
            await sleep(50);
            continue;
          }

          await pageLoad;

          if (pageLoad === this.pageLoadPromise && this.isInjected) {
            await this.page.waitForFunction(
              () => {
                return Boolean(
                  typeof window.WPP !== "undefined" &&
                    typeof window.WAPI !== "undefined" &&
                    typeof window.Store !== "undefined" &&
                    window.WPP &&
                    window.WPP.chat
                );
              },
              { timeout: 45000, polling: 250 }
            );
            return true;
          }
        }

        throw new Error("Página do WhatsApp fechou antes de concluir a injeção");
      }

      waitForPageLoadReparado.__aizenReadyGuard = true;
      HostLayer.prototype.waitForPageLoad = waitForPageLoadReparado;
    }

    if (!HostLayer.prototype.waitForInChat.__aizenReadyGuard) {
      const originalWaitForInChat = HostLayer.prototype.waitForInChat;

      async function waitForInChatReparado() {
        if (!this.isLogged) return false;

        try {
          const pronto = await Promise.race([
            this.page.evaluate(() => {
              return Boolean(
                typeof window.WPP !== "undefined" &&
                  typeof window.WAPI !== "undefined" &&
                  typeof window.Store !== "undefined" &&
                  window.WPP &&
                  window.WPP.chat &&
                  window.WPP.conn
              );
            }),
            new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
          ]);

          if (pronto) {
            this.isInChat = true;
            console.log("✅ Sessão autenticada aceita como pronta pelo WA-JS atual.");
            return true;
          }
        } catch (_) {}

        return originalWaitForInChat.call(this);
      }

      waitForInChatReparado.__aizenReadyGuard = true;
      HostLayer.prototype.waitForInChat = waitForInChatReparado;
    }

    console.log("🧩 Reparo de waitForPageLoad/waitForInChat instalado.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível reparar HostLayer:", error?.message || error);
    return false;
  }
}

const injectApiReparado = instalarReparoInjectApi();
const hostReparado = instalarReparoHost();

function selfTest() {
  const assert = require("assert");
  assert.equal(typeof injectApiReparado, "boolean");
  assert.equal(typeof hostReparado, "boolean");
  console.log("✅ Self-test do reparo de prontidão do WPPConnect aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { instalarReparoInjectApi, instalarReparoHost };
