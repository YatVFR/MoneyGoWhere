// MoneyGoWhere DEV — Pay-Later provider + recurrence planner
// No personal finance data is bundled here. Provider rules are application configuration only.
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.14';
  const PROVIDERS=['Atome','Grab PayLater','SPayLater','ABNK','CIMB PayLater','Credit Card Instalment','Merchant Instalment','Other / Custom Provider'];
  const COMMON_DURATIONS=[1,3,4,6,8,12,18,24];
  const START_RULES={
    purchase:'At purchase',next_cycle:'Next billing cycle',month_after:'1 month after purchase',statement:'Statement due date',custom:'Custom date'
  };
  const PROVIDER_POLICIES={
    'Atome':{defaultRule:'purchase',note:'Standard plan normally starts with the first instalment at purchase.'},
    'Grab PayLater':{defaultRule:'custom',note:'Grab schedules can start at purchase, one month later, or another date shown in-app. Confirm the plan shown by Grab.'},
    'SPayLater':{defaultRule:'next_cycle',note:'No upfront payment for the normal bill flow; repayment starts in the next applicable billing cycle after completion.'},
    'ABNK':{defaultRule:'purchase',note:'Normally starts at purchase/approval; Pay-in-30-days plans should use 1 month after purchase or a custom date.'},
    'CIMB PayLater':{defaultRule:'statement',note:'Use the first instalment date shown on the approved PayLater schedule/statement.'},
    'Credit Card Instalment':{defaultRule:'statement',note:'Use the first instalment date shown on the card statement or bank schedule.'},
    'Merchant Instalment':{defaultRule:'custom',note:'Merchant plans vary. Enter the contractual first payment date.'},
    'Other / Custom Provider':{defaultRule:'custom',note:'Enter the payment start rule and first payment date from the provider agreement.'}
  };
  const num=v=>Math.max(0,Number(v)||0);
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const money2=v=>Math.round((Number(v)||0)*100)/100;
  const persist=()=>{const raw=JSON.stringify(db);localStorage.setItem(MGW.key,raw);if(localStorage.getItem(MGW.key)!==raw)throw new Error('Pay-Later data storage verification failed');};
  const closeModalSafe=()=>{const m=document.querySelector('#modal');if(m?.open)try{m.close()}catch(err){window.MGWUATDiagnostics?.capture?.(err,'paylater-modal-close')}};
  const refreshAccountUI=()=>{try{window.MGWCreditManager?.render?.();queueMicrotask(enhanceRenderedCards)}catch(err){window.MGWUATDiagnostics?.capture?.(err,'paylater-targeted-refresh')}};
  const safeDate=(y,m,d)=>new Date(y,m,Math.min(d,new Date(y,m+1,0).getDate()));
  const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parseDate=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
  const addMonths=(date,n)=>safeDate(date.getFullYear(),date.getMonth()+n,date.getDate());
  const cycleBounds=anchor=>typeof mgwCycleBounds==='function'?mgwCycleBounds(anchor):{start:new Date(anchor.getFullYear(),anchor.getMonth(),1),end:new Date(anchor.getFullYear(),anchor.getMonth()+1,1)};
  const inCycle=(date,anchor)=>{const d=parseDate(date);if(!d)return false;const b=cycleBounds(anchor);return d>=b.start&&d<b.end};
  const allPaid=a=>(db.payLaterPayments||[]).filter(x=>x.accountId===a.id).reduce((t,x)=>t+num(x.amount),0);
  const paidForCycle=(a,anchor)=>(db.payLaterPayments||[]).filter(x=>x.accountId===a.id&&inCycle(x.date,anchor)).reduce((t,x)=>t+num(x.amount),0);
  const totalRepayable=a=>money2(Math.max(0,num(a.productCost)-num(a.downpayment))+num(a.fees)+num(a.interestAmount));

  function resolveFirstDue(a){
    const purchase=parseDate(a.purchaseDate),explicit=parseDate(a.firstDueDate),rule=a.paymentStartRule||'custom';
    if(rule==='purchase'&&purchase)return purchase;
    if(rule==='month_after'&&purchase)return addMonths(purchase,1);
    if(rule==='next_cycle'&&purchase){const d=addMonths(purchase,1);return a.dueDay?safeDate(d.getFullYear(),d.getMonth(),Math.min(31,Math.max(1,Number(a.dueDay)))):d}
    if(rule==='statement')return explicit;
    return explicit;
  }
  function schedule(a){
    const first=resolveFirstDue(a),months=Math.max(1,Math.floor(num(a.durationMonths)||1));if(!first)return[];
    const total=totalRepayable(a),custom=money2(num(a.customMonthlyPayment));
    const regular=a.installmentMode==='custom'&&custom>0?custom:money2(total/months);
    const rows=[];let allocated=0;
    for(let i=0;i<months;i++){
      let amount=i===months-1?money2(total-allocated):regular;
      if(i<months-1&&allocated+amount>total)amount=money2(Math.max(0,total-allocated));
      allocated=money2(allocated+amount);rows.push({index:i+1,date:key(addMonths(first,i)),amount});
    }
    return rows;
  }
  const currentDue=(a,anchor=MGW.state.month)=>money2(Math.max(0,schedule(a).filter(x=>inCycle(x.date,anchor)).reduce((t,x)=>t+x.amount,0)-paidForCycle(a,anchor)));
  const nextDue=a=>{const now=new Date();now.setHours(0,0,0,0);return schedule(a).find(x=>parseDate(x.date)>=now)?.date||''};

  function syncAccounts(){
    db.payLaterAccounts=Array.isArray(db.payLaterAccounts)?db.payLaterAccounts:[];let changed=false;
    db.payLaterAccounts.forEach(a=>{if(!a.recurrenceEnabled)return;const total=totalRepayable(a),out=money2(Math.max(0,total-allPaid(a))),due=currentDue(a),next=nextDue(a),status=out<=0?'completed':'active';
      for(const [k,v] of Object.entries({totalRepayable:total,outstanding:out,cycleDue:due,nextDueDate:next,status})){if(a[k]!==v){a[k]=v;changed=true}}
    });if(changed)persist();
  }
  const providerOptions=s=>PROVIDERS.map(p=>`<option value="${esc(p)}" ${p===s?'selected':''}>${esc(p)}</option>`).join('');
  const durationOptions=s=>COMMON_DURATIONS.map(n=>`<option value="${n}" ${n===s?'selected':''}>${n} month${n===1?'':'s'}</option>`).join('')+`<option value="custom" ${COMMON_DURATIONS.includes(s)?'':'selected'}>Custom duration</option>`;
  const startRuleOptions=s=>Object.entries(START_RULES).map(([v,l])=>`<option value="${v}" ${v===s?'selected':''}>${l}</option>`).join('');
  function showModal(title,html){const m=document.querySelector('#modal'),body=document.querySelector('#modalBody');if(!m||!body)return null;document.querySelector('#modalTitle').textContent=title;body.innerHTML=html;try{if(m.open)m.close();m.showModal()}catch(err){window.MGWUATDiagnostics?.capture?.(err,'paylater-modal-open');return null}return body}
  function planSummary(o){const rows=schedule(o),total=totalRepayable(o);if(!rows.length||!total)return '<small>Enter purchase details and a valid first-payment rule/date to preview the plan.</small>';return `<b>Total repayable:</b> ${money(total)}<br><b>Generated payment:</b> ${money(rows[0].amount)} / month${rows.length>1&&rows.at(-1).amount!==rows[0].amount?` · final ${money(rows.at(-1).amount)}`:''}<br><b>Schedule:</b> ${esc(rows[0].date)} → ${esc(rows.at(-1).date)} · ${rows.length} payment${rows.length===1?'':'s'}`}

  function openLater(a={}){
    const edit=Boolean(a.id),legacy=!a.recurrenceEnabled&&edit,provider=PROVIDERS.includes(a.provider)?a.provider:(a.provider?'Other / Custom Provider':'Atome');
    const policy=PROVIDER_POLICIES[provider],duration=Number(a.durationMonths)||12,purchase=a.purchaseDate||new Date().toISOString().slice(0,10),rule=a.paymentStartRule||policy.defaultRule;
    const first=a.firstDueDate||a.nextDueDate||'',productCost=a.productCost??(legacy?a.outstanding:'');
    const body=showModal(edit?'Edit Pay-Later Plan':'Add Pay-Later Plan',`<form id="mgwRecurringLaterForm" class="form-grid">
      <div class="field full"><label>Product / purchase name</label><input name="name" required value="${esc(a.name||'')}" placeholder="e.g. Phone, appliance, travel booking"></div>
      <div class="field"><label>Provider</label><select name="provider">${providerOptions(provider)}</select></div>
      <div class="field" id="mgwCustomProviderWrap"><label>Custom provider</label><input name="customProvider" value="${esc(a.customProvider||'')}" placeholder="Provider name"></div>
      <div class="field"><label>Purchase date</label><input name="purchaseDate" type="date" required value="${purchase}"></div>
      <div class="field"><label>Product cost</label><input name="productCost" type="number" min="0.01" step="0.01" required value="${productCost}"></div>
      <div class="field"><label>Downpayment</label><input name="downpayment" type="number" min="0" step="0.01" value="${a.downpayment??0}"></div>
      <div class="field"><label>Fees</label><input name="fees" type="number" min="0" step="0.01" value="${a.fees??0}"></div>
      <div class="field"><label>Interest amount</label><input name="interestAmount" type="number" min="0" step="0.01" value="${a.interestAmount??0}"></div>
      <div class="field"><label>Installment duration</label><select name="durationPreset">${durationOptions(duration)}</select></div>
      <div class="field" id="mgwCustomDurationWrap"><label>Custom months</label><input name="durationMonths" type="number" min="1" max="120" value="${duration}"></div>
      <div class="field"><label>Payment start rule</label><select name="paymentStartRule">${startRuleOptions(rule)}</select></div>
      <div class="field" id="mgwDueDayWrap"><label>Billing / due day</label><input name="dueDay" type="number" min="1" max="31" value="${a.dueDay??''}" placeholder="e.g. 10"></div>
      <div class="field full" id="mgwFirstDueWrap"><label>First payment / statement due date</label><input name="firstDueDate" type="date" value="${first}"></div>
      <div class="field full"><div class="mgw-form-note" id="mgwProviderPolicy"></div></div>
      <div class="field"><label>Payment calculation</label><select name="installmentMode"><option value="equal" ${a.installmentMode!=='custom'?'selected':''}>Equal installments</option><option value="custom" ${a.installmentMode==='custom'?'selected':''}>Custom monthly amount</option></select></div>
      <div class="field" id="mgwCustomMonthlyWrap"><label>Custom monthly amount</label><input name="customMonthlyPayment" type="number" min="0.01" step="0.01" value="${a.customMonthlyPayment??''}"></div>
      <div class="field full"><div class="mgw-form-note" id="mgwPlanPreview"></div></div>
      <div class="field full"><button class="primary-btn">${edit?'Save Changes':'Add Pay-Later Plan'}</button></div>
      ${edit?'<div class="field full"><button type="button" class="danger" id="mgwDeleteRecurringLater">Delete Pay-Later</button></div>':''}
    </form>`);if(!body)return;
    const f=body.querySelector('form'),providerEl=f.elements.provider,preset=f.elements.durationPreset,ruleEl=f.elements.paymentStartRule,mode=f.elements.installmentMode;
    const refresh=()=>{
      const p=PROVIDER_POLICIES[providerEl.value]||PROVIDER_POLICIES['Other / Custom Provider'];
      if(!edit||!a.paymentStartRule)ruleEl.value=p.defaultRule;
      body.querySelector('#mgwCustomProviderWrap').style.display=providerEl.value==='Other / Custom Provider'?'':'none';
      body.querySelector('#mgwCustomDurationWrap').style.display=preset.value==='custom'?'':'none';
      body.querySelector('#mgwCustomMonthlyWrap').style.display=mode.value==='custom'?'':'none';
      body.querySelector('#mgwDueDayWrap').style.display=ruleEl.value==='next_cycle'?'':'none';
      body.querySelector('#mgwFirstDueWrap').style.display=['statement','custom'].includes(ruleEl.value)?'':'none';
      body.querySelector('#mgwProviderPolicy').innerHTML=`<b>${esc(providerEl.value)} policy:</b> ${esc(p.note)}<br><small>MGW suggests a default only. Your provider statement/agreement is authoritative.</small>`;
      const fd=new FormData(f),o={productCost:num(fd.get('productCost')),downpayment:num(fd.get('downpayment')),fees:num(fd.get('fees')),interestAmount:num(fd.get('interestAmount')),durationMonths:preset.value==='custom'?Math.max(1,Number(fd.get('durationMonths'))||1):Number(preset.value),purchaseDate:String(fd.get('purchaseDate')||''),paymentStartRule:String(fd.get('paymentStartRule')||''),dueDay:Number(fd.get('dueDay'))||'',firstDueDate:String(fd.get('firstDueDate')||''),installmentMode:fd.get('installmentMode')==='custom'?'custom':'equal',customMonthlyPayment:num(fd.get('customMonthlyPayment'))};
      body.querySelector('#mgwPlanPreview').innerHTML=planSummary(o);
    };
    providerEl.addEventListener('change',()=>{ruleEl.value=(PROVIDER_POLICIES[providerEl.value]||PROVIDER_POLICIES['Other / Custom Provider']).defaultRule;refresh()});f.addEventListener('input',refresh);f.addEventListener('change',refresh);refresh();
    f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f),durationMonths=preset.value==='custom'?Math.max(1,Number(fd.get('durationMonths'))||1):Number(preset.value);const o={id:a.id||id('LATER'),name:String(fd.get('name')||'').trim(),provider:String(fd.get('provider')||''),customProvider:String(fd.get('customProvider')||'').trim(),purchaseDate:String(fd.get('purchaseDate')||''),productCost:num(fd.get('productCost')),downpayment:num(fd.get('downpayment')),fees:num(fd.get('fees')),interestAmount:num(fd.get('interestAmount')),durationMonths,paymentStartRule:String(fd.get('paymentStartRule')||'custom'),dueDay:Number(fd.get('dueDay'))||'',firstDueDate:String(fd.get('firstDueDate')||''),installmentMode:fd.get('installmentMode')==='custom'?'custom':'equal',customMonthlyPayment:num(fd.get('customMonthlyPayment')),recurrenceEnabled:true,status:a.status||'active',createdAt:a.createdAt||new Date().toISOString()};
      if(o.provider==='Other / Custom Provider'&&!o.customProvider){toast?.('Enter the custom provider name');return}if(o.downpayment>o.productCost){toast?.('Downpayment cannot exceed product cost');return}if(['statement','custom'].includes(o.paymentStartRule)&&!o.firstDueDate){toast?.('Enter the first payment date');return}if(o.installmentMode==='custom'&&o.customMonthlyPayment<=0){toast?.('Enter the custom monthly payment');return}
      o.totalRepayable=totalRepayable(o);o.outstanding=money2(Math.max(0,o.totalRepayable-allPaid(o)));o.cycleDue=currentDue(o);o.nextDueDate=nextDue(o);try{if(f.dataset.mgwSaving==='1')return;f.dataset.mgwSaving='1';const submit=f.querySelector('button.primary-btn');if(submit){submit.disabled=true;submit.textContent='Saving…'}if(!edit)db.payLaterAccounts.push(o);else Object.assign(a,o);persist();const stored=JSON.parse(localStorage.getItem(MGW.key)||'{}');if(!(stored.payLaterAccounts||[]).some(x=>x?.id===o.id))throw new Error('Saved Pay-Later plan failed database read-back verification');closeModalSafe();refreshAccountUI();toast?.(edit?'Pay-Later plan updated':'Pay-Later plan added')}catch(err){f.dataset.mgwSaving='0';const submit=f.querySelector('button.primary-btn');if(submit){submit.disabled=false;submit.textContent=edit?'Save Changes':'Add Pay-Later Plan'}window.MGWUATDiagnostics?.capture?.(err,'paylater-save');toast?.(err?.message||'Could not save Pay-Later plan')}
    });
    body.querySelector('#mgwDeleteRecurringLater')?.addEventListener('click',()=>{if(!confirm('Delete this Pay-Later tracker? Existing expense transactions will not be deleted.'))return;db.payLaterAccounts=db.payLaterAccounts.filter(x=>x.id!==a.id);db.payLaterPayments=(db.payLaterPayments||[]).filter(x=>x.accountId!==a.id);persist();closeModalSafe();refreshAccountUI();toast?.('Pay-Later tracker deleted')});
  }
  function enhanceRenderedCards(){document.querySelectorAll('[data-later-edit]').forEach(btn=>{const a=(db.payLaterAccounts||[]).find(x=>x.id===btn.dataset.laterEdit);if(!a?.recurrenceEnabled)return;const card=btn.closest('.mgw-account');if(!card||card.querySelector('.mgw-later-plan-meta'))return;const meta=document.createElement('p');meta.className='mgw-muted mgw-later-plan-meta';const provider=a.provider==='Other / Custom Provider'?(a.customProvider||a.provider):a.provider;meta.textContent=`${provider||'Pay-Later'} · ${START_RULES[a.paymentStartRule]||'Custom date'} · ${a.durationMonths} months · ${money(totalRepayable(a))} total repayable`;card.querySelector('.mgw-account-actions')?.before(meta)})}
  function installInterceptors(){document.addEventListener('click',e=>{const add=e.target.closest?.('#mgwAddLater');if(add){e.preventDefault();e.stopImmediatePropagation();openLater();return}const edit=e.target.closest?.('[data-later-edit]');if(edit){const a=(db.payLaterAccounts||[]).find(x=>x.id===edit.dataset.laterEdit);if(a){e.preventDefault();e.stopImmediatePropagation();openLater(a)}}},true)}
  function boot(){db.payLaterAccounts=Array.isArray(db.payLaterAccounts)?db.payLaterAccounts:[];db.payLaterPayments=Array.isArray(db.payLaterPayments)?db.payLaterPayments:[];syncAccounts();installInterceptors();if(typeof renderAll==='function'&&!renderAll.__mgwPayLaterRecurrence){const base=renderAll;renderAll=function(){syncAccounts();base();queueMicrotask(enhanceRenderedCards)};renderAll.__mgwPayLaterRecurrence=true}queueMicrotask(enhanceRenderedCards);window.MGWPayLater={version:RELEASE,providers:[...PROVIDERS],providerPolicies:PROVIDER_POLICIES,startRules:START_RULES,schedule,currentDue,open:openLater}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();