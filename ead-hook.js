const Module = require("module");
const originalLoad = Module._load;
const EAD = require("./shekinah-ead");
function norm(s=""){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
async function tentarEad(args){
 const {client,msg,textoOriginal,sessao,responder}=args||{}; if(!textoOriginal||!sessao||typeof responder!=="function")return false;
 const t=norm(textoOriginal);
 const contexto=sessao.instituicao==="shekinah"||sessao.assuntoAtual==="shekinah_ead"||sessao.modalidadeShekinah==="ead"||/shekinah|curso ead|cursos ead|ead|online/.test(t);
 if(!contexto)return false;
 try{
   const resposta=await EAD.responder(textoOriginal,sessao);
   if(!resposta)return false;
   sessao.instituicao="shekinah";
   sessao.assuntoAtual="shekinah_ead";
   sessao.modalidadeShekinah="ead";
   sessao.cursoAtual=null;
   await responder(client,msg.from,resposta); return true;
 }catch(e){console.warn("⚠️ Catálogo EAD Shekinah:",e?.message||e); return false;}
}
Module._load=function(request,parent,isMain){
 const exp=originalLoad.apply(this,arguments);
 if((request==="./atendimento-fixes"||request.endsWith("/atendimento-fixes"))&&exp&&typeof exp.tentarCorrecoesAtendimento==="function"&&!exp.__eadWrapped){
   const original=exp.tentarCorrecoesAtendimento;
   exp.tentarCorrecoesAtendimento=async function(args){if(await tentarEad(args))return true;return original(args);};
   Object.defineProperty(exp,"__eadWrapped",{value:true});
 }
 return exp;
};
