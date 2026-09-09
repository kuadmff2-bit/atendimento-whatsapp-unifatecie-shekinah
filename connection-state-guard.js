const Module = require("module");
const originalCompile = Module.prototype._compile;

function isLegacy(filename = "") {
  return /(?:^|[\\/])legacy-index\.js$/.test(String(filename));
}

function isIaGroq(filename = "") {
  return /(?:^|[\\/])ia-groq\.js$/.test(String(filename));
}

function patchLegacy(codigo = "") {
  let out = String(codigo);

  // Não chamar getConnectionState() em loop durante a inicialização. Esse
  // polling monopolizava o canal do Puppeteer/CDP e atrasava os eventos do
  // WPPConnect por vários minutos.
  if (out.includes("      waitForLogin: false,")) {
    out = out.replace("      waitForLogin: false,", "      waitForLogin: true,");
  }

  if (out.includes("      deviceSyncTimeout: 0,")) {
    out = out.replace("      deviceSyncTimeout: 0,", "      deviceSyncTimeout: 180000,");
  }

  const alvoPuppeteer = "    const puppeteerOptions = { timeout: 120000 };";
  if (out.includes(alvoPuppeteer)) {
    out = out.replace(
      alvoPuppeteer,
      "    const puppeteerOptions = { timeout: 120000, protocolTimeout: 180000 };"
    );
  }

  // Quando há um número configurado, usa o fluxo de vinculação por código do
  // próprio WPPConnect em vez de depender de um QR que pode expirar/rotacionar.
  const alvoCriacaoCliente =
    '    const client = await wppconnect.create({\n      session: "atendimento-unifatecie-shekinah",';
  if (out.includes(alvoCriacaoCliente)) {
    const criacaoComCodigo = `    const numeroVinculacaoAizen = String(process.env.AIZEN_PHONE_NUMBER || \"\").trim();\n    if (numeroVinculacaoAizen) {\n      console.log(\"📱 Login do Aizen por código de vinculação ativado.\");\n    }\n\n    const client = await wppconnect.create({\n      session: \"atendimento-unifatecie-shekinah\",\n      ...(numeroVinculacaoAizen\n        ? {\n            phoneNumber: numeroVinculacaoAizen,\n            catchLinkCode: (codigo) => {\n              const linkCode = String(codigo || \"\").trim();\n              if (linkCode) console.log(\"🔗 AIZEN_LINK_CODE=\" + linkCode);\n            },\n          }\n        : {}),`;
    out = out.replace(alvoCriacaoCliente, criacaoComCodigo);
  } else {
    console.warn("⚠️ Guarda de vinculação: criação do cliente WPPConnect não encontrada.");
  }

  // Em algumas versões recentes do WhatsApp Web, sendText para @lid fica
  // pendurado sem erro. Para não deixar o Aizen mudo, tentamos primeiro o
  // número real @c.us já resolvido e, se necessário, usamos o @lid como fallback.
  const regexEnviarDireto = /async function enviarTextoDireto\(client, destino, mensagem\) \{[\s\S]*?\n\}/;
  const enviarDiretoNovo = `async function enviarTextoDireto(client, destino, mensagem) {\n  const original = String(destino || \"\");\n  const alvos = [];\n\n  if (original.endsWith(\"@lid\")) {\n    try {\n      const resolvido = await resolverDestino(client, original);\n      if (resolvido && resolvido !== original) alvos.push(resolvido);\n    } catch (error) {\n      console.warn(\"⚠️ Não foi possível resolver o LID antes do envio:\", error?.message || error);\n    }\n  }\n\n  alvos.push(original);\n  const unicos = [...new Set(alvos.filter(Boolean))];\n  let ultimoErro = null;\n\n  for (const alvo of unicos) {\n    console.log(\"📤 Enviando resposta para \" + alvo + \"...\");\n    try {\n      const resultado = await Promise.race([\n        client.sendText(alvo, mensagem),\n        new Promise((_, reject) => {\n          const timer = setTimeout(() => reject(new Error(\"Timeout de envio para \" + alvo)), 8000);\n          timer.unref?.();\n        }),\n      ]);\n\n      if (!resultado) throw new Error(\"O WhatsApp não confirmou o envio da resposta.\");\n      console.log(\"✅ Resposta enviada para \" + alvo + \".\");\n      return resultado;\n    } catch (error) {\n      ultimoErro = error;\n      console.warn(\"⚠️ Falha ao enviar para \" + alvo + \"; tentando rota alternativa:\", error?.message || error);\n    }\n  }\n\n  throw ultimoErro || new Error(\"Não foi possível enviar a resposta pelo WhatsApp.\");\n}`;

  if (regexEnviarDireto.test(out)) {
    out = out.replace(regexEnviarDireto, enviarDiretoNovo);
  } else {
    console.warn("⚠️ Guarda de envio: função enviarTextoDireto não encontrada para ajuste.");
  }

  // Conversas privadas podem chegar como @lid. Mantemos o identificador original
  // até a camada de envio, que agora sabe tentar @c.us e @lid com timeout/fallback.
  const regexResponder = /async function responder\(client, destino, mensagem\) \{[\s\S]*?\n\}/;
  const responderNovo = `async function responder(client, destino, mensagem) {\n  await delay(350);\n  return enviarTextoDireto(client, String(destino || \"\"), mensagem);\n}`;

  if (regexResponder.test(out)) {
    out = out.replace(regexResponder, responderNovo);
  } else {
    console.warn("⚠️ Guarda LID: função responder não encontrada para ajuste.");
  }

  console.log("✅ Inicialização estável do WhatsApp ativa: eventos livres, vínculo por código e envio LID/@c.us com fallback.");
  return out;
}

function patchIaGroq(codigo = "") {
  let out = String(codigo);

  // Evita HTTP 413 quando uma sessão persistida acumulou contexto demais.
  out = out.replace("const LIMITE_HISTORICO = 24;", "const LIMITE_HISTORICO = 8;");

  const historicoAntigo = "    ...historico.slice(-LIMITE_HISTORICO),";
  const historicoNovo = `    ...historico.slice(-LIMITE_HISTORICO).map((m) => ({\n      role: m?.role === \"assistant\" ? \"assistant\" : \"user\",\n      content: String(m?.content || \"\").slice(-1200),\n    })),`;
  if (out.includes(historicoAntigo)) out = out.replace(historicoAntigo, historicoNovo);

  // Só usa browser_search quando a pergunta realmente pede informação externa.
  // Uma falha simples da IA não deve gerar uma segunda requisição 413.
  const webAntigo = "  if (!resposta || pareceSemInformacao(resposta) || perguntaPodePrecisarDeWeb(texto)) {";
  const webNovo = "  if (perguntaPodePrecisarDeWeb(texto) || (resposta && pareceSemInformacao(resposta))) {";
  if (out.includes(webAntigo)) out = out.replace(webAntigo, webNovo);

  console.log("🧠 Payload da IA protegido contra histórico excessivo/HTTP 413.");
  return out;
}

Module.prototype._compile = function (content, filename) {
  let patched = content;
  if (isLegacy(filename)) patched = patchLegacy(patched);
  if (isIaGroq(filename)) patched = patchIaGroq(patched);
  return originalCompile.call(this, patched, filename);
};

function selfTest() {
  const assert = require("assert");

  const baseLegacy = `async function iniciar() {\n    const puppeteerOptions = { timeout: 120000 };\n    const client = await wppconnect.create({\n      session: \"atendimento-unifatecie-shekinah\",\n      waitForLogin: true,\n      deviceSyncTimeout: 0,\n    });\n    whatsappConectado = true;\n  }\n\nasync function enviarTextoDireto(client, destino, mensagem) {\n  console.log(destino);\n  const resultado = await client.sendText(destino, mensagem);\n  return resultado;\n}\n\nasync function responder(client, destino, mensagem) {\n  await delay(900);\n  const destinoResolvido = await resolverDestino(client, destino);\n  return enviarTextoDireto(client, destinoResolvido, mensagem);\n}`;
  const novoLegacy = patchLegacy(baseLegacy);
  assert.match(novoLegacy, /waitForLogin: true/);
  assert.doesNotMatch(novoLegacy, /waitForLogin: false/);
  assert.match(novoLegacy, /deviceSyncTimeout: 180000/);
  assert.match(novoLegacy, /protocolTimeout: 180000/);
  assert.match(novoLegacy, /AIZEN_PHONE_NUMBER/);
  assert.match(novoLegacy, /phoneNumber: numeroVinculacaoAizen/);
  assert.match(novoLegacy, /catchLinkCode/);
  assert.match(novoLegacy, /AIZEN_LINK_CODE=/);
  assert.match(novoLegacy, /Timeout de envio para/);
  assert.match(novoLegacy, /original\.endsWith\(\"@lid\"\)/);
  assert.match(novoLegacy, /resolverDestino\(client, original\)/);
  assert.match(novoLegacy, /return enviarTextoDireto\(client, String\(destino/);
  assert.doesNotMatch(novoLegacy, /getConnectionState\(\)/);

  const baseIa = `const LIMITE_HISTORICO = 24;\nconst mensagens = [\n    ...historico.slice(-LIMITE_HISTORICO),\n];\n  if (!resposta || pareceSemInformacao(resposta) || perguntaPodePrecisarDeWeb(texto)) {`;
  const novaIa = patchIaGroq(baseIa);
  assert.match(novaIa, /LIMITE_HISTORICO = 8/);
  assert.match(novaIa, /slice\(-1200\)/);
  assert.doesNotMatch(novaIa, /if \(!resposta \|\| pareceSemInformacao/);

  console.log("✅ Self-test da estabilidade WhatsApp/LID/vínculo por código/IA aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = { patchCodigo: patchLegacy, patchLegacy, patchIaGroq };
