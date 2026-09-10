// MoneyGoWhere v1.5.1 accounting guardrail.
// Keeps Safe to Spend conservative after debt / Pay-Later payments are recorded.
(() => {
  const num=v=>Math.max(0,Number(v)||0);
  const norm=v=>String(v||'').trim().toLowerCase();
  const cycleExpenses=()=>typeof monthExpenses==='function'?monthExpenses(MGW.state.month):[];
  const cycleIncome=()=>typeof monthIncome==='function'?monthIncome(MGW.state.month):[];
  const paidInCycle=(type,accountId)=>{
    const rows=type==='card'?(db.creditPayments||[]):(db.payLaterPayments||[]);
    return rows.filter(x=>x.accountId===accountId&&(typeof mgwInCycle!=='function'||mgwInCycle(x,MGW.state.month))).reduce((t,x)=>t+num(x.amount),0);
  };
  const payLaterNames=()=>((db.payLaterAccounts||[]).map(a=>norm(a.name)).filter(Boolean));
  const immediateSpend=()=>{
    const deferred=payLaterNames();
    return cycleExpenses().filter(x=>!deferred.some(n=>{
      const c=norm(x.card||x.paymentSource||x.paymentMethod);
      return c&&(c===n||c.includes(n)||n.includes(c));
    })).reduce((t,x)=>t+num(x.amount),0);
  };
  const debtCommitment=()=>((db.creditAccounts||[])
    .filter(a=>a.role==='debt'||a.role==='emergency-debt')
    .reduce((t,a)=>t+Math.max(num(a.plannedPayment),paidInCycle('card',a.id)),0));
  const payLaterCommitment=()=>((db.payLaterAccounts||[])
    .reduce((t,a)=>t+num(a.cycleDue)+paidInCycle('later',a.id),0));
  const daysLeft=()=>{
    if(typeof mgwCycleBounds!=='function')return 1;
    const b=mgwCycleBounds(MGW.state.month),now=new Date();now.setHours(0,0,0,0);
    const start=new Date(b.start);start.setHours(0,0,0,0);
    const end=new Date(b.end);end.setHours(0,0,0,0);
    if(now<start||now>=end)return Math.max(1,Math.ceil((end-start)/86400000));
    return Math.max(1,Math.ceil((end-now)/86400000));
  };
  function correctedPosition(){
    const income=cycleIncome().reduce((t,x)=>t+num(x.netSalary),0);
    const spent=immediateSpend(),debt=debtCommitment(),later=payLaterCommitment(),reserve=num(db.settings?.safeSpend?.reserve);
    const cash=Math.max(0,income-spent-debt-later-reserve);
    const budget=num(db.budgets?.monthly);
    const budgetLeft=budget?Math.max(0,budget-cycleExpenses().reduce((t,x)=>t+num(x.amount),0)):null;
    return {income,spent,debt,later,reserve,budgetLeft,safe:budgetLeft===null?cash:Math.min(cash,budgetLeft)};
  }
  function fixSafeSpend(){
    const card=document.querySelector('#mgwSafeSpendCard');
    if(!card||typeof money!=='function')return;
    const p=correctedPosition(),days=daysLeft();
    const hero=card.querySelector('.mgw-safe-hero');
    if(hero){const strong=hero.querySelector('strong');const smalls=hero.querySelectorAll('small');if(strong)strong.textContent=money(p.safe);if(smalls[1])smalls[1].textContent=`${money(p.safe/days)}/day · ${days} day${days===1?'':'s'} remaining`;}
    const vals=card.querySelectorAll('.mgw-safe-grid strong');
    const out=[money(p.income),`−${money(p.spent)}`,`−${money(p.debt)}`,`−${money(p.later)}`,`−${money(p.reserve)}`];
    if(p.budgetLeft!==null)out.push(money(p.budgetLeft));
    vals.forEach((el,i)=>{if(out[i]!=null)el.textContent=out[i]});
  }
  const install=()=>{
    if(typeof renderAll==='function'&&!renderAll.__mgwAccountingGuard){
      const prior=renderAll;
      const wrapped=function(){prior();fixSafeSpend()};
      wrapped.__mgwAccountingGuard=true;
      renderAll=wrapped;
    }
    fixSafeSpend();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
