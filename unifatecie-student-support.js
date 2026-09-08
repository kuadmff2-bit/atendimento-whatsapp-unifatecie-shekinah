const Module = require("module");
const originalLoad = Module._load;

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emFluxoObrigatorio(sessao = {}) {
  const e = String(sessao.etapa || "");
  return e.startsWith("unifatecie_matricula_") ||
    e.startsWith("shekinah_matricula_") ||
    e.startsWith("financeiro_") ||
    e.startsWith("shekinah_secretaria_") ||
    e === "atendimento_humano";
}

function ehImagem(msg = {}) {
  const tipo = norm(msg?.type || msg?.mediaType || msg?.mediaData?.type || "");
  const mime = String(msg?.mimetype || msg?.mimeType || msg?.mediaData?.mimetype || msg?.mediaData?.mimeType || "").toLowerCase();
  return tipo === "image" || tipo === "imagem" || mime.startsWith("image/");
}

function mencionaShekinah(t = "") {
  return /\b(shekinah|centro educacional)\b/.test(t);
}

function mencionaUniFatecie(t = "") {
  return /\b(unifatecie|fatecie|alunonet|gendocs|portal do aluno|meu portal|ra academico)\b/.test(t);
}

function contextoSuporteAluno(sessao = {}) {
  return String(sessao?.assuntoAtual || "").startsWith("suporte_aluno_") || Boolean(sessao?.suporteAluno?.intencao);
}

function sinalForteDeAluno(t = "") {
  return /\b(minha disciplina|minhas disciplinas|minha nota|minhas notas|minha prova|minhas provas|minha mensalidade|minhas mensalidades|meu boleto|meu ra|meu portal|alunonet|gendocs|carteirinha do aluno|carteirinha digital|estagio obrigatorio|rematricula|requerimento|segunda chamada|atividade complementar|atividades complementares|extensao curricular)\b/.test(t);
}

function contextoUnifatecie(texto = "", sessao = {}) {
  const t = norm(texto);
  if (mencionaShekinah(t) && !mencionaUniFatecie(t)) return false;
  return sessao?.instituicao === "unifatecie" || mencionaUniFatecie(t) || contextoSuporteAluno(sessao) || sinalForteDeAluno(t);
}

function pedidoDeOfertaOuCurso(t = "") {
  const suporte = /\b(erro|problema|duvida|nao aparece|sumiu|nao consigo|travou|prazo|prova|nota|disciplina|atividade|live|ao vivo|portal|alunonet|documento|gendocs|boleto|mensalidade|estagio|requerimento|carteirinha)\b/.test(t);
  if (suporte) return false;
  return /\b(quais cursos|lista de cursos|catalogo|curso de pedagogia|curso de administracao|curso de ads|quero me matricular|quero matricula|valor do curso|mensalidade do curso|duracao do curso|tem curso)\b/.test(t);
}

function deixarParaFluxoExistente(t = "") {
  if (/\b(cancelar|cancelamento|trancar|trancamento|desistir|sair da faculdade)\b/.test(t)) return true;
  if (/\b(perdi|esqueci|recuperar|nao consigo entrar|sem acesso)\b.*\b(ra|senha|login|portal|alunonet)\b/.test(t)) return true;
  if (/\b(ra|senha|login|portal|alunonet)\b.*\b(perdi|esqueci|recuperar|bloquead|nao consigo)\b/.test(t)) return true;
  const pagou = /\b(paguei|pagamento feito|ja paguei|já paguei)\b/.test(t);
  const aindaCobra = /\b(ainda|continua|segue|aparece|consta)\b.*\b(abert|pendente|atras|cobr|pagar)\b/.test(t) || /\bnao baixou|nao compensou|pagamento nao compensado\b/.test(t);
  if (pagou && aindaCobra) return true;
  if (/\b(falar com|quero falar|chamar)\b.*\b(atendente|secretario|secretaria|pessoa|humano)\b/.test(t)) return true;
  return false;
}

function detectarIntencao(texto = "", sessao = {}) {
  const t = norm(texto);
  if (!t) return null;
  if (mencionaShekinah(t) && !mencionaUniFatecie(t)) return null;
  if (pedidoDeOfertaOuCurso(t)) return null;
  if (deixarParaFluxoExistente(t)) return null;

  const live = /\b(live|ao vivo|transmissao|aula ao vivo|webaula|web aula)\b/.test(t);
  if (live && /\b(chat|responder|resposta|interagir|interacao|pergunta|perguntas|comentario|comentarios|mensagem|mensagens|campo|botao|botão)\b/.test(t)) return "live_interacao";
  if (live && /\b(presenca|presente|frequencia|falta|obrigatoria|obrigatorio|vale presenca|chamada)\b/.test(t)) return "live_presenca";
  if (live && /\b(gravada|gravacao|replay|assistir depois|ver depois|perdi|nao assisti|não assisti)\b/.test(t)) return "live_gravacao";
  if (live && /\b(link|horario|hora|entrar|acessar|abrir|nao aparece|não aparece|nao abre|não abre|onde fica)\b/.test(t)) return "live_acesso";
  if (live) return "live_geral";

  if (/\b(prova|provas|avaliacao|avaliacoes|av1|av2|av3|av4|segunda chamada|exame)\b/.test(t)) return "avaliacoes";
  if (/\b(nota|notas|media|média|boletim|resultado)\b/.test(t) && /\b(disciplina|prova|avaliacao|portal|alunonet|minha|minhas|apareceu|lancou|lançou|errada|errado|nao aparece|não aparece)\b/.test(t)) return "notas";
  if (/\b(disciplina|disciplinas|materia|materias)\b/.test(t) && /\b(nao aparece|não aparece|sumiu|sumiram|nao abriu|não abriu|liberada|liberou|acessar|entrar|faltando|bloqueada|bloqueado|portal|minha|minhas)\b/.test(t)) return "disciplinas";
  if (/\b(atividade|atividades|trabalho|trabalhos|questionario|questionarios|forum|fórum)\b/.test(t) && /\b(prazo|entregar|enviar|fazer|nao aparece|não aparece|sumiu|erro|portal|disciplina|atrasada|atrasado)\b/.test(t)) return "atividades";
  if (/\b(gendocs|documento|documentos|documentacao|documentação)\b/.test(t)) return "documentos";
  if (/\b(rematricula|rematrícula|rematricular|renovacao de matricula|renovação de matrícula)\b/.test(t)) return "rematricula";
  if (/\b(estagio|estágio|convenio de estagio|convênio de estágio|termo de estagio|termo de estágio)\b/.test(t)) return "estagio";
  if (/\b(carteirinha|carteira estudantil|carteira do estudante|id estudantil|app unifatecie|aplicativo unifatecie)\b/.test(t)) return "carteirinha_app";
  if (/\b(segunda via|2 via|boleto|linha digitavel|linha digitável|ficha financeira)\b/.test(t)) return "boleto";
  if (/\b(vencimento|vence|vencer|data de pagamento|dia de pagar|dia do pagamento)\b/.test(t) && /\b(mensalidade|parcela|boleto|pagamento)\b/.test(t)) return "vencimento";
  if (/\b(negociar|negociacao|negociação|parcelar divida|parcelar dívida|acordo|renegociar|divida atrasada|dívida atrasada)\b/.test(t)) return "negociacao";
  if (/\b(requerimento|requerimentos|protocolo|solicitacao|solicitação)\b/.test(t)) return "requerimento";
  if (/\b(certificado|diploma|colacao|colação|conclusao|conclusão)\b/.test(t) && !/\bcurso ead shekinah\b/.test(t)) return "certificado_diploma";
  if (/\b(declaracao|declaração|comprovante de matricula|comprovante de matrícula|declaracao de vinculo|declaração de vínculo)\b/.test(t)) return "declaracao";
  if (/\b(atividade complementar|atividades complementares|horas complementares|extensao|extensão curricular|horas de extensao|horas de extensão)\b/.test(t)) return "complementares_extensao";
  if (/\b(transferencia|transferência|aproveitamento de disciplina|aproveitar disciplina|dispensa de disciplina|equivalencia|equivalência)\b/.test(t)) return "transferencia_aproveitamento";
  if (/\b(tutor|tutora|professor|professora|mediador|mediadora)\b/.test(t) && /\b(falar|contato|duvida|dúvida|responde|responder|mensagem|ajuda)\b/.test(t)) return "tutoria";
  if (/\b(calendario|calendário|cronograma|agenda academica|agenda acadêmica|datas da disciplina|data da prova)\b/.test(t)) return "calendario";
  if (/\b(matricula|matrícula)\b/.test(t) && /\b(ativa|ativo|status|confirmada|confirmado|aprovada|aprovado|nao aparece|não aparece|pendente)\b/.test(t)) return "status_matricula";

  const anterior = sessao?.suporteAluno?.intencao;
  if (anterior) {
    if (/^(e a presenca|e presença|presenca|presença|e obrigatoria|e obrigatória)$/.test(t) && anterior.startsWith("live_")) return "live_presenca";
    if (/\b(perder|perdi|depois|gravada|gravacao|replay)\b/.test(t) && anterior.startsWith("live_")) return "live_gravacao";
    if (/\b(chat|responder|interagir|pergunta|botao|campo)\b/.test(t) && anterior.startsWith("live_")) return "live_interacao";
    if (/^(e normal|é normal|normal|como assim|e se nao aparecer|e se não aparecer|nao aparece|não aparece|continua igual|continua assim|e agora|o que faco|o que faço)$/.test(t)) return anterior;
  }

  return null;
}

function respostaPara(intencao) {
  const respostas = {
    live_interacao:
      "Na *live ao vivo*, o campo de chat/resposta costuma depender da transmissão estar realmente ativa. Se você entrar antes, depois ou pela gravação, a opção de interagir pode não aparecer.\n\nSe entrar *no horário da live* e mesmo assim não aparecer, atualize a página/app e tente novamente. Se continuar, me mande um print e eu encaminho para conferência.",
    live_presenca:
      "Sobre *presença em live*: eu não vou afirmar que toda live é obrigatória ou que nenhuma é, porque isso pode variar conforme a disciplina e a orientação da professora/tutor.\n\nSe houver chamada, interação obrigatória ou regra específica da disciplina, siga o que estiver no cronograma/aviso. Se quiser, me diga qual é a disciplina que eu te oriento sobre onde conferir.",
    live_gravacao:
      "Se a live ficar *gravada*, normalmente dá para assistir depois. Mas a gravação não substitui automaticamente uma eventual exigência de presença/interação da disciplina.\n\nEntão, se a professora informou que vai controlar presença, o mais seguro é entrar no horário ao vivo e seguir a orientação dela.",
    live_acesso:
      "Para acessar uma live, entre pelo ambiente da disciplina no horário informado e procure o link/área da transmissão. Se o link ou botão não aparecer no horário, atualize o portal/app e tente novamente.\n\nSe ainda não aparecer, me mande um print da tela e eu te ajudo a identificar o próximo passo.",
    live_geral:
      "Posso te ajudar com a live. Me diga o que está acontecendo: *não aparece o link, não aparece o chat/responder, dúvida sobre presença, horário ou gravação*?",
    avaliacoes:
      "Sobre provas e avaliações, o primeiro lugar para conferir é a própria disciplina no portal e o cronograma liberado para ela. Datas, segunda chamada e disponibilidade podem variar.\n\nSe a avaliação deveria estar liberada e não aparece, guarde um print com data/horário e me diga qual avaliação é. Não vou inventar prazo ou regra que não esteja confirmada.",
    notas:
      "Se a nota não apareceu, parece errada ou não bate com o que você fez, confira primeiro o resultado da atividade/prova dentro da disciplina e o boletim/área de notas.\n\nSe continuar divergente, me mande um print e informe a disciplina e a avaliação. Aí o caso pode ser conferido sem adivinhar sua situação acadêmica.",
    disciplinas:
      "Se uma disciplina sumiu, não aparece ou está bloqueada, atualize o portal e confira se você está no período/turma corretos.\n\nSe continuar, me diga o *nome da disciplina* e mande um print da tela. Como isso depende da matrícula individual, eu não vou afirmar que está normal sem conferir.",
    atividades:
      "Para atividade, trabalho, fórum ou questionário, confira o prazo e o local de envio dentro da própria disciplina. Se o botão de envio não aparece ou deu erro dentro do prazo, tire um print com data/horário.\n\nMe diga qual atividade é e eu te ajudo com o próximo passo.",
    documentos:
      "Os documentos da UniFatecie devem ser enviados pelo *Portal do Aluno, na área do GENDOCS*. Se algum documento estiver pendente ou rejeitado, confira a observação/motivo mostrado no próprio sistema antes de reenviar.\n\nSe não aparecer o motivo ou você não conseguir enviar, pode me mandar um print.",
    rematricula:
      "A rematrícula/renovação depende do período acadêmico e da situação do aluno. Confira no Portal do Aluno se existe aviso ou opção de rematrícula liberada.\n\nSe aparecer bloqueio, pendência ou você não souber o que falta, me mande exatamente a mensagem da tela para eu orientar sem inventar regra.",
    estagio:
      "No estágio, as exigências mudam conforme o curso e a etapa. O ideal é seguir os documentos e orientações liberados pela UniFatecie para sua disciplina de estágio.\n\nSe sua dúvida for sobre *convênio, termo, assinatura, campo de estágio, carga horária ou envio de documento*, me diga qual desses pontos é.",
    carteirinha_app:
      "A carteirinha estudantil digital e os recursos do app dependem do cadastro do aluno estar ativo e sincronizado. Se não aparecer, confirme se entrou com os mesmos dados do Portal do Aluno e atualize o aplicativo.\n\nSe continuar sem aparecer, me envie um print da tela/erro.",
    boleto:
      "Para boleto ou segunda via, confira a área *Financeiro / Ficha Financeira* no Portal do Aluno. Use sempre a cobrança exibida no seu próprio portal.\n\nSe o boleto não aparece, está duplicado ou mostra valor diferente do esperado, não faça pagamento no escuro: me diga o que aparece na tela.",
    vencimento:
      "A data de vencimento que vale para você é a que aparece na sua cobrança dentro do Portal do Aluno. Como vencimentos podem variar conforme o contrato/cadastro, eu não vou chutar uma data.\n\nSe quiser, me diga qual data aparece no seu portal e qual é a dúvida.",
    negociacao:
      "Para negociação de mensalidades em atraso, o valor e as condições dependem da situação financeira do aluno. Confira primeiro as opções disponíveis no Financeiro do Portal.\n\nSe não houver opção de acordo ou se precisar de uma condição específica, eu posso encaminhar o caso ao atendimento financeiro.",
    requerimento:
      "Requerimentos devem ser feitos pela área de *Requerimentos / Entrada de requerimentos* do AlunoNet/Portal quando a opção correspondente estiver disponível.\n\nDepois de enviar, acompanhe o protocolo/status. Se você me disser qual solicitação quer fazer, eu te digo se já existe um procedimento conhecido no atendimento.",
    certificado_diploma:
      "Certificado, diploma e documentos de conclusão dependem da situação acadêmica e das etapas de conclusão do curso. Eu não consigo afirmar que um documento individual já está liberado sem consultar o status do aluno.\n\nConfira a área de documentos/requerimentos do portal; se houver pendência ou mensagem, me envie o texto dela.",
    declaracao:
      "Para declaração ou comprovante acadêmico, procure primeiro a área de documentos/requerimentos do Portal/AlunoNet. A disponibilidade pode depender do tipo de declaração e da situação do aluno.\n\nSe você disser qual declaração precisa, eu te oriento de forma mais precisa.",
    complementares_extensao:
      "Atividades complementares e extensão precisam seguir a carga e as regras do seu curso. Confira no portal onde aparecem as horas cumpridas e as pendentes e use apenas atividades aceitas pela instituição.\n\nSe você me disser se a dúvida é sobre *quantas horas faltam, como enviar ou se uma atividade vale*, eu continuo daí.",
    transferencia_aproveitamento:
      "Transferência, aproveitamento ou dispensa de disciplina exige análise acadêmica; não é seguro prometer equivalência antes da avaliação.\n\nProcure o requerimento correspondente e tenha em mãos os documentos da disciplina/curso de origem. Se disser o que você quer aproveitar, eu te explico o caminho geral.",
    tutoria:
      "Se a dúvida é acadêmica sobre conteúdo, atividade ou orientação da disciplina, tente primeiro o canal de tutoria/professor disponível dentro da própria disciplina.\n\nSe o problema for de sistema, prazo ou acesso e não de conteúdo, me diga o erro que aparece para eu separar corretamente o atendimento.",
    calendario:
      "Para datas de prova, atividade, live ou fechamento de disciplina, use o cronograma/calendário mostrado no seu ambiente acadêmico, porque as datas podem mudar entre turmas e disciplinas.\n\nSe você me mandar a data ou o aviso que aparece, eu te ajudo a interpretar.",
    status_matricula:
      "O status da matrícula é individual. Se o portal mostra matrícula pendente, inativa ou alguma restrição, me envie a mensagem exata da tela.\n\nEu consigo orientar o procedimento, mas não vou afirmar o status real da sua matrícula sem uma confirmação do sistema/atendimento responsável."
  };
  return respostas[intencao] || null;
}

function nomeCurtoIntencao(intencao = "") {
  return String(intencao).replace(/_/g, " ");
}

function registrarContexto(sessao = {}, intencao, texto = "") {
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = `suporte_aluno_${intencao}_unifatecie`;
  sessao.suporteAluno = {
    intencao,
    ultimoTexto: String(texto || "").slice(0, 700),
    atualizadoEm: Date.now()
  };
  sessao.atualizadoEm = Date.now();
}

function ehPersistenciaDoProblema(texto = "") {
  const t = norm(texto);
  return /\b(ja tentei|já tentei|continua|continuou|ainda nao|ainda não|nao resolveu|não resolveu|nao funcionou|não funcionou|mesmo assim|persiste|persistindo)\b/.test(t);
}

function deveEscalarDepoisDeTentativas(intencao = "", texto = "") {
  if (!ehPersistenciaDoProblema(texto)) return false;
  return new Set(["live_acesso", "live_interacao", "avaliacoes", "notas", "disciplinas", "atividades", "documentos", "carteirinha_app", "status_matricula"]).has(intencao);
}

function prepararEscalonamento(sessao = {}, texto = "") {
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = "suporte_portal_unifatecie";
  sessao.problemaSuporteOriginal = String(texto || sessao?.suporteAluno?.ultimoTexto || "Problema acadêmico/portal").slice(0, 900);
  sessao.atualizadoEm = Date.now();
}

async function tratarImagem({ client, msg, sessao, responder }) {
  if (!ehImagem(msg)) return false;
  if (emFluxoObrigatorio(sessao)) return false;
  if (!contextoUnifatecie("", sessao)) return false;

  sessao.suporteImagemRecebida = { em: Date.now(), assunto: sessao?.suporteAluno?.intencao || null };
  sessao.atualizadoEm = Date.now();

  const assunto = sessao?.suporteAluno?.intencao;
  if (String(sessao.assuntoAtual || "") === "suporte_pagamento_unifatecie") {
    await responder(client, msg.from, "Recebi a imagem/comprovante. ✅ Para eu encaminhar a conferência financeira, continue me enviando os dados que eu pedir por aqui.");
    return true;
  }

  if (assunto) {
    await responder(client, msg.from, `Recebi o print. ✅ Ele ficou associado à sua dúvida sobre *${nomeCurtoIntencao(assunto)}*. Se puder, diga em uma frase o que exatamente não está aparecendo ou o que você quer conferir na imagem.`);
    return true;
  }

  await responder(client, msg.from, "Recebi o print. ✅ Me diga em uma frase o que você quer conferir nele. Se preferir, pode mandar um áudio explicando o problema.");
  return true;
}

async function tentarSuporteAluno(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;

  if (await tratarImagem({ client, msg, sessao, responder })) return true;
  if (emFluxoObrigatorio(sessao)) return false;

  const texto = String(textoOriginal || "").trim();
  if (!texto) return false;
  const t = norm(texto);

  if (mencionaShekinah(t) && !mencionaUniFatecie(t)) {
    if (contextoSuporteAluno(sessao)) {
      sessao.suporteAluno = null;
      if (String(sessao.assuntoAtual || "").startsWith("suporte_aluno_")) sessao.assuntoAtual = null;
    }
    return false;
  }

  if (pedidoDeOfertaOuCurso(t)) {
    if (contextoSuporteAluno(sessao)) {
      sessao.suporteAluno = null;
      if (String(sessao.assuntoAtual || "").startsWith("suporte_aluno_")) sessao.assuntoAtual = null;
    }
    return false;
  }

  if (!contextoUnifatecie(texto, sessao)) return false;
  if (deixarParaFluxoExistente(t)) return false;

  const intencao = detectarIntencao(texto, sessao);
  if (!intencao) return false;

  if (deveEscalarDepoisDeTentativas(intencao, texto)) {
    prepararEscalonamento(sessao, texto);
    return false;
  }

  const resposta = respostaPara(intencao);
  if (!resposta) return false;

  registrarContexto(sessao, intencao, texto);
  await responder(client, msg.from, resposta);
  return true;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__studentSupportWrapped
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarSuporteAluno(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__studentSupportWrapped", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  const s = { instituicao: "unifatecie" };
  assert.equal(detectarIntencao("Na live não aparece o botão de responder", s), "live_interacao");
  assert.equal(detectarIntencao("A live é obrigatória para presença?", s), "live_presenca");
  assert.equal(detectarIntencao("Perdi a live, fica gravada?", s), "live_gravacao");
  assert.equal(detectarIntencao("Não aparece o link da live", s), "live_acesso");
  assert.equal(detectarIntencao("Minha disciplina sumiu do portal", s), "disciplinas");
  assert.equal(detectarIntencao("Minha nota da prova não apareceu", s), "notas");
  assert.equal(detectarIntencao("Como envio os documentos no GENDOCS?", s), "documentos");
  assert.equal(detectarIntencao("Quero segunda via do boleto", s), "boleto");
  assert.equal(detectarIntencao("Como faço a rematrícula?", s), "rematricula");
  assert.equal(detectarIntencao("Tenho dúvida sobre estágio obrigatório", s), "estagio");
  assert.equal(detectarIntencao("Quero saber os cursos", s), null);
  assert.equal(detectarIntencao("Quero cancelar a matrícula", s), null);
  assert.equal(detectarIntencao("Perdi meu RA e senha", s), null);
  assert.equal(detectarIntencao("Já paguei e continua aparecendo em atraso", s), null);
  assert.equal(contextoUnifatecie("curso da Shekinah", {}), false);
  console.log("✅ Self-test do suporte amplo ao aluno UniFatecie aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  ehImagem,
  contextoUnifatecie,
  detectarIntencao,
  respostaPara,
  deveEscalarDepoisDeTentativas,
  tentarSuporteAluno
};