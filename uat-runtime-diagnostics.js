// MoneyGoWhere UAT runtime diagnostics. Stores technical errors only; no finance records.
(()=>{
  'use strict';
  const KEY='mgw-uat-runtime-errors-v1',MAX=20;
  const clean=v=>String(v??'').replace(/[\r\n]+/g,' ').slice(0,700);
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function capture(error,context='runtime'){
    const entry={at:new Date().toISOString(),context:clean(context),message:clean(error?.message||error||'Unknown error'),source:clean(error?.filename||''),line:Number(error?.lineno)||0,column:Number(error?.colno)||0,stack:clean(error?.stack||'')};
    try{localStorage.setItem(KEY,JSON.stringify([...load(),entry].slice(-MAX)))}catch(_){}
    try{document.documentElement.dataset.mgwUatErrors=String(load().length)}catch(_){}
    try{if(typeof toast==='function')toast('UAT captured an app error. Diagnostics saved.')}catch(_){}
    return entry;
  }
  function selfCheck(context='self-check'){
    const issues=[];
    try{
      const probe='mgw-uat-probe-'+Date.now();localStorage.setItem(probe,'1');if(localStorage.getItem(probe)!=='1')issues.push('localStorage read-back failed');localStorage.removeItem(probe);
    }catch(e){issues.push('localStorage unavailable: '+clean(e?.message))}
    try{
      if(typeof db!=='undefined'){
        for(const k of ['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','walletAccounts'])if(db[k]!==undefined&&!Array.isArray(db[k]))issues.push(k+' is not an array');
        const accountIds=[...(db.creditAccounts||[]),...(db.walletAccounts||[])].map(x=>x?.id).filter(Boolean);
        if(new Set(accountIds).size!==accountIds.length)issues.push('duplicate card/wallet ids');
      }
    }catch(e){issues.push('database check failed: '+clean(e?.message))}
    for(const id of ['modal','modalBody','view-dashboard','view-settings'])if(!document.getElementById(id))issues.push('missing DOM #'+id);
    if(issues.length)capture(new Error(issues.join('; ')),context);
    return {ok:issues.length===0,issues,errorCount:load().length};
  }
  window.addEventListener('error',e=>capture(e.error||new Error(e.message||'Script error'),'window.error'));
  window.addEventListener('unhandledrejection',e=>capture(e.reason instanceof Error?e.reason:new Error(clean(e.reason)),'unhandledrejection'));
  window.MGWUATDiagnostics={capture,selfCheck,report:()=>({errors:load(),check:selfCheck('manual-report')}),clear:()=>{try{localStorage.removeItem(KEY)}catch(_){}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>selfCheck('startup'),0),{once:true});else setTimeout(()=>selfCheck('startup'),0);
})();
