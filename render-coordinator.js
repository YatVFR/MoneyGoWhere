// MoneyGoWhere UAT centralized render coordinator.
// Single-pass rendering: render requests raised by render hooks are ignored until the next user/data event.
(()=>{
'use strict';
const RELEASE='1.5.5-dev.56';
const hooks=new Map();
let scheduled=false,running=false,lastReason='boot',lastMs=0,renderCount=0;
const base=typeof window.MGWBaseRender==='function'?window.MGWBaseRender:null;
function register(name,fn,priority=50){if(typeof fn==='function')hooks.set(name,{fn,priority});}
function discover(){
  register('monthly-details',()=>window.renderMonthlyDetails?.(),20);
  register('cycle-ui',()=>window.mgwUpdateCycleUI?.(),25);
  register('credit',()=>window.MGWCreditManager?.render?.(),40);
  register('cards-wallets',()=>window.MGWCardsWallets?.enhance?.(),45);
  register('dashboard-core',()=>window.MGWDashboardCore?.refresh?.(),60);
}
function execute(){
  if(running)return;
  running=true;scheduled=false;const start=performance.now();
  try{
    if(base)base();
    discover();
    for(const [name,h] of [...hooks].sort((a,b)=>a[1].priority-b[1].priority)){
      try{h.fn()}catch(err){window.MGWUATDiagnostics?.capture?.(err,'render-hook:'+name)}
    }
    renderCount++;
  }catch(err){window.MGWUATDiagnostics?.capture?.(err,'render-coordinator')}
  finally{
    lastMs=Math.round(performance.now()-start);running=false;
    if(lastMs>500)window.MGWUATDiagnostics?.capture?.(new Error('Render took '+lastMs+'ms'),'render-performance');
  }
}
function request(reason='unknown'){
  lastReason=reason;
  if(running||scheduled)return;
  scheduled=true;
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(execute);else setTimeout(execute,0);
}
window.MGWRenderCoordinator={version:RELEASE,register,request,renderNow:execute,status:()=>({running,scheduled,lastReason,lastMs,renderCount,hooks:[...hooks.keys()]})};
renderAll=function(){request('renderAll')};
window.renderAll=renderAll;
request('coordinator-installed');
})();