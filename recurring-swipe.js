// Shared swipe actions for recurring rows. Edits update the schedule, not posted transactions.
(()=>{'use strict';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const frequencies={monthly:'Monthly',bimonthly:'Every 2 months',quarterly:'Quarterly',halfyearly:'Half-yearly',yearly:'Yearly'};
function update(id,patch){
  const source=window.db;if(!source)throw new Error('Database is not ready');
  const next=JSON.parse(JSON.stringify(source));window.MGWRecurringEngine.sync(next,{persist:false});
  const item=next.recurringItems.find(x=>x.id===id);if(!item)throw new Error('Schedule no longer exists');
  if(!Number.isFinite(Number(patch.amount))||Number(patch.amount)<0)throw new Error('Enter a valid amount');
  if(patch.endMonth&&patch.startMonth&&patch.endMonth<patch.startMonth)throw new Error('End month cannot be before start month');
  const legacy=Array.isArray(next[item.sourceCollection])?next[item.sourceCollection].find(x=>String(x.id)===String(item.sourceId)):null;
  if(legacy){
    const fields={...patch};delete fields.day;
    if(item.type==='income'){fields.netSalary=fields.amount;delete fields.amount;if('day' in patch)fields.payDay=patch.day}
    else if('day' in patch)fields.dueDay=patch.day;
    if(item.sourceCollection==='monthlyCommitments'){delete fields.frequency;delete fields.startMonth;delete fields.endMonth}
    Object.assign(legacy,fields);
  }else{
    Object.assign(item,patch);item.sourceCollection='canonical';
    item.metadata={...item.metadata,inferredHistory:false,userEdited:true};
  }
  window.MGWRecurringEngine.sync(next,{persist:false});
  next.updatedAt=new Date().toISOString();localStorage.setItem('moneygowhere-db-v1',JSON.stringify(next));
  window.MGWAdoptDatabase(next);
  document.dispatchEvent(new CustomEvent('mgw:recurring-changed',{detail:{source:'swipe-editor',id}}));
  window.renderAll?.();return next.recurringItems.find(x=>x.id===id);
}
function open(id){
  window.MGWRecurringEngine.sync(window.db,{persist:false});const item=window.db.recurringItems.find(x=>x.id===id);
  if(!item)return window.toast?.('Schedule no longer exists');
  const modal=document.querySelector('#modal'),body=document.querySelector('#modalBody');if(!modal||!body)return;
  const fixed=item.sourceCollection==='monthlyCommitments';document.querySelector('#modalTitle').textContent='Edit Recurring Payment';
  body.innerHTML=`<form id="mgwSwipeRecurringForm" class="form-grid"><div class="field full"><label>Name</label><input name="name" required value="${esc(item.name)}"></div><div class="field"><label>Amount</label><input name="amount" type="number" required min="0" step="0.01" value="${esc(item.amount)}"></div><div class="field"><label>Expected day</label><input name="day" type="number" min="1" max="31" value="${esc(item.day)}"></div><div class="field full"><label>Merchant / match name</label><input name="merchant" value="${esc(item.merchant)}"></div><div class="field full"><label>Category</label><input name="category" value="${esc(item.category)}"></div><div class="field"><label>Frequency</label><select name="frequency" ${fixed?'disabled':''}>${Object.entries(frequencies).map(([v,label])=>`<option value="${v}" ${v===item.frequency?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label>Status</label><select name="active"><option value="true" ${item.active!==false?'selected':''}>Active</option><option value="false" ${item.active===false?'selected':''}>Paused</option></select></div><div class="field"><label>Start month</label><input name="startMonth" type="month" value="${esc(item.startMonth)}" ${fixed?'disabled':''}></div><div class="field"><label>End month (optional)</label><input name="endMonth" type="month" value="${esc(item.endMonth)}" ${fixed?'disabled':''}></div><p class="field full status" id="mgwRecurringEditError" role="alert"></p><div class="field full"><button class="primary-btn">Save Changes</button></div></form>`;
  const form=body.querySelector('form');form.addEventListener('submit',e=>{e.preventDefault();const patch=Object.fromEntries(new FormData(form));patch.amount=Number(patch.amount);patch.day=patch.day?Number(patch.day):'';patch.active=patch.active==='true';try{update(id,patch);modal.close();window.toast?.('Recurring payment updated')}catch(err){body.querySelector('#mgwRecurringEditError').textContent=err.message}});
  if(!modal.open)modal.showModal();
}
function enhance(root){
  if(!root)return;
  root.querySelectorAll('.mgw-bill-row,.mgw-rec-row,.mgw-commit,[data-recurring-id]').forEach(row=>{
    if(row.dataset.mgwSwipeBound)return;row.dataset.mgwSwipeBound='1';row.classList.add('mgw-rec-swipe');
    const content=document.createElement('div');content.className='mgw-rec-swipe-content';
    while(row.firstChild)content.appendChild(row.firstChild);
    const tray=document.createElement('div');tray.className='mgw-rec-swipe-actions';
    const existing=content.querySelector('.mgw-bill-actions,.mgw-rec-actions,.mgw-commit-actions');
    if(existing)tray.appendChild(existing);else if(row.dataset.recurringId){const edit=document.createElement('button');edit.type='button';edit.textContent='Edit';edit.addEventListener('click',()=>open(row.dataset.recurringId));tray.appendChild(edit);const status=document.createElement('button');status.type='button';const item=window.db?.recurringItems?.find(x=>x.id===row.dataset.recurringId);status.textContent=item?.active===false?'Active':'Pause';status.addEventListener('click',()=>{try{window.MGWRecurringReview?.toggle(row.dataset.recurringId)}catch(err){window.toast?.(err.message)}});tray.appendChild(status)}
    if(!tray.children.length)return;
    const toggle=document.createElement('button');toggle.type='button';toggle.className='mgw-rec-action-toggle';toggle.textContent='⋯';toggle.setAttribute('aria-label','Show recurring payment actions');toggle.setAttribute('aria-expanded','false');content.appendChild(toggle);
    row.append(tray,content);
    const setOpen=show=>{if(show)document.querySelectorAll('.mgw-rec-swipe.is-open').forEach(x=>{if(x!==row){x.classList.remove('is-open');x.querySelector('.mgw-rec-action-toggle')?.setAttribute('aria-expanded','false');const t=x.querySelector('.mgw-rec-swipe-actions');if(t){t.inert=true;t.setAttribute('aria-hidden','true')}}});row.classList.toggle('is-open',show);toggle.setAttribute('aria-expanded',String(show));tray.inert=!show;tray.setAttribute('aria-hidden',String(!show))};setOpen(false);
    toggle.addEventListener('click',()=>setOpen(!row.classList.contains('is-open')));
    let start=null;content.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select,textarea')||e.button>0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId}});
    content.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.3)content.setPointerCapture?.(e.pointerId)});
    content.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)setOpen(dx<0)});
    content.addEventListener('pointercancel',()=>{start=null});row.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
  });
}
function boot(){
  if(!document.querySelector('#mgwRecurringSwipeStyles')){const style=document.createElement('style');style.id='mgwRecurringSwipeStyles';style.textContent=`.mgw-rec-swipe{position:relative;overflow:hidden;display:block!important;padding:0!important;border-radius:12px;margin:6px 0;border:1px solid var(--border,#e4e9ea);touch-action:pan-y}.mgw-rec-swipe-content{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;background:var(--card,#fff);transition:transform .18s ease}.mgw-rec-swipe-content>div:first-child,.mgw-rec-swipe-content>span:first-child{min-width:0;flex:1}.mgw-rec-swipe-content small{display:block}.mgw-rec-swipe-actions{position:absolute;inset:0 0 0 auto;width:156px;display:flex;align-items:stretch;background:#0f766e}.mgw-rec-swipe-actions>div{display:flex!important;flex:1;margin:0!important;gap:0!important}.mgw-rec-swipe-actions button{flex:1;border:0!important;border-radius:0!important;background:#0f766e!important;color:#fff!important;padding:12px;font-weight:700}.mgw-rec-swipe-actions button+button{background:#475569!important}.mgw-rec-swipe.is-open>.mgw-rec-swipe-content{transform:translateX(-156px)}.mgw-rec-action-toggle{border:0;border-radius:8px;min-width:36px;min-height:36px;background:#e8f5f2;color:#0f766e;font-size:1.25rem}.mgw-rec-swipe-actions button:focus-visible,.mgw-rec-action-toggle:focus-visible{outline:3px solid #eab308;outline-offset:-3px}@media(prefers-reduced-motion:reduce){.mgw-rec-swipe-content{transition:none}}`;document.head.appendChild(style)}
  enhance(document.querySelector('#mgwBudgetAfterCommitments'));enhance(document.querySelector('#mgwCommitmentSettings'));
}
window.MGWRecurringSwipe=Object.freeze({enhance,open,update});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
