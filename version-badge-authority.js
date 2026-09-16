// MoneyGoWhere DEV — single authoritative visible build badge.
(()=>{
  'use strict';
  const release=window.MGW_RELEASE?.appVersion||'dev';
  const text=`v${release} · DEV`;
  function apply(){
    const header=document.querySelector('.topbar > div:first-child');if(!header)return;
    document.querySelector('#appVersionBadge')?.remove();
    let badge=document.querySelector('#mgwRuntimeVersionBadge');
    if(!badge){badge=document.createElement('span');badge.id='mgwRuntimeVersionBadge';badge.className='app-version-badge';header.appendChild(badge)}
    badge.textContent=text;
    badge.title=`Development · App ${release}`;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.MGWVisibleRelease=release;
})();
