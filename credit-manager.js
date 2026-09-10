// MoneyGoWhere v1.5.1 — Credit, Debt & Pay-Later Manager
// Local-first: this file contains no personal account names, balances, limits or finance records.
(() => {
  const RELEASE='1.5.1';
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Math.max(0,Number(v)||0);
  const id=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const today=()=>new Date().toISOString().slice(0,10);
  const norm=v=>String(v||'').trim().toLowerCase();
  const persist=()=>{localStorage.setItem(MGW.key,JSON.stringify(db)); if(typeof renderAll==='function')renderAll();};

  function ensureStore(){
    db.creditAccounts=Array.isArray(db.creditAccounts)?db.creditAccounts:[];
    db.creditPayments=Array.isArray(db.creditPayments)?db.creditPayments:[];
    db.payLaterAccounts=Array.isArray(db.payLaterAccounts)?db.payLaterAccounts:[];
    db.payLaterPayments=Array.isArray(db.payLaterPayments)?db.payLaterPayments:[];
    db.settings=db.settings||{};
    db.settings.safeSpend=db.settings.safeSpend||{reserve:0};
  }

  function cycleExpenses(){return typeof monthExpenses==='function'?monthExpenses(MGW.state.month):[]}
  function cycleIncome(){return typeof monthIncome==='function'?monthIncome(MGW.state.month):[]}
  function expenseMatchesAccount(x,a){const c=norm(x.card||x.paymentSource||x.paymentMethod);return c&&(c===norm(a.name)||c.includes(norm(a.name))||norm(a.name).includes(c))}
  function cycleSpendForCard(a){return cycleExpenses().filter(x=>expenseMatchesAccount(x,a)).reduce((t,x)=>t+num(x.amount),0)}
  function cycleSpendForPayLater(a){return cycleExpenses().filter(x=>expenseMatchesAccount(x,a)).reduce((t,x)=>t+num(x.amount),0)}
  function paidInCycle(type,accountId){
    const rows=type==='card'?db.creditPayments:db.payLaterPayments;
    return rows.filter(x=>x.accountId===accountId && (typeof mgwInCycle!=='function'||mgwInCycle(x,MGW.state.month))).reduce((t,x)=>t+num(x.amount),0);
  }
  function cycleNetIncome(){return cycleIncome().reduce((t,x)=>t+num(x.netSalary),0)}
  function payLaterNames(){return db.payLaterAccounts.map(a=>norm(a.name)).filter(Boolean)}
  function immediateSpend(){
    const deferred=payLaterNames();
    return cycleExpenses().filter(x=>!deferred.some(n=>{const c=norm(x.card||x.paymentSource||x.paymentMethod);return c&&(c===n||c.includes(n)||n.includes(c))})).reduce((t,x)=>t+num(x.amount),0);
  }
  function debtCommitments(){return db.creditAccounts.filter(a=>a.role==='debt'||a.role==='emergency-debt').reduce((t,a)=>t+num(a.plannedPayment),0)}
  function payLaterDue(){return db.payLaterAccounts.reduce((t,a)=>t+num(a.cycleDue),0)}
  function safePosition(){
    const income=cycleNetIncome(),spent=immediateSpend(),debt=debtCommitments(),later=payLaterDue(),reserve=num(db.settings.safeSpend?.reserve);
    const cash=Math.max(0,income-spent-debt-later-reserve);
    const budget=num(db.budgets?.monthly),budgetLeft=budget?Math.max(0,budget-cycleExpenses().reduce((t,x)=>t+num(x.amount),0)):null;
    return {income,spent,debt,later,reserve,cash,budgetLeft,safe:budgetLeft===null?cash:Math.min(cash,budgetLeft)};
  }
  function daysLeft(){
    if(typeof mgwCycleBounds!=='function')return 1;
    const b=mgwCycleBounds(MGW.state.month),now=new Date();now.setHours(0,0,0,0);
    const start=new Date(b.start);start.setHours(0,0,0,0);const end=new Date(b.end);end.setHours(0,0,0,0);
    if(now<start||now>=end)return Math.max(1,Math.ceil((end-start)/86400000));
    return Math.max(1,Math.ceil((end-now)/86400000));
  }

  function addStyles(){
    if(document.querySelector('#mgwCreditStyles'))return;
    const s=document.createElement('style');s.id='mgwCreditStyles';s.textContent=`
      .mgw-safe{padding:18px}.mgw-safe-hero{text-align:center;padding:8px 0 16px}.mgw-safe-hero small{display:block}.mgw-safe-hero strong{display:block;font-size:2rem;margin:4px 0}.mgw-safe-grid{display:grid;grid-template-columns:1fr auto;gap:8px 14px;font-size:.92rem}.mgw-safe-grid strong{text-align:right}.mgw-account-grid{display:grid;gap:12px}.mgw-account{border:1px solid var(--border,#dbe4e4);border-radius:14px;padding:14px}.mgw-account-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.mgw-account-head small{display:block;opacity:.7}.mgw-account-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.mgw-account-actions button{border:0;border-radius:10px;padding:8px 10px}.mgw-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.mgw-mini div{background:rgba(127,127,127,.07);padding:9px;border-radius:10px}.mgw-mini small,.mgw-mini strong{display:block}.mgw-util{height:7px;background:rgba(127,127,127,.15);border-radius:9px;overflow:hidden;margin-top:10px}.mgw-util i{display:block;height:100%;background:currentColor;border-radius:9px}.mgw-section-gap{margin-top:14px}.mgw-inline-actions{display:flex;gap:8px;flex-wrap:wrap}.mgw-inline-actions button{flex:1;min-width:130px}.mgw-warning{font-size:.82rem;margin-top:8px}.mgw-muted{opacity:.7;font-size:.85rem}.mgw-empty{padding:10px 0;opacity:.7}.mgw-form-note{padding:10px;border-radius:10px;background:rgba(127,127,127,.08);font-size:.85rem}`;document.head.appendChild(s);
  }

  function installDashboard(){
    const view=document.querySelector('#view-dashboard');if(!view||document.querySelector('#mgwSafeSpendCard'))return;
    const card=document.createElement('article');card.className='card mgw-safe';card.id='mgwSafeSpendCard';
    const metric=view.querySelector('.metric-grid');if(metric)metric.insertAdjacentElement('afterend',card);else view.prepend(card);
    const accounts=document.createElement('article');accounts.className='card';accounts.id='mgwAccountsDashboard';
    card.insertAdjacentElement('afterend',accounts);
  }

  function renderDashboardCredit(){
    const p=safePosition(),card=document.querySelector('#mgwSafeSpendCard');if(card){
      const daily=p.safe/daysLeft();
      card.innerHTML=`<div class="card-head"><div><span class="section-icon">💰</span><b>Safe to Spend</b></div><button class="text-btn" id="mgwEditReserve">Adjust</button></div><div class="mgw-safe-hero"><small>Available for the rest of this tracking period</small><strong>${money(p.safe)}</strong><small>${money(daily)}/day · ${daysLeft()} day${daysLeft()===1?'':'s'} remaining</small></div><div class="mgw-safe-grid"><span>Net income</span><strong>${money(p.income)}</strong><span>Tracked immediate spending</span><strong>−${money(p.spent)}</strong><span>Debt-payoff allocations</span><strong>−${money(p.debt)}</strong><span>Pay-later due</span><strong>−${money(p.later)}</strong><span>Additional reserve</span><strong>−${money(p.reserve)}</strong>${p.budgetLeft!==null?`<span>Personal budget left</span><strong>${money(p.budgetLeft)}</strong>`:''}</div><p class="mgw-muted">Available credit is intentionally excluded from Safe to Spend.</p>`;
      card.querySelector('#mgwEditReserve')?.addEventListener('click',openReserve);
    }
    const host=document.querySelector('#mgwAccountsDashboard');if(host){
      const cards=db.creditAccounts.map(renderCardSummary).join('');
      const later=db.payLaterAccounts.map(renderLaterSummary).join('');
      host.innerHTML=`<div class="card-head"><div><span class="section-icon">💳</span><b>Cards & Pay-Later</b></div><button class="text-btn" id="mgwManageAccounts">Manage</button></div><div class="mgw-account-grid">${cards||later?cards+later:'<p class="mgw-empty">No cards or pay-later accounts added yet.</p>'}</div>`;
      host.querySelector('#mgwManageAccounts')?.addEventListener('click',()=>{nav('settings');document.querySelector('#mgwCreditSettings')?.scrollIntoView({behavior:'smooth'})});
    }
  }

  function renderCardSummary(a){
    const limit=num(a.limit),out=num(a.outstanding),available=Math.max(0,limit-out),util=limit?Math.min(100,out/limit*100):0,spent=cycleSpendForCard(a),left=num(a.spendingBudget)?Math.max(0,num(a.spendingBudget)-spent):null,paid=paidInCycle('card',a.id),remainPlan=Math.max(0,num(a.plannedPayment)-paid);
    return `<div class="mgw-account"><div class="mgw-account-head"><div><b>💳 ${esc(a.name)}</b><small>${roleName(a.role)}</small></div><strong>${money(out)}</strong></div><div class="mgw-mini"><div><small>Credit limit</small><strong>${money(limit)}</strong></div><div><small>Available credit</small><strong>${money(available)}</strong></div><div><small>Spent this cycle</small><strong>${money(spent)}</strong></div><div><small>${left===null?'Planned payment':'Personal budget left'}</small><strong>${money(left===null?num(a.plannedPayment):left)}</strong></div></div>${limit?`<div class="mgw-util"><i style="width:${util}%"></i></div><p class="mgw-muted">${util.toFixed(1)}% credit utilisation${remainPlan?` · ${money(remainPlan)} repayment still planned`:''}</p>`:''}</div>`;
  }
  function renderLaterSummary(a){const paid=paidInCycle('later',a.id);return `<div class="mgw-account"><div class="mgw-account-head"><div><b>🧾 ${esc(a.name)}</b><small>Pay-Later / Installments</small></div><strong>${money(num(a.outstanding))}</strong></div><div class="mgw-mini"><div><small>Due this cycle</small><strong>${money(num(a.cycleDue))}</strong></div><div><small>Paid this cycle</small><strong>${money(paid)}</strong></div><div><small>Next due</small><strong>${a.nextDueDate?esc(a.nextDueDate):'—'}</strong></div><div><small>New purchases</small><strong>${money(cycleSpendForPayLater(a))}</strong></div></div></div>`}
  function roleName(r){return {'spending':'Main spending card','debt':'Debt payoff','emergency':'Emergency card','emergency-debt':'Debt payoff · Emergency card'}[r]||'Credit card'}

  function installSettings(){
    const view=document.querySelector('#view-settings');if(!view||document.querySelector('#mgwCreditSettings'))return;
    const card=document.createElement('article');card.className='card';card.id='mgwCreditSettings';
    const privacy=view.querySelector('.privacy-note');view.insertBefore(card,privacy||null);
  }
  function renderSettingsCredit(){
    const host=document.querySelector('#mgwCreditSettings');if(!host)return;
    host.innerHTML=`<div class="card-head"><div><span class="section-icon">💳</span><b>Credit, Debt & Pay-Later</b></div></div><p class="mgw-muted">Track bank credit separately from what you can safely afford to spend. Card repayments are not counted as a second expense.</p><div class="mgw-inline-actions"><button class="primary-btn" id="mgwAddCard">＋ Credit Card</button><button class="primary-btn" id="mgwAddLater">＋ Pay-Later</button></div><div class="mgw-section-gap mgw-account-grid">${db.creditAccounts.map(renderCardManage).join('')}${db.payLaterAccounts.map(renderLaterManage).join('')||(!db.creditAccounts.length?'<p class="mgw-empty">Add your cards and installment accounts to begin.</p>':'')}</div>`;
    host.querySelector('#mgwAddCard')?.addEventListener('click',()=>openCard());host.querySelector('#mgwAddLater')?.addEventListener('click',()=>openLater());
    host.querySelectorAll('[data-card-edit]').forEach(b=>b.addEventListener('click',()=>openCard(db.creditAccounts.find(a=>a.id===b.dataset.cardEdit))));
    host.querySelectorAll('[data-card-pay]').forEach(b=>b.addEventListener('click',()=>openPayment('card',db.creditAccounts.find(a=>a.id===b.dataset.cardPay))));
    host.querySelectorAll('[data-later-edit]').forEach(b=>b.addEventListener('click',()=>openLater(db.payLaterAccounts.find(a=>a.id===b.dataset.laterEdit))));
    host.querySelectorAll('[data-later-pay]').forEach(b=>b.addEventListener('click',()=>openPayment('later',db.payLaterAccounts.find(a=>a.id===b.dataset.laterPay))));
  }
  function renderCardManage(a){const diff=num(a.statementBalance)-num(a.outstanding);return `<div class="mgw-account"><div class="mgw-account-head"><div><b>${esc(a.name)}</b><small>${roleName(a.role)}</small></div><strong>${money(num(a.outstanding))}</strong></div><div class="mgw-mini"><div><small>Limit</small><strong>${money(num(a.limit))}</strong></div><div><small>Available</small><strong>${money(Math.max(0,num(a.limit)-num(a.outstanding)))}</strong></div><div><small>Personal cycle budget</small><strong>${money(num(a.spendingBudget))}</strong></div><div><small>Planned repayment</small><strong>${money(num(a.plannedPayment))}</strong></div></div>${a.statementBalance!==''&&a.statementBalance!=null?`<p class="mgw-warning">Statement reconciliation: ${Math.abs(diff)<.01?'✓ matches tracked outstanding':`${money(Math.abs(diff))} ${diff>0?'above':'below'} tracked outstanding`}</p>`:''}<div class="mgw-account-actions"><button data-card-edit="${a.id}">Edit / Reconcile</button><button data-card-pay="${a.id}">Record Payment</button></div></div>`}
  function renderLaterManage(a){return `<div class="mgw-account"><div class="mgw-account-head"><div><b>${esc(a.name)}</b><small>Pay-Later / Installments</small></div><strong>${money(num(a.outstanding))}</strong></div><div class="mgw-mini"><div><small>Due this cycle</small><strong>${money(num(a.cycleDue))}</strong></div><div><small>Next due</small><strong>${a.nextDueDate?esc(a.nextDueDate):'—'}</strong></div></div><div class="mgw-account-actions"><button data-later-edit="${a.id}">Edit</button><button data-later-pay="${a.id}">Record Payment</button></div></div>`}

  function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;m.showModal();return body}
  function openCard(a={}){
    const edit=Boolean(a.id),body=showModal(edit?'Edit Credit Card':'Add Credit Card',`<form id="mgwCardForm" class="form-grid"><div class="field full"><label>Card name</label><input name="name" required value="${esc(a.name||'')}" placeholder="e.g. Main cashback card"></div><div class="field"><label>Card role</label><select name="role"><option value="spending">Main spending</option><option value="debt">Debt payoff</option><option value="emergency">Emergency</option><option value="emergency-debt">Debt payoff + Emergency</option></select></div><div class="field"><label>Credit limit</label><input name="limit" type="number" min="0" step="0.01" value="${a.limit??''}"></div><div class="field"><label>Current outstanding / balance to settle</label><input name="outstanding" type="number" min="0" step="0.01" value="${a.outstanding??''}"></div><div class="field"><label>Starting debt balance</label><input name="startingBalance" type="number" min="0" step="0.01" value="${a.startingBalance??''}"></div><div class="field"><label>Latest statement balance</label><input name="statementBalance" type="number" min="0" step="0.01" value="${a.statementBalance??''}"></div><div class="field"><label>Minimum payment</label><input name="minimumPayment" type="number" min="0" step="0.01" value="${a.minimumPayment??''}"></div><div class="field"><label>Planned payment this cycle</label><input name="plannedPayment" type="number" min="0" step="0.01" value="${a.plannedPayment??''}"></div><div class="field"><label>Personal spending budget / cycle</label><input name="spendingBudget" type="number" min="0" step="0.01" value="${a.spendingBudget??''}"></div><div class="field"><label>Statement day</label><input name="statementDay" type="number" min="1" max="31" value="${a.statementDay??''}"></div><div class="field"><label>Payment due day</label><input name="dueDay" type="number" min="1" max="31" value="${a.dueDay??''}"></div><div class="field full"><div class="mgw-form-note">Credit limit controls utilisation only. Your personal spending budget controls affordability and is kept separate from available credit.</div></div><div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Card'}</button></div>${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteCard">Delete Card</button></div>':''}</form>`);
    const f=body.querySelector('#mgwCardForm');f.elements.role.value=a.role||'spending';f.addEventListener('submit',e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));['limit','outstanding','startingBalance','statementBalance','minimumPayment','plannedPayment','spendingBudget','statementDay','dueDay'].forEach(k=>o[k]=o[k]===''?'':Number(o[k]));o.id=a.id||id('CARD');if(!edit)db.creditAccounts.push(o);else Object.assign(a,o);persist();document.querySelector('#modal').close();toast(edit?'Card updated':'Card added')});
    body.querySelector('#mgwDeleteCard')?.addEventListener('click',()=>{if(!confirm('Delete this card tracker? Existing expense transactions will not be deleted.'))return;db.creditAccounts=db.creditAccounts.filter(x=>x.id!==a.id);db.creditPayments=db.creditPayments.filter(x=>x.accountId!==a.id);persist();document.querySelector('#modal').close();toast('Card tracker deleted')});
  }
  function openLater(a={}){
    const edit=Boolean(a.id),body=showModal(edit?'Edit Pay-Later':'Add Pay-Later',`<form id="mgwLaterForm" class="form-grid"><div class="field full"><label>Account / service name</label><input name="name" required value="${esc(a.name||'')}" placeholder="e.g. Pay-Later service"></div><div class="field"><label>Total outstanding</label><input name="outstanding" type="number" min="0" step="0.01" value="${a.outstanding??''}"></div><div class="field"><label>Due this cycle</label><input name="cycleDue" type="number" min="0" step="0.01" value="${a.cycleDue??''}"></div><div class="field full"><label>Next due date</label><input name="nextDueDate" type="date" value="${a.nextDueDate||''}"></div><div class="field full"><div class="mgw-form-note">Tag purchases with this account name in “Card / Payment Source”. MoneyGoWhere will count the installment due—not the full deferred purchase—toward Safe to Spend.</div></div><div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Pay-Later'}</button></div>${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteLater">Delete Pay-Later</button></div>':''}</form>`);
    const f=body.querySelector('#mgwLaterForm');f.addEventListener('submit',e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));['outstanding','cycleDue'].forEach(k=>o[k]=Number(o[k])||0);o.id=a.id||id('LATER');if(!edit)db.payLaterAccounts.push(o);else Object.assign(a,o);persist();document.querySelector('#modal').close();toast(edit?'Pay-Later updated':'Pay-Later added')});body.querySelector('#mgwDeleteLater')?.addEventListener('click',()=>{if(!confirm('Delete this Pay-Later tracker? Existing expense transactions will not be deleted.'))return;db.payLaterAccounts=db.payLaterAccounts.filter(x=>x.id!==a.id);db.payLaterPayments=db.payLaterPayments.filter(x=>x.accountId!==a.id);persist();document.querySelector('#modal').close();toast('Pay-Later tracker deleted')});
  }
  function openPayment(type,a){if(!a)return;const body=showModal('Record Payment',`<form id="mgwPaymentForm" class="form-grid"><div class="field full"><div class="mgw-form-note"><b>${esc(a.name)}</b><br>Payments reduce the tracked outstanding balance but are not added as a new expense, preventing double-counting.</div></div><div class="field"><label>Date</label><input name="date" type="date" required value="${today()}"></div><div class="field"><label>Amount</label><input name="amount" type="number" min="0.01" step="0.01" required></div><div class="field full"><label>Notes</label><input name="notes" placeholder="Optional"></div><div class="field full"><button class="primary-btn">Record Payment</button></div></form>`);const f=body.querySelector('form');f.addEventListener('submit',e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f)),amount=num(o.amount);o.id=id('PAY');o.accountId=a.id;o.amount=amount;(type==='card'?db.creditPayments:db.payLaterPayments).push(o);a.outstanding=Math.max(0,num(a.outstanding)-amount);if(type==='later')a.cycleDue=Math.max(0,num(a.cycleDue)-amount);persist();document.querySelector('#modal').close();toast('Payment recorded')})}
  function openReserve(){const body=showModal('Safe to Spend Reserve',`<form id="mgwReserveForm" class="form-grid"><div class="field full"><label>Additional reserve for this cycle</label><input name="reserve" type="number" min="0" step="0.01" value="${num(db.settings.safeSpend?.reserve)}"><small>Use this only for money you want ring-fenced beyond expenses, debt payments and installment dues already tracked.</small></div><div class="field full"><button class="primary-btn">Save Reserve</button></div></form>`);body.querySelector('form').addEventListener('submit',e=>{e.preventDefault();db.settings.safeSpend.reserve=num(new FormData(e.currentTarget).get('reserve'));persist();document.querySelector('#modal').close();toast('Safe-to-spend reserve updated')})}

  function enhanceExpenseForm(){
    if(typeof expenseForm!=='function'||expenseForm.__mgwCreditEnhanced)return;
    const base=expenseForm;
    const wrapped=function(type,d={}){let html=base(type,d);const names=[...db.creditAccounts,...db.payLaterAccounts].map(a=>a.name).filter(Boolean);if(!names.length)return html;const list=`<datalist id="mgwPaymentSources">${names.map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>`;html=html.replace(/<input name="card"([^>]*)>/,`<input name="card" list="mgwPaymentSources"$1>${list}`);return html};wrapped.__mgwCreditEnhanced=true;expenseForm=wrapped;
  }

  function renderCredit(){ensureStore();renderDashboardCredit();renderSettingsCredit()}
  function boot(){ensureStore();addStyles();installDashboard();installSettings();enhanceExpenseForm();const prior=renderAll;if(typeof prior==='function'&&!prior.__mgwCreditWrapped){const wrapped=function(){prior();renderCredit()};wrapped.__mgwCreditWrapped=true;renderAll=wrapped}renderCredit();const badge=document.querySelector('#appVersionBadge');if(badge)badge.textContent=`v${RELEASE}`}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();