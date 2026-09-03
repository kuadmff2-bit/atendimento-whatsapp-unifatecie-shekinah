const fs = require("fs");
const path = require("path");
const Module = require("module");

const caminhoIndex = path.join(__dirname, "index.js");
let codigo = fs.readFileSync(caminhoIndex, "utf8");

function inserirDepois(marcador, adicao, nome) {
  if (codigo.includes(adicao.trim())) return;
  const posicao = codigo.indexOf(marcador);
  if (posicao < 0) throw new Error(`Falha ao integrar IA: marcador '${nome}' não encontrado.`);
  const fim = posicao + marcador.length;
  codigo = codigo.slice(0, fim) + adicao + codigo.slice(fim);
}

function inserirAntes(marcador, adicao, nome) {
  if (codigo.includes(adicao.trim())) return;
  const posicao = codigo.indexOf(marcador);
  if (posicao < 0) throw new Error(`Falha ao integrar IA: marcador '${nome}' não encontrado.`);
  codigo = codigo.slice(0, posicao) + adicao + codigo.slice(posicao);
}

function substituirUmaVez(antigo, novo, nome) {
  if (codigo.includes(novo)) return;
  if (!codigo.includes(antigo)) {
    throw new Error(`Falha ao integrar IA: bloco '${nome}' não encontrado.`);
  }
  codigo = codigo.replace(antigo, novo);
}

inserirDepois(
  'const crypto = require("crypto");\n',
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");\n',
  "imports"
);

inserirAntes(
  "async function enviarTextoDireto(client, destino, mensagem) {\n",
  `async function responderFallbackComIA(client, msg, textoOriginal, sessao) {\n  const respostaIA = await tentarResponderComIA({\n    textoOriginal,\n    sessao,\n    cursosUnifatecie: CURSOS_UNIFATECIE,\n    config: CONFIG,\n  });\n\n  if (!respostaIA) return false;\n\n  await responder(client, msg.from, \`🤖 \${respostaIA}\`);\n  return true;\n}\n\n`,
  "helper da IA"
);

substituirUmaVez(
  `    if (primeiraInteracao && !escolheuInstituicaoDiretamente) {\n      await responder(client, msg.from, menuInicial());\n      return;\n    }\n`,
  `    if (primeiraInteracao && !escolheuInstituicaoDiretamente) {\n      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n      await responder(client, msg.from, menuInicial());\n      return;\n    }\n`,
  "primeira interação"
);

inserirAntes(
  `      await responder(\n        client,\n        msg.from,\n        "Não consegui identificar a instituição. 😊\\n\\nDigite:\\n*1* para UniFatecie\\n*2* para Shekinah"\n      );\n`,
  `      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n\n`,
  "fallback de instituição"
);

inserirAntes(
  `      await responder(\n        client,\n        msg.from,\n        "Não encontrei esse curso. Digite um número de *1 a 8*, *voltar* ou *m*."\n      );\n`,
  `      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n\n`,
  "fallback de cursos"
);

inserirAntes(
  `      await responder(\n        client,\n        msg.from,\n        "Opção inválida. Digite um número de *1 a 4* ou *0* para trocar de instituição."\n      );\n`,
  `      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n\n`,
  "fallback do menu"
);

inserirDepois(
  '    console.log("🚀 Iniciando atendimento pelo WPPConnect...");\n',
  `    console.log(\n      iaDisponivel()\n        ? "🤖 IA Groq ativada para perguntas gerais."\n        : "ℹ️ IA Groq desativada: configure GROQ_API_KEY no Railway para ativar."\n    );\n`,
  "status da IA"
);

const moduloIndex = new Module(caminhoIndex, module);
moduloIndex.filename = caminhoIndex;
moduloIndex.paths = Module._nodeModulePaths(__dirname);
moduloIndex._compile(codigo, caminhoIndex);
