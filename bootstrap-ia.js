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

inserirDepois(
  'const crypto = require("crypto");\n',
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");\n',
  "imports"
);

inserirAntes(
  "async function enviarTextoDireto(client, destino, mensagem) {\n",
  `async function responderComIA(client, msg, textoOriginal, sessao) {\n  const respostaIA = await tentarResponderComIA({\n    textoOriginal,\n    sessao,\n    cursosUnifatecie: CURSOS_UNIFATECIE,\n    config: CONFIG,\n  });\n  if (!respostaIA) return false;\n  await responder(client, msg.from, respostaIA);\n  return true;\n}\n\nfunction descobrirInstituicaoPorTexto(texto) {\n  if (/unifatecie|fatecie|faculdade|pedagogia|analise e desenvolvimento|ads|gestao de recursos humanos|gestao financeira|logistica|processos gerenciais|sistemas para internet|design de moda/.test(texto)) return "unifatecie";\n  if (/shekinah|ingles|informatica|desenho|teclado|reforco|gestao empresarial|eja/.test(texto)) return "shekinah";\n  return null;\n}\n\nasync function tentarFluxoConversacional(client, msg, textoOriginal, texto, sessao) {\n  const etapasEstruturadas = [\n    "financeiro_nome", "financeiro_assunto",\n    "shekinah_secretaria_nome", "shekinah_secretaria_telefone", "shekinah_secretaria_problema"\n  ];\n  if (etapasEstruturadas.includes(sessao.etapa) || sessao.etapa.startsWith("unifatecie_matricula_") || sessao.etapa.startsWith("shekinah_matricula_")) {\n    return false;\n  }\n\n  const instituicaoDetectada = descobrirInstituicaoPorTexto(texto);\n  if (instituicaoDetectada) sessao.instituicao = instituicaoDetectada;\n\n  const querMatricula = /matricul|inscri|quero entrar|quero fazer o curso|quero estudar/.test(texto);\n  const querFinanceiro = /financeir|boleto|mensalidade|pagamento|paguei|divida|d[ií]vida|segunda via|vencimento/.test(texto);\n  const querHumano = /secretaria|atendente|pessoa|humano|falar com alguem|falar com alguém/.test(texto);\n\n  if (querMatricula) {\n    if (!sessao.instituicao) {\n      await responder(client, msg.from, "Claro 😊 Você quer fazer sua matrícula na *UniFatecie* ou na *Shekinah*?");\n      return true;\n    }\n    sessao.dados = {};\n    sessao.menorDeIdade = false;\n    sessao.etapa = sessao.instituicao === "unifatecie" ? "unifatecie_matricula_curso" : "shekinah_matricula_curso";\n    await responder(client, msg.from, "Perfeito 😊 Qual curso você deseja fazer?");\n    return true;\n  }\n\n  if (querFinanceiro) {\n    if (!sessao.instituicao) {\n      await responder(client, msg.from, "Consigo te ajudar com isso. É sobre a *UniFatecie* ou a *Shekinah*?");\n      return true;\n    }\n    sessao.etapa = "financeiro_nome";\n    await responder(client, msg.from, "Certo. Qual é o *nome completo do aluno*?");\n    return true;\n  }\n\n  if (querHumano) {\n    if (!sessao.instituicao) {\n      await responder(client, msg.from, "Claro. Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*?");\n      return true;\n    }\n    if (sessao.instituicao === "shekinah") {\n      sessao.dados = {};\n      sessao.etapa = "shekinah_secretaria_nome";\n      await responder(client, msg.from, "Claro. Qual é o seu *nome completo*?");\n      return true;\n    }\n    sessao.atendimentoHumano = true;\n    sessao.etapa = "atendimento_humano";\n    await responder(client, msg.from, "Certo. Encaminhei seu atendimento para a secretaria da UniFatecie. Um atendente continuará por esta conversa assim que estiver disponível.");\n    return true;\n  }\n\n  if (iaDisponivel()) {\n    return responderComIA(client, msg, textoOriginal, sessao);\n  }\n\n  return false;\n}\n\n`,
  "camada conversacional"
);

inserirAntes(
  '    const escolheuInstituicaoDiretamente =\n',
  `    if (!sessao.atendimentoHumano) {\n      const respondeuConversando = await tentarFluxoConversacional(client, msg, textoOriginal, texto, sessao);\n      if (respondeuConversando) return;\n    }\n\n`,
  "interceptor conversacional"
);

inserirDepois(
  '    console.log("🚀 Iniciando atendimento pelo WPPConnect...");\n',
  `    console.log(\n      iaDisponivel()\n        ? "🤖 IA conversacional ativada para o atendimento."\n        : "ℹ️ IA desativada: configure GROQ_API_KEY no Railway."\n    );\n`,
  "status da IA"
);

const moduloIndex = new Module(caminhoIndex, module);
moduloIndex.filename = caminhoIndex;
moduloIndex.paths = Module._nodeModulePaths(__dirname);
moduloIndex._compile(codigo, caminhoIndex);
