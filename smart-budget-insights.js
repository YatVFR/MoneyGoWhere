// MoneyGoWhere v1.5.2 — Smart Budget & Insights
// Performance-optimized local-first deterministic advisor. No finance data leaves the browser.
(() => {
  const RELEASE='1.5.2';
  const num=v=>Math.max(0,Number(v)||0);
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const id=()=>`COMMIT-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const sum=(rows,getter)=>rows.reduce((t,x)=>t+num(getter(x)),0);
  const setHTML=(el,html)=>{if(el&&el.innerHTML!==html)el.innerHTML=html};
  const persist=()=>{localStorage.setItem(MGW.key,JSON.stringify(db));if(typeof renderAll==='function')renderAll();};
  let lastSettingsSignature='';

  function ensureStore(){db.monthlyCommitments=Array.isArray(db.monthlyCommitments)?db.monthlyCommitments:[]}
  function categoryTotals(list){return list.reduce((m,x)=>{const k=x.category||'Other';m[k]=(m[k]||0)+num(x.amount);return m},{})}
  function cyclePaymentMap(rows){
    const out=new Map();
    for(const x of rows){if(typeof mgwInCycle==='function'&&!mgwInCycle(x,MGW.state.month))continue;out.set(x.accountId,(out.get(x.accountId)||0)+num(x.amount));}
    return out;
  }
  function buildContext(){
    const expenses=typeof monthExpenses==='function'?monthExpenses(MGW.state.month):[];
    const incomes=typeof monthIncome==='function'?monthIncome(MGW.state.month):[];
    const cardPaid=cyclePaymentMap(db.creditPayments||[]),laterPaid=cyclePaymentMap(db.payLaterPayments||[]);
    const income=sum(incomes,x=>x.netSalary),spent=sum(expenses,x=>x.amount);
    const fixed=db.monthlyCommitments.reduce((t,x)=>x.active===false?t:t+num(x.amount),0);
    const debt=(db.creditAccounts||[]).reduce((t,a)=>(a.role==='debt'||a.role==='emergency-debt')?t+Math.max(num(a.plannedPayment),cardPaid.get(a.id)||0):t,0);
    const later=(db.payLaterAccounts||[]).reduce((t,a)=>t+num(a.cycleDue)+(laterPaid.get(a.id)||0),0);
    const held=num(db.settings?.safeSpend?.reserve),after=Math.max(0,income-fixed-debt-later-held);
    return {expenses,income,spent,fixed,debt,later,held,after,currentCats:categoryTotals(expenses)};
  }

  function addStyles(){
    if(document.querySelector('#mgwSmartBudgetStyles'))return;
    const s=document.createElement('style');s.id='mgwSmartBudgetStyles';s.textContent=`
      .mgw-budget-after .mgw-budget-hero{text-align:center;padding:8px 0 14px}.mgw-budget-after .mgw-budget-hero strong{display:block;font-size:1.8rem;margin:4px 0}.mgw-budget-grid{display:grid;grid-template-columns:1fr auto;gap:8px 14px;font-size:.92rem}.mgw-budget-grid strong{text-align:right}.mgw-advice{display:grid;gap:9px}.mgw-advice-item{padding:10px 12px;border-radius:12px;background:rgba(127,127,127,.07)}.mgw-advice-item b{display:block;margin-bottom:3px}.mgw-commit-list{display:grid;gap:10px;margin-top:12px}.mgw-commit{border:1px solid var(--border,#dbe4e4);border-radius:12px;padding:12px;display:flex;justify-content:space-between;gap:12px;align-items:center}.mgw-commit small{display:block;opacity:.7}.mgw-commit-actions{display:flex;gap:6px;flex-wrap:wrap}.mgw-commit-actions button{border:0;border-radius:9px;padding:7px 9px}.mgw-pill{display:inline-block;padding:2px 7px;border-radius:999px;background:rgba(127,127,127,.1);font-size:.75rem;margin-left:6px}`;document.head.appendChild(s);
  }
  function installStaticUI(){
    const view=document.querySelector('#view-dashboard'),insight=document.querySelector('#budgetAlertCard'),month=document.querySelector('.month-row');
    if(view&&insight&&month&&month.nextElementSibling!==insight)month.insertAdjacentElement('afterend',insight);
    if(insight){const head=insight.querySelector('.card-head b'),icon=insight.querySelector('.section-icon');if(head&&head.textContent!=='Smart Spending Advisor')head.textContent='Smart Spending Advisor';if(icon&&icon.textContent!=='🧠')icon.textContent='🧠'}
    if(insight&&!document.querySelector('#mgwBudgetAfterCommitments')){const card=document.createElement('article');card.className='card mgw-budget-after';card.id='mgwBudgetAfterCommitments';insight.insertAdjacentElement('afterend',card)}
    const settings=document.querySelector('#view-settings');if(settings&&!document.querySelector('#mgwCommitmentSettings')){const card=document.createElement('article');card.className='card';card.id='mgwCommitmentSettings';settings.insertBefore(card,settings.querySelector('.privacy-note')||null)}
  }
  function renderBudgetCard(p){
    const card=document.querySelector('#mgwBudgetAfterCommitments');if(!card)return;
    setHTML(card,`<div class="card-head"><div><span class="section-icon">🧮</span><b>Budget After Commitments</b></div></div><div class="mgw-budget-hero"><small>Available after planned monthly obligations</small><strong>${money(p.after)}</strong></div><div class="mgw-budget-grid"><span>Net income</span><strong>${money(p.income)}</strong><span>Fixed monthly commitments</span><strong>−${money(p.fixed)}</strong><span>Debt repayments</span><strong>−${money(p.debt)}</strong><span>Pay-Later commitments</span><strong>−${money(p.later)}</strong><span>Reserved money</span><strong>−${money(p.held)}</strong></div><p class="mgw-muted">Planning figure before day-to-day spending. Safe to Spend remains the live post-spending figure. Credit limits are excluded.</p>`);
  }
  function previousCategoryTotals(n=3){
    const base=MGW.state.month,bounds=[];
    for(let i=1;i<=n;i++){const a=new Date(base.getFullYear(),base.getMonth()-i,1);if(typeof mgwCycleBounds==='function'){const b=mgwCycleBounds(a);bounds.push([mgwDateKey(b.start),mgwDateKey(b.end)])}else{const m=`${a.getFullYear()}-${String(a.getMonth()+1).padStart(2,'0')}`;bounds.push([m+'-01',`${a.getFullYear()}-${String(a.getMonth()+2).padStart(2,'0')}-01`])}}
    const out=Array.from({length:n},()=>({}));
    for(const x of db.expenses||[]){const k=String(x.date||'').slice(0,10);if(!k)continue;for(let i=0;i<bounds.length;i++){const [start,end]=bounds[i];if(k>=start&&k<end){const c=x.category||'Other';out[i][c]=(out[i][c]||0)+num(x.amount);break;}}}
    return out;
  }
  function buildAdvice(p){
    const items=[],commit=p.fixed+p.debt+p.later+p.held,ratio=p.income?commit/p.income:0,add=(level,title,text)=>items.push({level,title,text});
    if(!p.income)add('🟡','Add income for this cycle','MoneyGoWhere needs net income to calculate affordability guidance.');
    else if(ratio>=.8)add('🔴','Commitments are very high',`${Math.round(ratio*100)}% of this cycle’s income is reserved for commitments, debt, installments and reserves.`);
    else if(ratio>=.6)add('🟠','Commitment pressure is elevated',`${Math.round(ratio*100)}% of this cycle’s income is already committed before day-to-day spending.`);
    else add('🟢','Commitments are manageable',`${Math.round(ratio*100)}% of this cycle’s income is currently reserved for commitments and reserves.`);
    const live=Math.max(0,p.after-p.spent);
    if(p.income&&live===0&&p.spent>0)add('🔴','Available budget has been used','Tracked spending has reached or exceeded the amount available after commitments.');
    else if(p.after&&live/p.after<.2)add('🟠','Low discretionary buffer',`Only ${money(live)} remains after commitments and tracked spending.`);
    const prev=previousCategoryTotals(3);
    Object.entries(p.currentCats).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([cat,val])=>{const hist=prev.map(x=>num(x[cat])).filter(v=>v>0);if(hist.length<2)return;const avg=hist.reduce((a,b)=>a+b,0)/hist.length;if(avg&&val>avg*1.25)add('🟡',`${cat} is above your recent pattern`,`${money(val)} this cycle is ${Math.round((val/avg-1)*100)}% above your recent ${hist.length}-cycle average.`)});
    const protectedAmount=p.debt+p.later;if(protectedAmount>0)add('🟢','Debt and installment allocation protected',`${money(protectedAmount)} is being kept aside for card debt and Pay-Later commitments this cycle.`);
    return items.slice(0,4);
  }
  function renderAdvisor(p){const text=document.querySelector('#budgetAlertText');if(!text)return;const items=buildAdvice(p);setHTML(text,`<div class="mgw-advice">${items.map(x=>`<div class="mgw-advice-item"><b>${x.level} ${esc(x.title)}</b><span>${esc(x.text)}</span></div>`).join('')}</div><p class="mgw-muted">Local advisor: recommendations are rule-based from your MoneyGoWhere data and are not financial advice.</p>`)}
  function renderCommitment(x){return `<div class="mgw-commit"><div><b>${esc(x.name)}</b><small>${esc(x.type||'Fixed commitment')}${x.dueDay?` · due day ${x.dueDay}`:''}<span class="mgw-pill">${x.active===false?'Paused':'Active'}</span></small></div><div><strong>${money(num(x.amount))}</strong><div class="mgw-commit-actions"><button data-commit-edit="${x.id}">Edit</button><button data-commit-toggle="${x.id}">${x.active===false?'Resume':'Pause'}</button></div></div></div>`}
  function renderSettings(){
    const host=document.querySelector('#mgwCommitmentSettings');if(!host)return;
    const signature=JSON.stringify(db.monthlyCommitments.map(x=>[x.id,x.name,x.amount,x.type,x.dueDay,x.active]));if(signature===lastSettingsSignature&&host.children.length)return;lastSettingsSignature=signature;
    setHTML(host,`<div class="card-head"><div><span class="section-icon">📌</span><b>Monthly Commitments</b></div><button class="text-btn" data-action="add-commitment">＋ Add</button></div><p class="mgw-muted">Use this for recurring obligations such as utilities, insurance, loans or season parking. Do not duplicate card debt or Pay-Later amounts already tracked elsewhere.</p><div class="mgw-commit-list">${db.monthlyCommitments.length?db.monthlyCommitments.map(renderCommitment).join(''):'<p class="mgw-empty">No fixed monthly commitments configured yet.</p>'}</div>`);
  }
  function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;m.showModal();return body}
  function openCommitment(x={}){
    const edit=Boolean(x.id),body=showModal(edit?'Edit Monthly Commitment':'Add Monthly Commitment',`<form id="mgwCommitForm" class="form-grid"><div class="field full"><label>Name</label><input name="name" required value="${esc(x.name||'')}" placeholder="e.g. Insurance"></div><div class="field"><label>Monthly amount</label><input name="amount" type="number" min="0" step="0.01" required value="${x.amount??''}"></div><div class="field"><label>Type</label><select name="type"><option>Utility</option><option>Insurance</option><option>Loan</option><option>Housing</option><option>Transport</option><option>Family</option><option>Subscription</option><option>Other</option></select></div><div class="field"><label>Due day (optional)</label><input name="dueDay" type="number" min="1" max="31" value="${x.dueDay??''}"></div><div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Commitment'}</button></div>${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteCommit">Delete Commitment</button></div>':''}</form>`);
    const f=body.querySelector('form');f.elements.type.value=x.type||'Other';f.addEventListener('submit',e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));o.amount=num(o.amount);o.dueDay=o.dueDay===''?'':Math.min(31,Math.max(1,Number(o.dueDay)||1));o.id=x.id||id();o.active=x.active!==false;if(edit)Object.assign(x,o);else db.monthlyCommitments.push(o);lastSettingsSignature='';persist();document.querySelector('#modal').close();toast(edit?'Commitment updated':'Commitment added')},{once:true});
    body.querySelector('#mgwDeleteCommit')?.addEventListener('click',()=>{if(!confirm('Delete this monthly commitment?'))return;db.monthlyCommitments=db.monthlyCommitments.filter(a=>a.id!==x.id);lastSettingsSignature='';persist();document.querySelector('#modal').close();toast('Commitment deleted')},{once:true});
  }
  function bindDelegatedEvents(){
    const host=document.querySelector('#mgwCommitmentSettings');if(!host||host.dataset.bound==='1')return;host.dataset.bound='1';host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.action==='add-commitment')return openCommitment();if(b.dataset.commitEdit){const x=db.monthlyCommitments.find(x=>x.id===b.dataset.commitEdit);if(x)return openCommitment(x)}if(b.dataset.commitToggle){const x=db.monthlyCommitments.find(x=>x.id===b.dataset.commitToggle);if(x){x.active=x.active===false;lastSettingsSignature='';persist()}}});
  }
  function renderSmart(){ensureStore();installStaticUI();const p=buildContext();renderBudgetCard(p);renderAdvisor(p);renderSettings();bindDelegatedEvents();const badge=document.querySelector('#appVersionBadge');if(badge&&badge.textContent!==`v${RELEASE}`)badge.textContent=`v${RELEASE}`}
  function boot(){ensureStore();addStyles();installStaticUI();bindDelegatedEvents();if(typeof renderAll==='function'&&!renderAll.__mgwSmartBudget){const prior=renderAll;const wrapped=function(){prior();renderSmart()};wrapped.__mgwSmartBudget=true;renderAll=wrapped}renderSmart()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();