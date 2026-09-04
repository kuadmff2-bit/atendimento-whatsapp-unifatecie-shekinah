const fs = require("fs");
const path = require("path");
const Module = require("module");

console.log("🚪 Entrada principal: conversa natural integrada ao bot-base.");
const caminhoBase = path.join(__dirname, "legacy-index.js");
let codigo = fs.readFileSync(caminhoBase, "utf8");

function substituirObrigatorio(antigo, novo, nome) {
  if (!codigo.includes(antigo)) throw new Error(`Não foi possível integrar '${nome}' ao bot-base.`);
  codigo = codigo.replace(antigo, novo);
  console.log(`🔧 ${nome}.`);
}
function substituirTodosObrigatorio(antigo, novo, nome) {
  const ocorrencias = codigo.split(antigo).length - 1;
  if (ocorrencias < 1) throw new Error(`Não foi possível integrar '${nome}' ao bot-base.`);
  codigo = codigo.split(antigo).join(novo);
  console.log(`🔧 ${nome}: ${ocorrencias} ocorrência(s).`);
}

substituirObrigatorio(
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");',
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq-ext");\nconst { tentarConversaNatural } = require("./conversation-core-ext");\nconst { tentarCorrecoesAtendimento } = require("./atendimento-fixes");\nconst { encaminharPreMatriculaShekinah } = require("./shekinah-forward");\nconst { ehMensagemDeAudio, transcreverAudioWhatsApp } = require("./audio-groq");\nconst { tratarComandoAdmin, aplicarOverridesCursos, registrarEvento, registrarErro, carregarSessoesPersistidas, persistirSessoes } = require("./autonomia");\nconst CURSOS_EXTRA_UNIFATECIE = require("./catalogo-extra");',
  "módulos conversacionais, áudio e autonomia"
);
substituirObrigatorio('const CURSOS_UNIFATECIE = {','const CURSOS_UNIFATECIE = {\n  ...CURSOS_EXTRA_UNIFATECIE,',"catálogo extra");
substituirObrigatorio('\nconst CONFIG = {','\naplicarOverridesCursos(CURSOS_UNIFATECIE);\n\nconst CONFIG = {',"overrides persistentes");
substituirObrigatorio(
  'const sessoes = new Map();\nconst mensagensProcessadas = new Set();',
  'const sessoes = new Map(carregarSessoesPersistidas());\nconst mensagensProcessadas = new Set();\nconst intervaloPersistenciaSessoes = setInterval(() => persistirSessoes(sessoes), 15000);\nintervaloPersistenciaSessoes.unref();\nfunction salvarSessoesAntesDeSair(){ persistirSessoes(sessoes); }\nprocess.once("SIGTERM", salvarSessoesAntesDeSair);\nprocess.once("SIGINT", salvarSessoesAntesDeSair);',
  "memória persistente"
);
substituirObrigatorio('  const LIMITE_SESSAO = 30 * 60 * 1000;','  const LIMITE_SESSAO = 6 * 60 * 60 * 1000;',"janela de memória");

substituirObrigatorio(
  'async function responder(client, destino, mensagem) {\n  await delay(900);\n\n  const destinoResolvido = await resolverDestino(client, destino);',
  'async function responder(client, destino, mensagem) {\n  const sessaoDestino = sessoes.get(destino);\n  const etapaAtual = String(sessaoDestino?.etapa || "");\n  const fluxoCancelavel = etapaAtual.startsWith("unifatecie_matricula_") || etapaAtual.startsWith("shekinah_matricula_") || etapaAtual.startsWith("financeiro_") || etapaAtual.startsWith("shekinah_secretaria_");\n  mensagem = String(mensagem || "").trim();\n  const ehConfirmacaoFinal = /PRÉ-MATRÍCULA RECEBIDA|PRE-MATRICULA RECEBIDA/i.test(mensagem);\n  if (fluxoCancelavel && !ehConfirmacaoFinal && !/\\bcancelar\\b/i.test(mensagem)) mensagem += "\\n\\n❌ Para sair deste atendimento, digite *cancelar*.";\n  await delay(900);\n  const destinoResolvido = await resolverDestino(client, destino);',
  "cancelamento visível"
);

substituirObrigatorio(
  '    const sessao = obterSessao(msg.from);\n    const textoOriginal = typeof msg.body === "string" ? msg.body.trim() : "";',
  `    const sessao = obterSessao(msg.from);
    registrarEvento("mensagem");
    const textoDigitado = typeof msg.body === "string" ? msg.body.trim() : "";
    let destinoAdminResolvido = "";
    try { destinoAdminResolvido = await resolverDestino(client, msg.from); } catch (_) {}
    const identidadesAdminBase = [msg.from,destinoAdminResolvido,msg?.sender?.id?._serialized,msg?.sender?.id?.user,msg?.sender?.id,msg?.id?.remote?._serialized,msg?.id?.remote?.user,msg?.id?.remote,msg?.author,msg?.chatId].filter(Boolean);
    const identidadesAdminSet = new Set();
    for (const identidadeBase of identidadesAdminBase) {
      const identidade = String(identidadeBase || "").trim();
      if (!identidade) continue;
      identidadesAdminSet.add(identidade);
      const numero = identidade.split("@")[0].replace(/\\D/g, "");
      if (!numero.startsWith("55")) continue;
      if (numero.length === 13 && numero[4] === "9") {
        const sem9 = numero.slice(0,4)+numero.slice(5); identidadesAdminSet.add(sem9); identidadesAdminSet.add(sem9+"@c.us");
      } else if (numero.length === 12) {
        const com9 = numero.slice(0,4)+"9"+numero.slice(4); identidadesAdminSet.add(com9); identidadesAdminSet.add(com9+"@c.us");
      }
    }
    let respostaAdmin = null;
    for (const identidade of identidadesAdminSet) { respostaAdmin = tratarComandoAdmin(textoDigitado, identidade); if (respostaAdmin) break; }
    if (respostaAdmin) { aplicarOverridesCursos(CURSOS_UNIFATECIE); await responder(client,msg.from,respostaAdmin); persistirSessoes(sessoes); return; }
    let textoOriginal = textoDigitado;
    const mensagemEraAudio = ehMensagemDeAudio(msg);
    if (mensagemEraAudio) {
      registrarEvento("audio");
      const transcricaoAudio = await transcreverAudioWhatsApp(client,msg);
      if (!transcricaoAudio?.ok) { await responder(client,msg.from,transcricaoAudio?.mensagem || "🎤 Não consegui entender esse áudio. Pode tentar novamente ou escrever a mensagem? 😊"); return; }
      textoOriginal = String(transcricaoAudio.texto || "").trim(); sessao.ultimaTranscricaoAudio = textoOriginal; sessao.ultimoAudioEm = Date.now();
    }`,
  "administração e áudio"
);

substituirObrigatorio(
  '    const texto = limparTexto(textoOriginal);\n    let secretariaIdentificada = false;',
  `    const texto = limparTexto(textoOriginal);
    const comandoRetomarBot = /^(m|menu|menu principal|voltar ao menu|inicio|retomar bot|voltar pro light|voltar para o light)$/i.test(texto);
    if ((sessao.atendimentoHumano || sessao.etapa === "atendimento_humano") && !comandoRetomarBot) {
      // Atendimento humano em andamento: o Light fica totalmente silencioso para não interromper Carlos/secretaria.
      return;
    }
    if (/^(qual (e )?seu nome|qual o seu nome|como voce se chama|quem e voce|quem voce e|seu nome|nome)$/i.test(texto)) {
      await responder(client,msg.from,"🤖 Eu sou o *Light*, assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. Fui criado por *Carlos Olímpio*. 😊");
      return;
    }
    if (/^(oi+|ola+|opa+|alo+|ei+|e ai|hey+|hello|salve|bom dia|boa tarde|boa noite)$/i.test(texto)) {
      await responder(client,msg.from,"🤖 Olá! Eu sou o *Light*, assistente da *UniFatecie Polo Barreirinha* e da *Shekinah*. Fui criado por *Carlos Olímpio*. 😊 Como posso ajudar?");
      return;
    }
    if (!mensagemEraAudio) {
      const perguntouSobreAudio = /^(voce entendeu meu audio|entendeu meu audio|o que eu falei|oque eu falei|o que falei|qual foi meu audio|o que tinha no audio|o que eu disse no audio|repete meu audio)$/i.test(texto);
      if (perguntouSobreAudio) { const t=String(sessao.ultimaTranscricaoAudio||"").trim(); await responder(client,msg.from,t ? \`🎤 Sim. A última coisa que entendi do seu áudio foi:\\n\\n“\${t}”\` : "🎤 Não tenho uma transcrição de áudio salva nesta conversa. Se o áudio anterior falhou, pode enviar novamente. 😊"); return; }
    }
    const corrigidoAntesDoFluxo = await tentarCorrecoesAtendimento({client,msg,textoOriginal,texto,sessao,responder}); if (corrigidoAntesDoFluxo) return;
    const tratadoNaturalmente = await tentarConversaNatural({client,msg,textoOriginal,texto,sessao,cursosUnifatecie:CURSOS_UNIFATECIE,config:CONFIG,responder,tentarResponderComIA,iaDisponivel}); if (tratadoNaturalmente) return;
    let secretariaIdentificada = false;`,
  "interceptadores naturais, pausa humana e apresentação"
);

substituirObrigatorio('  } catch (error) {\n    console.error("❌ Erro no processamento da mensagem:", error);\n  }\n}','  } catch (error) {\n    registrarErro(error, "processarMensagem");\n    console.error("❌ Erro no processamento da mensagem:", error);\n  }\n}',"registro de erros");
substituirObrigatorio('  } catch (error) {\n    console.error("❌ Não foi possível iniciar o atendimento:", error);','  } catch (error) {\n    registrarErro(error, "iniciar WhatsApp");\n    console.error("❌ Não foi possível iniciar o atendimento:", error);',"erro de inicialização");

substituirTodosObrigatorio(
  '    await responder(client, msg.from, finalizarMatriculaShekinah(sessao));',
  `    try {
      await encaminharPreMatriculaShekinah({sessao,enviarMensagemParaSecretaria:(mensagem)=>enviarMensagemParaSecretaria(client,mensagem)});
      const confirmacaoAluno = finalizarMatriculaShekinah(sessao).replace("\\nAgora a secretaria conferirá os dados e continuará a matrícula por esta conversa.\\nPara voltar ao atendimento automático, digite *m*.","\\n👩‍💼 A secretária da Shekinah recebeu os dados e dará continuidade quando necessário.\\n🤖 Você pode continuar falando comigo normalmente por aqui.");
      await responder(client,msg.from,confirmacaoAluno+"\\n\\n📨 *Os dados também foram enviados automaticamente para a secretária da Shekinah.* ✅");
      sessao.atendimentoHumano=false; sessao.etapa="escolher_instituicao"; sessao.instituicao=null; sessao.nome=""; sessao.curso=""; sessao.cursoAtual=null; sessao.dados={}; sessao.menorDeIdade=false; sessao.acaoPendente=null; sessao.historicoIA=[]; sessao.atualizadoEm=Date.now(); persistirSessoes(sessoes);
    } catch(error) { registrarErro(error,"encaminhar matrícula Shekinah"); sessao.atendimentoHumano=false; sessao.etapa="menu_instituicao"; sessao.instituicao="shekinah"; await responder(client,msg.from,"⚠️ Seus dados foram preenchidos, mas não consegui encaminhá-los automaticamente para a secretária neste momento.\\n\\nA secretária *ainda não recebeu esta pré-matrícula*. Tente novamente em alguns instantes ou peça para falar com a secretária. 😊"); }`,
  "encaminhamento Shekinah"
);

// Corrige o estado de autenticação: QR lido não significa bot pronto.
substituirObrigatorio(
  '        if (["isLogged", "qrReadSuccess", "inChat"].includes(statusSession)) {\n          whatsappConectado = true;\n          qrCodeImagem = null;\n        }',
  '        if (["isLogged", "inChat"].includes(statusSession)) { whatsappConectado = true; qrCodeImagem = null; } else if (["notLogged", "qrReadFail", "disconnectedMobile", "deleteToken", "browserClose", "serverClose", "autocloseCalled"].includes(statusSession)) { whatsappConectado = false; }',
  "estado real de autenticação"
);
substituirObrigatorio('      logQR: false,','      logQR: true,',"QR nos logs");

const moduloBase = new Module(caminhoBase, module);
moduloBase.filename = caminhoBase;
moduloBase.paths = Module._nodeModulePaths(__dirname);
moduloBase._compile(codigo, caminhoBase);
