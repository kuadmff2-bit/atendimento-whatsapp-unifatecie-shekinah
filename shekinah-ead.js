const URL = "https://curso.eadaulas.com/shekinah/lista_cursos.php";
let cache = { em: 0, cursos: [] };
function limpar(s=""){return String(s).replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/&nbsp;/g," ").replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();}
function norm(s=""){return limpar(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function extrair(html){
 const cursos=[];
 const re=/<div class="modal fade" id="exampleModal(\d+)"[\s\S]*?<div class="modal-header"[\s\S]*?<i class="bi bi-mortarboard"><\/i><\/div>\s*<div[^>]*>([\s\S]*?)<\/div><hr>\s*<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="modal-body">[\s\S]*?<div class="cont">Conteúdo programático<\/div>([\s\S]*?)<div class="modal-footer">/gi;
 let m; while((m=re.exec(html))){
   const aulas=[]; const ar=/<div class="aula"><span class="aulap">(\d+)<\/span>([\s\S]*?)<\/div>/gi; let a;
   while((a=ar.exec(m[4]))) aulas.push({numero:Number(a[1]),titulo:limpar(a[2])});
   cursos.push({id:Number(m[1]),nome:limpar(m[2]),descricao:limpar(m[3]),quantidadeAulas:aulas.length,aulas});
 }
 return cursos;
}
async function listar(force=false){
 if(!force && cache.cursos.length && Date.now()-cache.em<6*60*60*1000)return cache.cursos;
 const r=await fetch(URL,{headers:{"user-agent":"Mozilla/5.0 Light-Shekinah/1.0"}}); if(!r.ok)throw new Error(`Catálogo EAD HTTP ${r.status}`);
 const cursos=extrair(await r.text()); if(!cursos.length)throw new Error("Catálogo EAD vazio"); cache={em:Date.now(),cursos}; return cursos;
}
async function buscar(texto){const q=norm(texto);const cs=await listar();return cs.filter(c=>q.includes(norm(c.nome))||norm(c.nome).includes(q)).slice(0,5);}
async function responder(texto){
 const t=norm(texto); if(!/(ead|curso|cursos|aula|aulas|conteudo|shekinah)/.test(t))return null;
 const cs=await listar();
 if(/(quais|lista|listar|catalogo|opcoes).*(curso|ead)|(curso|cursos).*ead/.test(t)){
   const nomes=cs.map(c=>c.nome); const blocos=[]; for(let i=0;i<nomes.length;i+=20)blocos.push(nomes.slice(i,i+20).map((n,j)=>`${i+j+1}. ${n}`).join("\n"));
   return `🎓 A *Shekinah* tem *${cs.length} cursos EAD* disponíveis na plataforma.\n\n${blocos[0]}\n\nSe quiser, diga o nome ou número do curso que eu mostro os detalhes. 📚`;
 }
 const achados=cs.filter(c=>t.includes(norm(c.nome))).slice(0,3);
 if(!achados.length)return null;
 const c=achados[0];
 if(/(conteudo|grade|materia|materias|aulas|ensina|aprende)/.test(t)){
   const lista=c.aulas.map(a=>`${String(a.numero).padStart(2,"0")}. ${a.titulo}`).join("\n");
   return `🎓 *${c.nome} — EAD Shekinah*\n\n${c.descricao}\n\n📚 *${c.quantidadeAulas} aulas*\n${lista}`;
 }
 return `🎓 *${c.nome} — EAD Shekinah*\n\n${c.descricao}\n\n📚 O curso possui *${c.quantidadeAulas} aulas*.\n\nSe quiser, posso mostrar o conteúdo programático completo. 😊`;
}
module.exports={listar,buscar,responder,URL};
