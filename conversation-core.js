function normalizar(texto = "") {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descobrirCurso(texto, cursos) {
  const t = normalizar(texto);
  for (const curso of Object.values(cursos || {})) {
    const nome = normalizar(curso.nome);
    if (t.includes(nome)) return curso;
  }
  if (/\bads\b/.test(t)) {
    return Object.values(cursos || {}).find((curso) =>
      normalizar(curso.nome).includes("analise e desenvolvimento de sistemas")
    ) || null;
  }
  return null;
}

function descobrirInstituicao(texto) {
  const t = normalizar(texto);
  if (/unifatecie|fatecie|faculdade|pedagogia|analise e desenvolvimento|\bads\b|gestao de recursos humanos|gestao financeira|logistica|processos gerenciais|sistemas para internet|design de moda/.test(t)) return "unifatecie";
  if (/shekinah|ingles|informatica|desenho|teclado|reforco|gestao empresarial|\beja\b/.test(t)) return "shekinah";
  return null;
}

function emFluxoEstruturado(sessao) {
  const etapa = String(sessao?.etapa || "");
  return (
    etapa === "financeiro_nome" ||
    etapa === "financeiro_assunto" ||
    etapa === "shekinah_secretaria_nome" ||
    etapa === "shekinah_secretaria_telefone" ||
    etapa === "shekinah_secretaria_problema" ||
    etapa === "atendimento_humano" ||
    etapa.startsWith("unifatecie_matricula_") ||
    etapa.startsWith("shekinah_matricula_")
  );
}

function textoCursosUnifatecie(cursos) {
  return Object.values(cursos || {})
    .map((curso) => `${curso.emoji || "🎓"} *${curso.nome}* — ${curso.mensalidade}/mês`)
    .join("\n");
}

function detalhesCurso(curso) {
  return (
    `${curso.emoji || "🎓"} *${curso.nome}*\n` +
    `💰 Mensalidade: *${curso.mensalidade}/mês*\n` +
    `⏳ Duração: *${curso.duracao}*\n` +
    `🎓 Formação: *${curso.formacao}*\n` +
    `📚 Estágio: *${curso.estagio}*\n\n` +
    `😊 Se quiser, pode perguntar só “duração”, “estágio” ou “matrícula”.`
  );
}

async function tentarConversaNatural({
  client,
  msg,
  textoOriginal,
  texto,
  sessao,
  cursosUnifatecie,
  config,
  responder,
  tentarResponderComIA,
  iaDisponivel,
}) {
  if (!textoOriginal || !sessao) return false;

  const t = normalizar(texto || textoOriginal);
  if (!t || t === "ativar secretaria") return false;
  if (/^[0-9]$/.test(t)) return false;
  if (emFluxoEstruturado(sessao)) return false;

  if (/^(m|menu|menu principal|voltar ao menu|inicio)$/.test(t)) {
    sessao.etapa = "escolher_instituicao";
    sessao.instituicao = null;
    sessao.curso = "";
    sessao.cursoAtual = null;
    sessao.acaoPendente = null;
    await responder(
      client,
      msg.from,
      "👋😊 Pode falar comigo normalmente.\n\n🎓 Posso ajudar com cursos e matrícula\n💳 Financeiro e mensalidades\n👩‍💼 Secretaria\n\nÉ só me dizer o que você precisa."
    );
    return true;
  }

  const instituicaoDetectada = descobrirInstituicao(t);
  if (instituicaoDetectada) sessao.instituicao = instituicaoDetectada;

  let curso = descobrirCurso(t, cursosUnifatecie);
  if (curso) {
    sessao.curso = curso.nome;
    sessao.cursoAtual = curso;
    sessao.instituicao = "unifatecie";
  }

  const continuacaoCurso = /^(valor|preco|mensalidade|quanto|quanto custa|duracao|tempo|estagio|formacao|detalhes|mais detalhes|matricula)$/.test(t);
  if (!curso && sessao.cursoAtual && continuacaoCurso) {
    curso = sessao.cursoAtual;
    sessao.instituicao = "unifatecie";
  }

  const querMatricula = /matricul|inscri|quero entrar|quero fazer|quero estudar/.test(t);
  const querFinanceiro = /financeir|boleto|pagamento|paguei|divida|segunda via|vencimento|mensalidade em aberto/.test(t) && !curso;
  const querSecretaria = /secretaria|atendente|humano|falar com alguem|falar com uma pessoa/.test(t);
  const querCursos = /curso|cursos/.test(t) && /valor|preco|quais|lista|mostrar|mostra|tem|oferece|ofertam|opcoes|opções/.test(t);
  const querDetalheCurso = /valor|preco|mensalidade|custa|quanto|duracao|tempo|estagio|formacao|detalhe/.test(t);

  if (sessao.acaoPendente && sessao.instituicao) {
    const acao = sessao.acaoPendente;
    sessao.acaoPendente = null;

    if (acao === "matricula") {
      sessao.dados = {};
      sessao.menorDeIdade = false;
      if (sessao.instituicao === "unifatecie") {
        const atual = curso || sessao.cursoAtual;
        if (atual) {
          sessao.curso = atual.nome;
          sessao.dados.curso = atual.nome;
          sessao.etapa = "unifatecie_matricula_nome";
          await responder(client, msg.from, `📝 Perfeito! Vamos iniciar a pré-matrícula em *${atual.nome}*. 😊\n\n👤 Qual é o *nome completo do aluno*?`);
        } else {
          sessao.etapa = "unifatecie_matricula_curso";
          await responder(client, msg.from, "🎓 Perfeito! Qual curso da UniFatecie você deseja fazer? 😊");
        }
      } else {
        sessao.etapa = "shekinah_matricula_curso";
        await responder(client, msg.from, "🎓 Perfeito! Qual curso da Shekinah você deseja fazer? 😊");
      }
      return true;
    }

    if (acao === "financeiro") {
      sessao.etapa = "financeiro_nome";
      await responder(client, msg.from, "💳 Certo! Qual é o *nome completo do aluno*? 😊");
      return true;
    }

    if (acao === "secretaria") {
      if (sessao.instituicao === "shekinah") {
        sessao.dados = {};
        sessao.etapa = "shekinah_secretaria_nome";
        await responder(client, msg.from, "👩‍💼 Claro! Qual é o seu *nome completo*? 😊");
      } else {
        sessao.atendimentoHumano = true;
        sessao.etapa = "atendimento_humano";
        await responder(client, msg.from, "✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼");
      }
      return true;
    }
  }

  if (querMatricula) {
    if (!sessao.instituicao) {
      sessao.acaoPendente = "matricula";
      await responder(client, msg.from, "📝 Claro! A matrícula é para a *UniFatecie* ou para a *Shekinah*? 😊");
      return true;
    }

    sessao.dados = {};
    sessao.menorDeIdade = false;

    if (sessao.instituicao === "unifatecie") {
      const atual = curso || sessao.cursoAtual;
      if (atual) {
        sessao.curso = atual.nome;
        sessao.dados.curso = atual.nome;
        sessao.etapa = "unifatecie_matricula_nome";
        await responder(client, msg.from, `📝 Perfeito! Vamos iniciar a pré-matrícula em *${atual.nome}*. 😊\n\n👤 Qual é o *nome completo do aluno*?`);
      } else {
        sessao.etapa = "unifatecie_matricula_curso";
        await responder(client, msg.from, "🎓 Perfeito! Qual curso da UniFatecie você deseja fazer? 😊");
      }
    } else {
      sessao.etapa = "shekinah_matricula_curso";
      await responder(client, msg.from, "🎓 Perfeito! Qual curso da Shekinah você deseja fazer? 😊");
    }
    return true;
  }

  if (querFinanceiro) {
    if (!sessao.instituicao) {
      sessao.acaoPendente = "financeiro";
      await responder(client, msg.from, "💳 Claro! Isso é da *UniFatecie* ou da *Shekinah*? 😊");
      return true;
    }
    sessao.etapa = "financeiro_nome";
    await responder(client, msg.from, "💳 Certo! Qual é o *nome completo do aluno*? 😊");
    return true;
  }

  if (querSecretaria) {
    if (!sessao.instituicao) {
      sessao.acaoPendente = "secretaria";
      await responder(client, msg.from, "👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊");
      return true;
    }
    if (sessao.instituicao === "shekinah") {
      sessao.dados = {};
      sessao.etapa = "shekinah_secretaria_nome";
      await responder(client, msg.from, "👩‍💼 Claro! Qual é o seu *nome completo*? 😊");
    } else {
      sessao.atendimentoHumano = true;
      sessao.etapa = "atendimento_humano";
      await responder(client, msg.from, "✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼");
    }
    return true;
  }

  if (curso && (querDetalheCurso || /curso/.test(t))) {
    await responder(client, msg.from, detalhesCurso(curso));
    return true;
  }

  if (querCursos) {
    if (!sessao.instituicao) {
      await responder(client, msg.from, "🎓 Claro! Você quer ver os cursos da *UniFatecie* ou da *Shekinah*? 😊");
      return true;
    }

    if (sessao.instituicao === "unifatecie") {
      await responder(
        client,
        msg.from,
        `🎓 *Cursos mais procurados — UniFatecie Polo Barreirinha*\n\n${textoCursosUnifatecie(cursosUnifatecie)}\n\n😊 Me diga o nome de um curso e eu te passo os detalhes.`
      );
      return true;
    }

    const textoShekinah = String(config?.shekinah?.cursos || "").replace(/\n\nPara iniciar[\s\S]*$/i, "");
    await responder(client, msg.from, `${textoShekinah}\n\n😊 Me diga o curso que você quer conhecer melhor.`);
    return true;
  }

  if (continuacaoCurso && !sessao.cursoAtual) {
    await responder(client, msg.from, "🎓 Claro! De qual curso você quer saber? 😊");
    return true;
  }

  if (/^(oi+|ola+|opa+|alo+|ei+|e ai|hey+|hello|salve|bom dia|boa tarde|boa noite|robo|robo ai|tem alguem ai)$/.test(t)) {
    await responder(client, msg.from, "🤖 Oi! Estou por aqui 😊\n\nPode me perguntar sobre 🎓 cursos, 📝 matrícula, 💳 financeiro ou 👩‍💼 secretaria.");
    return true;
  }

  if (typeof iaDisponivel === "function" && iaDisponivel() && typeof tentarResponderComIA === "function") {
    const contextoCurso = sessao.cursoAtual?.nome ? `Contexto atual: estamos falando do curso ${sessao.cursoAtual.nome}. Pergunta do usuário: ${textoOriginal}` : textoOriginal;
    const respostaIA = await tentarResponderComIA({
      textoOriginal: contextoCurso,
      sessao,
      cursosUnifatecie,
      config,
    });
    if (respostaIA) {
      await responder(client, msg.from, respostaIA);
      return true;
    }
  }

  await responder(
    client,
    msg.from,
    "🤖 Pode falar comigo normalmente 😊\n\nSe quiser, diga algo como: “quero ver os cursos da UniFatecie”, “quanto custa Pedagogia?” ou “quero falar com a secretaria”."
  );
  return true;
}

module.exports = { tentarConversaNatural };
