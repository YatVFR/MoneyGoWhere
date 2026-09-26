// MoneyGoWhere UAT centralized render coordinator.
// Prevents the legacy module wrapper chain from recursively rebuilding the UI.
(()=>{
'use strict';
const RELEASE='1.5.5-dev.54';
const hooks=new Map();
let scheduled=false,running=false,again=false,lastReason='boot',lastMs=0;
const legacy=typeof renderAll==='function'?renderAll:null;
const base=typeof window.MGWBaseRender==='function'?window.MGWBaseRender:legacy;
function register(name,fn,priority=50){if(typeof fn==='function')hooks.set(name,{fn,priority});}
function discover(){
  register('monthly-details',()=>window.renderMonthlyDetails?.(),20);
  register('cycle-ui',()=>window.mgwUpdateCycleUI?.(),25);
  register('credit',()=>window.MGWCreditManager?.render?.(),40);
  register('cards-wallets',()=>window.MGWCardsWallets?.enhance?.(),45);
  register('dashboard-core',()=>window.MGWDashboardCore?.refresh?.(),60);
}
function execute(){
  if(running){again=true;return}
  running=true;scheduled=false;again=false;const start=performance.now();
  try{
    base?.();
    discover();
    for(const [name,h] of [...hooks].sort((a,b)=>a[1].priority-b[1].priority)){
      try{h.fn()}catch(err){window.MGWUATDiagnostics?.capture?.(err,'render-hook:'+name)}
    }
  }catch(err){window.MGWUATDiagnostics?.capture?.(err,'render-coordinator')}
  finally{
    lastMs=Math.round(performance.now()-start);running=false;
    if(lastMs>500)window.MGWUATDiagnostics?.capture?.(new Error('Render took '+lastMs+'ms'),'render-performance');
    if(again)request('coalesced-reentry');
  }
}
function request(reason='unknown'){
  lastReason=reason;
  if(running){again=true;return}
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(execute);
}
window.MGWRenderCoordinator={version:RELEASE,register,request,renderNow:execute,status:()=>({running,scheduled,lastReason,lastMs,hooks:[...hooks.keys()]})};
renderAll=function(){request('renderAll')};
window.renderAll=renderAll;
request('coordinator-installed');
})();