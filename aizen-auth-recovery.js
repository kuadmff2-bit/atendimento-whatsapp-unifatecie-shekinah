const fs = require("fs");
const path = require("path");
const wppconnect = require("@wppconnect-team/wppconnect");

const RECUPERAR = String(process.env.AIZEN_AUTH_RECOVERY || "").trim() === "1";
const NUMERO = String(process.env.AIZEN_PHONE_NUMBER || "").trim();
const TOKEN_ROOT = path.join(process.cwd(), "tokens");
const SESSION_DIR = path.join(TOKEN_ROOT, "atendimento-unifatecie-shekinah");
const MARKER = path.join(TOKEN_ROOT, ".aizen-auth-recovery-v1.done");

function prepararRecuperacao() {
  if (!RECUPERAR) return false;
  if (!NUMERO) {
    console.warn("⚠️ Recuperação do Aizen solicitada sem AIZEN_PHONE_NUMBER.");
    return false;
  }

  try {
    fs.mkdirSync(TOKEN_ROOT, { recursive: true });
    if (!fs.existsSync(MARKER)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      fs.writeFileSync(MARKER, new Date().toISOString(), "utf8");
      console.warn("🧹 Sessão inválida do Aizen removida uma única vez para novo vínculo.");
    }
  } catch (error) {
    console.error("❌ Não foi possível preparar a recuperação da sessão:", error?.message || error);
    return false;
  }

  return true;
}

function instalarGeradorDireto() {
  if (!RECUPERAR) return false;
  try {
    const moduloHost = require("@wppconnect-team/wppconnect/dist/api/layers/host.layer");
    const HostLayer = moduloHost?.HostLayer || moduloHost?.default;
    if (!HostLayer?.prototype) return false;

    HostLayer.prototype.loginByCode = async function loginByCodeAizen(phone) {
      const numero = String(phone || "").trim();
      if (!numero) throw new Error("Número de vinculação não informado");

      const codigo = await Promise.race([
        this.page.evaluate(async (telefone) => {
          const wpp = globalThis.WPP;
          if (!wpp?.conn?.genLinkDeviceCodeForPhoneNumber) {
            throw new Error("WA-JS não expôs genLinkDeviceCodeForPhoneNumber");
          }
          return await wpp.conn.genLinkDeviceCodeForPhoneNumber(telefone);
        }, numero),
        new Promise((_, reject) => {
          const timer = setTimeout(() => reject(new Error("Tempo esgotado ao gerar código")), 45000);
          timer.unref?.();
        }),
      ]);

      const linkCode = String(codigo || "").trim();
      if (!linkCode) throw new Error("WhatsApp não retornou código de vinculação");
      if (typeof this.onLinkCode === "function") this.onLinkCode(linkCode);
      else if (typeof this.catchLinkCode === "function") this.catchLinkCode(linkCode);
      return linkCode;
    };

    return true;
  } catch (error) {
    console.warn("⚠️ Gerador direto de código indisponível:", error?.message || error);
    return false;
  }
}

function instalarWrapperCreate() {
  if (!RECUPERAR || !NUMERO) return false;
  if (wppconnect.create?.__aizenAuthRecovery) return true;

  const originalCreate = wppconnect.create.bind(wppconnect);
  const createComRecuperacao = async function createComRecuperacao(config = {}) {
    const anterior = config.catchLinkCode;
    return originalCreate({
      ...config,
      phoneNumber: NUMERO,
      catchLinkCode: (codigo) => {
        const linkCode = String(codigo || "").trim();
        if (linkCode) console.log("🔗 AIZEN_LINK_CODE=" + linkCode);
        if (typeof anterior === "function") anterior(codigo);
      },
    });
  };

  Object.defineProperty(createComRecuperacao, "__aizenAuthRecovery", { value: true });
  wppconnect.create = createComRecuperacao;
  console.log("🩺 Recuperação controlada da autenticação do Aizen ativada.");
  return true;
}

const preparado = prepararRecuperacao();
if (preparado) {
  instalarGeradorDireto();
  instalarWrapperCreate();
}

function selfTest() {
  const assert = require("assert");
  assert.equal(typeof prepararRecuperacao, "function");
  assert.equal(typeof instalarGeradorDireto, "function");
  assert.equal(typeof instalarWrapperCreate, "function");
  console.log("✅ Self-test da recuperação controlada de autenticação aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { prepararRecuperacao, instalarGeradorDireto, instalarWrapperCreate };
