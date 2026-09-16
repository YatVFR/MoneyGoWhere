// MoneyGoWhere v1.5.5-dev.59 hotfix — non-blocking startup database sync.
// Startup sync must never prevent the app from opening. Folder restore/sync remains
// available from Settings, where iOS can handle the picker as an explicit user action.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.59-hotfix.1';

  function markDone(){
    if(window.MGWStartupSyncDone===true)return;
    window.MGWStartupSyncDone=true;
    document.dispatchEvent(new CustomEvent('mgw:startup-sync:done'));
  }

  function removeLegacyPrompt(){
    const d=document.querySelector('#mgwStartupSyncDialog');
    if(d){
      try{if(d.open)d.close('local')}catch{}
      d.remove();
    }
    // This input only belonged to the removed startup modal. Settings owns its
    // own backup-folder picker, so removing this does not remove manual sync.
    document.querySelector('#mgwStartupBackupFolderInput')?.remove();
  }

  function install(){
    // Mark complete before icloud-folder-scanner.js boots. Its startupPrompt()
    // checks this flag and therefore skips creating the blocking modal entirely.
    markDone();
    removeLegacyPrompt();

    // Also protect mixed-cache sessions where an older scanner happened to
    // create the dialog before this hotfix script executed.
    if(window.MutationObserver){
      const observer=new MutationObserver(()=>removeLegacyPrompt());
      observer.observe(document.body||document.documentElement,{childList:true,subtree:true});
      setTimeout(()=>observer.disconnect(),5000);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.MGWStartupSyncControls={version:RELEASE,nonBlocking:true,markDone,removeLegacyPrompt};
})();
