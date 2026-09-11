// MoneyGoWhere v1.5.4 runtime compatibility layer.
// IMPORTANT: No personal finance records are bundled with the app.
const MGW_RUNTIME_RELEASE=Object.freeze({appVersion:'1.5.4',schemaVersion:1,dataVersion:9,cacheVersion:'1.5.4'});

function mgwCycleSettings(){const p=db?.settings?.payCycle||{};return{mode:p.mode==='payday'?'payday':'calendar',day:Math.min(31,Math.max(1,Number(p.day)||25))}}
function mgwSafeMonthDay(y,m,d){return new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()))}
function mgwDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function mgwCycleBounds(anchor=MGW.state.month){const c=mgwCycleSettings(),y=anchor.getFullYear(),m=anchor.getMonth();return c.mode==='payday'?{start:mgwSafeMonthDay(y,m,c.day),end:mgwSafeMonthDay(y,m+1,c.day),mode:'payday'}:{start:new Date(y,m,1),end:new Date(y,m+1,1),mode:'calendar'}}
function mgwInCycle(x,anchor){const b=mgwCycleBounds(anchor),k=String(x?.date||'').slice(0,10);return Boolean(k)&&k>=mgwDateKey(b.start)&&k<mgwDateKey(b.end)}
function mgwCycleLabel(anchor=MGW.state.month){const b=mgwCycleBounds(anchor);if(b.mode==='calendar')return b.start.toLocaleDateString('en-SG',{month:'long',year:'numeric'});const e=new Date(b.end);e.setDate(e.getDate()-1);const same=b.start.getFullYear()===e.getFullYear();return `${b.start.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:same?undefined:'numeric'})} – ${e.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'})}`}

if(typeof monthExpenses==='function')monthExpenses=d=>db.expenses.filter(x=>mgwInCycle(x,d));
if(typeof monthIncome==='function')monthIncome=d=>db.income.filter(x=>mgwInCycle(x,d));
if(typeof monthName==='function')monthName=d=>mgwCycleLabel(d);

if(typeof renderInsights==='function')renderInsights=function(){const n=MGW.state.range,months=rangeMonths(n),list=months.flatMap(d=>monthExpenses(d)),cats=catTotals(list),total=sum(list),isPay=mgwCycleSettings().mode==='payday';$('#insightSummary').innerHTML=total?`<strong>${money(total)}</strong><p>${n===1?(isPay?'this pay cycle':'this month'):`across the last ${n} ${isPay?'pay cycles':'months'}`}${cats[0]?` · Top: ${MGW.cats[cats[0][0]]||''} ${cats[0][0]}`:''}</p>`:'<p>No expenses in this period yet.</p>';renderCats($('#insightCategories'),cats);renderTrend($('#salaryTrend'),12,'salary');const byYear={};db.income.forEach(x=>{const y=String(x.date).slice(0,4),b=Number(x.bonus)||0;if(b)byYear[y]=(byYear[y]||0)+b});$('#bonusHistory').innerHTML=Object.entries(byYear).sort().map(([y,v])=>`<div class="bonus-row"><span>${y} Bonus</span><strong>${money(v)}</strong></div>`).join('')||'<p class="empty-state">No bonus history yet.</p>'};

function mgwCycleCard(){if(document.querySelector('#mgwPayCycleCard'))return;const settings=document.querySelector('#view-settings');if(!settings)return;const cfg=mgwCycleSettings(),card=document.createElement('article');card.className='card';card.id='mgwPayCycleCard';card.innerHTML=`<div class="card-head"><div><span class="section-icon">📅</span><b>Tracking Period</b></div></div><form id="mgwPayCycleForm" class="form-grid"><div class="field full"><label>Tabulation mode</label><select name="mode"><option value="calendar" ${cfg.mode==='calendar'?'selected':''}>Calendar month</option><option value="payday" ${cfg.mode==='payday'?'selected':''}>Pay cycle</option></select><small>Pay cycle groups income, expenses, budgets and insights from one payday to the day before the next.</small></div><div class="field full"><label>Payday / cycle start day</label><input name="day" type="number" min="1" max="31" value="${cfg.day}"><small>Example: day 25 means 25 Aug → 24 Sep. Short months use their last valid day.</small></div><div class="field full"><div class="status" id="mgwCyclePreview"></div></div><div class="field full"><button class="primary-btn">Save Tracking Period</button></div></form>`;settings.insertBefore(card,settings.querySelector('.privacy-note')||null);const f=card.querySelector('form'),mode=f.elements.mode,day=f.elements.day;const preview=()=>{day.disabled=mode.value!=='payday';const old=db.settings.payCycle;db.settings.payCycle={mode:mode.value,day:Number(day.value)||25};card.querySelector('#mgwCyclePreview').innerHTML=`<b>Current selection:</b> ${mgwCycleLabel(MGW.state.month)}`;if(old===undefined)delete db.settings.payCycle;else db.settings.payCycle=old};mode.addEventListener('change',preview);day.addEventListener('input',preview);preview();f.addEventListener('submit',e=>{e.preventDefault();db.settings.payCycle={mode:mode.value==='payday'?'payday':'calendar',day:Math.min(31,Math.max(1,Number(day.value)||25))};localStorage.setItem(MGW.key,JSON.stringify(db));if(typeof renderAll==='function')renderAll();preview();if(typeof toast==='function')toast(db.settings.payCycle.mode==='payday'?'Pay-cycle tabulation enabled':'Calendar-month tabulation enabled')})}
function mgwUpdateCycleUI(){const label=document.querySelector('#monthLabel');if(label)label.textContent=mgwCycleLabel(MGW.state.month);const p=document.querySelector('#mgwCyclePreview');if(p)p.innerHTML=`<b>Current period:</b> ${mgwCycleLabel(MGW.state.month)}`;const privacy=document.querySelector('.privacy-note');if(privacy)privacy.textContent='🔒 MoneyGoWhere is local-first. New devices start with an empty database; restore your own backup to move data between devices. Receipt OCR, card/debt tracking, recurring schedules and Smart Spending Advisor calculations are processed locally in this browser.'}
if(typeof renderAll==='function'){const base=renderAll;renderAll=function(){base();mgwUpdateCycleUI()}}
function mgwExportV154(){const payload={...db,backupMeta:{appVersion:MGW_RUNTIME_RELEASE.appVersion,schemaVersion:MGW_RUNTIME_RELEASE.schemaVersion,dataVersion:MGW_RUNTIME_RELEASE.dataVersion,cacheVersion:MGW_RUNTIME_RELEASE.cacheVersion,exportedAt:new Date().toISOString()}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MoneyGoWhere-backup-v${MGW_RUNTIME_RELEASE.appVersion}-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);if(typeof toast==='function')toast('Complete backup exported')}

const MGW_FEATURE_MODULES=['./ocr-enhance.js','./credit-manager.js','./credit-accounting-fix.js','./smart-budget-insights.js','./performance-optimizer.js','./recurring-schedules.js'];
function mgwLoadFeatureModules(index=0){if(index>=MGW_FEATURE_MODULES.length){if(typeof renderAll==='function')renderAll();return;}const src=MGW_FEATURE_MODULES[index];if(document.querySelector(`script[data-mgw-module="${src}"]`)){mgwLoadFeatureModules(index+1);return;}const s=document.createElement('script');s.src=src;s.dataset.mgwModule=src;s.onload=()=>mgwLoadFeatureModules(index+1);s.onerror=()=>{console.error('MoneyGoWhere module failed to load:',src);mgwLoadFeatureModules(index+1)};document.head.appendChild(s)}
mgwLoadFeatureModules();

// v1.5.4 UAT refresh stability fix: own the refresh click in capture phase so the
// legacy handler cannot schedule a second reload while the service worker is activating.
function mgwInstallStableRefresh(){
  const btn=document.querySelector('#refreshBtn'),status=document.querySelector('#updateStatus'),sub=document.querySelector('#updateSub'),dot=document.querySelector('#updateDot');
  if(!btn||btn.dataset.mgwStableRefresh==='1')return;
  btn.dataset.mgwStableRefresh='1';
  let busy=false;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const state=(label,detail,available=false,spinning=false)=>{status.textContent=label;sub.textContent=detail;dot?.classList.toggle('hidden',!available);btn.classList.toggle('update-available',available);btn.classList.toggle('is-checking',spinning);btn.setAttribute('aria-busy',spinning?'true':'false')};
  const step=async(n,label,detail)=>{state(`${n}/3 ${label}`,detail,false,true);await wait(260)};
  const waitForInstalled=worker=>new Promise((resolve,reject)=>{if(!worker)return reject(new Error('No worker'));if(worker.state==='installed')return resolve(worker);const timer=setTimeout(()=>reject(new Error('Install timeout')),12000);worker.addEventListener('statechange',()=>{if(worker.state==='installed'){clearTimeout(timer);resolve(worker)}else if(worker.state==='redundant'){clearTimeout(timer);reject(new Error('Worker redundant'))}})});
  btn.addEventListener('click',async e=>{
    e.preventDefault();e.stopImmediatePropagation();
    if(busy)return;
    if(!('serviceWorker' in navigator)){state('Refresh','Service worker unavailable');return;}
    busy=true;
    try{
      await step(1,'Checking','Contacting app service');
      let reg=await navigator.serviceWorker.getRegistration();
      if(!reg)reg=await navigator.serviceWorker.register('./service-worker.js');
      await step(2,'Comparing','Checking latest files');
      await reg.update();
      let worker=reg.waiting;
      if(!worker&&reg.installing){state('3/3 Preparing','Downloading update',false,true);worker=await waitForInstalled(reg.installing);reg=await navigator.serviceWorker.getRegistration();worker=reg?.waiting||worker}
      if(worker&&navigator.serviceWorker.controller){
        state('3/3 Installing','Opening latest version',false,true);
        // No location.reload() here. The existing controllerchange listener performs
        // the single reload after activation, preventing the visible double-refresh.
        worker.postMessage({type:'SKIP_WAITING'});
        return;
      }
      await step(3,'Complete','No new update found');
      state('Latest','App is up to date');
      busy=false;
    }catch(err){console.error('MoneyGoWhere refresh check failed',err);state('Refresh','Update check failed');busy=false}
  },true);
}

document.addEventListener('DOMContentLoaded',()=>{db.settings=db.settings||{currency:'SGD'};db.recurringIncome=Array.isArray(db.recurringIncome)?db.recurringIncome:[];db.recurringCommitments=Array.isArray(db.recurringCommitments)?db.recurringCommitments:[];mgwCycleCard();mgwUpdateCycleUI();mgwInstallStableRefresh();const badge=document.querySelector('#appVersionBadge');if(badge){badge.textContent=`v${MGW_RUNTIME_RELEASE.appVersion} · PREVIEW/UAT`;badge.title=`Preview/UAT · App ${MGW_RUNTIME_RELEASE.appVersion} · Schema ${MGW_RUNTIME_RELEASE.schemaVersion} · Data ${MGW_RUNTIME_RELEASE.dataVersion}`};const exportBtn=document.querySelector('#exportBtn');if(exportBtn)exportBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();mgwExportV154()},true);if(typeof renderAll==='function')renderAll()});