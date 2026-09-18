// MoneyGoWhere runtime coordinator. Global build identity comes from index.html.
// Keeps pay-cycle behaviour and loads feature modules once, in deterministic order.
const MGW_RUNTIME_RELEASE=Object.freeze(window.MGW_RELEASE||{appVersion:'dev',schemaVersion:1,dataVersion:13,cacheVersion:'dev'});

function mgwCycleSettings(){
  const p=db?.settings?.payCycle||{};
  return {mode:p.mode==='payday'?'payday':'calendar',day:Math.min(31,Math.max(1,Number(p.day)||25))};
}
function mgwSafeMonthDay(y,m,d){return new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()))}
function mgwDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function mgwActiveCycleAnchor(now=new Date()){
  const c=mgwCycleSettings();
  if(c.mode!=='payday')return new Date(now.getFullYear(),now.getMonth(),1);
  const month=now.getDate()<c.day?now.getMonth()-1:now.getMonth();
  return new Date(now.getFullYear(),month,1);
}
let mgwCycleBoundsCache={key:'',value:null};
function mgwCycleBounds(anchor=MGW.state.month){
  const c=mgwCycleSettings(),y=anchor.getFullYear(),m=anchor.getMonth(),cacheKey=`${y}|${m}|${c.mode}|${c.day}`;
  if(mgwCycleBoundsCache.key===cacheKey&&mgwCycleBoundsCache.value)return mgwCycleBoundsCache.value;
  const value=c.mode==='payday'
    ? {start:mgwSafeMonthDay(y,m,c.day),end:mgwSafeMonthDay(y,m+1,c.day),mode:'payday'}
    : {start:new Date(y,m,1),end:new Date(y,m+1,1),mode:'calendar'};
  value.startKey=mgwDateKey(value.start);value.endKey=mgwDateKey(value.end);
  mgwCycleBoundsCache={key:cacheKey,value};
  return value;
}
function mgwInCycle(x,anchor=MGW.state.month){
  const b=mgwCycleBounds(anchor),k=String(x?.date||'').slice(0,10);
  return Boolean(k)&&k>=b.startKey&&k<b.endKey;
}
function mgwCycleLabel(anchor=MGW.state.month){
  const b=mgwCycleBounds(anchor);
  if(b.mode==='calendar')return b.start.toLocaleDateString('en-SG',{month:'long',year:'numeric'});
  const e=new Date(b.end);e.setDate(e.getDate()-1);
  const same=b.start.getFullYear()===e.getFullYear();
  return `${b.start.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:same?undefined:'numeric'})} – ${e.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})}`;
}
function mgwInstallRuntimeBadge(){
  document.querySelector('#appVersionBadge')?.remove();
  const header=document.querySelector('.topbar > div:first-child');if(!header)return;
  let badge=document.querySelector('#mgwRuntimeVersionBadge');
  if(!badge){badge=document.createElement('span');badge.id='mgwRuntimeVersionBadge';badge.className='app-version-badge';header.appendChild(badge)}
  badge.textContent=`v${MGW_RUNTIME_RELEASE.appVersion} · DEV`;
  badge.title=`Development · App ${MGW_RUNTIME_RELEASE.appVersion} · Schema ${MGW_RUNTIME_RELEASE.schemaVersion} · Data ${MGW_RUNTIME_RELEASE.dataVersion} · Cache ${MGW_RUNTIME_RELEASE.cacheVersion}`;
}
if(typeof monthExpenses==='function')monthExpenses=d=>db.expenses.filter(x=>mgwInCycle(x,d));
if(typeof monthIncome==='function')monthIncome=d=>db.income.filter(x=>mgwInCycle(x,d));
if(typeof monthName==='function')monthName=d=>mgwCycleLabel(d);
if(typeof renderInsights==='function'){
  renderInsights=function(){
    const n=MGW.state.range,months=rangeMonths(n),list=months.flatMap(d=>monthExpenses(d)),cats=catTotals(list),total=sum(list),isPay=mgwCycleSettings().mode==='payday';
    $('#insightSummary').innerHTML=total?`<strong>${money(total)}</strong><p>${n===1?(isPay?'this pay cycle':'this month'):`across the last ${n} ${isPay?'pay cycles':'months'}`}${cats[0]?` · Top: ${MGW.cats[cats[0][0]]||''} ${cats[0][0]}`:''}</p>`:'<p>No expenses in this period yet.</p>';
    renderCats($('#insightCategories'),cats);
    renderTrend($('#salaryTrend'),12,'salary');
    const byYear={};db.income.forEach(x=>{const y=String(x.date).slice(0,4),b=Number(x.bonus)||0;if(b)byYear[y]=(byYear[y]||0)+b});
    $('#bonusHistory').innerHTML=Object.entries(byYear).sort().map(([y,v])=>`<div class="bonus-row"><span>${y} Bonus</span><strong>${money(v)}</strong></div>`).join('')||'<p class="empty-state">No bonus history yet.</p>';
  };
}
function mgwCycleCard(){
  if(document.querySelector('#mgwPayCycleCard'))return;
  const settings=document.querySelector('#view-settings');if(!settings)return;
  const cfg=mgwCycleSettings(),card=document.createElement('article');
  card.className='card';card.id='mgwPayCycleCard';
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">📅</span><b>Tracking Period</b></div></div><form id="mgwPayCycleForm" class="form-grid"><div class="field full"><label>Tabulation mode</label><select name="mode"><option value="calendar" ${cfg.mode==='calendar'?'selected':''}>Calendar month</option><option value="payday" ${cfg.mode==='payday'?'selected':''}>Pay cycle</option></select><small>Pay cycle groups income, expenses, budgets and insights from one payday to the day before the next.</small></div><div class="field full"><label>Payday / cycle start day</label><input name="day" type="number" min="1" max="31" value="${cfg.day}"></div><div class="field full"><div class="status" id="mgwCyclePreview"></div></div><div class="field full"><button class="primary-btn">Save Tracking Period</button></div></form>`;
  settings.insertBefore(card,settings.querySelector('.privacy-note')||null);
  const f=card.querySelector('form'),mode=f.elements.mode,day=f.elements.day;
  const preview=()=>{
    day.disabled=mode.value!=='payday';
    const old=db.settings.payCycle;
    db.settings.payCycle={mode:mode.value,day:Number(day.value)||25};
    card.querySelector('#mgwCyclePreview').innerHTML=`<b>Current selection:</b> ${mgwCycleLabel(mgwActiveCycleAnchor(new Date()))}`;
    if(old===undefined)delete db.settings.payCycle;else db.settings.payCycle=old;
  };
  mode.addEventListener('change',preview);day.addEventListener('input',preview);preview();
  f.addEventListener('submit',e=>{
    e.preventDefault();
    db.settings.payCycle={mode:mode.value==='payday'?'payday':'calendar',day:Math.min(31,Math.max(1,Number(day.value)||25))};
    mgwCycleBoundsCache={key:'',value:null};
    MGW.state.month=mgwActiveCycleAnchor(new Date());
    localStorage.setItem(MGW.key,JSON.stringify(db));
    if(typeof renderAll==='function')renderAll();
    preview();
    if(typeof toast==='function')toast(db.settings.payCycle.mode==='payday'?'Pay-cycle tabulation enabled':'Calendar-month tabulation enabled');
  });
}
function mgwUpdateCycleUI(){const label=document.querySelector('#monthLabel');if(label)label.textContent=mgwCycleLabel(MGW.state.month)}
if(typeof renderAll==='function'){
  const baseRender=renderAll;
  renderAll=function(){baseRender();mgwUpdateCycleUI()};
}
const MGW_FEATURE_MODULES=[
  './ocr-enhance.js',
  './ocr-runtime.js',
  './credit-manager.js',
  './credit-collapse.js',
  './ui-navigation-history.js',
  './recurring-schedules.js',
  './recurring-bills.js',
  './paylater-recurrence.js',
  './paylater-rule-hotfix.js',
  './currency-normalization.js',
  './dashboard-breakdown.js',
  './salary-trends.js',
  './onboarding-dev.js',
  './recurring-onboarding.js',
  './wallet-import-queue.js',
  './apple-pay-inbox.js',
  './history-collapse.js',
  './salary-collapse.js',
  './transaction-editor.js',
  './currency-ui.js',
  './icloud-folder-scanner.js',
  './startup-import-assistant.js',
  './guided-walkthrough.js',
  './receipt-match-hint.js',
  './payment-source-linker.js',
  './dashboard-core.js',
  './performance-optimizer.js'
];
const MGW_RUNTIME_HEALTH={release:MGW_RUNTIME_RELEASE.appVersion,loaded:[],failed:[],ready:false};
window.MGWRuntimeHealth=MGW_RUNTIME_HEALTH;
function mgwModuleUrl(src){return `${src}${src.includes('?')?'&':'?'}v=${encodeURIComponent(MGW_RUNTIME_RELEASE.appVersion)}`}
function mgwPreloadModules(list){for(const src of list){const href=mgwModuleUrl(src);if(document.querySelector(`link[data-mgw-preload="${href}"]`))continue;const link=document.createElement('link');link.rel='preload';link.as='script';link.href=href;link.dataset.mgwPreload=href;document.head.appendChild(link)}}
function mgwLoadModule(src){
  return new Promise(resolve=>{
    const existing=document.querySelector(`script[data-mgw-module="${src}"]`);
    if(existing){
      if(existing.dataset.mgwReady==='1')return resolve();
      const finish=ok=>{
        existing.dataset.mgwReady='1';
        (ok?MGW_RUNTIME_HEALTH.loaded:MGW_RUNTIME_HEALTH.failed).push(src);
        resolve();
      };
      existing.addEventListener('load',()=>finish(true),{once:true});
      existing.addEventListener('error',()=>finish(false),{once:true});
      return;
    }
    const s=document.createElement('script');
    s.src=mgwModuleUrl(src);
    s.dataset.mgwModule=src;
    s.async=false;
    s.onload=()=>{s.dataset.mgwReady='1';MGW_RUNTIME_HEALTH.loaded.push(src);resolve()};
    s.onerror=()=>{s.dataset.mgwReady='1';MGW_RUNTIME_HEALTH.failed.push(src);console.error('MoneyGoWhere module failed to load:',src);resolve()};
    document.head.appendChild(s);
  });
}
async function mgwLoadFeatureModules(){
  mgwPreloadModules(MGW_FEATURE_MODULES);
  for(const src of MGW_FEATURE_MODULES)await mgwLoadModule(src);
  MGW_RUNTIME_HEALTH.ready=true;
  // During feature-first boot the real DB is intentionally still gated.
  // Avoid a heavy empty-data redraw; boot-phases performs the final render after hydration.
  if(window.MGWBootState?.dataReady&&typeof renderAll==='function')renderAll();
  mgwInstallRuntimeBadge();
  if(MGW_RUNTIME_HEALTH.failed.length)console.warn('MoneyGoWhere optional modules unavailable:',MGW_RUNTIME_HEALTH.failed);
  return MGW_RUNTIME_HEALTH;
}
function mgwExportCurrent(){
  const payload={...db,backupMeta:{appVersion:MGW_RUNTIME_RELEASE.appVersion,schemaVersion:MGW_RUNTIME_RELEASE.schemaVersion,dataVersion:MGW_RUNTIME_RELEASE.dataVersion,cacheVersion:MGW_RUNTIME_RELEASE.cacheVersion,exportedAt:new Date().toISOString()}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`MoneyGoWhere-backup-v${MGW_RUNTIME_RELEASE.appVersion}-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
  if(typeof toast==='function')toast('Complete backup exported');
}
function mgwBootRuntime(){
  db.settings=db.settings||{currency:'SGD'};
  db.recurringIncome=Array.isArray(db.recurringIncome)?db.recurringIncome:[];
  db.recurringCommitments=Array.isArray(db.recurringCommitments)?db.recurringCommitments:[];
  db.recurringBills=Array.isArray(db.recurringBills)?db.recurringBills:[];
  db.bankAccounts=Array.isArray(db.bankAccounts)?db.bankAccounts:[];
  window.db=db;
  MGW.state.month=mgwActiveCycleAnchor(new Date());
  mgwCycleCard();mgwUpdateCycleUI();mgwInstallRuntimeBadge();
  const exportBtn=document.querySelector('#exportBtn');
  if(exportBtn&&!exportBtn.dataset.mgwRuntimeBound){exportBtn.dataset.mgwRuntimeBound='1';exportBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();mgwExportCurrent()},true)}
  window.MGWRuntimeFeaturesReady=mgwLoadFeatureModules().catch(err=>{console.error('MoneyGoWhere runtime feature loading failed',err);return MGW_RUNTIME_HEALTH});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mgwBootRuntime,{once:true});else mgwBootRuntime();
