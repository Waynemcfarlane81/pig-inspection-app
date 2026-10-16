/* ---------- Sheds / areas and their equipment ----------
   Set by an admin in Settings → Farm setup and stored on the NAS (app-data/settings/areas.json).
   The tick boxes for each area come from its equipment. Each saved inspection keeps a copy of the
   layout it was made with (rec.layout), so old reports still show the checks that were done. */
const EQUIP=[
  {k:'autoFeed',n:'Auto feed system'},{k:'manualFeed',n:'Manual feeders'},
  {k:'trough',n:'Trough drinkers'},{k:'nipple',n:'Nipple drinkers'}];
/* Every check that can appear, in display order */
const CHECKS=[
  {k:'beddingOk',n:'Bedding OK'},
  {k:'beddingReq',n:'Bedding required',warn:true},
  {k:'drinkersChecked',n:'Drinkers checked'},
  {k:'drinkersCleaned',n:'Drinkers cleaned'},
  {k:'nipplesOk',n:'Nipples operational'},
  {k:'autoFeed',n:'Auto feed system active'},
  {k:'feedHopper',n:'Feed hopper checked'}];
const DEFAULT_AREAS=[
  {k:'shed1',n:'Shed 1',equip:{autoFeed:true,trough:true}},{k:'shed2',n:'Shed 2',equip:{autoFeed:true,trough:true}},{k:'shed3',n:'Shed 3',equip:{autoFeed:true,trough:true}},
  {k:'workshopR',n:'Workshop right',equip:{manualFeed:true,trough:true}},{k:'workshopL',n:'Workshop left',equip:{manualFeed:true,trough:true}},{k:'horseyard',n:'Horse yard',equip:{manualFeed:true,trough:true}}];
let ALL_AREAS=DEFAULT_AREAS;      // includes removed areas, so old records keep their names
const LOCS=[];                    // areas in use now (same array object throughout, updated in place)
function checkKeysFor(eq){eq=eq||{};const c=['beddingOk','beddingReq'];
  if(eq.trough||eq.nipple)c.push('drinkersChecked');
  if(eq.trough)c.push('drinkersCleaned');
  if(eq.nipple)c.push('nipplesOk');
  if(eq.autoFeed)c.push('autoFeed');
  if(eq.autoFeed||eq.manualFeed)c.push('feedHopper');
  return c}
const areaDef=k=>ALL_AREAS.find(a=>a.k===k)||{k,n:k,equip:{}};
function setAreas(list){
  ALL_AREAS=Array.isArray(list)&&list.length?list:DEFAULT_AREAS;
  LOCS.splice(0,LOCS.length,...ALL_AREAS.filter(a=>!a.removed));
}
setAreas(null);
const layoutNow=()=>{const o={};LOCS.forEach(l=>o[l.k]={n:l.n,checks:checkKeysFor(l.equip),feed:!!(l.equip||{}).manualFeed});return o};
/* Checks and feed for an area – for a saved record (h) when given, otherwise as set up now */
const lay=(k,h)=>h&&h.layout&&h.layout[k]?h.layout[k]:{n:areaDef(k).n,checks:checkKeysFor(areaDef(k).equip),feed:!!(areaDef(k).equip||{}).manualFeed};
const checksFor=(k,h)=>{const ks=lay(k,h).checks;return CHECKS.filter(c=>ks.includes(c.k))};
const hasFeed=(k,h)=>lay(k,h).feed;
/* Areas recorded in a saved inspection, in farm order */
const recLocs=h=>{const ks=Object.keys((h&&h.locs)||{});const known=ALL_AREAS.filter(a=>ks.includes(a.k)).map(a=>({k:a.k,n:h.layout&&h.layout[a.k]?h.layout[a.k].n:a.n}));
  return known.concat(ks.filter(k=>!ALL_AREAS.some(a=>a.k===k)).map(k=>({k,n:lay(k,h).n})))};
const LEGACY_CHECK={beddingOk:'bedding',drinkersChecked:'water',autoFeed:'feedSystem'};
const chk=(s,k)=>s[k]!==undefined?!!s[k]:!!s[LEGACY_CHECK[k]];
/* Items that make an area "fully checked": bedding (OK or required) plus every other check except "drinkers cleaned" */
const doneItems=(k,s,h)=>{const ks=lay(k,h).checks;return [chk(s,'beddingOk')||chk(s,'beddingReq'),...ks.filter(c=>!['beddingOk','beddingReq','drinkersCleaned'].includes(c)).map(c=>chk(s,c))]};
const TICK='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let serials=[]; let operatives=[]; let poisons=[]; let history=[]; let canWrite=true;
/* Who is signed in on this phone, and the users list from the NAS ({name:{role:'admin'|'user',pin:'<hash>'}}) */
let me=null; let accounts=null; let farmDraft=null, farmDirty=false;
const isAdmin=()=>!!me&&me.role==='admin';
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
const normMeds=list=>(Array.isArray(list)?list:[]).map(x=>typeof x==='string'?{name:'',serial:x,useBy:'',withdrawal:'',usedFor:'',refSrc:''}:{name:x.name||'',serial:x.serial||'',useBy:x.useBy||'',withdrawal:x.withdrawal??'',usedFor:x.usedFor||'',refSrc:x.refSrc||'',bottleMl:x.bottleMl??'',bottles:x.bottles??'',addedAt:x.addedAt||0});
/* ---------- Medication stock in ml ----------
   Stock = bottle size × number of bottles. Every saved inspection that used this medication (same name and
   serial / batch number, saved after it was added) takes its total ml off. */
const hasStock=m=>+m.bottleMl>0&&+m.bottles>0;
const stockTotal=m=>hasStock(m)?+(+m.bottleMl*+m.bottles).toFixed(1):0;
function mlUsed(m,exceptId){let u=0;history.forEach(h=>{if(h.id===exceptId||(m.addedAt&&(h.createdAt||0)<m.addedAt))return;
  Object.values(h.locs||{}).forEach(s=>treats(s).forEach(t=>{if(t.medName===m.name&&t.serial===m.serial)u+=totalMl(t)}))});return +u.toFixed(1)}
const mlLeft=m=>+(stockTotal(m)-mlUsed(m)).toFixed(1);
const fmtL=v=>`${+(+v).toFixed(1)} ml`;
function stockHtml(m){
  if(!hasStock(m))return '<span class="med-sub">Stock: not set</span>';
  const tot=stockTotal(m), used=mlUsed(m), left=+(tot-used).toFixed(1), low=left<=tot*0.2;
  const bl=+(left/+m.bottleMl).toFixed(1);
  return `<span class="med-sub">Stock: ${esc(m.bottles)} × ${esc(m.bottleMl)} ml bottles = ${fmtL(tot)} · used ${fmtL(used)}</span>
    <span class="stock-line ${left<=0?'low':low?'low':'ok'}">${left<=0?`None left${left<0?` (${fmtL(-left)} more used than in stock)`:''}`:`${fmtL(left)} left – about ${bl} bottle${bl===1?'':'s'}`}${left>0&&low?' – running low':''}</span>`;
}
function todayISO(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
function useByState(d){if(!d)return null;const days=Math.round((new Date(d+'T00:00:00')-new Date(todayISO()+'T00:00:00'))/864e5);
  if(days<0)return {cls:'ub-bad',txt:`Expired on ${fmtDate(d)}`};if(days<=30)return {cls:'ub-warn',txt:`Use within ${days} day${days===1?'':'s'} (by ${fmtDate(d)})`};return {cls:'ub-ok',txt:`In date until ${fmtDate(d)}`}}
let form=freshForm();
function blankRodent(){const a={};LOCS.forEach(l=>a[l.k]={boxes:'0',evidence:false,restock:false});return {areas:a,evidence:false,poisonType:'',poisonName:'',notes:''}}
function freshForm(){
  const d=new Date(); const pad=n=>String(n).padStart(2,'0');
  const f={photos:[],name:'',date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,time:`${pad(d.getHours())}:${pad(d.getMinutes())}`,locs:{},rodent:blankRodent()};
  LOCS.forEach(l=>f.locs[l.k]=blankLoc()); return f;
}

/* ---------- Storage: everything goes through the NAS sync engine (nas.js) ---------- */
const local={get:(k,d)=>NAS.lsGet(k,d),set:(k,v)=>NAS.lsSet(k,v)};
/* Saved inspections waiting to be sent (see Time on site) */
let held=local.get('held',[]); if(!Array.isArray(held))held=[];
let heldMem=null;            // used if the phone's storage is too full to keep photos
const store={
  async addInspection(rec){return NAS.put('inspections',rec)},
  /* Admin only: the buttons are hidden for users, and these refuse as well */
  async deleteInspection(id){if(!isAdmin())return;NAS.remove('inspections',id)},
  async savePoisons(list){if(!isAdmin())throw new Error('Admin only');NAS.setSetting('poisons',list)},
  async saveSerials(list){if(!isAdmin())throw new Error('Admin only');NAS.setSetting('medications',list)},
  async saveAccounts(acc){if(!isAdmin())throw new Error('Admin only');writeAccounts(acc)},
  async addMovement(m){if(!isAdmin())return;NAS.put('movements',m)},
  async deleteMovement(id){if(!isAdmin())return;NAS.remove('movements',id)}
};
const byNewest=(a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))||((b.createdAt||0)-(a.createdAt||0));
/* Reload everything from the local copy of the NAS data */
function loadFromNas(){
  history=[...NAS.inspections(),...held.map(h=>h.rec)].sort(byNewest);
  movements=NAS.movements();
  const acc=NAS.setting('accounts',null); accounts=acc&&typeof acc==='object'&&!Array.isArray(acc)?acc:null;
  operatives=accounts?Object.keys(accounts).sort((a,b)=>a.localeCompare(b)):NAS.setting('operatives',DEFAULT_OPERATIVES).filter(x=>typeof x==='string');
  poisons=NAS.setting('poisons',[]).filter(x=>typeof x==='string');
  serials=normMeds(NAS.setting('medications',[]));
  setAreas(NAS.setting('areas',null));
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
  history.forEach(h=>{if(h.id===excludeInspId)return; recLocs(h).forEach(l=>{const d=+((h.locs||{})[l.k]||{}).dead||0; if(d)ev.push({type:'dead',area:l.k,qty:d,date:h.date,time:h.time,createdAt:h.createdAt,by:h.name,src:'insp',inspId:h.id})})});
  return ev.sort((a,b)=>evKey(a)<evKey(b)?-1:1);
}
/* Pig numbers per area, optionally only counting events up to a date/time (inclusive) */
function stockAt(until,excludeInspId){
  const s={}; LOCS.forEach(l=>s[l.k]=0);
  for(const e of stockEvents(excludeInspId)){
    if(until&&evKey(e)>until)break;
    const q=+e.qty||0;
    if(!(e.area in s))s[e.area]=0; if(e.toArea&&!(e.toArea in s))s[e.toArea]=0;   // areas since removed
    if(e.type==='count')s[e.area]=q;
    else if(e.type==='in')s[e.area]+=q;
    else if(e.type==='transfer'){s[e.area]-=q; if(e.toArea in s)s[e.toArea]+=q}
    else s[e.area]-=q; // sold, out, dead
  }
  return s;
}
const stockNow=()=>stockAt(null);
const areaName=k=>areaDef(k).n;

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
/* Medication reasons matched against what the medicine is used for (its "used for" text, the reference list,
   and the symptoms guide). Only matching reasons are offered; "Other" is always there. */
const REASON_WORDS={
 'Lameness':['lame','joint','arthritis','foot','leg'],
 'Respiratory / coughing':['respirat','pneumon','cough','rhinitis','pasteurel','actinobac','mycoplasma','breath','lung'],
 'Scour / diarrhoea':['scour','diarrh','coccid','gut','enteric','enteritis','dysentery','e. coli'],
 'Skin condition':['skin','erysipelas','mange','lice','dermat'],
 'Injury / wound':['wound','injur','soft-tissue','soft tissue','cellulitis','secondary infection'],
 'Tail bite':['wound','bite','soft-tissue','soft tissue','cellulitis'],
 'Ear bite':['wound','bite','ear','soft-tissue','soft tissue','cellulitis'],
 'Abscess':['abscess','soft-tissue','soft tissue','cellulitis','wound'],
 'Fever':['fever','septic','inflamm','mma'],
 'Joint ill':['joint'],
 'Parasites / worms':['worm','parasit','mange','lice','mite'],
 'Prevention / routine':['prevent','coccid','routine']};
function reasonsFor(t){
  const m=serials.find(x=>x.name===t.medName&&x.serial===t.serial);
  const name=m?m.name:t.medName; if(!name&&!m)return MED_REASONS;
  const ref=findRef(name);
  const syms=ref?SYMPTOMS.filter(y=>y.meds.includes(ref.name)).map(y=>y.n).join(' '):'';
  const text=[(m&&m.usedFor)||'',ref?ref.use:'',syms].join(' ').toLowerCase();
  if(!text.trim())return MED_REASONS;
  const list=MED_REASONS.filter(r=>r==='Other'||(REASON_WORDS[r]||[]).some(w=>text.includes(w)));
  return list.length>1?list:MED_REASONS;
}
function reasonHint(t){const r=reasonsFor(t);return r.length<MED_REASONS.length&&t.medName?`Reasons that match what ${t.medName} is used for`:''}
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
function medInfoHtml(t){const m=serials.find(x=>x.name===t.medName&&x.serial===t.serial);if(!m)return '';if(hasStock(m)){const left=mlLeft(m),need=totalMl(t);return `${m.usedFor?`<span class="hint">Used for: ${esc(m.usedFor)}</span><br>`:''}<span class="hint" style="color:${left-need<0?'var(--loss)':'inherit'}">In stock: ${fmtL(left)}${need?` · this uses ${fmtL(need)} → ${fmtL(left-need)} left`:''}</span>`}if(!m.usedFor)return '';return `<span class="hint">Used for: ${esc(m.usedFor)}</span>`}
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
      <div><label for="${id('medReason')}">Medication reason</label><select ${a('medReason')}>${listOptions(reasonsFor(t),t.medReason,'Select reason')}</select><div class="hint" id="${id('rhint')}" style="font-size:12px;margin-top:3px">${esc(reasonHint(t))}</div></div>
      <div><label for="${id('markColour')}">Marking colour</label><select ${a('markColour')}>${listOptions(MARK_COLOURS,t.markColour,'Select colour',c=>(COLOUR_DOT[c]?COLOUR_DOT[c]+' ':'')+c)}</select></div>
      <div><label for="${id('markType')}">Mark type</label><select ${a('markType')}>${listOptions(MARK_TYPES,t.markType,'Select mark')}</select></div>
    </div></div>`;
}
/* ---------- Photos for the report ----------
   The camera button beside each tick box takes a photo. Photos are shrunk (longest side 1280 px), shown under the area,
   sent to the NAS beside the PDF (Reports/<year>/<year-month>/Photos/...) and printed in the PDF report. */
const PHOTO_ITEMS={rodEvidence:'Evidence of rodents',rodRestock:'Bait restock required'};
const itemName=k=>(CHECKS.find(c=>c.k===k)||{}).n||PHOTO_ITEMS[k]||k;
let camTarget=null; const photoCache={};   // photoCache[inspection id] = photos taken on this phone, for re-sending the PDF
const CAM_SVG='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>';
function camBtn(area,item){const n=form.photos.filter(p=>p.area===area&&p.item===item).length;
  return `<button type="button" class="cam-btn${n?' has':''}" data-cam="${area}|${item}" aria-label="Take a photo – ${esc(itemName(item))}">${CAM_SVG}${n?`<span class="cam-n">${n}</span>`:''}</button>`}
function photoStrip(area){return form.photos.filter(p=>p.area===area).map(p=>`<figure class="photo"><img src="data:image/jpeg;base64,${p.data}" alt="${esc(p.label)}"><figcaption>${esc(p.label)}</figcaption><button type="button" class="photo-x" data-rmph="${p.id}" aria-label="Delete photo">×</button></figure>`).join('')}
function refreshPhotos(area){
  const st=$('ph-'+area); if(st)st.innerHTML=photoStrip(area);
  document.querySelectorAll(`[data-cam^="${area}|"]`).forEach(b=>{const [a,i]=b.dataset.cam.split('|');b.outerHTML=camBtn(a,i)});
}
function shrinkPhoto(file){return new Promise((res,rej)=>{
  const url=URL.createObjectURL(file), img=new Image();
  img.onload=()=>{const M=1280,r=Math.min(1,M/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.round(img.width*r); c.height=Math.round(img.height*r); c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    URL.revokeObjectURL(url); res({data:c.toDataURL('image/jpeg',0.72).split(',')[1],w:c.width,h:c.height})};
  img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('Photo could not be read'))};
  img.src=url})}
$('cam-input').addEventListener('change',async e=>{
  const files=[...(e.target.files||[])]; if(!files.length||!camTarget)return;
  const {area,item}=camTarget;
  for(const f of files){
    try{const p=await shrinkPhoto(f); form.photos.push({id:Math.random().toString(36).slice(2,10),area,item,label:`${areaName(area)} – ${itemName(item)}`,...p,takenAt:Date.now()})}
    catch(err){toast('Photo could not be added. Try again.')}
  }
  refreshPhotos(area); toast(files.length>1?`${files.length} photos added`:'Photo added');
});
function photoDir(h){const [y,m]=h.date.split('-');const safe=String(h.name||'').replace(/[^A-Za-z0-9 _-]/g,'').trim()||'unknown';return `Reports/${y}/${y}-${m}/Photos/${h.date} ${String(h.time||'').replace(':','')} - ${safe}`}
function ubHtml(d){const st=useByState(d);return st?`<span class="ub ${st.cls}">${esc(st.txt)}</span>`:''}
function renderLocs(){
  LOCS.forEach(l=>{if(!form.locs[l.k])form.locs[l.k]=blankLoc(); if(!form.rodent.areas[l.k])form.rodent.areas[l.k]={boxes:'0',evidence:false,restock:false}});
  $('locs').innerHTML=LOCS.map(l=>{
    const s=form.locs[l.k];
    return `<article class="loc" data-loc="${l.k}">
      <div class="loc-head"><span class="tag">${esc(l.n)}</span><span class="loc-right"><span class="loc-pigs" id="pg-${l.k}"></span><span class="loc-state" id="st-${l.k}"></span></span></div>
      <div class="loc-body">
        <div class="group-title">Checks</div>
        <div class="checks">${checksFor(l.k).map(c=>`<div class="check-cam"><div class="check${c.warn?' warn':''}">
          <input type="checkbox" id="${l.k}-${c.k}" data-f="${c.k}"${s[c.k]?' checked':''}>
          <label for="${l.k}-${c.k}"><span class="box">${TICK}</span>${c.n}</label></div>${camBtn(l.k,c.k)}</div>`).join('')}</div>
        <div class="photo-strip" id="ph-${l.k}">${photoStrip(l.k)}</div>
        <div class="row" style="margin-top:12px">
          ${hasFeed(l.k)?`<div><label for="${l.k}-feedAdded">Feed added</label>
            <select id="${l.k}-feedAdded" data-f="feedAdded">
              <option value="">Select</option>
              <option${s.feedAdded==='Feed added'?' selected':''}>Feed added</option>
              <option${s.feedAdded==='No feed added'?' selected':''}>No feed added</option>
            </select></div>`:''}
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
        ${rodentAreaHtml(l)}
        <div style="margin-top:12px"><label for="${l.k}-notes" class="group-title" style="display:block;margin:0 0 4px">Notes</label>
          <textarea id="${l.k}-notes" data-f="notes" placeholder="Optional">${esc(s.notes)}</textarea></div>
      </div></article>`}).join('');
  renderRodent();
  updateTotals();
}
const rodentTotal=r=>r&&r.areas?Object.values(r.areas).reduce((a,x)=>a+(+(x||{}).boxes||0),0):0;
function boxOptions(sel){let o='';for(let i=0;i<=30;i++)o+=`<option value="${i}"${String(i)===sel?' selected':''}>${i} ${i===1?'box':'boxes'}</option>`;return o}
function poisonOptions(sel){
  let o=poisons.length?'<option value="">Select poison</option>':'<option value="">Add poisons in the Meds tab</option>';
  poisons.forEach(n=>o+=`<option${n===sel?' selected':''}>${esc(n)}</option>`);
  if(sel&&!poisons.includes(sel))o+=`<option selected>${esc(sel)}</option>`;
  return o;
}
function renderPoisons(){
  $('poison-list').innerHTML=poisons.length?poisons.map((n,i)=>`<li><span>${esc(n)}</span>${isAdmin()?`<button class="link-x" data-rmp="${i}" aria-label="Remove ${esc(n)}">Remove</button>`:''}</li>`).join('')
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
function rodentAreaHtml(l){
  const a=form.rodent.areas[l.k];
  return `<div class="rod-area-box" data-rodarea="${l.k}">
    <div class="group-title">Rodent control</div>
    <div class="rod-row">
      <div><label for="rb-${l.k}">Bait boxes checked</label><select id="rb-${l.k}" data-rb="${l.k}">${boxOptions(a.boxes)}</select></div>
      <div class="check-cam"><div class="check alert"><input type="checkbox" id="re-${l.k}" data-re="${l.k}"${a.evidence?' checked':''}><label for="re-${l.k}"><span class="box">${TICK}</span><span>Evidence of rodents</span></label></div>${camBtn(l.k,'rodEvidence')}</div>
      <div class="check-cam"><div class="check warn"><input type="checkbox" id="rr-${l.k}" data-rr="${l.k}"${a.restock?' checked':''}><label for="rr-${l.k}"><span class="box">${TICK}</span><span>Restock required</span></label></div>${camBtn(l.k,'rodRestock')}</div>
    </div></div>`;
}
function renderRodent(){
  const r=form.rodent;
  $('rodent').innerHTML=`<article class="loc rodent">
    <div class="loc-head"><span class="tag tag-rodent">Rodent control – poison used</span><span class="loc-state" id="st-rodent">${rodentTotal(r)} bait boxes checked</span></div>
    <div class="loc-body">
      <div class="hint" style="margin:0 0 10px">Bait boxes, evidence and restock are recorded in each area above.</div>
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
function rodentInput(t){
  const r=form.rodent;
  if(t.dataset.rb)r.areas[t.dataset.rb].boxes=t.value;
  else if(t.dataset.rr)r.areas[t.dataset.rr].restock=t.checked;
  else if(t.dataset.re){r.areas[t.dataset.re].evidence=t.checked;r.evidence=LOCS.some(l=>(r.areas[l.k]||{}).evidence);}
  else return false;
  const st=$('st-rodent'); if(st)st.textContent=`${rodentTotal(r)} bait boxes checked`; updateTotals();
  return true;
}
$('rodent').addEventListener('input',e=>{
  const r=form.rodent, t=e.target;
  if(t.id==='rod-notes'){r.notes=t.value;return}
  else if(t.id==='rod-ptype'){r.poisonType=t.value;return}
  else if(t.id==='rod-pname'){r.poisonName=t.value;return}
  $('st-rodent').textContent=`${rodentTotal(r)} bait boxes checked`; updateTotals();
});
$('locs').addEventListener('click',e=>{
  const cam=e.target.closest('[data-cam]'); if(cam){const [area,item]=cam.dataset.cam.split('|'); camTarget={area,item}; $('cam-input').value=''; $('cam-input').click(); return}
  const rp=e.target.closest('[data-rmph]'); if(rp){const p=form.photos.find(x=>x.id===rp.dataset.rmph); if(p&&confirm(`Delete this photo (${p.label})?`)){form.photos=form.photos.filter(x=>x!==p); refreshPhotos(p.area)} return}
  const add=e.target.closest('[data-addt]'), rm=e.target.closest('[data-rmt]');
  if(add){const s=form.locs[add.dataset.addt]; s.meds.push(blankTreat()); renderLocs(); const i=s.meds.length-1; const el=$(`${add.dataset.addt}-t${i}-med`); if(el){el.focus(); el.scrollIntoView({block:'center'})} updateTotals(); return}
  if(rm){const s=form.locs[rm.dataset.rmt]; if(!confirm(`Remove medication ${+rm.dataset.ti+1} from this area?`))return; s.meds.splice(+rm.dataset.ti,1); renderLocs(); updateTotals();}
});
$('locs').addEventListener('input',e=>{
  if(rodentInput(e.target))return;
  const card=e.target.closest('[data-loc]'); const f=e.target.dataset.f; if(!card||!f)return;
  const s=form.locs[card.dataset.loc];
  if(e.target.dataset.t!==undefined){const t=s.meds[+e.target.dataset.t]; if(f==='med'){const m=serials.find(x=>medLabel(x)===e.target.value);t.medName=m?m.name:'';t.serial=m?m.serial:'';t.useBy=m?m.useBy:''; if(m&&m.withdrawal!==''&&m.withdrawal!=null){t.withdrawal=String(m.withdrawal);const k=card.dataset.loc,ti=e.target.dataset.t,ws=$(`${k}-t${ti}-withdrawal`);if(ws){ws.innerHTML=wdOptions(t.withdrawal)}const wo=$(`${k}-t${ti}-wd`);if(wo)wo.innerHTML=wdHtml(form.date,t.withdrawal)} const inf=$(`${card.dataset.loc}-t${e.target.dataset.t}-info`); if(inf)inf.innerHTML=medInfoHtml(t);
      { const k=card.dataset.loc,ti=e.target.dataset.t; if(f==='med'){ if(t.medReason&&!reasonsFor(t).includes(t.medReason))t.medReason='';
        const rs=$(`${k}-t${ti}-medReason`); if(rs)rs.innerHTML=listOptions(reasonsFor(t),t.medReason,'Select reason'); const rh=$(`${k}-t${ti}-rhint`); if(rh)rh.textContent=reasonHint(t) } } } else t[f]=e.target.value; if(f==='withdrawal'){const el=$(`${card.dataset.loc}-t${e.target.dataset.t}-wd`);if(el)el.innerHTML=wdHtml(form.date,t.withdrawal)} if(f!=='med'){const inf=$(`${card.dataset.loc}-t${e.target.dataset.t}-info`);if(inf)inf.innerHTML=medInfoHtml(t)} updateTotals(); return}
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
  const sel=$('f-name');
  // Users can only record inspections as themselves; admins can pick anyone
  if(me&&!isAdmin()){form.name=me.name; sel.innerHTML=`<option selected>${esc(me.name)}</option>`; sel.value=me.name; sel.disabled=true; return}
  sel.disabled=false;
  const cur=form.name;
  let o=operatives.length?'<option value="">Select operative</option>':'<option value="">Add users in Settings</option>';
  operatives.forEach(n=>o+=`<option${n===cur?' selected':''}>${esc(n)}</option>`);
  if(cur&&!operatives.includes(cur))o+=`<option selected>${esc(cur)}</option>`;
  sel.innerHTML=o; sel.value=cur||'';
}

/* ---------- Users: admin and user permissions ----------
   Stored on the NAS in app-data/settings/accounts.json, so every phone shares one list.
   Admin – everything.
   User  – new inspections (as themselves), view history, pig numbers, stats and meds, WhatsApp, PDFs, export.
           Can't record or remove pig numbers, delete inspections, change medications, poisons, users or the NAS connection. */
const ROLE_NAME={admin:'Admin',user:'User'};
/* SHA-256, so PINs are never stored as typed */
function sha256(str){
  const ascii=unescape(encodeURIComponent(str)); let s=ascii;
  const rr=(v,a)=>(v>>>a)|(v<<(32-a)), max=2**32, words=[], bitLen=ascii.length*8;
  let hash=[]; const k=[]; let pc=0; const comp={};
  for(let c=2;pc<64;c++){if(!comp[c]){for(let i=0;i<313;i+=c)comp[i]=c;hash[pc]=(Math.pow(c,.5)*max)|0;k[pc++]=(Math.pow(c,1/3)*max)|0}}
  s+='\x80'; while(s.length%64-56)s+='\x00';
  for(let i=0;i<s.length;i++)words[i>>2]|=s.charCodeAt(i)<<((3-i)%4)*8;
  words[words.length]=(bitLen/max)|0; words[words.length]=bitLen;
  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16), old=hash; hash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4];
      const t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^(~e&hash[6]))+k[i]
        +(w[i]=i<16?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash); hash[4]=(hash[4]+t1)|0;
    }
    for(let i=0;i<8;i++)hash[i]=(hash[i]+old[i])|0;
  }
  let out=''; for(let i=0;i<8;i++)for(let j=3;j>=0;j--){const b=(hash[i]>>(j*8))&255;out+=(b<16?'0':'')+b.toString(16)}
  return out;
}
const pinHash=(name,pin)=>sha256(`pigapp|${String(name).trim().toLowerCase()}|${pin}`);
const validPin=p=>/^\d{4,6}$/.test(p);
const adminCount=acc=>Object.values(acc||{}).filter(a=>a.role==='admin').length;
/* Writes the users list, and keeps the plain operatives list in step for phones still on an older version */
function writeAccounts(acc){
  accounts=acc;
  NAS.setSetting('accounts',acc);
  NAS.setSetting('operatives',Object.keys(acc).sort((a,b)=>a.localeCompare(b)));
}
function renderOperatives(){
  const list=$('op-list');
  if(!operatives.length)list.innerHTML='<li style="color:var(--ink-2);font-weight:400">No users yet. Add the first one above.</li>';
  else list.innerHTML=operatives.map((n,i)=>{
    const a=(accounts||{})[n]||{role:'user',pin:''}; const self=me&&me.name===n;
    return `<li><span>${esc(n)}${self?' <span class="med-sub" style="display:inline">(you)</span>':''} <span class="role-badge ${a.role==='admin'?'admin':''}">${ROLE_NAME[a.role]||'User'}</span>
      <span class="med-sub">${a.pin?'PIN set':'No PIN yet – they choose one the first time they sign in'}</span></span>
      ${isAdmin()?`<span class="med-actions">
        <button class="link-x link-edit" data-setrole="${i}">${a.role==='admin'?'Make user':'Make admin'}</button>
        ${a.pin?`<button class="link-x link-edit" data-resetpin="${i}">Reset PIN</button>`:''}
        ${self?'':`<button class="link-x" data-rmop="${i}" aria-label="Remove ${esc(n)}">Remove</button>`}</span>`:''}</li>`}).join('');
  renderOpSelect();
}
async function addOperative(){
  const v=$('new-op').value.trim().replace(/\s+/g,' '); const role=$('new-op-role').value; const err=$('op-err'); err.hidden=true;
  if(!v){err.textContent="Enter the person's full name.";err.hidden=false;$('new-op').focus();return}
  if(operatives.some(n=>n.toLowerCase()===v.toLowerCase())){err.textContent='That person is already in the list.';err.hidden=false;return}
  try{await store.saveAccounts({...accounts,[v]:{role,pin:''}});$('new-op').value='';$('new-op-role').value='user';toast(`${v} added as ${ROLE_NAME[role].toLowerCase()} – they set their PIN when they first sign in`)}
  catch(e){err.textContent='User not added. Try again.';err.hidden=false}
}
$('add-op').addEventListener('click',addOperative);
$('new-op').addEventListener('keydown',e=>{if(e.key==='Enter')addOperative()});
$('op-list').addEventListener('click',async e=>{
  if(!isAdmin())return;
  const t=e.target, d=t.dataset, idx=d.rmop??d.setrole??d.resetpin; if(idx===undefined)return;
  const n=operatives[+idx]; const a=accounts[n]; if(!a)return;
  try{
    if(d.setrole!==undefined){
      const to=a.role==='admin'?'user':'admin';
      if(to==='user'&&adminCount(accounts)<=1){toast('There must be at least one admin. Make someone else admin first.');return}
      if(to==='user'&&me.name===n&&!confirm('Make yourself a user? You will lose admin permissions on this phone straight away.'))return;
      if(to==='admin'&&!confirm(`Make ${n} an admin? They will be able to change pig numbers, delete inspections and manage users.`))return;
      await store.saveAccounts({...accounts,[n]:{...a,role:to}}); toast(`${n} is now ${to==='admin'?'an admin':'a user'}`);
    } else if(d.resetpin!==undefined){
      if(!confirm(`Reset ${n}'s PIN? They will choose a new one the next time they sign in.`))return;
      await store.saveAccounts({...accounts,[n]:{...a,pin:''}}); toast(`${n}'s PIN has been reset`);
    } else {
      if(me.name===n)return;
      if(a.role==='admin'&&adminCount(accounts)<=1){toast('There must be at least one admin.');return}
      if(!confirm(`Remove ${n}? They won't be able to sign in. Saved inspections keep their name.`))return;
      const next={...accounts}; delete next[n]; await store.saveAccounts(next); toast(`${n} removed`);
    }
  }catch(err){toast('Not saved. Try again.')}
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
  { const need={}; LOCS.forEach(l=>treats(form.locs[l.k]).forEach(t=>{const m=serials.find(x=>x.name===t.medName&&x.serial===t.serial); if(m&&hasStock(m)){const k=medLabel(m);need[k]=need[k]||{m,ml:0};need[k].ml+=totalMl(t)}}));
    const short=Object.values(need).filter(x=>x.ml>mlLeft(x.m));
    if(short.length&&!confirm(`Not enough in stock: ${short.map(x=>`${medLabel(x.m)} needs ${fmtL(x.ml)} but only ${fmtL(Math.max(0,mlLeft(x.m)))} is left`).join('; ')}. Save anyway? (Add bottles in the Meds tab.)`))return; }
  const totalDead=LOCS.reduce((a,l)=>a+ +form.locs[l.k].dead,0);
  const totalMedicated=LOCS.reduce((a,l)=>a+treats(form.locs[l.k]).reduce((b,t)=>b+(+t.medCount||0),0),0);
  const createdAt=Date.now();
  const before=stockAt(`${form.date}T${form.time||'23:59'}|${String(createdAt).padStart(15,'0')}`); // pig numbers before this inspection's deaths
  const short=LOCS.filter(l=>+form.locs[l.k].dead>before[l.k]);
  if(short.length&&!confirm(`More dead pigs are recorded than the app thinks are in ${short.map(l=>l.n).join(', ')}. Save anyway? (Update the numbers in the Pigs tab afterwards.)`))return;
  const photos=form.photos.slice();
  const rec={name:form.name.trim(),date:form.date,time:form.time,geo:geo?{lat:geo.lat,lng:geo.lng,acc:geo.acc||null}:null,createdAt,totalDead,totalMedicated,stock:before,layout:layoutNow(),locs:JSON.parse(JSON.stringify(Object.fromEntries(LOCS.map(l=>[l.k,form.locs[l.k]])))),rodent:JSON.parse(JSON.stringify({...form.rodent,areas:Object.fromEntries(LOCS.map(l=>[l.k,form.rodent.areas[l.k]]))}))};
  if(photos.length){const dir=photoDir(rec),cnt={};rec.photos=photos.map(p=>{const k=p.area+'-'+p.item;cnt[k]=(cnt[k]||0)+1;return {area:p.area,item:p.item,label:p.label,file:`${dir}/${areaName(p.area)} - ${itemName(p.item)} ${cnt[k]}.jpg`.replace(/[^A-Za-z0-9 _\-\/.]/g,'')}})}
  rec.id=new Date(createdAt).toISOString().replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,8);
  rec.startedAt=form.startedAt||createdAt;
  $('save').disabled=true;
  try{
    /* Held on this phone until it leaves the farm (500 m) or 2 hours after the start – see "Time on site" below */
    holdInspection(rec,photos,false);
    const n=form.name; form=freshForm(); form.name=n; fillDetails(); renderLocs(); window.scrollTo({top:0});
    openSendSheet(rec.id);
  }
  catch(e){console.error(e);toast('Inspection not saved. Try again.')}
  finally{$('save').disabled=!canWrite}
}
/* Send an inspection to the NAS: the record, its photos, the PDF, and WhatsApp if asked for */
async function sendInspection(rec,photos,send){
  const saved=await store.addInspection(rec);
  if(photos&&photos.length&&saved.photos){photoCache[saved.id]=photos; saved.photos.forEach((m,i)=>{if(photos[i]&&photos[i].data)NAS.putFile(m.file,{bodyBase64:photos[i].data,contentType:'image/jpeg'})})}
  try{await queueReportPdf(saved,photos)}catch(e){console.error('PDF failed',e)}
  if(send&&!document.hidden&&confirm(`The inspection report from ${hhmm(rec.startedAt)} is ready. Send it on WhatsApp now?`))sendWhatsApp(saved);
  return saved;
}
$('save').addEventListener('click',()=>doSave(false));

/* ---------- WhatsApp report ---------- */
const WA_NUMBER='447872898990'; // 07872 898990
function reportText(h){
  const t=v=>v?'✅':'❌'; const L=[];
  L.push(`*Pig inspection – ${fmtDate(h.date)} at ${h.time}*`);
  L.push(`Inspected by: ${h.name}`);
  if(h.startedAt&&!h.pending)L.push(siteText(h));
  if(h.geo)L.push(`Location: ${mapsUrl(h.geo)}`);
  L.push(`Dead pigs: ${h.totalDead||0} | Pigs medicated: ${h.totalMedicated||0}`);
  if(h.photos&&h.photos.length)L.push(`📷 ${h.photos.length} photo${h.photos.length===1?'':'s'} – in the PDF report on the NAS`);
  recLocs(h).forEach(l=>{const s=(h.locs||{})[l.k]; if(!s)return;
    L.push('',`*${l.n}*`);
    L.push(checksFor(l.k,h).map(c=>c.warn?`${c.n}: ${chk(s,c.k)?'Yes ⚠️':'No'}`:`${c.n} ${t(chk(s,c.k))}`).join('  '));
    if(hasFeed(l.k,h)||s.feedAdded)L.push(`Feed: ${s.feedAdded||'not recorded'}`);
    L.push(`Dead pigs: ${s.dead||0}${+s.dead>0?' ⚠️':''}`);
    const ts=treats(s); if(ts.length){ts.forEach((t,i)=>{const m=medLabel({name:t.medName,serial:t.serial});L.push(`Medicated${ts.length>1?` (${i+1})`:''}: ${t.medCount||0} pigs${t.medDose?` × ${t.medDose} ml (${totalMl(t)} ml total)`:''} – ${m||'medication not recorded'}${t.useBy?` (use by ${fmtDate(t.useBy)})`:''}`);if(t.medReason)L.push(`Reason: ${t.medReason}`);if(markText(t))L.push(`Marked: ${markText(t)}`);if(t.withdrawal!==undefined&&t.withdrawal!==''){const e=wdEnd(h.date,t.withdrawal);L.push(+t.withdrawal===0?'Withdrawal: none':`Withdrawal: ${t.withdrawal} days – free from medication on ${fmtDate(e)}`)}})}
    else L.push('Medicated: No');
    if(s.notes)L.push(`Notes: ${s.notes}`);
  });
  const r=h.rodent;
  if(r&&r.areas){
    L.push('','*Rodent control*');
    Object.keys(r.areas).forEach(k=>{const l={k,n:areaName(k)};const a=r.areas[k]||{boxes:'0',restock:false};L.push(`${l.n}: ${a.boxes} bait boxes${a.evidence?' – evidence of rodents ⚠️':''}${a.restock?' – restock required ⚠️':''}`)});
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
  return `<div class="rod-sum"><b>Rodent control</b> – ${rodentTotal(r)} bait boxes checked · Evidence of rodents: ${r.evidence?`<span class="n">Yes${Object.keys(r.areas).some(k=>(r.areas[k]||{}).evidence)?' ('+Object.keys(r.areas).filter(k=>(r.areas[k]||{}).evidence).map(areaName).join(', ')+')':''}</span>`:'<span class="y">No</span>'}
    <table style="min-width:0;margin-top:6px"><thead><tr><th>Area</th><th>Bait boxes checked</th><th>Evidence of rodents</th><th>Restock required</th></tr></thead><tbody>
    ${Object.keys(r.areas).map(k=>{const l={k,n:areaName(k)};const a=r.areas[k]||{boxes:'0',restock:false};return `<tr><td>${esc(l.n)}</td><td>${esc(a.boxes)}</td><td>${a.evidence?'<span class="n">Yes</span>':'No'}</td><td>${a.restock?'<span class="n">Yes</span>':'No'}</td></tr>`}).join('')}
    </tbody></table>${r.poisonType||r.poisonName?`<div style="margin-top:6px">Poison used: <b>${esc([r.poisonType,r.poisonName].filter(Boolean).join(' – '))}</b></div>`:''}${r.notes?`<div style="margin-top:6px">Notes: ${esc(r.notes)}</div>`:''}</div>`;
}
function renderWithdrawals(){
  const rows=[];
  history.forEach(h=>recLocs(h).forEach(l=>{const s=(h.locs||{})[l.k]; if(!s)return; treats(s).forEach(t=>{
    if(t.withdrawal===undefined||t.withdrawal===''||+t.withdrawal===0)return; const e=wdEnd(h.date,t.withdrawal); const left=daysFromToday(e);
    if(left>0)rows.push({area:l.n,med:medLabel({name:t.medName,serial:t.serial})||'Medication',pigs:t.medCount||'0',mark:markText(t),end:e,left,date:h.date})})}));
  rows.sort((a,b)=>a.end<b.end?-1:a.end>b.end?1:0);
  $('wd-panel').innerHTML=rows.length?`<div class="panel wd-panel"><h2 style="margin:0 0 4px;font:700 22px/1.2 'Barlow Condensed',sans-serif">Pigs still in withdrawal</h2>
    <div class="hint" style="margin-bottom:8px">Worked out from the inspection date plus the withdrawal period.</div>
    <div style="overflow-x:auto"><table style="min-width:520px"><thead><tr><th>Area</th><th>Pigs</th><th>Free from medication</th><th>Marked</th><th>Medication</th><th>Medicated on</th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><b>${esc(r.area)}</b></td><td>${esc(r.pigs)}</td><td><b class="n">${fmtDate(r.end)}</b><br><span class="entry-meta">${r.left} day${r.left===1?'':'s'} to go</span></td><td>${esc(r.mark||'–')}</td><td>${esc(r.med)}</td><td>${fmtDate(r.date)}</td></tr>`).join('')}
    </tbody></table></div></div>`:'';
}
const histChecks=h=>{const used=new Set();recLocs(h).forEach(l=>lay(l.k,h).checks.forEach(c=>used.add(c)));return CHECKS.filter(c=>used.has(c.k))};
function renderHistory(){
  renderWithdrawals();
  $('hist-count').textContent=history.length?`${history.length} inspection${history.length>1?'s':''} saved`:'No inspections saved yet';
  $('export').hidden=!history.length;
  if(!history.length){$('hist').innerHTML='<div class="empty">Saved inspections appear here. Fill in the New inspection tab and save it.</div>';return}
  $('hist').innerHTML=history.map(h=>`<details class="entry">
    <summary><div><div class="entry-title">${fmtDate(h.date)} at ${esc(h.time)}</div><div class="entry-meta">${h.startedAt?esc(siteText(h))+'<br>':''}Inspected by ${esc(h.name)}${h.geo?` · <a class="maplink" href="${mapsUrl(h.geo)}" target="_blank" rel="noopener">${esc(fmtLL(h.geo))}</a>`:''}</div></div>
    <span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${h.pending?`<span class="dead-badge loss">${(held.find(x=>x.rec.id===h.id)||{}).queued?'Waiting to send':'Not sent'}</span>`:''}${h.rodent&&h.rodent.evidence?`<span class="dead-badge loss">Rodents seen</span>`:''}${h.photos&&h.photos.length?`<span class="dead-badge">📷 ${h.photos.length}</span>`:''}${h.totalMedicated?`<span class="dead-badge med-badge">${h.totalMedicated} medicated</span>`:''}<span class="dead-badge ${h.totalDead>0?'loss':''}">${h.totalDead} dead</span></span></summary>
    <div class="entry-body"><table><thead><tr><th>Area</th><th>Pigs</th>${histChecks(h).map(c=>`<th>${c.n}</th>`).join('')}<th>Feed</th><th>Dead</th><th>Medicated</th><th>No. medicated</th><th>Dosage</th><th>Medication / serial no.</th><th>Notes</th></tr></thead><tbody>
    ${recLocs(h).map(l=>{const s=(h.locs||{})[l.k]||blankLoc();return `<tr><td><b>${esc(l.n)}</b></td><td>${h.stock&&h.stock[l.k]!=null?(+s.dead?`${h.stock[l.k]} → ${h.stock[l.k]-(+s.dead)}`:h.stock[l.k]):'–'}</td>${histChecks(h).map(c=>`<td>${!lay(l.k,h).checks.includes(c.k)?'–':(c.k==='beddingReq'&&chk(s,c.k)?'<span class="n">Yes</span>':c.k==='beddingReq'?'No':yn(chk(s,c.k)))}</td>`).join('')}
      <td>${esc(s.feedAdded||'–')}</td><td${+s.dead>0?' class="n"':''}>${esc(s.dead)}</td><td>${esc(s.medicated)}</td><td>${(()=>{const ts=treats(s);return ts.length?ts.reduce((a,t)=>a+(+t.medCount||0),0):'–'})()}</td><td>${treats(s).map(t=>t.medDose?`${esc(t.medDose)} ml/pig<br><span class="entry-meta">${totalMl(t)} ml total</span>`:'–').join('<hr class="tsep">')||'–'}</td><td>${treats(s).map(t=>`${esc(medLabel({name:t.medName,serial:t.serial})||'–')}${t.useBy?`<br><span class="${t.useBy<h.date?'n':''}">Use by ${fmtDate(t.useBy)}</span>`:''}${t.medReason?`<br>Reason: ${esc(t.medReason)}`:''}${markText(t)?`<br>Marked: ${esc(markText(t))}`:''}${t.withdrawal!==undefined&&t.withdrawal!==''?(()=>{const e=wdEnd(h.date,t.withdrawal);const live=+t.withdrawal>0&&daysFromToday(e)>0;return `<br><span class="${live?'n':'y'}">Withdrawal: ${+t.withdrawal===0?'none':`${esc(t.withdrawal)} days – free ${fmtDate(e)}`}</span>`})():''}`).join('<hr class="tsep">')||'–'}</td><td>${esc(s.notes||'')}</td></tr>`}).join('')}
    </tbody></table>
    ${rodentHtml(h.rodent)}
    ${h.photos&&h.photos.length?`<div class="rod-sum"><b>Photos</b> (in the PDF report and the Photos folder on the NAS)<ul style="margin:4px 0 0;padding-left:18px">${h.photos.map(p=>`<li>${esc(p.label)}</li>`).join('')}</ul></div>`:''}
    <div class="entry-actions"><button class="btn btn-wa" data-wa="${esc(h.id)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:none"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg><span>Send via WhatsApp</span></button>
    ${h.pending?((held.find(x=>x.rec.id===h.id)||{}).queued?(isAdmin()?`<button class="btn btn-quiet" data-sendnow="${esc(h.id)}">Send now (admin)</button>`:''):`<button class="btn btn-primary" data-sendsheet="${esc(h.id)}">Send report</button>`):`<button class="btn btn-quiet" data-pdf="${esc(h.id)}">Send PDF to NAS again</button>`}
    ${isAdmin()&&!h.pending?`<button class="btn btn-danger" data-del="${esc(h.id)}">Delete inspection</button>`:''}</div></div></details>`).join('');
}
$('hist').addEventListener('click',async e=>{
  const ss=e.target.closest('[data-sendsheet]'); if(ss){openSendSheet(ss.dataset.sendsheet); return}
  const sn=e.target.closest('[data-sendnow]'); if(sn&&isAdmin()){const it=held.find(x=>x.rec.id===sn.dataset.sendnow); if(it&&confirm('Send this inspection now, before the phone has left the farm?')){it.force=true;checkHeld()} return}
  const wa=e.target.closest('[data-wa]'); if(wa){const h=history.find(x=>x.id===wa.dataset.wa); if(h)sendWhatsApp(h); return}
  const pdf=e.target.closest('[data-pdf]'); if(pdf){const h=history.find(x=>x.id===pdf.dataset.pdf); if(h){try{await queueReportPdf(h,photoCache[h.id]);toast('PDF queued for the NAS')}catch(err){toast('PDF could not be made')}} return}
  const id=e.target.dataset.del; if(!id)return;
  if(!confirm('Delete this inspection? This cannot be undone.'))return;
  try{await store.deleteInspection(id);toast('Inspection deleted')}catch(err){toast('Inspection not deleted. Try again.')}
});
let downloadsApi=null;
function rodentCsv(r,k){if(!r)return ['','','','','',''];if(!r.areas){const t=(r.boxes||[]).filter(Boolean).length;return [`${t}/10 (whole site)`,r.restock?'Yes':'No',r.evidence?'Yes':'No','','',r.notes||'']}const a=r.areas[k]||{boxes:'',restock:false};return [a.boxes,a.restock?'Yes':'No',a.evidence===undefined?(r.evidence?'Yes':'No'):(a.evidence?'Yes':'No'),r.poisonType||'',r.poisonName||'',r.notes||'']}
function csvCell(v){v=String(v??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function buildCsv(){
  const head=['Date','Time','Inspected by','Started','Left the farm','Minutes on site','Latitude','Longitude','Google Maps link','Area','Pigs in area (before deaths)',...CHECKS.map(c=>c.n),'Feed added','Dead pigs','Medicated','Pigs medicated','Dosage (ml per pig)','Total ml','Medication name','Serial number','Use by date','Withdrawal (days)','Free from medication','Medication reason','Marking colour','Mark type','Notes','Bait boxes checked','Bait restock required','Evidence of rodents','Poison type','Poison name','Rodent notes'];
  const rows=[head];
  history.forEach(h=>recLocs(h).forEach(l=>{const s=(h.locs||{})[l.k]||blankLoc();
    const ts=treats(s), J=f=>ts.map(f).join(' | ');
    rows.push([fmtDate(h.date),h.time,h.name,h.startedAt?hhmm(h.startedAt):'',h.leftAt?hhmm(h.leftAt):(h.siteEnd==='2h'?'Still on site after 2 h':''),h.onSiteMins??'',h.geo?h.geo.lat:'',h.geo?h.geo.lng:'',h.geo?mapsUrl(h.geo):'',l.n,h.stock&&h.stock[l.k]!=null?h.stock[l.k]:'',...CHECKS.map(c=>!lay(l.k,h).checks.includes(c.k)?'':(chk(s,c.k)?'Yes':'No')),s.feedAdded,s.dead,s.medicated,J(t=>t.medCount||'0'),J(t=>t.medDose||''),J(t=>t.medDose?totalMl(t):''),J(t=>t.medName||''),J(t=>t.serial||''),J(t=>t.useBy?fmtDate(t.useBy):''),J(t=>t.withdrawal??''),J(t=>t.withdrawal!==undefined&&t.withdrawal!==''?fmtDate(wdEnd(h.date,t.withdrawal)):''),J(t=>t.medReason||''),J(t=>t.markColour||''),J(t=>t.markType||''),s.notes,...rodentCsv(h.rodent,l.k)])}));
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
  $('serial-list').innerHTML=serials.length?serials.map((m,i)=>`<li><span>${esc(m.name||'Unnamed medication')}<span class="med-sub">Serial / batch: ${esc(m.serial||'–')}</span>${m.useBy?`<span class="med-sub">Use by: ${fmtDate(m.useBy)} ${m.useBy<todayISO()?'<b style="color:var(--loss)">– expired</b>':''}</span>`:'<span class="med-sub">Use by: not set</span>'}<span class="med-sub">Withdrawal: ${m.withdrawal!==''&&m.withdrawal!=null?`<b>${esc(m.withdrawal)} days</b>`:'<b style="color:var(--loss)">not set</b>'}</span>${m.usedFor?`<span class="med-sub med-use">${esc(m.usedFor)}</span>`:''}${m.refSrc?`<span class="med-sub" style="font-size:12px">Source: ${esc(m.refSrc)}</span>`:''}${stockHtml(m)}</span><span class="med-actions">${isAdmin()?`<button class="link-x link-edit" data-stock="${i}" aria-label="Stock for ${esc(medLabel(m))}">${hasStock(m)?'Add bottles':'Set stock'}</button><button class="link-x link-edit" data-ed="${i}" aria-label="Edit details for ${esc(medLabel(m))}">Edit details</button><button class="link-x" data-rm="${i}" aria-label="Remove ${esc(medLabel(m))}">Remove</button>`:''}</span></li>`).join('')
    :'<li style="color:var(--ink-2);font-weight:400">No medications yet. Add the first one above.</li>';
}
async function addSerial(){
  const name=$('new-medname').value.trim(), v=$('new-serial').value.trim(), ub=$('new-useby').value, wd=$('new-wd').value.trim(), uf=$('new-usedfor').value.trim();
  const bml=$('new-bottleml').value.trim(), nb=$('new-bottles').value.trim(); const err=$('serial-err'); err.hidden=true;
  if(wd!==''&&(!/^\d+$/.test(wd)||+wd>365)){err.textContent='Enter the withdrawal period as a whole number of days (0–365).';err.hidden=false;$('new-wd').focus();return}
  if(!name||!v||!ub){err.textContent='Enter the medication name, serial / batch number and use by date.';err.hidden=false;(!name?$('new-medname'):!v?$('new-serial'):$('new-useby')).focus();return}
  if(!(+bml>0)){err.textContent='Enter the bottle size in ml.';err.hidden=false;$('new-bottleml').focus();return}
  if(!/^\d+$/.test(nb)||+nb<1){err.textContent='Enter how many bottles (a whole number).';err.hidden=false;$('new-bottles').focus();return}
  if(serials.some(m=>m.name.toLowerCase()===name.toLowerCase()&&m.serial.toLowerCase()===v.toLowerCase())){err.textContent='That medication and serial number are already in the list. Use "Add bottles" on it instead.';err.hidden=false;return}
  try{const ref=findRef(name); await store.saveSerials([...serials,{name,serial:v,useBy:ub,withdrawal:wd,usedFor:uf,refSrc:ref&&ref.wd===wd?ref.src:(wd||uf?'Entered by user':''),bottleMl:+bml,bottles:+nb,addedAt:Date.now()}]);
    ['new-medname','new-serial','new-useby','new-wd','new-usedfor','new-bottleml','new-bottles'].forEach(id=>$(id).value='');$('new-total').hidden=true;$('ref-box').hidden=true;$('new-medname').focus();toast('Medication added')}
  catch(e){err.textContent='Medication not added. Try again.';err.hidden=false}
}
function showNewTotal(){const b=+$('new-bottleml').value,n=+$('new-bottles').value,o=$('new-total');
  if(b>0&&n>0){o.hidden=false;o.textContent=`Total in stock: ${n} × ${+b} ml = ${fmtL(b*n)}`}else o.hidden=true}
['new-bottleml','new-bottles'].forEach(id=>$(id).addEventListener('input',showNewTotal));
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
  const si=e.target.dataset.stock;
  if(si!==undefined){
    const m={...serials[+si]};
    if(!hasStock(m)){
      const b=prompt(`Bottle size in ml for ${medLabel(m)}`,''); if(b===null)return;
      if(!(+b>0)){toast('Enter the bottle size in ml');return}
      const n=prompt('How many bottles in stock now?',''); if(n===null)return;
      if(!/^\d+$/.test(n.trim())||+n<1){toast('Enter a whole number of bottles');return}
      m.bottleMl=+b; m.bottles=+n; m.addedAt=Date.now();   // usage counts from now
    } else {
      const n=prompt(`How many ${m.bottleMl} ml bottles of ${medLabel(m)} are you adding? (${fmtL(mlLeft(m))} left now)\n\nTo take bottles off, enter a minus number, e.g. -1.`,'1'); if(n===null)return;
      if(!/^-?\d+$/.test(n.trim())||+n===0){toast('Enter a whole number of bottles');return}
      if(+m.bottles+ +n<0){toast('That would leave fewer than 0 bottles');return}
      m.bottles=+m.bottles+ +n;
    }
    try{await store.saveSerials(serials.map((x,j)=>j===+si?m:x));toast(`Stock saved – ${fmtL(mlLeft(m))} left`)}catch(err){toast('Stock not saved. Try again.')}
    return;
  }
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
  $('pig-areas').innerHTML=LOCS.map(l=>`<div class="pig-area"><span class="tag">${esc(l.n)}</span><span class="pig-n${s[l.k]<0?' n':''}">${s[l.k]}</span><span class="hint">${dead7[l.k]?`<b class="n">${dead7[l.k]} dead</b> in 7 days`:'No deaths in 7 days'}</span></div>`).join('')
    +(LOCS.some(l=>s[l.k]<0)?'<div class="err">An area shows below zero – do a stock count to set the right number.</div>':'');
  const ev=stockEvents().reverse().slice(0,150);
  $('mv-list').innerHTML=ev.length?ev.map(e=>{
    const what=e.type==='count'?`Stock count: <b>${e.qty}</b> pigs in ${esc(areaName(e.area))}`
      :e.type==='transfer'?`Moved <b>${e.qty}</b> pigs from ${esc(areaName(e.area))} to ${esc(areaName(e.toArea))}`
      :e.type==='in'?`<b>+${e.qty}</b> pigs in to ${esc(areaName(e.area))}`
      :e.type==='dead'?`<b class="n">−${e.qty}</b> dead in ${esc(areaName(e.area))} <span class="med-sub">From inspection</span>`
      :`<b>−${e.qty}</b> ${e.type==='sold'?'sold from':'out of'} ${esc(areaName(e.area))}`;
    return `<li><span>${what}<span class="med-sub">${fmtDate(e.date)}${e.by?' · '+esc(e.by):''}${e.note?' · '+esc(e.note):''}</span></span>${e.src==='mv'&&isAdmin()?`<button class="link-x" data-rmmv="${esc(e.id)}">Remove</button>`:''}</li>`}).join('')
    :'<li style="color:var(--ink-2);font-weight:400">Nothing recorded yet. Start with a stock count for each area.</li>';
}
function fillMvForm(){
  const opts=LOCS.map(l=>`<option value="${l.k}">${esc(l.n)}</option>`).join('');
  $('mv-area').innerHTML=opts; $('mv-to').innerHTML=opts; $('mv-to').value=(LOCS[1]||LOCS[0]||{}).k||'';
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
  if(!isAdmin())return;
  const err=$('mv-err'); err.hidden=true;
  const type=$('mv-type').value, area=$('mv-area').value, toArea=$('mv-to').value, qty=$('mv-qty').value.trim(), date=$('mv-date').value;
  if(!/^\d+$/.test(qty)||(type!=='count'&&+qty===0)){err.textContent='Enter the number of pigs.';err.hidden=false;$('mv-qty').focus();return}
  if(!date){err.textContent='Enter the date.';err.hidden=false;return}
  if(type==='transfer'&&area===toArea){err.textContent='Choose two different areas.';err.hidden=false;return}
  const now=new Date(),p=n=>String(n).padStart(2,'0');
  const time=date===todayISO()?`${p(now.getHours())}:${p(now.getMinutes())}`:'12:00';
  await store.addMovement({type,area,toArea:type==='transfer'?toArea:'',qty:+qty,date,time,note:$('mv-note').value.trim(),by:me?me.name:(form.name||''),createdAt:Date.now()});
  $('mv-qty').value=''; $('mv-note').value='';
  toast(type==='count'?`${areaName(area)} set to ${qty} pigs`:'Saved');
});
$('mv-list').addEventListener('click',e=>{
  const id=e.target.dataset.rmmv; if(!id||!isAdmin())return;
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
async function makeReportPdf(h,photos){
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
  if(h.startedAt)text(siteText(h),{size:10,bold:true});
  if(h.geo)text(`Location: ${h.geo.lat.toFixed(6)}, ${h.geo.lng.toFixed(6)}  (${mapsUrl(h.geo)})`,{size:9,color:grey});
  const totalPigs=h.stock?recLocs(h).reduce((a,l)=>a+(+h.stock[l.k]||0),0):null;
  text(`Dead pigs: ${h.totalDead||0}  ·  Pigs medicated: ${h.totalMedicated||0}${totalPigs!=null?`  ·  Pigs on farm before this inspection: ${totalPigs}`:''}`,{size:11,bold:true,color:h.totalDead?red:rgb(0,0,0)});
  rule();
  for(const l of recLocs(h)){
    const s=(h.locs||{})[l.k]; if(!s)continue;
    need(60);
    const pigs=h.stock&&h.stock[l.k]!=null?(+s.dead?`${h.stock[l.k]} -> ${h.stock[l.k]-(+s.dead)} pigs`:`${h.stock[l.k]} pigs`):'';
    text(`${l.n}${pigs?'   ('+pigs+')':''}`,{size:13,bold:true,color:green,gap:5});
    text(checksFor(l.k,h).map(c=>`${c.n}: ${chk(s,c.k)?'Yes':'No'}`).join('   ·   '),{size:9.5});
    text(`${hasFeed(l.k,h)||s.feedAdded?`Feed: ${s.feedAdded||'not recorded'}  ·  `:''}Dead pigs: ${s.dead||0}`,{size:9.5,bold:+s.dead>0,color:+s.dead>0?red:rgb(0,0,0)});
    const ts=treats(s);
    if(ts.length)ts.forEach((t,i)=>{
      text(`Medication${ts.length>1?' '+(i+1):''}: ${medLabel({name:t.medName,serial:t.serial})||'not recorded'} – ${t.medCount||0} pigs × ${t.medDose||'?'} ml (${totalMl(t)} ml total)${t.useBy?`, use by ${fmtDate(t.useBy)}`:''}`,{size:9.5});
      const extra=[t.medReason?`Reason: ${t.medReason}`:'',markText(t)?`Marked: ${markText(t)}`:'',t.withdrawal!==undefined&&t.withdrawal!==''?(+t.withdrawal===0?'No withdrawal':`Withdrawal ${t.withdrawal} days – free from medication ${fmtDate(wdEnd(h.date,t.withdrawal))}`):''].filter(Boolean).join('   ·   ');
      if(extra)text(extra,{size:9,color:grey,x:M+10,width:W-2*M-10});
    });
    else text('Medicated: No',{size:9.5});
    if(s.notes)text(`Notes: ${s.notes}`,{size:9.5,color:grey});
    const ph=(photos||[]).filter(p=>p.area===l.k);
    if(ph.length){
      text(`Photos (${ph.length})`,{size:9.5,bold:true,gap:5});
      const cw=(W-2*M-12)/2, chMax=190; let col=0,top=0,bottom=0;
      for(const p of ph){
        let img; try{img=await doc.embedJpg(p.data)}catch(e){continue}
        const sc=Math.min(cw/img.width,chMax/img.height), w=img.width*sc, ih=img.height*sc;
        if(col===0){need(chMax+18); top=y; bottom=y}
        const x=M+col*(cw+12);
        page.drawImage(img,{x,y:top-ih,width:w,height:ih});
        page.drawText(pdfText(p.label),{x,y:top-ih-11,size:8,font:F,color:grey});
        bottom=Math.min(bottom,top-ih-16);
        if(++col===2){col=0; y=bottom-4}
      }
      if(col===1)y=bottom-4;
    } else if(h.photos&&h.photos.some(p=>p.area===l.k))
      text(`Photos on the NAS: ${h.photos.filter(p=>p.area===l.k).map(p=>p.file.split('/').pop()).join(', ')}`,{size:9,color:grey});
    rule();
  }
  const r=h.rodent;
  if(r&&r.areas){
    need(60); text('Rodent control',{size:13,bold:true,color:green,gap:5});
    Object.keys(r.areas).forEach(k=>{const l={k,n:areaName(k)};const a=r.areas[k]||{boxes:'0'};text(`${l.n}: ${a.boxes} bait boxes checked${a.evidence?' – EVIDENCE OF RODENTS':''}${a.restock?' – restock required':''}`,{size:9.5,color:a.evidence?red:rgb(0,0,0)})});
    text(`Total bait boxes checked: ${rodentTotal(r)}${r.poisonType||r.poisonName?`  ·  Poison used: ${[r.poisonType,r.poisonName].filter(Boolean).join(' – ')}`:''}`,{size:9.5,bold:true});
    if(r.notes)text(`Notes: ${r.notes}`,{size:9.5,color:grey});
  }
  doc.getPages().forEach((p,i,a)=>p.drawText(pdfText(`Pig Inspection app · ${fmtDate(h.date)} ${h.time} · ${h.name} · page ${i+1} of ${a.length}`),{x:M,y:22,size:8,font:F,color:grey}));
  return doc.saveAsBase64();
}
async function queueReportPdf(h,photos){
  const b64=await makeReportPdf(h,photos);
  const safe=String(h.name||'').replace(/[^A-Za-z0-9 _-]/g,'').trim()||'unknown';
  const [y,m]=h.date.split('-');
  NAS.putFile(`Reports/${y}/${y}-${m}/${h.date} ${String(h.time||'').replace(':','')} - ${safe}.pdf`,{bodyBase64:b64,contentType:'application/pdf'});
}

/* ---------- Start ---------- */
const DEFAULT_OPERATIVES=['Richard Gwilliam','Wayne McFarlane'];
let lastSerialsJson='';
function refreshFromNas(){
  loadFromNas();
  const sj=JSON.stringify(serials)+JSON.stringify(LOCS);
  renderHistory(); renderSerials(); renderOperatives(); renderPoisons(); renderSyncState();
  if(sj!==lastSerialsJson){lastSerialsJson=sj; renderLocs(); fillMvForm(); if(window.fillStatsAreas)fillStatsAreas(); if(!farmDirty)renderFarm()} else updateTotals();
  if(!$('view-pigs').hidden)renderPigs();
  if(!$('view-stats').hidden&&window.renderStats)renderStats();
}
form.name=local.get('name','');
loadFromNas(); lastSerialsJson=JSON.stringify(serials)+JSON.stringify(LOCS);
fillDetails(); renderLocs(); renderHistory(); renderSerials(); renderOperatives(); renderPoisons(); fillMvForm(); fillNasForm(); renderSyncState();
NAS.onChange(refreshFromNas);
NAS.onChange(()=>{const st=NAS.state; if(NAS.configured()&&st.lastSync&&!st.busy&&!st.lastError&&NAS.setting('operatives',undefined)===undefined)NAS.setSetting('operatives',DEFAULT_OPERATIVES)});
setInterval(renderSyncState,30000);
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

/* ---------- Sign in ----------
   Everyone signs in with their name and a PIN (4–6 digits). The phone stays signed in until "Sign out".
   The first time the new version reaches the NAS with no users list, it makes one from the operatives:
   Wayne McFarlane is admin, everyone else is a user, and each person chooses their PIN when they first sign in. */
const FIRST_ADMIN='Wayne McFarlane';
let gateKey=''; let pinFor=''; let forceSetup=false;
function bootstrapAccounts(){
  if(accounts||!NAS.configured())return;
  const st=NAS.state; if(!st.pulled||st.busy||st.lastError)return;   // only once this phone has actually checked the NAS
  const names=NAS.setting('operatives',DEFAULT_OPERATIVES).filter(x=>typeof x==='string');
  if(!names.includes(FIRST_ADMIN))names.push(FIRST_ADMIN);
  const acc={}; names.forEach(n=>acc[n]={role:n===FIRST_ADMIN?'admin':'user',pin:''});
  writeAccounts(acc); loadFromNas();
}
function setSetupMode(on){
  document.body.classList.toggle('setup-only',on);
  if(on){document.querySelectorAll('.tabs button').forEach(x=>x.setAttribute('aria-selected',x.dataset.view==='ops'));
    ['inspect','pigs','history','stats','meds','ops'].forEach(v=>$('view-'+v).hidden=v!=='ops'); $('savebar').hidden=true}
}
function signIn(name){
  me={name,role:accounts[name].role}; local.set('me',name); pinFor='';
  form.name=name; local.set('name',name);
  applyRole(); updateGate(); toast(`Signed in as ${name}`);
}
function signOut(msg){
  me=null; local.set('me',''); pinFor=''; applyRole(); updateGate(true);
  if(msg)toast(msg);
}
function applyRole(){
  document.body.classList.toggle('role-user',!!me&&!isAdmin());
  $('me-name').textContent=me?me.name:'';
  $('me-role').textContent=me?(isAdmin()?'Admin – full access':'User – can carry out inspections and view records'):'';
  $('me-role').className='role-badge'+(isAdmin()?' admin':'');
  $('app-version').textContent=`Pig Inspection${window.APP_VER?' '+window.APP_VER:''}${NAS.isNative()?'':' (browser)'}`;
  $('pigs-hint').textContent=isAdmin()?'Dead pigs recorded in each saved inspection are taken off automatically.'
    :'Dead pigs recorded in each saved inspection are taken off automatically. Only an admin can record stock counts, pigs in, moves and sales.';
  renderOperatives(); renderHistory(); renderSerials(); renderPoisons(); if(!$('view-pigs').hidden)renderPigs();
}
/* Keep the signed-in person in step with the NAS list (removed, or role changed by an admin) */
function checkMe(){
  if(!me||!accounts)return;
  const a=accounts[me.name];
  if(!a){signOut(`${me.name} has been removed by an admin`);return}
  if(a.role!==me.role){me.role=a.role; applyRole(); toast(`You are now ${a.role==='admin'?'an admin':'a user'}`)}
}
function gateHtml(view){
  const st=NAS.state;
  if(view==='wait')return `<p class="gate-msg">Connecting to the NAS to get the list of users…</p>
    ${st.lastError?`<div class="err">${esc(st.lastError)}</div><p class="hint">The first time, this phone needs signal or Wi-Fi.</p>`:''}
    <button class="btn btn-primary" id="g-retry">Try again</button>
    <button class="btn btn-quiet" id="g-setup">NAS connection settings</button>`;
  if(view==='create'){
    return `<p class="gate-msg"><b>${esc(pinFor)}</b>, choose a PIN of 4 to 6 numbers. You'll use it to sign in.</p>
      <label for="g-pin1">New PIN</label><input type="password" id="g-pin1" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off">
      <label for="g-pin2">Type it again</label><input type="password" id="g-pin2" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off">
      <div class="err" id="g-err" hidden></div>
      <button class="btn btn-primary" id="g-create">Save PIN and sign in</button>
      <button class="btn btn-quiet" id="g-back">Back</button>`;
  }
  const names=Object.keys(accounts).sort((a,b)=>a.localeCompare(b)); const last=local.get('name','');
  return `<label for="g-name">Your name</label>
    <select id="g-name"><option value="">Select your name</option>${names.map(n=>`<option${n===last?' selected':''}>${esc(n)}</option>`).join('')}</select>
    <label for="g-pin">PIN</label><input type="password" id="g-pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="First time? Leave blank">
    <div class="err" id="g-err" hidden></div>
    <button class="btn btn-primary" id="g-go">Sign in</button>
    <p class="hint">Not on the list? Ask an admin to add you in Settings.</p>`;
}
function updateGate(force){
  if(!NAS.configured()||forceSetup){$('gate').hidden=true; setSetupMode(true); return}
  setSetupMode(false);
  bootstrapAccounts();
  if(me&&accounts&&accounts[me.name]){$('gate').hidden=true; document.body.classList.remove('locked'); return}
  if(me&&accounts&&!accounts[me.name]){me=null; local.set('me','')}
  const view=!accounts?'wait':pinFor?'create':'signin';
  const key=view+'|'+(view==='wait'?NAS.state.lastError+NAS.state.busy:JSON.stringify(Object.keys(accounts||{}))+pinFor);
  $('gate').hidden=false; document.body.classList.add('locked');
  if(key===gateKey&&!force)return;   // don't wipe what someone is typing
  gateKey=key; $('gate-body').innerHTML=gateHtml(view);
  const f=$('g-pin')||$('g-pin1'); if(f&&view!=='signin')f.focus();
}
function gateErr(m){const e=$('g-err');e.textContent=m;e.hidden=false}
$('gate').addEventListener('click',e=>{
  const id=e.target.id;
  if(id==='g-retry'){NAS.sync()}
  else if(id==='g-setup'){forceSetup=true; updateGate()}
  else if(id==='g-back'){pinFor=''; updateGate(true)}
  else if(id==='g-go'){
    const n=$('g-name').value, p=$('g-pin').value.trim(), a=accounts[n];
    if(!n||!a)return gateErr('Select your name.');
    if(!a.pin){pinFor=n; updateGate(true); return}
    if(!p)return gateErr('Enter your PIN.');
    if(pinHash(n,p)!==a.pin){$('g-pin').value='';return gateErr('Wrong PIN. If you have forgotten it, ask an admin to reset it.')}
    signIn(n);
  }
  else if(id==='g-create'){
    const p1=$('g-pin1').value.trim(), p2=$('g-pin2').value.trim();
    if(!validPin(p1))return gateErr('The PIN must be 4 to 6 numbers.');
    if(p1!==p2)return gateErr("The two PINs don't match.");
    const a=accounts[pinFor]; if(!a){pinFor='';updateGate(true);return}
    if(a.pin)return gateErr('A PIN has already been set for this name. Go back and sign in.');
    writeAccounts({...accounts,[pinFor]:{...a,pin:pinHash(pinFor,p1)}});
    signIn(pinFor);
  }
});
$('gate').addEventListener('keydown',e=>{if(e.key!=='Enter')return; const b=$('g-go')||$('g-create'); if(b)b.click()});
$('setup-back').addEventListener('click',()=>{forceSetup=false; updateGate(true)});
$('sign-out').addEventListener('click',()=>{if(confirm('Sign out of this phone?'))signOut()});
$('change-pin').addEventListener('click',()=>{
  if(!me)return; const a=accounts[me.name];
  const old=prompt('Enter your current PIN'); if(old===null)return;
  if(pinHash(me.name,old.trim())!==a.pin){toast('Wrong PIN');return}
  const p1=prompt('New PIN (4 to 6 numbers)'); if(p1===null)return;
  if(!validPin(p1.trim())){toast('The PIN must be 4 to 6 numbers');return}
  const p2=prompt('Type the new PIN again'); if(p2===null)return;
  if(p1.trim()!==p2.trim()){toast("The PINs don't match");return}
  writeAccounts({...accounts,[me.name]:{...a,pin:pinHash(me.name,p1.trim())}}); toast('PIN changed');
});
{ const saved=local.get('me',''); if(saved&&accounts&&accounts[saved])me={name:saved,role:accounts[saved].role}; }
if(me)form.name=me.name;
applyRole(); fillDetails(); updateGate();
NAS.onChange(()=>{checkMe(); updateGate()});

/* ---------- Farm setup menu (admin) ---------- */
function renderFarm(){
  farmDraft=JSON.parse(JSON.stringify(ALL_AREAS.filter(a=>!a.removed))); farmDirty=false; drawFarm();
}
function drawFarm(){
  $('farm-list').innerHTML=farmDraft.length?farmDraft.map((a,i)=>{const eq=a.equip||(a.equip={});
    const ck=checkKeysFor(eq).map(k=>CHECKS.find(c=>c.k===k).n).concat(eq.manualFeed?['Feed added']:[]);
    return `<div class="farm-area" data-fi="${i}">
      <div class="fa-head"><div><label class="lbl" for="fa-n${i}">Name</label><input type="text" id="fa-n${i}" data-fname="${i}" value="${esc(a.n)}" placeholder="e.g. Shed 4" autocomplete="off"></div>
        <span class="fa-move"><button type="button" data-fup="${i}" aria-label="Move up"${i?'':' disabled'}>▲</button><button type="button" data-fdown="${i}" aria-label="Move down"${i<farmDraft.length-1?'':' disabled'}>▼</button></span>
        <button type="button" class="fa-rm" data-frm="${i}">Remove</button></div>
      <div class="fa-equip">${EQUIP.map(e=>`<div class="check"><input type="checkbox" id="fa-${i}-${e.k}" data-feq="${i}|${e.k}"${eq[e.k]?' checked':''}><label for="fa-${i}-${e.k}"><span class="box">${TICK}</span>${e.n}</label></div>`).join('')}</div>
      <div class="fa-checks">Tick boxes: ${esc(ck.join(' · '))}</div></div>`}).join('')
    :'<div class="hint" style="margin-top:10px">No sheds yet. Add the first one below.</div>';
}
$('farm-list').addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.fname!==undefined){farmDraft[+t.dataset.fname].n=t.value; farmDirty=true; return}
  if(t.dataset.feq){const [i,k]=t.dataset.feq.split('|'); farmDraft[+i].equip[k]=t.checked; farmDirty=true;
    const box=t.closest('.farm-area').querySelector('.fa-checks'); const eq=farmDraft[+i].equip;
    box.textContent='Tick boxes: '+checkKeysFor(eq).map(k=>CHECKS.find(c=>c.k===k).n).concat(eq.manualFeed?['Feed added']:[]).join(' · ')}
});
$('farm-list').addEventListener('click',e=>{
  const d=e.target.dataset;
  if(d.fup!==undefined){const i=+d.fup;[farmDraft[i-1],farmDraft[i]]=[farmDraft[i],farmDraft[i-1]]}
  else if(d.fdown!==undefined){const i=+d.fdown;[farmDraft[i+1],farmDraft[i]]=[farmDraft[i],farmDraft[i+1]]}
  else if(d.frm!==undefined){const a=farmDraft[+d.frm]; if(!confirm(`Remove ${a.n||'this area'}? Saved inspections and pig numbers for it are kept.`))return; farmDraft.splice(+d.frm,1)}
  else return;
  farmDirty=true; drawFarm();
});
$('farm-add').addEventListener('click',()=>{
  farmDraft.push({k:'a'+Date.now().toString(36),n:'',equip:{}}); farmDirty=true; drawFarm();
  const el=$(`fa-n${farmDraft.length-1}`); if(el){el.focus(); el.scrollIntoView({block:'center'})}
});
$('farm-save').addEventListener('click',()=>{
  if(!isAdmin())return;
  const err=$('farm-err'); err.hidden=true;
  farmDraft.forEach(a=>a.n=String(a.n||'').trim().replace(/\s+/g,' '));
  const bad=farmDraft.findIndex(a=>!a.n);
  if(!farmDraft.length){err.textContent='Add at least one shed or area.';err.hidden=false;return}
  if(bad>=0){err.textContent='Give every shed or area a name.';err.hidden=false;$(`fa-n${bad}`).focus();return}
  const names=farmDraft.map(a=>a.n.toLowerCase()); if(new Set(names).size!==names.length){err.textContent='Two areas have the same name.';err.hidden=false;return}
  const noDrink=farmDraft.filter(a=>!a.equip.trough&&!a.equip.nipple).map(a=>a.n);
  if(noDrink.length&&!confirm(`${noDrink.join(', ')} ${noDrink.length===1?'has':'have'} no drinkers ticked, so there will be no drinker checks. Save anyway?`))return;
  // Keep removed areas (marked removed) so old inspections and pig numbers still show their names
  const removed=ALL_AREAS.filter(a=>!farmDraft.some(d=>d.k===a.k)).map(a=>({...a,removed:true}));
  const list=[...farmDraft.map(a=>({k:a.k,n:a.n,equip:Object.fromEntries(Object.entries(a.equip).filter(([,v])=>v))})),...removed];
  NAS.setSetting('areas',list); local.set('farmSetupDone',true);
  farmDirty=false; loadFromNas(); lastSerialsJson=''; refreshFromNas();
  toast('Farm setup saved – every phone gets it on the next sync');
});
renderFarm();
/* First admin sign-in on a farm that has never been set up: open the setup menu */
function promptFarmSetup(){
  if(!isAdmin()||NAS.setting('areas',null)||local.get('farmSetupDone',false)||!NAS.state.pulled)return;
  local.set('farmSetupDone',true);
  document.querySelector('.tabs button[data-view="ops"]').click();
  setTimeout(()=>$('farm-panel').scrollIntoView({block:'start'}),50);
  toast('First, check the sheds and their equipment, then tap Save farm setup');
}
NAS.onChange(promptFarmSetup); promptFarmSetup();

/* ---------- Time on site (500 m geofence) ----------
   The inspection starts when the operative first fills anything in. From then the phone watches its
   location (a background service on Android, so it works with the screen off). A saved inspection is
   held on this phone and only sent to the NAS when the phone leaves the farm – more than 500 m from the
   farm location – or 2 hours after the start, whichever is first. The time it left and the time on site
   are recorded with the inspection. */
const SITE_RADIUS=500, SITE_MAX=2*3600*1000;
const hhmm=t=>{const d=new Date(t),p=n=>String(n).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}`};
const fmtDur=m=>m<60?`${m} min`:`${Math.floor(m/60)} h${m%60?` ${m%60} min`:''}`;
const farmLoc=()=>{const f=NAS.setting('farm',null);return f&&isFinite(f.lat)&&isFinite(f.lng)?f:null};
let browserGf=local.get('gf',null);   // browser stand-in for the Android service (testing)
let gfWatch=null;
function saveHeld(){ if(!local.set('held',held)){ heldMem=held; local.set('held',held.map(h=>({...h,photos:(h.photos||[]).map(p=>({...p,data:''}))}))) } }
function holdInspection(rec,photos,send){
  held.push({rec:{...rec,pending:true},photos:photos||[],send:!!send,queued:false}); saveHeld();
  loadFromNas(); renderHistory(); updateTotals();
}
const distM=(a,b)=>{const R=6371000,r=x=>x*Math.PI/180,dLa=r(b.lat-a.lat),dLo=r(b.lng-a.lng);const h=Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
async function gfStatus(){
  const B=NB();
  if(B&&B.geofenceStatus){try{return await B.geofenceStatus()}catch(e){}}
  return browserGf||{active:false,exitedAt:0,startedAt:0};
}
/* Start watching when an inspection begins */
async function startInspection(){
  if(form.startedAt)return;
  form.startedAt=Date.now(); showSite();
  let centre=farmLoc()||(geo?{lat:geo.lat,lng:geo.lng}:null);
  if(!centre&&navigator.geolocation){
    centre=await new Promise(res=>navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),()=>res(null),{enableHighAccuracy:true,timeout:15000,maximumAge:120000}));
  }
  if(!centre){showSite('No farm location yet, so leaving the farm can\'t be detected – the report will send 2 hours after the start. An admin can set the farm location in Settings → Farm setup.');return}
  const st=await gfStatus();
  // One watch covers every inspection on this phone until it leaves the farm
  if(st.active)return;
  const opts={lat:centre.lat,lng:centre.lng,radius:SITE_RADIUS,startedAt:form.startedAt,deadline:form.startedAt+SITE_MAX};
  const B=NB();
  if(B&&B.geofenceStart){try{await B.geofenceStart(opts);return}catch(e){console.error('geofence',e)}}
  // Browser: only works while the page is open
  browserGf={active:true,exitedAt:0,...opts}; local.set('gf',browserGf); watchBrowser();
}
function watchBrowser(){
  if(!browserGf||!browserGf.active||!navigator.geolocation||gfWatch!==null)return;
  gfWatch=navigator.geolocation.watchPosition(p=>{
    if(!browserGf||!browserGf.active||p.timestamp<browserGf.startedAt)return;   // ignore cached fixes from before the start
    const d=distM(browserGf,{lat:p.coords.latitude,lng:p.coords.longitude});
    browserGf.lastDist=d; browserGf.lastAt=Date.now();
    if(d-Math.min(p.coords.accuracy||0,100)>browserGf.radius){browserGf.exitedAt=Date.now();browserGf.active=false;navigator.geolocation.clearWatch(gfWatch);gfWatch=null}
    if(Date.now()>=browserGf.deadline)browserGf.active=false;
    local.set('gf',browserGf); checkHeld();
  },()=>{},{enableHighAccuracy:true,maximumAge:0});
}
watchBrowser();
async function stopWatch(){const B=NB(); if(B&&B.geofenceStop){try{await B.geofenceStop()}catch(e){}} if(browserGf){browserGf.active=false;local.set('gf',browserGf)} if(gfWatch!==null){navigator.geolocation.clearWatch(gfWatch);gfWatch=null}}
/* Send any held inspection whose phone has left the farm, or whose 2 hours are up */
let checking=false;
async function checkHeld(){
  if(checking||!held.length){showSite();return} checking=true;
  try{
    const st=await gfStatus(), now=Date.now();
    for(const item of held.slice()){
      const r=item.rec, exit=st.exitedAt&&st.exitedAt>=r.startedAt?st.exitedAt:0, limit=r.startedAt+SITE_MAX;
      let how=null,left=null;
      if(exit&&exit<=limit){how='left';left=exit}
      else if(now>=limit){how='2h';left=null}
      else if(item.force){how='early';left=now}
      if(!item.queued&&!item.force)continue;
      if(!item.queued)continue;   // saved but not swiped to send yet
      if(!how)continue;
      const rec={...r}; delete rec.pending;
      rec.leftAt=left; rec.siteEnd=how; rec.onSiteMins=Math.round(((left||limit)-rec.startedAt)/60000);
      const mem=heldMem&&heldMem.find(h=>h.rec.id===r.id);
      try{await sendInspection(rec,(mem||item).photos,item.send)}catch(e){console.error(e);continue}
      held=held.filter(h=>h.rec.id!==r.id); if(heldMem)heldMem=heldMem.filter(h=>h.rec.id!==r.id); saveHeld();
      toast(how==='left'?`Left the farm at ${hhmm(left)} – report sent (${fmtDur(rec.onSiteMins)} on site)`:how==='2h'?'2 hours since the start – report sent':'Report sent');
    }
    if(!held.length&&!form.startedAt)stopWatch();
    loadFromNas(); renderHistory();
  } finally {checking=false; showSite()}
}
async function showSite(msg){
  const el=$('site-out'); if(!el)return;
  if(msg){el.textContent=msg;el.hidden=false;return}
  const bits=[];
  if(form.startedAt)bits.push(`Inspection started at ${hhmm(form.startedAt)}.`);
  const q=held.filter(h=>h.queued), d=held.filter(h=>!h.queued);
  if(q.length)bits.push(`${q.length} report${q.length===1?'':'s'} waiting to send – when you leave the farm (${SITE_RADIUS} m) or at ${hhmm(Math.min(...q.map(h=>h.rec.startedAt))+SITE_MAX)}.`);
  if(d.length)bits.push(`${d.length} saved report${d.length===1?' has':'s have'} not been sent – tap here to send.`);
  el.textContent=bits.join(' '); el.hidden=!bits.length; el.classList.toggle('click',!!d.length);
}
['input','change'].forEach(ev=>$('view-inspect').addEventListener(ev,e=>{if(e.target.closest('#locs,#rodent,.geo'))startInspection()}));
$('locs').addEventListener('click',e=>{if(e.target.closest('[data-cam]'))startInspection()},true);
$('geo-btn').addEventListener('click',startInspection);
setInterval(checkHeld,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkHeld()});
checkHeld();

/* Text for reports: "On site 13:05–13:48 (43 min), left the farm" */
function siteText(h){
  if(!h||!h.startedAt)return '';
  const it=h.pending&&held.find(x=>x.rec.id===h.id);
  if(it&&!it.queued)return `Started ${hhmm(h.startedAt)} – saved on this phone, not sent`;
  if(h.pending)return `Started ${hhmm(h.startedAt)} – waiting to send (when the phone leaves the farm, or at ${hhmm(h.startedAt+SITE_MAX)})`;
  if(h.siteEnd==='2h')return `On site from ${hhmm(h.startedAt)} – still within ${SITE_RADIUS} m after 2 hours (${fmtDur(h.onSiteMins)}+)`;
  return `On site ${hhmm(h.startedAt)}–${hhmm(h.leftAt)} (${fmtDur(h.onSiteMins)})${h.siteEnd==='left'?', left the farm':', sent early by an admin'}`;
}

/* Farm location (centre of the 500 m area) in Farm setup */
function renderFarmLoc(){const f=farmLoc(); $('farm-loc-out').innerHTML=f?`${esc(f.lat.toFixed(6))}, ${esc(f.lng.toFixed(6))} · <a href="${mapsUrl(f)}" target="_blank" rel="noopener">Open in Google Maps</a>`:'<b style="color:var(--loss)">Not set</b> – leaving the farm can\'t be detected, so reports send 2 hours after the start.'}
$('farm-loc-btn').addEventListener('click',()=>{
  if(!isAdmin())return;
  if(!navigator.geolocation){toast('This device cannot share its location');return}
  $('farm-loc-out').textContent='Finding your location…';
  navigator.geolocation.getCurrentPosition(p=>{
    if(!confirm(`Set the farm location to where you are now (accurate to about ${Math.round(p.coords.accuracy)} m)? Stand in the middle of the farm.`)){renderFarmLoc();return}
    NAS.setSetting('farm',{lat:p.coords.latitude,lng:p.coords.longitude,radius:SITE_RADIUS}); renderFarmLoc(); toast('Farm location saved');
  },err=>{renderFarmLoc(); onGeoError(err)},{enableHighAccuracy:true,timeout:20000,maximumAge:0});
});
$('farm-loc-paste').addEventListener('change',e=>{
  if(!isAdmin())return; const g=parseLocation(e.target.value); if(!g){toast('Coordinates not recognised');return}
  NAS.setSetting('farm',{lat:g.lat,lng:g.lng,radius:SITE_RADIUS}); e.target.value=''; renderFarmLoc(); toast('Farm location saved');
});
renderFarmLoc(); NAS.onChange(renderFarmLoc);


/* ---------- Swipe to send ----------
   Save keeps the inspection on this phone. The box that opens has a slider: swiping it all the way
   across sends the report – to the NAS once the phone has left the farm or 2 hours have passed. */
let sheetId=null;
function openSendSheet(id){
  const it=held.find(x=>x.rec.id===id); if(!it)return;
  sheetId=id; const r=it.rec;
  const meds=r.totalMedicated||0, ph=(r.photos||[]).length;
  $('sheet-sum').textContent=`${fmtDate(r.date)} at ${r.time} · ${r.name} · ${r.totalDead||0} dead · ${meds} medicated${ph?` · ${ph} photo${ph===1?'':'s'}`:''}. It is saved on this phone.`;
  $('sheet-wa').checked=!!it.send;
  $('sheet-when').textContent=`After you swipe, it sends when you leave the farm, or at ${hhmm(r.startedAt+SITE_MAX)} at the latest.`;
  resetKnob(); $('send-sheet').hidden=false;
}
function closeSheet(){$('send-sheet').hidden=true; sheetId=null; showSite()}
function resetKnob(){const k=$('swipe-knob');k.style.transition='left .2s';k.style.left='4px';$('swipe').classList.remove('done');$('swipe').querySelector('.swipe-text').textContent='Swipe to send report'}
function confirmSend(){
  const it=held.find(x=>x.rec.id===sheetId); if(!it){closeSheet();return}
  it.queued=true; it.send=$('sheet-wa').checked; saveHeld();
  $('swipe').classList.add('done'); $('swipe').querySelector('.swipe-text').textContent='Sending ✓';
  setTimeout(()=>{closeSheet(); renderHistory(); toast(`Report will send when you leave the farm, or at ${hhmm(it.rec.startedAt+SITE_MAX)}`); checkHeld()},500);
}
(()=>{
  const knob=$('swipe-knob'), track=$('swipe'); let x0=null, max=0;
  knob.addEventListener('pointerdown',e=>{x0=e.clientX; max=track.clientWidth-knob.offsetWidth-8; knob.style.transition='none'; knob.setPointerCapture(e.pointerId)});
  knob.addEventListener('pointermove',e=>{if(x0===null)return; knob.style.left=(4+Math.max(0,Math.min(max,e.clientX-x0)))+'px'});
  const end=e=>{if(x0===null)return; const d=e.clientX-x0; x0=null; if(d>=max*0.85){knob.style.left=(4+max)+'px'; confirmSend()} else resetKnob()};
  knob.addEventListener('pointerup',end); knob.addEventListener('pointercancel',()=>{x0=null;resetKnob()});
  // Keyboard: Enter on the knob counts as a full swipe
  knob.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();knob.style.left=(track.clientWidth-knob.offsetWidth-4)+'px';confirmSend()}});
  knob.addEventListener('click',e=>e.preventDefault());
})();
$('sheet-later').addEventListener('click',()=>{closeSheet(); renderHistory(); toast('Saved on this phone – send it from History when ready')});
$('site-out').addEventListener('click',()=>{const d=held.filter(h=>!h.queued); if(d.length)openSendSheet(d[d.length-1].rec.id)});

/* ---------- App updates ----------
   Each phone checks GitHub Releases when the app opens (and every few hours). If there's a newer
   version it shows a banner; tapping it downloads the new APK and opens Android's installer.
   Everything saved on the phone (sign-in, unsent reports) is kept. */
const REPO='waynemcfarlane81/pig-inspection-app';
let appVer='', latest=null, lastCheck=0;
const verNum=v=>String(v||'').replace(/^v/,'').split('.').map(n=>+n||0);
const newer=(a,b)=>{const x=verNum(a),y=verNum(b);for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)}return false};
async function checkUpdate(manual){
  const B=NB(); if(!B||!B.appVersion){if(manual)toast('Updates are checked in the Android app');return}
  if(!manual&&Date.now()-lastCheck<3600e3)return; lastCheck=Date.now();
  try{
    if(!appVer){appVer=(await B.appVersion()).versionName||''; window.APP_VER=appVer; $('app-version').textContent=`Pig Inspection ${appVer}`}
    const r=await B.request({url:`https://api.github.com/repos/${REPO}/releases/latest`,method:'GET',headers:{Accept:'application/vnd.github+json','User-Agent':'PigInspection'}});
    if(r.status!==200)throw new Error('GitHub replied '+r.status);
    const rel=JSON.parse(r.body); const tag=rel.tag_name;
    const asset=(rel.assets||[]).find(a=>a.name==='PigInspection.apk');
    if(tag&&asset&&newer(tag,appVer)){latest={tag,url:asset.browser_download_url};
      const b=$('update-banner'); b.textContent=`Update available – Pig Inspection ${tag.replace(/^v/,'')}. Tap to install.`; b.hidden=false}
    else {latest=null; $('update-banner').hidden=true; if(manual)toast(`You have the latest version (${appVer})`)}
  }catch(e){if(manual)toast('Could not check for updates – check the phone has signal')}
}
async function installUpdate(){
  if(!latest)return;
  if(held.some(h=>!h.queued)&&!confirm('You have a saved report that has not been sent. It will be kept through the update. Update now?'))return;
  if(!confirm(`Install Pig Inspection ${latest.tag.replace(/^v/,'')} now? Android will ask you to tap Update.`))return;
  const b=$('update-banner'); b.textContent='Downloading the update…';
  try{
    const r=await NB().installUpdate({url:latest.url});
    if(r&&r.needsPermission){b.textContent='Allow "Install unknown apps" for Pig Inspection, come back, then tap here again.';return}
    b.textContent=`Tap Update on the Android screen to finish installing ${latest.tag.replace(/^v/,'')}.`;
  }catch(e){b.textContent='The update did not download. Tap to try again.'}
}
$('update-banner').addEventListener('click',installUpdate);
$('check-update').addEventListener('click',()=>checkUpdate(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdate(false)});
setInterval(()=>checkUpdate(false),6*3600e3);
setTimeout(()=>checkUpdate(false),3000);
