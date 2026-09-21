// MoneyGoWhere DEV — Phase 4 unified recurring engine.
// Canonical recurringItems[] model with compatibility mirrors for legacy recurring collections.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const MODEL_VERSION=2;
const STEPS=Object.freeze({monthly:1,bimonthly:2,quarterly:3,halfyearly:6,yearly:12});
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const num=v=>Math.max(0,Number(v)||0);
const clone=v=>JSON.parse(JSON.stringify(v));
const monthIndex=k=>{const [y,m]=String(k||'').slice(0,7).split('-').map(Number);return Number.isFinite(y)&&Number.isFinite(m)?y*12+m-1:NaN};
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const canonicalId=(source,id)=>`REC-${source}-${String(id||'unknown')}`;
const norm=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const hash=v=>{let h=2166136261;for(const ch of String(v||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return(h>>>0).toString(36).toUpperCase()};
const importedRow=x=>{
  const p=String(x?.provenance||'').toLowerCase(),s=String(x?.source||'').toLowerCase(),n=String(x?.notes||'').toLowerCase();
  return ['import','migration'].includes(p)||/\.(pdf|csv|xlsx?|json)$/.test(s)||/\b(imported|migrated|reconciled)\b/.test(n);
};
const similarName=(a,b)=>{const x=norm(a),y=norm(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)))};


function ensure(database=window.db||{}){
  database.recurringItems=Array.isArray(database.recurringItems)?database.recurringItems:[];
  database.recurringIncome=Array.isArray(database.recurringIncome)?database.recurringIncome:[];
  database.recurringCommitments=Array.isArray(database.recurringCommitments)?database.recurringCommitments:[];
  database.recurringBills=Array.isArray(database.recurringBills)?database.recurringBills:[];
  database.monthlyCommitments=Array.isArray(database.monthlyCommitments)?database.monthlyCommitments:[];
  database.payLaterAccounts=Array.isArray(database.payLaterAccounts)?database.payLaterAccounts:[];
  database.recurringModelMeta=isObj(database.recurringModelMeta)?database.recurringModelMeta:{version:MODEL_VERSION};
  return database;
}
function active(item,key){
  if(!item||item.active===false)return false;
  const cur=monthIndex(key),start=monthIndex(item.startMonth||key),end=item.endMonth?monthIndex(item.endMonth):Infinity;
  if(!Number.isFinite(cur)||!Number.isFinite(start)||cur<start||cur>end)return false;
  return (cur-start)%(STEPS[item.frequency]||1)===0;
}
function inferCommitmentType(x){
  const t=String(x?.type||x?.category||'').toLowerCase();
  if(t.includes('saving'))return 'savings';
  if(t.includes('loan')||t.includes('debt'))return 'loan';
  return 'commitment';
}
function fromIncome(x){
  return {id:canonicalId('income',x.id),sourceId:x.id,sourceCollection:'recurringIncome',type:'income',name:x.name||'Salary',amount:num(x.netSalary),baseAmount:num(x.baseSalary),frequency:x.frequency||'monthly',startMonth:x.startMonth||'',endMonth:x.endMonth||'',day:x.payDay||'',active:x.active!==false,accountId:x.accountId||x.paymentSourceId||'',merchant:'',metadata:{legacy:true}};
}
function fromCommitment(x,source='recurringCommitments'){
  const fixed=source==='monthlyCommitments';
  return {id:canonicalId(source,x.id),sourceId:x.id,sourceCollection:source,type:inferCommitmentType(x),name:x.name||x.type||'Commitment',amount:num(x.amount),frequency:fixed?'monthly':(x.frequency||'monthly'),startMonth:fixed?'':(x.startMonth||''),endMonth:fixed?'':(x.endMonth||''),day:x.dueDay||'',active:x.active!==false,accountId:x.accountId||x.paymentSourceId||'',merchant:x.merchant||'',category:x.category||x.type||'',metadata:{legacy:true,fixed}};
}
function fromBill(x){
  return {id:canonicalId('bill',x.id),sourceId:x.id,sourceCollection:'recurringBills',type:'bill',name:x.name||x.merchant||'Recurring bill',amount:num(x.amount),frequency:x.frequency||'monthly',startMonth:x.startMonth||'',endMonth:x.endMonth||'',day:x.dueDay||'',active:x.active!==false,accountId:x.accountId||x.paymentSourceId||'',merchant:x.merchant||'',category:x.category||'',group:x.group||'',metadata:{legacy:true,confidence:x.confidence||''}};
}
function historicalRecurring(database,existing=[]){
  const groups=new Map(),rows=Array.isArray(database.expenses)?database.expenses:[];
  let latestMonth=-Infinity;
  for(const x of rows){
    const date=String(x?.date||'').slice(0,10),month=monthIndex(date);
    if(Number.isFinite(month))latestMonth=Math.max(latestMonth,month);
    if(!importedRow(x)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!num(x.amount))continue;
    const vendor=String(x.vendor||x.merchant||'').trim(),category=String(x.category||'').trim();
    if(!vendor)continue;
    const key=`${norm(vendor)}|${norm(category)}`;
    if(!groups.has(key))groups.set(key,{vendor,category,rows:[]});
    groups.get(key).rows.push(x);
  }
  const out=[];
  for(const [key,g] of groups){
    const months=[...new Set(g.rows.map(x=>monthIndex(x.date)).filter(Number.isFinite))].sort((a,b)=>a-b);
    if(months.length<6)continue;
    let consecutive=0;for(let i=1;i<months.length;i++)if(months[i]-months[i-1]===1)consecutive++;
    if(months.length>1&&consecutive/(months.length-1)<.7)continue;
    if(existing.some(x=>x?.active!==false&&similarName(x.merchant||x.name,g.vendor)))continue;
    const sorted=[...g.rows].sort((a,b)=>String(a.date).localeCompare(String(b.date))),latest=sorted[sorted.length-1];
    const lastMonth=monthIndex(latest.date),ended=Number.isFinite(latestMonth)&&Number.isFinite(lastMonth)&&latestMonth-lastMonth>2;
    const t=String(g.category||'').toLowerCase();
    const type=t.includes('saving')?'savings':(t.includes('loan')||t.includes('debt')?'loan':'commitment');
    out.push({
      id:`REC-historical-${hash(key)}`,sourceId:key,sourceCollection:'canonical',type,
      name:g.vendor,amount:num(latest.amount),frequency:'monthly',
      startMonth:String(sorted[0].date).slice(0,7),endMonth:ended?String(latest.date).slice(0,7):'',
      day:String(latest.date).slice(8,10),active:true,accountId:'',merchant:g.vendor,category:g.category,
      metadata:{inferredHistory:true,sampleCount:months.length,confidence:'history-high',amountBasis:'latest-observed'}
    });
  }
  return out;
}
function fromInstallment(x){
  return {id:canonicalId('installment',x.id),sourceId:x.id,sourceCollection:'payLaterAccounts',type:'installment',name:x.name||x.provider||'Pay-Later',amount:num(x.cycleDue||x.monthlyPayment||x.installmentAmount),frequency:'monthly',startMonth:String(x.firstDueDate||x.purchaseDate||'').slice(0,7),endMonth:'',day:x.dueDay||String(x.nextDueDate||'').slice(8,10)||'',active:x.status!=='completed'&&x.active!==false,accountId:x.id||'',merchant:x.provider||'',metadata:{legacy:true,recurrenceEnabled:Boolean(x.recurrenceEnabled),durationMonths:Number(x.durationMonths)||null}};
}
function sync(database=window.db||{},options={}){
  ensure(database);
  const retained=database.recurringItems.filter(x=>x?.sourceCollection==='canonical'&&!x?.metadata?.inferredHistory).map(clone);
  const next=[...retained];
  for(const x of database.recurringIncome)next.push(fromIncome(x));
  for(const x of database.monthlyCommitments)next.push(fromCommitment(x,'monthlyCommitments'));
  for(const x of database.recurringCommitments)next.push(fromCommitment(x,'recurringCommitments'));
  for(const x of database.recurringBills)next.push(fromBill(x));
  for(const x of database.payLaterAccounts)if(x.recurrenceEnabled)next.push(fromInstallment(x));
  next.push(...historicalRecurring(database,next));
  const seen=new Set();database.recurringItems=next.filter(x=>x?.id&&!seen.has(x.id)&&(seen.add(x.id),true));
  database.recurringModelMeta={...(database.recurringModelMeta||{}),version:MODEL_VERSION,lastSyncedAt:new Date().toISOString(),itemCount:database.recurringItems.length};
  if(options.persist!==false){
    try{localStorage.setItem(window.MGW?.key||'moneygowhere-db-v1',JSON.stringify(database))}catch(err){console.warn('MoneyGoWhere recurring registry persistence failed',err)}
  }
  return describe(database);
}
function itemsForMonth(key,database=window.db||{},filter={}){
  ensure(database);sync(database,{persist:false});
  return database.recurringItems.filter(x=>active(x,key)&&(!filter.type||x.type===filter.type)&&(!filter.excludeTypes||!filter.excludeTypes.includes(x.type)));
}
function incomeForMonth(key,database=window.db||{}){return itemsForMonth(key,database,{type:'income'})}
function commitmentItemsForMonth(key,database=window.db||{}){
  return itemsForMonth(key,database,{excludeTypes:['income','installment']});
}
function installmentItemsForMonth(key,database=window.db||{}){return itemsForMonth(key,database,{type:'installment'})}
function totalForMonth(key,database=window.db||{},filter={}){
  return itemsForMonth(key,database,filter).reduce((t,x)=>t+num(x.amount),0);
}
function addItem(item,database=window.db||{}){
  ensure(database);
  const id=item.id||`REC-canonical-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  database.recurringItems.push({frequency:'monthly',active:true,startMonth:monthKey(new Date()),...clone(item),id,sourceCollection:'canonical',sourceId:id});
  database.recurringModelMeta.lastSyncedAt=new Date().toISOString();
  return id;
}
function describe(database=window.db||{}){
  ensure(database);
  const byType={};for(const x of database.recurringItems)byType[x.type]=(byType[x.type]||0)+1;
  const current=monthKey(new Date()),activeCount=database.recurringItems.filter(x=>active(x,current)).length;
  return {version:MODEL_VERSION,total:database.recurringItems.length,active:activeCount,byType};
}
function onDataReady(){
  try{const info=sync(window.db||{},{persist:true});document.dispatchEvent(new CustomEvent('mgw:recurring-registry-ready',{detail:info}))}
  catch(err){console.error('MoneyGoWhere recurring registry sync failed',err)}
}
document.addEventListener('mgw:data-ready',onDataReady);
document.addEventListener('mgw:data-restored',()=>setTimeout(onDataReady,0));
document.addEventListener('mgw:recurring-changed',()=>{try{sync(window.db||{},{persist:true})}catch(err){console.error('MoneyGoWhere recurring registry refresh failed',err)}});
document.addEventListener('mgw:accounts-changed',()=>{try{sync(window.db||{},{persist:false})}catch{}});
window.MGWRecurringEngine=Object.freeze({version:RELEASE,modelVersion:MODEL_VERSION,ensure,sync,active,itemsForMonth,incomeForMonth,commitmentItemsForMonth,installmentItemsForMonth,totalForMonth,addItem,describe,monthKey,historicalRecurring});
})();