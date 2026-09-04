const SHEKINAH_INFO = require("./shekinah-info");
const { tratarComandoAdmin } = require("./autonomia");
const ALUNONET_URL = "https://waeweb.unifatecie.edu.br/servlet/hwalgn?1";
const ENDERECO_LOCAL = "Rua BH1 Nilo Pereira, bairro Centro, ao lado do ponto do vereador João Vasconcelos";
const HORARIOS_LOCAIS = "das 8:00 às 11:00 e das 14:00 às 20:00";

function normalizar(texto = "") { return String(texto).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }
function pareceComandoAdmin(texto=""){return /^(admin ajuda|comandos admin|ajuda admin|status bot|status do bot|trocar numero do robo|trocar numero robo|confirmar troca numero|cancelar troca numero|cancelar troca do numero|listar fatos|listar erros|definir fato|remover fato|promocao|remover promocao|atualizar curso)/.test(normalizar(texto));}
function adicionarIdentidade(set,valor,p=0){if(valor==null||p>4)return;if(typeof valor==="string"||typeof valor==="number"){const x=String(valor).trim();if(x)set.add(x);return;}if(Array.isArray(valor)){for(const i of valor)adicionarIdentidade(set,i,p+1);return;}if(typeof valor!=="object")return;for(const k of ["phoneNumber","pn","lid","id","_serialized","user","contact","contactId","wid"])if(Object.prototype.hasOwnProperty.call(valor,k))adicionarIdentidade(set,valor[k],p+1);}
async function tentarComandoAdminComMapeamento({client,msg,textoOriginal,responder}){if(!pareceComandoAdmin(textoOriginal))return false;const ids=new Set();adicionarIdentidade(ids,msg?.from);adicionarIdentidade(ids,msg?.sender?.id);adicionarIdentidade(ids,msg?.id?.remote);adicionarIdentidade(ids,msg?.author);adicionarIdentidade(ids,msg?.chatId);if(typeof client?.getPnLidEntry==="function")for(const base of [...ids]){const id=String(base||"").trim();if(!id||(!id.includes("@lid")&&!id.includes("@c.us")))continue;try{adicionarIdentidade(ids,await client.getPnLidEntry(id));}catch(e){console.warn("⚠️ Não foi possível resolver LID/telefone:",e?.message||e);}}for(const id of ids){const r=tratarComandoAdmin(textoOriginal,id);if(r){await responder(client,msg.from,r);return true;}}return false;}
function resetarSessao(sessao){Object.assign(sessao,{etapa:"escolher_instituicao",instituicao:null,atendimentoHumano:false,nome:"",curso:"",cursoAtual:null,dados:{},menorDeIdade:false,acaoPendente:null,assuntoAtual:null,historicoIA:[],atualizadoEm:Date.now()});}
function pedidoCancelamentoMatricula(texto="",sessao){const t=normalizar(texto);const matricula=/\b(matricula|faculdade|curso|unifatecie|fatecie)\b/.test(t);const cancelar=/\b(cancelar|cancelamento|cancele|trancar|trancamento|desistir|parar o curso|sair da faculdade)\b/.test(t);return cancelar&&(matricula||sessao?.instituicao==="unifatecie")&&!/nao quero cancelar/.test(t);}
function pediuCancelamentoFluxo(texto=""){const t=normalizar(texto);if(/nao quero cancelar/.test(t))return false;return /\b(cancelar|cancele|cancela isso|quero parar|desistir)\b/.test(t);}
function cursosShekinahNoTexto(texto=""){const t=normalizar(texto),r=[];for(const c of SHEKINAH_INFO.cursos){if(c.aliases.some(a=>t.includes(normalizar(a)))&&!r.some(x=>x.nome===c.nome))r.push(c);}return r;}
function perguntaDuracao(texto=""){return /\b(duracao|dura|duram|tempo|quanto tempo|quantos meses|meses)\b/.test(normalizar(texto));}
function perguntaRedesSociaisShekinah(texto="",sessao){const t=normalizar(texto);return /\b(instagram|facebook|rede social|redes sociais|perfil|pagina)\b/.test(t)&&(/\bshekinah\b/.test(t)||sessao?.instituicao==="shekinah");}
function perguntaModalidadeUnifatecie(texto="",sessao){const t=normalizar(texto);return /\b(aula|aulas|online|ead|presencial|portal|plataforma|estudar de casa)\b/.test(t)&&/\b(online|ead|presencial|portal|plataforma|casa)\b/.test(t)&&(/\b(unifatecie|fatecie|faculdade|pedagogia|administracao|ads|analise e desenvolvimento de sistemas|gestao financeira|gestao de recursos humanos|logistica|processos gerenciais|sistemas para internet|design de moda)\b/.test(t)||sessao?.instituicao==="unifatecie");}
function perguntaNecessidadeIrPolo(texto="",sessao){const t=normalizar(texto);return /(precisa|necessidade|necessario|necessaria|tenho que|tem que|vou ter que).*(ir|comparecer).*(polo)|\bir no polo\b|\bcomparecer no polo\b/.test(t)&&(/unifatecie|fatecie|faculdade/.test(t)||sessao?.instituicao==="unifatecie"||!sessao?.instituicao);}
function perguntaPagarMaisDeUmaMensalidade(texto=""){const t=normalizar(texto);return /(pagar|adiantar|antecipar).*(mais de uma|duas|2|varias|várias).*(mensalidade|mensalidades|parcela|parcelas)|(mais de uma|duas|2|varias|várias).*(mensalidade|mensalidades|parcela|parcelas).*(mesmo mes|mes|adiantar|antecipar)/.test(t);}
function continuacaoFinanceiraCurta(texto="",sessao){const t=normalizar(texto);if(sessao?.assuntoAtual!=="financeiro_multiplas_mensalidades")return false;return /^(da |é da |e da )?(unifatecie|fatecie|faculdade)(,| )?.{0,80}$/.test(t)||/^(pedagogia|administracao|ads|analise e desenvolvimento de sistemas|gestao financeira|gestao de recursos humanos|logistica|processos gerenciais|sistemas para internet|design de moda|biblioteconomia)$/.test(t)||/unifatecie.*pedagogia|pedagogia.*unifatecie/.test(t);}
function perguntaEndereco(texto=""){const t=normalizar(texto);return /\b(endereco|onde fica|localizacao|localizaçao|localizacao|como chegar|rua|onde e|onde é)\b/.test(t);}
function perguntaHorario(texto=""){const t=normalizar(texto);return /\b(horario|horarios|que horas|funciona que horas|atendimento|aberto|abre|fecha)\b/.test(t);}
function querMatriculaShekinah(texto="",sessao,cursos=[]){const t=normalizar(texto);return /\b(quero fazer|quero estudar|quero me matricular|quero matricular|fazer o curso|fazer os cursos|matricula|matricular)\b/.test(t)&&(/\bshekinah\b/.test(t)||sessao?.instituicao==="shekinah"||cursos.length>0);}
function iniciarMatriculaShekinahComCursos(sessao,cursos){sessao.instituicao="shekinah";sessao.atendimentoHumano=false;sessao.dados={curso:cursos.map(c=>c.nome).join(" + ")};sessao.curso=sessao.dados.curso;sessao.cursoAtual=null;sessao.acaoPendente=null;sessao.menorDeIdade=false;sessao.etapa="shekinah_matricula_nome";}
function resumoDuracoesShekinah(){return "⏳ *Duração dos cursos da Shekinah*\n\n💻 Informática Completa: *15 meses*\n🖥️ Informática Avançada: *15 meses*\n💼 Gestão Empresarial 6 em 1: duração a confirmar com a secretaria.\n📚 Inglês, Desenho e demais cursos: duração conforme a configuração de cada turma/curso; não vou inventar um prazo.";}

async function tentarCorrecoesAtendimento({client,msg,textoOriginal,sessao,responder}){
 if(!textoOriginal||!sessao)return false;
 if(await tentarComandoAdminComMapeamento({client,msg,textoOriginal,responder}))return true;
 const t=normalizar(textoOriginal), cursosShekinah=cursosShekinahNoTexto(textoOriginal);

 if(/^(encerrar|encerrar atendimento|finalizar atendimento|fim|sair do atendimento)$/.test(t)){
   resetarSessao(sessao);
   await responder(client,msg.from,"✅ Atendimento encerrado. Se precisar de algo depois, é só chamar. 😊");
   return true;
 }

 // Pergunta financeira simples deve ser respondida diretamente, sem perguntar curso.
 if(perguntaPagarMaisDeUmaMensalidade(textoOriginal)){
   sessao.instituicao="unifatecie";
   sessao.assuntoAtual="financeiro_multiplas_mensalidades";
   sessao.cursoAtual=null;
   await responder(client,msg.from,"💳 Pode sim. Na *UniFatecie*, você pode pagar mais de uma mensalidade no mesmo mês pelo próprio Portal do Aluno.\n\nAbra a área *Financeiro / Ficha Financeira* e faça o pagamento por lá. ✅");
   return true;
 }

 // Se a pessoa apenas disser o curso depois de uma dúvida financeira, NÃO tratar isso como consulta de oferta/matrícula.
 if(continuacaoFinanceiraCurta(textoOriginal,sessao)){
   sessao.instituicao="unifatecie";
   await responder(client,msg.from,"✅ Certo. Sendo da *UniFatecie*, essa orientação financeira continua a mesma, inclusive para aluno que já está matriculado em Pedagogia. O curso citado aqui é apenas o curso do aluno, não um pedido de nova matrícula.");
   return true;
 }

 if(perguntaNecessidadeIrPolo(textoOriginal,sessao)){
   sessao.instituicao="unifatecie";
   await responder(client,msg.from,"🏫 Para as aulas regulares do curso EAD, o estudo é pelo ambiente online.\n\nMas pode ser necessário ir ao polo quando a UniFatecie determinar alguma *avaliação ou atividade presencial*. Se houver convocação/agendamento, ela deve ser seguida. ✅");
   return true;
 }

 if(perguntaEndereco(textoOriginal)){
   await responder(client,msg.from,`📍 A *UniFatecie Polo Barreirinha* e o *Centro Educacional Shekinah* ficam no mesmo endereço:\n\n*${ENDERECO_LOCAL}.*`);
   return true;
 }

 if(perguntaHorario(textoOriginal)){
   await responder(client,msg.from,`🕐 O horário disponível é *${HORARIOS_LOCAIS}*.\n\nDentro desses períodos, a pessoa pode escolher o horário que preferir. 😊`);
   return true;
 }

 if(pedidoCancelamentoMatricula(textoOriginal,sessao)){
   sessao.instituicao="unifatecie";
   await responder(client,msg.from,`📝 Você mesmo pode solicitar o *cancelamento ou trancamento da matrícula* pelo *AlunoNet da UniFatecie*.\n\n1️⃣ Acesse o AlunoNet:\n${ALUNONET_URL}\n\n2️⃣ Entre com seus dados de aluno.\n3️⃣ Vá até a área de *Requerimentos / Entrada de requerimentos*.\n4️⃣ Escolha o requerimento específico de *Cancelamento de Matrícula* (ou *Trancamento*, se for o caso), preencha e envie.\n\n⚠️ O pedido é analisado pelo setor responsável e só é efetivado após o deferimento. Se houver alguma pendência ou o sistema não permitir concluir, aí sim posso encaminhar você ao secretário. 👨‍💼`);
   return true;
 }

 if(pediuCancelamentoFluxo(textoOriginal)){
   resetarSessao(sessao);
   if(querMatriculaShekinah(textoOriginal,sessao,cursosShekinah)&&cursosShekinah.length){iniciarMatriculaShekinahComCursos(sessao,cursosShekinah);await responder(client,msg.from,`✅ Atendimento anterior cancelado.\n\n📝 Vamos iniciar sua matrícula na *Shekinah* em *${sessao.dados.curso}*. 😊\n\n👤 Qual é o *nome completo do aluno*?`);return true;}
   await responder(client,msg.from,"✅ Atendimento anterior cancelado. 😊 Pode falar comigo normalmente.");return true;
 }
 if(perguntaModalidadeUnifatecie(textoOriginal,sessao)){sessao.instituicao="unifatecie";await responder(client,msg.from,"💻 As aulas dos cursos EAD ofertados pelo polo são online pelo portal da UniFatecie. Dependendo do curso/aluno, podem existir avaliações ou atividades presenciais determinadas pela instituição. ✅");return true;}
 if(perguntaRedesSociaisShekinah(textoOriginal,sessao)){sessao.instituicao="shekinah";await responder(client,msg.from,`📱 *Redes sociais oficiais da Shekinah*\n\n📸 Instagram:\n${SHEKINAH_INFO?.redesSociais?.instagram}\n\n📘 Facebook:\n${SHEKINAH_INFO?.redesSociais?.facebook}`);return true;}
 if(querMatriculaShekinah(textoOriginal,sessao,cursosShekinah)&&cursosShekinah.length){iniciarMatriculaShekinahComCursos(sessao,cursosShekinah);await responder(client,msg.from,`📝 Perfeito! Vamos iniciar sua matrícula na *Shekinah* no curso *${sessao.dados.curso}*. 😊\n\n👤 Qual é o *nome completo do aluno*?`);return true;}
 if(perguntaDuracao(textoOriginal)&&cursosShekinah.length){sessao.instituicao="shekinah";await responder(client,msg.from,cursosShekinah.map(c=>`⏳ *${c.nome}*: ${c.duracao}`).join("\n"));return true;}
 if(perguntaDuracao(textoOriginal)&&(/\bshekinah\b/.test(t)||sessao.instituicao==="shekinah")){sessao.instituicao="shekinah";await responder(client,msg.from,resumoDuracoesShekinah());return true;}
 return false;
}
module.exports={tentarCorrecoesAtendimento};
