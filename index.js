const fs = require("fs");
const path = require("path");
const Module = require("module");

console.log("🚪 Entrada principal: gateway conversacional com IA.");

const caminhoGateway = path.join(__dirname, "gateway-ia.js");
let codigoGateway = fs.readFileSync(caminhoGateway, "utf8");
const marcador = 'require("./index.js");';

if (!codigoGateway.includes(marcador)) {
  throw new Error("Gateway de IA sem marcador de inicialização esperado.");
}

codigoGateway = codigoGateway.replace(marcador, 'require("./legacy-index.js");');

const moduloGateway = new Module(caminhoGateway, module);
moduloGateway.filename = caminhoGateway;
moduloGateway.paths = Module._nodeModulePaths(__dirname);
moduloGateway._compile(codigoGateway, caminhoGateway);
