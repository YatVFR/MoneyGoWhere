// MoneyGoWhere DEV — single authoritative visible build badge
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.30';
  const TEXT=`v${RELEASE} · DEV`;
  function apply(){const header=document.querySelector('.topbar > div:first-child');if(!header)return;const legacy=document.querySelector('#appVersionBadge');if(legacy)legacy.remove();let badge=document.querySelector('#mgwRuntimeVersionBadge');if(!badge){badge=document.createElement('span');badge.id='mgwRuntimeVersionBadge';badge.className='app-version-badge';header.appendChild(badge)}if(badge.textContent!==TEXT)badge.textContent=TEXT;badge.title=`Development · App ${RELEASE} · authoritative DEV badge`}
  function observe(){apply();const target=document.querySelector('.topbar')||document.body;if(!target)return;new MutationObserver(()=>queueMicrotask(apply)).observe(target,{subtree:true,childList:true,characterData:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  window.MGWVisibleRelease=RELEASE;
})();