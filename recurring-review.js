// Recurring review, reversible status actions and retained Pay-Later archives.
(()=>{'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=(x='')=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cents=x=>Math.round(Number(x)*100);
const norm=x=>String(x||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ');
let undoAction=null,queued=false;
function save(next){
  window.MGWRecurringEngine.sync(next,{persist:false});window.MGWAccountRegistry?.sync(next,{persist:false});
  localStorage.setItem('moneygowhere-db-v1',JSON.stringify(next));window.MGWAdoptDatabase(next);
  document.dispatchEvent(new CustomEvent('mgw:recurring-changed'));window.renderAll?.();
}
function undoNotice(label,action){undoAction=action;let bar=document.querySelector('#mgwActionUndo');if(!bar){bar=document.createElement('div');bar.id='mgwActionUndo';bar.setAttribute('role','status');document.body.appendChild(bar)}bar.innerHTML=`<span>${esc(label)}</span> <button type="button">Undo</button><button type="button" aria-label="Dismiss">×</button>`;bar.hidden=false;bar.querySelector('button').onclick=()=>{try{undoAction?.();undoAction=null;bar.hidden=true}catch(e){window.toast?.(e.message)}};bar.querySelectorAll('button')[1].onclick=()=>{bar.hidden=true;undoAction=null}}
function toggle(id){
  const next=clone(window.db);window.MGWRecurringEngine.sync(next,{persist:false});const x=next.recurringItems.find(x=>x.id===id);if(!x)throw Error('Schedule no longer exists');
  const prior=x.active!==false;window.MGWRecurringSwipe.update(id,{amount:x.amount,active:!prior});
  undoNotice(prior?'Recurring payment paused':'Recurring payment activated',()=>{const current=window.db.recurringItems.find(x=>x.id===id);if(!current)throw Error('Schedule no longer exists');window.MGWRecurringSwipe.update(id,{amount:current.amount,active:prior})});
}
function duplicates(database){
  const work=clone(database);window.MGWRecurringEngine.sync(work,{persist:false});const rows=work.recurringItems.filter(x=>x.type!=='income'&&x.type!=='installment');const pairs=[];
  const steps={monthly:1,bimonthly:2,quarterly:3,halfyearly:6,yearly:12};
  const mi=x=>{if(!/^\d{4}-\d{2}$/.test(x||''))return null;const [y,m]=x.split('-').map(Number);return y*12+m-1};
  const raw=x=>work[x.sourceCollection]?.find(y=>String(y.id)===String(x.sourceId))||x;
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j],ra=raw(a),rb=raw(b);
    if(!norm(a.merchant||a.name)||norm(a.merchant||a.name)!==norm(b.merchant||b.name)||cents(a.amount)!==cents(b.amount)||!(Number(a.amount)>0)||(a.frequency||'monthly')!==(b.frequency||'monthly'))continue;
    if((ra.currency||'SGD')!==(rb.currency||'SGD'))continue;
    if(a.accountId&&b.accountId&&a.accountId!==b.accountId)continue;
    if(ra.policyNumber&&rb.policyNumber&&norm(ra.policyNumber)!==norm(rb.policyNumber))continue;
    const sa=mi(a.startMonth),sb=mi(b.startMonth),lo=Math.max(sa??0,sb??0),hi=Math.min(mi(a.endMonth)??Infinity,mi(b.endMonth)??Infinity),step=steps[a.frequency]||1;
    if(lo>hi)continue;
    let overlaps=false;for(let m=lo;m<=Math.min(hi,lo+11);m++)if((sa===null||(m-sa)%step===0)&&(sb===null||(m-sb)%step===0)){overlaps=true;break}if(overlaps)pairs.push({a,b});
  }return pairs;
}
function completion(a,database){
  if(a.archivedAt)return false;
  if(a.recurrenceEnabled){
    const fields=['productCost','downpayment','fees','interestAmount'];if(fields.some(k=>a[k]!=null&&(!Number.isFinite(Number(a[k]))||Number(a[k])<0)))return false;
    if(!(Number(a.productCost)>0)||Number(a.downpayment||0)>Number(a.productCost))return false;
    const total=cents(Number(a.productCost)-Number(a.downpayment||0)+Number(a.fees||0)+Number(a.interestAmount||0));
    const payments=(database.payLaterPayments||[]).filter(p=>p.accountId===a.id);
    if(payments.some(p=>!Number.isFinite(Number(p.amount))||Number(p.amount)<0))return false;
    const paid=payments.reduce((s,p)=>s+cents(p.amount),0);
    return total>=0&&paid>=total&&(total===0||payments.length>0);
  }
  return Number(a.totalInstallments)>0&&Number(a.installmentsPaid)>=Number(a.totalInstallments)&&Number(a.outstanding)===0&&Number(a.cycleDue||0)===0&&!a.nextDueDate;
}
function archive(id){
  const next=clone(window.db),a=next.payLaterAccounts.find(x=>x.id===id);if(!a||!completion(a,next))throw Error('This plan is not fully repaid. Review its payments first.');
  const before={status:a.status,active:a.active,cycleDue:a.cycleDue,nextDueDate:a.nextDueDate};a.archivePrevious=before;a.archivedAt=new Date().toISOString();a.status='completed';a.active=false;a.cycleDue=0;a.nextDueDate='';save(next);undoNotice('Pay-Later moved to Completed Payment',()=>reopen(id));
}
function reopen(id){
  const next=clone(window.db),a=next.payLaterAccounts.find(x=>x.id===id);if(!a?.archivedAt)throw Error('Archived plan no longer exists');
  const before=a.archivePrevious||{status:'active',active:true};for(const k of ['status','active','cycleDue','nextDueDate']){if(before[k]===undefined)delete a[k];else a[k]=before[k]}delete a.archivedAt;delete a.archivePrevious;save(next);
}
function recurringId(button){
  const d=button.dataset,source=d.billToggle?'recurringBills':d.coreToggle?'monthlyCommitments':d.recKind==='income'?'recurringIncome':'recurringCommitments',id=d.billToggle||d.coreToggle||d.recToggle;
  window.MGWRecurringEngine.sync(window.db,{persist:false});return window.db.recurringItems.find(x=>x.sourceCollection===source&&String(x.sourceId)===String(id))?.id;
}
function collapseSettings(){
  const view=document.querySelector('#view-settings');if(!view)return;let prefs={};try{prefs=JSON.parse(localStorage.getItem('mgw-settings-sections-v1')||'{}')}catch{}
  [...view.children].filter(x=>x.matches('article.card')).forEach(card=>{
    if(card.parentElement.matches('details'))return;
    const key=card.id||'settings-general',details=document.createElement('details'),summary=document.createElement('summary');details.className='mgw-settings-section';details.dataset.settingsSection=key;details.open=prefs[key]!==false;
    summary.textContent=card.querySelector('.card-head b,h2,h3')?.textContent||'Preferences & Data';card.before(details);details.append(summary,card);
    details.addEventListener('toggle',()=>{try{const state=JSON.parse(localStorage.getItem('mgw-settings-sections-v1')||'{}');state[key]=details.open;localStorage.setItem('mgw-settings-sections-v1',JSON.stringify(state))}catch{}});
  });
}
// Grouping is a view of existing schedules; source collections and IDs never move.
function groupedRecurring(database){
  const work=clone(database);window.MGWRecurringEngine.sync(work,{persist:false});
  const sectionNames={recurringBills:'Recurring Bills & Commitments',recurringIncome:'Recurring Schedules · Salary',recurringCommitments:'Recurring Schedules · Commitments',monthlyCommitments:'Fixed Monthly Commitments',canonical:'Historical & Other Recurring'};
  const describe=x=>{const raw=Array.isArray(work[x.sourceCollection])?work[x.sourceCollection].find(r=>String(r.id)===String(x.sourceId)):x;return {...x,originalSection:sectionNames[x.sourceCollection]||'Historical & Other Recurring',originalGroup:raw?.group||raw?.category||''}};
  const rows=work.recurringItems.filter(x=>x.type!=='installment').map(describe);
  return {paused:rows.filter(x=>x.active===false),canonicalActive:rows.filter(x=>x.active!==false&&x.sourceCollection==='canonical'&&x.metadata?.userEdited)};
}
function renderGroupedRecurring(view){
  const groups=groupedRecurring(window.db);
  for(const [id,title,rows,paused] of [['mgwPausedRecurring','Paused Recurring',groups.paused,true],['mgwOtherRecurring','Historical & Other Recurring',groups.canonicalActive,false]]){
    let host=document.querySelector('#'+id);if(!host){host=document.createElement('article');host.id=id;host.className='card';view.appendChild(host)}
    host.innerHTML=`<div class="card-head"><b>${title}</b></div><p class="mgw-muted">${paused?'Swipe left or tap ⋯ for Edit / Active. Activating returns the entry to its original group.':'Recurring entries managed from imported history or the recurring editor.'}</p><div class="mgw-rec-grid">${rows.map(x=>`<div data-recurring-id="${esc(x.id)}"><div><b>${esc(window.MGWRecurringEngine.displayName(x))}</b><small>${paused?'Paused · Returns to':'Group'}: ${esc(x.originalSection)}${x.originalGroup?' · '+esc(x.originalGroup):''}</small><small>${esc(x.frequency)} · ${esc(x.startMonth||'No start month')} → ${esc(x.endMonth||'ongoing')}</small></div><strong>${esc(window.money?.(x.amount)||x.amount)}</strong></div>`).join('')||`<p class="mgw-muted">${paused?'No paused recurring entries.':'No active entries in this section.'}</p>`}</div>`;
    window.MGWRecurringSwipe?.enhance(host);
  }
}
function render(){
  const view=document.querySelector('#view-settings');if(!view||!window.db)return;
  let host=document.querySelector('#mgwRecurringReview');if(!host){host=document.createElement('article');host.id='mgwRecurringReview';host.className='card';view.appendChild(host)}
  const pairs=duplicates(window.db);host.innerHTML=`<div class="card-head"><b>Recurring Duplicate Review</b></div><p>${pairs.length?`${pairs.length} possible duplicate pair${pairs.length===1?'':'s'}. Compare before changing either schedule.`:'No likely recurring duplicates found.'}</p>${pairs.map(({a,b})=>`<div class="mgw-account"><b>${esc(a.name)} / ${esc(b.name)}</b><p>${esc(a.merchant||a.name)} · ${esc(a.amount)} · ${esc(a.frequency)} · overlapping dates${a.active===false||b.active===false?' · includes paused schedule':''}</p><small>${esc(a.startMonth||'No start')} → ${esc(a.endMonth||'ongoing')} / ${esc(b.startMonth||'No start')} → ${esc(b.endMonth||'ongoing')}</small><div class="mgw-account-actions"><button data-review-edit="${esc(a.id)}">Edit first</button><button data-review-edit="${esc(b.id)}">Edit second</button></div></div>`).join('')}`;
  document.querySelectorAll('[data-later-edit]').forEach(button=>{const a=(window.db.payLaterAccounts||[]).find(x=>x.id===button.dataset.laterEdit);if(a&&!a.archivedAt&&completion(a,window.db)&&!button.parentElement.querySelector('[data-later-close]')){const close=document.createElement('button');close.dataset.laterClose=a.id;close.textContent='Fully paid · Close';button.parentElement.appendChild(close)}});
  renderGroupedRecurring(view);
  collapseSettings();
}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render()})}
function boot(){
  const style=document.createElement('style');style.textContent='.mgw-settings-section{margin-bottom:12px;border:1px solid var(--border,#dbe4e4);border-radius:14px}.mgw-settings-section>summary{cursor:pointer;padding:16px;font-weight:700}.mgw-settings-section>article{margin:0;border:0}#mgwActionUndo{position:fixed;bottom:90px;left:16px;right:16px;z-index:1000;background:#0f766e;color:white;border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px}#mgwActionUndo[hidden]{display:none}#mgwActionUndo span{flex:1}#mgwActionUndo button{padding:9px;border-radius:8px;border:0}';document.head.appendChild(style);
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-bill-toggle],[data-rec-toggle],[data-core-toggle],[data-review-edit],[data-later-close],[data-later-reopen]');if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();try{if(b.dataset.reviewEdit)window.MGWRecurringSwipe.open(b.dataset.reviewEdit);else if(b.dataset.laterClose){if(confirm('Close this fully paid Pay-Later plan and move it to Completed Payment? Payment history will be preserved.'))archive(b.dataset.laterClose)}else if(b.dataset.laterReopen)reopen(b.dataset.laterReopen);else{const id=recurringId(b);if(id)toggle(id)}}catch(err){window.toast?.(err.message)}
  },true);
  if(typeof window.renderAll==='function'){const base=window.renderAll;window.renderAll=function(){const result=base.apply(this,arguments);schedule();return result}}
  document.addEventListener('mgw:data-restored',()=>{undoAction=null;const bar=document.querySelector('#mgwActionUndo');if(bar)bar.hidden=true});
  for(const event of ['mgw:data-ready','mgw:data-restored','mgw:recurring-changed','mgw:app-ready','mgw:settings-features-ready','mgw:wallet-rendered'])document.addEventListener(event,schedule);
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-nav="settings"],#mgwManageAccounts'))schedule();if(e.target.closest?.('#mgwManageAccounts'))queueMicrotask(()=>{const section=document.querySelector('#mgwCreditSettings')?.closest('details');if(section)section.open=true})});schedule();
}
window.MGWRecurringReview=Object.freeze({duplicates,completion,toggle,archive,reopen,groupedRecurring});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
