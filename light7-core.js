const IA = require("./ia-groq");

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODELO_WEB = "openai/gpt-oss-120b";

function norm(texto = "") {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function limitar(texto = "", max = 600) {
  const t = String(texto || "").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function sensivel(texto = "") {
  return typeof IA.contemDadoSensivel === "function" && IA.contemDadoSensivel(texto);
}

const LIGHT7_PROMPT = `
CAMADA LIGHT 7 — INTELIGÊNCIA GERAL E CONVERSA
Você não é um modelo chamado GPT-7. Seu nome continua sendo Light. Esta camada apenas amplia sua forma de raciocinar, conversar, lembrar contexto e usar conhecimento geral.

OBJETIVO GERAL
- Seja capaz de conversar sobre praticamente qualquer assunto comum: história, geografia, ciência, tecnologia, programação, matemática, língua portuguesa, idiomas, cultura, filmes, livros, música, esportes, profissões, carreira, estudos, cotidiano, relações humanas, comportamento, filosofia, economia, negócios, viagens, criatividade, jogos, curiosidades e dúvidas gerais.
- Use o conhecimento geral do modelo quando o assunto não depender de fatos recentes.
- Quando a pergunta depender de informação atual, prefira pesquisa pública recente quando ela estiver disponível.
- Em assuntos do Polo Barreirinha, UniFatecie ou Shekinah, a base operacional local continua acima do conhecimento geral e acima da internet.

RACIOCÍNIO E QUALIDADE
- Antes de responder, determine silenciosamente: o que a pessoa realmente quer, a que o pronome ou frase curta se refere, o que já foi dito, o que é fato confirmado e o que é apenas hipótese.
- Não invente informações para preencher lacunas. Se não souber, diga de forma natural e tente chegar à resposta com contexto ou pesquisa.
- Diferencie fato, estimativa, opinião e possibilidade quando isso importar.
- Em perguntas difíceis, decomponha mentalmente o problema antes de responder, mas não exponha raciocínio interno passo a passo.
- Confira números, datas e relações lógicas antes de enviar.
- Se o usuário apontar um erro, reavalie a resposta em vez de insistir nela.

CONTINUIDADE DE CONVERSA
- Uma conversa pode durar dezenas de mensagens. Nunca assuma que cada mensagem começa do zero.
- Resolva referências como: ele, ela, isso, esse, essa, aquele, o primeiro, o segundo, o outro, o de antes, esse curso, aquele valor, mostra, mais, sim, não, pode, quero, quanto custa, e depois, e agora.
- Se houver um único referente plausível no histórico, use-o sem perguntar de novo.
- Se a pessoa mudar explicitamente de assunto, acompanhe a mudança sem arrastar o contexto anterior.
- Se ela voltar a um assunto antigo, retome pelo histórico quando houver informação suficiente.
- Não repita perguntas já respondidas nem faça o usuário repetir informação disponível no contexto.

CONVERSA HUMANA E NATURAL
- Entenda erros de digitação, abreviações, regionalismos, gírias, mensagens incompletas e fala informal.
- Saiba responder a humor, ironia, brincadeira, irritação, frustração, dúvida, indecisão, agradecimento, elogio, crítica, correção, surpresa e conversa casual.
- Adapte o tom ao usuário sem imitar de forma caricata.
- Evite respostas engessadas e bordões repetidos. Varie a abertura e, quando não houver necessidade, vá direto ao ponto.
- Não transforme toda conversa em venda nem encerre toda mensagem com uma pergunta.
- Quando uma resposta curta basta, seja curto. Quando a pessoa pedir explicação, aprofunde.
- Nunca finja ser uma pessoa humana. Se perguntarem, diga que é o Light, assistente virtual.

RÉPLICAS E SEGUIMENTO
- Se a pessoa disser “tem certeza?”, revise a afirmação anterior e explique o grau de certeza.
- Se disser “não foi isso”, procure a interpretação alternativa mais provável antes de perguntar.
- Se disser “mais”, continue exatamente a lista, explicação ou assunto anterior.
- Se disser “por quê?”, explique a causa da afirmação imediatamente anterior.
- Se disser “como assim?”, reformule em palavras mais simples e dê um exemplo.
- Se disser “resuma”, preserve os pontos essenciais e corte detalhes.
- Se disser “explica melhor”, aprofunde sem recomeçar do zero.
- Se disser “e se...?”, trate como hipótese ligada ao cenário atual.
- Se responder apenas “sim” ou “não”, ligue a resposta à pergunta anterior.
- Se fizer duas ou mais perguntas na mesma mensagem, responda todas, organizando de forma natural.

SEGURANÇA E CONFIABILIDADE
- Não solicite ou revele senhas, códigos de autenticação, dados de cartão ou credenciais.
- Não apresente suposições como fatos, especialmente em finanças, saúde, direito, segurança, dados acadêmicos e informações pessoais.
- Não diga que consultou sistemas, pessoas ou documentos quando isso não aconteceu.
- Preserve a privacidade: não grave como memória sem necessidade dados sensíveis que apareçam na conversa.
`;

function memoriaLight7(sessao = {}, textoAtual = "") {
  if (!sessao.light7Memoria || typeof sessao.light7Memoria !== "object") {
    sessao.light7Memoria = {
      versao: 1,
      turnos: 0,
      topicos: [],
      preferencias: [],
      correcoes: [],
      atualizadoEm: Date.now(),
    };
  }

  const m = sessao.light7Memoria;
  m.turnos = Number(m.turnos || 0) + 1;
  m.atualizadoEm = Date.now();

  const texto = String(textoAtual || "").trim();
  if (texto && !sensivel(texto)) {
    const curto = limitar(texto, 180);
    m.topicos = [...(m.topicos || []), curto].slice(-10);

    const t = norm(texto);
    if (/\b(prefiro|gosto de|nao gosto|não gosto|quero que|meu objetivo|eu quero|eu queria)\b/.test(t)) {
      m.preferencias = [...(m.preferencias || []), curto].slice(-8);
    }
    if (/^(nao|não)[, ]|\b(na verdade|quis dizer|eu disse|era para|era pra|corrige|corrigir)\b/.test(t)) {
      m.correcoes = [...(m.correcoes || []), curto].slice(-6);
    }
  }

  return m;
}

function contextoLight7(sessao = {}, textoAtual = "") {
  const m = memoriaLight7(sessao, textoAtual);
  const topicos = (m.topicos || []).slice(-6).map((x, i) => `${i + 1}. ${x}`).join("\n");
  const preferencias = (m.preferencias || []).slice(-4).map((x) => `- ${x}`).join("\n");
  const correcoes = (m.correcoes || []).slice(-3).map((x) => `- ${x}`).join("\n");
  return `
MEMÓRIA SEMÂNTICA LIGHT 7 — SOMENTE CONTEXTO NÃO SENSÍVEL
- Turnos observados nesta sessão: ${m.turnos || 0}
- Tópicos recentes:\n${topicos || "nenhum"}
- Preferências/objetivos recentes:\n${preferencias || "nenhum"}
- Correções feitas pelo usuário:\n${correcoes || "nenhuma"}
Use isso apenas para manter continuidade. Uma mensagem nova e explícita sempre tem prioridade sobre memória antiga.
`;
}

function enriquecerConfig(config = {}, sessao = {}, texto = "") {
  const shekinah = config.shekinah || {};
  const base = String(shekinah.cursos || "");
  return {
    ...config,
    shekinah: {
      ...shekinah,
      cursos: `${base}\n\n${LIGHT7_PROMPT}\n${contextoLight7(sessao, texto)}`.trim(),
    },
  };
}

function assuntoOperacionalLocal(texto = "", sessao = {}) {
  const t = norm(texto);
  if (sessao?.instituicao === "unifatecie" || sessao?.instituicao === "shekinah") {
    if (/\b(curso|matricula|mensalidade|valor|portal|aluno|boleto|financeiro|certificado|ead|presencial|secretaria|cancelamento|trancamento)\b/.test(t)) return true;
  }
  return /\b(unifatecie|fatecie|shekinah|polo barreirinha|alunonet|gendocs)\b/.test(t);
}

function precisaWebUniversal(texto = "", sessao = {}) {
  if (assuntoOperacionalLocal(texto, sessao)) return false;
  const t = norm(texto);
  return /\b(hoje|agora|atual|atualmente|mais recente|ultimo|último|ultimos|últimos|noticia|notícias|noticias|placar|cotacao|cotação|preco hoje|preço hoje|clima|tempo em|quem e o presidente|quem é o presidente|eleicao|eleição|lancamento|lançamento|versao atual|versão atual|status atual|esta acontecendo|está acontecendo)\b/.test(t);
}

async function pesquisarWebUniversal({ textoOriginal, sessao }) {
  const chave = String(process.env.GROQ_API_KEY || "").trim();
  if (!chave || !precisaWebUniversal(textoOriginal, sessao) || sensivel(textoOriginal)) return null;

  const historico = Array.isArray(sessao?.historicoIA) ? sessao.historicoIA.slice(-8) : [];
  const hoje = new Date().toISOString().slice(0, 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    const resposta = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_WEB_MODEL || MODELO_WEB,
        messages: [
          {
            role: "system",
            content: `Você é Light. Hoje é ${hoje}. Responda em português do Brasil. Para esta pergunta, pesquise a web porque a resposta pode depender de informação recente. Seja direto, diferencie fato confirmado de informação incerta e não invente fontes. Não pesquise nem exponha dados privados. Se o assunto for UniFatecie Polo Barreirinha ou Shekinah, não substitua regras locais por informação genérica da internet.`,
          },
          ...historico,
          { role: "user", content: String(textoOriginal || "").trim() },
        ],
        temperature: 0.1,
        max_completion_tokens: 850,
        tools: [{ type: "browser_search" }],
        tool_choice: "required",
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) return null;
    const dados = await resposta.json();
    const conteudo = dados?.choices?.[0]?.message?.content;
    return typeof conteudo === "string" && conteudo.trim() ? conteudo.trim().slice(0, 2600) : null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

if (!IA.__light7Core && typeof IA.tentarResponderComIA === "function") {
  const original = IA.tentarResponderComIA;

  IA.tentarResponderComIA = async function (args = {}) {
    const sessao = args.sessao || {};
    const texto = String(args.textoOriginal || "").trim();

    // Para fatos recentes fora do atendimento local, pesquisa pública tem prioridade.
    const web = await pesquisarWebUniversal({ textoOriginal: texto, sessao });
    if (web) {
      const historico = Array.isArray(sessao.historicoIA) ? sessao.historicoIA : [];
      sessao.historicoIA = [
        ...historico,
        { role: "user", content: texto },
        { role: "assistant", content: web },
      ].slice(-40);
      memoriaLight7(sessao, texto);
      return web;
    }

    const resposta = await original({
      ...args,
      config: enriquecerConfig(args.config || {}, sessao, texto),
    });

    memoriaLight7(sessao, texto);
    return resposta;
  };

  Object.defineProperty(IA, "__light7Core", { value: true });
  console.log("🧠 Light 7 ativo: conhecimento geral, memória semântica e pesquisa atual ampliada.");
}

function selfTest() {
  const assert = require("assert");
  const s = {};
  assert.equal(precisaWebUniversal("Quais são as notícias mais recentes sobre tecnologia?", s), true);
  assert.equal(precisaWebUniversal("Quanto custa o curso da Shekinah?", { instituicao: "shekinah" }), false);
  const c = contextoLight7(s, "Quero aprender programação");
  assert.match(c, /Quero aprender programação/);
  const cfg = enriquecerConfig({ shekinah: { cursos: "BASE" } }, s, "oi");
  assert.match(cfg.shekinah.cursos, /CAMADA LIGHT 7/);
  console.log("✅ Self-test Light 7 aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  LIGHT7_PROMPT,
  memoriaLight7,
  contextoLight7,
  enriquecerConfig,
  precisaWebUniversal,
  pesquisarWebUniversal,
};
