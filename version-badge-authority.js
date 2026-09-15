// MoneyGoWhere DEV — single authoritative visible build badge
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.46',TEXT=`v${RELEASE} · DEV`;
  function apply(){
    const header=document.querySelector('.topbar > div:first-child');if(!header)return;
    document.querySelector('#appVersionBadge')?.remove();
    let badge=document.querySelector('#mgwRuntimeVersionBadge');
    if(!badge){badge=document.createElement('span');badge.id='mgwRuntimeVersionBadge';badge.className='app-version-badge';header.appendChild(badge)}
    if(badge.textContent!==TEXT)badge.textContent=TEXT;
    badge.title=`Development · App ${RELEASE} · manual payment dropdown sources`;
  }
  function observe(){apply();const target=document.querySelector('.topbar')||document.body;if(target)new MutationObserver(()=>queueMicrotask(apply)).observe(target,{subtree:true,childList:true,characterData:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  window.MGWVisibleRelease=RELEASE;
})();
