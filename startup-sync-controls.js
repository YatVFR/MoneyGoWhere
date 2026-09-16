// MoneyGoWhere v1.5.5-dev.59 — direct-touch startup database sync controls.
// The directory picker itself is the tap target on iPhone/PWA. This avoids
// programmatic input.click() and label-forwarding quirks in iOS WebKit.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.59';

  function markDoneFallback(){
    if(window.MGWStartupSyncDone===true)return;
    window.MGWStartupSyncDone=true;
    document.dispatchEvent(new CustomEvent('mgw:startup-sync:done'));
  }

  function finishLocal(d){
    if(!d||d.dataset.mgwLocalClosing==='1')return;
    d.dataset.mgwLocalClosing='1';
    try{
      if(d.open)d.close('local');
    }catch(err){
      console.warn('MoneyGoWhere startup dialog close fallback',err);
    }
    queueMicrotask(()=>{
      if(window.MGWStartupSyncDone!==true)markDoneFallback();
    });
  }

  function installStyle(){
    if(document.querySelector('#mgwStartupSyncControlsCss'))return;
    const s=document.createElement('style');
    s.id='mgwStartupSyncControlsCss';
    s.textContent=`
      #mgwStartupSyncDialog .mgw-direct-picker{position:relative;display:block;width:100%;overflow:hidden;border-radius:15px;touch-action:manipulation}
      #mgwStartupSyncDialog .mgw-direct-picker .mgw-picker-face{display:block;width:100%;box-sizing:border-box;text-align:center;pointer-events:none;margin:0}
      #mgwStartupSyncDialog .mgw-direct-picker input[type="file"]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:100%!important;margin:0!important;padding:0!important;border:0!important;opacity:0!important;cursor:pointer!important;pointer-events:auto!important;z-index:2!important}
      #mgwStartupSyncDialog [data-local]{touch-action:manipulation;-webkit-tap-highlight-color:rgba(15,118,110,.12)}
    `;
    document.head.appendChild(s);
  }

  function patchDialog(){
    const d=document.querySelector('#mgwStartupSyncDialog');
    if(!d||d.dataset.mgwNativeControls==='1')return false;
    const input=document.querySelector('#mgwStartupBackupFolderInput');
    if(!input)return false;

    installStyle();

    const sync=d.querySelector('[data-sync]');
    if(sync){
      const wrap=document.createElement('div');
      wrap.className='mgw-direct-picker';
      const face=document.createElement('span');
      face.className=`${sync.className||'primary-btn'} mgw-picker-face`;
      face.textContent=sync.textContent||'Choose DB Folder & Sync';
      sync.replaceWith(wrap);
      wrap.appendChild(face);

      // The real file/directory input covers the visible control. The tap now
      // lands directly on the native picker instead of being forwarded by JS.
      input.hidden=false;
      input.removeAttribute('aria-hidden');
      input.tabIndex=0;
      input.style.cssText='';
      wrap.appendChild(input);
    }

    const local=d.querySelector('[data-local]');
    if(local){
      local.type='button';
      const activate=e=>{
        e.preventDefault();
        e.stopPropagation();
        finishLocal(d);
      };
      // pointerup gives iOS/PWA a direct touch path; click remains the keyboard
      // and non-pointer fallback. finishLocal is idempotent, so both are safe.
      local.addEventListener('pointerup',activate,{capture:true});
      local.addEventListener('click',activate,{capture:true});
    }

    d.dataset.mgwNativeControls='1';
    return true;
  }

  function install(){
    installStyle();
    if(patchDialog())return;
    if(!window.MutationObserver)return;
    const observer=new MutationObserver(()=>{
      if(patchDialog())observer.disconnect();
    });
    observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.MGWStartupSyncControls={version:RELEASE,patch:patchDialog};
})();
