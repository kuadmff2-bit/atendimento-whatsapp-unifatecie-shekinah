const Module = require("module");
const originalLoad = Module._load;

// O núcleo-base possui um self-test legado. Ao testar esta camada v2, removemos
// temporariamente a flag para impedir que o teste antigo rode durante o require.
const argvOriginal = process.argv;
const executandoSelfTestV2 = argvOriginal.includes("--self-test");
if (executandoSelfTestV2) process.argv = argvOriginal.filter((arg) => arg !== "--self-test");
const Base = require("./unifatecie-student-support");
if (executandoSelfTestV2) process.argv = argvOriginal;

function norm(texto = "") { return Base.norm(texto); }

function emFluxoObrigatorio(sessao = {}) {
  const e = String(sessao.etapa || "");
  return e.startsWith("unifatecie_matricula_") ||
    e.startsWith("shekinah_matricula_") ||
    e.startsWith("financeiro_") ||
    e.startsWith("shekinah_secretaria_") ||
    e === "atendimento_humano";
}

function detectarIntencao(texto = "", sessao = {}) {
  const t = norm(texto);
  if (!t) return null;

  // Uma intenção explicitamente da Shekinah nunca deve ser sequestrada pelo suporte UniFatecie.
  if (/\b(shekinah|centro educacional)\b/.test(t) && !/\b(unifatecie|fatecie|alunonet|gendocs)\b/.test(t)) {
    return null;
  }

  // LIVE: cobre fala natural, variações e continuações, não só frases exatas.
  const live = /\b(live|ao vivo|transmissao|webaula|web aula)\b/.test(t) || /\baula\b.*\bao vivo\b/.test(t);
  if (live && /\b(chat|responder|resposta|interagir|interajo|interage|interacao|pergunta|perguntas|comentario|comentarios|mensagem|mensagens|campo|botao|participar)\b/.test(t)) {
    return "live_interacao";
  }
  if (live && /\b(presenca|presente|frequencia|falta|faltas|obrigatoria|obrigatorio|chamada)\b/.test(t)) {
    return "live_presenca";
  }
  if (live && /\b(gravada|gravacao|replay|depois|perdi|perder|nao assisti|assistir depois|ver depois)\b/.test(t)) {
    return "live_gravacao";
  }
  if (live && /\b(link|horario|hora|entrar|entro|acessar|acesso|abrir|abre|nao aparece|nao abre|onde entra|onde entro|onde fica)\b/.test(t)) {
    return "live_acesso";
  }
  if (live) return "live_geral";

  // Intenções mais específicas precisam vencer palavras genéricas como prova, atividade e disciplina.
  if (/\b(nota|notas|media|boletim|resultado)\b/.test(t) &&
      /\b(disciplina|prova|avaliacao|portal|alunonet|minha|minhas|apareceu|lancou|errada|errado|nao aparece|nao bate)\b/.test(t)) {
    return "notas";
  }

  if (/\b(atividade complementar|atividades complementares|horas complementares|extensao curricular|horas de extensao)\b/.test(t)) {
    return "complementares_extensao";
  }

  if (/\b(calendario|cronograma|agenda academica)\b/.test(t)) {
    return "calendario";
  }

  if (/\b(transferencia|aproveitamento|aproveitar)\b.*\b(disciplina|materia|faculdade|curso)\b/.test(t) ||
      /\b(dispensa|equivalencia)\b.*\b(disciplina|materia)\b/.test(t)) {
    return "transferencia_aproveitamento";
  }

  if (/\b(declaracao|comprovante de matricula|declaracao de vinculo)\b/.test(t)) {
    return "declaracao";
  }

  if (/\b(certificado|diploma|colacao|conclusao)\b/.test(t) && !/\bshekinah\b/.test(t)) {
    return "certificado_diploma";
  }

  // Vencimento é mais específico que a simples presença da palavra boleto.
  if (/\b(vencimento|vence|vencer|data de pagamento|dia de pagar|dia do pagamento|que dia vence|qual dia vence)\b/.test(t) &&
      /\b(mensalidade|parcela|boleto|pagamento)\b/.test(t)) {
    return "vencimento";
  }

  return Base.detectarIntencao(texto, sessao);
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

function prepararEscalonamento(sessao = {}, texto = "") {
  sessao.instituicao = "unifatecie";
  sessao.assuntoAtual = "suporte_portal_unifatecie";
  sessao.problemaSuporteOriginal = String(texto || sessao?.suporteAluno?.ultimoTexto || "Problema acadêmico/portal").slice(0, 900);
  sessao.atualizadoEm = Date.now();
}

async function tentarSuporteAluno(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!sessao || !msg || typeof responder !== "function") return false;
  if (emFluxoObrigatorio(sessao)) return false;

  // Prints entram no mesmo contexto de suporte; o núcleo-base registra a imagem
  // e pede uma descrição curta/áudio quando não houver informação textual suficiente.
  if (Base.ehImagem(msg)) return Base.tentarSuporteAluno(args);

  const texto = String(textoOriginal || "").trim();
  if (!texto) return false;
  if (!Base.contextoUnifatecie(texto, sessao)) return false;

  const intencao = detectarIntencao(texto, sessao);
  if (!intencao) return false;

  if (Base.deveEscalarDepoisDeTentativas(intencao, texto)) {
    prepararEscalonamento(sessao, texto);
    return false;
  }

  const resposta = Base.respostaPara(intencao);
  if (!resposta) return false;

  registrarContexto(sessao, intencao, texto);
  await responder(client, msg.from, resposta);
  return true;
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__studentSupportV2Wrapped
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarSuporteAluno(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__studentSupportV2Wrapped", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  const s = { instituicao: "unifatecie" };
  assert.equal(detectarIntencao("Na live não aparece o botão de responder", s), "live_interacao");
  assert.equal(detectarIntencao("Como interajo com a professora na transmissão?", s), "live_interacao");
  assert.equal(detectarIntencao("Minha nota da prova não apareceu", s), "notas");
  assert.equal(detectarIntencao("Como envio atividades complementares?", s), "complementares_extensao");
  assert.equal(detectarIntencao("Qual a data da prova no calendário?", s), "calendario");
  assert.equal(detectarIntencao("Quero aproveitar uma disciplina de outra faculdade", s), "transferencia_aproveitamento");
  assert.equal(detectarIntencao("Preciso de uma declaração de matrícula", s), "declaracao");
  assert.equal(detectarIntencao("Como vejo se meu diploma foi liberado?", s), "certificado_diploma");
  assert.equal(detectarIntencao("Que dia vence meu boleto?", s), "vencimento");
  assert.equal(detectarIntencao("Quero saber os cursos", s), null);
  assert.equal(detectarIntencao("Já paguei e continua aparecendo em atraso", s), null);
  assert.equal(detectarIntencao("Preciso de declaração da Shekinah", s), null);
  console.log("✅ Self-test do suporte ao aluno v2 aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  norm,
  contextoUnifatecie: Base.contextoUnifatecie,
  detectarIntencao,
  respostaPara: Base.respostaPara,
  deveEscalarDepoisDeTentativas: Base.deveEscalarDepoisDeTentativas,
  tentarSuporteAluno
};