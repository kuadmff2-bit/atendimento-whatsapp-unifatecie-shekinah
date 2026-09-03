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
  if (!codigo.includes(antigo)) throw new Error(`Falha ao integrar IA: bloco '${nome}' não encontrado.`);
  codigo = codigo.replace(antigo, novo);
}

inserirDepois(
  'const crypto = require("crypto");\n',
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");\n',
  "imports"
);

inserirAntes(
  "async function enviarTextoDireto(client, destino, mensagem) {\n",
  `async function responderComIA(client, msg, textoOriginal, sessao) {\n  const respostaIA = await tentarResponderComIA({\n    textoOriginal,\n    sessao,\n    cursosUnifatecie: CURSOS_UNIFATECIE,\n    config: CONFIG,\n  });\n  if (!respostaIA) return false;\n  await responder(client, msg.from, respostaIA);\n  return true;\n}\n\nfunction descobrirInstituicaoPorTexto(texto) {\n  if (/unifatecie|fatecie|faculdade|pedagogia|analise e desenvolvimento|ads|gestao de recursos humanos|gestao financeira|logistica|processos gerenciais|sistemas para internet|design de moda/.test(texto)) return "unifatecie";\n  if (/shekinah|ingles|informatica|desenho|teclado|reforco|gestao empresarial|eja/.test(texto)) return "shekinah";\n  return null;\n}\n\nfunction descobrirCursoUnifatecie(texto) {\n  return Object.values(CURSOS_UNIFATECIE).find((curso) => texto.includes(limparTexto(curso.nome))) || null;\n}\n\nasync function tentarFluxoConversacional(client, msg, textoOriginal, texto, sessao) {\n  const etapasEstruturadas = [\n    "financeiro_nome", "financeiro_assunto",\n    "shekinah_secretaria_nome", "shekinah_secretaria_telefone", "shekinah_secretaria_problema"\n  ];\n  if (etapasEstruturadas.includes(sessao.etapa) || sessao.etapa.startsWith("unifatecie_matricula_") || sessao.etapa.startsWith("shekinah_matricula_")) {\n    return false;\n  }\n\n  const instituicaoDetectada = descobrirInstituicaoPorTexto(texto);\n  if (instituicaoDetectada) sessao.instituicao = instituicaoDetectada;\n\n  let querMatricula = /matricul|inscri|quero entrar|quero fazer o curso|quero estudar/.test(texto);\n  let querFinanceiro = /financeir|boleto|mensalidade|pagamento|paguei|divida|d[ií]vida|segunda via|vencimento/.test(texto);\n  let querHumano = /secretaria|atendente|pessoa|humano|falar com alguem|falar com alguém/.test(texto);\n\n  if (sessao.acaoPendente && sessao.instituicao) {\n    querMatricula = querMatricula || sessao.acaoPendente === "matricula";\n    querFinanceiro = querFinanceiro || sessao.acaoPendente === "financeiro";\n    querHumano = querHumano || sessao.acaoPendente === "secretaria";\n  }\n\n  if (querMatricula) {\n    if (!sessao.instituicao) {\n      sessao.acaoPendente = "matricula";\n      await responder(client, msg.from, "Claro 😊 Sua matrícula é para a *UniFatecie* ou para a *Shekinah*?");\n      return true;\n    }\n\n    sessao.acaoPendente = null;\n    sessao.dados = {};\n    sessao.menorDeIdade = false;\n\n    if (sessao.instituicao === "unifatecie") {\n      const curso = descobrirCursoUnifatecie(texto);\n      if (curso) {\n        sessao.curso = curso.nome;\n        sessao.dados.curso = curso.nome;\n        sessao.etapa = "unifatecie_matricula_nome";\n        await responder(client, msg.from, `Perfeito 😊 Vamos iniciar sua pré-matrícula em *${curso.nome}*. Qual é o *nome completo do aluno*?`);\n        return true;\n      }\n      sessao.etapa = "unifatecie_matricula_curso";\n    } else {\n      sessao.etapa = "shekinah_matricula_curso";\n    }\n\n    await responder(client, msg.from, "Perfeito 😊 Qual curso você deseja fazer?");\n    return true;\n  }\n\n  if (querFinanceiro) {\n    if (!sessao.instituicao) {\n      sessao.acaoPendente = "financeiro";\n      await responder(client, msg.from, "Consigo te ajudar com isso. É da *UniFatecie* ou da *Shekinah*?");\n      return true;\n    }\n    sessao.acaoPendente = null;\n    sessao.etapa = "financeiro_nome";\n    await responder(client, msg.from, "Certo. Qual é o *nome completo do aluno*?");\n    return true;\n  }\n\n  if (querHumano) {\n    if (!sessao.instituicao) {\n      sessao.acaoPendente = "secretaria";\n      await responder(client, msg.from, "Claro. Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*?");\n      return true;\n    }\n    sessao.acaoPendente = null;\n    if (sessao.instituicao === "shekinah") {\n      sessao.dados = {};\n      sessao.etapa = "shekinah_secretaria_nome";\n      await responder(client, msg.from, "Claro. Qual é o seu *nome completo*?");\n      return true;\n    }\n    sessao.atendimentoHumano = true;\n    sessao.etapa = "atendimento_humano";\n    await responder(client, msg.from, "Certo. Encaminhei seu atendimento para a secretaria da UniFatecie. Um atendente continuará por esta conversa assim que estiver disponível.");\n    return true;\n  }\n\n  if (iaDisponivel()) return responderComIA(client, msg, textoOriginal, sessao);\n  return false;\n}\n\n`,
  "camada conversacional"
);

substituirUmaVez(
  `    if (comandoMenu || comandoInicio) {\n      sessoes.set(msg.from, novaSessao());\n      await responder(client, msg.from, menuInicial());\n      return;\n    }\n`,
  `    if (comandoMenu || comandoInicio) {\n      sessoes.set(msg.from, novaSessao());\n      await responder(\n        client,\n        msg.from,\n        \`${obterSaudacao()}! 😊 Sou a assistente virtual da *UniFatecie Polo Barreirinha* e da *Shekinah*.\\n\\nPode falar comigo normalmente e me dizer o que você precisa.\`\n      );\n      return;\n    }\n`,
  "saudação sem menu"
);

substituirUmaVez(
  `    await responder(\n      client,\n      msg.from,\n      "💳 *Escolha o dia de vencimento da mensalidade:*\\n\\n" +\n        "1️⃣ Dia 05\\n" +\n        "2️⃣ Dia 07\\n" +\n        "3️⃣ Dia 10\\n\\n" +\n        "Digite apenas *1*, *2* ou *3*."\n    );\n`,
  `    await responder(\n      client,\n      msg.from,\n      "💳 Qual dia você prefere para o vencimento da mensalidade: *05, 07 ou 10*?"\n    );\n`,
  "vencimento sem menu numérico"
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
