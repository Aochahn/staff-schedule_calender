const DAYS=["月","火","水","木","金","土","日"], START=17*60+30, SLOT=30, NS=13;
const COLORS=["#c9a46c","#7ba7d9","#9bc27d","#c77b9b","#8f83c9","#d18b63","#68aaa0","#c6b96b","#a77db7","#789d72"];
let people=[], result=null;
const STORAGE="miwaya_shift_people_v2";
const DATA_SCHEMA_VERSION=1;
const el=(id)=>document.getElementById(id);

function fmt(m){if(m===1440)return"24:00";return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function esc(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function newId(){return crypto.randomUUID?crypto.randomUUID():`person-${Date.now()}-${Math.random().toString(16).slice(2)}`}
function showError(x){let e=el("error");e.textContent=x;e.style.display=x?"block":"none"}
function showStatus(x){let e=el("data-status");e.textContent=x;e.style.display=x?"block":"none"}
function options(){
 let f=el("from"),t=el("to");
 for(let m=1050;m<=1440;m+=30){let o=document.createElement("option");o.value=m;o.textContent=fmt(m);f.appendChild(o)}
 for(let m=1080;m<=1440;m+=30){let o=document.createElement("option");o.value=m;o.textContent=fmt(m);t.appendChild(o)}
 f.value=1050;t.value=1440;
}
function save(){localStorage.setItem(STORAGE,JSON.stringify(people))}
function resetResultView(){
 result=null;
 el("schedule").innerHTML='<div class="empty">スタッフを登録してください。</div>';
 el("summary").innerHTML='<div class="empty">まだ編成されていません。</div>';
 el("legend").innerHTML="";
}
function loadSaved(){
 let x=localStorage.getItem(STORAGE);
 if(x){try{people=JSON.parse(x)}catch(e){people=[]}}
 if(!people.length)loadDemo(false); else renderPeople();
}
function normalizePerson(person,index){
 if(!person||typeof person!=="object")throw new Error("スタッフデータの形式が正しくありません。");
 const days=Array.isArray(person.days)?person.days.map(Number).filter(d=>Number.isInteger(d)&&d>=0&&d<=6):[];
 const from=Number(person.from),to=Number(person.to);
 if(!String(person.name||"").trim())throw new Error("名前が空のスタッフが含まれています。");
 if(!days.length)throw new Error(`${person.name} の曜日設定がありません。`);
 if(!Number.isFinite(from)||!Number.isFinite(to)||from<START||to>1440||to<=from)throw new Error(`${person.name} の時間設定が正しくありません。`);
 const normalized={id:String(person.id||newId()),name:String(person.name).trim(),days:[...new Set(days)],from,to,color:person.color||COLORS[index%COLORS.length],priority:Boolean(person.priority)};
 if(person.custom&&typeof person.custom==="object"){
   normalized.custom={};
   Object.keys(person.custom).forEach((day)=>{
     const value=person.custom[day];
     if(Array.isArray(value)&&value.length===2){
       const start=Number(value[0]),end=Number(value[1]);
       if(Number.isFinite(start)&&Number.isFinite(end)&&start>=START&&end<=1440&&end>start)normalized.custom[day]=[start,end];
     }
   });
 }
 return normalized;
}
function normalizeImportedData(data){
 const importedPeople=Array.isArray(data)?data:(Array.isArray(data.people)?data.people:null);
 if(!importedPeople)throw new Error("JSON内にスタッフ一覧が見つかりません。");
 return importedPeople.map(normalizePerson);
}
function validImportedResult(data,personCount){
 if(!data||typeof data!=="object")return false;
 if(!Array.isArray(data.work)||!Array.isArray(data.week)||!Array.isArray(data.daily)||!Array.isArray(data.violations))return false;
 if(data.work.length!==personCount||data.week.length!==personCount||data.daily.length!==personCount)return false;
 return data.work.every(person=>Array.isArray(person)&&person.length===7&&person.every(day=>Array.isArray(day)&&day.length===NS));
}
function exportJson(){
 showError("");showStatus("");
 if(!people.length)return showError("書き出すスタッフデータがありません。");
 const payload={
   app:"miwaya_shift_scheduler",
   schemaVersion:DATA_SCHEMA_VERSION,
   exportedAt:new Date().toISOString(),
   people,
   result
 };
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 const stamp=new Date().toISOString().slice(0,10).replaceAll("-","");
 link.href=url;
 link.download=`miwaya-shift-${stamp}.json`;
 document.body.appendChild(link);
 link.click();
 link.remove();
 URL.revokeObjectURL(url);
 showStatus("JSONを書き出しました。");
}
function importJsonFile(file){
 if(!file)return;
 showError("");showStatus("");
 const reader=new FileReader();
 reader.onload=()=>{
   try{
     const data=JSON.parse(reader.result);
     people=normalizeImportedData(data);
     result=validImportedResult(data.result,people.length)?data.result:null;
     save();
     renderPeople();
     if(result)render();else resetResultView();
     showError("");
     showStatus("JSONを読み込みました。");
   }catch(error){
     showError(`JSONを読み込めませんでした。${error.message}`);
   }finally{
     el("import-json-file").value="";
   }
 };
 reader.onerror=()=>{
   showError("JSONファイルの読み込みに失敗しました。");
   el("import-json-file").value="";
 };
 reader.readAsText(file);
}
function addPerson(){
 showError("");showStatus("");let name=el("name").value.trim(),ds=[...document.querySelectorAll("#days input:checked")].map(x=>+x.value);
 let from=+el("from").value,to=+el("to").value;
 if(!name)return showError("名前を入力してください。");if(!ds.length)return showError("曜日を1つ以上選択してください。");
 if(to-from<180)return showError("1勤務は最低2時間30分必要です。");
 people.push({id:newId(),name,days:ds,from,to,color:COLORS[people.length%COLORS.length],priority:false});
 save();renderPeople();el("name").value="";
}
function renderPeople(){
 let e=el("people");
 e.innerHTML=people.length?people.map(p=>`<div class="person"><span class="dot" style="background:${p.color}"></span><div class="pinfo"><div class="pname">${esc(p.name)} ${p.priority?"｜固定優先":""}</div><div class="psub">${p.days.map(d=>DAYS[d]).join("・")} / ${fmt(p.from)}–${fmt(p.to)}</div></div>${p.priority?"":`<button class="remove" type="button" data-remove-id="${p.id}" aria-label="${esc(p.name)}を削除">×</button>`}</div>`).join(""):'<div class="empty">スタッフ未登録</div>';
}
function removePerson(id){people=people.filter(p=>p.id!==id);save();renderPeople()}
function clearAll(){people=[];save();renderPeople();resetResultView()}
function loadDemo(saveIt=true){
 people=[
 {id:"t",name:"高田（店長）",days:[0,1,2,3,4,5,6],from:1140,to:1440,color:"#c9a46c",priority:true,custom:{0:[1140,1440],1:[1140,1440],2:[1380,1440],3:[1380,1440],4:[1380,1440],5:[1380,1440],6:[1140,1440]}},
 {id:"s",name:"柴谷（専務）",days:[2,3,4,5],from:1140,to:1380,color:"#7ba7d9",priority:true}
 ];
 if(saveIt)save();renderPeople();generate();
}
function avail(p,d,s){
 let a=START+s*SLOT,b=a+SLOT;
 if(p.custom&&p.custom[d]){let [x,y]=p.custom[d];return a>=x&&b<=y}
 return p.days.includes(d)&&a>=p.from&&b<=p.to;
}
function generate(){
 showError("");
 if(!people.length)return showError("スタッフを登録してください。");

 const work=people.map(()=>Array.from({length:7},()=>Array(NS).fill(false)));
 const week=people.map(()=>0), daily=people.map(()=>Array(7).fill(0));

 // 固定スタッフは完全固定。高田は1時間勤務も許容する。
 people.forEach((p,i)=>{
   if(!p.priority)return;
   for(let d=0;d<7;d++)for(let s=0;s<NS;s++){
     if(avail(p,d,s)){work[i][d][s]=true;week[i]+=.5;daily[i][d]+=.5}
   }
 });

 // 一般スタッフの1日勤務候補：
 // ・最低2時間30分
 // ・途中に空白を作らない連続ブロック
 // ・その日の勤務は1ブロックのみ
 function blocksFor(p,d){
   const arr=[];
   for(let a=0;a<NS;a++){
     for(let b=a+5;b<=NS;b++){
       let ok=true;
       for(let s=a;s<b;s++)if(!avail(p,d,s)){ok=false;break}
       if(ok)arr.push({a,b,h:(b-a)*.5});
     }
   }
   return arr;
 }

 // 「そのブロックを追加した後も、3人以上はその日合計1時間以内」
 function tripleAfterBlock(i,d,bl){
   let n=0;
   for(let s=0;s<NS;s++){
     let c=0;
     for(let j=0;j<people.length;j++)c+=work[j][d][s]?1:0;
     if(s>=bl.a&&s<bl.b)c++;
     if(c>=3)n++;
   }
   return n;
 }

 // 各曜日について、一般スタッフは1日1ブロックだけ選択。
 // 「2名不足の解消」を最優先し、3人化は最大2枠までしか候補にしない。
 for(let d=0;d<7;d++){
   const candidates=[];
   people.forEach((p,i)=>{
     if(p.priority)return;
     blocksFor(p,d).forEach(bl=>{
       if(week[i]+bl.h<=20)candidates.push({i,bl});
     });
   });

   while(true){
     let missing=0;
     for(let s=0;s<NS;s++){
       const c=people.reduce((n,p,i)=>n+(work[i][d][s]?1:0),0);
       if(c<2)missing++;
     }
     if(missing===0)break;

     let best=null,bestScore=-Infinity;
     for(const x of candidates){
       if(daily[x.i][d]>0)continue;
       if(week[x.i]+x.bl.h>20)continue;

       // このブロックを追加した時点で3人以上が1時間を超えるなら候補から完全除外。
       if(tripleAfterBlock(x.i,d,x.bl)>2)continue;

       let gain=0, overlap=0, businessGain=0;
       for(let s=x.bl.a;s<x.bl.b;s++){
         const c=people.reduce((n,p,i)=>n+(work[i][d][s]?1:0),0);
         if(c<2){
           gain++;
           const tm=START+s*SLOT;
           if(tm>=1080&&tm<1380)businessGain++;
         }else overlap++;
       }
       if(gain===0)continue;

       // 2名未満の枠を埋める量を絶対最優先。
       // 同点なら営業中を優先、3人化を避ける、週20hに余裕がある人を優先。
       let score=gain*100000 + businessGain*1000 - overlap*10000;
       score+=(20-week[x.i])*10;
       score-=daily[x.i].filter(v=>v>0).length*3;
       score-=week[x.i];

       if(score>bestScore){bestScore=score;best=x}
     }

     if(!best)break;

     for(let s=best.bl.a;s<best.bl.b;s++){
       work[best.i][d][s]=true;
       week[best.i]+=.5;
       daily[best.i][d]+=.5;
     }
     candidates.splice(candidates.indexOf(best),1);
   }
 }

 // 最終検証。条件を満たさない場合は「自動的に別の勤務を作る」のではなく、
 // 正確に不足・違反として表示する。
 const violations=[];
 for(let i=0;i<people.length;i++){
   for(let d=0;d<7;d++){
     const ids=work[i][d].map((v,s)=>v?s:null).filter(v=>v!==null);
     if(!ids.length)continue;

     // 高田は3時間縛りなし。それ以外は勤務日に最低2時間30分。
     if(!people[i].priority && ids.length<5)
       violations.push(`${people[i].name} ${DAYS[d]}：2時間30分未満`);

     // 全員、1日の勤務は1ブロック。
     if(ids[ids.length-1]-ids[0]+1!==ids.length)
       violations.push(`${people[i].name} ${DAYS[d]}：分割勤務`);
   }
 }

 // 3人以上は1日2枠（=1時間）まで。4人以上は禁止。
 for(let d=0;d<7;d++){
   let triple=0;
   for(let s=0;s<NS;s++){
     const c=people.reduce((n,p,i)=>n+(work[i][d][s]?1:0),0);
     if(c>=3)triple++;
     if(c>=4)violations.push(`${DAYS[d]} ${fmt(START+s*SLOT)}：4名以上`);
   }
   if(triple>2)violations.push(`${DAYS[d]}：3名以上が${(triple*.5).toFixed(1)}時間（上限1時間）`);
 }

 result={work,week,daily,violations};
 render();
}
function shiftRange(slots){
 const ids=slots.map((v,s)=>v?s:null).filter(v=>v!==null);
 if(!ids.length)return null;
 return `${fmt(START+ids[0]*SLOT)}–${fmt(START+(ids[ids.length-1]+1)*SLOT)}`;
}
function render(){
 let {work,week,daily,violations}=result,desktop="",mobile="";
 for(let d=0;d<7;d++){
  desktop+=`<div class="day"><div class="daytitle">${DAYS[d]}曜日</div><div class="timeline head"><div class="cell">STAFF</div>`;
  for(let s=0;s<NS;s++)desktop+=`<div class="cell">${fmt(START+s*SLOT)}</div>`;desktop+="</div>";
  mobile+=`<div class="mobile-day"><div class="mobile-day-title">${DAYS[d]}曜日</div><div class="mobile-staff">`;
  let dayShifts=0;
  people.forEach((p,i)=>{
   desktop+=`<div class="timeline"><div class="namecell"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</div>`;
   for(let s=0;s<NS;s++){
    let on=work[i][d][s],open=(START+s*SLOT>=1080&&START+s*SLOT<1380);
    desktop+=`<div class="slot ${open?"open-slot":""}">${on?`<div class="work ${s===0||!work[i][d][s-1]?"start":""} ${s===NS-1||!work[i][d][s+1]?"end":""}" style="background:${p.color}" title="${esc(p.name)} ${fmt(START+s*SLOT)}–${fmt(START+(s+1)*SLOT)}"></div>`:""}</div>`;
   }
   desktop+="</div>";
   const range=shiftRange(work[i][d]);
   if(range){dayShifts++;mobile+=`<div class="mobile-shift"><div class="mobile-shift-name"><span class="dot" style="background:${p.color}"></span><span>${esc(p.name)}</span></div><div class="mobile-shift-time">${range}</div></div>`;}
  });
  if(!dayShifts)mobile+=`<div class="mobile-none">勤務なし</div>`;
  mobile+=`</div><div class="mobile-cover-grid">`;
  desktop+=`<div class="timeline"><div class="namecell" style="color:#888">配置状況</div>`;
  for(let s=0;s<NS;s++){
   const c=people.reduce((n,p,i)=>n+(work[i][d][s]?1:0),0);
   const cl=c<2?"missing":c===2?"ok":"triple";
   const tx=c<2?"不足":c===2?"2名":c+"名";
   desktop+=`<div class="cover ${cl}">${tx}</div>`;
   mobile+=`<div class="mobile-cover ${cl}"><span class="mobile-cover-time">${fmt(START+s*SLOT)}</span><b>${tx}</b></div>`;
  }
  desktop+="</div></div>";
  mobile+="</div></div>";
 }
 el("schedule").innerHTML=`<div class="desktop-schedule">${desktop}</div><div class="mobile-schedule">${mobile}</div>`;
 el("legend").innerHTML=people.map(p=>`<div class="legend-item"><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</div>`).join("");

 let rows=people.map((p,i)=>{
   let h=week[i],days=daily[i].filter(x=>x>0).length;
   let status=h>20?"20時間超過":(violations.some(v=>v.startsWith(p.name))?"条件違反":"OK");
   return `<tr><td><span class="dot" style="background:${p.color};display:inline-block;margin-right:6px"></span>${esc(p.name)}</td><td><b>${h.toFixed(1)}h</b></td><td>${days}日</td><td><span class="badge ${status!=="OK"?"warn":""}">${status}</span></td></tr>`;
 }).join("");
 el("summary").innerHTML=`<table><thead><tr><th>スタッフ</th><th>週合計</th><th>勤務日数</th><th>状態</th></tr></thead><tbody>${rows}</tbody></table>`;

 let missing=[];
 for(let d=0;d<7;d++)for(let s=0;s<NS;s++){
   let c=people.reduce((n,p,i)=>n+(work[i][d][s]?1:0),0);
   if(c<2)missing.push(`${DAYS[d]} ${fmt(START+s*SLOT)}`);
 }
 let msgs=[];
 if(missing.length)msgs.push("2名未満："+missing.join("、"));
 if(violations.length)msgs.push("ルール違反："+violations.join(" / "));
 const over=people.filter((p,i)=>week[i]>20).map(p=>p.name);
 if(over.length)msgs.push("20時間超："+over.join("、"));
 showError(msgs.join("　"));
}
function bindEvents(){
 el("add-person").addEventListener("click",addPerson);
 el("generate").addEventListener("click",generate);
 el("load-demo").addEventListener("click",()=>loadDemo());
 el("clear-all").addEventListener("click",clearAll);
 el("export-json").addEventListener("click",exportJson);
 el("import-json").addEventListener("click",()=>el("import-json-file").click());
 el("import-json-file").addEventListener("change",(event)=>importJsonFile(event.target.files[0]));
 el("people").addEventListener("click",(event)=>{
   const button=event.target.closest("[data-remove-id]");
   if(button)removePerson(button.dataset.removeId);
 });
}
function init(){
 bindEvents();
 options();
 loadSaved();
}

init();
