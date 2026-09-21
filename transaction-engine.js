// MoneyGoWhere DEV — Phase 6 transaction derivation and provenance engine.
// Keeps transaction facts in the DB; dashboards derive views from these records.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const MODEL_VERSION=1;
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const num=v=>Math.max(0,Number(v)||0);
const norm=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const money2=v=>Math.round((Number(v)||0)*100)/100;
const sourceMap=Object.freeze({
  manual:'manual',receipt_scan:'receipt',receipt:'receipt',ocr:'receipt',
  apple_pay:'apple-pay',applepay:'apple-pay',apple_wallet:'apple-pay',
  import:'import',imported:'import',wallet_import:'import',
  recurring:'recurring',migration:'migration'
});
function ensure(database=window.db||{}){
  database.expenses=Array.isArray(database.expenses)?database.expenses:[];
  database.income=Array.isArray(database.income)?database.income:[];
  database.transactionModelMeta=isObj(database.transactionModelMeta)?database.transactionModelMeta:{version:MODEL_VERSION};
  return database;
}
function provenance(row){
  const raw=String(row?.provenance||row?.source||row?.scanSource||'').toLowerCase().replace(/\s+/g,'_');
  if(sourceMap[raw])return sourceMap[raw];
  if(raw.includes('apple'))return 'apple-pay';
  if(raw.includes('receipt')||raw.includes('scan')||raw.includes('ocr'))return 'receipt';
  if(raw.includes('import'))return 'import';
  if(raw.includes('recurr'))return 'recurring';
  if(raw.includes('migrat'))return 'migration';
  return 'manual';
}
function fingerprint(row){
  const parts=[
    String(row?.date||'').slice(0,10),
    String(row?.time||'').slice(0,5),
    norm(row?.vendor||row?.merchant||''),
    money2(row?.amount).toFixed(2),
    String(row?.currency||'SGD').toUpperCase(),
    String(row?.paymentSourceId||row?.paymentAccountId||'')
  ];
  return parts.join('|');
}
function stableId(prefix,row,index){
  const existing=String(row?.id||'').trim();if(existing)return existing;
  let h=2166136261;const text=fingerprint(row)+'|'+index;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
  return `${prefix}-${(h>>>0).toString(36).toUpperCase()}`;
}
function prepareExpense(row,index=0){
  const x={...row};
  x.id=stableId('EXP',x,index);
  x.provenance=provenance(x);
  x.paymentSourceId=x.paymentSourceId||x.paymentAccountId||x.paymentBankAccountId||'';
  if(x.paymentSourceId&&!x.paymentAccountId)x.paymentAccountId=x.paymentSourceId;
  x.transactionFingerprint=x.transactionFingerprint||fingerprint(x);
  return x;
}
function prepareIncome(row,index=0){
  const x={...row};
  x.id=stableId('INC',{...x,amount:num(x.netSalary)||num(x.amount)},index);
  x.provenance=provenance(x);
  return x;
}
function monthKeyFromDate(v){return String(v||'').slice(0,7)}
function recurringCandidates(expense,database){
  if(!window.MGWRecurringEngine?.itemsForMonth)return[];
  const key=monthKeyFromDate(expense.date);if(!/^\d{4}-\d{2}$/.test(key))return[];
  const items=window.MGWRecurringEngine.itemsForMonth(key,database,{excludeTypes:['income','installment']});
  const hay=norm([expense.vendor,expense.merchant,expense.notes].filter(Boolean).join(' '));
  if(!hay)return[];
  return items.map(item=>{
    const needle=norm(item.merchant||item.name);if(!needle)return null;
    const nameMatch=hay===needle?3:(hay.includes(needle)||needle.includes(hay)?2:0);if(!nameMatch)return null;
    const expected=num(item.amount),actual=num(expense.amount),diff=Math.abs(actual-expected),tol=Math.max(2,expected*.35);
    if(diff>tol)return null;
    return {item,score:nameMatch*100-Math.min(99,diff)};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
}
function linkRecurring(database=window.db||{}){
  ensure(database);let linked=0;
  const used=new Set();
  for(const x of database.expenses){
    if(x.recurringItemId){used.add(x.recurringItemId);continue}
    const matches=recurringCandidates(x,database).filter(m=>!used.has(m.item.id));
    if(!matches.length)continue;
    if(matches.length>1&&matches[0].score===matches[1].score)continue;
    x.recurringItemId=matches[0].item.id;used.add(matches[0].item.id);linked++;
  }
  return linked;
}
function sync(database=window.db||{},options={}){
  ensure(database);
  database.expenses=database.expenses.map((x,i)=>prepareExpense(x,i));
  database.income=database.income.map((x,i)=>prepareIncome(x,i));
  const recurringLinked=linkRecurring(database);
  const seen=new Map(),duplicates=[];
  for(const x of database.expenses){
    const fp=x.transactionFingerprint||fingerprint(x);
    if(seen.has(fp))duplicates.push({fingerprint:fp,ids:[seen.get(fp),x.id]});else seen.set(fp,x.id);
  }
  database.transactionModelMeta={...(database.transactionModelMeta||{}),version:MODEL_VERSION,lastSyncedAt:new Date().toISOString(),expenseCount:database.expenses.length,incomeCount:database.income.length,duplicateFingerprintCount:duplicates.length};
  if(options.persist!==false){try{localStorage.setItem(window.MGW?.key||'moneygowhere-db-v1',JSON.stringify(database))}catch(err){console.warn('MoneyGoWhere transaction model persistence failed',err)}}
  return {expenses:database.expenses.length,income:database.income.length,recurringLinked,duplicates:duplicates.length};
}
function accountFor(row,database=window.db||{}){
  const id=row?.paymentSourceId||row?.paymentAccountId||row?.paymentBankAccountId||'';
  return id&&window.MGWAccountRegistry?.byId?window.MGWAccountRegistry.byId(id,database):null;
}
function isPayLaterExpense(row,database=window.db||{}){
  const a=accountFor(row,database);if(a?.type==='paylater')return true;
  const id=row?.paymentSourceId||row?.paymentAccountId||'';
  return Boolean(id&&(database.payLaterAccounts||[]).some(x=>String(x.id)===String(id)));
}
function group(rows,keyFn,amountFn=x=>num(x.amount)){
  const map=new Map();
  for(const row of rows){const key=String(keyFn(row)||'Other');map.set(key,(map.get(key)||0)+amountFn(row))}
  return [...map.entries()].map(([name,amount])=>({name,amount:money2(amount)})).sort((a,b)=>b.amount-a.amount);
}
function cycle(anchor,database=window.db||{}){
  sync(database,{persist:false});
  const inCycle=x=>typeof mgwInCycle==='function'?mgwInCycle(x,anchor):String(x?.date||'').startsWith(`${anchor.getFullYear()}-${String(anchor.getMonth()+1).padStart(2,'0')}`);
  const expenses=database.expenses.filter(inCycle),income=database.income.filter(inCycle);
  const recurring=expenses.filter(x=>x.recurringItemId),payLater=expenses.filter(x=>isPayLaterExpense(x,database)),dayToDay=expenses.filter(x=>!x.recurringItemId&&!isPayLaterExpense(x,database));
  return {
    expenses,income,recurring,payLater,dayToDay,
    totals:{all:expenses.reduce((t,x)=>t+num(x.amount),0),recurring:recurring.reduce((t,x)=>t+num(x.amount),0),payLater:payLater.reduce((t,x)=>t+num(x.amount),0),dayToDay:dayToDay.reduce((t,x)=>t+num(x.amount),0)},
    byCategory:group(expenses,x=>x.category||'Other'),
    byAccount:group(expenses,x=>accountFor(x,database)?.name||x.paymentSource||x.card||x.paymentMethod||'Unassigned'),
    byProvenance:group(expenses,x=>x.provenance||provenance(x))
  };
}
function describe(database=window.db||{}){
  ensure(database);const r=sync(database,{persist:false});
  return {version:MODEL_VERSION,...r};
}
function onReady(){try{const info=sync(window.db||{},{persist:true});document.dispatchEvent(new CustomEvent('mgw:transaction-model-ready',{detail:info}))}catch(err){console.error('MoneyGoWhere transaction model sync failed',err)}}
document.addEventListener('mgw:data-ready',onReady);
document.addEventListener('mgw:data-restored',()=>setTimeout(onReady,0));
document.addEventListener('mgw:accounts-changed',()=>{try{sync(window.db||{},{persist:true})}catch{}});
document.addEventListener('mgw:recurring-changed',()=>{try{sync(window.db||{},{persist:true})}catch{}});
window.MGWTransactionEngine=Object.freeze({version:RELEASE,modelVersion:MODEL_VERSION,ensure,sync,prepareExpense,prepareIncome,provenance,fingerprint,linkRecurring,accountFor,isPayLaterExpense,cycle,describe});
})();