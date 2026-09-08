const assert = require("assert");
const V = require("./vision-groq");

assert.equal(V.ehImagem({ type: "image" }), true);
assert.equal(V.ehImagem({ mimetype: "image/jpeg" }), true);
assert.equal(V.ehImagem({ type: "chat" }), false);
assert.equal(V.obterMime({ mimetype: "image/png" }), "image/png");
assert.ok(V.idsMensagem({ id: { _serialized: "abc" } }).includes("abc"));
assert.match(V.promptVisao({ legenda: "o que significa isso?", sessao: { instituicao: "unifatecie" } }), /o que significa isso/);
assert.match(V.mascararParaMemoria("CPF 123.456.789-00 telefone 92999999999"), /protegido/);
console.log("✅ Smoke test da leitura de imagens aprovado.");
