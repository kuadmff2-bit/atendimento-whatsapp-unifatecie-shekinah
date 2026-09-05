const assert = require("assert");
const { ehMensagemDeAudio, idsMensagem, obterMime } = require("./audio-groq");

const positivos = [
  { type: "ptt" },
  { type: "audio" },
  { type: "Audio" },
  { mimetype: "audio/ogg; codecs=opus" },
  { mimeType: "audio/mpeg" },
  { mediaData: { mimetype: "audio/ogg; codecs=opus" } },
  { mediaData: { type: "PTT" } },
  { isPtt: true },
];

for (const caso of positivos) {
  assert.equal(ehMensagemDeAudio(caso), true, `Deveria detectar áudio: ${JSON.stringify(caso)}`);
}

assert.equal(ehMensagemDeAudio({ type: "image", mimetype: "image/jpeg" }), false);
assert.equal(ehMensagemDeAudio({ type: "chat", body: "oi" }), false);
assert.equal(obterMime({ mediaData: { mimetype: "audio/ogg; codecs=opus" } }), "audio/ogg; codecs=opus");
assert.deepEqual(
  idsMensagem({ id: { _serialized: "false_5592@c.us_TEST" }, messageId: "alternativo" }),
  ["false_5592@c.us_TEST", "alternativo"]
);

console.log("✅ Smoke test de áudio aprovado.");
