const LOCS=[
  {k:'shed1',n:'Shed 1'},{k:'shed2',n:'Shed 2'},{k:'shed3',n:'Shed 3'},
  {k:'workshopR',n:'Workshop right'},{k:'workshopL',n:'Workshop left'},{k:'horseyard',n:'Horse yard'}
];
const CHECKS=[
  {k:'beddingOk',n:'Bedding OK'},
  {k:'beddingReq',n:'Bedding required',warn:true},
  {k:'drinkersChecked',n:'Drinkers checked'},
  {k:'drinkersCleaned',n:'Drinkers cleaned'},
  {k:'autoFeed',n:'Auto feed system active',only:['shed1','shed2','shed3']},
  {k:'feedHopper',n:'Feed hopper checked'}];
const checksFor=k=>CHECKS.filter(c=>!c.only||c.only.includes(k));
const LEGACY_CHECK={beddingOk:'bedding',drinkersChecked:'water',autoFeed:'feedSystem'};
const chk=(s,k)=>s[k]!==undefined?!!s[k]:!!s[LEGACY_CHECK[k]];
/* Items that make an area "fully checked": bedding (OK or required), drinkers checked, auto feed (sheds), feed hopper */
const doneItems=(k,s)=>[chk(s,'beddingOk')||chk(s,'beddingReq'),chk(s,'drinkersChecked'),...(checksFor(k).some(c=>c.k==='autoFeed')?[chk(s,'autoFeed')]:[]),chk(s,'feedHopper')];
const TICK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let serials=[]; let operatives=[]; let poisons=[]; let history=[]; let canWrite=true;
function blankLoc(){return {beddingOk:false,beddingReq:false,drinkersChecked:false,drinkersCleaned:false,autoFeed:false,feedHopper:false,feedAdded:'',dead:'0',medicated:'No',meds:[],notes:''}}
function blankTreat(){return {medCount:'0',medDose:'',withdrawal:'',medName:'',serial:'',useBy:'',markColour:'',markType:'',medReason:''}}
const treats=s=>s.medicated!=='Yes'?[]:(Array.isArray(s.meds)?s.meds:[s]);
const medLabel=m=>m.name&&m.serial?`${m.name} – ${m.serial}`:(m.name||m.serial||'');
/* Reference list researched Oct 2026 from UK/EU product information (NOAH Compendium, VMD, EU Union Product Database).
   Withdrawal = pig meat & offal, standard label dose. Always follow the actual label or vet's prescription. */
const MED_REF=[
 {k:['pen & strep','pen and strep','penstrep','pen strep'],name:'Pen & Strep',wd:'18',active:'Procaine benzylpenicillin + dihydrostreptomycin (injection)',
  use:'Antibiotic for bacterial infections sensitive to penicillin/streptomycin – e.g. erysipelas, joint and navel ill, pneumonia and other respiratory infections, septicaemia and secondary infections after viral disease.',src:'NOAH Compendium (UK), Norbrook'},
 {k:['betamox'],name:'Betamox LA',wd:'42',active:'Amoxicillin 150 mg/ml long-acting (injection)',
  use:'Long-acting broad-spectrum antibiotic for infections caused by amoxicillin-sensitive bacteria (e.g. Pasteurella, E. coli, Streptococcus, Erysipelothrix) – respiratory, gut, urinary and soft-tissue infections.',src:'EMA withdrawal-period review 2020 / Norbrook SPC'},
 {k:['alamycin'],name:'Alamycin LA 300',wd:'28',active:'Oxytetracycline 300 mg/ml long-acting (injection)',
  use:'Long-acting antibiotic for pneumonia, atrophic rhinitis, erysipelas, pasteurellosis, joint ill and navel ill. 28 days applies at the 30 mg/kg dose – check the label for your dose.',src:'Norbrook SPC / EU product database'},
 {k:['draxxin','increxxa','huvexxin','tulathromycin'],name:'Draxxin (tulathromycin)',wd:'13',active:'Tulathromycin 100 or 25 mg/ml (injection)',
  use:'Single-dose antibiotic for swine respiratory disease (pneumonia) – treatment, and prevention in groups where the disease has been diagnosed.',src:'NOAH Compendium (UK), VMD label'},
 {k:['metacam','meloxicam'],name:'Metacam 20 mg/ml',wd:'5',active:'Meloxicam 20 mg/ml (injection)',
  use:'Anti-inflammatory painkiller – reduces lameness, inflammation and fever; used alongside antibiotics for sows with post-farrowing illness (MMA).',src:'NOAH Compendium (UK), VMD label'},
 {k:['tylan','tylosin'],name:'Tylan 200',wd:'16',active:'Tylosin 200 mg/ml (injection)',
  use:'Antibiotic for respiratory and genito-urinary infections, ear infections, cellulitis and secondary bacterial infections after viral disease.',src:'NOAH Compendium (UK), VMD SPC'},
 {k:['baycox','toltrazuril'],name:'Baycox (toltrazuril)',wd:'77',active:'Toltrazuril 50 mg/ml (oral suspension)',
  use:'Prevents coccidiosis (scour caused by coccidia) in newborn piglets, given once at 3–5 days old.',src:'EU product database (UK – NI listing), HPRA SPC'},
 {k:['norocillin','procaine penicillin'],name:'Norocillin',wd:'7',active:'Procaine penicillin 300 mg/ml (injection)',
  use:'Penicillin antibiotic for systemic infections such as erysipelas and Streptococcus suis. 7 days for a 3–5 day course; 9 days for a 6–7 day course.',src:'VMD SPC (UK), Norbrook'},
 {k:['ivomec','ivermectin'],name:'Ivomec (ivermectin)',wd:'',active:'Ivermectin 10 mg/ml (injection)',
  use:'Wormer and anti-parasite treatment for roundworms, lungworms, lice and mange mites. Withdrawal varies between products (14–31 days found) – enter the days from your label.',src:'EU product database – varies by product'}
,
 {k:['lincoject','lincojet','linco-ject'],name:'Lincoject',wd:'3',active:'Lincomycin 100 mg/ml (injection) – Norbrook',
  use:'Lincomycin antibiotic injection for infections caused by lincomycin-sensitive Gram-positive bacteria, anaerobes and mycoplasma – e.g. joint infections and arthritis, erysipelas and mycoplasma infections.',src:'EU product database (Norbrook-made Lincoject) – UK label not confirmed'},
 {k:['lincocin','lincosin','lincomycin'],name:'Lincocin',wd:'2',active:'Lincomycin 100 mg/ml (injection) – Zoetis',
  use:'Lincomycin antibiotic injection for infections caused by lincomycin-sensitive Gram-positive bacteria, anaerobes and mycoplasma – e.g. joint infections and arthritis, erysipelas and mycoplasma infections. Label withdrawal is 48 hours (shown here as 2 days).',src:'HPRA SPC / EU product database (Zoetis) – UK label not confirmed'},
 {k:['vetromox','vetremox','vetrimoxin'],name:'Vetrimoxin L.A. (Vetromox)',wd:'16',active:'Amoxicillin 150 mg/ml long-acting (injection) – Ceva',
  use:'Long-acting amoxicillin antibiotic injection for bacterial infections such as respiratory disease caused by amoxicillin-sensitive bacteria (e.g. Pasteurella multocida). Oral powder versions have different withdrawal periods (7–10 days found) – check your product.',src:'EU product database (UK – Northern Ireland listing), VMD label'}
];
const DOSE={
 'Pen & Strep':{min:1/25,max:1/25,txt:'1 ml per 25 kg, into the muscle, once a day for up to 3 days.'},
 'Betamox LA':{min:0.1,max:0.1,txt:'1 ml per 10 kg (15 mg/kg), into the muscle.',check:true},
 'Alamycin LA 300':{min:1/15,max:0.1,txt:'1 ml per 15 kg (20 mg/kg) up to 1 ml per 10 kg (30 mg/kg), single injection into the muscle. The higher dose carries the longer withdrawal.'},
 'Draxxin (tulathromycin)':{min:1/40,max:1/40,txt:'100 mg/ml: 1 ml per 40 kg (2.5 mg/kg), single injection into the neck muscle. The 25 mg/ml piglet version is 1 ml per 10 kg.'},
 'Metacam 20 mg/ml':{min:0.02,max:0.02,txt:'2 ml per 100 kg (0.4 mg/kg), single injection into the muscle.',check:true},
 'Baycox (toltrazuril)':{min:0.4,max:0.4,txt:'0.4 ml per kg (20 mg/kg), by mouth, once, to piglets aged 3–5 days.'},
 'Ivomec (ivermectin)':{min:1/33,max:1/33,txt:'1 ml per 33 kg (300 micrograms/kg), under the skin.',check:true},
 'Lincocin':{min:1/22,max:1/9,txt:'1 ml per 22 kg (4.5 mg/kg) up to 1 ml per 9 kg (11 mg/kg), into the muscle, once a day.'},
 'Vetrimoxin L.A. (Vetromox)':{min:0.1,max:0.1,txt:'1 ml per 10 kg (15 mg/kg), into the muscle.'}
};
const SYMPTOMS=[
 {n:'Coughing, sneezing or laboured breathing',cause:'Respiratory infection (pneumonia), e.g. Pasteurella, Actinobacillus or Mycoplasma – often following a virus.',meds:['Draxxin (tulathromycin)','Pen & Strep','Betamox LA','Alamycin LA 300','Vetrimoxin L.A. (Vetromox)','Tylan 200','Metacam 20 mg/ml'],note:'Metacam only reduces fever and inflammation – it is used alongside an antibiotic when your vet advises.'},
 {n:'Lameness or swollen joints',cause:'Joint infection (joint ill, Mycoplasma or Streptococcus arthritis), erysipelas, or injury.',meds:['Lincocin','Lincoject','Pen & Strep','Alamycin LA 300','Metacam 20 mg/ml']},
 {n:'Raised diamond-shaped skin patches with fever',cause:'Erysipelas.',meds:['Pen & Strep','Norocillin','Alamycin LA 300','Betamox LA']},
 {n:'Shaking, paddling or unable to stand',cause:'Meningitis (often Streptococcus suis), water deprivation/salt poisoning, or other causes.',meds:['Norocillin','Pen & Strep'],urgent:'Call your vet straight away – quick treatment matters. Check the water supply.'},
 {n:'Scour in young suckling piglets (prevention)',cause:'Coccidiosis is a common cause of scour from about 1–3 weeks old; it is prevented by dosing piglets at 3–5 days old.',meds:['Baycox (toltrazuril)'],note:'Other scours (E. coli, viruses) need your vet to find the cause first.'},
 {n:'Scour (diarrhoea) in weaners or growers',cause:'Many possible causes – E. coli, Salmonella, Lawsonia, swine dysentery or viruses.',meds:[],urgent:'Ask your vet to find the cause before treating, and keep the pigs drinking.'},
 {n:'Itching, rubbing, mange or lice; worms seen',cause:'Sarcoptic mange, lice or internal worms.',meds:['Ivomec (ivermectin)']},
 {n:'Sow off feed, hot or hard udder after farrowing',cause:'Post-farrowing illness (MMA – mastitis, metritis, agalactia).',meds:['Metacam 20 mg/ml','Betamox LA','Pen & Strep'],note:'Your vet will normally advise an antibiotic together with Metacam.'},
 {n:'Abscess, infected wound, tail or ear bite',cause:'Bacterial infection of a wound (often Streptococcus, Staphylococcus or Trueperella).',meds:['Pen & Strep','Betamox LA','Alamycin LA 300'],note:'Also find and fix the cause of biting – stocking density, feed, water and enrichment.'}
];
const SIZES=[['Newborn piglet (3–5 days)',2],['Suckling piglet',5],['Weaner',15],['Grower',45],['Finisher',90],['Sow or boar',220]];
const fmtMl=v=>v<1?String(+v.toFixed(2)):String(+v.toFixed(1));
const findRef=name=>{const n=String(name||'').toLowerCase().trim(); if(n.length<3)return null; return MED_REF.find(r=>r.k.some(k=>n.includes(k)||k.includes(n)))||null};
const normMeds=list=>(Array.isArray(list)?list:[]).map(x=>typeof x==='string'?{name:'',serial:x,useBy:'',withdrawal:'',usedFor:'',refSrc:''}:{name:x.name||'',serial:x.serial||'',useBy:x.useBy||'',withdrawal:x.withdrawal??'',usedFor:x.usedFor||'',refSrc:x.refSrc||''});
function todayISO(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function useByState(d){if(!d)return null;const days=Math.round((new Date(d+'T00:00:00')-new Date(todayISO()+'T00:00:00'))/864e5);
  if(days<0)return {cls:'ub-bad',txt:`Expired on ${fmtDate(d)}`};if(days<=30)return {cls:'ub-warn',txt:`Use within ${days} day${days===1?'':'s'} (by ${fmtDate(d)})`};return {cls:'ub-ok',txt:`In date until ${fmtDate(d)}`}}
let form=freshForm();
function blankRodent(){const a={};LOCS.forEach(l=>a[l.k]={boxes:'0',evidence:false,restock:false});return {areas:a,evidence:false,poisonType:'',poisonName:'',notes:''}}
function freshForm(){
  const d=new Date(); const pad=n=>String(n).padStart(2,'0');
  const f={name:'',date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`,locs:{},rodent:blankRodent()};
  LOCS.forEach(l=>f.locs[l.k]=blankLoc()); return f;
}

/* ---------- Storage: everything goes through the NAS sync engine (nas.js) ---------- */
const local={get:(k,d)=>NAS.lsGet(k,d),set:(k,v)=>NAS.lsSet(k,v)};
const store={
  async addInspection(rec){return NAS.put('inspections',rec)},
  async deleteInspection(id){NAS.remove('inspections',id)},
  async savePoisons(list){NAS.setSetting('poisons',list)},
  async saveOperatives(list){NAS.setSetting('operatives',list)},
  async saveSerials(list){NAS.setSetting('medications',list)},
  async addMovement(m){NAS.put('movements',m)},
  async deleteMovement(id){NAS.remove('movements',id)}
};
const byNewest=(a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))||((b.createdAt||0)-(a.createdAt||0));
/* Reload everything from the local copy of the NAS data */
function loadFromNas(){
  history=NAS.inspections().sort(byNewest);
  movements=NAS.movements();
  operatives=NAS.setting('operatives',DEFAULT_OPERATIVES).filter(x=>typeof x==='string');
  poisons=NAS.setting('poisons',[]).filter(x=>typeof x==='string');
  serials=normMeds(NAS.setting('medications',[]));
}

/* ---------- Pig numbers ----------
   Running total per area, worked out in date order from:
   stock counts (set the number), pigs in, moved between areas, sold / out, and dead pigs from inspections. */
let movements=[];
const MV_TYPES={count:'Stock count',in:'Pigs in',transfer:'Moved',sold:'Sold',out:'Pigs out',dead:'Dead'};
const evKey=e=>`${e.date}T${e.time||'23:59'}|${String(e.createdAt||0).padStart(15,'0')}`;
function stockEvents(excludeInspId){
  const ev=[];
  movements.forEach(m=>ev.push({...m,src:'mv'}));
  history.forEach(h=>{if(h.id===excludeInspId)return; LOCS.forEach(l=>{const d=+((h.locs||{})[l.k]||{}).dead||0; if(d)ev.push({type:'dead',area:l.k,qty:d,date:h.date,time:h.time,createdAt:h.createdAt,by:h.name,src:'insp',inspId:h.id})})});
  return ev.sort((a,b)=>evKey(a)<evKey(b)?-1:1);
}
/* Pig numbers per area, optionally only counting events up to a date/time (inclusive) */
function stockAt(until,excludeInspId){
  const s={}; LOCS.forEach(l=>s[l.k]=0);
  for(const e of stockEvents(excludeInspId)){
    if(until&&evKey(e)>until)break;
    const q=+e.qty||0;
    if(e.type==='count')s[e.area]=q;
    else if(e.type==='in')s[e.area]+=q;
    else if(e.type==='transfer'){s[e.area]-=q; if(e.toArea in s)s[e.toArea]+=q}
    else s[e.area]-=q; // sold, out, dead
  }
  return s;
}
const stockNow=()=>stockAt(null);
const areaName=k=>(LOCS.find(l=>l.k===k)||{n:k}).n;

/* ---------- Inspection form ---------- */
function countOptions(sel,max){let o='';for(let i=0;i<=max;i++)o+=`<option value="${i}"${String(i)===sel?' selected':''}>${i}</option>`;return o}
function deadOptions(sel){let o='';for(let i=0;i<=50;i++)o+=`<option value="${i}"${String(i)===sel?' selected':''}>${i}</option>`;return o}
function serialOptions(sel){
  let o='<option value="">Select medication</option>';
  serials.forEach(m=>{const L=medLabel(m);o+=`<option value="${esc(L)}"${L===sel?' selected':''}>${esc(L)}</option>`});
  if(sel&&!serials.some(m=>medLabel(m)===sel))o+=`<option selected>${esc(sel)}</option>`;
  return o;
}
const DOSES=(()=>{const a=[];for(let v=0.5;v<=10;v+=0.5)a.push(v);for(let v=11;v<=20;v++)a.push(v);for(let v=25;v<=100;v+=5)a.push(v);return a.map(v=>String(+v.toFixed(1)))})();
function doseOptions(sel){let o='<option value="">Select ml</option>';DOSES.forEach(d=>o+=`<option value="${d}"${d===sel?' selected':''}>${d} ml</option>`);if(sel&&!DOSES.includes(sel))o+=`<option selected value="${esc(sel)}">${esc(sel)} ml</option>`;return o}
const totalMl=s=>s.medDose&&+s.medCount?+(+s.medDose*+s.medCount).toFixed(1):0;
const MARK_COLOURS=['Red','Blue','Green','Orange','Purple','Yellow','Black','Pink'];
const COLOUR_DOT={Red:'🔴',Blue:'🔵',Green:'🟢',Orange:'🟠',Purple:'🟣',Yellow:'🟡',Black:'⚫'};
const MARK_TYPES=['Spot','Line / stripe','Cross','Circle','Number','Shoulder mark','Back mark','Rump mark','Other'];
const MED_REASONS=['Lameness','Respiratory / coughing','Scour / diarrhoea','Skin condition','Injury / wound','Tail bite','Ear bite','Abscess','Fever','Joint ill','Parasites / worms','Prevention / routine','Other'];
function listOptions(list,sel,ph,fmt=x=>x){let o=`<option value="">${ph}</option>`;list.forEach(v=>o+=`<option value="${esc(v)}"${v===sel?' selected':''}>${esc(fmt(v))}</option>`);if(sel&&!list.includes(sel))o+=`<option selected value="${esc(sel)}">${esc(sel)}</option>`;return o}
const markText=s=>[s.markColour,s.markType?s.markType.toLowerCase():''].filter(Boolean).join(' ');
const WD_DAYS=(()=>{const a=[];for(let d=0;d<=60;d++)a.push(d);[63,70,77,84,90,100,120,150,180].forEach(d=>a.push(d));return a.map(String)})();
function wdOptions(sel){let o='<option value="">Select days</option>';WD_DAYS.forEach(d=>o+=`<option value="${d}"${d===sel?' selected':''}>${d==='0'?'0 days (no withdrawal)':d==='1'?'1 day':d+' days'}</option>`);if(sel&&!WD_DAYS.includes(sel))o+=`<option selected value="${esc(sel)}">${esc(sel)} days</option>`;return o}
function addDays(iso,n){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+(+n||0));const p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function daysFromToday(iso){return Math.round((new Date(iso+'T12:00:00')-new Date(todayISO()+'T12:00:00'))/864e5)}
const wdEnd=(date,days)=>days===''||days==null||!date?'':addDays(date,days);
function wdStatus(date,days){
  const end=wdEnd(date,days); if(!end)return null;
  if(+days===0)return {cls:'ub-ok',txt:'No withdrawal period – free from medication now',end};
  const left=daysFromToday(end);
  if(left>0)return {cls:'ub-bad',txt:`Free from medication on ${fmtDate(end)} – ${left} day${left===1?'':'s'} to go`,end,left};
  if(left===0)return {cls:'ub-ok',txt:`Free from medication today (${fmtDate(end)})`,end,left};
  return {cls:'ub-ok',txt:`Free from medication since ${fmtDate(end)}`,end,left};
}
function wdHtml(date,days){const st=wdStatus(date,days);return st?`<span class="ub ${st.cls}">${esc(st.txt)}</span>`:''}
function updateWdAll(){LOCS.forEach(l=>treats(form.locs[l.k]).forEach((t,i)=>{const el=$(`${l.k}-t${i}-wd`);if(el)el.innerHTML=wdHtml(form.date,t.withdrawal)}))}
function medInfoHtml(t){const m=serials.find(x=>x.name===t.medName&&x.serial===t.serial);if(!m||!m.usedFor)return '';return `<span class="hint">Used for: ${esc(m.usedFor)}</span>`}
function treatHtml(l,t,i,n){
  const id=f=>`${l.k}-t${i}-${f}`, a=f=>`id="${id(f)}" data-f="${f}" data-t="${i}"`;
  return `<div class="treat">
    <div class="treat-head"><span>Medication ${i+1}</span>${n>1?`<button type="button" class="link-x" data-rmt="${l.k}" data-ti="${i}">Remove</button>`:''}</div>
    <div class="row3">
      <div class="span-all"><label for="${id('med')}">Medication name / serial number</label>
        <select id="${id('med')}" data-f="med" data-t="${i}">${serialOptions(medLabel({name:t.medName,serial:t.serial}))}</select>
        <div class="med-info" id="${id('info')}">${medInfoHtml(t)}</div></div>
      <div><label for="${id('medCount')}">Number of pigs medicated</label><select ${a('medCount')}>${countOptions(t.medCount,200)}</select></div>
      <div><label for="${id('medDose')}">Dosage (ml per pig)</label><select ${a('medDose')}>${doseOptions(t.medDose)}</select></div>
      <div><label for="${id('withdrawal')}">Withdrawal period</label><select ${a('withdrawal')}>${wdOptions(t.withdrawal)}</select></div>
      <div class="span-all wd-out" id="${id('wd')}">${wdHtml(form.date,t.withdrawal)}</div>
      <div><label for="${id('medReason')}">Medication reason</label><select ${a('medReason')}>${listOptions(MED_REASONS,t.medReason,'Select reason')}</select></div>
      <div><label for="${id('markColour')}">Marking colour</label><select ${a('markColour')}>${listOptions(MARK_COLOURS,t.markColour,'Select colour',c=>(COLOUR_DOT[c]?COLOUR_DOT[c]+' ':'')+c)}</select></div>
      <div><label for="${id('markType')}">Mark type</label><select ${a('markType')}>${listOptions(MARK_TYPES,t.markType,'Select mark')}</select></div>
    </div></div>`;
}
function ubHtml(d){const st=useByState(d);return st?`<span class="ub ${st.cls}">${esc(st.txt)}</span>`:''}
function renderLocs(){
  $('locs').innerHTML=LOCS.map(l=>{
    const s=form.locs[l.k];
    return `<article class="loc" data-loc="${l.k}">
      <div class="loc-head"><span class="tag">${l.n}</span><span class="loc-right"><span class="loc-pigs" id="pg-${l.k}"></span><span class="loc-state" id="st-${l.k}"></span></span></div>
      <div class="loc-body">
        <div class="group-title">Checks</div>
        <div class="checks">${checksFor(l.k).map(c=>`<div class="check${c.warn?' warn':''}">
          <input type="checkbox" id="${l.k}-${c.k}" data-f="${c.k}"${s[c.k]?' checked':''}>
          <label for="${l.k}-${c.k}"><span class="box">${TICK}</span>${c.n}</label></div>`).join('')}</div>
        <div class="row" style="margin-top:12px">
          <div><label for="${l.k}-feedAdded">Feed added</label>
            <select id="${l.k}-feedAdded" data-f="feedAdded">
              <option value="">Select</option>
              <option${s.feedAdded==='Feed added'?' selected':''}>Feed added</option>
              <option${s.feedAdded==='No feed added'?' selected':''}>No feed added</option>
            </select></div>
          <div class="dead"><label for="${l.k}-dead">Number of dead pigs</label>
            <select id="${l.k}-dead" data-f="dead" class="${s.dead!=='0'?'has':''}">${deadOptions(s.dead)}</select></div>
        </div>
        <div class="med ${s.medicated==='Yes'?'on':''}" id="med-${l.k}">
          <div class="row3">
            <div><label for="${l.k}-medicated">Medicated</label>
              <select id="${l.k}-medicated" data-f="medicated">
                <option${s.medicated==='No'?' selected':''}>No</option>
                <option${s.medicated==='Yes'?' selected':''}>Yes</option>
              </select></div>
          </div>
          ${treats(s).map((t,i,arr)=>treatHtml(l,t,i,arr.length)).join('')}
          ${s.medicated==='Yes'?`<button type="button" class="btn btn-quiet btn-add" data-addt="${l.k}">+ Add another medication</button>`:''}
          ${s.medicated==='Yes'&&!serials.length?'<div class="hint" style="margin-top:8px">No medications yet. Add them in the Medications tab.</div>':''}
        </div>
        <div style="margin-top:12px"><label for="${l.k}-notes" class="group-title" style="display:block;margin:0 0 4px">Notes</label>
          <textarea id="${l.k}-notes" data-f="notes" placeholder="Optional">${esc(s.notes)}</textarea></div>
      </div></article>`}).join('');
  renderRodent();
  updateTotals();
}
const rodentTotal=r=>r&&r.areas?LOCS.reduce((a,l)=>a+(+((r.areas[l.k]||{}).boxes)||0),0):0;
function boxOptions(sel){let o='';for(let i=0;i<=30;i++)o+=`<option value="${i}"${String(i)===sel?' selected':''}>${i} ${i===1?'box':'boxes'}</option>`;return o}
function poisonOptions(sel){
  let o=poisons.length?'<option value="">Select poison</option>':'<option value="">Add poisons in the Meds tab</option>';
  poisons.forEach(n=>o+=`<option${n===sel?' selected':''}>${esc(n)}</option>`);
  if(sel&&!poisons.includes(sel))o+=`<option selected>${esc(sel)}</option>`;
  return o;
}
function renderPoisons(){
  $('poison-list').innerHTML=poisons.length?poisons.map((n,i)=>`<li><span>${esc(n)}</span>${canWrite?`<button class="link-x" data-rmp="${i}" aria-label="Remove ${esc(n)}">Remove</button>`:''}</li>`).join('')
    :'<li style="color:var(--ink-2);font-weight:400">No poisons yet. Add the first one above.</li>';
  const sel=$('rod-pname'); if(sel)sel.innerHTML=poisonOptions(form.rodent.poisonName);
}
async function addPoison(){
  const v=$('new-poison').value.trim().replace(/\s+/g,' '); const err=$('poison-err'); err.hidden=true;
  if(!v){err.textContent='Enter the poison name.';err.hidden=false;$('new-poison').focus();return}
  if(poisons.some(n=>n.toLowerCase()===v.toLowerCase())){err.textContent='That poison is already in the list.';err.hidden=false;return}
  try{await store.savePoisons([...poisons,v].sort((a,b)=>a.localeCompare(b)));$('new-poison').value='';$('new-poison').focus();toast('Poison added')}
  catch(e){err.textContent='Poison not added. Try again.';err.hidden=false}
}
$('add-poison').addEventListener('click',addPoison);
$('new-poison').addEventListener('keydown',e=>{if(e.key==='Enter')addPoison()});
$('poison-list').addEventListener('click',async e=>{
  const i=e.target.dataset.rmp; if(i===undefined)return;
  if(!confirm(`Remove ${poisons[+i]} from the list? Saved inspections keep it.`))return;
  try{await store.savePoisons(poisons.filter((_,j)=>j!==+i));toast('Poison removed')}catch(err){toast('Poison not removed. Try again.')}
});
function renderRodent(){
  const r=form.rodent;
  const cb=(id,checked,label,extra='')=>`<div class="check ${extra}"><input type="checkbox" id="${id}"${checked?' checked':''}><label for="${id}"><span class="box">${TICK}</span>${label}</label></div>`;
  $('rodent').innerHTML=`<article class="loc rodent">
    <div class="loc-head"><span class="tag tag-rodent">Rodent control</span><span class="loc-state" id="st-rodent">${rodentTotal(r)} bait boxes checked</span></div>
    <div class="loc-body">
      <div class="rod-table" role="group" aria-label="Bait boxes by area">
        <div class="rod-row rod-headrow"><span>Area</span><span>Bait boxes checked</span><span>Evidence</span><span>Restock</span></div>
        ${LOCS.map(l=>{const a=r.areas[l.k];return `<div class="rod-row">
          <span class="rod-area">${l.n}</span>
          <select id="rb-${l.k}" data-rb="${l.k}" aria-label="${l.n} bait boxes checked">${boxOptions(a.boxes)}</select>
          <div class="check alert"><input type="checkbox" id="re-${l.k}" data-re="${l.k}"${a.evidence?' checked':''}><label for="re-${l.k}"><span class="box">${TICK}</span><span>Evidence of rodents</span></label></div>
          <div class="check warn"><input type="checkbox" id="rr-${l.k}" data-rr="${l.k}"${a.restock?' checked':''}><label for="rr-${l.k}"><span class="box">${TICK}</span><span>Restock required</span></label></div>
        </div>`}).join('')}
      </div>
      <div class="group-title" style="margin-top:16px">Poison used</div>
      <div class="row">
        <div><label for="rod-ptype">Poison type</label>
          <select id="rod-ptype"><option value="">Select type</option>${['Block','Grain'].map(t=>`<option${r.poisonType===t?' selected':''}>${t}</option>`).join('')}</select></div>
        <div><label for="rod-pname">Poison name</label>
          <select id="rod-pname">${poisonOptions(r.poisonName)}</select></div>
      </div>
      <div style="margin-top:12px"><label for="rod-notes" class="group-title" style="display:block;margin:0 0 4px">Notes</label>
        <textarea id="rod-notes" placeholder="Optional – e.g. where evidence was found">${esc(r.notes)}</textarea></div>
    </div></article>`;
}
$('rodent').addEventListener('input',e=>{
  const r=form.rodent, t=e.target;
  if(t.dataset.rb)r.areas[t.dataset.rb].boxes=t.value;
  else if(t.dataset.rr)r.areas[t.dataset.rr].restock=t.checked;
  else if(t.dataset.re){r.areas[t.dataset.re].evidence=t.checked;r.evidence=LOCS.some(l=>r.areas[l.k].evidence);}
  else if(t.id==='rod-notes'){r.notes=t.value;return}
  else if(t.id==='rod-ptype'){r.poisonType=t.value;return}
  else if(t.id==='rod-pname'){r.poisonName=t.value;return}
  $('st-rodent').textContent=`${rodentTotal(r)} bait boxes checked`; updateTotals();
});
$('locs').addEventListener('click',e=>{
  const add=e.target.closest('[data-addt]'), rm=e.target.closest('[data-rmt]');
  if(add){const s=form.locs[add.dataset.addt]; s.meds.push(blankTreat()); renderLocs(); const i=s.meds.length-1; const el=$(`${add.dataset.addt}-t${i}-med`); if(el){el.focus(); el.scrollIntoView({block:'center'})} updateTotals(); return}
  if(rm){const s=form.locs[rm.dataset.rmt]; if(!confirm(`Remove medication ${+rm.dataset.ti+1} from this area?`))return; s.meds.splice(+rm.dataset.ti,1); renderLocs(); updateTotals();}
});
$('locs').addEventListener('input',e=>{
  const card=e.target.closest('[data-loc]'); const f=e.target.dataset.f; if(!card||!f)return;
  const s=form.locs[card.dataset.loc];
  if(e.target.dataset.t!==undefined){const t=s.meds[+e.target.dataset.t]; if(f==='med'){const m=serials.find(x=>medLabel(x)===e.target.value);t.medName=m?m.name:'';t.serial=m?m.serial:'';t.useBy=m?m.useBy:''; if(m&&m.withdrawal!==''&&m.withdrawal!=null){t.withdrawal=String(m.withdrawal);const k=card.dataset.loc,ti=e.target.dataset.t,ws=$(`${k}-t${ti}-withdrawal`);if(ws){ws.innerHTML=wdOptions(t.withdrawal)}const wo=$(`${k}-t${ti}-wd`);if(wo)wo.innerHTML=wdHtml(form.date,t.withdrawal)} const inf=$(`${card.dataset.loc}-t${e.target.dataset.t}-info`); if(inf)inf.innerHTML=medInfoHtml(t)} else t[f]=e.target.value; if(f==='withdrawal'){const el=$(`${card.dataset.loc}-t${e.target.dataset.t}-wd`);if(el)el.innerHTML=wdHtml(form.date,t.withdrawal)} updateTotals(); return}
  s[f]=e.target.type==='checkbox'?e.target.checked:e.target.value;
  if((f==='beddingOk'||f==='beddingReq')&&s[f]){const o=f==='beddingOk'?'beddingReq':'beddingOk';s[o]=false;const el=$(`${card.dataset.loc}-${o}`);if(el)el.checked=false}
  if(f==='medicated'){ if(!Array.isArray(s.meds))s.meds=[]; if(s.medicated==='Yes'&&!s.meds.length)s.meds=[blankTreat()]; if(s.medicated==='No')s.meds=[]; renderLocs(); return; }
  if(f==='dead')e.target.classList.toggle('has',s.dead!=='0');
  updateTotals();
});
function updateTotals(){
  let done=0,dead=0,med=0,pigsMed=0;
  const stock=stockNow();
  LOCS.forEach(l=>{
    const s=form.locs[l.k]; const di=doneItems(l.k,s); const all=di.every(Boolean); const n=di.filter(Boolean).length;
    if(all)done++; dead+=+s.dead; if(s.medicated==='Yes'){med++;treats(s).forEach(t=>pigsMed+=+t.medCount||0);}
    const el=$('st-'+l.k); if(el){el.textContent=all?'All checks done':`${n} of ${di.length} checks`;el.classList.toggle('done',all)}
    const pg=$('pg-'+l.k); if(pg){const p=stock[l.k],d=+s.dead||0; pg.innerHTML=d?`${p} → <b class="n">${p-d}</b> pigs`:`${p} pig${p===1?'':'s'}`}
  });
  $('t-done').textContent=`${done}/${LOCS.length}`; $('t-dead').textContent=dead; $('t-med').textContent=pigsMed;$('t-med-areas').textContent=med===1?'1 area':`${med} areas`;
  $('t-dead-pill').classList.toggle('loss',dead>0);
  if(form.rodent){$('t-rod').textContent=rodentTotal(form.rodent);$('t-rod-pill').classList.toggle('loss',form.rodent.evidence)}
}
function renderOpSelect(){
  const sel=$('f-name'); const cur=form.name;
  let o=operatives.length?'<option value="">Select operative</option>':'<option value="">Add operatives in the Operatives tab</option>';
  operatives.forEach(n=>o+=`<option${n===cur?' selected':''}>${esc(n)}</option>`);
  if(cur&&!operatives.includes(cur))o+=`<option selected>${esc(cur)}</option>`;
  sel.innerHTML=o; sel.value=cur||'';
}
function renderOperatives(){
  $('op-list').innerHTML=operatives.length?operatives.map((n,i)=>`<li><span>${esc(n)}</span>${canWrite?`<button class="link-x" data-rmop="${i}" aria-label="Remove ${esc(n)}">Remove</button>`:''}</li>`).join('')
    :'<li style="color:var(--ink-2);font-weight:400">No operatives yet. Add the first one above.</li>';
  renderOpSelect();
}
async function addOperative(){
  const v=$('new-op').value.trim().replace(/\s+/g,' '); const err=$('op-err'); err.hidden=true;
  if(!v){err.textContent="Enter the operative's name.";err.hidden=false;$('new-op').focus();return}
  if(operatives.some(n=>n.toLowerCase()===v.toLowerCase())){err.textContent='That operative is already in the list.';err.hidden=false;return}
  try{await store.saveOperatives([...operatives,v].sort((a,b)=>a.localeCompare(b)));$('new-op').value='';$('new-op').focus();toast('Operative added')}
  catch(e){err.textContent='Operative not added. Try again.';err.hidden=false}
}
$('add-op').addEventListener('click',addOperative);
$('new-op').addEventListener('keydown',e=>{if(e.key==='Enter')addOperative()});
$('op-list').addEventListener('click',async e=>{
  const i=e.target.dataset.rmop; if(i===undefined)return;
  if(!confirm(`Remove ${operatives[+i]} from the list? Saved inspections keep their name.`))return;
  try{await store.saveOperatives(operatives.filter((_,j)=>j!==+i));toast('Operative removed')}catch(err){toast('Operative not removed. Try again.')}
});
['name','date','time'].forEach(k=>$('f-'+k).addEventListener('input',e=>{form[k]=e.target.value; if(k==='name')local.set('name',form.name); if(k==='date')updateWdAll()}));
function fillDetails(){renderOpSelect();$('f-date').value=form.date;$('f-time').value=form.time;showGeo()}

/* ---------- Location (Google Maps) ---------- */
let geo=local.get('geo',null);
const mapsUrl=g=>`https://www.google.com/maps?q=${g.lat},${g.lng}`;
const fmtLL=g=>`${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;
function parseLocation(text){
  const t=decodeURIComponent(String(text||'')).trim(); if(!t)return null;
  const pats=[/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/];
  for(const re of pats){const m=t.match(re); if(m){const lat=+m[1],lng=+m[2]; if(Math.abs(lat)<=90&&Math.abs(lng)<=180)return {lat,lng,source:'pasted'}}}
  return null;
}
function showGeo(msg,isErr){
  const out=$('geo-out');
  if(msg){out.innerHTML=`<span style="color:${isErr?'var(--loss)':'inherit'}">${esc(msg)}</span>`;return}
  if(!geo){out.textContent='No location recorded yet.';return}
  out.innerHTML=`${esc(fmtLL(geo))}${geo.acc?` (accurate to about ${Math.round(geo.acc)} m)`:''} · <a href="${mapsUrl(geo)}" target="_blank" rel="noopener">Open in Google Maps</a>`;
}
function setGeo(g){geo=g;local.set('geo',geo);$('f-geo').value=g?fmtLL(g):'';showGeo()}
$('f-geo').addEventListener('change',e=>{
  const v=e.target.value.trim(); if(!v){setGeo(null);return}
  const g=parseLocation(v);
  if(g)setGeo(g); else showGeo('Location not recognised. In Google Maps, tap and hold your spot, copy the coordinates (e.g. 54.5742, -1.2350) and paste them here. Short "maps.app.goo.gl" links do not contain coordinates.',true);
});
let geoRetry=false;
const NB=()=>NAS.native();
async function locStatus(){const B=NB();if(!B)return null;try{return await B.locationStatus()}catch(e){return null}}
function askOpenSettings(kind){
  const B=NB(); if(!B)return false;
  const msg=kind==='service'?'Location is switched off on this phone.\n\nOpen phone settings to switch it on?'
    :'Pig Inspection is not allowed to use your location.\n\nOpen settings to allow it? (Tap Permissions → Location → Allow)';
  if(!confirm(msg))return false;
  geoRetry=true; showGeo('Switch location on, then come back to the app – it will try again automatically.');
  B.openSettings({kind}); return true;
}
function webGeoHelp(err){
  return err.code===1
    ?'Location is blocked. In Chrome, tap the icon to the left of the web address → Permissions → Location → Allow. If phone location is off, swipe down from the top of the screen and tap Location. Or paste the coordinates from Google Maps.'
    :'Location could not be found. Check phone location is on (swipe down from the top of the screen and tap Location), then try again – or paste the coordinates from Google Maps.';
}
async function onGeoError(err){
  const st=await locStatus();
  if(st){
    const off=!st.serviceOn, noPerm=!st.permission;
    if(off&&askOpenSettings('service'))return;
    if(noPerm&&askOpenSettings('permission'))return;
    showGeo(off||noPerm?'Location not available. Tap "Use my location" to try again, or paste the coordinates from Google Maps.':'Location could not be found. Move outside or near a window and try again, or paste the coordinates from Google Maps.',true);
    return;
  }
  showGeo(webGeoHelp(err),true);
}
$('geo-btn').addEventListener('click',async()=>{
  if(!navigator.geolocation){showGeo('This device cannot share its location here. Paste the coordinates from Google Maps instead.',true);return}
  const st=await locStatus();
  if(st&&!st.serviceOn){if(!askOpenSettings('service'))showGeo('Location is switched off. Switch it on, or paste the coordinates from Google Maps.',true);return}
  showGeo('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    p=>setGeo({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,source:'device'}),
    onGeoError,
    {enableHighAccuracy:true,timeout:15000,maximumAge:60000});
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&geoRetry){geoRetry=false;setTimeout(()=>$('geo-btn').click(),500)}});
if(geo)$('f-geo').value=fmtLL(geo);

async function doSave(send){
  if(!form.name.trim()){toast(operatives.length?'Choose who carried out the inspection':'Add operatives in the Operatives tab first');$('f-name').focus();return}
  for(const l of LOCS){const ts=treats(form.locs[l.k]); for(let i=0;i<ts.length;i++){const t=ts[i], lab=ts.length>1?`${l.n} (medication ${i+1})`:l.n, fid=f=>`${l.k}-t${i}-${f}`;
    if(!t.serial&&!t.medName){toast(`Choose the medication used in ${lab}`);$(fid('med')).focus();return}
    if(+t.medCount===0){toast(`Enter how many pigs were medicated in ${lab}`);$(fid('medCount')).focus();return}
    if(!t.medDose){toast(`Choose the dosage in ml for ${lab}`);$(fid('medDose')).focus();return}
    if(t.withdrawal===''||t.withdrawal==null){toast(`Choose the withdrawal period for ${lab}`);$(fid('withdrawal')).focus();return}
  }}
  const expired=LOCS.filter(l=>treats(form.locs[l.k]).some(t=>t.useBy&&t.useBy<todayISO()));
  if(expired.length&&!confirm(`A medication used in ${expired.map(l=>l.n).join(', ')} is past its use by date. Save the inspection anyway?`))return;
  const totalDead=LOCS.reduce((a,l)=>a+ +form.locs[l.k].dead,0);
  const totalMedicated=LOCS.reduce((a,l)=>a+treats(form.locs[l.k]).reduce((b,t)=>b+(+t.medCount||0),0),0);
  const createdAt=Date.now();
  const before=stockAt(`${form.date}T${form.time||'23:59'}|${String(createdAt).padStart(15,'0')}`); // pig numbers before this inspection's deaths
  const short=LOCS.filter(l=>+form.locs[l.k].dead>before[l.k]);
  if(short.length&&!confirm(`More dead pigs are recorded than the app thinks are in ${short.map(l=>l.n).join(', ')}. Save anyway? (Update the numbers in the Pigs tab afterwards.)`))return;
  const rec={name:form.name.trim(),date:form.date,time:form.time,geo:geo?{lat:geo.lat,lng:geo.lng,acc:geo.acc||null}:null,createdAt,totalDead,totalMedicated,stock:before,locs:JSON.parse(JSON.stringify(form.locs)),rodent:JSON.parse(JSON.stringify(form.rodent))};
  if(send)sendWhatsApp(rec);
  $('save').disabled=true;
  try{
    const saved=await store.addInspection(rec);
    toast(NAS.configured()?'Inspection saved – sending to the NAS':'Inspection saved on this phone. Set up the NAS in More.');
    const n=form.name; form=freshForm(); form.name=n; fillDetails(); renderLocs(); window.scrollTo({top:0});
    try{await queueReportPdf(saved)}catch(e){console.error('PDF failed',e)}
  }
  catch(e){toast('Inspection not saved. Try again.')}
  finally{$('save').disabled=!canWrite}
}
$('save').addEventListener('click',()=>doSave(false));
$('save-wa').addEventListener('click',()=>doSave(true));

/* ---------- WhatsApp report ---------- */
const WA_NUMBER='447872898990'; // 07872 898990
function reportText(h){
  const t=v=>v?'✅':'❌'; const L=[];
  L.push(`*Pig inspection – ${fmtDate(h.date)} at ${h.time}*`);
  L.push(`Inspected by: ${h.name}`);
  if(h.geo)L.push(`Location: ${mapsUrl(h.geo)}`);
  L.push(`Dead pigs: ${h.totalDead||0} | Pigs medicated: ${h.totalMedicated||0}`);
  LOCS.forEach(l=>{const s=(h.locs||{})[l.k]; if(!s)return;
    L.push('',`*${l.n}*`);
    L.push(checksFor(l.k).map(c=>c.warn?`${c.n}: ${chk(s,c.k)?'Yes ⚠️':'No'}`:`${c.n} ${t(chk(s,c.k))}`).join('  '));
    L.push(`Feed: ${s.feedAdded||'not recorded'}`);
    L.push(`Dead pigs: ${s.dead||0}${+s.dead>0?' ⚠️':''}`);
    const ts=treats(s); if(ts.length){ts.forEach((t,i)=>{const m=medLabel({name:t.medName,serial:t.serial});L.push(`Medicated${ts.length>1?` (${i+1})`:''}: ${t.medCount||0} pigs${t.medDose?` × ${t.medDose} ml (${totalMl(t)} ml total)`:''} – ${m||'medication not recorded'}${t.useBy?` (use by ${fmtDate(t.useBy)})`:''}`);if(t.medReason)L.push(`Reason: ${t.medReason}`);if(markText(t))L.push(`Marked: ${markText(t)}`);if(t.withdrawal!==undefined&&t.withdrawal!==''){const e=wdEnd(h.date,t.withdrawal);L.push(+t.withdrawal===0?'Withdrawal: none':`Withdrawal: ${t.withdrawal} days – free from medication on ${fmtDate(e)}`)}})}
    else L.push('Medicated: No');
    if(s.notes)L.push(`Notes: ${s.notes}`);
  });
  const r=h.rodent;
  if(r&&r.areas){
    L.push('','*Rodent control*');
    LOCS.forEach(l=>{const a=r.areas[l.k]||{boxes:'0',restock:false};L.push(`${l.n}: ${a.boxes} bait boxes${a.evidence?' – evidence of rodents ⚠️':''}${a.restock?' – restock required ⚠️':''}`)});
    L.push(`Total bait boxes checked: ${rodentTotal(r)}`);
    if(r.poisonType||r.poisonName)L.push(`Poison used: ${[r.poisonType,r.poisonName].filter(Boolean).join(' – ')}`);
    L.push(`Evidence of rodents: ${r.evidence?'Yes ⚠️':'No'}`);
    if(r.notes)L.push(`Notes: ${r.notes}`);
  } else if(r){
    L.push('','*Rodent control*',`Bait boxes checked: ${(r.boxes||[]).filter(Boolean).length}/10`,`Evidence of rodents: ${r.evidence?'Yes ⚠️':'No'}`,`Bait required for restock: ${r.restock?'Yes':'No'}`);
    if(r.notes)L.push(`Notes: ${r.notes}`);
  }
  return L.join('\n');
}
function sendWhatsApp(h){
  const a=document.createElement('a'); a.href=`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(reportText(h))}`;
  a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
}
$('clear').addEventListener('click',()=>{if(confirm('Clear this inspection form?')){const n=form.name;form=freshForm();form.name=n;fillDetails();renderLocs()}});

/* ---------- History ---------- */
const yn=v=>v?'<span class="y">Yes</span>':'<span class="n">No</span>';
function fmtDate(d){if(!d)return '';const [y,m,dd]=d.split('-');return `${dd}/${m}/${y}`}
function rodentHtml(r){
  if(!r)return '<div class="rod-sum"><b>Rodent control:</b> not recorded</div>';
  if(!r.areas){const t=(r.boxes||[]).filter(Boolean).length;return `<div class="rod-sum"><b>Rodent control</b><div>Bait boxes checked: <b>${t}/10</b></div><div>Evidence of rodents: ${r.evidence?'<span class="n">Yes</span>':'<span class="y">No</span>'} · Bait required for restock: ${r.restock?'<span class="n">Yes</span>':'<span class="y">No</span>'}</div>${r.notes?`<div>Notes: ${esc(r.notes)}</div>`:''}</div>`}
  return `<div class="rod-sum"><b>Rodent control</b> – ${rodentTotal(r)} bait boxes checked · Evidence of rodents: ${r.evidence?`<span class="n">Yes${LOCS.some(l=>(r.areas[l.k]||{}).evidence)?' ('+LOCS.filter(l=>(r.areas[l.k]||{}).evidence).map(l=>l.n).join(', ')+')':''}</span>`:'<span class="y">No</span>'}
    <table style="min-width:0;margin-top:6px"><thead><tr><th>Area</th><th>Bait boxes checked</th><th>Evidence of rodents</th><th>Restock required</th></tr></thead><tbody>
    ${LOCS.map(l=>{const a=r.areas[l.k]||{boxes:'0',restock:false};return `<tr><td>${l.n}</td><td>${esc(a.boxes)}</td><td>${a.evidence?'<span class="n">Yes</span>':'No'}</td><td>${a.restock?'<span class="n">Yes</span>':'No'}</td></tr>`}).join('')}
    </tbody></table>${r.poisonType||r.poisonName?`<div style="margin-top:6px">Poison used: <b>${esc([r.poisonType,r.poisonName].filter(Boolean).join(' – '))}</b></div>`:''}${r.notes?`<div style="margin-top:6px">Notes: ${esc(r.notes)}</div>`:''}</div>`;
}
function renderWithdrawals(){
  const rows=[];
  history.forEach(h=>LOCS.forEach(l=>{const s=(h.locs||{})[l.k]; if(!s)return; treats(s).forEach(t=>{
    if(t.withdrawal===undefined||t.withdrawal===''||+t.withdrawal===0)return; const e=wdEnd(h.date,t.withdrawal); const left=daysFromToday(e);
    if(left>0)rows.push({area:l.n,med:medLabel({name:t.medName,serial:t.serial})||'Medication',pigs:t.medCount||'0',mark:markText(t),end:e,left,date:h.date})})}));
  rows.sort((a,b)=>a.end<b.end?-1:a.end>b.end?1:0);
  $('wd-panel').innerHTML=rows.length?`<div class="panel wd-panel"><h2 style="margin:0 0 4px;font:700 22px/1.2 'Barlow Condensed',sans-serif">Pigs still in withdrawal</h2>
    <div class="hint" style="margin-bottom:8px">Worked out from the inspection date plus the withdrawal period.</div>
    <div style="overflow-x:auto"><table style="min-width:520px"><thead><tr><th>Area</th><th>Pigs</th><th>Free from medication</th><th>Marked</th><th>Medication</th><th>Medicated on</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${esc(r.area)}</b></td><td>${esc(r.pigs)}</td><td><b class="n">${fmtDate(r.end)}</b><br><span class="entry-meta">${r.left} day${r.left===1?'':'s'} to go</span></td><td>${esc(r.mark||'–')}</td><td>${esc(r.med)}</td><td>${fmtDate(r.date)}</td></tr>`).join('')}
    </tbody></table></div></div>`:'';
}
function renderHistory(){
  renderWithdrawals();
  $('hist-count').textContent=history.length?`${history.length} inspection${history.length>1?'s':''} saved`:'No inspections saved yet';
  $('export').hidden=!history.length;
  if(!history.length){$('hist').innerHTML='<div class="empty">Saved inspections appear here. Fill in the New inspection tab and save it.</div>';return}
  $('hist').innerHTML=history.map(h=>`<details class="entry">
    <summary><div><div class="entry-title">${fmtDate(h.date)} at ${esc(h.time)}</div><div class="entry-meta">Inspected by ${esc(h.name)}${h.geo?` · <a class="maplink" href="${mapsUrl(h.geo)}" target="_blank" rel="noopener">${esc(fmtLL(h.geo))}</a>`:''}</div></div>
    <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${h.rodent&&h.rodent.evidence?`<span class="dead-badge loss">Rodents seen</span>`:''}${h.totalMedicated?`<span class="dead-badge med-badge">${h.totalMedicated} medicated</span>`:''}<span class="dead-badge ${h.totalDead>0?'loss':''}">${h.totalDead} dead</span></span></summary>
    <div class="entry-body"><table><thead><tr><th>Area</th><th>Pigs</th>${CHECKS.map(c=>`<th>${c.n}</th>`).join('')}<th>Feed</th><th>Dead</th><th>Medicated</th><th>No. medicated</th><th>Dosage</th><th>Medication / serial no.</th><th>Notes</th></tr></thead><tbody>
    ${LOCS.map(l=>{const s=(h.locs||{})[l.k]||blankLoc();return `<tr><td><b>${l.n}</b></td><td>${h.stock&&h.stock[l.k]!=null?(+s.dead?`${h.stock[l.k]} → ${h.stock[l.k]-(+s.dead)}`:h.stock[l.k]):'–'}</td>${CHECKS.map(c=>`<td>${c.only&&!c.only.includes(l.k)?'–':(c.k==='beddingReq'&&chk(s,c.k)?'<span class="n">Yes</span>':c.k==='beddingReq'?'No':yn(chk(s,c.k)))}</td>`).join('')}
      <td>${esc(s.feedAdded||'–')}</td><td${+s.dead>0?' class="n"':''}>${esc(s.dead)}</td><td>${esc(s.medicated)}</td><td>${(()=>{const ts=treats(s);return ts.length?ts.reduce((a,t)=>a+(+t.medCount||0),0):'–'})()}</td><td>${treats(s).map(t=>t.medDose?`${esc(t.medDose)} ml/pig<br><span class="entry-meta">${totalMl(t)} ml total</span>`:'–').join('<hr class="tsep">')||'–'}</td><td>${treats(s).map(t=>`${esc(medLabel({name:t.medName,serial:t.serial})||'–')}${t.useBy?`<br><span class="${t.useBy<h.date?'n':''}">Use by ${fmtDate(t.useBy)}</span>`:''}${t.medReason?`<br>Reason: ${esc(t.medReason)}`:''}${markText(t)?`<br>Marked: ${esc(markText(t))}`:''}${t.withdrawal!==undefined&&t.withdrawal!==''?(()=>{const e=wdEnd(h.date,t.withdrawal);const live=+t.withdrawal>0&&daysFromToday(e)>0;return `<br><span class="${live?'n':'y'}">Withdrawal: ${+t.withdrawal===0?'none':`${esc(t.withdrawal)} days – free ${fmtDate(e)}`}</span>`})():''}`).join('<hr class="tsep">')||'–'}</td><td>${esc(s.notes||'')}</td></tr>`}).join('')}
    </tbody></table>
    ${rodentHtml(h.rodent)}
    <div class="entry-actions"><button class="btn btn-wa" data-wa="${esc(h.id)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:none"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg><span>Send via WhatsApp</span></button>
    <button class="btn btn-quiet" data-pdf="${esc(h.id)}">Send PDF to NAS again</button>
    ${canWrite?`<button class="btn btn-danger" data-del="${esc(h.id)}">Delete inspection</button>`:''}</div></div></details>`).join('');
}
$('hist').addEventListener('click',async e=>{
  const wa=e.target.closest('[data-wa]'); if(wa){const h=history.find(x=>x.id===wa.dataset.wa); if(h)sendWhatsApp(h); return}
  const pdf=e.target.closest('[data-pdf]'); if(pdf){const h=history.find(x=>x.id===pdf.dataset.pdf); if(h){try{await queueReportPdf(h);toast('PDF queued for the NAS')}catch(err){toast('PDF could not be made')}} return}
  const id=e.target.dataset.del; if(!id)return;
  if(!confirm('Delete this inspection? This cannot be undone.'))return;
  try{await store.deleteInspection(id);toast('Inspection deleted')}catch(err){toast('Inspection not deleted. Try again.')}
});
let downloadsApi=null;
function rodentCsv(r,k){if(!r)return ['','','','','',''];if(!r.areas){const t=(r.boxes||[]).filter(Boolean).length;return [`${t}/10 (whole site)`,r.restock?'Yes':'No',r.evidence?'Yes':'No','','',r.notes||'']}const a=r.areas[k]||{boxes:'',restock:false};return [a.boxes,a.restock?'Yes':'No',a.evidence===undefined?(r.evidence?'Yes':'No'):(a.evidence?'Yes':'No'),r.poisonType||'',r.poisonName||'',r.notes||'']}
function csvCell(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function buildCsv(){
  const head=['Date','Time','Inspected by','Latitude','Longitude','Google Maps link','Area','Pigs in area (before deaths)',...CHECKS.map(c=>c.n),'Feed added','Dead pigs','Medicated','Pigs medicated','Dosage (ml per pig)','Total ml','Medication name','Serial number','Use by date','Withdrawal (days)','Free from medication','Medication reason','Marking colour','Mark type','Notes','Bait boxes checked','Bait restock required','Evidence of rodents','Poison type','Poison name','Rodent notes'];
  const rows=[head];
  history.forEach(h=>LOCS.forEach(l=>{const s=(h.locs||{})[l.k]||blankLoc();
    const ts=treats(s), J=f=>ts.map(f).join(' | ');
    rows.push([fmtDate(h.date),h.time,h.name,h.geo?h.geo.lat:'',h.geo?h.geo.lng:'',h.geo?mapsUrl(h.geo):'',l.n,h.stock&&h.stock[l.k]!=null?h.stock[l.k]:'',...CHECKS.map(c=>c.only&&!c.only.includes(l.k)?'':(chk(s,c.k)?'Yes':'No')),s.feedAdded,s.dead,s.medicated,J(t=>t.medCount||'0'),J(t=>t.medDose||''),J(t=>t.medDose?totalMl(t):''),J(t=>t.medName||''),J(t=>t.serial||''),J(t=>t.useBy?fmtDate(t.useBy):''),J(t=>t.withdrawal??''),J(t=>t.withdrawal!==undefined&&t.withdrawal!==''?fmtDate(wdEnd(h.date,t.withdrawal)):''),J(t=>t.medReason||''),J(t=>t.markColour||''),J(t=>t.markType||''),s.notes,...rodentCsv(h.rodent,l.k)])}));
  return '﻿'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
function exportCsv(){
  if(!history.length){toast('No inspections to export yet');return}
  const csv=buildCsv(), name=`pig-inspections-${todayISO()}.csv`;
  if(!NAS.isNative()){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
  if(NAS.configured()){NAS.putFile('Exports/'+name,{body:csv,contentType:'text/csv; charset=utf-8'});toast('Export queued – it will be in PigReports/Exports')}
  else if(NAS.isNative())toast('Set up the NAS connection first')
}
$('export').addEventListener('click',exportCsv);
$('export-nas').addEventListener('click',exportCsv);

/* ---------- Medication serials ---------- */
function renderSerials(){
  $('serial-list').innerHTML=serials.length?serials.map((m,i)=>`<li><span>${esc(m.name||'Unnamed medication')}<span class="med-sub">Serial / batch: ${esc(m.serial||'–')}</span>${m.useBy?`<span class="med-sub">Use by: ${fmtDate(m.useBy)} ${m.useBy<todayISO()?'<b style="color:var(--loss)">– expired</b>':''}</span>`:'<span class="med-sub">Use by: not set</span>'}<span class="med-sub">Withdrawal: ${m.withdrawal!==''&&m.withdrawal!=null?`<b>${esc(m.withdrawal)} days</b>`:'<b style="color:var(--loss)">not set</b>'}</span>${m.usedFor?`<span class="med-sub med-use">${esc(m.usedFor)}</span>`:''}${m.refSrc?`<span class="med-sub" style="font-size:12px">Source: ${esc(m.refSrc)}</span>`:''}</span><span class="med-actions">${canWrite?`<button class="link-x link-edit" data-ed="${i}" aria-label="Edit details for ${esc(medLabel(m))}">Edit details</button><button class="link-x" data-rm="${i}" aria-label="Remove ${esc(medLabel(m))}">Remove</button>`:''}</span></li>`).join('')
    :'<li style="color:var(--ink-2);font-weight:400">No medications yet. Add the first one above.</li>';
}
async function addSerial(){
  const name=$('new-medname').value.trim(), v=$('new-serial').value.trim(), ub=$('new-useby').value, wd=$('new-wd').value.trim(), uf=$('new-usedfor').value.trim(); const err=$('serial-err'); err.hidden=true;
  if(wd!==''&&(!/^\d+$/.test(wd)||+wd>365)){err.textContent='Enter the withdrawal period as a whole number of days (0–365).';err.hidden=false;$('new-wd').focus();return}
  if(!name||!v||!ub){err.textContent='Enter the medication name, serial / batch number and use by date.';err.hidden=false;(!name?$('new-medname'):!v?$('new-serial'):$('new-useby')).focus();return}
  if(serials.some(m=>m.name.toLowerCase()===name.toLowerCase()&&m.serial.toLowerCase()===v.toLowerCase())){err.textContent='That medication and serial number are already in the list.';err.hidden=false;return}
  try{const ref=findRef(name); await store.saveSerials([...serials,{name,serial:v,useBy:ub,withdrawal:wd,usedFor:uf,refSrc:ref&&ref.wd===wd?ref.src:(wd||uf?'Entered by user':'')}]);$('new-medname').value='';$('new-serial').value='';$('new-useby').value='';$('new-wd').value='';$('new-usedfor').value='';$('ref-box').hidden=true;$('new-medname').focus();toast('Medication added')}
  catch(e){err.textContent='Medication not added. Try again.';err.hidden=false}
}
$('add-serial').addEventListener('click',addSerial);
/* ---------- Symptoms & dosage ---------- */
$('sym-pick').innerHTML='<option value="">Choose a symptom</option>'+SYMPTOMS.map((x,i)=>`<option value="${i}">${esc(x.n)}</option>`).join('');
$('sym-size').innerHTML=SIZES.map(([n,kg],i)=>`<option value="${kg}"${i===3?' selected':''}>${esc(n)} (about ${kg} kg)</option>`).join('');
$('sym-kg').innerHTML=Array.from({length:300},(_,i)=>i+1).map(k=>`<option value="${k}"${k===45?' selected':''}>${k} kg</option>`).join('');
$('sym-size').addEventListener('change',()=>{$('sym-kg').value=$('sym-size').value;renderSym()});
$('sym-kg').addEventListener('change',renderSym); $('sym-pick').addEventListener('change',renderSym);
function inStock(refName){return serials.filter(m=>{const r=findRef(m.name);return r&&r.name===refName})}
function renderSym(){
  const i=$('sym-pick').value, kg=+$('sym-kg').value, out=$('sym-out');
  if(i===''){out.innerHTML='';return}
  const sy=SYMPTOMS[+i];
  let h=`<div class="sym-cause"><b>Likely causes:</b> ${esc(sy.cause)}</div>`;
  if(sy.urgent)h+=`<div class="sym-urgent">${esc(sy.urgent)}</div>`;
  if(sy.note)h+=`<div class="hint" style="margin:6px 0">${esc(sy.note)}</div>`;
  if(!sy.meds.length)h+='<div class="hint" style="margin-top:8px">No single medicine is suggested for this – your vet needs to identify the cause.</div>';
  h+=sy.meds.map(nm=>{
    const r=MED_REF.find(x=>x.name===nm); if(!r)return ''; const d=DOSE[nm]; const st=inStock(nm);
    let dose;
    if(d){const a=kg*d.min,b=kg*d.max; dose=`<div class="dose-big">${a===b?fmtMl(a):fmtMl(a)+'–'+fmtMl(b)} ml<span> for a ${kg} kg pig</span></div><div class="hint">Label dose: ${esc(d.txt)}${d.check?' Check the label for your product.':''}</div>`}
    else dose=`<div class="hint">Dose not in the reference list – use the dose on your label or from your vet.</div>`;
    return `<div class="sym-med"><div class="sym-med-head"><b>${esc(r.name)}</b>${st.length?'<span class="stock yes">In your stock</span>':'<span class="stock">Not in your stock</span>'}</div>
      <div class="hint">${esc(r.active)}</div>${dose}
      <div class="hint">Withdrawal (meat): ${r.wd!==''?`<b>${esc(r.wd)} days</b>`:'see label'}${st.length?` · Your batch: ${st.map(m=>esc(m.serial)+(m.useBy&&m.useBy<todayISO()?' (expired)':'')).join(', ')}`:''}</div></div>`}).join('');
  out.innerHTML=h;
}
document.querySelector('.subtabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-sub]'); if(!b)return;
  document.querySelectorAll('.subtabs button').forEach(x=>x.setAttribute('aria-selected',x===b));
  $('sub-stock').hidden=b.dataset.sub!=='stock'; $('sub-sym').hidden=b.dataset.sub!=='sym'; if(b.dataset.sub==='sym')renderSym();
});
$('med-ref-list').innerHTML=MED_REF.map(r=>`<option value="${esc(r.name)}">`).join('');
function showRef(){
  const ref=findRef($('new-medname').value), box=$('ref-box');
  if(!ref){box.hidden=true;return}
  if($('new-wd').value===''&&ref.wd!=='')$('new-wd').value=ref.wd;
  if(!$('new-usedfor').value.trim())$('new-usedfor').value=ref.use;
  box.hidden=false;
  box.innerHTML=`<b>Found: ${esc(ref.name)}</b> – ${esc(ref.active)}<br>Withdrawal (pig meat &amp; offal): <b>${ref.wd!==''?esc(ref.wd)+' days':'varies – enter from your label'}</b><br><span class="hint">Source: ${esc(ref.src)}. Check this matches your product label before relying on it.</span>`;
}
$('new-medname').addEventListener('change',showRef);
$('new-medname').addEventListener('input',()=>{if(findRef($('new-medname').value)&&$('new-medname').value.length>=4)showRef()});
['new-serial','new-medname'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter')addSerial()}));
$('serial-list').addEventListener('click',async e=>{
  const ei=e.target.dataset.ed;
  if(ei!==undefined){
    const m={...serials[+ei]}; const ref=findRef(m.name);
    const wd=prompt(`Withdrawal period in days for ${medLabel(m)}${ref&&ref.wd!==''?` (reference list: ${ref.wd} days – check your label)`:''}`,m.withdrawal!==''&&m.withdrawal!=null?m.withdrawal:(ref?ref.wd:''));
    if(wd===null)return;
    if(wd.trim()!==''&&(!/^\d+$/.test(wd.trim())||+wd>365)){toast('Withdrawal must be a whole number of days (0–365)');return}
    const uf=prompt(`What is ${m.name||'this medication'} used for?`,m.usedFor||(ref?ref.use:''));
    if(uf===null)return;
    m.withdrawal=wd.trim(); m.usedFor=uf.trim(); m.refSrc=ref&&ref.wd===m.withdrawal?ref.src:'Entered by user';
    try{await store.saveSerials(serials.map((x,j)=>j===+ei?m:x));toast('Medication details saved')}catch(err){toast('Details not saved. Try again.')}
    return;
  }
  const i=e.target.dataset.rm; if(i===undefined)return;
  if(!confirm(`Remove ${medLabel(serials[+i])} from the list? Saved inspections keep it.`))return;
  try{await store.saveSerials(serials.filter((_,j)=>j!==+i));toast('Medication removed')}catch(err){toast('Medication not removed. Try again.')}
});

/* ---------- Tabs & toast ---------- */
document.querySelector('.tabs').addEventListener('click',e=>{
  const b=e.target.closest('button[data-view]'); if(!b)return;
  document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x===b));
  ['inspect','pigs','history','stats','meds','ops'].forEach(v=>$('view-'+v).hidden=v!==b.dataset.view);
  $('savebar').hidden=b.dataset.view!=='inspect';
  if(b.dataset.view==='stats'&&window.renderStats)renderStats();
  if(b.dataset.view==='pigs')renderPigs();
  window.scrollTo({top:0});
});
let tt;function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2600)}


/* ---------- Pig numbers tab ---------- */
function renderPigs(){
  const s=stockNow(); const total=LOCS.reduce((a,l)=>a+s[l.k],0);
  $('pig-total').textContent=total;
  const wk=addDays(todayISO(),-6);
  const dead7={}; LOCS.forEach(l=>dead7[l.k]=0);
  history.forEach(h=>{if(h.date>=wk)LOCS.forEach(l=>dead7[l.k]+=+((h.locs||{})[l.k]||{}).dead||0)});
  $('pig-areas').innerHTML=LOCS.map(l=>`<div class="pig-area"><span class="tag">${l.n}</span><span class="pig-n${s[l.k]<0?' n':''}">${s[l.k]}</span><span class="hint">${dead7[l.k]?`<b class="n">${dead7[l.k]} dead</b> in 7 days`:'No deaths in 7 days'}</span></div>`).join('')
    +(LOCS.some(l=>s[l.k]<0)?'<div class="err">An area shows below zero – do a stock count to set the right number.</div>':'');
  const ev=stockEvents().reverse().slice(0,150);
  $('mv-list').innerHTML=ev.length?ev.map(e=>{
    const what=e.type==='count'?`Stock count: <b>${e.qty}</b> pigs in ${esc(areaName(e.area))}`
      :e.type==='transfer'?`Moved <b>${e.qty}</b> pigs from ${esc(areaName(e.area))} to ${esc(areaName(e.toArea))}`
      :e.type==='in'?`<b>+${e.qty}</b> pigs in to ${esc(areaName(e.area))}`
      :e.type==='dead'?`<b class="n">−${e.qty}</b> dead in ${esc(areaName(e.area))} <span class="med-sub">From inspection</span>`
      :`<b>−${e.qty}</b> ${e.type==='sold'?'sold from':'out of'} ${esc(areaName(e.area))}`;
    return `<li><span>${what}<span class="med-sub">${fmtDate(e.date)}${e.by?' · '+esc(e.by):''}${e.note?' · '+esc(e.note):''}</span></span>${e.src==='mv'?`<button class="link-x" data-rmmv="${esc(e.id)}">Remove</button>`:''}</li>`}).join('')
    :'<li style="color:var(--ink-2);font-weight:400">Nothing recorded yet. Start with a stock count for each area.</li>';
}
function fillMvForm(){
  const opts=LOCS.map(l=>`<option value="${l.k}">${l.n}</option>`).join('');
  $('mv-area').innerHTML=opts; $('mv-to').innerHTML=opts; $('mv-to').value=LOCS[1].k;
  $('mv-date').value=todayISO(); mvTypeChanged();
}
function mvTypeChanged(){
  const t=$('mv-type').value;
  $('mv-to-wrap').hidden=t!=='transfer';
  $('mv-area-label').textContent=t==='transfer'?'Moved from':'Area';
  $('mv-qty-label').textContent=t==='count'?'Pigs counted in this area':'Number of pigs';
}
$('mv-type').addEventListener('change',mvTypeChanged);
$('mv-save').addEventListener('click',async()=>{
  const err=$('mv-err'); err.hidden=true;
  const type=$('mv-type').value, area=$('mv-area').value, toArea=$('mv-to').value, qty=$('mv-qty').value.trim(), date=$('mv-date').value;
  if(!/^\d+$/.test(qty)||(type!=='count'&&+qty===0)){err.textContent='Enter the number of pigs.';err.hidden=false;$('mv-qty').focus();return}
  if(!date){err.textContent='Enter the date.';err.hidden=false;return}
  if(type==='transfer'&&area===toArea){err.textContent='Choose two different areas.';err.hidden=false;return}
  const now=new Date(),p=n=>String(n).padStart(2,'0');
  const time=date===todayISO()?`${p(now.getHours())}:${p(now.getMinutes())}`:'12:00';
  await store.addMovement({type,area,toArea:type==='transfer'?toArea:'',qty:+qty,date,time,note:$('mv-note').value.trim(),by:form.name||'',createdAt:Date.now()});
  $('mv-qty').value=''; $('mv-note').value='';
  toast(type==='count'?`${areaName(area)} set to ${qty} pigs`:'Saved');
});
$('mv-list').addEventListener('click',e=>{
  const id=e.target.dataset.rmmv; if(!id)return;
  if(!confirm('Remove this entry? Pig numbers will be worked out again without it.'))return;
  store.deleteMovement(id); toast('Entry removed');
});

/* ---------- NAS settings ---------- */
function fillNasForm(){
  const c=NAS.config;
  $('nas-host').value=c.host||''; $('nas-port').value=c.port||''; $('nas-folder').value=c.folder||'PigReports';
  $('nas-user').value=c.user||'pigapp'; $('nas-pass').value=c.pass||'';
}
$('nas-setup').addEventListener('input',()=>{
  const t=$('nas-setup').value.trim(); if(!t)return;
  try{const p=JSON.parse(t); if(p.t!=='pigapp-setup')throw 0;
    $('nas-host').value=p.url||''; $('nas-port').value=p.port||''; $('nas-folder').value=p.folder||'PigReports';
    $('nas-user').value=p.user||'pigapp'; if(p.pass)$('nas-pass').value=p.pass;
    $('nas-setup').value=''; toast('Setup details filled in – tap Save and test connection');
  }catch(e){}
});
$('nas-save').addEventListener('click',async()=>{
  const box=$('nas-result'); const host=$('nas-host').value.trim();
  if(!host){box.hidden=false;box.className='nas-result bad';box.textContent='Enter the NAS address, e.g. https://ugreen-nas.tailxxxx.ts.net';return}
  box.hidden=false; box.className='nas-result'; box.textContent='Testing the connection…'; $('nas-save').disabled=true;
  const r=await NAS.test({host,port:$('nas-port').value.trim(),folder:$('nas-folder').value.trim()||'PigReports',user:$('nas-user').value.trim(),pass:$('nas-pass').value});
  $('nas-save').disabled=false;
  box.className='nas-result '+(r.ok?'good':'bad'); box.textContent=r.ok?'Connected. Inspections will now be shared through the NAS.':r.msg;
  if(r.ok)NAS.sync();
});
$('sync-now').addEventListener('click',()=>{NAS.sync();toast('Syncing…')});
function timeAgo(t){if(!t)return 'never';const m=Math.round((Date.now()-t)/60000);if(m<1)return 'just now';if(m<60)return `${m} min ago`;const h=Math.round(m/60);if(h<24)return `${h} hour${h===1?'':'s'} ago`;return new Date(t).toLocaleDateString('en-GB')}
function renderSyncState(){
  const st=NAS.state;
  let head,detail;
  if(!NAS.configured()){head='Not connected to the NAS';detail='Enter the NAS details below. Until then, inspections are kept on this phone.'}
  else if(st.busy){head='Syncing…';detail='Talking to the NAS…'}
  else if(st.lastError){head=st.queued?`Offline – ${st.queued} waiting to send`:'Offline';detail=st.lastError+(st.queued?` ${st.queued} item${st.queued===1?'':'s'} will send automatically when the NAS can be reached.`:'')}
  else if(st.queued){head=`${st.queued} waiting to send`;detail='Sending to the NAS…'}
  else{head=`Synced ${timeAgo(st.lastSync)}`;detail=`Everything is on the NAS. Last synced ${timeAgo(st.lastSync)}.`}
  $('sync').textContent=head; $('sync').classList.toggle('warn',!!st.lastError||!NAS.configured());
  $('sync-detail').textContent=detail;
}

/* ---------- PDF report for the NAS ---------- */
const pdfText=s=>String(s??'').replace(/→/g,'->').replace(/[✅]/g,'Yes').replace(/[❌]/g,'No').replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g,'');
async function makeReportPdf(h){
  const {PDFDocument,StandardFonts,rgb}=PDFLib;
  const doc=await PDFDocument.create(); doc.setTitle(`Pig inspection ${fmtDate(h.date)} ${h.time}`); doc.setAuthor(h.name||'');
  const F=await doc.embedFont(StandardFonts.Helvetica), B=await doc.embedFont(StandardFonts.HelveticaBold);
  const W=595.28,H=841.89,M=40; let page,y;
  const green=rgb(.12,.23,.18), red=rgb(.76,.25,.18), grey=rgb(.35,.38,.36), line=rgb(.8,.83,.8);
  const newPage=()=>{page=doc.addPage([W,H]);y=H-M};
  const need=n=>{if(y-n<M+20)newPage()};
  function wrap(str,font,size,width){const words=pdfText(str).split(/\s+/);const lines=[];let cur='';for(const w of words){const t=cur?cur+' '+w:w;if(font.widthOfTextAtSize(t,size)>width&&cur){lines.push(cur);cur=w}else cur=t}if(cur)lines.push(cur);return lines.length?lines:['']}
  function text(str,{size=10,bold=false,color=rgb(0,0,0),x=M,width=W-2*M,gap=3}={}){const f=bold?B:F;for(const ln of wrap(str,f,size,width)){need(size+gap);y-=size;page.drawText(ln,{x,y,size,font:f,color});y-=gap}}
  function rule(){need(8);y-=4;page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.7,color:line});y-=6}
  newPage();
  page.drawRectangle({x:0,y:H-74,width:W,height:74,color:green});
  page.drawText('Pig inspection report',{x:M,y:H-40,size:20,font:B,color:rgb(1,1,1)});
  page.drawText(pdfText(`${fmtDate(h.date)} at ${h.time}  ·  Inspected by ${h.name}`),{x:M,y:H-60,size:11,font:F,color:rgb(.85,.9,.87)});
  y=H-92;
  if(h.geo)text(`Location: ${h.geo.lat.toFixed(6)}, ${h.geo.lng.toFixed(6)}  (${mapsUrl(h.geo)})`,{size:9,color:grey});
  const totalPigs=h.stock?LOCS.reduce((a,l)=>a+(+h.stock[l.k]||0),0):null;
  text(`Dead pigs: ${h.totalDead||0}  ·  Pigs medicated: ${h.totalMedicated||0}${totalPigs!=null?`  ·  Pigs on farm before this inspection: ${totalPigs}`:''}`,{size:11,bold:true,color:h.totalDead?red:rgb(0,0,0)});
  rule();
  for(const l of LOCS){
    const s=(h.locs||{})[l.k]; if(!s)continue;
    need(60);
    const pigs=h.stock&&h.stock[l.k]!=null?(+s.dead?`${h.stock[l.k]} -> ${h.stock[l.k]-(+s.dead)} pigs`:`${h.stock[l.k]} pigs`):'';
    text(`${l.n}${pigs?'   ('+pigs+')':''}`,{size:13,bold:true,color:green,gap:5});
    text(checksFor(l.k).map(c=>`${c.n}: ${chk(s,c.k)?'Yes':'No'}`).join('   ·   '),{size:9.5});
    text(`Feed: ${s.feedAdded||'not recorded'}  ·  Dead pigs: ${s.dead||0}`,{size:9.5,bold:+s.dead>0,color:+s.dead>0?red:rgb(0,0,0)});
    const ts=treats(s);
    if(ts.length)ts.forEach((t,i)=>{
      text(`Medication${ts.length>1?' '+(i+1):''}: ${medLabel({name:t.medName,serial:t.serial})||'not recorded'} – ${t.medCount||0} pigs × ${t.medDose||'?'} ml (${totalMl(t)} ml total)${t.useBy?`, use by ${fmtDate(t.useBy)}`:''}`,{size:9.5});
      const extra=[t.medReason?`Reason: ${t.medReason}`:'',markText(t)?`Marked: ${markText(t)}`:'',t.withdrawal!==undefined&&t.withdrawal!==''?(+t.withdrawal===0?'No withdrawal':`Withdrawal ${t.withdrawal} days – free from medication ${fmtDate(wdEnd(h.date,t.withdrawal))}`):''].filter(Boolean).join('   ·   ');
      if(extra)text(extra,{size:9,color:grey,x:M+10,width:W-2*M-10});
    });
    else text('Medicated: No',{size:9.5});
    if(s.notes)text(`Notes: ${s.notes}`,{size:9.5,color:grey});
    rule();
  }
  const r=h.rodent;
  if(r&&r.areas){
    need(60); text('Rodent control',{size:13,bold:true,color:green,gap:5});
    LOCS.forEach(l=>{const a=r.areas[l.k]||{boxes:'0'};text(`${l.n}: ${a.boxes} bait boxes checked${a.evidence?' – EVIDENCE OF RODENTS':''}${a.restock?' – restock required':''}`,{size:9.5,color:a.evidence?red:rgb(0,0,0)})});
    text(`Total bait boxes checked: ${rodentTotal(r)}${r.poisonType||r.poisonName?`  ·  Poison used: ${[r.poisonType,r.poisonName].filter(Boolean).join(' – ')}`:''}`,{size:9.5,bold:true});
    if(r.notes)text(`Notes: ${r.notes}`,{size:9.5,color:grey});
  }
  doc.getPages().forEach((p,i,a)=>p.drawText(pdfText(`Pig Inspection app · ${fmtDate(h.date)} ${h.time} · ${h.name} · page ${i+1} of ${a.length}`),{x:M,y:22,size:8,font:F,color:grey}));
  return doc.saveAsBase64();
}
async function queueReportPdf(h){
  const b64=await makeReportPdf(h);
  const safe=String(h.name||'').replace(/[^A-Za-z0-9 _-]/g,'').trim()||'unknown';
  const [y,m]=h.date.split('-');
  NAS.putFile(`Reports/${y}/${y}-${m}/${h.date} ${String(h.time||'').replace(':','')} - ${safe}.pdf`,{bodyBase64:b64,contentType:'application/pdf'});
}

/* ---------- Start ---------- */
const DEFAULT_OPERATIVES=['Richard Gwilliam','Wayne McFarlane'];
let lastSerialsJson='';
function refreshFromNas(){
  loadFromNas();
  const sj=JSON.stringify(serials);
  renderHistory(); renderSerials(); renderOperatives(); renderPoisons(); renderSyncState();
  if(sj!==lastSerialsJson){lastSerialsJson=sj; renderLocs()} else updateTotals();
  if(!$('view-pigs').hidden)renderPigs();
  if(!$('view-stats').hidden&&window.renderStats)renderStats();
}
form.name=local.get('name','');
loadFromNas(); lastSerialsJson=JSON.stringify(serials);
fillDetails(); renderLocs(); renderHistory(); renderSerials(); renderOperatives(); renderPoisons(); fillMvForm(); fillNasForm(); renderSyncState();
NAS.onChange(refreshFromNas);
NAS.onChange(()=>{const st=NAS.state; if(NAS.configured()&&st.lastSync&&!st.busy&&!st.lastError&&NAS.setting('operatives',undefined)===undefined)NAS.setSetting('operatives',DEFAULT_OPERATIVES)});
setInterval(renderSyncState,30000);
$('app-version').textContent=`Pig Inspection ${NAS.isNative()?'Android app':'(browser)'}`;
NAS.sync();

/* ---------- Setup banner ---------- */
function renderBanner(){
  const b=$('setup-banner'); const st=NAS.state; let msg='';
  if(!NAS.configured())msg='Finish setting up: tap here and enter the NAS details.';
  else if(st.lastError&&!st.busy)msg=`Not reaching the NAS${st.queued?` – ${st.queued} waiting to send, they'll go when there's signal`:''}. Tap here to check.`;
  b.hidden=!msg; b.textContent=msg;
}
$('setup-banner').addEventListener('click',()=>document.querySelector('.tabs button[data-view="ops"]').click());
NAS.onChange(renderBanner);
renderBanner();
