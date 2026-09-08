// MoneyGoWhere compatibility + detailed drill-down.
// Release metadata is intentionally separate from DB schema version.
const MGW_RELEASE = Object.freeze({ appVersion: '1.1.1', schemaVersion: 1, dataVersion: 2, cacheVersion: '1.1.1' });

// Legacy netSalary already represents total take-home pay for the month.
// This compatibility override prevents bonus/one-off amounts from being counted twice.
if (typeof totals === 'function') {
  totals = function(d) {
    const ex = sum(monthExpenses(d));
    const inc = monthIncome(d);
    const net = inc.reduce((t, x) => t + (Number(x.netSalary) || 0), 0);
    return { ex, net };
  };
}

// Reuse currency formatters instead of constructing Intl.NumberFormat for every value rendered.
if (typeof money === 'function') {
  const mgwFormatters = new Map();
  money = function(v) {
    const currency = db?.settings?.currency || 'SGD';
    if (!mgwFormatters.has(currency)) {
      mgwFormatters.set(currency, new Intl.NumberFormat('en-SG', { style: 'currency', currency }));
    }
    return mgwFormatters.get(currency).format(Number(v) || 0);
  };
}

function mgwEsc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mgwDetailRows(list){return list.map(x=>`<div class="mgw-detail-row"><div><b>${mgwEsc(x.vendor||x.category||'Expense')}</b><small>${mgwEsc(x.category||'Other')}${x.notes?' · '+mgwEsc(x.notes):''}</small></div><strong>${money(x.amount)}</strong></div>`).join('')}
function mgwIncomeRows(list){return list.map(x=>`<div class="mgw-income-detail"><div><span>Base Salary</span><strong>${money(x.baseSalary)}</strong></div><div><span>Net Salary</span><strong>${money(x.netSalary)}</strong></div>${Number(x.bonus)?`<div><span>Bonus</span><strong>${money(x.bonus)}</strong></div>`:''}${Number(x.oneOff)?`<div><span>One-Off Payment</span><strong>${money(x.oneOff)}</strong></div>`:''}</div>`).join('')}

function renderMonthlyDetails(){
  const host=document.querySelector('#monthlyDetails'); if(!host)return;
  const d=MGW.state.month, ex=monthExpenses(d), inc=monthIncome(d), groups={};
  ex.forEach(x=>(groups[x.category]||(groups[x.category]=[])).push(x));
  const groupHtml=Object.entries(groups).sort((a,b)=>sum(b[1])-sum(a[1])).map(([cat,list])=>`<details class="mgw-detail-group"><summary><span>${MGW.cats[cat]||'📦'} ${mgwEsc(cat)}</span><strong>${money(sum(list))}<i>›</i></strong></summary><div class="mgw-detail-body">${mgwDetailRows(list)}</div></details>`).join('');
  host.innerHTML=`<details class="mgw-month-details"><summary><span><b>Monthly Details</b><small>Tap to expand income, bills & allocations</small></span><strong>${ex.length} records <i>›</i></strong></summary><div class="mgw-month-body"><section><h3>💰 Income</h3>${inc.length?mgwIncomeRows(inc):'<p class="empty-state">No income recorded this month.</p>'}</section><section><h3>🧾 Payments & Allocations</h3>${groupHtml||'<p class="empty-state">No payments recorded this month.</p>'}</section></div></details>`;
}

// Extend the existing renderer without forcing a second full render during initial load.
if (typeof renderAll === 'function') {
  const mgwBaseRenderAll=renderAll;
  renderAll=function(){mgwBaseRenderAll();renderMonthlyDetails()};
}

function mgwInstallVersionBadge(){
  const header=document.querySelector('.topbar > div:first-child');
  if(!header || document.querySelector('#appVersionBadge')) return;
  const badge=document.createElement('span');
  badge.id='appVersionBadge';
  badge.className='app-version-badge';
  badge.textContent=`v${MGW_RELEASE.appVersion}`;
  badge.title=`App ${MGW_RELEASE.appVersion} · Schema ${MGW_RELEASE.schemaVersion} · Data ${MGW_RELEASE.dataVersion}`;
  header.appendChild(badge);
}

function mgwExportCompleteBackup(){
  const payload={...db,backupMeta:{appVersion:MGW_RELEASE.appVersion,schemaVersion:MGW_RELEASE.schemaVersion,dataVersion:MGW_RELEASE.dataVersion,cacheVersion:MGW_RELEASE.cacheVersion,exportedAt:new Date().toISOString()}};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`MoneyGoWhere-backup-v${MGW_RELEASE.appVersion}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  if(typeof toast==='function') toast('Complete backup exported');
}

document.addEventListener('DOMContentLoaded',()=>{
  mgwInstallVersionBadge();
  const trend=document.querySelector('#trendBars')?.closest('.card');
  if(trend && !document.querySelector('#monthlyDetails')){
    const wrap=document.createElement('article');wrap.className='card';wrap.id='monthlyDetails';trend.insertAdjacentElement('beforebegin',wrap);
  }
  renderMonthlyDetails();

  // Replace the basic backup action with a versioned backup while preserving restore compatibility.
  const exportBtn=document.querySelector('#exportBtn');
  exportBtn?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();mgwExportCompleteBackup()},{capture:true});

  // When an update is ready to install, remind the user to back up before allowing activation.
  const refreshBtn=document.querySelector('#refreshBtn');
  refreshBtn?.addEventListener('click',e=>{
    if(!refreshBtn.classList.contains('update-available')) return;
    const proceed=window.confirm('Backup recommended before updating MoneyGoWhere. Export your database and preferences first if you have not done so. Continue installing the update?');
    if(!proceed){e.preventDefault();e.stopImmediatePropagation();if(typeof toast==='function')toast('Update paused — create a backup first');}
  },{capture:true});
});
