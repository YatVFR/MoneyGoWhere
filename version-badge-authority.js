// MoneyGoWhere DEV — single authoritative visible build badge.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.56',TEXT=`v${RELEASE} · DEV`;
  function apply(){
    const header=document.querySelector('.topbar > div:first-child');if(!header)return;
    document.querySelector('#appVersionBadge')?.remove();
    let badge=document.querySelector('#mgwRuntimeVersionBadge');
    if(!badge){badge=document.createElement('span');badge.id='mgwRuntimeVersionBadge';badge.className='app-version-badge';header.appendChild(badge)}
    badge.textContent=TEXT;
    badge.title=`Development · App ${RELEASE} · startup stability and single version authority`;
  }
  // Legacy feature modules are no longer allowed to own global build identity,
  // so a topbar-wide MutationObserver is unnecessary and would add startup churn.
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.MGWVisibleRelease=RELEASE;
})();
