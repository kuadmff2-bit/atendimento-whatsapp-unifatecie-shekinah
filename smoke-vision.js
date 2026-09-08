const assert = require("assert");
const V = require("./vision-groq");

async function main() {
  const jpegFake = "/9j/" + "A".repeat(120);
  const thumb = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(980, 7)]).toString("base64");
  const full = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(22000, 9)]).toString("base64");

  assert.equal(V.ehImagem({ type: "image" }), true);
  assert.equal(V.ehImagem({ mimetype: "image/jpeg" }), true);
  assert.equal(V.ehImagem({ type: "chat", body: jpegFake }), true);
  assert.equal(V.ehImagem({ type: "chat", body: "oi" }), false);
  assert.equal(V.pareceBase64Imagem(jpegFake), true);
  assert.equal(V.mimePorBase64(jpegFake), "image/jpeg");
  assert.equal(V.obterMime({ body: jpegFake }), "image/jpeg");
  assert.equal(V.obterMime({ mimetype: "image/png" }), "image/png");
  assert.ok(V.idsMensagem({ id: { _serialized: "abc" } }).includes("abc"));
  assert.ok(V.idsMensagem({ id: "true_55@c.us_X" }).includes("true_55@c.us_X"));
  assert.match(V.promptVisao({ legenda: "o que significa isso?", sessao: { instituicao: "unifatecie" } }), /o que significa isso/);
  assert.match(V.mascararParaMemoria("CPF 123.456.789-00 telefone 92999999999"), /protegido/);

  assert.equal(V.limparRaciocinioVazado("<think>análise interna</think>Resposta final"), "Resposta final");
  assert.equal(V.limparRaciocinioVazado("<think>análise sem fechamento"), "");

  let downloadsDireto = 0;
  const direto = await V.baixarImagemComRetry({
    downloadMedia: async () => { downloadsDireto += 1; throw new Error("não deveria baixar mídia completa"); },
  }, { type: "image", body: full });
  assert.equal(direto, full);
  assert.equal(downloadsDireto, 0);

  let downloads = 0;
  const recuperado = await V.baixarImagemComRetry({
    downloadMedia: async (id) => {
      downloads += 1;
      if (id === "true_5592@c.us_REAL") return full;
      throw new Error("id não disponível");
    },
    getMessages: async () => [{
      id: "true_5592@c.us_REAL",
      type: "image",
      mimetype: "image/jpeg",
      timestamp: 12345,
    }],
  }, {
    type: "image",
    body: thumb,
    from: "5592@c.us",
    timestamp: 12345,
  });
  assert.equal(recuperado, full);
  assert.ok(downloads >= 1);

  console.log("✅ Smoke test da visão aprovado: mídia completa, recuperação de miniatura e bloqueio de raciocínio interno.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
