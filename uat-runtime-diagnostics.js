// MoneyGoWhere UAT runtime diagnostics. Stores technical errors only; no finance records.
(()=>{
  'use strict';
  const KEY='mgw-uat-runtime-errors-v2',MAX=30,STALL_MS=1800;
  const clean=v=>String(v??'').replace(/[\r\n]+/g,' ').slice(0,700);
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function surface(){
    const host=document.querySelector('.top-actions');if(!host)return;
    let b=document.querySelector('#mgwUatHealthBadge');
    if(!b){
      const s=document.createElement('style');s.id='mgwUatHealthStyle';s.textContent='.mgw-uat-health{border:1px solid var(--line);border-radius:999px;background:#fff;padding:6px 9px;font:700 10px/1 system-ui;color:var(--brand);white-space:nowrap}.mgw-uat-health.warn{color:#b42318;border-color:#f3b6b0;background:#fff4f2}';document.head.appendChild(s);
      b=document.createElement('button');b.type='button';b.id='mgwUatHealthBadge';b.className='mgw-uat-health';b.addEventListener('click',()=>{const r=selfCheck('uat-health-badge');try{toast(r.ok?'UAT health check passed':r.issues.join(' · '))}catch(_){}});host.prepend(b);
    }
    const n=load().length;b.textContent=n?('UAT ⚠ '+n):'UAT ✓';b.classList.toggle('warn',Boolean(n));b.title=n?'UAT captured '+n+' runtime issue(s). Tap to run health check.':'UAT runtime health: no captured errors';
  }
  function capture(error,context='runtime'){
    const entry={at:new Date().toISOString(),context:clean(context),message:clean(error?.message||error||'Unknown error'),source:clean(error?.filename||''),line:Number(error?.lineno)||0,column:Number(error?.colno)||0,stack:clean(error?.stack||'')};
    try{const prior=load();const sig=entry.context+'|'+entry.message;const recent=prior.slice(-5).some(x=>x.context+'|'+x.message===sig);if(!recent)localStorage.setItem(KEY,JSON.stringify([...prior,entry].slice(-MAX)))}catch(_){}
    try{document.documentElement.dataset.mgwUatErrors=String(load().length)}catch(_){}
    try{surface()}catch(_){}
    console.error('[MoneyGoWhere UAT]',entry.context,entry.message);
    return entry;
  }
  function selfCheck(context='self-check'){
    const issues=[];
    try{const probe='mgw-uat-probe-'+Date.now();localStorage.setItem(probe,'1');if(localStorage.getItem(probe)!=='1')issues.push('localStorage read-back failed');localStorage.removeItem(probe)}catch(e){issues.push('localStorage unavailable: '+clean(e?.message))}
    try{
      if(typeof db!=='undefined'){
        for(const k of ['expenses','income','creditAccounts','creditPayments','payLaterAccounts','payLaterPayments','walletAccounts'])if(db[k]!==undefined&&!Array.isArray(db[k]))issues.push(k+' is not an array');
        const ids=[...(db.creditAccounts||[]),...(db.walletAccounts||[])].map(x=>x?.id).filter(Boolean);if(new Set(ids).size!==ids.length)issues.push('duplicate card/wallet ids');
        const stored=JSON.parse(localStorage.getItem(MGW?.key)||'{}');
        if(Array.isArray(stored.creditAccounts)&&stored.creditAccounts.length!==(db.creditAccounts||[]).length)issues.push('credit account memory/storage count mismatch');
        if(Array.isArray(stored.walletAccounts)&&stored.walletAccounts.length!==(db.walletAccounts||[]).length)issues.push('wallet account memory/storage count mismatch');
      }
    }catch(e){issues.push('database check failed: '+clean(e?.message))}
    for(const id of ['modal','modalBody','view-dashboard','view-settings'])if(!document.getElementById(id))issues.push('missing DOM #'+id);
    if(document.readyState==='complete'){if(typeof window.MGWCreditManager?.render!=='function')issues.push('targeted credit renderer unavailable');if(typeof window.MGWCardsWallets?.open!=='function')issues.push('cards/wallet controller unavailable')}
    if(issues.length)capture(new Error(issues.join('; ')),context);
    surface();return {ok:issues.length===0,issues,errorCount:load().length};
  }
  window.addEventListener('error',e=>capture(e.error||new Error(e.message||'Script error'),'window.error'));
  window.addEventListener('unhandledrejection',e=>capture(e.reason instanceof Error?e.reason:new Error(clean(e.reason)),'unhandledrejection'));
  let lastTick=Date.now(),lastStall=0;
  setInterval(()=>{const now=Date.now(),lag=now-lastTick-4000;lastTick=now;if(document.visibilityState==='visible'&&lag>STALL_MS&&now-lastStall>60000){lastStall=now;capture(new Error('UI thread stall detected: '+Math.round(lag)+'ms'),'event-loop-watchdog')}},4000);
  window.MGWUATDiagnostics={capture,selfCheck,report:()=>({errors:load(),check:selfCheck('manual-report')}),clear:()=>{try{localStorage.removeItem(KEY)}catch(_){}surface()}};
  const boot=()=>{surface();setTimeout(()=>selfCheck('startup'),1800)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
