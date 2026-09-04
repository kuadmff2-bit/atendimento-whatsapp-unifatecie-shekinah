const TIMEOUT_MS = 15000;

function configuracao() {
  const url = String(process.env.ESCOLA_AVANCADA_API_URL || "").trim();
  const token = String(process.env.ESCOLA_AVANCADA_TOKEN || "").trim();
  return { url, token, configurada: Boolean(url && token) };
}

function baseApiUrl() {
  const { url } = configuracao();
  if (!url) throw new Error("ESCOLA_AVANCADA_API_URL não configurada");
  if (!/^https:\/\//i.test(url)) throw new Error("ESCOLA_AVANCADA_API_URL precisa usar HTTPS");
  return url.replace(/\?.*$/, "").replace(/\/+$/, "/");
}

function endpointUrl(acao) {
  return `${baseApiUrl()}?${encodeURIComponent(acao)}=null`;
}

function valorForm(v) {
  if (Array.isArray(v)) return v.join(",");
  return String(v);
}

async function post(acao, campos = {}) {
  const { token } = configuracao();
  if (!token) throw new Error("ESCOLA_AVANCADA_TOKEN não configurado");

  const form = new FormData();
  form.append("token", token);
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor === undefined || valor === null) continue;
    form.append(chave, valorForm(valor));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resposta;
  try {
    resposta = await fetch(endpointUrl(acao), {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: { "user-agent": "Light-Shekinah/2.0" }
    });
  } catch (erro) {
    if (erro?.name === "AbortError") throw new Error(`API Escola Avançada excedeu ${TIMEOUT_MS / 1000}s`);
    throw erro;
  } finally {
    clearTimeout(timer);
  }

  const texto = await resposta.text();
  if (!resposta.ok) throw new Error(`API Escola Avançada HTTP ${resposta.status}`);

  let dados;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error("API Escola Avançada retornou uma resposta inválida");
  }

  const erroApi = String(dados?.erro || "").trim();
  if (erroApi) throw new Error(`API Escola Avançada: ${erroApi}`);
  return dados?.resultado;
}

async function listarCursos(categoria) {
  return post("cursos/listar", categoria ? { categoria } : {});
}

async function listarAulas(curso) {
  if (!curso) throw new Error("curso é obrigatório");
  return post("cursos/aulas", { curso });
}

const CAMPOS_ALUNO = [
  "nome", "fone", "email", "cpf", "rg", "responsavel", "rua", "bairro",
  "estado", "cidade", "numero", "nascimento", "obs", "datacadastro",
  "rg_responsavel", "cpf_responsavel", "cep", "fone2", "polo", "status",
  "apostila", "vendedor", "datafinal", "certificado", "bolsista",
  "funcionario_cadastro", "sexo"
];

async function novoAluno(dados = {}) {
  const payload = {};
  for (const campo of CAMPOS_ALUNO) {
    if (dados[campo] !== undefined && dados[campo] !== null && dados[campo] !== "") {
      payload[campo] = dados[campo];
    }
  }
  if (!payload.nome) throw new Error("nome é obrigatório para cadastrar o aluno");
  return post("usuarios/novo", payload);
}

async function vincularCurso({ aluno, idcurso, idcombo, categoria } = {}) {
  if (!aluno) throw new Error("aluno é obrigatório");
  if (!idcurso && !idcombo && !categoria) {
    throw new Error("Informe idcurso, idcombo ou categoria; o Light não vincula todos os cursos automaticamente");
  }
  return post("usuarios/vinculocurso", { aluno, idcurso, idcombo, categoria });
}

async function configurarHorarios({ idaluno, aulas_quant, dias_semanas } = {}) {
  if (!idaluno) throw new Error("idaluno é obrigatório");
  if (!aulas_quant) throw new Error("aulas_quant é obrigatório");
  if (!dias_semanas || (Array.isArray(dias_semanas) && !dias_semanas.length)) {
    throw new Error("dias_semanas é obrigatório");
  }
  return post("usuarios/horarios", { idaluno, aulas_quant, dias_semanas });
}

async function vincularTurma({ idaluno, idturma } = {}) {
  if (!idaluno || !idturma) throw new Error("idaluno e idturma são obrigatórios");
  return post("usuarios/vinculoturma", { idaluno, idturma });
}

async function cursosDoAluno(id_aluno) {
  if (!id_aluno) throw new Error("id_aluno é obrigatório");
  return post("usuarios/cursosvinculados", { id_aluno });
}

async function enviarCredenciaisEmail(aluno) {
  if (!aluno) throw new Error("aluno é obrigatório");
  return post("usuarios/envioemail", { aluno });
}

async function contratosDoAluno(idaluno) {
  if (!idaluno) throw new Error("idaluno é obrigatório");
  return post("usuarios/contrato", { idaluno });
}

async function enviarMensagemAreaAluno({ idaluno, idfuncionario = "", mensagem } = {}) {
  if (!idaluno) throw new Error("idaluno é obrigatório");
  if (!mensagem || !String(mensagem).trim()) throw new Error("mensagem é obrigatória");
  return post("usuarios/enviarmensagem", { idaluno, idfuncionario, mensagem: String(mensagem).trim() });
}

module.exports = {
  configuracao,
  post,
  listarCursos,
  listarAulas,
  novoAluno,
  vincularCurso,
  configurarHorarios,
  vincularTurma,
  cursosDoAluno,
  enviarCredenciaisEmail,
  contratosDoAluno,
  enviarMensagemAreaAluno
};
