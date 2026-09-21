// MoneyGoWhere DEV — feature-first startup coordinator.
// Phase 1: paint the shell with an empty DB.
// Phase 2: load heavy feature code while finance storage stays gated.
// Phase 3: hydrate the user's local finance DB last, then render once with real data.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const DB_KEY='moneygowhere-db-v1';
const originalGet=Storage.prototype.getItem;
const originalSet=Storage.prototype.setItem;
let gated=true,hydrated=false,loadingFeatures=false;
const state={release:RELEASE,phase:'ui',dataReady:false,featuresReady:false,deferredReady:false,loaded:[],failed:[],timings:{started:performance.now()}};
window.MGWBootState=state;
const MGW_LOADING_TIPS=[
  'Review small daily expenses—they add up quickly.',
  'Pending imports let you verify transactions before they enter your records.',
  'Your MoneyGoWhere finance data stays on this device.',
  'A quick monthly review can reveal subscriptions you no longer use.'
];
let mgwTipTimer=0;
function startLoadingTips(){
  const el=document.querySelector('#mgwLoadingTip span');if(!el||mgwTipTimer)return;
  let n=0;mgwTipTimer=setInterval(()=>{n=(n+1)%MGW_LOADING_TIPS.length;el.animate?.([{opacity:.25},{opacity:1}],{duration:220});el.textContent='Quick tip: '+MGW_LOADING_TIPS[n]},2600);
}
function stopLoadingTips(){if(mgwTipTimer){clearInterval(mgwTipTimer);mgwTipTimer=0}}

// DEV-only, data-free startup diagnostics. No finance values are captured.
const perf=window.MGWPerf=window.MGWPerf||{release:RELEASE,marks:{},longTasks:[],modules:[]};
const perfMark=name=>{perf.marks[name]=Math.round(performance.now()-state.timings.started)};
try{if('PerformanceObserver'in window){const o=new PerformanceObserver(list=>{for(const e of list.getEntries())perf.longTasks.push({start:Math.round(e.startTime),duration:Math.round(e.duration)});if(perf.longTasks.length>40)perf.longTasks.splice(0,perf.longTasks.length-40)});o.observe({type:'longtask',buffered:true})}}catch{}
window.MGWPerformanceReport=()=>({release:RELEASE,phase:state.phase,marks:{...perf.marks},bootTimings:{...state.timings},modules:perf.modules.slice(),longTasks:perf.longTasks.slice(),longTaskCount:perf.longTasks.length,maxLongTaskMs:perf.longTasks.reduce((m,x)=>Math.max(m,x.duration||0),0)});

const markUserBusy=()=>{state.userBusyUntil=performance.now()+1800};
['pointerdown','keydown','input','change'].forEach(type=>document.addEventListener(type,markUserBusy,{capture:true,passive:type==='pointerdown'}));
window.MGWIsInteractionBusy=()=>Boolean(document.querySelector('dialog[open]'))||performance.now()<(state.userBusyUntil||0);

Storage.prototype.getItem=function(key){
  if(gated&&this===localStorage&&key===DB_KEY)return null;
  return originalGet.call(this,key);
};
Storage.prototype.setItem=function(key,value){
  if(gated&&this===localStorage&&key===DB_KEY){
    console.warn('MoneyGoWhere blocked a database write before data hydration');
    return;
  }
  return originalSet.call(this,key,value);
};

function updateLoadingScreen(phase,detail=''){
  const screen=document.querySelector('#mgwLoadingScreen'),message=document.querySelector('#mgwLoadingMessage'),stage=document.querySelector('#mgwLoadingStage'),percent=document.querySelector('#mgwLoadingPercent'),bar=document.querySelector('#mgwLoadingProgress');
  if(!screen)return;
  if(phase!=='ready'){screen.hidden=false;screen.classList.remove('is-ready');startLoadingTips()}
  const d=String(detail||'').toLowerCase();
  let step='ui',pct=8,label='Starting';
  if(phase==='features'){step=d.includes('finishing')?'features':'accounts';pct=d.includes('finishing')?82:34;label=d.includes('finishing')?'Finalizing':'Accounts'}
  if(phase==='data'){step=d.includes('render')||d.includes('final')?'dashboard':'data';pct=d.includes('final')?94:(d.includes('render')?68:48);label=d.includes('final')?'Finalizing':(d.includes('render')?'Dashboard':'Finance data')}
  if(phase==='ready'){step='features';pct=100;label='Ready'}
  const order=['ui','data','accounts','dashboard','features'],active=order.indexOf(step);
  document.querySelectorAll('.mgw-loader-step').forEach((el,n)=>{el.classList.toggle('is-done',n<active||phase==='ready');el.classList.toggle('is-active',n===active&&phase!=='ready')});
  const copy={ui:'Initializing MoneyGoWhere…',features:'Setting up app features…',data:'Loading your finance data…',ready:'Ready',error:'Could not finish loading'};
  if(message)message.textContent=detail||copy[phase]||'Working…';
  if(stage)stage.textContent=label;if(percent)percent.textContent=pct+'%';if(bar)bar.style.width=pct+'%';
  if(phase==='ready'){stopLoadingTips();screen.classList.add('is-ready');setTimeout(()=>screen.hidden=true,260)}
  if(phase==='error')screen.classList.remove('is-ready');
}
function setPhase(phase,detail=''){
  state.phase=phase;state.detail=detail;
  state.timings[phase]=performance.now()-state.timings.started;
  document.documentElement.dataset.mgwBootPhase=phase;
  updateLoadingScreen(phase,detail);
  document.dispatchEvent(new CustomEvent('mgw:boot-phase',{detail:{phase,detail}}));
}
function restoreStorage(){if(!gated)return;gated=false;Storage.prototype.getItem=originalGet;Storage.prototype.setItem=originalSet}
function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
function yieldBrowser(ms=0){return new Promise(resolve=>setTimeout(resolve,ms))}
function idle(timeout=500){return new Promise(resolve=>('requestIdleCallback'in window?requestIdleCallback(()=>resolve(),{timeout}):setTimeout(resolve,40)))}
function preloadScripts(list){for(const src of list){const href=`${src}${src.includes('?')?'&':'?'}v=${encodeURIComponent(RELEASE)}`;if(document.querySelector(`link[data-mgw-boot-preload="${href}"]`))continue;const link=document.createElement('link');link.rel='preload';link.as='script';link.href=href;link.dataset.mgwBootPreload=href;document.head.appendChild(link)}}
function loadScript(src){return new Promise(resolve=>{
  const existing=document.querySelector(`script[data-mgw-boot-src="${src}"]`);
  if(existing)return resolve(true);
  const started=performance.now(),s=document.createElement('script');
  s.src=`${src}${src.includes('?')?'&':'?'}v=${encodeURIComponent(RELEASE)}`;
  s.async=false;s.dataset.mgwBootSrc=src;
  s.onload=()=>{state.loaded.push(src);perf.modules.push({src,ms:Math.round(performance.now()-started),ok:true});resolve(true)};
  s.onerror=()=>{state.failed.push(src);perf.modules.push({src,ms:Math.round(performance.now()-started),ok:false});console.error('MoneyGoWhere phased module failed:',src);resolve(false)};
  document.head.appendChild(s);
})}
async function hydrateData(){
  if(hydrated)return;hydrated=true;perfMark('dataStart');
  setPhase('data','Loading your finance data…');
  restoreStorage();
  try{
    const raw=originalGet.call(localStorage,DB_KEY),parsed=raw?JSON.parse(raw):{};
    const migration=window.MGWDatabaseSchema?.migrate?window.MGWDatabaseSchema.migrate(parsed,{persist:false,createSnapshot:true}):{database:parsed,migrated:false};
    const stable=window.MGWStability?.sanitize?window.MGWStability.sanitize(migration.database):migration.database;
    if(typeof emptyDB==='function')db=Object.assign(emptyDB(),stable||{});else db=stable||{};
    if(window.MGWDatabaseSchema?.shape)db=window.MGWDatabaseSchema.shape(db);
    if(window.MGWAccountRegistry?.sync){
      try{
        const accountResult=window.MGWAccountRegistry.sync(db,{persist:false});
        state.accountRegistry={accounts:accountResult.accounts,linked:accountResult.linked};
      }catch(accountErr){console.error('MoneyGoWhere account registry hydration failed',accountErr)}
    }
    if(window.MGWRecurringEngine?.sync){
      try{
        const recurringResult=window.MGWRecurringEngine.sync(db,{persist:false});
        state.recurringRegistry=recurringResult;
      }catch(recurringErr){console.error('MoneyGoWhere recurring registry hydration failed',recurringErr)}
    }
    if(window.MGWTransactionEngine?.sync){
      try{
        const txResult=window.MGWTransactionEngine.sync(db,{persist:false});
        state.transactionModel=txResult;
      }catch(txErr){console.error('MoneyGoWhere transaction model hydration failed',txErr)}
    }
    if(migration.migrated){
      try{originalSet.call(localStorage,DB_KEY,JSON.stringify(db))}catch(writeErr){console.error('MoneyGoWhere migrated database could not be persisted',writeErr)}
      state.migration={fromSchema:migration.fromSchema,toSchema:migration.toSchema,snapshotCreated:migration.snapshotCreated};
      document.dispatchEvent(new CustomEvent('mgw:schema-migrated',{detail:state.migration}));
    }
    db.expenses=Array.isArray(db.expenses)?db.expenses:[];
    db.income=Array.isArray(db.income)?db.income:[];
    db.budgets=db.budgets&&typeof db.budgets==='object'?db.budgets:{monthly:0,categories:{}};
    db.budgets.categories=db.budgets.categories&&typeof db.budgets.categories==='object'?db.budgets.categories:{};
    db.settings=db.settings&&typeof db.settings==='object'?db.settings:{currency:'SGD'};
    window.db=db;state.dataReady=true;perfMark('dataReady');
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
  setPhase('features','Loading app features…');
  const core=[
    './import-normalizer.js',
    './interaction-recovery.js',
    './version-badge-authority.js',
    './finance-fix.js',
    './payment-form-core.js',
    './account-registry.js',
    './recurring-engine.js',
    './transaction-engine.js',
    './cards-wallets.js',
    './wallet-visibility-fix.js'
  ];
  preloadScripts(core);
  for(const src of core){await loadScript(src);await yieldBrowser(0)}
  await idle(120);
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
  setPhase('ui','Preparing interface…');
  const status=document.querySelector('#updateStatus'),sub=document.querySelector('#updateSub');
  if(status)status.textContent='Ready';if(sub)sub.textContent='Loading features…';
  await nextPaint();
  await loadFeaturesFirst();
  if(sub)sub.textContent='Loading data…';
  await hydrateData();
  setPhase('data','Rendering your dashboard…');
  await nextPaint();
  await nextPaint();
  perfMark('firstStableRender');
  // The launch gate covers only the essential, user-visible dashboard.
  // Optional modules must never block first use of the app.
  setPhase('features','Finalizing essential features…');
  setPhase('data','Finalizing dashboard…');
  if(window.MGWStability?.requestRender)window.MGWStability.requestRender();else if(typeof renderAll==='function')renderAll();
  await nextPaint();
  await nextPaint();
  perfMark('finalStableRender');
  setPhase('ready','Ready');perfMark('appReady');
  document.dispatchEvent(new CustomEvent('mgw:app-ready'));
  if(sub)sub.textContent=`v${RELEASE} loaded`;
  console.info('MoneyGoWhere startup timings',JSON.parse(JSON.stringify(state.timings)));
  // Stability mode: do not auto-load optional feature modules after launch.
  // They previously rewired render/navigation handlers while the user was
  // interacting, which caused Safari stalls and unresponsive menus.
  state.deferredReady=false;
  state.timings.deferred='on-demand';

}
const bootFailed=err=>{console.error('MoneyGoWhere boot failed',err);restoreStorage();setPhase('error','Please refresh MoneyGoWhere to try again.')};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>boot().catch(bootFailed),{once:true});else boot().catch(bootFailed);
window.addEventListener('pagehide',restoreStorage,{once:true});
})();
