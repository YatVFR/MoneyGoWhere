// MoneyGoWhere interaction recovery guard.
// Keeps core controls usable even when feature modules replace DOM nodes or leave blocking residue.
(()=>{
'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const safeCall=(label,fn)=>{try{return fn()}catch(err){console.error(`MoneyGoWhere ${label} recovery failed`,err)}};

async function isolateServiceWorkerScope(){
  if(!('serviceWorker' in navigator))return false;
  const path=location.pathname;
  const env=path.includes('/dev/')?'dev':path.includes('/uat/')?'uat':'prod';
  if(env==='prod')return false;

  const expectedPath=new URL('./',location.href).pathname;
  const projectRoot=expectedPath.replace(/(?:dev|uat)\/$/,'');
  let removedAncestor=false;

  try{
    const registrations=await navigator.serviceWorker.getRegistrations();
    for(const registration of registrations){
      const scopePath=new URL(registration.scope).pathname;
      const isProjectScope=scopePath.startsWith(projectRoot);
      const isAncestor=expectedPath.startsWith(scopePath);
      if(isProjectScope&&isAncestor&&scopePath!==expectedPath){
        const removed=await registration.unregister();
        removedAncestor=removedAncestor||removed;
        if(removed)console.info('MoneyGoWhere removed conflicting ancestor service worker:',scopePath);
      }
    }
  }catch(err){
    console.warn('MoneyGoWhere service worker isolation check failed',err);
  }

  if(removedAncestor){
    const key=`mgw-sw-scope-isolated:${env}`;
    if(sessionStorage.getItem(key)!=='1'){
      sessionStorage.setItem(key,'1');
      const url=new URL(location.href);
      url.searchParams.set('mgw-sw-reset',Date.now().toString());
      location.replace(url.href);
      return true;
    }
  }
  return false;
}

function removeBlockingResidue(){
  // Startup/onboarding helpers must never be able to trap the whole app.
  ['#mgwOnboarding','.mgw-ob','.mgw-walk-mask','.mgw-walk-bubble'].forEach(sel=>{
    $$(sel).forEach(el=>el.remove());
  });
  const modal=$('#modal');
  if(modal?.open&&!modal.dataset.mgwIntentionalOpen){
    try{modal.close()}catch{}
  }
  document.documentElement.style.pointerEvents='';
  document.body.style.pointerEvents='';
  document.body.classList.remove('modal-open','no-scroll','locked');
  $$('button,[role="button"],.settings-button').forEach(el=>{
    if(el.dataset.mgwKeepDisabled!=='1')el.disabled=false;
    if(el.style.pointerEvents==='none')el.style.pointerEvents='';
  });
}

function coreNav(name){
  if(typeof window.nav==='function')return window.nav(name);
  $$('.view').forEach(x=>x.classList.remove('active'));
  $(`#view-${name}`)?.classList.add('active');
  $$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===name));
  const title=$('#pageTitle');
  if(title)title.textContent={dashboard:'Dashboard',add:'Add',insights:'Insights',settings:'Settings'}[name]||name;
}

function fallbackMonth(delta){
  if(typeof MGW==='undefined'||typeof monthShift!=='function'||typeof renderAll!=='function')return;
  MGW.state.month=monthShift(MGW.state.month,delta);
  renderAll();
}

function fallbackRange(button){
  if(typeof MGW==='undefined'||typeof renderInsights!=='function')return;
  $$('#insightRange button').forEach(x=>x.classList.remove('active'));
  button.classList.add('active');
  MGW.state.range=Number(button.dataset.range)||1;
  renderInsights();
}

function fallbackRefresh(button){
  const status=$('#updateStatus');
  const before=`${status?.textContent||''}|${button.getAttribute('aria-busy')||''}`;
  setTimeout(async()=>{
    const after=`${status?.textContent||''}|${button.getAttribute('aria-busy')||''}`;
    if(before!==after)return;
    try{
      if(!('serviceWorker' in navigator))return location.reload();
      const reg=await navigator.serviceWorker.getRegistration();
      if(reg?.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});return}
      if(reg)await reg.update();
      if(status)status.textContent='Latest';
      const sub=$('#updateSub');if(sub)sub.textContent=`v${RELEASE} checked`;
    }catch(err){console.warn('MoneyGoWhere refresh recovery failed',err);location.reload()}
  },160);
}

function installDelegatedRecovery(){
  if(document.documentElement.dataset.mgwInteractionRecovery==='1')return;
  document.documentElement.dataset.mgwInteractionRecovery='1';

  document.addEventListener('click',e=>{
    const target=e.target.closest('button,[data-nav],[data-open],#closeModal,.settings-button');
    if(!target)return;

    // Navigation can be lost if another module replaces the button node.
    if(target.matches('[data-nav]')){
      const name=target.dataset.nav;
      queueMicrotask(()=>{if(!$(`#view-${name}`)?.classList.contains('active'))coreNav(name)});
      return;
    }

    // Modal launchers are recovered after existing handlers get first chance.
    if(target.matches('[data-open]')){
      const type=target.dataset.open;
      queueMicrotask(()=>{
        const modal=$('#modal');
        if(!modal?.open&&typeof window.openModal==='function')safeCall('modal open',()=>window.openModal(type));
      });
      return;
    }

    if(target.id==='closeModal'){
      queueMicrotask(()=>{try{$('#modal')?.close()}catch{}});
      return;
    }

    if(target.id==='prevMonth' || target.id==='nextMonth'){
      if(typeof target.onclick!=='function')safeCall('month switch',()=>fallbackMonth(target.id==='prevMonth'?-1:1));
      return;
    }

    if(target.matches('#insightRange button')){
      if(typeof target.onclick!=='function')safeCall('insight range',()=>fallbackRange(target));
      return;
    }

    if(target.id==='exportBtn'&&typeof target.onclick!=='function'&&typeof window.exportData==='function')return safeCall('export',()=>window.exportData());
    if(target.id==='integrityBtn'&&typeof target.onclick!=='function'&&typeof window.integrity==='function')return safeCall('integrity',()=>window.integrity());
    if(target.id==='alertBtn'&&typeof target.onclick!=='function'&&typeof window.toast==='function')return safeCall('alert',()=>window.toast($('#budgetAlertText')?.textContent||'No active alert'));
    if(target.id==='resetBtn'&&typeof target.onclick!=='function'){
      if(typeof window.emptyDB==='function'&&typeof window.save==='function'&&confirm('Delete all MoneyGoWhere data on this device?')){
        safeCall('reset',()=>{db=window.emptyDB();window.db=db;window.save();window.toast?.('Local data reset')});
      }
      return;
    }
    if(target.id==='refreshBtn')fallbackRefresh(target);
  },true);
}

function markIntentionalModal(){
  const modal=$('#modal');
  if(!modal||modal.dataset.mgwRecoveryObserved==='1')return;
  modal.dataset.mgwRecoveryObserved='1';
  if(!window.MutationObserver)return;
  new MutationObserver(()=>{
    if(modal.open)modal.dataset.mgwIntentionalOpen='1';
    else delete modal.dataset.mgwIntentionalOpen;
  }).observe(modal,{attributes:true,attributeFilter:['open']});
}

function observeDomRecovery(){
  if(!window.MutationObserver||document.documentElement.dataset.mgwInteractionObserver==='1')return;
  document.documentElement.dataset.mgwInteractionObserver='1';
  let queued=false;
  new MutationObserver(()=>{
    if(queued)return;queued=true;
    queueMicrotask(()=>{queued=false;removeBlockingResidue()});
  }).observe(document.body,{childList:true,subtree:true});
}

async function boot(){
  if(await isolateServiceWorkerScope())return;
  removeBlockingResidue();
  installDelegatedRecovery();
  markIntentionalModal();
  observeDomRecovery();
  window.addEventListener('pageshow',removeBlockingResidue);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)removeBlockingResidue()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWInteractionRecovery={version:RELEASE,reset:removeBlockingResidue,isolateServiceWorkerScope};
})();
