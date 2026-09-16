// MoneyGoWhere v1.5.5-dev.58 — iOS-safe startup database sync controls.
// Uses native label/file-input activation and dialog form submission so the
// startup choices do not depend on programmatic button clicks on iPhone/PWA.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.58';

  function exposePicker(input){
    if(!input||input.dataset.mgwNativePicker==='1')return;
    input.dataset.mgwNativePicker='1';
    input.hidden=false;
    input.tabIndex=-1;
    input.setAttribute('aria-hidden','true');
    Object.assign(input.style,{
      position:'fixed',left:'-10000px',top:'0',width:'1px',height:'1px',
      opacity:'0',pointerEvents:'none'
    });
  }

  function installStyle(){
    if(document.querySelector('#mgwStartupSyncControlsCss'))return;
    const s=document.createElement('style');
    s.id='mgwStartupSyncControlsCss';
    s.textContent=`
      #mgwStartupSyncDialog .mgw-native-file-label{display:block;width:100%;box-sizing:border-box;text-align:center;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
      #mgwStartupSyncDialog .mgw-native-file-label:focus-visible{outline:3px solid rgba(59,130,246,.55);outline-offset:3px}
      #mgwStartupSyncDialog .mgw-native-local-form{margin:0;width:100%}
      #mgwStartupSyncDialog .mgw-native-local-form button{width:100%;touch-action:manipulation}
    `;
    document.head.appendChild(s);
  }

  function patchDialog(){
    const d=document.querySelector('#mgwStartupSyncDialog');
    if(!d||d.dataset.mgwNativeControls==='1')return false;
    const input=document.querySelector('#mgwStartupBackupFolderInput');
    if(!input)return false;

    installStyle();
    exposePicker(input);

    const sync=d.querySelector('[data-sync]');
    if(sync){
      const label=document.createElement('label');
      label.className=`${sync.className||'primary-btn'} mgw-native-file-label`;
      label.htmlFor=input.id;
      label.setAttribute('role','button');
      label.tabIndex=0;
      label.textContent=sync.textContent||'Choose DB Folder & Sync';
      label.addEventListener('keydown',e=>{
        if(e.key!=='Enter'&&e.key!==' ')return;
        e.preventDefault();
        input.click();
      });
      sync.replaceWith(label);
    }

    const local=d.querySelector('[data-local]');
    if(local&&!local.closest('form[method="dialog"]')){
      local.type='submit';
      local.value='local';
      const form=document.createElement('form');
      form.method='dialog';
      form.className='mgw-native-local-form';
      local.replaceWith(form);
      form.appendChild(local);
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
