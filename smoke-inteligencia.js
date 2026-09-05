const assert = require("assert");
const I = require("./ead-inteligencia");

const catalogo = [
  { nome: "Criação de Game Profissional" },
  { nome: "Lógica de Programação" },
  { nome: "Blender 3D" },
  { nome: "Introdução à Informática" },
  { nome: "Excel Básico e Avançado" }
];

for (const frase of [
  "Quero saber dos cursos",
  "Me mostra as opções",
  "Quais cursos vocês têm?",
  "Quero informações sobre os cursos",
  "Cursos"
]) {
  assert.strictEqual(I.ehPedidoCatalogo(frase), true, `Deveria reconhecer catálogo: ${frase}`);
  assert.strictEqual(I.parecePedidoPorObjetivo(frase), false, `Não deveria buscar curso específico: ${frase}`);
}

for (const frase of [
  "Quero curso de informática",
  "Tem curso pra desenvolver jogos?",
  "Quero aprender a fazer jogos"
]) {
  assert.strictEqual(I.parecePedidoPorObjetivo(frase), true, `Deveria reconhecer objetivo: ${frase}`);
}

const jogos = I.recomendar(catalogo, "Tem curso pra desenvolver jogos?", 5);
assert.ok(jogos.length > 0, "Deveria recomendar cursos para jogos");
assert.strictEqual(jogos[0].nome, "Criação de Game Profissional", "Game Profissional deve ser a prioridade");

const info = I.recomendar(catalogo, "Quero curso de informática", 5);
assert.ok(info.some(c => c.nome === "Introdução à Informática"), "Deveria localizar Introdução à Informática");

console.log("✅ Smoke tests de inteligência do Light passaram.");