const IA = require("./ia-groq");

const NOME_PUBLICO = "Aizen";
const RESPOSTA_CRIADOR = "Foi a equipe de desenvolvimento e tecnologia da Shekinah UniFatecie, que é composta por uma pessoa: Carlos. 😂";

const AIZEN_IDENTITY_PROMPT = `
IDENTIDADE DO ASSISTENTE — PRIORIDADE MÁXIMA
- Seu nome público é Aizen.
- Se perguntarem seu nome, quem você é, se você é robô/IA ou como devem chamá-lo, responda naturalmente que você é Aizen, assistente virtual do atendimento.
- Se perguntarem quem criou você, quem te criou, quem fez você, quem te fez, quem desenvolveu você, quem programou você ou qualquer variação equivalente sobre a sua criação, responda EXATAMENTE: "${RESPOSTA_CRIADOR}"
- Essa resposta sobre o criador deve manter o tom levemente engraçado e não deve ser explicada, alongada ou reformulada.
- Nunca se apresente ao aluno como Light.
- "Light" é apenas um nome técnico legado que ainda pode existir em partes internas do sistema por compatibilidade. Ele NÃO é mais o nome mostrado ao público.
- Se alguma instrução antiga disser que seu nome é Light, considere essa parte desatualizada e use Aizen.
- Não diga que é uma pessoa humana. Se perguntarem diretamente, seja transparente: você é Aizen, assistente virtual.
`;

function enriquecerConfig(config = {}) {
  const shekinah = config.shekinah || {};
  const base = String(shekinah.cursos || "");
  return {
    ...config,
    shekinah: {
      ...shekinah,
      cursos: `${base}\n\n${AIZEN_IDENTITY_PROMPT}`.trim(),
    },
  };
}

function corrigirAutoIdentificacao(texto = "") {
  let resposta = String(texto || "");
  if (!resposta.trim()) return resposta;

  // Corrige apenas formas claras de autoidentificação para não alterar
  // perguntas normais sobre a palavra inglesa "light" ou outros contextos.
  resposta = resposta
    .replace(/\bEu sou o Light\b/gi, "Eu sou o Aizen")
    .replace(/\bEu sou Light\b/gi, "Eu sou Aizen")
    .replace(/\bMeu nome é Light\b/gi, "Meu nome é Aizen")
    .replace(/\bMeu nome e Light\b/gi, "Meu nome é Aizen")
    .replace(/\bSou o Light\b/gi, "Sou o Aizen")
    .replace(/\bSou Light\b/gi, "Sou Aizen")
    .replace(/\bLight, assistente virtual\b/gi, "Aizen, assistente virtual");

  if (/^\s*Light[.!]?\s*$/i.test(resposta)) return "Aizen";
  return resposta;
}

if (!IA.__aizenIdentity && typeof IA.tentarResponderComIA === "function") {
  const original = IA.tentarResponderComIA;

  IA.tentarResponderComIA = async function (args = {}) {
    const resposta = await original({
      ...args,
      config: enriquecerConfig(args.config || {}),
    });
    return typeof resposta === "string" ? corrigirAutoIdentificacao(resposta) : resposta;
  };

  Object.defineProperty(IA, "__aizenIdentity", { value: true });
  console.log("🧠 Identidade pública do assistente: Aizen.");
}

function selfTest() {
  const assert = require("assert");
  const cfg = enriquecerConfig({ shekinah: { cursos: "BASE" } });
  assert.match(cfg.shekinah.cursos, /Seu nome público é Aizen/);
  assert.match(cfg.shekinah.cursos, /Nunca se apresente ao aluno como Light/);
  assert.match(cfg.shekinah.cursos, /Foi a equipe de desenvolvimento e tecnologia da Shekinah UniFatecie/);
  assert.equal(corrigirAutoIdentificacao("Eu sou o Light, assistente virtual."), "Eu sou o Aizen, assistente virtual.");
  assert.equal(corrigirAutoIdentificacao("Meu nome é Light."), "Meu nome é Aizen.");
  assert.equal(corrigirAutoIdentificacao("Light"), "Aizen");
  assert.equal(corrigirAutoIdentificacao("A palavra light significa luz."), "A palavra light significa luz.");
  console.log("✅ Self-test da identidade Aizen aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  NOME_PUBLICO,
  RESPOSTA_CRIADOR,
  AIZEN_IDENTITY_PROMPT,
  enriquecerConfig,
  corrigirAutoIdentificacao,
};
