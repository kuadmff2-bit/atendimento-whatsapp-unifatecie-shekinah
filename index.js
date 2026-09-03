const fs = require("fs");
const path = require("path");
const Module = require("module");

console.log("🚪 Entrada principal: conversa natural integrada ao bot-base.");

const caminhoBase = path.join(__dirname, "legacy-index.js");
let codigo = fs.readFileSync(caminhoBase, "utf8");

function substituirObrigatorio(antigo, novo, nome) {
  if (!codigo.includes(antigo)) {
    throw new Error(`Não foi possível integrar '${nome}' ao bot-base.`);
  }
  codigo = codigo.replace(antigo, novo);
}

function substituirTodosObrigatorio(antigo, novo, nome) {
  const ocorrencias = codigo.split(antigo).length - 1;
  if (ocorrencias < 1) {
    throw new Error(`Não foi possível integrar '${nome}' ao bot-base.`);
  }
  codigo = codigo.split(antigo).join(novo);
  console.log(`🔧 ${nome}: ${ocorrencias} ocorrência(s) atualizada(s).`);
}

substituirObrigatorio(
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");',
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq-ext");\nconst { tentarConversaNatural } = require("./conversation-core-ext");\nconst { tentarCorrecoesAtendimento } = require("./atendimento-fixes");\nconst { encaminharPreMatriculaShekinah } = require("./shekinah-forward");\nconst { ehMensagemDeAudio, transcreverAudioWhatsApp } = require("./audio-groq");\nconst CURSOS_EXTRA_UNIFATECIE = require("./catalogo-extra");',
  "módulos conversacionais e áudio"
);

substituirObrigatorio(
  'const CURSOS_UNIFATECIE = {',
  'const CURSOS_UNIFATECIE = {\n  ...CURSOS_EXTRA_UNIFATECIE,',
  "catálogo extra da UniFatecie"
);

substituirObrigatorio(
  'async function responder(client, destino, mensagem) {\n  await delay(900);\n\n  const destinoResolvido = await resolverDestino(client, destino);',
  `async function responder(client, destino, mensagem) {\n  const sessaoDestino = sessoes.get(destino);\n  const etapaAtual = String(sessaoDestino?.etapa || "");\n  const fluxoCancelavel =\n    etapaAtual.startsWith("unifatecie_matricula_") ||\n    etapaAtual.startsWith("shekinah_matricula_") ||\n    etapaAtual.startsWith("financeiro_") ||\n    etapaAtual.startsWith("shekinah_secretaria_");\n\n  mensagem = String(mensagem || "").trim();\n\n  const ehConfirmacaoFinal =\n    /PRÉ-MATRÍCULA RECEBIDA|PRE-MATRICULA RECEBIDA/i.test(mensagem);\n\n  if (fluxoCancelavel && !ehConfirmacaoFinal && !/\\bcancelar\\b/i.test(mensagem)) {\n    mensagem += "\\n\\n❌ Para sair deste atendimento, digite *cancelar*.";\n  }\n\n  await delay(900);\n\n  const destinoResolvido = await resolverDestino(client, destino);`,
  "opção visível de cancelamento"
);

substituirObrigatorio(
  '    const textoOriginal = typeof msg.body === "string" ? msg.body.trim() : "";\n\n    if (!textoOriginal) {',
  `    let textoOriginal = typeof msg.body === "string" ? msg.body.trim() : "";\n\n    if (ehMensagemDeAudio(msg)) {\n      const transcricaoAudio = await transcreverAudioWhatsApp(client, msg);\n\n      if (!transcricaoAudio?.ok) {\n        await responder(\n          client,\n          msg.from,\n          transcricaoAudio?.mensagem ||\n            "🎤 Não consegui entender esse áudio. Pode tentar novamente ou escrever a mensagem? 😊"\n        );\n        return;\n      }\n\n      textoOriginal = String(transcricaoAudio.texto || "").trim();\n      console.log(\`🎤 Áudio recebido e transcrito (\${textoOriginal.length} caracteres).\`);\n    }\n\n    if (!textoOriginal) {`,
  "transcrição de áudio antes do atendimento"
);

substituirObrigatorio(
  '    const texto = limparTexto(textoOriginal);\n    let secretariaIdentificada = false;',
  `    const texto = limparTexto(textoOriginal);\n\n    const corrigidoAntesDoFluxo = await tentarCorrecoesAtendimento({\n      client,\n      msg,\n      textoOriginal,\n      texto,\n      sessao,\n      responder,\n    });\n    if (corrigidoAntesDoFluxo) return;\n\n    const tratadoNaturalmente = await tentarConversaNatural({\n      client,\n      msg,\n      textoOriginal,\n      texto,\n      sessao,\n      cursosUnifatecie: CURSOS_UNIFATECIE,\n      config: CONFIG,\n      responder,\n      tentarResponderComIA,\n      iaDisponivel,\n    });\n    if (tratadoNaturalmente) return;\n\n    let secretariaIdentificada = false;`,
  "interceptadores antes do fluxo estruturado"
);

substituirTodosObrigatorio(
  '    await responder(client, msg.from, finalizarMatriculaShekinah(sessao));',
  `    try {\n      await encaminharPreMatriculaShekinah({\n        sessao,\n        enviarMensagemParaSecretaria: (mensagem) =>\n          enviarMensagemParaSecretaria(client, mensagem),\n      });\n\n      const confirmacaoAluno = finalizarMatriculaShekinah(sessao)\n        .replace(\n          "\\nAgora a secretaria conferirá os dados e continuará a matrícula por esta conversa.\\nPara voltar ao atendimento automático, digite *m*.",\n          "\\n👩‍💼 A secretária da Shekinah recebeu os dados e dará continuidade quando necessário.\\n🤖 Você pode continuar falando comigo normalmente por aqui."\n        );\n\n      await responder(\n        client,\n        msg.from,\n        confirmacaoAluno +\n          "\\n\\n📨 *Os dados também foram enviados automaticamente para a secretária da Shekinah.* ✅"\n      );\n\n      sessao.atendimentoHumano = false;\n      sessao.etapa = "escolher_instituicao";\n      sessao.instituicao = null;\n      sessao.nome = "";\n      sessao.curso = "";\n      sessao.cursoAtual = null;\n      sessao.dados = {};\n      sessao.menorDeIdade = false;\n      sessao.acaoPendente = null;\n      sessao.historicoIA = [];\n      sessao.atualizadoEm = Date.now();\n    } catch (error) {\n      console.error("❌ Falha ao encaminhar pré-matrícula da Shekinah:", error?.message || error);\n      sessao.atendimentoHumano = false;\n      sessao.etapa = "menu_instituicao";\n      sessao.instituicao = "shekinah";\n\n      await responder(\n        client,\n        msg.from,\n        "⚠️ Seus dados foram preenchidos, mas não consegui encaminhá-los automaticamente para a secretária neste momento.\\n\\nA secretária *ainda não recebeu esta pré-matrícula*. Tente novamente em alguns instantes ou peça para falar com a secretária. 😊"\n      );\n    }`,
  "encaminhamento automático sem encerrar o atendimento"
);

const moduloBase = new Module(caminhoBase, module);
moduloBase.filename = caminhoBase;
moduloBase.paths = Module._nodeModulePaths(__dirname);
moduloBase._compile(codigo, caminhoBase);
