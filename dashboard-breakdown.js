// MoneyGoWhere v1.5.5-dev — Dashboard spending breakdown
// Generic/local-only UI. No personal finance records are bundled with the app.
(()=>{
'use strict';
const RELEASE='1.5.5-dev';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
const fmtDate=v=>{const s=String(v||'').slice(0,10);if(!s)return 'No date';const d=new Date(`${s}T00:00:00`);return Number.isNaN(d.getTime())?s:d.toLocaleDateString('en-SG',{day:'numeric',month:'short'})};
const currentExpenses=()=>typeof monthExpenses==='function'?monthExpenses(MGW.state.month):[];
const sumRows=rows=>rows.reduce((t,x)=>t+num(x.amount),0);
const iconFor=cat=>MGW?.cats?.[cat]||'📦';

function installStyles(){
  if(document.querySelector('#mgwDashboardBreakdownStyles'))return;
  const s=document.createElement('style');s.id='mgwDashboardBreakdownStyles';
  s.textContent=`
    #topCategories.mgw-top-breakdown{display:grid;gap:10px}
    .mgw-spend-detail,.mgw-recurring-detail{border:1px solid var(--border,#dbe4e4);border-radius:14px;overflow:hidden;background:var(--card,#fff)}
    .mgw-spend-detail>summary,.mgw-recurring-detail>summary{list-style:none;cursor:pointer;padding:12px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}
    .mgw-spend-detail>summary::-webkit-details-marker,.mgw-recurring-detail>summary::-webkit-details-marker{display:none}
    .mgw-spend-main{display:flex;gap:10px;align-items:center;min-width:0}.mgw-spend-copy{min-width:0}.mgw-spend-copy b{display:block}.mgw-spend-copy small{display:block;opacity:.68;margin-top:2px}
    .mgw-spend-summary-amount{text-align:right;white-space:nowrap}.mgw-spend-summary-amount strong{display:block}.mgw-spend-summary-amount small{opacity:.6}
    .mgw-spend-bar{grid-column:1/-1;height:7px;border-radius:999px;background:var(--soft,#edf2f1);overflow:hidden}.mgw-spend-bar i{display:block;height:100%;background:var(--accent,#128277);border-radius:inherit}
    .mgw-spend-body{border-top:1px solid var(--border,#dbe4e4);padding:4px 12px 10px}
    .mgw-spend-line{display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#eef1f1)}.mgw-spend-line:last-child{border-bottom:0}.mgw-spend-line b{display:block}.mgw-spend-line small{display:block;opacity:.65;margin-top:2px}.mgw-spend-line strong{white-space:nowrap}
    .mgw-recurring-detail{margin-top:2px}.mgw-recurring-detail>summary{background:rgba(18,130,119,.055)}.mgw-recurring-group{padding:8px 0}.mgw-recurring-group+.mgw-recurring-group{border-top:1px solid var(--border,#eef1f1)}.mgw-recurring-group-title{display:flex;justify-content:space-between;gap:10px;font-weight:800;padding:5px 0}.mgw-recurring-pill{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;font-size:.7rem;background:rgba(180,120,0,.12)}
  `;
  document.head.appendChild(s);
}

function expenseRows(cat){
  return currentExpenses().filter(x=>(x.category||'Other')===cat).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||num(b.amount)-num(a.amount));
}
function renderExpenseLine(x){
  const title=x.vendor||x.notes||x.category||'Expense';
  const meta=[fmtDate(x.date),x.location,x.notes].filter(Boolean).join(' · ');
  return `<div class="mgw-spend-line"><div><b>${esc(title)}</b><small>${esc(meta)}</small></div><strong>${money(num(x.amount))}</strong></div>`;
}
function activeRecurringForCurrentCycle(x){
  if(x?.active===false)return false;
  if(window.MGWRecurringBills?.billsForMonth){
    const key=window.MGWRecurring?.monthKey?.(MGW.state.month)||`${MGW.state.month.getFullYear()}-${String(MGW.state.month.getMonth()+1).padStart(2,'0')}`;
    return window.MGWRecurringBills.billsForMonth(key).some(r=>r===x||r.id===x.id);
  }
  return x?.active!==false;
}
function recurringGroups(){
  const rows=Array.isArray(db?.recurringBills)?db.recurringBills:[];
  const groups=new Map();
  for(const x of rows){const g=x.group||x.category||'Other';if(!groups.has(g))groups.set(g,[]);groups.get(g).push(x)}
  return [...groups.entries()];
}
function recurringSection(){
  const groups=recurringGroups();
  if(!groups.length)return '';
  const activeRows=(db.recurringBills||[]).filter(activeRecurringForCurrentCycle),activeTotal=sumRows(activeRows);
  const body=groups.map(([group,rows])=>{
    const groupActive=rows.filter(activeRecurringForCurrentCycle),groupTotal=sumRows(groupActive);
    const lines=rows.map(x=>`<div class="mgw-spend-line"><div><b>${esc(x.name||x.merchant||'Recurring bill')}${x.confidence==='review'?'<span class="mgw-recurring-pill">Review</span>':''}</b><small>${esc([x.category,x.frequency,x.dueDay?`around day ${x.dueDay}`:'',x.active===false?'Paused':''].filter(Boolean).join(' · '))}</small></div><strong>${money(num(x.amount))}</strong></div>`).join('');
    return `<section class="mgw-recurring-group"><div class="mgw-recurring-group-title"><span>${esc(group)}</span><span>${money(groupTotal)} active</span></div>${lines}</section>`;
  }).join('');
  return `<details class="mgw-recurring-detail"><summary><div class="mgw-spend-main"><span class="cat-icon">🔁</span><div class="mgw-spend-copy"><b>Recurring Bills & Subscriptions</b><small>Planned recurring commitments · separate from actual spending</small></div></div><div class="mgw-spend-summary-amount"><strong>${money(activeTotal)}</strong><small>active this cycle</small></div></summary><div class="mgw-spend-body">${body}</div></details>`;
}
function renderTopBreakdown(el,cats){
  if(!cats?.length){el.className='category-list empty-state';el.textContent='No spending data yet.';return}
  const displayed=cats.slice(0,5),displayedTotal=displayed.reduce((t,[,v])=>t+num(v),0)||1,max=displayed[0]?.[1]||1;
  el.className='mgw-top-breakdown';
  el.innerHTML=displayed.map(([cat,val])=>{
    const rows=expenseRows(cat),pct=val/displayedTotal*100;
    return `<details class="mgw-spend-detail"><summary><div class="mgw-spend-main"><span class="cat-icon">${iconFor(cat)}</span><div class="mgw-spend-copy"><b>${esc(cat)}</b><small>${pct.toFixed(0)}% of displayed spending · ${rows.length} ${rows.length===1?'entry':'entries'}</small></div></div><div class="mgw-spend-summary-amount"><strong>${money(val)}</strong><small>tap to expand</small></div><div class="mgw-spend-bar"><i style="width:${Math.min(100,val/max*100)}%"></i></div></summary><div class="mgw-spend-body">${rows.map(renderExpenseLine).join('')||'<p class="mgw-muted">No matching transactions found.</p>'}</div></details>`;
  }).join('')+recurringSection();
}
function install(){
  installStyles();
  if(typeof renderCats!=='function'||renderCats.__mgwDashboardBreakdown)return;
  const base=renderCats;
  const wrapped=function(el,cats){if(el?.id==='topCategories')return renderTopBreakdown(el,cats);return base(el,cats)};
  wrapped.__mgwDashboardBreakdown=true;renderCats=wrapped;
  if(typeof renderDashboard==='function')renderDashboard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.MGWDashboardBreakdown={version:RELEASE,render:()=>renderTopBreakdown(document.querySelector('#topCategories'),catTotals(currentExpenses()).slice(0,5))};
})();