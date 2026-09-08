// MoneyGoWhere finance model compatibility + detailed drill-down.
// Legacy netSalary already represents total take-home pay for the month.
if (typeof totals === 'function') {
  totals = function(d) {
    const ex = sum(monthExpenses(d));
    const inc = monthIncome(d);
    const net = inc.reduce((t, x) => t + (Number(x.netSalary) || 0), 0);
    return { ex, net };
  };
}

function mgwEsc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function mgwDetailRows(list){return list.map(x=>`<div class="mgw-detail-row"><div><b>${mgwEsc(x.vendor||x.category||'Expense')}</b><small>${mgwEsc(x.category||'Other')}${x.notes?' · '+mgwEsc(x.notes):''}</small></div><strong>${money(x.amount)}</strong></div>`).join('')}
function mgwIncomeRows(list){return list.map(x=>`<div class="mgw-income-detail"><div><span>Base Salary</span><strong>${money(x.baseSalary)}</strong></div><div><span>Net Salary</span><strong>${money(x.netSalary)}</strong></div>${Number(x.bonus)?`<div><span>Bonus</span><strong>${money(x.bonus)}</strong></div>`:''}${Number(x.oneOff)?`<div><span>One-Off Payment</span><strong>${money(x.oneOff)}</strong></div>`:''}</div>`).join('')}
function renderMonthlyDetails(){
  let host=document.querySelector('#monthlyDetails'); if(!host)return;
  let d=MGW.state.month, ex=monthExpenses(d), inc=monthIncome(d), groups={};
  ex.forEach(x=>(groups[x.category]||(groups[x.category]=[])).push(x));
  let groupHtml=Object.entries(groups).sort((a,b)=>sum(b[1])-sum(a[1])).map(([cat,list])=>`<details class="mgw-detail-group"><summary><span>${MGW.cats[cat]||'📦'} ${mgwEsc(cat)}</span><strong>${money(sum(list))}<i>›</i></strong></summary><div class="mgw-detail-body">${mgwDetailRows(list)}</div></details>`).join('');
  host.innerHTML=`<details class="mgw-month-details"><summary><span><b>Monthly Details</b><small>Tap to expand income, bills & allocations</small></span><strong>${ex.length} records <i>›</i></strong></summary><div class="mgw-month-body"><section><h3>💰 Income</h3>${inc.length?mgwIncomeRows(inc):'<p class="empty-state">No income recorded this month.</p>'}</section><section><h3>🧾 Payments & Allocations</h3>${groupHtml||'<p class="empty-state">No payments recorded this month.</p>'}</section></div></details>`;
}

// Extend the existing renderer without replacing app.js.
if (typeof renderAll === 'function') {
  const mgwBaseRenderAll=renderAll;
  renderAll=function(){mgwBaseRenderAll();renderMonthlyDetails()};
}

document.addEventListener('DOMContentLoaded',()=>{
  const trend=document.querySelector('#trendBars')?.closest('.card');
  if(trend && !document.querySelector('#monthlyDetails')){
    const wrap=document.createElement('article');wrap.className='card';wrap.id='monthlyDetails';trend.insertAdjacentElement('beforebegin',wrap);
  }
  renderMonthlyDetails();
});

// Styles kept here so the feature can ship without changing the core stylesheet.
const mgwStyle=document.createElement('style');
mgwStyle.textContent=`#monthlyDetails{padding:0;overflow:hidden}.mgw-month-details>summary,.mgw-detail-group>summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:12px}.mgw-month-details>summary::-webkit-details-marker,.mgw-detail-group>summary::-webkit-details-marker{display:none}.mgw-month-details>summary{padding:18px}.mgw-month-details>summary span{display:grid}.mgw-month-details>summary small{font-weight:400;color:var(--muted);margin-top:3px}.mgw-month-details summary i{display:inline-block;font-style:normal;margin-left:7px;transition:.2s}.mgw-month-details[open]>summary>strong i,.mgw-detail-group[open]>summary>strong i{transform:rotate(90deg)}.mgw-month-body{border-top:1px solid var(--line);padding:8px 18px 18px}.mgw-month-body h3{font-size:14px;margin:16px 0 8px}.mgw-income-detail{background:#f8faf9;border-radius:14px;padding:8px 12px}.mgw-income-detail>div,.mgw-detail-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)}.mgw-income-detail>div:last-child,.mgw-detail-row:last-child{border-bottom:0}.mgw-detail-group{border-top:1px solid var(--line)}.mgw-detail-group>summary{padding:13px 2px}.mgw-detail-group>summary strong{font-size:14px}.mgw-detail-body{padding:0 2px 8px 32px}.mgw-detail-row div{min-width:0}.mgw-detail-row b,.mgw-detail-row small{display:block}.mgw-detail-row small{font-size:11px;color:var(--muted);margin-top:2px}.mgw-detail-row strong{white-space:nowrap}`;document.head.appendChild(mgwStyle);

if (typeof renderAll === 'function') renderAll();
