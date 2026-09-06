const assert = require("assert");

process.env.BOT_ADMIN_PHONE = process.env.BOT_ADMIN_PHONE || "5592000000000";

const conversa = require("./conversation-guard");
const suporte = require("./support-handoff-guard");
const eadDireto = require("./ead-direct-guard");
const inteligencia = require("./ead-inteligencia");
const instituicao = require("./institution-router");
const humano = require("./human-handoff-guard");

let total = 0;

function check(nome, fn) {
  try {
    fn();
    total += 1;
  } catch (error) {
    error.message = `[${nome}] ${error.message}`;
    throw error;
  }
}

async function checkAsync(nome, fn) {
  try {
    await fn();
    total += 1;
  } catch (error) {
    error.message = `[${nome}] ${error.message}`;
    throw error;
  }
}

function mockArgs(textoOriginal, sessao = {}) {
  const enviadas = [];
  const admin = [];
  const client = {
    async sendText(destino, texto) {
      admin.push({ destino, texto: String(texto) });
      return true;
    }
  };
  const msg = {
    from: "5592999999999@c.us",
    sender: { pushname: "Aluno Teste", id: { user: "5592999999999" } }
  };
  const responder = async (_client, destino, texto) => {
    enviadas.push({ destino, texto: String(texto) });
    return true;
  };
  return { client, msg, textoOriginal, sessao, responder, enviadas, admin };
}

async function run() {
  check("portal detectado", () => assert.equal(conversa.pedidoSuportePortal("Estou com um problema no meu portal"), true));
  check("alunonet detectado", () => assert.equal(conversa.pedidoSuportePortal("Não consigo entrar no AlunoNet"), true));
  check("curso não é portal", () => assert.equal(conversa.pedidoSuportePortal("Qual o valor do curso de Administração?"), false));
  check("pagamento pendente", () => assert.equal(conversa.pedidoPagamentoNaoCompensado("Paguei a mensalidade mas ela continua aberta"), true));
  check("suporte não é curso", () => assert.equal(conversa.pareceConsultaDeCurso(conversa.norm("Perdi meu RA e minha senha")), false));
  check("mensalidade não é curso", () => assert.equal(conversa.pareceConsultaDeCurso(conversa.norm("Minha mensalidade continua aberta")), false));

  await checkAsync("entrada de portal assume UniFatecie", async () => {
    const sessao = {};
    const a = mockArgs("Boa noite, estou com um problema no meu portal", sessao);
    const handled = await conversa.tentarConversaNatural(a);
    assert.equal(handled, true);
    assert.equal(sessao.instituicao, "unifatecie");
    assert.equal(sessao.assuntoAtual, "suporte_portal_unifatecie");
    assert.match(a.enviadas[0].texto, /UniFatecie/i);
    assert.doesNotMatch(a.enviadas[0].texto, /Shekinah/i);
  });

  await checkAsync("sessão antiga de portal recuperada", async () => {
    const sessao = { assuntoAtual: "suporte_portal_escolher_instituicao" };
    const a = mockArgs("?", sessao);
    const handled = await conversa.tentarConversaNatural(a);
    assert.equal(handled, true);
    assert.equal(sessao.instituicao, "unifatecie");
    assert.doesNotMatch(a.enviadas[0].texto, /Shekinah/i);
  });

  await checkAsync("perda de RA e senha entra no suporte seguro", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_portal_unifatecie" };
    const a = mockArgs("Perdi meu RA e minha senha", sessao);
    const handled = await suporte.tentarEncaminharSuporte(a);
    assert.equal(handled, true);
    assert.equal(sessao.assuntoAtual, "suporte_identificacao_unifatecie");
    assert.match(a.enviadas[0].texto, /nome completo/i);
    assert.match(a.enviadas[0].texto, /CPF/i);
    assert.match(a.enviadas[0].texto, /não envie sua senha/i);
  });

  await checkAsync("senha digitada é sanitizada no contexto", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_portal_unifatecie" };
    const a = mockArgs("Minha senha: segredo123 não funciona", sessao);
    await suporte.tentarEncaminharSuporte(a);
    assert.doesNotMatch(String(sessao.problemaSuporteOriginal), /segredo123/i);
  });

  await checkAsync("identificação incompleta não encaminha", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_identificacao_unifatecie" };
    const a = mockArgs("CPF 12345678901", sessao);
    const handled = await suporte.tentarEncaminharSuporte(a);
    assert.equal(handled, true);
    assert.equal(sessao.assuntoAtual, "suporte_identificacao_unifatecie");
    assert.match(a.enviadas[0].texto, /nome completo/i);
  });

  await checkAsync("identificação pode chegar em mensagens separadas", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_identificacao_unifatecie", problemaSuporteOriginal: "Perdi meu acesso" };
    const a1 = mockArgs("Carlos da Silva", sessao);
    await suporte.tentarEncaminharSuporte(a1);
    assert.equal(sessao.assuntoAtual, "suporte_identificacao_unifatecie");
    const a2 = mockArgs("CPF 12345678901", sessao);
    const handled = await suporte.tentarEncaminharSuporte(a2);
    assert.equal(handled, true);
    assert.equal(sessao.etapa, "atendimento_humano");
    assert.match(a2.enviadas[0].texto, /Já já um atendente/i);
    assert.doesNotMatch(a2.enviadas[0].texto, /30 minutos/i);
    assert.equal(a2.admin.length, 1);
  });

  check("frase financeira sem números é reconhecida", () => assert.equal(suporte.pedidoPagamentoNaoCompensado("Eu paguei uma mensalidade mas ela continua aberta pra eu pagar"), true));
  check("CPF sozinho não conclui financeiro", () => assert.equal(suporte.pareceDadosFinanceiros("CPF 12345678901"), false));
  check("dados financeiros completos", () => assert.equal(suporte.pareceDadosFinanceiros("RA 555666, CPF 12345678901, paguei 112,20"), true));

  await checkAsync("problema financeiro não vira suporte genérico", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_portal_unifatecie" };
    const a = mockArgs("Eu paguei uma mensalidade mas ela continua aberta pra eu pagar", sessao);
    const handled = await suporte.tentarEncaminharSuporte(a);
    assert.equal(handled, true);
    assert.equal(sessao.assuntoAtual, "suporte_pagamento_unifatecie");
    assert.match(a.enviadas[0].texto, /\bRA\b/i);
    assert.match(a.enviadas[0].texto, /\bCPF\b/i);
  });

  await checkAsync("financeiro aceita dados em etapas", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_pagamento_unifatecie" };
    const a1 = mockArgs("RA 555666", sessao);
    await suporte.tentarEncaminharSuporte(a1);
    assert.match(a1.enviadas[0].texto, /\bCPF\b/i);
    const a2 = mockArgs("CPF 12345678901", sessao);
    await suporte.tentarEncaminharSuporte(a2);
    assert.match(a2.enviadas[0].texto, /valor pago/i);
    const a3 = mockArgs("Paguei 112,20", sessao);
    const handled = await suporte.tentarEncaminharSuporte(a3);
    assert.equal(handled, true);
    assert.equal(sessao.etapa, "atendimento_humano");
    assert.match(a3.enviadas[0].texto, /Já já um atendente/i);
    assert.doesNotMatch(a3.enviadas[0].texto, /30 minutos/i);
    assert.equal(a3.admin.length, 1);
  });

  await checkAsync("encerrar tem prioridade em suporte", async () => {
    const sessao = { instituicao: "unifatecie", assuntoAtual: "suporte_pagamento_unifatecie" };
    const a = mockArgs("Encerrar atendimento", sessao);
    const handled = await suporte.tentarEncaminharSuporte(a);
    assert.equal(handled, true);
    assert.equal(sessao.assuntoAtual, null);
    assert.match(a.enviadas[0].texto, /Atendimento encerrado/i);
    assert.doesNotMatch(a.enviadas[0].texto, /\bRA\b|\bCPF\b|valor pago/i);
  });
  check("não quero encerrar não encerra", () => assert.equal(suporte.pediuEncerrarSuporte("não quero encerrar"), false));

  check("pedido de secretário", () => assert.equal(humano.pediuHumanoUniFatecie("Quero falar com o secretário", { instituicao: "unifatecie" }), true));
  check("pedido de atendente", () => assert.equal(humano.pediuHumanoUniFatecie("Quero falar com um atendente", { instituicao: "unifatecie" }), true));
  check("curso não pede humano", () => assert.equal(humano.pediuHumanoUniFatecie("Quero saber os cursos", { instituicao: "unifatecie" }), false));

  check("E A D normaliza", () => assert.equal(eadDireto.ehEadExplicito("E A D"), true));
  check("a distância normaliza", () => assert.equal(eadDireto.ehEadExplicito("curso a distância"), true));
  check("apoio EAD é genérico", () => assert.equal(eadDireto.ehPedidoGenericoEad("Boa noite, vocês têm cursos de apoio em E A D?"), true));
  check("maquiagem EAD é específico", () => assert.equal(eadDireto.ehPedidoGenericoEad("Tem curso de maquiagem EAD?"), false));
  check("apoio EAD vai para Shekinah", () => assert.equal(eadDireto.escopoEad("curso de apoio em E A D", { instituicao: "unifatecie" }), "shekinah"));
  check("graduação EAD vai para UniFatecie", () => assert.equal(eadDireto.escopoEad("graduação EAD", { instituicao: "shekinah" }), "unifatecie"));

  const catalogoFake = [
    { nome: "Supervisão Pedagógica" },
    { nome: "Auxiliar de Creche" },
    { nome: "Criação de Game Profissional" },
    { nome: "Lógica de Programação" },
    { nome: "Canva" },
    { nome: "Excel Básico e Avançado" }
  ];
  check("apoio recomenda Supervisão Pedagógica", () => {
    const r = inteligencia.recomendar(catalogoFake, "quero um curso de apoio", 4);
    assert.equal(r[0]?.nome, "Supervisão Pedagógica");
  });
  check("jogos recomenda Game", () => {
    const r = inteligencia.recomendar(catalogoFake, "quero aprender a desenvolver jogos", 4);
    assert.equal(r[0]?.nome, "Criação de Game Profissional");
  });
  check("opções é pedido de catálogo", () => assert.equal(inteligencia.ehPedidoCatalogo("me mostra as opções"), true));
  check("problema no portal não é objetivo de curso", () => assert.equal(inteligencia.parecePedidoPorObjetivo("estou com um problema no meu portal"), false));
  check("encerrar não é objetivo de curso", () => assert.equal(inteligencia.parecePedidoPorObjetivo("encerrar atendimento"), false));

  check("graduação ativa ensino superior", () => assert.equal(instituicao.querEnsinoSuperior(instituicao.norm("quero cursos de graduação")), true));
  check("lista de graduação", () => assert.equal(instituicao.querListaGraduacao(instituicao.norm("mostra todos os cursos de graduação")), true));
  check("ADS reconhecido", () => assert.equal(instituicao.cursoUnifatecieMencionado(instituicao.norm("quero saber de ADS")), "Análise e Desenvolvimento de Sistemas"));
  check("maquiagem Shekinah não ativa superior", () => assert.equal(instituicao.querEnsinoSuperior(instituicao.norm("curso de maquiagem da Shekinah")), false));

  check("boa noite isolado é saudação", () => assert.equal(conversa.saudacaoPura("Boa noite"), true));
  check("boa noite com problema não é saudação pura", () => assert.equal(conversa.saudacaoPura("Boa noite, estou com problema no portal"), false));
  check("financeiro é conversa de suporte", () => assert.equal(conversa.pareceConversaOuSuporte(conversa.norm("Minha mensalidade não baixou")), true));
  check("apoio é consulta de curso", () => assert.equal(conversa.pareceConsultaDeCurso(conversa.norm("quero curso de apoio")), true));

  console.log(`✅ Bateria de regressão aprovada: ${total} verificações.`);
}

run().catch((error) => {
  console.error("❌ Bateria de regressão falhou:", error.message || error);
  process.exit(1);
});