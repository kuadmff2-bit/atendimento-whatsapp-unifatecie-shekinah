const assert = require("assert");
const V = require("./vision-groq");

async function main() {
  const jpegFake = "/9j/" + "A".repeat(120);

  assert.equal(V.ehImagem({ type: "image" }), true);
  assert.equal(V.ehImagem({ mimetype: "image/jpeg" }), true);
  assert.equal(V.ehImagem({ type: "chat", body: jpegFake }), true);
  assert.equal(V.ehImagem({ type: "chat", body: "oi" }), false);
  assert.equal(V.pareceBase64Imagem(jpegFake), true);
  assert.equal(V.mimePorBase64(jpegFake), "image/jpeg");
  assert.equal(V.obterMime({ body: jpegFake }), "image/jpeg");
  assert.equal(V.obterMime({ mimetype: "image/png" }), "image/png");
  assert.ok(V.idsMensagem({ id: { _serialized: "abc" } }).includes("abc"));
  assert.match(V.promptVisao({ legenda: "o que significa isso?", sessao: { instituicao: "unifatecie" } }), /o que significa isso/);
  assert.match(V.mascararParaMemoria("CPF 123.456.789-00 telefone 92999999999"), /protegido/);

  let downloads = 0;
  const direto = await V.baixarImagemComRetry({
    downloadMedia: async () => { downloads += 1; throw new Error("não deveria baixar"); },
  }, { type: "image", body: jpegFake });
  assert.equal(direto, jpegFake);
  assert.equal(downloads, 0);

  console.log("✅ Smoke test da leitura de imagens aprovado, incluindo base64 bruto no body.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});