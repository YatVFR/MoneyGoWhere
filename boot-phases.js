// MoneyGoWhere DEV — feature-first startup coordinator.
// Phase 1: paint the shell with an empty DB.
// Phase 2: load heavy feature code while finance storage stays gated.
// Phase 3: hydrate the user's local finance DB last, then render once with real data.
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
function yieldBrowser(ms=0){return new Promise(resolve=>setTimeout(resolve,ms))}
function idle(timeout=500){return new Promise(resolve=>('requestIdleCallback'in window?requestIdleCallback(()=>resolve(),{timeout}):setTimeout(resolve,40)))}
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
async function hydrateData(){
  if(hydrated)return;hydrated=true;
  setPhase('data','Loading finance data');
  restoreStorage();
  try{
    const raw=originalGet.call(localStorage,DB_KEY),parsed=raw?JSON.parse(raw):{};
    const stable=window.MGWStability?.sanitize?window.MGWStability.sanitize(parsed):parsed;
    if(typeof emptyDB==='function')db=Object.assign(emptyDB(),stable||{});else db=stable||{};
    db.expenses=Array.isArray(db.expenses)?db.expenses:[];
    db.income=Array.isArray(db.income)?db.income:[];
    db.budgets=db.budgets&&typeof db.budgets==='object'?db.budgets:{monthly:0,categories:{}};
    db.budgets.categories=db.budgets.categories&&typeof db.budgets.categories==='object'?db.budgets.categories:{};
    db.settings=db.settings&&typeof db.settings==='object'?db.settings:{currency:'SGD'};
    window.db=db;state.dataReady=true;
    document.dispatchEvent(new CustomEvent('mgw:data-ready'));
    if(window.MGWStability?.requestRender)window.MGWStability.requestRender();else if(typeof renderAll==='function')renderAll();
  }catch(err){
    console.error('MoneyGoWhere data hydration failed',err);
    state.dataReady=true;
    document.dispatchEvent(new CustomEvent('mgw:data-ready',{detail:{error:String(err)}}));
  }
}
async function loadFeaturesFirst(){
  if(loadingFeatures)return;loadingFeatures=true;
  setPhase('features','Loading app features');
  const core=[
    './import-normalizer.js',
    './interaction-recovery.js',
    './version-badge-authority.js',
    './finance-fix.js',
    './payment-form-core.js',
    './cards-wallets.js',
    './wallet-visibility-fix.js'
  ];
  for(const src of core){await loadScript(src);await yieldBrowser(0)}
  await idle(500);
  await loadScript('./historical-data.js');
  if(window.MGWRuntimeFeaturesReady&&typeof window.MGWRuntimeFeaturesReady.then==='function'){
    try{await window.MGWRuntimeFeaturesReady}catch(err){console.error('MoneyGoWhere runtime feature loading failed',err)}
  }else{
    // Older runtime compatibility: give asynchronously loaded feature modules a short chance to settle.
    let tries=0;
    while(window.MGWRuntimeHealth&&!window.MGWRuntimeHealth.ready&&tries++<120)await yieldBrowser(25);
  }
  await loadScript('./apple-pay-queue-bridge.js');
  state.featuresReady=true;
  document.dispatchEvent(new CustomEvent('mgw:features-ready'));
}
async function boot(){
  setPhase('ui','Interface ready');
  const status=document.querySelector('#updateStatus'),sub=document.querySelector('#updateSub');
  if(status)status.textContent='Ready';if(sub)sub.textContent='Loading features…';
  await nextPaint();
  await loadFeaturesFirst();
  if(sub)sub.textContent='Loading data…';
  await hydrateData();
  setPhase('ready','Ready');
  document.dispatchEvent(new CustomEvent('mgw:app-ready'));
  if(sub)sub.textContent=`v${RELEASE} loaded`;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(err=>{console.error('MoneyGoWhere boot failed',err);restoreStorage()}),{once:true});else boot().catch(err=>{console.error('MoneyGoWhere boot failed',err);restoreStorage()});
window.addEventListener('pagehide',restoreStorage,{once:true});
})();
