const Module = require("module");
const originalCompile = Module.prototype._compile;

const OFERTA_ATUAL = Object.freeze({
  avista: "R$ 250,00",
  parcela: "R$ 150,00",
  totalParcelado: "R$ 300,00",
});

function ehEadHook(filename = "") {
  return /(?:^|[\\/])ead-hook\.js$/.test(String(filename));
}

function sincronizarCodigo(codigo = "") {
  let out = String(codigo || "");

  out = out
    .replace('avista: "R$ 300,00"', `avista: "${OFERTA_ATUAL.avista}"`)
    .replace('parcela: "R$ 160,00"', `parcela: "${OFERTA_ATUAL.parcela}"`)
    .replace('totalParcelado: "R$ 320,00"', `totalParcelado: "${OFERTA_ATUAL.totalParcelado}"`);

  return out;
}

Module.prototype._compile = function (content, filename) {
  const patched = ehEadHook(filename) ? sincronizarCodigo(content) : content;
  if (ehEadHook(filename) && patched !== content) {
    console.log("💰 Oferta EAD Shekinah sincronizada: R$ 250 à vista ou 2x de R$ 150.");
  }
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");
  const antigo = `const OFERTA_EAD = Object.freeze({\n  avista: "R$ 300,00",\n  parcela: "R$ 160,00",\n  totalParcelado: "R$ 320,00"\n});`;
  const novo = sincronizarCodigo(antigo);
  assert.match(novo, /R\$ 250,00/);
  assert.match(novo, /R\$ 150,00/);
  assert.match(novo, /R\$ 300,00/);
  assert.doesNotMatch(novo, /R\$ 160,00/);
  assert.doesNotMatch(novo, /R\$ 320,00/);
  console.log("✅ Self-test da sincronização da oferta EAD aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { OFERTA_ATUAL, sincronizarCodigo, ehEadHook };
