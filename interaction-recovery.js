// MoneyGoWhere interaction recovery guard.
// Keeps core controls usable without continuously scanning/mutating the DOM.
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
  }catch(err){console.warn('MoneyGoWhere service worker isolation check failed',err)}
  if(removedAncestor){
    const key=`mgw-sw-scope-isolated:${env}`;
    if(sessionStorage.getItem(key)!=='1'){
      sessionStorage.setItem(key,'1');
      const url=new URL(location.href);url.searchParams.set('mgw-sw-reset',Date.now().toString());location.replace(url.href);return true;
    }
  }
  return false;
}

function removeBlockingResidue(){
  // Do not walk/re-enable every button. Large restored databases cause many DOM
  // mutations and Safari can become CPU-bound if recovery touches the full tree.
  document.documentElement.style.pointerEvents='';
  document.body.style.pointerEvents='';
  if(!$('#modal')?.open)document.body.classList.remove('modal-open','no-scroll','locked');
}
function removeLegacyStartupOverlays(){
  ['#mgwOnboarding','.mgw-ob','.mgw-walk-mask','.mgw-walk-bubble'].forEach(sel=>{$$(sel).forEach(el=>el.remove())});
  removeBlockingResidue();
}
function coreNav(name){
  if(typeof window.nav==='function')return window.nav(name);
  $$('.view').forEach(x=>x.classList.remove('active'));$(`#view-${name}`)?.classList.add('active');
  $$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===name));
  const title=$('#pageTitle');if(title)title.textContent={dashboard:'Dashboard',add:'Add',insights:'Insights',settings:'Settings'}[name]||name;
}
function fallbackMonth(delta){if(typeof MGW==='undefined'||typeof monthShift!=='function'||typeof renderAll!=='function')return;MGW.state.month=monthShift(MGW.state.month,delta);renderAll()}
function fallbackRange(button){if(typeof MGW==='undefined'||typeof renderInsights!=='function')return;$$('#insightRange button').forEach(x=>x.classList.remove('active'));button.classList.add('active');MGW.state.range=Number(button.dataset.range)||1;renderInsights()}
function fallbackRefresh(button){
  const status=$('#updateStatus');const before=`${status?.textContent||''}|${button.getAttribute('aria-busy')||''}`;
  setTimeout(async()=>{const after=`${status?.textContent||''}|${button.getAttribute('aria-busy')||''}`;if(before!==after)return;try{if(!('serviceWorker'in navigator))return location.reload();const reg=await navigator.serviceWorker.getRegistration();if(reg?.waiting){reg.waiting.postMessage({type:'SKIP_WAITING'});return}if(reg)await reg.update();if(status)status.textContent='Latest';const sub=$('#updateSub');if(sub)sub.textContent=`v${RELEASE} checked`}catch(err){console.warn('MoneyGoWhere refresh recovery failed',err);location.reload()}},160);
}
function installDelegatedRecovery(){
  if(document.documentElement.dataset.mgwInteractionRecovery==='2')return;
  document.documentElement.dataset.mgwInteractionRecovery='2';
  // One capture listener owns navigation. Do not wait for a second handler,
  // microtask or post-click verification before changing views.
  document.addEventListener('click',e=>{
    const target=e.target.closest('[data-nav],[data-open],#closeModal,#prevMonth,#nextMonth,#insightRange button,#exportBtn,#integrityBtn,#alertBtn,#refreshBtn');
    if(!target)return;
    if(target.matches('[data-nav]')){
      const name=target.dataset.nav;
      e.preventDefault();
      const view=$(`#view-${name}`);
      if(!view)return;
      $$('.view').forEach(x=>x.classList.toggle('active',x===view));
      $$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===name));
      const title=$('#pageTitle');if(title)title.textContent={dashboard:'Dashboard',add:'Add',insights:'Insights',settings:'Settings'}[name]||name;
      if(name==='insights'&&typeof renderInsights==='function')requestAnimationFrame(()=>safeCall('insights render',()=>renderInsights()));
      return;
    }
    if(target.matches('[data-open]')){
      const type=target.dataset.open;
      if(typeof target.onclick!=='function'&&typeof openModal==='function'){e.preventDefault();safeCall('modal open',()=>openModal(type))}
      return;
    }
    if(target.id==='closeModal'){if(!target.onclick){e.preventDefault();try{$('#modal')?.close()}catch{}}return}
    if(target.id==='prevMonth'||target.id==='nextMonth'){if(typeof target.onclick!=='function'){e.preventDefault();safeCall('month switch',()=>fallbackMonth(target.id==='prevMonth'?-1:1))}return}
    if(target.matches('#insightRange button')){if(typeof target.onclick!=='function'){e.preventDefault();safeCall('insight range',()=>fallbackRange(target))}return}
    if(target.id==='exportBtn'&&typeof target.onclick!=='function'&&typeof exportData==='function')return safeCall('export',()=>exportData());
    if(target.id==='integrityBtn'&&typeof target.onclick!=='function'&&typeof integrity==='function')return safeCall('integrity',()=>integrity());
    if(target.id==='alertBtn'&&typeof target.onclick!=='function'&&typeof toast==='function')return safeCall('alert',()=>toast($('#budgetAlertText')?.textContent||'No active alert'));
    if(target.id==='refreshBtn')fallbackRefresh(target);
  },true);
}
async function boot(){
  if(await isolateServiceWorkerScope())return;
  removeLegacyStartupOverlays();
  installDelegatedRecovery();
  // pageshow is enough to recover from Safari BFCache without observing every
  // render. This deliberately avoids a subtree MutationObserver.
  window.addEventListener('pageshow',removeBlockingResidue);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWInteractionRecovery={version:RELEASE,reset:removeBlockingResidue,isolateServiceWorkerScope};
})();
