// MoneyGoWhere DEV Pay-Later UI interaction patch
(()=>{
  'use strict';
  const RELEASE='1.5.5-dev.17';
  const manualRules=new WeakMap();
  function repair(form){
    if(!form)return;
    const rule=form.elements&&form.elements.paymentStartRule;
    if(!rule)return;
    const chosen=manualRules.get(form);
    if(chosen&&rule.value!==chosen)rule.value=chosen;
    const due=document.querySelector('#mgwDueDayWrap');
    const first=document.querySelector('#mgwFirstDueWrap');
    if(due)due.style.display=rule.value==='next_cycle'?'':'none';
    if(first)first.style.display=['statement','custom'].includes(rule.value)?'':'none';
  }
  document.addEventListener('change',e=>{
    const form=e.target.closest&&e.target.closest('#mgwRecurringLaterForm');
    if(!form)return;
    if(e.target.name==='provider'){
      manualRules.delete(form);
      queueMicrotask(()=>repair(form));
      return;
    }
    if(e.target.name==='paymentStartRule'){
      manualRules.set(form,e.target.value);
      queueMicrotask(()=>repair(form));
      return;
    }
    if(manualRules.has(form))queueMicrotask(()=>repair(form));
  },true);
  document.addEventListener('input',e=>{
    const form=e.target.closest&&e.target.closest('#mgwRecurringLaterForm');
    if(form&&manualRules.has(form))queueMicrotask(()=>repair(form));
  },true);
  window.MGWPayLaterRuleHotfix={version:RELEASE};
})();