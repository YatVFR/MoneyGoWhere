// MoneyGoWhere DEV — wallet UI refresh hotfix
// Rebuilds wallet/debit blocks whenever account data changes so newly added wallets appear immediately.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.71';
  let queued=false;

  function rebuild(){
    if(queued)return;
    queued=true;
    const run=()=>{
      queued=false;
      document.querySelector('#mgwWalletAccountsBlock')?.remove();
      document.querySelector('#mgwWalletDashboardBlock')?.remove();
      try{window.MGWCardsWallets?.enhance?.()}catch(err){console.error('MoneyGoWhere wallet refresh hotfix failed',err)}
    };
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0);
  }

  document.addEventListener('mgw:accounts-changed',rebuild);
  window.addEventListener('mgw:data-ready',rebuild);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rebuild,{once:true});else rebuild();
  window.MGWWalletRefreshHotfix={version:RELEASE,refresh:rebuild};
})();
