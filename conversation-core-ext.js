const base = require("./conversation-core");

function normalizar(texto = "") {
  return String(texto).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,;:]+/g, " ").replace(/\s+/g, " ").trim();
}

const CURSOS_AMPLIADOS = {
  administracao: { emoji:"🏢", nome:"Administração", formacao:"Bacharelado", duracao:"3 anos", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  pedagogia: { emoji:"📚", nome:"Pedagogia", formacao:"Licenciatura", duracao:"4 anos", mensalidade:"R$ 112,20", estagio:"Estágio obrigatório", modalidade:"100% EAD" },
  ads: { emoji:"💻", nome:"Análise e Desenvolvimento de Sistemas", formacao:"Tecnólogo", duracao:"2 anos", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  rh: { emoji:"👥", nome:"Gestão de Recursos Humanos", formacao:"Tecnólogo", duracao:"1 ano e 6 meses", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  gestao_financeira: { emoji:"💰", nome:"Gestão Financeira", formacao:"Tecnólogo", duracao:"1 ano e 6 meses", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  logistica: { emoji:"📦", nome:"Logística", formacao:"Tecnólogo", duracao:"1 ano e 6 meses", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  processos: { emoji:"📈", nome:"Processos Gerenciais", formacao:"Tecnólogo", duracao:"1 ano e 6 meses", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  sistemas_internet: { emoji:"🌐", nome:"Sistemas para Internet", formacao:"Tecnólogo", duracao:"2 anos", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  design_moda: { emoji:"👗", nome:"Design de Moda", formacao:"Tecnólogo", duracao:"1 ano e 6 meses", mensalidade:"R$ 112,20", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  engenharia_software: { emoji:"🧑‍💻", nome:"Engenharia de Software", formacao:"Bacharelado", duracao:"4 anos", mensalidade:"R$ 169,66", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  ciencias_contabeis: { emoji:"📊", nome:"Ciências Contábeis", formacao:"Bacharelado", duracao:"3 anos", mensalidade:"Consultar o secretário", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  ciencia_felicidade: { emoji:"😊", nome:"Ciência da Felicidade", formacao:"Tecnólogo", duracao:"2 anos", mensalidade:"Consultar o secretário", estagio:"Confirmar com o secretário", modalidade:"100% EAD" },
  biblioteconomia: { emoji:"📖", nome:"Biblioteconomia", formacao:"Bacharelado", duracao:"3 anos", mensalidade:"Consultar o secretário", estagio:"Estágio obrigatório", modalidade:"EAD" },
  automacao_industrial: { emoji:"⚙️", nome:"Automação Industrial", formacao:"Tecnólogo", duracao:"2 anos e 6 meses", mensalidade:"Consultar o secretário", estagio:"Confirmar com o secretário", modalidade:"EAD" },
  agronegocio: { emoji:"🌾", nome:"Agronegócio", formacao:"Tecnólogo", duracao:"2 anos e 6 meses", mensalidade:"Consultar o secretário", estagio:"Confirmar com o secretário", modalidade:"EAD" },
  artes_visuais: { emoji:"🎨", nome:"Artes Visuais", formacao:"Bacharelado", duracao:"2 anos e 6 meses", mensalidade:"Consultar o secretário", estagio:"Estágio obrigatório", modalidade:"EAD" },
  engenharia_computacao: { emoji:"🖥️", nome:"Engenharia da Computação", formacao:"Bacharelado", duracao:"4 anos", mensalidade:"Consultar o secretário", estagio:"Sem estágio obrigatório", modalidade:"100% EAD" },
  psicanalise: { emoji:"🧠", nome:"Psicanálise", formacao:"Bacharelado", duracao:"4 anos", mensalidade:"Consultar o secretário", estagio:"Estágio obrigatório", modalidade:"EAD" }
};

const CURSOS_NAO_OFERTADOS_POLO = [
  { nomes:["radiologia"], nome:"Radiologia", motivo:"é semipresencial e exige atividades presenciais" },
  { nomes:["biomedicina"], nome:"Biomedicina", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["farmacia"], nome:"Farmácia", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["fisioterapia"], nome:"Fisioterapia", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["fonoaudiologia"], nome:"Fonoaudiologia", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["nutricao"], nome:"Nutrição", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["terapia ocupacional"], nome:"Terapia Ocupacional", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["estetica e cosmetica","estetica"], nome:"Estética e Cosmética", motivo:"exige atividades presenciais" },
  { nomes:["enfermagem"], nome:"Enfermagem", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["odontologia"], nome:"Odontologia", motivo:"é da área da saúde e exige atividades presenciais" },
  { nomes:["arquitetura e urbanismo","arquitetura"], nome:"Arquitetura e Urbanismo", motivo:"possui exigências presenciais" },
  { nomes:["engenharia agronomica","agronomia"], nome:"Engenharia Agronômica (Agronomia)", motivo:"possui exigências presenciais" },
  { nomes:["engenharia civil"], nome:"Engenharia Civil", motivo:"na oferta semipresencial possui atividades presenciais" },
  { nomes:["engenharia eletrica"], nome:"Engenharia Elétrica", motivo:"na oferta semipresencial possui atividades presenciais" },
  { nomes:["engenharia mecanica"], nome:"Engenharia Mecânica", motivo:"na oferta semipresencial possui atividades presenciais" }
];

function montarCatalogo(cursos = {}) {
  const todos = { ...cursos };
  const existentes = new Set(Object.values(todos).map(c => normalizar(c.nome)));
  let i = 100;
  for (const curso of Object.values(CURSOS_AMPLIADOS)) {
    if (!existentes.has(normalizar(curso.nome))) todos[`extra_${i++}`] = curso;
  }
  return todos;
}

function encontrarNaoOfertado(texto) {
  const t = normalizar(texto);
  return CURSOS_NAO_OFERTADOS_POLO.find(c => c.nomes.some(n => t.includes(normalizar(n)))) || null;
}

function encontrarCursoNoTexto(texto, cursos = {}) {
  const t = normalizar(texto);
  if (/\bads\b/.test(t)) return Object.values(cursos).find(c => normalizar(c.nome).includes("analise e desenvolvimento de sistemas")) || null;
  if (/\brh\b/.test(t)) return Object.values(cursos).find(c => normalizar(c.nome).includes("gestao de recursos humanos")) || null;
  return Object.values(cursos).find(c => t.includes(normalizar(c.nome))) || null;
}

function formatarMensalidade(curso) {
  if (!curso?.mensalidade) return "💰 Mensalidade: *consultar o secretário*";
  if (/consultar/i.test(curso.mensalidade)) return `💰 Mensalidade: *${curso.mensalidade}*`;
  return `💰 Mensalidade: *${curso.mensalidade}/mês*`;
}

function respostaObjetivaCurso(textoOriginal, curso) {
  if (!curso) return null;
  const t = normalizar(textoOriginal), campos = [];
  if (/\b(valor|valores|preco|precos|mensalidade|mensalidades|quanto custa|quanto e)\b/.test(t)) campos.push(formatarMensalidade(curso));
  if (/\b(duracao|dura|tempo|quanto tempo|quantos anos|quantos meses)\b/.test(t)) campos.push(`⏳ Duração: *${curso.duracao}*`);
  if (/\b(estagio)\b/.test(t)) campos.push(`📚 Estágio: *${curso.estagio}*`);
  if (/\b(formacao|tipo de curso|bacharelado|licenciatura|tecnologo)\b/.test(t)) campos.push(`🎓 Formação: *${curso.formacao}*`);
  if (/\b(modalidade|online|ead|presencial)\b/.test(t) && curso.modalidade) campos.push(`💻 Modalidade: *${curso.modalidade}*`);
  return campos.length ? `${curso.emoji || "🎓"} *${curso.nome}*\n${campos.join("\n")}` : null;
}

function detalhesCurso(curso) {
  return `${curso.emoji || "🎓"} *${curso.nome}*\n${formatarMensalidade(curso)}\n⏳ Duração: *${curso.duracao}*\n🎓 Formação: *${curso.formacao}*\n💻 Modalidade: *${curso.modalidade || "EAD"}*\n📚 Estágio: *${curso.estagio}*`;
}

function ajustarTratamento(mensagem = "") {
  return String(mensagem)
    .replace("👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊", "👥 Claro! Você quer falar com o secretário da *UniFatecie* ou com a secretária da *Shekinah*? 😊")
    .replace("✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼", "✅ Pronto! Seu atendimento foi encaminhado para o secretário da UniFatecie. 👨‍💼")
    .replace(/para a secretaria da UniFatecie/g, "para o secretário da UniFatecie")
    .replace(/com a secretaria da UniFatecie/g, "com o secretário da UniFatecie")
    .trim();
}

function emFluxoObrigatorio(sessao) {
  const e = String(sessao?.etapa || "");
  return e.startsWith("unifatecie_matricula_") || e.startsWith("shekinah_matricula_") || e.startsWith("financeiro_") || e.startsWith("shekinah_secretaria_") || e === "atendimento_humano";
}

function ehPerguntaDeContinuacaoCurso(t) {
  return /\b(valor|preco|mensalidade|duracao|dura|tempo|estagio|formacao|modalidade|online|ead)\b/.test(t) && !/\b(outro curso|qual curso|quais cursos)\b/.test(t);
}

async function tentarConversaNatural(args = {}) {
  const responder = args.responder;
  const textoOriginal = String(args.textoOriginal || "");
  const t = normalizar(textoOriginal);
  const sessao = args.sessao;
  const catalogo = montarCatalogo(args.cursosUnifatecie || {});

  if (/^(qual (e )?seu nome|qual o seu nome|como voce se chama|quem e voce|quem voce e|seu nome|nome)$/.test(t)) {
    await responder(args.client, args.msg.from, "🤖 Meu nome é *Light*. Sou o assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊");
    return true;
  }
  if (/^(oi+|ola+|opa+|alo+|ei+|e ai|hey+|hello|salve|bom dia|boa tarde|boa noite)$/.test(t)) {
    await responder(args.client, args.msg.from, "🤖 Oi! Eu sou o *Light* 😊 Como posso te ajudar?");
    return true;
  }

  const bloqueado = encontrarNaoOfertado(textoOriginal);
  if (bloqueado) {
    sessao.instituicao = "unifatecie";
    await responder(args.client, args.msg.from, `⚠️ O curso de *${bloqueado.nome}* não é ofertado pelo nosso Polo UniFatecie Barreirinha, porque ${bloqueado.motivo}.\n\nNosso polo trabalha com cursos que podem ser acompanhados a distância, sem essa exigência presencial. 🎓`);
    return true;
  }

  let curso = encontrarCursoNoTexto(textoOriginal, catalogo);

  if (/^(unifatecie|fatecie)$/.test(t) && sessao?.acaoPendente === "cursos") {
    sessao.instituicao = "unifatecie"; sessao.acaoPendente = null;
    const lista = Object.values(catalogo).filter(c => !/consultar/i.test(c.mensalidade || "")).map(c => `${c.emoji || "🎓"} *${c.nome}* — ${c.mensalidade}/mês — ${c.duracao}`).join("\n");
    await responder(args.client, args.msg.from, `🎓 *Cursos com informações locais cadastradas — UniFatecie Polo Barreirinha*\n\n${lista}\n\nHá outras opções no catálogo; posso consultar pelo nome do curso sem você precisar repetir o contexto.`);
    return true;
  }

  if (/^shekinah$/.test(t) && sessao?.acaoPendente === "cursos") {
    sessao.instituicao = "shekinah"; sessao.acaoPendente = null;
    await responder(args.client, args.msg.from, String(args.config?.shekinah?.cursos || "").replace(/\n\nPara iniciar[\s\S]*$/i, ""));
    return true;
  }

  if (/\b(curso|cursos)\b/.test(t) && /\b(valor|valores|preco|precos|mensalidade|mensalidades|quanto custa|lista|quais|mostrar|mostra)\b/.test(t) && !/unifatecie|fatecie|shekinah/.test(t) && !sessao?.instituicao) {
    sessao.acaoPendente = "cursos";
    await responder(args.client, args.msg.from, "🎓 Claro! Você quer ver os cursos da *UniFatecie* ou da *Shekinah*? 😊");
    return true;
  }

  if (curso) {
    sessao.curso = curso.nome; sessao.cursoAtual = curso; sessao.instituicao = "unifatecie";
    await responder(args.client, args.msg.from, respostaObjetivaCurso(textoOriginal, curso) || detalhesCurso(curso));
    return true;
  }

  // Memória contextual: frases como “e a duração do curso?”, inclusive por áudio, usam o último curso citado.
  if (!curso && sessao?.cursoAtual && ehPerguntaDeContinuacaoCurso(t)) {
    await responder(args.client, args.msg.from, respostaObjetivaCurso(textoOriginal, sessao.cursoAtual) || detalhesCurso(sessao.cursoAtual));
    return true;
  }

  if (!emFluxoObrigatorio(sessao) && typeof args.iaDisponivel === "function" && args.iaDisponivel() && typeof args.tentarResponderComIA === "function") {
    const configIA = { ...args.config, regrasPolo: "No Polo UniFatecie Barreirinha, cursos da área da saúde e cursos semipresenciais/com exigência presencial não são ofertados. Aulas dos cursos ofertados são 100% online pelo portal. Nunca invente disponibilidade local." };
    const respostaIA = await args.tentarResponderComIA({ textoOriginal, sessao, cursosUnifatecie: catalogo, config: configIA });
    if (respostaIA) { await responder(args.client, args.msg.from, respostaIA); return true; }
  }

  return base.tentarConversaNatural({ ...args, cursosUnifatecie: catalogo, responder: async (client, destino, mensagem) => responder(client, destino, ajustarTratamento(mensagem)) });
}

module.exports = { tentarConversaNatural, ajustarTratamento };
