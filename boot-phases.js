// MoneyGoWhere DEV — phased startup coordinator.
// Phase 1: render the base UI with an empty DB. Phase 2: hydrate local data after first paint.
// Phase 3: load feature modules progressively.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const DB_KEY='moneygowhere-db-v1';
const originalGet=Storage.prototype.getItem;
let gated=true,hydrated=false,loadingFeatures=false;
const state={release:RELEASE,phase:'ui',dataReady:false,featuresReady:false,loaded:[],failed:[]};
window.MGWBootState=state;

Storage.prototype.getItem=function(key){
  if(gated&&this===localStorage&&key===DB_KEY)return null;
  return originalGet.call(this,key);
};

function setPhase(phase,detail=''){
  state.phase=phase;state.detail=detail;
  document.documentElement.dataset.mgwBootPhase=phase;
  document.dispatchEvent(new CustomEvent('mgw:boot-phase',{detail:{phase,detail}}));
}
function restoreStorage(){if(!gated)return;gated=false;Storage.prototype.getItem=originalGet}
function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
function loadScript(src){return new Promise(resolve=>{
  const existing=document.querySelector(`script[data-mgw-boot-src="${src}"]`);
  if(existing)return resolve(true);
  const s=document.createElement('script');
  s.src=`${src}${src.includes('?')?'&':'?'}v=${encodeURIComponent(RELEASE)}`;
  s.async=false;s.dataset.mgwBootSrc=src;
  s.onload=()=>{state.loaded.push(src);resolve(true)};
  s.onerror=()=>{state.failed.push(src);console.error('MoneyGoWhere phased module failed:',src);resolve(false)};
  document.head.appendChild(s);
})}
async function hydrate(){
  if(hydrated)return;hydrated=true;
  await nextPaint();
  setPhase('data','Loading finance data');
  restoreStorage();
  try{
    const raw=originalGet.call(localStorage,DB_KEY),parsed=raw?JSON.parse(raw):{};
    if(typeof emptyDB==='function')db=Object.assign(emptyDB(),parsed||{});else db=parsed||{};
    db.expenses=Array.isArray(db.expenses)?db.expenses:[];
    db.income=Array.isArray(db.income)?db.income:[];
    db.budgets=db.budgets&&typeof db.budgets==='object'?db.budgets:{monthly:0,categories:{}};
    db.budgets.categories=db.budgets.categories&&typeof db.budgets.categories==='object'?db.budgets.categories:{};
    db.settings=db.settings&&typeof db.settings==='object'?db.settings:{currency:'SGD'};
    window.db=db;state.dataReady=true;
    if(typeof renderAll==='function')renderAll();
    document.dispatchEvent(new CustomEvent('mgw:data-ready'));
  }catch(err){console.error('MoneyGoWhere data hydration failed',err);state.dataReady=true;document.dispatchEvent(new CustomEvent('mgw:data-ready',{detail:{error:String(err)}}))}
  await loadFeatures();
}
async function loadFeatures(){
  if(loadingFeatures)return;loadingFeatures=true;setPhase('features','Loading app features');
  const core=[
    './import-normalizer.js',
    './interaction-recovery.js',
    './version-badge-authority.js',
    './finance-fix.js',
    './payment-form-core.js',
    './cards-wallets.js'
  ];
  for(const src of core)await loadScript(src);
  if(typeof renderAll==='function')renderAll();
  await new Promise(resolve=>('requestIdleCallback'in window?requestIdleCallback(()=>resolve(),{timeout:600}):setTimeout(resolve,80)));
  await loadScript('./historical-data.js');
  await loadScript('./apple-pay-queue-bridge.js');
  state.featuresReady=true;setPhase('ready','Ready');
  document.dispatchEvent(new CustomEvent('mgw:app-ready'));
}

function boot(){
  setPhase('ui','Interface ready');
  const status=document.querySelector('#updateStatus'),sub=document.querySelector('#updateSub');
  if(status)status.textContent='Ready';if(sub)sub.textContent='Loading data…';
  hydrate().finally(()=>{const s=document.querySelector('#updateSub');if(s&&state.phase==='ready')s.textContent=`v${RELEASE} loaded`});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pagehide',restoreStorage,{once:true});
})();