const Module = require("module");
const originalLoad = Module._load;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODELO_VISAO_PADRAO = "qwen/qwen3.6-27b";
const TAMANHO_MAXIMO_BYTES = 15 * 1024 * 1024;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function textoSeguro(v = "") { return String(v || "").trim(); }

function norm(texto = "") {
  return textoSeguro(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function emFluxoEstruturado(sessao = {}) {
  const e = String(sessao?.etapa || "");
  return e.startsWith("unifatecie_matricula_")
    || e.startsWith("shekinah_matricula_")
    || e.startsWith("financeiro_")
    || e.startsWith("shekinah_secretaria_")
    || e === "atendimento_humano"
    || sessao?.atendimentoHumano === true;
}

function ehImagem(msg = {}) {
  const tipo = norm(msg?.type || msg?.mediaType || msg?.mediaData?.type || "");
  const mime = textoSeguro(
    msg?.mimetype || msg?.mimeType || msg?.mediaData?.mimetype || msg?.mediaData?.mimeType || ""
  ).toLowerCase();
  return ["image", "imagem", "photo", "picture"].includes(tipo) || mime.startsWith("image/");
}

function imagemReferenciada(msg = {}) {
  const candidatos = [
    msg,
    msg?.quotedMsg,
    msg?.quotedMsgObj,
    msg?.quotedMessage,
    msg?.quotedMessageObj,
  ].filter(Boolean);
  return candidatos.find((m) => ehImagem(m)) || null;
}

function limparBase64(valor = "") {
  const t = textoSeguro(valor);
  const idx = t.indexOf("base64,");
  return idx >= 0 ? t.slice(idx + 7) : t;
}

function extrairBase64(valor) {
  if (!valor) return "";
  if (typeof valor === "string") return limparBase64(valor);
  if (Buffer.isBuffer(valor)) return valor.toString("base64");
  if (typeof valor === "object") {
    for (const candidato of [valor.base64, valor.data, valor.body, valor.content, valor.file, valor.media]) {
      if (typeof candidato === "string" && candidato.trim()) return limparBase64(candidato);
      if (Buffer.isBuffer(candidato)) return candidato.toString("base64");
    }
  }
  return "";
}

function idsMensagem(msg = {}) {
  const candidatos = [
    msg?.id?._serialized,
    msg?.id?.serialized,
    msg?.id?.id,
    typeof msg?.id === "string" ? msg.id : null,
    msg?._serialized,
    msg?.messageId,
    msg?.msgId,
  ].filter((v) => typeof v === "string" && v.trim());
  return [...new Set(candidatos.map((v) => v.trim()))];
}

function obterMime(msg = {}) {
  const mime = textoSeguro(
    msg?.mimetype || msg?.mimeType || msg?.mediaData?.mimetype || msg?.mediaData?.mimeType || "image/jpeg"
  ).split(";")[0].toLowerCase();
  if (["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) return mime === "image/jpg" ? "image/jpeg" : mime;
  return "image/jpeg";
}

async function tentarDownload(client, alvo) {
  try {
    const retorno = await client.downloadMedia(alvo);
    const b64 = extrairBase64(retorno);
    if (b64) return b64;
  } catch (error) {
    console.warn("⚠️ Tentativa de download de imagem falhou:", error?.message || error);
  }
  return null;
}

async function baixarImagemComRetry(client, msg) {
  const body = textoSeguro(msg?.body);
  if (/^data:image\//i.test(body)) {
    const b64 = extrairBase64(body);
    if (b64) return b64;
  }

  const ids = idsMensagem(msg);
  for (const esperaMs of [0, 500, 1200, 2200, 3600]) {
    if (esperaMs) await esperar(esperaMs);

    for (const id of ids) {
      const b64 = await tentarDownload(client, id);
      if (b64) return b64;
    }

    let b64 = await tentarDownload(client, msg);
    if (b64) return b64;

    if (typeof client?.getMessageById === "function") {
      for (const id of ids) {
        try {
          const atualizada = await client.getMessageById(id);
          if (!atualizada) continue;
          b64 = await tentarDownload(client, atualizada);
          if (b64) return b64;
          for (const id2 of idsMensagem(atualizada)) {
            b64 = await tentarDownload(client, id2);
            if (b64) return b64;
          }
        } catch (error) {
          console.warn("⚠️ Não foi possível recarregar a mensagem de imagem:", error?.message || error);
        }
      }
    }
  }
  throw new Error("Mídia de imagem indisponível após novas tentativas");
}

function legendaDaMensagem(msg = {}, textoOriginal = "") {
  const candidatos = [
    msg?.caption,
    msg?.mediaData?.caption,
    msg?.text,
    textoOriginal,
  ];
  for (const c of candidatos) {
    const t = textoSeguro(c);
    if (t && !/^data:image\//i.test(t) && t.length < 1200) return t;
  }
  return "";
}

function mascararParaMemoria(texto = "") {
  return textoSeguro(texto)
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, "[e-mail protegido]")
    .replace(/\b(?:\d[\s.()\-/]*){8,}\b/g, "[identificador protegido]")
    .slice(0, 1200);
}

function contextoSessao(sessao = {}) {
  const m = sessao?.memoriaLight || {};
  const suporte = sessao?.suporteAluno || {};
  return [
    `Instituição ativa: ${sessao?.instituicao || m?.instituicao || "não definida"}`,
    `Assunto ativo: ${sessao?.assuntoAtual || m?.assunto || "não definido"}`,
    `Curso ativo: ${sessao?.eadCursoAtual || sessao?.cursoAtual?.nome || sessao?.curso || m?.cursoAtivo || "não definido"}`,
    `Suporte acadêmico atual: ${suporte?.intencao || "nenhum"}`,
    `Última pergunta do Light: ${textoSeguro(m?.ultimaPerguntaBot).slice(0, 350) || "nenhuma"}`,
    `Última resposta do Light: ${textoSeguro(m?.ultimaRespostaBot).slice(0, 500) || "nenhuma"}`,
  ].join("\n");
}

function promptVisao({ legenda = "", sessao = {} } = {}) {
  return `Você é o Light, assistente virtual do atendimento da UniFatecie Polo Barreirinha e do Centro Educacional Shekinah. Analise cuidadosamente a imagem recebida no WhatsApp e responda em português do Brasil como um atendente humano, simples e direto.\n\nCONTEXTO DA CONVERSA:\n${contextoSessao(sessao)}\n\nMENSAGEM/LEGENDA DO USUÁRIO:\n${legenda || "A pessoa enviou somente a imagem, sem texto."}\n\nREGRAS DE VISÃO:\n- Leia textos visíveis na imagem e entenda o contexto geral. Não faça apenas OCR: interprete o que é importante para o atendimento.\n- Você pode reconhecer prints de portal/app, boletos, comprovantes, avisos, banners de curso, certificados, documentos, telas de erro, conversas, cronogramas e fotos em geral.\n- Se a pessoa fez uma pergunta junto da imagem, responda à pergunta usando o que aparece na imagem.\n- Se já havia um problema em andamento e a pessoa mandou o print solicitado, use o print para avançar o atendimento; não peça o mesmo print de novo.\n- Se não houver pergunta nem contexto suficiente, diga brevemente o que você conseguiu identificar e pergunte o que a pessoa quer saber.\n- Nunca diga que "é erro do sistema" só por ver algo estranho. Diga o que aparece e, quando necessário, que pode ser uma inconsistência e que precisa de conferência.\n- Não invente datas, valores, regras acadêmicas ou situação individual que não estejam visíveis ou confirmadas.\n- Se a imagem mostrar uma promoção/campanha, explique apenas o que está visível e use a base local da conversa para regras atuais; uma arte antiga pode estar desatualizada.\n- Se houver dados pessoais sensíveis (CPF, RG, telefone, e-mail, matrícula, código, endereço completo), NÃO repita esses dados na resposta. Diga apenas o necessário para resolver o atendimento.\n- Se for comprovante, você pode identificar instituição, data, valor e status visível, mas não afirme que o pagamento foi compensado no sistema sem consulta real.\n- Se for boleto/cobrança, não diga que será cancelada ou anulada sem confirmação.\n- Se for print de live/aula, diferencie acesso, chat/interação, presença e gravação; não generalize regras que podem variar por disciplina.\n- Fale em 1 a 6 linhas na maioria dos casos. Só detalhe mais se a imagem exigir.\n- Não descreva pessoas fisicamente se isso não for relevante ao atendimento e não tente identificar quem é a pessoa na foto.`;
}

async function analisarImagemBase64({ base64, mimetype, legenda, sessao }) {
  const chave = textoSeguro(process.env.GROQ_API_KEY);
  if (!chave) return null;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > TAMANHO_MAXIMO_BYTES) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 24000);
  try {
    const resposta = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL || MODELO_VISAO_PADRAO,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptVisao({ legenda, sessao }) },
              {
                type: "image_url",
                image_url: { url: `data:${mimetype};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      console.warn(`⚠️ Visão Groq respondeu HTTP ${resposta.status}: ${detalhe.slice(0, 260)}`);
      return null;
    }
    const dados = await resposta.json();
    const conteudo = textoSeguro(dados?.choices?.[0]?.message?.content);
    return conteudo ? conteudo.slice(0, 2600) : null;
  } catch (error) {
    console.warn("⚠️ Falha ao analisar imagem:", error?.message || error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function registrarAnalise(sessao = {}, resposta = "", legenda = "") {
  const resumo = mascararParaMemoria(resposta);
  sessao.visaoUltima = {
    resumo,
    legenda: mascararParaMemoria(legenda),
    atualizadoEm: Date.now(),
  };
  sessao.atualizadoEm = Date.now();

  if (!sessao.memoriaLight || typeof sessao.memoriaLight !== "object") sessao.memoriaLight = { marcos: [] };
  const marcos = Array.isArray(sessao.memoriaLight.marcos) ? sessao.memoriaLight.marcos : [];
  sessao.memoriaLight.marcos = [...marcos, { tipo: "imagem", texto: resumo.slice(0, 220), em: Date.now() }].slice(-12);
  sessao.memoriaLight.atualizadoEm = Date.now();

  const hist = Array.isArray(sessao.historicoIA) ? sessao.historicoIA : [];
  sessao.historicoIA = [
    ...hist,
    { role: "user", content: legenda ? `[Imagem enviada com a mensagem: ${mascararParaMemoria(legenda)}]` : "[Imagem enviada pelo usuário]" },
    { role: "assistant", content: resumo },
  ].slice(-40);
}

async function tentarLerImagem(args = {}) {
  const { client, msg, textoOriginal, sessao, responder } = args;
  if (!client || !msg || !sessao || typeof responder !== "function") return false;
  if (msg?.fromMe === true || msg?.isSentByMe === true) return false;
  if (emFluxoEstruturado(sessao)) return false;

  const alvo = imagemReferenciada(msg);
  if (!alvo) return false;

  // Se a mensagem atual é apenas um texto que cita uma imagem antiga, só processa quando o objeto citado veio junto.
  const legenda = legendaDaMensagem(msg, textoOriginal);
  console.log(`🖼️ Imagem detectada para análise. mime=${obterMime(alvo)} legenda=${legenda ? "sim" : "não"}`);

  try {
    const base64 = await baixarImagemComRetry(client, alvo);
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return false;
    if (buffer.length > TAMANHO_MAXIMO_BYTES) {
      await responder(client, msg.from, "Essa imagem ficou grande demais para eu analisar. Se puder, envie uma versão menor ou um print recortado.");
      return true;
    }

    const resposta = await analisarImagemBase64({
      base64,
      mimetype: obterMime(alvo),
      legenda,
      sessao,
    });
    if (!resposta) return false;

    registrarAnalise(sessao, resposta, legenda);
    await responder(client, msg.from, resposta);
    console.log("✅ Imagem analisada com sucesso pelo Light.");
    return true;
  } catch (error) {
    console.warn("⚠️ Não foi possível ler a imagem do WhatsApp:", error?.message || error);
    return false;
  }
}

Module._load = function (request, parent, isMain) {
  const exp = originalLoad.apply(this, arguments);
  if (
    (request === "./atendimento-fixes" || request.endsWith("/atendimento-fixes")) &&
    exp && typeof exp.tentarCorrecoesAtendimento === "function" && !exp.__visionGroqWrapped
  ) {
    const original = exp.tentarCorrecoesAtendimento;
    exp.tentarCorrecoesAtendimento = async function (args = {}) {
      if (await tentarLerImagem(args)) return true;
      return original(args);
    };
    Object.defineProperty(exp, "__visionGroqWrapped", { value: true });
  }
  return exp;
};

function selfTest() {
  const assert = require("assert");
  assert.equal(ehImagem({ type: "image" }), true);
  assert.equal(ehImagem({ mimetype: "image/jpeg" }), true);
  assert.equal(ehImagem({ type: "chat" }), false);
  assert.equal(obterMime({ mimetype: "image/png" }), "image/png");
  assert.ok(idsMensagem({ id: { _serialized: "abc" } }).includes("abc"));
  assert.match(promptVisao({ legenda: "o que significa isso?", sessao: { instituicao: "unifatecie" } }), /o que significa isso/);
  assert.match(maskararParaMemoria("CPF 123.456.789-00 telefone 92999999999"), /protegido/);
  console.log("✅ Self-test da visão por imagens aprovado.");
}

if (process.argv.includes("--self-test")) selfTest();

module.exports = {
  ehImagem,
  imagemReferenciada,
  idsMensagem,
  obterMime,
  baixarImagemComRetry,
  analisarImagemBase64,
  promptVisao,
  mascararParaMemoria,
  tentarLerImagem,
};
