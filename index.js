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

substituirObrigatorio(
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");',
  'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");\nconst { tentarConversaNatural } = require("./conversation-core");\nconst CURSOS_EXTRA_UNIFATECIE = require("./catalogo-extra");',
  "módulos conversacionais"
);

substituirObrigatorio(
  'const CURSOS_UNIFATECIE = {',
  'const CURSOS_UNIFATECIE = {\n  ...CURSOS_EXTRA_UNIFATECIE,',
  "catálogo extra da UniFatecie"
);

substituirObrigatorio(
  '    const texto = limparTexto(textoOriginal);\n    let secretariaIdentificada = false;',
  `    const texto = limparTexto(textoOriginal);\n\n    const tratadoNaturalmente = await tentarConversaNatural({\n      client,\n      msg,\n      textoOriginal,\n      texto,\n      sessao,\n      cursosUnifatecie: CURSOS_UNIFATECIE,\n      config: CONFIG,\n      responder,\n      tentarResponderComIA,\n      iaDisponivel,\n    });\n    if (tratadoNaturalmente) return;\n\n    let secretariaIdentificada = false;`,
  "interceptador de conversa natural"
);

const moduloBase = new Module(caminhoBase, module);
moduloBase.filename = caminhoBase;
moduloBase.paths = Module._nodeModulePaths(__dirname);
moduloBase._compile(codigo, caminhoBase);
