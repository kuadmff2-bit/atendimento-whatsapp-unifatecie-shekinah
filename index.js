const fs = require("fs");
const path = require("path");
const Module = require("module");

console.log("🚪 Entrada principal: atendimento conversacional com IA.");

const caminhoGateway = path.join(__dirname, "gateway-ia.js");
let codigoGateway = fs.readFileSync(caminhoGateway, "utf8");

function substituirObrigatorio(antigo, novo, nome) {
  if (!codigoGateway.includes(antigo)) {
    throw new Error(`Não foi possível aplicar a correção '${nome}'.`);
  }
  codigoGateway = codigoGateway.replace(antigo, novo);
}

// O gateway original aponta para index.js. Nesta entrada única, ele deve iniciar o bot-base.
substituirObrigatorio(
  'require("./index.js");',
  'require("./legacy-index.js");',
  "inicialização do bot-base"
);

// Entender pedidos como "quero valores dos cursos da UniFatecie" sem exigir menu numérico.
substituirObrigatorio(
  '  const querCursos = /(quais|lista|mostrar|mostra|tem|oferece|ofertam).*(curso|cursos)|(curso|cursos).*(tem|oferece|quais|lista)/.test(texto);',
  '  const querCursos = /(quais|lista|mostrar|mostra|tem|oferece|ofertam|valor|valores|preco|precos).*(curso|cursos)|(curso|cursos).*(tem|oferece|quais|lista|valor|valores|preco|precos)/.test(texto);',
  "intenção de cursos"
);

// Se o usuário disser apenas "curso de Pedagogia", já responder os detalhes do curso.
substituirObrigatorio(
  '  if (curso && querDetalheCurso) {',
  '  if (curso && (querDetalheCurso || /\\bcurso\\b/.test(texto))) {',
  "detalhes por nome do curso"
);

// Uma conversa comum nunca deve cair automaticamente no menu antigo.
substituirObrigatorio(
  '  if (sessao.instituicao) {\n    await responder(client, msg.from, "😊 Pode me explicar um pouquinho mais o que você quer saber?");\n    return true;\n  }\n\n  return false;\n}',
  '  if (sessao.instituicao) {\n    await responder(client, msg.from, "😊 Pode me explicar um pouquinho mais o que você quer saber?");\n    return true;\n  }\n\n  await responder(\n    client,\n    msg.from,\n    "🤖 Estou aqui! 😊 Pode falar comigo normalmente. Você quer informações da *UniFatecie* ou da *Shekinah*?"\n  );\n  return true;\n}',
  "fallback conversacional"
);

const moduloGateway = new Module(caminhoGateway, module);
moduloGateway.filename = caminhoGateway;
moduloGateway.paths = Module._nodeModulePaths(__dirname);
moduloGateway._compile(codigoGateway, caminhoGateway);
