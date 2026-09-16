// MoneyGoWhere interaction recovery guard.
// Keeps core navigation usable even if an optional feature leaves an overlay or handler behind.
(()=>{
'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

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
}

function coreNav(name){
  if(typeof window.nav==='function')return window.nav(name);
  $$('.view').forEach(x=>x.classList.remove('active'));
  $(`#view-${name}`)?.classList.add('active');
  $$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===name));
  const title=$('#pageTitle');
  if(title)title.textContent={dashboard:'Dashboard',add:'Add',insights:'Insights',settings:'Settings'}[name]||name;
}

function installDelegatedRecovery(){
  if(document.documentElement.dataset.mgwInteractionRecovery==='1')return;
  document.documentElement.dataset.mgwInteractionRecovery='1';
  document.addEventListener('click',e=>{
    const target=e.target.closest('button,[data-nav],[data-open],#closeModal');
    if(!target)return;

    // Let existing handlers run first. Fallback only when state did not change.
    if(target.matches('[data-nav]')){
      const name=target.dataset.nav;
      queueMicrotask(()=>{
        if(!$(`#view-${name}`)?.classList.contains('active'))coreNav(name);
      });
      return;
    }

    if(target.matches('[data-open]')){
      const type=target.dataset.open;
      queueMicrotask(()=>{
        const modal=$('#modal');
        if(!modal?.open&&typeof window.openModal==='function'){
          try{window.openModal(type)}catch(err){console.error('MoneyGoWhere fallback modal open failed',err)}
        }
      });
      return;
    }

    if(target.id==='closeModal'){
      queueMicrotask(()=>{try{$('#modal')?.close()}catch{}});
    }
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

function boot(){
  removeBlockingResidue();
  installDelegatedRecovery();
  markIntentionalModal();
  window.addEventListener('pageshow',removeBlockingResidue);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)removeBlockingResidue()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWInteractionRecovery={version:RELEASE,reset:removeBlockingResidue};
})();
