const base = require("./conversation-core");

function normalizar(texto = "") { return String(texto).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[!?.,;:]+/g, " ").replace(/\s+/g, " ").trim(); }
function encontrarCursoNoTexto(texto, cursos = {}) { const t=normalizar(texto); if (/\bads\b/.test(t)) return Object.values(cursos).find(c=>normalizar(c.nome).includes("analise e desenvolvimento de sistemas"))||null; return Object.values(cursos).find(c=>t.includes(normalizar(c.nome)))||null; }
function respostaObjetivaCurso(textoOriginal, curso) { if(!curso)return null; const t=normalizar(textoOriginal), campos=[]; if(/\b(valor|preco|mensalidade|quanto custa)\b/.test(t))campos.push(`💰 Mensalidade: *${curso.mensalidade}/mês*`); if(/\b(duracao|dura|tempo|quanto tempo)\b/.test(t))campos.push(`⏳ Duração: *${curso.duracao}*`); if(/\b(estagio)\b/.test(t))campos.push(`📚 Estágio: *${curso.estagio}*`); if(/\b(formacao|tipo de curso|bacharelado|licenciatura|tecnologo)\b/.test(t))campos.push(`🎓 Formação: *${curso.formacao}*`); return campos.length?`${curso.emoji||"🎓"} *${curso.nome}*\n${campos.join("\n")}`:null; }
function detalhesCurso(curso){return `${curso.emoji||"🎓"} *${curso.nome}*\n💰 Mensalidade: *${curso.mensalidade}/mês*\n⏳ Duração: *${curso.duracao}*\n🎓 Formação: *${curso.formacao}*\n📚 Estágio: *${curso.estagio}*`;}
function ajustarTratamento(mensagem=""){return String(mensagem).replace("👩‍💼 Claro! Você quer falar com a secretaria da *UniFatecie* ou da *Shekinah*? 😊","👥 Claro! Você quer falar com o secretário da *UniFatecie* ou com a secretária da *Shekinah*? 😊").replace("✅ Pronto! Seu atendimento foi encaminhado para a secretaria da UniFatecie. 👩‍💼","✅ Pronto! Seu atendimento foi encaminhado para o secretário da UniFatecie. 👨‍💼").replace(/para a secretaria da UniFatecie/g,"para o secretário da UniFatecie").replace(/com a secretaria da UniFatecie/g,"com o secretário da UniFatecie").replace(/\n\n😊 Se quiser, pode perguntar só [“\"]duração[”\"], [“\"]estágio[”\"] ou [“\"]matrícula[”\"]\.?/gi,"").trim();}
function emFluxoObrigatorio(sessao){const e=String(sessao?.etapa||"");return e.startsWith("unifatecie_matricula_")||e.startsWith("shekinah_matricula_")||e.startsWith("financeiro_")||e.startsWith("shekinah_secretaria_")||e==="atendimento_humano";}

async function tentarConversaNatural(args={}){
 const responder=args.responder, textoOriginal=String(args.textoOriginal||""), t=normalizar(textoOriginal), sessao=args.sessao;
 if(/^(qual (e )?seu nome|qual o seu nome|como voce se chama|quem e voce|quem voce e|seu nome|nome)$/.test(t)){await responder(args.client,args.msg.from,"🤖 Meu nome é *Light*. Sou o assistente virtual da *UniFatecie Polo Barreirinha* e do *Centro Educacional Shekinah*. 😊");return true;}
 if(/^(oi+|ola+|opa+|alo+|ei+|e ai|hey+|hello|salve|bom dia|boa tarde|boa noite)$/.test(t)){await responder(args.client,args.msg.from,"🤖 Oi! Eu sou o *Light* 😊 Como posso te ajudar?");return true;}
 let curso=encontrarCursoNoTexto(textoOriginal,args.cursosUnifatecie);
 if(/^(unifatecie|fatecie)$/.test(t)&&sessao?.acaoPendente==="cursos"){sessao.instituicao="unifatecie";sessao.acaoPendente=null;const lista=Object.values(args.cursosUnifatecie||{}).map(c=>`${c.emoji||"🎓"} *${c.nome}* — ${c.mensalidade}/mês`).join("\n");await responder(args.client,args.msg.from,`🎓 *Cursos mais procurados — UniFatecie Polo Barreirinha*\n\n${lista}`);return true;}
 if(/^shekinah$/.test(t)&&sessao?.acaoPendente==="cursos"){sessao.instituicao="shekinah";sessao.acaoPendente=null;await responder(args.client,args.msg.from,String(args.config?.shekinah?.cursos||"").replace(/\n\nPara iniciar[\s\S]*$/i,""));return true;}
 if(/\b(curso|cursos)\b/.test(t)&&/\b(valor|valores|preco|precos|mensalidade|mensalidades|quanto custa|lista|quais|mostrar|mostra)\b/.test(t)&&!/unifatecie|fatecie|shekinah/.test(t)&&!sessao?.instituicao){sessao.acaoPendente="cursos";await responder(args.client,args.msg.from,"🎓 Claro! Você quer ver os cursos da *UniFatecie* ou da *Shekinah*? 😊");return true;}
 if(curso){sessao.curso=curso.nome;sessao.cursoAtual=curso;sessao.instituicao="unifatecie";await responder(args.client,args.msg.from,respostaObjetivaCurso(textoOriginal,curso)||detalhesCurso(curso));return true;}
 if(!curso&&sessao?.cursoAtual&&/^(valor|preco|mensalidade|quanto|quanto custa|duracao|dura|tempo|quanto tempo|estagio|formacao|detalhes|mais detalhes)$/.test(t)){await responder(args.client,args.msg.from,respostaObjetivaCurso(textoOriginal,sessao.cursoAtual)||detalhesCurso(sessao.cursoAtual));return true;}

 // Fluxos transacionais continuam determinísticos. Fora deles, conversa livre vai primeiro para a IA.
 if(!emFluxoObrigatorio(sessao)&&typeof args.iaDisponivel==="function"&&args.iaDisponivel()&&typeof args.tentarResponderComIA==="function"){
   const respostaIA=await args.tentarResponderComIA({textoOriginal,sessao,cursosUnifatecie:args.cursosUnifatecie,config:args.config});
   if(respostaIA){await responder(args.client,args.msg.from,respostaIA);return true;}
 }
 return base.tentarConversaNatural({...args,responder:async(client,destino,mensagem)=>responder(client,destino,ajustarTratamento(mensagem))});
}
module.exports={tentarConversaNatural,ajustarTratamento};
