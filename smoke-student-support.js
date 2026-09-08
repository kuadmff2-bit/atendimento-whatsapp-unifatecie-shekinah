const assert = require("assert");
const S = require("./unifatecie-student-support");

let total = 0;
function eq(nome, atual, esperado) {
  assert.strictEqual(atual, esperado, `${nome}: esperado ${esperado}, veio ${atual}`);
  total += 1;
}
function ok(nome, valor) {
  assert.ok(valor, nome);
  total += 1;
}

const U = { instituicao: "unifatecie" };

const casos = [
  // LIVE / AULAS AO VIVO
  ["live chat 1", "Na live não aparece o botão de responder", "live_interacao"],
  ["live chat 2", "Estou na aula ao vivo e não tem campo para mandar mensagem", "live_interacao"],
  ["live chat 3", "Como faço para interagir com a professora na live?", "live_interacao"],
  ["live presença 1", "A live é obrigatória para presença?", "live_presenca"],
  ["live presença 2", "Se eu não entrar na live eu levo falta?", "live_presenca"],
  ["live presença 3", "A professora faz chamada na aula ao vivo?", "live_presenca"],
  ["live gravação 1", "Perdi a live, fica gravada?", "live_gravacao"],
  ["live gravação 2", "Posso assistir a transmissão depois?", "live_gravacao"],
  ["live gravação 3", "Não assisti a live ontem, tem replay?", "live_gravacao"],
  ["live acesso 1", "Não aparece o link da live", "live_acesso"],
  ["live acesso 2", "Onde eu entro para assistir a aula ao vivo?", "live_acesso"],
  ["live acesso 3", "A live não abre no horário", "live_acesso"],
  ["live geral", "Tenho uma dúvida sobre a live de hoje", "live_geral"],

  // AVALIAÇÕES / NOTAS
  ["prova 1", "Minha prova não aparece no portal", "avaliacoes"],
  ["prova 2", "Quando é a segunda chamada da avaliação?", "avaliacoes"],
  ["prova 3", "A AV3 deu erro e não abriu", "avaliacoes"],
  ["prova 4", "Qual o prazo para fazer a AV4?", "avaliacoes"],
  ["nota 1", "Minha nota da prova não apareceu", "notas"],
  ["nota 2", "A nota lançada está errada", "notas"],
  ["nota 3", "Minha média no boletim não bate", "notas"],

  // DISCIPLINAS / ATIVIDADES
  ["disciplina 1", "Minha disciplina sumiu do portal", "disciplinas"],
  ["disciplina 2", "Uma matéria não aparece para mim", "disciplinas"],
  ["disciplina 3", "Não consigo acessar minha disciplina", "disciplinas"],
  ["atividade 1", "A atividade não aparece e o prazo termina hoje", "atividades"],
  ["atividade 2", "Não consigo enviar o trabalho da disciplina", "atividades"],
  ["atividade 3", "O fórum sumiu do portal", "atividades"],

  // DOCUMENTOS
  ["gendocs 1", "Como envio meus documentos no GENDOCS?", "documentos"],
  ["gendocs 2", "Meu documento foi rejeitado no GENDOCS", "documentos"],
  ["gendocs 3", "A documentação ainda está pendente", "documentos"],

  // REMATRÍCULA / MATRÍCULA
  ["rematricula 1", "Como faço a rematrícula?", "rematricula"],
  ["rematricula 2", "Minha rematrícula não liberou", "rematricula"],
  ["status matricula 1", "Minha matrícula aparece pendente", "status_matricula"],
  ["status matricula 2", "Como vejo se minha matrícula está ativa?", "status_matricula"],

  // ESTÁGIO
  ["estagio 1", "Tenho dúvida sobre estágio obrigatório", "estagio"],
  ["estagio 2", "Como funciona o termo de estágio?", "estagio"],
  ["estagio 3", "A escola precisa ter convênio de estágio?", "estagio"],

  // APP / CARTEIRINHA
  ["carteirinha 1", "Minha carteirinha digital não aparece", "carteirinha_app"],
  ["carteirinha 2", "Como entro no app UniFatecie para ver a carteira estudantil?", "carteirinha_app"],

  // FINANCEIRO SEM INVADIR FLUXO DE PAGAMENTO NÃO COMPENSADO
  ["boleto 1", "Quero a segunda via do boleto", "boleto"],
  ["boleto 2", "Onde fica a ficha financeira?", "boleto"],
  ["boleto 3", "Meu boleto está com valor diferente", "boleto"],
  ["vencimento 1", "Qual o vencimento da minha mensalidade?", "vencimento"],
  ["vencimento 2", "Que dia vence meu boleto?", "vencimento"],
  ["negociacao 1", "Quero negociar uma dívida atrasada", "negociacao"],
  ["negociacao 2", "Dá para fazer acordo e parcelar a dívida?", "negociacao"],

  // REQUERIMENTOS / DOCUMENTOS ACADÊMICOS
  ["requerimento 1", "Como faço um requerimento no AlunoNet?", "requerimento"],
  ["requerimento 2", "Onde acompanho o protocolo da solicitação?", "requerimento"],
  ["diploma 1", "Como vejo se meu diploma já foi liberado?", "certificado_diploma"],
  ["diploma 2", "Tenho dúvida sobre certificado de conclusão", "certificado_diploma"],
  ["declaracao 1", "Preciso de uma declaração de matrícula", "declaracao"],
  ["declaracao 2", "Onde pego comprovante de matrícula?", "declaracao"],

  // EXTENSÃO / COMPLEMENTARES
  ["extensao 1", "Quantas horas de extensão curricular faltam?", "complementares_extensao"],
  ["extensao 2", "Como envio atividades complementares?", "complementares_extensao"],
  ["extensao 3", "Essa atividade vale como horas complementares?", "complementares_extensao"],

  // TRANSFERÊNCIA / APROVEITAMENTO
  ["aproveitamento 1", "Quero aproveitar uma disciplina de outra faculdade", "transferencia_aproveitamento"],
  ["aproveitamento 2", "Como peço equivalência de matéria?", "transferencia_aproveitamento"],
  ["transferencia 1", "Tenho dúvida sobre transferência e dispensa de disciplina", "transferencia_aproveitamento"],

  // TUTORIA / CALENDÁRIO
  ["tutoria 1", "Como falo com o tutor sobre uma dúvida da matéria?", "tutoria"],
  ["tutoria 2", "A professora não responde minha mensagem", "tutoria"],
  ["calendario 1", "Onde vejo o calendário acadêmico?", "calendario"],
  ["calendario 2", "Quero ver o cronograma da disciplina", "calendario"],
  ["calendario 3", "Qual a data da prova no calendário?", "calendario"],
];

for (const [nome, frase, esperado] of casos) eq(nome, S.detectarIntencao(frase, U), esperado);

// CONTINUIDADE DE CONTEXTO CURTO
const live = { instituicao: "unifatecie", suporteAluno: { intencao: "live_interacao" } };
eq("follow-up normal", S.detectarIntencao("É normal?", live), "live_interacao");
eq("follow-up presença", S.detectarIntencao("e a presença?", live), "live_presenca");
eq("follow-up perdeu", S.detectarIntencao("e se eu perder?", live), "live_gravacao");
eq("follow-up chat", S.detectarIntencao("e o botão do chat?", { instituicao: "unifatecie", suporteAluno: { intencao: "live_acesso" } }), "live_interacao");

const docs = { instituicao: "unifatecie", suporteAluno: { intencao: "documentos" } };
eq("follow-up documento", S.detectarIntencao("não aparece", docs), "documentos");

// NEGATIVOS: NÃO SEQUESTRAR OUTROS FLUXOS
const negativos = [
  "Quero saber os cursos",
  "Quais cursos vocês têm?",
  "Quero me matricular em Pedagogia",
  "Qual o valor do curso de Administração?",
  "Quero cancelar minha matrícula",
  "Quero trancar a faculdade",
  "Perdi meu RA e minha senha",
  "Não consigo entrar no AlunoNet porque esqueci a senha",
  "Já paguei e continua aparecendo em atraso",
  "Paguei minha mensalidade e não baixou",
  "Quero falar com um atendente",
  "Quero falar com o secretário",
  "Tem curso de maquiagem na Shekinah?",
  "Quanto custa o EAD da Shekinah?",
];
for (const frase of negativos) eq(`negativo: ${frase}`, S.detectarIntencao(frase, U), null);

// CONTEXTO DE INSTITUIÇÃO
ok("unifatecie explícita", S.contextoUnifatecie("problema no AlunoNet", {}));
ok("sinal forte de aluno", S.contextoUnifatecie("minha disciplina sumiu", {}));
eq("shekinah não é unifatecie", S.contextoUnifatecie("curso da Shekinah", {}), false);

// ESCALONAMENTO APÓS TENTATIVAS
ok("escala disciplina persistente", S.deveEscalarDepoisDeTentativas("disciplinas", "já tentei e continua igual"));
ok("escala live persistente", S.deveEscalarDepoisDeTentativas("live_interacao", "mesmo assim não funcionou"));
eq("não escala dúvida simples", S.deveEscalarDepoisDeTentativas("live_interacao", "como funciona?"), false);
eq("negociação não escala automaticamente", S.deveEscalarDepoisDeTentativas("negociacao", "continua"), false);

// RESPOSTAS DEVEM SER SEGURAS E NÃO PROMETER O QUE NÃO FOI CONFERIDO
const rLive = S.respostaPara("live_presenca");
ok("live não generaliza obrigatoriedade", /pode variar/i.test(rLive));
ok("live não afirma sempre opcional", !/toda live .*nao e obrigatoria/i.test(S.norm(rLive)));
const rNota = S.respostaPara("notas");
ok("nota pede conferência", /print/i.test(rNota));
const rVenc = S.respostaPara("vencimento");
ok("vencimento não chuta", /não vou chutar/i.test(rVenc));
const rDoc = S.respostaPara("documentos");
ok("documentos aponta GENDOCS", /GENDOCS/.test(rDoc));

// TESTE ASSÍNCRONO DE RESPOSTA E MEMÓRIA
async function testarFluxo() {
  const enviadas = [];
  const sessao = { instituicao: "unifatecie" };
  const args = {
    client: {},
    msg: { from: "5592999999999@c.us", type: "chat" },
    textoOriginal: "Na live a professora manda responder, mas para mim não aparece o botão",
    sessao,
    responder: async (_client, _destino, texto) => { enviadas.push(String(texto)); }
  };
  const handled = await S.tentarSuporteAluno(args);
  eq("fluxo live tratado", handled, true);
  eq("contexto live salvo", sessao.suporteAluno.intencao, "live_interacao");
  ok("resposta live enviada", enviadas[0] && /horário da live|horario da live/i.test(enviadas[0]));

  const follow = {
    ...args,
    textoOriginal: "e se eu perder?",
    responder: async (_client, _destino, texto) => { enviadas.push(String(texto)); }
  };
  const handled2 = await S.tentarSuporteAluno(follow);
  eq("follow-up tratado", handled2, true);
  eq("contexto muda para gravação", sessao.suporteAluno.intencao, "live_gravacao");

  const foto = {
    client: {},
    msg: { from: "5592999999999@c.us", type: "image", mimetype: "image/jpeg" },
    textoOriginal: "",
    sessao,
    responder: async (_client, _destino, texto) => { enviadas.push(String(texto)); }
  };
  const handled3 = await S.tentarSuporteAluno(foto);
  eq("print em contexto é tratado", handled3, true);
  ok("print é registrado", Boolean(sessao.suporteImagemRecebida));
}

testarFluxo()
  .then(() => console.log(`✅ Matriz de suporte ao aluno aprovada: ${total} verificações.`))
  .catch((error) => {
    console.error("❌ Matriz de suporte ao aluno falhou:", error.message || error);
    process.exit(1);
  });