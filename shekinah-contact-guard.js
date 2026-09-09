const Module = require("module");
const originalCompile = Module.prototype._compile;

const SECRETARIA_SHEKINAH = "559291572214";

function ehLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function aplicarDestinoSecretaria(codigo = "") {
  let out = String(codigo || "");

  // Troca o número antigo pelo contato atual da Shekinah.
  out = out.replace(
    /const WHATSAPP_SECRETARIA_SHEKINAH = "\d+";/,
    `const WHATSAPP_SECRETARIA_SHEKINAH = "${SECRETARIA_SHEKINAH}";`
  );

  // Um contato persistido de um número antigo não pode receber novas pré-matrículas.
  out = out.replace(
    "  if (contatoSecretariaRegistrado) {\n    const destinosRegistrados = [",
    "  if (contatoSecretariaRegistrado && (numeroPertenceASecretaria(contatoSecretariaRegistrado.origem) || numeroPertenceASecretaria(contatoSecretariaRegistrado.resolvido))) {\n    const destinosRegistrados = ["
  );

  // Antes de depender do checkNumberStatus, tenta o destino oficial diretamente.
  const trechoLocalizar = `  try {\n    const destinoLocalizado = await localizarNumeroNoWhatsApp(\n      client,\n      WHATSAPP_SECRETARIA_SHEKINAH\n    );`;
  if (out.includes(trechoLocalizar)) {
    const direto = `  try {\n    const destinoOficial = \`${SECRETARIA_SHEKINAH}@c.us\`;\n    await delay(900);\n    await enviarTextoDireto(client, destinoOficial, mensagem);\n    return;\n  } catch (error) {\n    ultimoErro = error;\n    console.warn(\`⚠️ Falha no envio direto para a secretaria Shekinah (${SECRETARIA_SHEKINAH}):\`, error?.message || error);\n  }\n\n${trechoLocalizar}`;
    out = out.replace(trechoLocalizar, direto);
  }

  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = ehLegacy(filename) ? aplicarDestinoSecretaria(content) : content;
  if (ehLegacy(filename) && patched !== content) {
    console.log(`📨 Destino oficial da secretaria Shekinah ativo: ${SECRETARIA_SHEKINAH}.`);
  }
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const base = `const WHATSAPP_SECRETARIA_SHEKINAH = "5592993977312";\nasync function enviarMensagemParaSecretaria(client, mensagem) {\n  let ultimoErro;\n\n  if (contatoSecretariaRegistrado) {\n    const destinosRegistrados = [\n      contatoSecretariaRegistrado.origem,\n      contatoSecretariaRegistrado.resolvido,\n    ];\n  }\n\n  try {\n    const destinoLocalizado = await localizarNumeroNoWhatsApp(\n      client,\n      WHATSAPP_SECRETARIA_SHEKINAH\n    );\n  } catch (error) {}\n}`;
  const novo = aplicarDestinoSecretaria(base);
  assert.match(novo, /559291572214/);
  assert.doesNotMatch(novo, /5592993977312/);
  assert.match(novo, /numeroPertenceASecretaria\(contatoSecretariaRegistrado\.resolvido\)/);
  assert.match(novo, /destinoOficial/);
  assert.match(novo, /enviarTextoDireto\(client, destinoOficial, mensagem\)/);
  console.log("✅ Self-test do destino da secretaria Shekinah aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { SECRETARIA_SHEKINAH, ehLegacy, aplicarDestinoSecretaria };
