from pathlib import Path

arquivo = Path("index.js")
texto = arquivo.read_text(encoding="utf-8")


def inserir_depois(conteudo, marcador, adicao):
    if adicao.strip() in conteudo:
        return conteudo
    if marcador not in conteudo:
        raise RuntimeError(f"Marcador não encontrado: {marcador[:80]!r}")
    return conteudo.replace(marcador, marcador + adicao, 1)


def inserir_antes(conteudo, marcador, adicao):
    if adicao.strip() in conteudo:
        return conteudo
    if marcador not in conteudo:
        raise RuntimeError(f"Marcador não encontrado: {marcador[:80]!r}")
    return conteudo.replace(marcador, adicao + marcador, 1)


texto = inserir_depois(
    texto,
    'const crypto = require("crypto");\n',
    'const { iaDisponivel, tentarResponderComIA } = require("./ia-groq");\n',
)

helper = '''\nasync function responderFallbackComIA(client, msg, textoOriginal, sessao) {\n  const respostaIA = await tentarResponderComIA({\n    textoOriginal,\n    sessao,\n    cursosUnifatecie: CURSOS_UNIFATECIE,\n    config: CONFIG,\n  });\n\n  if (!respostaIA) return false;\n\n  await responder(client, msg.from, `🤖 ${respostaIA}`);\n  return true;\n}\n\n'''
texto = inserir_antes(texto, "async function enviarTextoDireto(client, destino, mensagem) {\n", helper)

antigo_primeiro = '''    if (primeiraInteracao && !escolheuInstituicaoDiretamente) {\n      await responder(client, msg.from, menuInicial());\n      return;\n    }\n'''
novo_primeiro = '''    if (primeiraInteracao && !escolheuInstituicaoDiretamente) {\n      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n      await responder(client, msg.from, menuInicial());\n      return;\n    }\n'''
if antigo_primeiro in texto:
    texto = texto.replace(antigo_primeiro, novo_primeiro, 1)
elif novo_primeiro not in texto:
    raise RuntimeError("Bloco de primeira interação não encontrado.")

marcador_instituicao = '''      await responder(\n        client,\n        msg.from,\n        "Não consegui identificar a instituição. 😊\\n\\nDigite:\\n*1* para UniFatecie\\n*2* para Shekinah"\n      );\n'''
adicao_instituicao = '''      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n\n'''
texto = inserir_antes(texto, marcador_instituicao, adicao_instituicao)

marcador_curso = '''      await responder(\n        client,\n        msg.from,\n        "Não encontrei esse curso. Digite um número de *1 a 8*, *voltar* ou *m*."\n      );\n'''
adicao_curso = '''      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n\n'''
texto = inserir_antes(texto, marcador_curso, adicao_curso)

marcador_menu = '''      await responder(\n        client,\n        msg.from,\n        "Opção inválida. Digite um número de *1 a 4* ou *0* para trocar de instituição."\n      );\n'''
adicao_menu = '''      if (await responderFallbackComIA(client, msg, textoOriginal, sessao)) return;\n\n'''
texto = inserir_antes(texto, marcador_menu, adicao_menu)

marcador_inicio = '    console.log("🚀 Iniciando atendimento pelo WPPConnect...");\n'
adicao_inicio = '''    console.log(\n      iaDisponivel()\n        ? "🤖 IA Groq ativada para perguntas gerais."\n        : "ℹ️ IA Groq desativada: configure GROQ_API_KEY no Railway para ativar."\n    );\n'''
texto = inserir_depois(texto, marcador_inicio, adicao_inicio)

arquivo.write_text(texto, encoding="utf-8")
print("Integração da IA aplicada com sucesso em index.js")
