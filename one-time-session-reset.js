const fs = require("fs");
const path = require("path");

const resetId = String(process.env.FORCE_WHATSAPP_SESSION_RESET || "").trim();
if (resetId) {
  const tokenRoot = path.join(process.cwd(), "tokens");
  const safeId = resetId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const marker = path.join(tokenRoot, `.session-reset-${safeId}.done`);
  const sessionDir = path.join(tokenRoot, "atendimento-unifatecie-shekinah");

  try {
    fs.mkdirSync(tokenRoot, { recursive: true });

    if (!fs.existsSync(marker)) {
      console.warn(`🧹 Reset único da sessão WhatsApp solicitado (${safeId}).`);
      fs.rmSync(sessionDir, { recursive: true, force: true });
      fs.writeFileSync(marker, new Date().toISOString(), "utf8");
      console.warn("✅ Sessão antiga removida. Um novo QR Code será gerado.");
    } else {
      console.log(`✅ Reset da sessão ${safeId} já aplicado; sessão atual preservada.`);
    }
  } catch (error) {
    console.error("❌ Falha ao aplicar reset único da sessão WhatsApp:", error?.message || error);
  }
}
