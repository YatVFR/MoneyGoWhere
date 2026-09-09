// MoneyGoWhere v1.4.0 privacy + pay-cycle compatibility layer.
// IMPORTANT: This file intentionally contains NO personal finance records.
// Historical data belongs only in each device's local database or user-exported backups.
const MGW_RUNTIME_RELEASE = Object.freeze({appVersion:'1.4.0',schemaVersion:1,dataVersion:6,cacheVersion:'1.4.0'});

function mgwCycleSettings(){
  const current=db?.settings?.payCycle||{};
  return {
    mode:current.mode==='payday'?'payday':'calendar',
    day:Math.min(31,Math.max(1,Number(current.day)||25))
  };
}

function mgwSafeMonthDay(year,monthIndex,day){
  const last=new Date(year,monthIndex+1,0).getDate();
  return new Date(year,monthIndex,Math.min(day,last));
}
function mgwDateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function mgwCycleBounds(anchor=MGW.state.month){
  const cfg=mgwCycleSettings(),y=anchor.getFullYear(),m=anchor.getMonth();
  if(cfg.mode!=='payday'){
    return {start:new Date(y,m,1),end:new Date(y,m+1,1),mode:'calendar'};
  }
  return {
    start:mgwSafeMonthDay(y,m,cfg.day),
    end:mgwSafeMonthDay(y,m+1,cfg.day),
    mode:'payday'
  };
}
function mgwInCycle(x,anchor){
  const b=mgwCycleBounds(anchor),k=String(x?.date||'').slice(0,10);
  return Boolean(k)&&k>=mgwDateKey(b.start)&&k<mgwDateKey(b.end);
}
function mgwCycleLabel(anchor=MGW.state.month){
  const b=mgwCycleBounds(anchor);
  if(b.mode==='calendar') return b.start.toLocaleDateString('en-SG',{month:'long',year:'numeric'});
  const inclusiveEnd=new Date(b.end); inclusiveEnd.setDate(inclusiveEnd.getDate()-1);
  const sameYear=b.start.getFullYear()===inclusiveEnd.getFullYear();
  const left=b.start.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:sameYear?undefined:'numeric'});
  const right=inclusiveEnd.toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'});
  return `${left} – ${right}`;
}

// Core period filters now follow the user's selected tracking cycle.
if(typeof monthExpenses==='function') monthExpenses=function(d){return db.expenses.filter(x=>mgwInCycle(x,d))};
if(typeof monthIncome==='function') monthIncome=function(d){return db.income.filter(x=>mgwInCycle(x,d))};
if(typeof monthName==='function') monthName=function(d){return mgwCycleLabel(d)};

// Insights previously filtered by YYYY-MM directly, bypassing monthExpenses().
// Rebuild it using the active cycle so 1/6/12-period analytics remain consistent.
if(typeof renderInsights==='function'){
  renderInsights=function(){
    const n=MGW.state.range,months=rangeMonths(n),list=months.flatMap(d=>monthExpenses(d)),cats=catTotals(list),total=sum(list),isPay=mgwCycleSettings().mode==='payday';
    $('#insightSummary').innerHTML=total?`<strong>${money(total)}</strong><p>${n===1?(isPay?'this pay cycle':'this month'):`across the last ${n} ${isPay?'pay cycles':'months'}`}${cats[0]?` · Top: ${MGW.cats[cats[0][0]]||''} ${cats[0][0]}`:''}</p>`:'<p>No expenses in this period yet.</p>';
    renderCats($('#insightCategories'),cats);
    renderTrend($('#salaryTrend'),12,'salary');
    const byYear={};
    db.income.forEach(x=>{const y=String(x.date).slice(0,4),b=Number(x.bonus)||0;if(b)byYear[y]=(byYear[y]||0)+b});
    $('#bonusHistory').innerHTML=Object.entries(byYear).sort().map(([y,v])=>`<div class="bonus-row"><span>${y} Bonus</span><strong>${money(v)}</strong></div>`).join('')||'<p class="empty-state">No bonus history yet.</p>';
  };
}

function mgwCycleCard(){
  if(document.querySelector('#mgwPayCycleCard'))return;
  const settings=document.querySelector('#view-settings');
  if(!settings)return;
  const cfg=mgwCycleSettings();
  const card=document.createElement('article');
  card.className='card'; card.id='mgwPayCycleCard';
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">📅</span><b>Tracking Period</b></div></div>
    <form id="mgwPayCycleForm" class="form-grid">
      <div class="field full"><label>Tabulation mode</label><select name="mode"><option value="calendar" ${cfg.mode==='calendar'?'selected':''}>Calendar month</option><option value="payday" ${cfg.mode==='payday'?'selected':''}>Pay cycle</option></select><small>Pay cycle groups income, expenses, budgets and insights from one payday to the day before the next.</small></div>
      <div class="field full" id="mgwPayDayWrap"><label>Payday / cycle start day</label><input name="day" type="number" min="1" max="31" value="${cfg.day}"><small>Example: day 25 means 25 Aug → 24 Sep. Short months automatically use their last valid day.</small></div>
      <div class="field full"><div class="status" id="mgwCyclePreview"></div></div>
      <div class="field full"><button class="primary-btn">Save Tracking Period</button></div>
    </form>`;
  const privacy=settings.querySelector('.privacy-note');
  settings.insertBefore(card,privacy||null);
  const form=card.querySelector('#mgwPayCycleForm'),mode=form.elements.mode,day=form.elements.day;
  const refreshPreview=()=>{
    day.disabled=mode.value!=='payday';
    const original=db.settings.payCycle;
    db.settings.payCycle={mode:mode.value,day:Number(day.value)||25};
    card.querySelector('#mgwCyclePreview').innerHTML=`<b>Current selection:</b> ${mgwCycleLabel(MGW.state.month)}`;
    if(original===undefined) delete db.settings.payCycle; else db.settings.payCycle=original;
  };
  mode.addEventListener('change',refreshPreview);day.addEventListener('input',refreshPreview);refreshPreview();
  form.addEventListener('submit',e=>{
    e.preventDefault();
    db.settings.payCycle={mode:mode.value==='payday'?'payday':'calendar',day:Math.min(31,Math.max(1,Number(day.value)||25))};
    localStorage.setItem(MGW.key,JSON.stringify(db));
    if(typeof renderAll==='function')renderAll();
    refreshPreview();
    if(typeof toast==='function')toast(db.settings.payCycle.mode==='payday'?'Pay-cycle tabulation enabled':'Calendar-month tabulation enabled');
  });
}

function mgwUpdateCycleUI(){
  const label=document.querySelector('#monthLabel'); if(label)label.textContent=mgwCycleLabel(MGW.state.month);
  const preview=document.querySelector('#mgwCyclePreview'); if(preview)preview.innerHTML=`<b>Current period:</b> ${mgwCycleLabel(MGW.state.month)}`;
  const privacy=document.querySelector('.privacy-note');
  if(privacy)privacy.textContent='🔒 MoneyGoWhere is local-first. New devices start with an empty database; restore your own backup to move data between devices. No personal finance history is bundled with the app.';
}

// Keep every rendered view aligned with the selected cycle.
if(typeof renderAll==='function'){
  const mgwV14RenderAll=renderAll;
  renderAll=function(){mgwV14RenderAll();mgwUpdateCycleUI()};
}

function mgwExportV14(){
  const payload={...db,backupMeta:{appVersion:MGW_RUNTIME_RELEASE.appVersion,schemaVersion:MGW_RUNTIME_RELEASE.schemaVersion,dataVersion:MGW_RUNTIME_RELEASE.dataVersion,cacheVersion:MGW_RUNTIME_RELEASE.cacheVersion,exportedAt:new Date().toISOString()}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`MoneyGoWhere-backup-v${MGW_RUNTIME_RELEASE.appVersion}-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
  if(typeof toast==='function')toast('Complete backup exported');
}

document.addEventListener('DOMContentLoaded',()=>{
  // Preserve existing local data. With bundled history removed, a new device naturally starts empty.
  db.settings=db.settings||{currency:'SGD'};
  mgwCycleCard();
  mgwUpdateCycleUI();
  const badge=document.querySelector('#appVersionBadge');
  if(badge){badge.textContent=`v${MGW_RUNTIME_RELEASE.appVersion}`;badge.title=`App ${MGW_RUNTIME_RELEASE.appVersion} · Schema ${MGW_RUNTIME_RELEASE.schemaVersion} · Data ${MGW_RUNTIME_RELEASE.dataVersion}`;}
  const exportBtn=document.querySelector('#exportBtn');
  if(exportBtn)exportBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();mgwExportV14();},true);
  if(typeof renderAll==='function')renderAll();
});
