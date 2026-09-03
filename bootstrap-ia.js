const fs = require("fs");
const path = require("path");
const Module = require("module");

const caminhoIndex = path.join(__dirname, "index.js");
const codigoOriginal = fs.readFileSync(caminhoIndex, "utf8");
let codigo = codigoOriginal;

function inserirAntes(marcador, adicao, nome) {
  if (codigo.includes(adicao.trim())) return true;
  const posicao = codigo.indexOf(marcador);
  if (posicao < 0) {
    console.warn(`⚠️ Integração IA: marcador '${nome}' não encontrado.`);
    return false;
  }
  codigo = codigo.slice(0, posicao) + adicao + codigo.slice(posicao);
  return true;
}

function substituirUmaVez(antigo, novo, nome) {
  if (codigo.includes(novo)) return true;
  if (!codigo.includes(antigo)) {
    console.warn(`⚠️ Integração IA: bloco '${nome}' não encontrado.`);
    return false;
  }
  codigo = codigo.replace(antigo, novo);
  return true;
}

const camadaConversacional = `async function responderComIAConversacional(client, msg, textoOriginal, sessao) {\n  const respostaIA = await tentarResponderComIA({\n    textoOriginal,\n    sessao,\n    cursosUnifatecie: CURSOS_UNIFATECIE,\n    config: CONFIG,\n  });\n  if (!respostaIA) return false;\n  await responder(client, msg.from, respostaIA);\n  return true;\n}\n\nfunction descobrirInstituicaoPorTextoIA(texto) {\n  if (/unifatecie|fatecie|faculdade|pedagogia|analise e desenvolvimento|\\bads\\b|gestao de recursos humanos|gestao financeira|logistica|processos gerenciais|sistemas para internet|design de moda/.test(texto)) return "unifatecie";\n  if (/shekinah|ingles|informatica|desenho|teclado|reforco|gestao empresarial|\\beja\\b/.test(texto)) return "shekinah";\n  return null;\n}\n\nfunction descobrirCursoUnifatecieIA(texto) {\n  return Object.values(CURSOS_UNIFATECIE).find((curso) => texto.includes(limparTexto(curso.nome))) || null;\n}\n\nfunction listaCursosUnifatecieIA() {\n  return Object.values(CURSOS_UNIFATECIE)\n    .map((curso) => \`\${curso.emoji} \${curso.nome}\`)\n    .join("\\n");\n}\n\nasync function tentarFluxoConversacionalIA(client, msg, textoOriginal, texto, sessao) {\n  const etapasEstruturadas = [\n    "financeiro_nome",\n    "financeiro_assunto",\n    "shekinah_secretaria_nome",\n    "shekinah_secretaria_telefone",\n    "shekinah_secretaria_problema",\n  ];\n\n  if (\n    etapasEstruturadas.includes(sessao.etapa) ||\n    sessao.etapa.startsWith("unifatecie_matricula_") ||\n    sessao.etapa.startsWith("shekinah_matricula_")\n  ) {\n    return false;\n  }\n\n  const instituicaoDetectada = descobrirInstituicaoPorTextoIA(texto);\n  if (instituicaoDetectada) sessao.instituicao = instituicaoDetectada;\n\n  if (sessao.acaoPendente && sessao.instituicao) {\n    texto += \` \${sessao.acaoPendente}\`;\n  }\n\n  const querMatricula = /matricul|inscri|quero entrar|quero fazer|quero estudar/.test(texto);\n  const querFinanceiro = /financeir|boleto|mensalidade|pagamento|paguei|divida|segunda via|vencimento/.test(texto);\n  const querHumano = /secretaria|atendente|humano|falar com alguem|falar com alguém|falar com uma pessoa/.test(texto);\n  const querListaCursos = /(quais|qual|lista|mostrar|mostra|tem|oferece|ofertam|cursos).*(curso|cursos)|(curso|cursos).*(tem|oferece|quais|lista)/.test(texto);\n\n  if (querMatricula) {\n    if (!sessao.instituicao) {\n      sessao.acaoPendente = "matricula";\n      await responder(client, msg.from, "📝 Claro! Sua matrícula é para a *UniFatecie* ou para a *Shekinah*? 😊");\n      return true;\n    }\n\n    sessao.acaoPendente = null;\n    sessao.dados = {};\n    sessao.menorDeIdade = false;\n\n    if (sessao.instituicao === "unifatecie") {\n      const curso = descobrirCursoUnifatecieIA(texto);\n      if (curso) {\n        sessao.curso = curso.nome;\n        sessao.dados.curso = curso.nome;\n        sessao.etapa = "unifatecie_matricula_nome";\n        await responder(client, msg.from, \`📝 Perfeito! Vamos iniciar sua pré-matrícula em *\${curso.nome}*. 😊\\n\\n👤 Qual é o *nome completo do aluno*?\`);\n        return true;\n      }\n      sessao.etapa = "unifatecie_matricula_curso";\n    } else {\n      sessao.etapa = "shekinah_matricula_curso";\n    }\n\n    await responder(client, msg.from, "🎓 Perfeito! Qual curso você deseja fazer? 😊");\n    return true;\n  }\n\n  if (querFinanceiro) {\n    if (!sessao.instituicao) {\n      sessao.acaoPendente = "financeiro";\n      await responder(client, msg.from, "💳 Consigo te ajudar. É sobre a *UniFatecie* ou a *Shekinah*? 😊");\n      return true;\n    }\n    sessao.acaoPendente = null;\n    sessao.etapa = "financeiro_nome";\n    await responder(client, msg.from, "💳 Certo! Qual é o *nome completo do aluno*?");\n    return true;\n  }\n\n  if (querHumano) {\n    if (!sessao.instituicao) {\n      sessao.acaoPendente = "secretaria";\n      await responder(client, msg.from, "👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊");\n      return true;\n    }\n    sessao.acaoPendente = null;\n    if (sessao.instituicao === "shekinah") {\n      sessao.dados = {};\n      sessao.etapa = "shekinah_secretaria_nome";\n      await responder(client, msg.from, "👩‍💼 Claro! Qual é o seu *nome completo*?");\n      return true;\n    }\n    sessao.atendimentoHumano = true;\n    sessao.etapa = "atendimento_humano";\n    await responder(client, msg.from, "✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼");\n    return true;\n  }\n\n  const curso = descobrirCursoUnifatecieIA(texto);\n  if (curso && /(valor|preco|preço|mensalidade|custa|duracao|duração|tempo|estagio|estágio)/.test(texto)) {\n    await responder(\n      client,\n      msg.from,\n      \`\${curso.emoji} *\${curso.nome}*\\n💰 Mensalidade: *\${curso.mensalidade}*\\n⏳ Duração: *\${curso.duracao}*\\n🎓 Formação: *\${curso.formacao}*\\n📚 Estágio: *\${curso.estagio}*\`\n    );\n    return true;\n  }\n\n  if (querListaCursos && sessao.instituicao === "unifatecie") {\n    await responder(\n      client,\n      msg.from,\n      \`🎓 Temos estas opções mais procuradas no Polo de Barreirinha:\\n\\n\${listaCursosUnifatecieIA()}\\n\\n😊 Quer saber o valor, duração ou detalhes de algum deles?\`\n    );\n    return true;\n  }\n\n  if (iaDisponivel()) {\n    return responderComIAConversacional(client, msg, textoOriginal, sessao);\n  }\n\n  return false;\n}\n\n`;

const helperOk = inserirAntes(
  "async function enviarTextoDireto(client, destino, mensagem) {\n",
  camadaConversacional,
  "camada conversacional"
);

const blocoMenuAntigo = `    if (comandoMenu || comandoInicio) {\n      sessoes.set(msg.from, novaSessao());\n      await responder(client, msg.from, menuInicial());\n      return;\n    }\n`;

const blocoMenuNovo = `    if (comandoMenu) {\n      sessoes.set(msg.from, novaSessao());\n      await responder(\n        client,\n        msg.from,\n        \`${obterSaudacao()}! 👋😊\\n\\nPode falar comigo normalmente. Posso ajudar com 🎓 cursos e matrícula, 💳 financeiro ou 👩‍💼 secretaria.\`\n      );\n      return;\n    }\n`;

const menuOk = substituirUmaVez(blocoMenuAntigo, blocoMenuNovo, "menu conversacional");

const interceptorOk = inserirAntes(
  "    const escolheuInstituicaoDiretamente =\n",
  `    if (!sessao.atendimentoHumano) {\n      const respondeuConversando = await tentarFluxoConversacionalIA(client, msg, textoOriginal, texto, sessao);\n      if (respondeuConversando) return;\n    }\n\n`,
  "interceptor conversacional"
);

substituirUmaVez(
  `    await responder(\n      client,\n      msg.from,\n      "💳 *Escolha o dia de vencimento da mensalidade:*\\n\\n" +\n        "1️⃣ Dia 05\\n" +\n        "2️⃣ Dia 07\\n" +\n        "3️⃣ Dia 10\\n\\n" +\n        "Digite apenas *1*, *2* ou *3*."\n    );\n`,
  `    await responder(\n      client,\n      msg.from,\n      "💳 Qual dia você prefere para o vencimento da mensalidade: *05, 07 ou 10*? 😊"\n    );\n`,
  "vencimento natural"
);

if (!helperOk || !menuOk || !interceptorOk) {
  console.error("⚠️ A camada conversacional não pôde ser aplicada por completo. Iniciando o bot original para evitar queda do serviço.");
  require("./index.js");
} else {
  try {
    const moduloIndex = new Module(caminhoIndex, module);
    moduloIndex.filename = caminhoIndex;
    moduloIndex.paths = Module._nodeModulePaths(__dirname);
    moduloIndex._compile(codigo, caminhoIndex);
  } catch (error) {
    console.error("❌ Falha ao carregar a camada conversacional. Iniciando o bot original:", error?.message || error);
    require("./index.js");
  }
}
