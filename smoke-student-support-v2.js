const assert = require("assert");
const S = require("./unifatecie-student-support-v2");

let total = 0;
function t(nome, texto, esperado, sessao = { instituicao: "unifatecie" }) {
  const atual = S.detectarIntencao(texto, sessao);
  assert.strictEqual(atual, esperado, `${nome}: esperado ${esperado}, veio ${atual}`);
  total += 1;
}
function ok(nome, cond) { assert.ok(cond, nome); total += 1; }

const casos = [
  ["live-chat-1", "Na live não aparece o botão de responder", "live_interacao"],
  ["live-chat-2", "Estou na aula ao vivo e não tem campo de mensagem", "live_interacao"],
  ["live-chat-3", "Como interajo com a professora na transmissão?", "live_interacao"],
  ["live-presenca-1", "A live é obrigatória para presença?", "live_presenca"],
  ["live-presenca-2", "Se eu não entrar na live eu levo falta?", "live_presenca"],
  ["live-presenca-3", "A professora faz chamada na aula ao vivo?", "live_presenca"],
  ["live-gravada-1", "Perdi a live, fica gravada?", "live_gravacao"],
  ["live-gravada-2", "Posso assistir a transmissão depois?", "live_gravacao"],
  ["live-gravada-3", "Não assisti a live, tem replay?", "live_gravacao"],
  ["live-acesso-1", "Não aparece o link da live", "live_acesso"],
  ["live-acesso-2", "Onde entro para assistir a aula ao vivo?", "live_acesso"],
  ["live-acesso-3", "A live não abre no horário", "live_acesso"],
  ["live-geral", "Tenho dúvida sobre a live de hoje", "live_geral"],

  ["avaliacao-1", "Minha prova não aparece no portal", "avaliacoes"],
  ["avaliacao-2", "Quando é a segunda chamada da avaliação?", "avaliacoes"],
  ["avaliacao-3", "A AV3 deu erro e não abriu", "avaliacoes"],
  ["nota-1", "Minha nota da prova não apareceu", "notas"],
  ["nota-2", "A nota lançada está errada", "notas"],
  ["nota-3", "Minha média no boletim não bate", "notas"],

  ["disciplina-1", "Minha disciplina sumiu do portal", "disciplinas"],
  ["disciplina-2", "Uma matéria não aparece para mim", "disciplinas"],
  ["disciplina-3", "Não consigo acessar minha disciplina", "disciplinas"],
  ["atividade-1", "A atividade não aparece e o prazo termina hoje", "atividades"],
  ["atividade-2", "Não consigo enviar o trabalho da disciplina", "atividades"],
  ["atividade-3", "O fórum sumiu do portal", "atividades"],

  ["gendocs-1", "Como envio meus documentos no GENDOCS?", "documentos"],
  ["gendocs-2", "Meu documento foi rejeitado no GENDOCS", "documentos"],
  ["gendocs-3", "A documentação ainda está pendente", "documentos"],

  ["rematricula-1", "Como faço a rematrícula?", "rematricula"],
  ["rematricula-2", "Minha rematrícula não liberou", "rematricula"],
  ["status-1", "Minha matrícula aparece pendente", "status_matricula"],
  ["status-2", "Como vejo se minha matrícula está ativa?", "status_matricula"],

  ["estagio-1", "Tenho dúvida sobre estágio obrigatório", "estagio"],
  ["estagio-2", "Como funciona o termo de estágio?", "estagio"],
  ["estagio-3", "A escola precisa ter convênio de estágio?", "estagio"],

  ["carteirinha-1", "Minha carteirinha digital não aparece", "carteirinha_app"],
  ["carteirinha-2", "Como vejo a carteira estudantil no app UniFatecie?", "carteirinha_app"],

  ["boleto-1", "Quero a segunda via do boleto", "boleto"],
  ["boleto-2", "Onde fica a ficha financeira?", "boleto"],
  ["boleto-3", "Meu boleto está com valor diferente", "boleto"],
  ["vencimento-1", "Qual o vencimento da minha mensalidade?", "vencimento"],
  ["vencimento-2", "Que dia vence meu boleto?", "vencimento"],
  ["negociacao-1", "Quero negociar uma dívida atrasada", "negociacao"],
  ["negociacao-2", "Dá para fazer acordo e parcelar a dívida?", "negociacao"],

  ["requerimento-1", "Como faço um requerimento no AlunoNet?", "requerimento"],
  ["requerimento-2", "Onde acompanho o protocolo da solicitação?", "requerimento"],
  ["diploma-1", "Como vejo se meu diploma foi liberado?", "certificado_diploma"],
  ["diploma-2", "Tenho dúvida sobre certificado de conclusão", "certificado_diploma"],
  ["declaracao-1", "Preciso de uma declaração de matrícula", "declaracao"],
  ["declaracao-2", "Onde pego comprovante de matrícula?", "declaracao"],

  ["extensao-1", "Quantas horas de extensão curricular faltam?", "complementares_extensao"],
  ["extensao-2", "Como envio atividades complementares?", "complementares_extensao"],
  ["extensao-3", "Essa atividade vale como horas complementares?", "complementares_extensao"],

  ["aproveitamento-1", "Quero aproveitar uma disciplina de outra faculdade", "transferencia_aproveitamento"],
  ["aproveitamento-2", "Como peço equivalência de matéria?", "transferencia_aproveitamento"],
  ["transferencia-1", "Tenho dúvida sobre transferência e dispensa de disciplina", "transferencia_aproveitamento"],

  ["tutoria-1", "Como falo com o tutor sobre uma dúvida da matéria?", "tutoria"],
  ["tutoria-2", "A professora não responde minha mensagem", "tutoria"],
  ["calendario-1", "Onde vejo o calendário acadêmico?", "calendario"],
  ["calendario-2", "Quero ver o cronograma da disciplina", "calendario"],
  ["calendario-3", "Qual a data da prova no calendário?", "calendario"],
];

for (const [nome, texto, esperado] of casos) t(nome, texto, esperado);

const live = { instituicao: "unifatecie", suporteAluno: { intencao: "live_interacao" } };
t("follow-normal", "É normal?", "live_interacao", live);
t("follow-presenca", "e a presença?", "live_presenca", live);
t("follow-perder", "e se eu perder?", "live_gravacao", live);
t("follow-chat", "e o botão do chat?", "live_interacao", { instituicao: "unifatecie", suporteAluno: { intencao: "live_acesso" } });
t("follow-doc", "não aparece", "documentos", { instituicao: "unifatecie", suporteAluno: { intencao: "documentos" } });

for (const texto of [
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
  "Quanto custa o EAD da Shekinah?"
]) t(`negativo-${texto}`, texto, null);

ok("contexto-alunonet", S.contextoUnifatecie("problema no AlunoNet", {}));
ok("contexto-disciplina", S.contextoUnifatecie("minha disciplina sumiu", {}));
assert.strictEqual(S.contextoUnifatecie("curso da Shekinah", {}), false); total += 1;

ok("escala-live", S.deveEscalarDepoisDeTentativas("live_interacao", "já tentei e continua igual"));
ok("escala-disciplina", S.deveEscalarDepoisDeTentativas("disciplinas", "mesmo assim não funcionou"));
assert.strictEqual(S.deveEscalarDepoisDeTentativas("negociacao", "continua"), false); total += 1;

ok("resposta-live-segura", /pode variar/i.test(S.respostaPara("live_presenca")));
ok("resposta-nota-print", /print/i.test(S.respostaPara("notas")));
ok("resposta-vencimento-sem-chute", /não vou chutar/i.test(S.respostaPara("vencimento")));
ok("resposta-gendocs", /GENDOCS/.test(S.respostaPara("documentos")));

async function fluxo() {
  const enviadas = [];
  const sessao = { instituicao: "unifatecie" };
  const base = {
    client: {},
    msg: { from: "5592999999999@c.us", type: "chat" },
    sessao,
    responder: async (_c, _d, texto) => enviadas.push(String(texto))
  };
  assert.strictEqual(await S.tentarSuporteAluno({ ...base, textoOriginal: "Na live a professora manda responder, mas para mim não aparece o botão" }), true); total += 1;
  assert.strictEqual(sessao.suporteAluno.intencao, "live_interacao"); total += 1;
  assert.strictEqual(await S.tentarSuporteAluno({ ...base, textoOriginal: "e se eu perder?" }), true); total += 1;
  assert.strictEqual(sessao.suporteAluno.intencao, "live_gravacao"); total += 1;
  ok("fluxo-enviou-respostas", enviadas.length >= 2);
}

fluxo()
  .then(() => console.log(`✅ Regressão ampla do suporte acadêmico aprovada: ${total} verificações.`))
  .catch((e) => { console.error("❌ Regressão ampla do suporte acadêmico falhou:", e.message || e); process.exit(1); });