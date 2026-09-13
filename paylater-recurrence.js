// MoneyGoWhere DEV — Pay-Later provider + recurrence planner
// No personal finance data is bundled here. Provider names are app configuration only.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.13';
  const PROVIDERS=['Atome','Grab PayLater','SPayLater','ABNK','CIMB PayLater','Credit Card Instalment','Merchant Instalment','Other / Custom Provider'];
  const COMMON_DURATIONS=[1,3,4,6,8,12,18,24];
  const num=v=>Math.max(0,Number(v)||0);
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const money2=v=>Math.round((Number(v)||0)*100)/100;
  const persist=()=>localStorage.setItem(MGW.key,JSON.stringify(db));

  function safeDate(y,m,d){return new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()))}
  function key(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
  function parseDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
  function addMonths(date,n){return safeDate(date.getFullYear(),date.getMonth()+n,date.getDate())}
  function cycleBounds(anchor){if(typeof mgwCycleBounds==='function')return mgwCycleBounds(anchor);const y=anchor.getFullYear(),m=anchor.getMonth();return{start:new Date(y,m,1),end:new Date(y,m+1,1)}}
  function inCycle(date,anchor){const d=parseDate(date);if(!d)return false;const b=cycleBounds(anchor);return d>=b.start&&d<b.end}
  function paidForCycle(a,anchor){const rows=Array.isArray(db.payLaterPayments)?db.payLaterPayments:[];return rows.filter(x=>x.accountId===a.id&&inCycle(x.date,anchor)).reduce((t,x)=>t+num(x.amount),0)}
  function allPaid(a){return (Array.isArray(db.payLaterPayments)?db.payLaterPayments:[]).filter(x=>x.accountId===a.id).reduce((t,x)=>t+num(x.amount),0)}

  function schedule(a){
    const first=parseDate(a.firstDueDate);const months=Math.max(1,Math.floor(num(a.durationMonths)||1));
    if(!first)return[];
    const cost=num(a.productCost),down=num(a.downpayment),fees=num(a.fees),interest=num(a.interestAmount);
    const total=money2(Math.max(0,cost-down)+fees+interest);
    const mode=a.installmentMode==='custom'?'custom':'equal';
    const custom=money2(num(a.customMonthlyPayment));
    const regular=mode==='custom'&&custom>0?custom:money2(total/months);
    const rows=[];let allocated=0;
    for(let i=0;i<months;i++){
      let amount=i===months-1?money2(total-allocated):regular;
      if(i<months-1&&allocated+amount>total)amount=money2(Math.max(0,total-allocated));
      allocated=money2(allocated+amount);
      rows.push({index:i+1,date:key(addMonths(first,i)),amount});
    }
    return rows;
  }
  function totalRepayable(a){return money2(Math.max(0,num(a.productCost)-num(a.downpayment))+num(a.fees)+num(a.interestAmount))}
  function currentDue(a,anchor=MGW.state.month){
    const due=schedule(a).filter(x=>inCycle(x.date,anchor)).reduce((t,x)=>t+x.amount,0);
    return money2(Math.max(0,due-paidForCycle(a,anchor)));
  }
  function nextDue(a){const today=new Date();today.setHours(0,0,0,0);return schedule(a).find(x=>parseDate(x.date)>=today)?.date||''}
  function syncAccounts(){
    if(!Array.isArray(db.payLaterAccounts))db.payLaterAccounts=[];
    let changed=false;
    db.payLaterAccounts.forEach(a=>{
      if(!a.recurrenceEnabled)return;
      const due=currentDue(a),next=nextDue(a),total=totalRepayable(a),paid=allPaid(a),out=money2(Math.max(0,total-paid));
      if(a.cycleDue!==due){a.cycleDue=due;changed=true}
      if(a.nextDueDate!==next){a.nextDueDate=next;changed=true}
      if(a.totalRepayable!==total){a.totalRepayable=total;changed=true}
      if(a.outstanding!==out){a.outstanding=out;changed=true}
      const status=out<=0?'completed':'active';if(a.status!==status){a.status=status;changed=true}
    });
    if(changed)persist();
  }

  function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');if(!m||!body)return null;document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;m.showModal();return body}
  function providerOptions(selected=''){return PROVIDERS.map(p=>`<option value="${esc(p)}" ${p===selected?'selected':''}>${esc(p)}</option>`).join('')}
  function durationOptions(selected){const s=Number(selected)||12;return COMMON_DURATIONS.map(n=>`<option value="${n}" ${n===s?'selected':''}>${n} month${n===1?'':'s'}</option>`).join('')+`<option value="custom" ${COMMON_DURATIONS.includes(s)?'':'selected'}>Custom duration</option>`}

  function planSummary(o){
    const rows=schedule(o),total=totalRepayable(o);if(!rows.length||!total)return '<small>Enter product cost, duration and first due date to preview the plan.</small>';
    const first=rows[0],last=rows[rows.length-1],regular=rows[0].amount;
    return `<b>Total repayable:</b> ${money(total)}<br><b>Generated payment:</b> ${money(regular)} / month${rows.length>1&&rows.at(-1).amount!==regular?` · final ${money(rows.at(-1).amount)}`:''}<br><b>Schedule:</b> ${esc(first.date)} → ${esc(last.date)} · ${rows.length} payment${rows.length===1?'':'s'}`;
  }

  function openLater(a={}){
    const edit=Boolean(a.id),legacy=!a.recurrenceEnabled&&edit;
    const provider=PROVIDERS.includes(a.provider)?a.provider:(a.provider?'Other / Custom Provider':'Atome');
    const customProvider=provider==='Other / Custom Provider'?(a.customProvider||a.provider||''):(a.customProvider||'');
    const duration=Number(a.durationMonths)||12;
    const first=a.firstDueDate||a.nextDueDate||new Date().toISOString().slice(0,10);
    const productCost=a.productCost??(legacy?a.outstanding:'');
    const body=showModal(edit?'Edit Pay-Later Plan':'Add Pay-Later Plan',`<form id="mgwRecurringLaterForm" class="form-grid">
      <div class="field full"><label>Product / purchase name</label><input name="name" required value="${esc(a.name||'')}" placeholder="e.g. Phone, appliance, travel booking"></div>
      <div class="field"><label>Provider</label><select name="provider">${providerOptions(provider)}</select></div>
      <div class="field" id="mgwCustomProviderWrap"><label>Custom provider</label><input name="customProvider" value="${esc(customProvider)}" placeholder="Provider name"></div>
      <div class="field"><label>Product cost</label><input name="productCost" type="number" min="0.01" step="0.01" required value="${productCost}"></div>
      <div class="field"><label>Downpayment</label><input name="downpayment" type="number" min="0" step="0.01" value="${a.downpayment??0}"></div>
      <div class="field"><label>Fees</label><input name="fees" type="number" min="0" step="0.01" value="${a.fees??0}"></div>
      <div class="field"><label>Interest amount</label><input name="interestAmount" type="number" min="0" step="0.01" value="${a.interestAmount??0}"></div>
      <div class="field"><label>Installment duration</label><select name="durationPreset">${durationOptions(duration)}</select></div>
      <div class="field" id="mgwCustomDurationWrap"><label>Custom months</label><input name="durationMonths" type="number" min="1" max="120" value="${duration}"></div>
      <div class="field"><label>First payment date</label><input name="firstDueDate" type="date" required value="${first}"></div>
      <div class="field"><label>Payment calculation</label><select name="installmentMode"><option value="equal" ${a.installmentMode!=='custom'?'selected':''}>Equal installments</option><option value="custom" ${a.installmentMode==='custom'?'selected':''}>Custom monthly amount</option></select></div>
      <div class="field full" id="mgwCustomMonthlyWrap"><label>Custom monthly amount</label><input name="customMonthlyPayment" type="number" min="0.01" step="0.01" value="${a.customMonthlyPayment??''}"><small>The final payment is adjusted automatically so the schedule closes exactly.</small></div>
      <div class="field full"><div class="mgw-form-note" id="mgwPlanPreview"></div></div>
      <div class="field full"><div class="mgw-form-note">MoneyGoWhere stores one Pay-Later plan plus its recurrence rule. It does not create duplicate future transactions for every month.</div></div>
      <div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Pay-Later Plan'}</button></div>
      ${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteRecurringLater">Delete Pay-Later</button></div>':''}
    </form>`);
    if(!body)return;
    const f=body.querySelector('form'),providerEl=f.elements.provider,preset=f.elements.durationPreset,customDuration=f.elements.durationMonths,mode=f.elements.installmentMode;
    const customProviderWrap=body.querySelector('#mgwCustomProviderWrap'),customDurationWrap=body.querySelector('#mgwCustomDurationWrap'),customMonthlyWrap=body.querySelector('#mgwCustomMonthlyWrap'),preview=body.querySelector('#mgwPlanPreview');
    const formObj=()=>({
      productCost:num(f.elements.productCost.value),downpayment:num(f.elements.downpayment.value),fees:num(f.elements.fees.value),interestAmount:num(f.elements.interestAmount.value),
      durationMonths:preset.value==='custom'?Math.max(1,Number(customDuration.value)||1):Number(preset.value),firstDueDate:f.elements.firstDueDate.value,
      installmentMode:mode.value,customMonthlyPayment:num(f.elements.customMonthlyPayment.value)
    });
    const refresh=()=>{
      customProviderWrap.style.display=providerEl.value==='Other / Custom Provider'?'':'none';
      customDurationWrap.style.display=preset.value==='custom'?'':'none';
      customMonthlyWrap.style.display=mode.value==='custom'?'':'none';
      preview.innerHTML=planSummary(formObj());
    };
    f.addEventListener('input',refresh);f.addEventListener('change',refresh);refresh();
    f.addEventListener('submit',e=>{
      e.preventDefault();const fd=new FormData(f),durationMonths=preset.value==='custom'?Math.max(1,Number(fd.get('durationMonths'))||1):Number(preset.value);
      const o={
        id:a.id||id('LATER'),name:String(fd.get('name')||'').trim(),provider:String(fd.get('provider')||''),customProvider:String(fd.get('customProvider')||'').trim(),
        productCost:num(fd.get('productCost')),downpayment:num(fd.get('downpayment')),fees:num(fd.get('fees')),interestAmount:num(fd.get('interestAmount')),
        durationMonths,firstDueDate:String(fd.get('firstDueDate')||''),installmentMode:fd.get('installmentMode')==='custom'?'custom':'equal',customMonthlyPayment:num(fd.get('customMonthlyPayment')),
        recurrenceEnabled:true,status:a.status||'active',createdAt:a.createdAt||new Date().toISOString()
      };
      if(o.provider==='Other / Custom Provider'&&!o.customProvider){toast?.('Enter the custom provider name');return}
      if(o.downpayment>o.productCost){toast?.('Downpayment cannot exceed product cost');return}
      if(o.installmentMode==='custom'&&o.customMonthlyPayment<=0){toast?.('Enter the custom monthly payment');return}
      o.totalRepayable=totalRepayable(o);o.outstanding=money2(Math.max(0,o.totalRepayable-allPaid(o)));o.cycleDue=currentDue(o);o.nextDueDate=nextDue(o);
      if(!edit)db.payLaterAccounts.push(o);else Object.assign(a,o);
      persist();document.querySelector('#modal').close();if(typeof renderAll==='function')renderAll();if(typeof toast==='function')toast(edit?'Pay-Later plan updated':'Pay-Later plan added');
    });
    body.querySelector('#mgwDeleteRecurringLater')?.addEventListener('click',()=>{
      if(!confirm('Delete this Pay-Later tracker? Existing expense transactions will not be deleted.'))return;
      db.payLaterAccounts=db.payLaterAccounts.filter(x=>x.id!==a.id);db.payLaterPayments=(db.payLaterPayments||[]).filter(x=>x.accountId!==a.id);persist();document.querySelector('#modal').close();if(typeof renderAll==='function')renderAll();toast?.('Pay-Later tracker deleted');
    });
  }

  function enhanceRenderedCards(){
    document.querySelectorAll('[data-later-edit]').forEach(btn=>{
      const a=(db.payLaterAccounts||[]).find(x=>x.id===btn.dataset.laterEdit);if(!a?.recurrenceEnabled)return;
      const card=btn.closest('.mgw-account');if(!card||card.querySelector('.mgw-later-plan-meta'))return;
      const meta=document.createElement('p');meta.className='mgw-muted mgw-later-plan-meta';
      const provider=a.provider==='Other / Custom Provider'?(a.customProvider||a.provider):a.provider;
      meta.textContent=`${provider||'Pay-Later'} · ${a.durationMonths} months · ${money(totalRepayable(a))} total repayable`;
      card.querySelector('.mgw-account-actions')?.before(meta);
    });
  }

  function installInterceptors(){
    document.addEventListener('click',e=>{
      const add=e.target.closest?.('#mgwAddLater');if(add){e.preventDefault();e.stopImmediatePropagation();openLater();return}
      const edit=e.target.closest?.('[data-later-edit]');if(edit){const a=(db.payLaterAccounts||[]).find(x=>x.id===edit.dataset.laterEdit);if(a){e.preventDefault();e.stopImmediatePropagation();openLater(a)}}
    },true);
  }

  function boot(){
    db.payLaterAccounts=Array.isArray(db.payLaterAccounts)?db.payLaterAccounts:[];db.payLaterPayments=Array.isArray(db.payLaterPayments)?db.payLaterPayments:[];
    syncAccounts();installInterceptors();
    if(typeof renderAll==='function'&&!renderAll.__mgwPayLaterRecurrence){const base=renderAll;renderAll=function(){syncAccounts();base();queueMicrotask(enhanceRenderedCards)};renderAll.__mgwPayLaterRecurrence=true}
    queueMicrotask(enhanceRenderedCards);
    window.MGWPayLater={version:RELEASE,providers:[...PROVIDERS],schedule,currentDue,open:openLater};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();