// MoneyGoWhere v1.5.2 — Smart Budget & Insights
// Local-first deterministic advisor. No finance data leaves the browser.
(() => {
  const RELEASE='1.5.2';
  const num=v=>Math.max(0,Number(v)||0);
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=()=>`COMMIT-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const persist=()=>{localStorage.setItem(MGW.key,JSON.stringify(db));if(typeof renderAll==='function')renderAll();};
  const expenses=()=>typeof monthExpenses==='function'?monthExpenses(MGW.state.month):[];
  const incomes=()=>typeof monthIncome==='function'?monthIncome(MGW.state.month):[];
  const netIncome=()=>incomes().reduce((t,x)=>t+num(x.netSalary),0);
  const spend=()=>expenses().reduce((t,x)=>t+num(x.amount),0);

  function ensureStore(){db.monthlyCommitments=Array.isArray(db.monthlyCommitments)?db.monthlyCommitments:[];}
  function paidInCycle(type,accountId){
    const rows=type==='card'?(db.creditPayments||[]):(db.payLaterPayments||[]);
    return rows.filter(x=>x.accountId===accountId&&(typeof mgwInCycle!=='function'||mgwInCycle(x,MGW.state.month))).reduce((t,x)=>t+num(x.amount),0);
  }
  function fixedCommitments(){return db.monthlyCommitments.filter(x=>x.active!==false).reduce((t,x)=>t+num(x.amount),0)}
  function debtCommitments(){return (db.creditAccounts||[]).filter(a=>a.role==='debt'||a.role==='emergency-debt').reduce((t,a)=>t+Math.max(num(a.plannedPayment),paidInCycle('card',a.id)),0)}
  function payLaterCommitments(){return (db.payLaterAccounts||[]).reduce((t,a)=>t+num(a.cycleDue)+paidInCycle('later',a.id),0)}
  function reserve(){return num(db.settings?.safeSpend?.reserve)}
  function budgetPosition(){
    const income=netIncome(),fixed=fixedCommitments(),debt=debtCommitments(),later=payLaterCommitments(),held=reserve();
    const after=Math.max(0,income-fixed-debt-later-held),tracked=spend();
    const monthlyBudget=num(db.budgets?.monthly),budgetLeft=monthlyBudget?Math.max(0,monthlyBudget-tracked):null;
    return {income,fixed,debt,later,held,after,tracked,monthlyBudget,budgetLeft};
  }

  function addStyles(){
    if(document.querySelector('#mgwSmartBudgetStyles'))return;
    const s=document.createElement('style');s.id='mgwSmartBudgetStyles';s.textContent=`
      .mgw-budget-after .mgw-budget-hero{text-align:center;padding:8px 0 14px}.mgw-budget-after .mgw-budget-hero strong{display:block;font-size:1.8rem;margin:4px 0}.mgw-budget-grid{display:grid;grid-template-columns:1fr auto;gap:8px 14px;font-size:.92rem}.mgw-budget-grid strong{text-align:right}.mgw-advice{display:grid;gap:9px}.mgw-advice-item{padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.07)}.mgw-advice-item b{display:block;margin-bottom:3px}.mgw-commit-list{display:grid;gap:10px;margin-top:12px}.mgw-commit{border:1px solid var(--border,#dbe4e4);border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:12px;align-items:center}.mgw-commit small{display:block;opacity:.7}.mgw-commit-actions{display:flex;gap:6px;flex-wrap:wrap}.mgw-commit-actions button{border:0;border-radius:9px;padding:7px 9px}.mgw-pill{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(127,127,127,.1);font-size:.75rem;margin-left:6px}`;document.head.appendChild(s);
  }

  function moveInsightToTop(){
    const insight=document.querySelector('#budgetAlertCard'),month=document.querySelector('.month-row');
    if(!insight||!month)return;if(month.nextElementSibling!==insight)month.insertAdjacentElement('afterend',insight);
    const head=insight.querySelector('.card-head b');if(head)head.textContent='Smart Spending Advisor';const icon=insight.querySelector('.section-icon');if(icon)icon.textContent='🧠';
  }
  function installBudgetCard(){
    const insight=document.querySelector('#budgetAlertCard');if(!insight||document.querySelector('#mgwBudgetAfterCommitments'))return;
    const card=document.createElement('article');card.className='card mgw-budget-after';card.id='mgwBudgetAfterCommitments';insight.insertAdjacentElement('afterend',card);
  }
  function renderBudgetCard(){
    const card=document.querySelector('#mgwBudgetAfterCommitments');if(!card)return;const p=budgetPosition();
    card.innerHTML=`<div class="card-head"><div><span class="section-icon">🧮</span><b>Budget After Commitments</b></div></div><div class="mgw-budget-hero"><small>Available before variable / discretionary spending</small><strong>${money(p.after)}</strong><small>Safe to Spend below remains the live post-spending figure</small></div><div class="mgw-budget-grid"><span>Net income</span><strong>${money(p.income)}</strong><span>Fixed monthly commitments</span><strong>−${money(p.fixed)}</strong><span>Debt repayments</span><strong>−${money(p.debt)}</strong><span>Pay-Later commitments</span><strong>−${money(p.later)}</strong><span>Reserved money</span><strong>−${money(p.held)}</strong></div><p class="mgw-muted">Fixed commitments are deducted once as planned obligations. Tracked expenses are intentionally not deducted again here, preventing double-counting. Credit limits are excluded.</p>`;
  }

  function previousAnchors(n=3){const out=[];const base=MGW.state.month;for(let i=1;i<=n;i++)out.push(new Date(base.getFullYear(),base.getMonth()-i,1));return out}
  function categoryTotals(list){return list.reduce((m,x)=>{const k=x.category||'Other';m[k]=(m[k]||0)+num(x.amount);return m},{})}
  function buildAdvice(){
    const p=budgetPosition(),items=[],income=p.income||0,commit=p.fixed+p.debt+p.later+p.held,ratio=income?commit/income:0;
    const status=(level,title,text)=>items.push({level,title,text});
    if(!income)status('🟡','Add income for this cycle','MoneyGoWhere needs net income to calculate Budget After Commitments and affordability guidance.');
    else if(ratio>=.8)status('🔴','Commitments are very high',`${Math.round(ratio*100)}% of this cycle’s income is reserved for fixed commitments, debt, installments and reserves.`);
    else if(ratio>=.6)status('🟠','Commitment pressure is elevated',`${Math.round(ratio*100)}% of this cycle’s income is already committed before day-to-day spending.`);
    else status('🟢','Commitments are manageable',`${Math.round(ratio*100)}% of this cycle’s income is currently reserved for commitments and reserves.`);
    if(p.monthlyBudget&&p.budgetLeft===0&&p.tracked>0)status('🔴','Personal spending budget reached',`Tracked spending of ${money(p.tracked)} has used the configured spending budget for this cycle.`);
    else if(p.monthlyBudget&&p.budgetLeft/p.monthlyBudget<.2)status('🟠','Personal spending budget is running low',`Only ${money(p.budgetLeft)} remains in the configured spending budget.`);
    const current=categoryTotals(expenses()),prev=previousAnchors(3).map(a=>categoryTotals(typeof monthExpenses==='function'?monthExpenses(a):[]));
    Object.entries(current).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([cat,val])=>{const hist=prev.map(x=>num(x[cat])).filter(v=>v>0);if(hist.length<2)return;const avg=hist.reduce((a,b)=>a+b,0)/hist.length;if(avg>0&&val>avg*1.25)status('🟡',`${cat} is above your recent pattern`,`${money(val)} this cycle is ${Math.round((val/avg-1)*100)}% above your recent ${hist.length}-cycle average.`);});
    const due=p.debt+p.later;if(due>0)status('🟢','Debt and installment allocation protected',`${money(due)} is being kept aside for card debt and Pay-Later commitments this cycle.`);
    return items.slice(0,4);
  }
  function renderAdvisor(){
    const text=document.querySelector('#budgetAlertText');if(!text)return;const items=buildAdvice();
    text.innerHTML=`<div class="mgw-advice">${items.map(x=>`<div class="mgw-advice-item"><b>${x.level} ${esc(x.title)}</b><span>${esc(x.text)}</span></div>`).join('')}</div><p class="mgw-muted">Local advisor: recommendations are rule-based from your MoneyGoWhere data and are not financial advice.</p>`;
  }

  function installSettings(){
    const view=document.querySelector('#view-settings');if(!view||document.querySelector('#mgwCommitmentSettings'))return;const card=document.createElement('article');card.className='card';card.id='mgwCommitmentSettings';const privacy=view.querySelector('.privacy-note');view.insertBefore(card,privacy||null);
  }
  function renderSettings(){
    const host=document.querySelector('#mgwCommitmentSettings');if(!host)return;
    host.innerHTML=`<div class="card-head"><div><span class="section-icon">📌</span><b>Monthly Commitments</b></div><button class="text-btn" id="mgwAddCommitment">＋ Add</button></div><p class="mgw-muted">Use this for recurring obligations such as utilities, insurance, loans or season parking. Do not duplicate card debt or Pay-Later amounts already tracked elsewhere.</p><div class="mgw-commit-list">${db.monthlyCommitments.length?db.monthlyCommitments.map(renderCommitment).join(''):'<p class="mgw-empty">No fixed monthly commitments configured yet.</p>'}</div>`;
    host.querySelector('#mgwAddCommitment')?.addEventListener('click',()=>openCommitment());
    host.querySelectorAll('[data-commit-edit]').forEach(b=>b.addEventListener('click',()=>openCommitment(db.monthlyCommitments.find(x=>x.id===b.dataset.commitEdit))));
    host.querySelectorAll('[data-commit-toggle]').forEach(b=>b.addEventListener('click',()=>{const x=db.monthlyCommitments.find(x=>x.id===b.dataset.commitToggle);if(x){x.active=x.active===false;persist();}}));
  }
  function renderCommitment(x){return `<div class="mgw-commit"><div><b>${esc(x.name)}</b><small>${esc(x.type||'Fixed commitment')}${x.dueDay?` · due day ${x.dueDay}`:''}<span class="mgw-pill">${x.active===false?'Paused':'Active'}</span></small></div><div><strong>${money(num(x.amount))}</strong><div class="mgw-commit-actions"><button data-commit-edit="${x.id}">Edit</button><button data-commit-toggle="${x.id}">${x.active===false?'Resume':'Pause'}</button></div></div></div>`}
  function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;m.showModal();return body}
  function openCommitment(x={}){
    const edit=Boolean(x.id),body=showModal(edit?'Edit Monthly Commitment':'Add Monthly Commitment',`<form id="mgwCommitForm" class="form-grid"><div class="field full"><label>Name</label><input name="name" required value="${esc(x.name||'')}" placeholder="e.g. Insurance"></div><div class="field"><label>Monthly amount</label><input name="amount" type="number" min="0" step="0.01" required value="${x.amount??''}"></div><div class="field"><label>Type</label><select name="type"><option>Utility</option><option>Insurance</option><option>Loan</option><option>Housing</option><option>Transport</option><option>Family</option><option>Subscription</option><option>Other</option></select></div><div class="field"><label>Due day (optional)</label><input name="dueDay" type="number" min="1" max="31" value="${x.dueDay??''}"></div><div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Commitment'}</button></div>${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteCommit">Delete Commitment</button></div>':''}</form>`);
    const f=body.querySelector('form');f.elements.type.value=x.type||'Other';f.addEventListener('submit',e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));o.amount=num(o.amount);o.dueDay=o.dueDay===''?'':Math.min(31,Math.max(1,Number(o.dueDay)||1));o.id=x.id||id();o.active=x.active!==false;if(edit)Object.assign(x,o);else db.monthlyCommitments.push(o);persist();document.querySelector('#modal').close();toast(edit?'Commitment updated':'Commitment added')});
    body.querySelector('#mgwDeleteCommit')?.addEventListener('click',()=>{if(!confirm('Delete this monthly commitment?'))return;db.monthlyCommitments=db.monthlyCommitments.filter(a=>a.id!==x.id);persist();document.querySelector('#modal').close();toast('Commitment deleted')});
  }

  function renderSmart(){ensureStore();moveInsightToTop();installBudgetCard();installSettings();renderBudgetCard();renderAdvisor();renderSettings();const badge=document.querySelector('#appVersionBadge');if(badge)badge.textContent=`v${RELEASE}`}
  function boot(){ensureStore();addStyles();moveInsightToTop();installBudgetCard();installSettings();if(typeof renderAll==='function'&&!renderAll.__mgwSmartBudget){const prior=renderAll;const wrapped=function(){prior();renderSmart()};wrapped.__mgwSmartBudget=true;renderAll=wrapped}renderSmart()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
