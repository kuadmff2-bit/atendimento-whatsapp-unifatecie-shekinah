const fs = require("fs");
const path = require("path");

const PASTA_DADOS = path.join(process.cwd(), "tokens");
const ARQUIVO_AUTONOMIA = path.join(PASTA_DADOS, "autonomia.json");
const ARQUIVO_SESSOES = path.join(PASTA_DADOS, "sessoes.json");
const ARQUIVO_RESET_WHATSAPP = path.join(PASTA_DADOS, "reset-whatsapp.flag");

const ARQUIVOS_PERSISTENTES = new Set([
  "autonomia.json",
  "sessoes.json",
  "contato-secretaria.json",
  "reset-whatsapp.flag",
]);

const estadoPadrao = {
  versao: 1,
  atualizadoEm: null,
  fatos: {},
  promocoes: {},
  cursosUnifatecie: {},
  cursosShekinah: {},
  trocaNumeroPendenteAte: null,
  metricas: {
    mensagens: 0,
    audios: 0,
    erros: 0,
    matriculasIniciadas: 0,
    atualizadoEm: null,
  },
  errosRecentes: [],
};

function garantirPasta() {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });
}

function escreverJsonAtomico(arquivo, dados) {
  garantirPasta();
  const temporario = `${arquivo}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), "utf8");
  fs.renameSync(temporario, arquivo);
}

function limparCredenciaisWhatsappNoBoot() {
  try {
    if (!fs.existsSync(ARQUIVO_RESET_WHATSAPP)) return;

    garantirPasta();
    let removidos = 0;

    for (const item of fs.readdirSync(PASTA_DADOS, { withFileTypes: true })) {
      if (ARQUIVOS_PERSISTENTES.has(item.name)) continue;

      fs.rmSync(path.join(PASTA_DADOS, item.name), {
        recursive: true,
        force: true,
      });
      removidos += 1;
    }

    fs.rmSync(ARQUIVO_RESET_WHATSAPP, { force: true });
    console.log(`🔄 Troca de número: ${removidos} item(ns) de credencial do WhatsApp removido(s).`);
    console.log("📲 A próxima conexão deverá solicitar um novo QR Code.");
  } catch (error) {
    console.error("❌ Não foi possível limpar as credenciais antigas do WhatsApp:", error.message);
    throw error;
  }
}

// Executa antes de o WPPConnect abrir o navegador.
limparCredenciaisWhatsappNoBoot();

function carregarEstado() {
  try {
    if (!fs.existsSync(ARQUIVO_AUTONOMIA)) return structuredClone(estadoPadrao);
    const salvo = JSON.parse(fs.readFileSync(ARQUIVO_AUTONOMIA, "utf8"));
    return {
      ...structuredClone(estadoPadrao),
      ...salvo,
      fatos: { ...(salvo?.fatos || {}) },
      promocoes: { ...(salvo?.promocoes || {}) },
      cursosUnifatecie: { ...(salvo?.cursosUnifatecie || {}) },
      cursosShekinah: { ...(salvo?.cursosShekinah || {}) },
      metricas: { ...estadoPadrao.metricas, ...(salvo?.metricas || {}) },
      errosRecentes: Array.isArray(salvo?.errosRecentes) ? salvo.errosRecentes.slice(-25) : [],
    };
  } catch (error) {
    console.warn("⚠️ Não foi possível carregar autonomia.json:", error.message);
    return structuredClone(estadoPadrao);
  }
}

let estado = carregarEstado();

function salvarEstado() {
  estado.atualizadoEm = new Date().toISOString();
  escreverJsonAtomico(ARQUIVO_AUTONOMIA, estado);
}

function normalizar(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function somenteNumeros(valor = "") {
  return String(valor).replace(/\D/g, "");
}

function candidatosNumero(numero = "") {
  const completo = somenteNumeros(numero);
  const lista = new Set([completo]);
  if (completo.startsWith("55")) lista.add(completo.slice(2));
  return lista;
}

function ehAdmin(remetente = "") {
  const configurado = somenteNumeros(
    process.env.BOT_ADMIN_PHONE || process.env.ADMIN_PHONE || ""
  );
  if (!configurado) return false;

  const origem = String(remetente).split("@")[0];
  const admin = candidatosNumero(configurado);
  const recebido = candidatosNumero(origem);
  return [...recebido].some((numero) => admin.has(numero));
}

function encontrarCursoPorNome(cursos, nome) {
  const alvo = normalizar(nome);
  return Object.values(cursos || {}).find((curso) => {
    const n = normalizar(curso?.nome || "");
    return n === alvo || n.includes(alvo) || alvo.includes(n);
  }) || null;
}

function aplicarOverridesCursos(cursosUnifatecie = {}) {
  for (const [nome, alteracoes] of Object.entries(estado.cursosUnifatecie || {})) {
    const curso = encontrarCursoPorNome(cursosUnifatecie, nome);
    if (!curso) continue;
    Object.assign(curso, alteracoes || {});
  }
  return cursosUnifatecie;
}

function contextoDinamicoIA() {
  const linhas = [];
  const fatos = Object.entries(estado.fatos || {});
  const promocoes = Object.entries(estado.promocoes || {});
  const cursosFatecie = Object.entries(estado.cursosUnifatecie || {});
  const cursosShekinah = Object.entries(estado.cursosShekinah || {});

  if (fatos.length) {
    linhas.push("FATOS ADMINISTRATIVOS ATUAIS (têm prioridade sobre a internet):");
    for (const [chave, valor] of fatos) linhas.push(`- ${chave}: ${valor}`);
  }

  if (promocoes.length) {
    linhas.push("PROMOÇÕES ATUAIS CADASTRADAS PELO ADMINISTRADOR:");
    for (const [instituicao, texto] of promocoes) linhas.push(`- ${instituicao}: ${texto}`);
  }

  if (cursosFatecie.length) {
    linhas.push("ALTERAÇÕES DE CURSOS UNIFATECIE CADASTRADAS PELO ADMINISTRADOR:");
    for (const [curso, dados] of cursosFatecie) {
      linhas.push(`- ${curso}: ${JSON.stringify(dados)}`);
    }
  }

  if (cursosShekinah.length) {
    linhas.push("ALTERAÇÕES DE CURSOS SHEKINAH CADASTRADAS PELO ADMINISTRADOR:");
    for (const [curso, dados] of cursosShekinah) {
      linhas.push(`- ${curso}: ${JSON.stringify(dados)}`);
    }
  }

  return linhas.join("\n");
}

function registrarEvento(tipo) {
  const m = estado.metricas;
  if (tipo === "mensagem") m.mensagens += 1;
  if (tipo === "audio") m.audios += 1;
  if (tipo === "matricula") m.matriculasIniciadas += 1;
  m.atualizadoEm = new Date().toISOString();

  if (tipo !== "mensagem" || m.mensagens % 10 === 0) salvarEstado();
}

function registrarErro(error, contexto = "") {
  estado.metricas.erros += 1;
  estado.metricas.atualizadoEm = new Date().toISOString();
  estado.errosRecentes.push({
    em: new Date().toISOString(),
    contexto: String(contexto || "").slice(0, 160),
    erro: String(error?.message || error || "erro desconhecido").slice(0, 500),
  });
  estado.errosRecentes = estado.errosRecentes.slice(-25);
  salvarEstado();
}

function carregarSessoesPersistidas() {
  try {
    if (!fs.existsSync(ARQUIVO_SESSOES)) return [];
    const dados = JSON.parse(fs.readFileSync(ARQUIVO_SESSOES, "utf8"));
    if (!Array.isArray(dados)) return [];
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    return dados.filter(([, sessao]) => Number(sessao?.atualizadoEm || 0) >= limite);
  } catch (error) {
    console.warn("⚠️ Não foi possível carregar sessões persistidas:", error.message);
    return [];
  }
}

function persistirSessoes(sessoes) {
  try {
    if (!(sessoes instanceof Map)) return;
    const limite = Date.now() - 24 * 60 * 60 * 1000;
    const serializaveis = [...sessoes.entries()]
      .filter(([, sessao]) => Number(sessao?.atualizadoEm || 0) >= limite)
      .slice(-500);
    escreverJsonAtomico(ARQUIVO_SESSOES, serializaveis);
  } catch (error) {
    console.warn("⚠️ Falha ao persistir sessões:", error.message);
  }
}

function resumoStatus() {
  const m = estado.metricas;
  return (
    "🤖 *STATUS DO BOT*\n\n" +
    `📩 Mensagens processadas: *${m.mensagens}*\n` +
    `🎤 Áudios processados: *${m.audios}*\n` +
    `📝 Matrículas iniciadas: *${m.matriculasIniciadas}*\n` +
    `⚠️ Erros registrados: *${m.erros}*\n` +
    `🧠 Fatos personalizados: *${Object.keys(estado.fatos).length}*\n` +
    `🔥 Promoções ativas: *${Object.keys(estado.promocoes).length}*\n` +
    `💾 Persistência: *ativa*`
  );
}

function ajudaAdmin() {
  return (
    "🛠️ *COMANDOS DO ADMINISTRADOR*\n\n" +
    "*status bot* — mostra métricas e estado\n" +
    "*admin ajuda* — mostra estes comandos\n" +
    "*definir fato CHAVE = VALOR* — salva uma informação oficial\n" +
    "*remover fato CHAVE* — apaga a informação\n" +
    "*listar fatos* — mostra informações salvas\n" +
    "*promoção unifatecie = TEXTO* — define promoção atual\n" +
    "*promoção shekinah = TEXTO* — define promoção atual\n" +
    "*remover promoção unifatecie* / *shekinah*\n" +
    "*atualizar curso NOME | mensalidade = VALOR*\n" +
    "*atualizar curso NOME | duração = VALOR*\n" +
    "*atualizar curso NOME | estágio = VALOR*\n" +
    "*listar erros* — últimos erros registrados\n" +
    "*trocar numero do robo* — inicia troca segura do WhatsApp conectado\n\n" +
    "✅ As alterações ficam salvas no volume do Railway e entram na base da IA sem novo deploy."
  );
}

function listarFatos() {
  const itens = Object.entries(estado.fatos || {});
  if (!itens.length) return "🧠 Nenhum fato personalizado cadastrado.";
  return "🧠 *FATOS CADASTRADOS*\n\n" + itens.map(([k, v]) => `• *${k}*: ${v}`).join("\n");
}

function listarErros() {
  const itens = (estado.errosRecentes || []).slice(-8).reverse();
  if (!itens.length) return "✅ Nenhum erro recente registrado.";
  return (
    "⚠️ *ERROS RECENTES*\n\n" +
    itens.map((item) => `• ${item.em}\n${item.contexto || "sem contexto"}: ${item.erro}`).join("\n\n")
  );
}

function solicitarTrocaNumero() {
  estado.trocaNumeroPendenteAte = Date.now() + 5 * 60 * 1000;
  salvarEstado();

  return (
    "⚠️ *TROCA DO NÚMERO DO ROBÔ*\n\n" +
    "Isso vai desconectar o WhatsApp atual do robô e gerar uma nova conexão por QR Code.\n\n" +
    "✅ Cursos, promoções, base da IA, métricas e dados persistentes serão mantidos.\n" +
    "📱 Somente a sessão do WhatsApp será trocada.\n\n" +
    "Para confirmar nos próximos 5 minutos, digite exatamente:\n" +
    "*confirmar troca numero*\n\n" +
    "Para desistir, digite *cancelar troca numero*."
  );
}

function confirmarTrocaNumero() {
  const limite = Number(estado.trocaNumeroPendenteAte || 0);
  if (!limite || Date.now() > limite) {
    estado.trocaNumeroPendenteAte = null;
    salvarEstado();
    return "⚠️ A confirmação expirou. Digite *trocar numero do robo* novamente.";
  }

  garantirPasta();
  fs.writeFileSync(ARQUIVO_RESET_WHATSAPP, new Date().toISOString(), "utf8");
  estado.trocaNumeroPendenteAte = null;
  salvarEstado();

  // Dá tempo para a resposta ser enviada antes do Railway reiniciar o processo.
  setTimeout(() => process.exit(1), 3500);

  return (
    "🔄 *Troca de número confirmada.*\n\n" +
    "O robô vai reiniciar agora e remover somente a sessão antiga do WhatsApp.\n" +
    "📲 Depois, abra a página do bot no Railway para ver o novo QR Code e escaneie com o novo número."
  );
}

function tratarComandoAdmin(textoOriginal, remetente) {
  if (!ehAdmin(remetente)) return null;
  const original = String(textoOriginal || "").trim();
  const t = normalizar(original);

  if (t === "admin ajuda" || t === "comandos admin" || t === "ajuda admin") {
    return ajudaAdmin();
  }
  if (t === "status bot" || t === "status do bot") return resumoStatus();
  if (t === "listar fatos") return listarFatos();
  if (t === "listar erros") return listarErros();

  if (t === "trocar numero do robo" || t === "trocar numero robo") {
    return solicitarTrocaNumero();
  }

  if (t === "cancelar troca numero" || t === "cancelar troca do numero") {
    estado.trocaNumeroPendenteAte = null;
    salvarEstado();
    return "✅ Troca do número cancelada. O WhatsApp atual continuará conectado.";
  }

  if (t === "confirmar troca numero" || t === "confirmar troca do numero") {
    return confirmarTrocaNumero();
  }

  let match = original.match(/^definir\s+fato\s+(.+?)\s*=\s*(.+)$/i);
  if (match) {
    const chave = match[1].trim();
    const valor = match[2].trim();
    if (!chave || !valor) return "⚠️ Use: *definir fato CHAVE = VALOR*";
    estado.fatos[chave] = valor;
    salvarEstado();
    return `✅ Fato salvo: *${chave}* = ${valor}`;
  }

  match = original.match(/^remover\s+fato\s+(.+)$/i);
  if (match) {
    const chaveDigitada = match[1].trim();
    const real = Object.keys(estado.fatos).find((k) => normalizar(k) === normalizar(chaveDigitada));
    if (!real) return "⚠️ Não encontrei esse fato cadastrado.";
    delete estado.fatos[real];
    salvarEstado();
    return `✅ Fato removido: *${real}*`;
  }

  match = original.match(/^promo(?:ç|c)[aã]o\s+(unifatecie|shekinah)\s*=\s*(.+)$/i);
  if (match) {
    const instituicao = normalizar(match[1]);
    estado.promocoes[instituicao] = match[2].trim();
    salvarEstado();
    return `✅ Promoção da *${instituicao}* atualizada e já disponível para a IA.`;
  }

  match = original.match(/^remover\s+promo(?:ç|c)[aã]o\s+(unifatecie|shekinah)$/i);
  if (match) {
    const instituicao = normalizar(match[1]);
    delete estado.promocoes[instituicao];
    salvarEstado();
    return `✅ Promoção da *${instituicao}* removida.`;
  }

  match = original.match(/^atualizar\s+curso\s+(.+?)\s*\|\s*(mensalidade|duracao|dura(?:ç|c)[aã]o|estagio|est[aá]gio|formacao|forma(?:ç|c)[aã]o)\s*=\s*(.+)$/i);
  if (match) {
    const curso = match[1].trim();
    let campo = normalizar(match[2]);
    if (campo === "duracao") campo = "duracao";
    if (campo === "estagio") campo = "estagio";
    if (campo === "formacao") campo = "formacao";
    const valor = match[3].trim();
    estado.cursosUnifatecie[curso] = {
      ...(estado.cursosUnifatecie[curso] || {}),
      [campo]: valor,
    };
    salvarEstado();
    return `✅ *${curso}* atualizado: ${campo} = *${valor}*`;
  }

  if (/^(admin|status bot|definir fato|remover fato|listar fatos|listar erros|promo[cç][aã]o|remover promo[cç][aã]o|atualizar curso|trocar numero|confirmar troca|cancelar troca)/i.test(original)) {
    return "⚠️ Não entendi o comando administrativo. Digite *admin ajuda*.";
  }

  return null;
}

module.exports = {
  ehAdmin,
  tratarComandoAdmin,
  aplicarOverridesCursos,
  contextoDinamicoIA,
  registrarEvento,
  registrarErro,
  carregarSessoesPersistidas,
  persistirSessoes,
};
