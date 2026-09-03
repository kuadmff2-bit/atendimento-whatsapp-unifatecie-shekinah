const GROQ_TRANSCRIPTION_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO_AUDIO_PADRAO = "whisper-large-v3-turbo";
const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
const DURACAO_MAXIMA_SEGUNDOS = 5 * 60;

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function obterChave() {
  return String(process.env.GROQ_API_KEY || "").trim();
}

function ehMensagemDeAudio(msg) {
  const tipo = String(msg?.type || "").toLowerCase();
  return tipo === "audio" || tipo === "ptt";
}

function limparBase64(valor = "") {
  const texto = String(valor || "").trim();
  const indice = texto.indexOf("base64,");
  return indice >= 0 ? texto.slice(indice + 7) : texto;
}

function mimeBase(mimetype = "") {
  return String(mimetype || "audio/ogg").split(";")[0].trim().toLowerCase() || "audio/ogg";
}

function extensaoPorMime(mimetype = "") {
  const mime = mimeBase(mimetype);
  const mapa = {
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "audio/aac": "aac",
  };
  return mapa[mime] || "ogg";
}

function idsMensagem(msg) {
  const candidatos = [
    msg?.id?._serialized,
    typeof msg?.id === "string" ? msg.id : null,
    msg?._serialized,
  ].filter(Boolean);
  return [...new Set(candidatos)];
}

async function tentarDownload(client, alvo) {
  try {
    const base64 = await client.downloadMedia(alvo);
    const limpo = limparBase64(base64);
    if (limpo) return limpo;
  } catch (error) {
    console.warn("⚠️ Tentativa de download de áudio falhou:", error?.message || error);
  }
  return null;
}

async function baixarAudioComRetry(client, msg) {
  const ids = idsMensagem(msg);
  const tentativas = [0, 700, 1500, 2500];

  for (const esperaMs of tentativas) {
    if (esperaMs) await esperar(esperaMs);

    // Primeiro tenta pelo próprio objeto Message.
    let base64 = await tentarDownload(client, msg);
    if (base64) return base64;

    // Depois tenta pelos IDs serializados conhecidos.
    for (const id of ids) {
      base64 = await tentarDownload(client, id);
      if (base64) return base64;
    }

    // Em versões do WPPConnect em que o objeto inicial ainda não contém a mídia,
    // busca a mensagem novamente antes de baixar.
    if (typeof client.getMessageById === "function") {
      for (const id of ids) {
        try {
          const atualizada = await client.getMessageById(id);
          if (atualizada) {
            base64 = await tentarDownload(client, atualizada);
            if (base64) return base64;
          }
        } catch (error) {
          console.warn("⚠️ Não foi possível recarregar a mensagem de áudio:", error?.message || error);
        }
      }
    }
  }

  throw new Error("Mídia de áudio indisponível após novas tentativas");
}

async function enviarParaWhisper(buffer, mimetype) {
  const chave = obterChave();
  if (!chave) {
    return {
      ok: false,
      mensagem: "🎤 O recurso de áudio ainda não está disponível neste momento. Tente enviar sua mensagem por texto. 😊",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const mime = mimeBase(mimetype);
    const extensao = extensaoPorMime(mime);
    const form = new FormData();

    form.append(
      "file",
      new Blob([buffer], { type: mime }),
      `audio-whatsapp.${extensao}`
    );
    form.append("model", process.env.GROQ_AUDIO_MODEL || MODELO_AUDIO_PADRAO);
    form.append("language", "pt");
    form.append("response_format", "json");
    form.append("temperature", "0");
    form.append(
      "prompt",
      "Atendimento educacional em português do Brasil. Termos frequentes: UniFatecie, Shekinah, Barreirinha, Pedagogia, matrícula, mensalidade, estágio, Informática Completa, Informática Avançada, Gestão Empresarial, Reforço Escolar."
    );

    const resposta = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
      },
      body: form,
      signal: controller.signal,
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "");
      console.warn(
        `⚠️ Groq Whisper respondeu HTTP ${resposta.status}: ${detalhe.slice(0, 300)}`
      );
      return {
        ok: false,
        mensagem: "🎤 Não consegui entender esse áudio agora. Pode tentar novamente ou escrever a mensagem? 😊",
      };
    }

    const dados = await resposta.json();
    const texto = String(dados?.text || "").trim();

    if (!texto) {
      return {
        ok: false,
        mensagem: "🎤 Não consegui identificar fala nesse áudio. Pode gravar novamente ou escrever a mensagem? 😊",
      };
    }

    return { ok: true, texto };
  } catch (error) {
    if (error?.name === "AbortError") {
      console.warn("⚠️ A transcrição do áudio excedeu o tempo limite.");
    } else {
      console.warn("⚠️ Falha ao transcrever áudio:", error?.message || error);
    }

    return {
      ok: false,
      mensagem: "🎤 Não consegui processar esse áudio agora. Tente novamente ou envie a mensagem por texto. 😊",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function transcreverAudioWhatsApp(client, msg) {
  if (!ehMensagemDeAudio(msg)) return { ok: false, ignorar: true };

  const duracao = Number(msg?.duration || 0);
  if (duracao > DURACAO_MAXIMA_SEGUNDOS) {
    return {
      ok: false,
      mensagem: "🎤 Esse áudio é muito longo. Envie um áudio de até *5 minutos* ou escreva sua mensagem. 😊",
    };
  }

  try {
    const base64 = await baixarAudioComRetry(client, msg);
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) throw new Error("Áudio vazio após decodificação");

    if (buffer.length > TAMANHO_MAXIMO_BYTES) {
      return {
        ok: false,
        mensagem: "🎤 Esse áudio ficou grande demais para eu processar. Envie um áudio menor ou escreva sua mensagem. 😊",
      };
    }

    return enviarParaWhisper(buffer, msg?.mimetype || "audio/ogg");
  } catch (error) {
    console.warn("⚠️ Não foi possível baixar o áudio do WhatsApp:", error?.message || error);
    return {
      ok: false,
      mensagem: "🎤 Não consegui acessar esse áudio agora. Pode tentar enviar novamente ou escrever a mensagem? 😊",
    };
  }
}

module.exports = {
  ehMensagemDeAudio,
  transcreverAudioWhatsApp,
};
