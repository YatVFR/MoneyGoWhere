// MoneyGoWhere v1.5.5-dev — Recurring Bills & Subscriptions
// Local-first: detects possible recurring charges from the user's local transaction history.
(()=>{
'use strict';
const RELEASE='1.5.5-dev';
const STEPS=Object.freeze({monthly:1,bimonthly:2,quarterly:3,halfyearly:6,yearly:12});
const num=v=>Math.max(0,Number(v)||0);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>`BILL-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const monthIndex=k=>{const [y,m]=String(k||'').split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN};
let signature='';

function ensure(){
  if(!window.db)return false;
  db.recurringBills=Array.isArray(db.recurringBills)?db.recurringBills:[];
  return true;
}
function save(){if(!ensure())return;localStorage.setItem(MGW.key,JSON.stringify(db));signature='';if(typeof renderAll==='function')renderAll();}
function active(rule,key){
  if(!rule||rule.active===false)return false;
  const cur=monthIndex(key),start=monthIndex(rule.startMonth||key),end=rule.endMonth?monthIndex(rule.endMonth):Infinity;
  if(!Number.isFinite(cur)||!Number.isFinite(start)||cur<start||cur>end)return false;
  return (cur-start)%(STEPS[rule.frequency]||1)===0;
}
function billsForMonth(key){ensure();return db.recurringBills.filter(x=>active(x,key));}
function totalForMonth(key){return billsForMonth(key).reduce((t,x)=>t+num(x.amount),0);}
window.MGWRecurringBills={version:RELEASE,ensure,billsForMonth,totalForMonth};

function installStyles(){
  if(document.querySelector('#mgwRecurringBillStyles'))return;
  const s=document.createElement('style');s.id='mgwRecurringBillStyles';
  s.textContent='.mgw-bill-list,.mgw-candidate-list{display:grid;gap:10px;margin-top:12px}.mgw-bill-row,.mgw-candidate-row{border:1px solid var(--border,#dbe4e4);border-radius:12px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start}.mgw-bill-row small,.mgw-candidate-row small{display:block;opacity:.72;margin-top:3px}.mgw-bill-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.mgw-bill-actions button{border:0;border-radius:9px;padding:7px 9px}.mgw-candidate-score{font-size:.72rem;font-weight:700;padding:3px 7px;border-radius:999px;background:rgba(19,122,111,.1);white-space:nowrap}.mgw-bill-toolbar{display:flex;gap:8px;flex-wrap:wrap}.mgw-bill-toolbar button{flex:1;min-width:140px}.mgw-bill-total{margin:10px 0 0;display:flex;justify-content:space-between;gap:12px;padding-top:10px;border-top:1px solid var(--border,#dbe4e4)}';
  document.head.appendChild(s);
}
function installUI(){
  const settings=document.querySelector('#view-settings');if(!settings||document.querySelector('#mgwRecurringBillsSettings'))return;
  const card=document.createElement('article');card.className='card';card.id='mgwRecurringBillsSettings';
  const recurring=document.querySelector('#mgwRecurringSettings');
  if(recurring)recurring.insertAdjacentElement('afterend',card);else settings.insertBefore(card,settings.querySelector('.privacy-note')||null);
}
function frequencyLabel(v){return {monthly:'Monthly',bimonthly:'Every 2 months',quarterly:'Quarterly',halfyearly:'Half-yearly',yearly:'Yearly'}[v]||'Monthly'}
function categoryLabel(v){return v||'Other'}
function renderBill(x){return `<div class="mgw-bill-row"><div><b>${esc(x.name||x.merchant||'Recurring bill')}</b><small>${esc(categoryLabel(x.category))} · ${esc(frequencyLabel(x.frequency))}${x.dueDay?` · around day ${x.dueDay}`:''}${x.endMonth?` · until ${esc(x.endMonth)}`:''}</small><small>${x.merchant?`Match: ${esc(x.merchant)}`:''}</small></div><div><strong>${money(num(x.amount))}</strong><div class="mgw-bill-actions"><button data-bill-edit="${x.id}">Edit</button><button data-bill-toggle="${x.id}">${x.active===false?'Resume':'Pause'}</button></div></div></div>`}
function currentKey(){return window.MGWRecurring?.monthKey?.(MGW.state.month)||monthKey(MGW.state.month)}
function render(){
  if(!ensure())return;installUI();const host=document.querySelector('#mgwRecurringBillsSettings');if(!host)return;
  const sig=JSON.stringify(db.recurringBills);if(sig===signature&&host.children.length)return;signature=sig;
  const total=totalForMonth(currentKey());
  host.innerHTML=`<div class="card-head"><div><span class="section-icon">🧾</span><b>Recurring Bills & Subscriptions</b></div></div><p class="mgw-muted">Subscriptions, telecoms, insurance premiums and other repeating charges. These are separate from manually defined Commitments.</p><div class="mgw-bill-toolbar"><button class="primary-btn" data-bill-add>＋ Add Recurring Bill</button><button data-bill-detect>🔎 Find Recurring Charges</button></div><div class="mgw-bill-list">${db.recurringBills.length?db.recurringBills.map(renderBill).join(''):'<p class="mgw-empty">No recurring bills configured yet.</p>'}</div><div class="mgw-bill-total"><span>Expected this cycle</span><strong>${money(total)}</strong></div><div id="mgwRecurringCandidates"></div>`;
}
function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;m.showModal();return body}
function openBill(x={}){
  const edit=Boolean(x.id),body=showModal(edit?'Edit Recurring Bill':'Add Recurring Bill',`<form id="mgwBillForm" class="form-grid"><div class="field full"><label>Name</label><input name="name" required value="${esc(x.name||'')}" placeholder="e.g. Netflix"></div><div class="field full"><label>Merchant match</label><input name="merchant" value="${esc(x.merchant||'')}" placeholder="e.g. NETFLIX.COM"><small>Used for matching transactions; optional.</small></div><div class="field"><label>Expected amount</label><input name="amount" type="number" min="0" step="0.01" required value="${x.amount??''}"></div><div class="field"><label>Category</label><select name="category"><option>Subscription</option><option>Telecom</option><option>Insurance</option><option>Utilities</option><option>Membership</option><option>Education</option><option>Other</option></select></div><div class="field"><label>Frequency</label><select name="frequency"><option value="monthly">Monthly</option><option value="bimonthly">Every 2 months</option><option value="quarterly">Quarterly</option><option value="halfyearly">Half-yearly</option><option value="yearly">Yearly</option></select></div><div class="field"><label>Expected day</label><input name="dueDay" type="number" min="1" max="31" value="${x.dueDay??''}"></div><div class="field"><label>Start month</label><input name="startMonth" type="month" value="${x.startMonth||currentKey()}"></div><div class="field"><label>End month (optional)</label><input name="endMonth" type="month" value="${x.endMonth||''}"></div><div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Recurring Bill'}</button></div>${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteBill">Delete Recurring Bill</button></div>':''}</form>`);
  const f=body.querySelector('form');f.elements.category.value=x.category||'Subscription';f.elements.frequency.value=x.frequency||'monthly';
  f.addEventListener('submit',e=>{e.preventDefault();const o=Object.fromEntries(new FormData(f));o.amount=num(o.amount);o.dueDay=o.dueDay===''?'':Math.min(31,Math.max(1,Number(o.dueDay)||1));o.id=x.id||uid();o.active=x.active!==false;if(edit)Object.assign(x,o);else db.recurringBills.push(o);save();document.querySelector('#modal').close();toast(edit?'Recurring bill updated':'Recurring bill added')},{once:true});
  body.querySelector('#mgwDeleteBill')?.addEventListener('click',()=>{if(!confirm('Delete this recurring bill? Existing expense transactions will not be deleted.'))return;db.recurringBills=db.recurringBills.filter(a=>a.id!==x.id);save();document.querySelector('#modal').close();toast('Recurring bill deleted')},{once:true});
}
function normalizedMerchant(v=''){
  return String(v).toUpperCase().replace(/\b(PTE\.? LTD\.?|SG|SINGAPORE|IE|SE)\b/g,' ').replace(/[0-9A-F]{6,}/g,' ').replace(/[^A-Z0-9&*.\/ -]/g,' ').replace(/\s+/g,' ').trim();
}
function detectCandidates(){
  const rows=(db.expenses||[]).filter(x=>x.date&&num(x.amount)>0&&x.vendor);
  const groups=new Map();
  for(const x of rows){const merchant=normalizedMerchant(x.vendor);if(!merchant)continue;const amount=Math.round(num(x.amount)*100)/100;const key=`${merchant}|${amount.toFixed(2)}`;const arr=groups.get(key)||[];arr.push({date:String(x.date).slice(0,10),amount,merchant,source:x});groups.set(key,arr)}
  const out=[];
  for(const arr of groups.values()){
    const months=[...new Set(arr.map(x=>x.date.slice(0,7)))].sort();if(months.length<2)continue;
    const days=arr.map(x=>Number(x.date.slice(8,10))).filter(Number.isFinite),spread=days.length?Math.max(...days)-Math.min(...days):99;
    const consecutive=months.every((m,i)=>i===0||monthIndex(m)-monthIndex(months[i-1])<=2);
    let score=Math.min(99,55+months.length*12+(spread<=4?18:spread<=8?8:0)+(consecutive?8:0));
    if(/NETFLIX|SPOTIFY|APPLE.COM\/BILL|STARHUB|SINGTEL|AIA/.test(arr[0].merchant))score=Math.min(99,score+10);
    out.push({merchant:arr[0].merchant,amount:arr[0].amount,months,days,score,dueDay:days.length?Math.round(days.reduce((a,b)=>a+b,0)/days.length):''});
  }
  return out.sort((a,b)=>b.score-a.score||b.months.length-a.months.length).slice(0,20);
}
function showCandidates(){
  const host=document.querySelector('#mgwRecurringCandidates');if(!host)return;const rows=detectCandidates();
  host.innerHTML=`<div class="mgw-candidate-list">${rows.length?rows.map((x,i)=>`<div class="mgw-candidate-row"><div><b>${esc(x.merchant)}</b><small>${money(x.amount)} · seen in ${x.months.length} months · around day ${x.dueDay||'—'}</small><small>${esc(x.months.join(', '))}</small></div><div><span class="mgw-candidate-score">${x.score}% pattern</span><div class="mgw-bill-actions"><button data-candidate-add="${i}">Add</button></div></div></div>`).join(''):'<p class="mgw-muted">No repeating same-amount patterns found in the local transaction history yet.</p>'}</div>`;
  host.querySelectorAll('[data-candidate-add]').forEach(b=>b.addEventListener('click',()=>{const x=rows[Number(b.dataset.candidateAdd)];if(!x)return;openBill({name:x.merchant,merchant:x.merchant,amount:x.amount,dueDay:x.dueDay,frequency:'monthly',category:/AIA/.test(x.merchant)?'Insurance':/STARHUB|SINGTEL/.test(x.merchant)?'Telecom':'Subscription',startMonth:x.months[0]})}));
}
function bind(){
  const host=document.querySelector('#mgwRecurringBillsSettings');if(!host||host.dataset.bound==='1')return;host.dataset.bound='1';
  host.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-bill-add'))return openBill();if(b.hasAttribute('data-bill-detect'))return showCandidates();if(b.dataset.billEdit){const x=db.recurringBills.find(x=>x.id===b.dataset.billEdit);if(x)return openBill(x)}if(b.dataset.billToggle){const x=db.recurringBills.find(x=>x.id===b.dataset.billToggle);if(x){x.active=x.active===false;save()}}});
}
function boot(){if(!ensure())return;installStyles();installUI();render();bind();if(typeof renderAll==='function'&&!renderAll.__mgwRecurringBills){const base=renderAll;const wrapped=function(){base();render();bind()};wrapped.__mgwRecurringBills=true;renderAll=wrapped}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();