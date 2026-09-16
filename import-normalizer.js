// MoneyGoWhere backup importer normalizer.
// Preserves unknown fields while upgrading mixed-generation backups into a safe runtime shape.
(()=>{
'use strict';
const RELEASE=window.MGW_RELEASE||{appVersion:'dev',schemaVersion:1,dataVersion:1,cacheVersion:'dev'};
const arr=(v)=>Array.isArray(v)?v:[];
const obj=(v)=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const num=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const text=(v='')=>String(v??'').trim();
const clone=(v)=>JSON.parse(JSON.stringify(v));
const currentMeta=()=>({appVersion:RELEASE.appVersion,schemaVersion:RELEASE.schemaVersion,dataVersion:RELEASE.dataVersion,cacheVersion:RELEASE.cacheVersion,normalizedAt:new Date().toISOString()});

function validDate(value){
  const s=text(value);const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return false;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);const dt=new Date(y,mo-1,d);
  return dt.getFullYear()===y&&dt.getMonth()===mo-1&&dt.getDate()===d;
}
function idFor(prefix,index){return `${prefix}-MIG-${Date.now()}-${index}`}
function normalizeTxn(x,index,type){
  const o={...obj(x)};o.id=text(o.id)||idFor(type==='expense'?'EXP':'INC',index);
  if(!validDate(o.date))return {invalid:o};
  if(type==='expense'){
    o.amount=num(o.amount,NaN);if(!Number.isFinite(o.amount)||o.amount<0)return {invalid:o};
    o.currency=text(o.currency||'SGD').toUpperCase();o.vendor=text(o.vendor);o.category=text(o.category||'Other');o.time=text(o.time);o.location=text(o.location);o.notes=text(o.notes);o.platform=text(o.platform);o.paymentMethod=text(o.paymentMethod);o.card=text(o.card);
  }else{
    ['baseSalary','netSalary','bonus','oneOff'].forEach(k=>o[k]=num(o[k],0));
  }
  return {value:o};
}
function uniqueById(list,prefix){
  const seen=new Set();return arr(list).map((x,i)=>({...obj(x),id:text(x?.id)||idFor(prefix,i)})).filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true});
}
function inferIssuer(name=''){
  const n=text(name).toLowerCase();if(n.includes('ocbc'))return 'OCBC';if(n.includes('citi'))return 'Citibank';if(n.includes('dbs')||n.includes('posb'))return 'DBS / POSB';if(n.includes('uob'))return 'UOB';if(n.includes('hsbc'))return 'HSBC';if(n.includes('standard chartered')||n.startsWith('sc '))return 'Standard Chartered';if(n.includes('maybank'))return 'Maybank';if(n.includes('cimb'))return 'CIMB';return 'Other / Custom Bank';
}
function normalizeCredit(a,index){
  const o={...obj(a)};const legacyName=text(o.nickname||o.name||o.cardProduct||`Card ${index+1}`);
  o.id=text(o.id)||idFor('CARD',index);o.accountType='credit';o.issuer=text(o.issuer)||inferIssuer(legacyName);
  if(!text(o.cardProduct)){
    if(/ocbc\s*365/i.test(legacyName))o.cardProduct='OCBC 365 Credit Card';
    else{o.cardProduct='Other / Custom Card';o.customProduct=text(o.customProduct)||legacyName}
  }
  o.nickname=text(o.nickname)||legacyName;o.name=text(o.name)||o.nickname||o.cardProduct;
  ['limit','outstanding','statementBalance','minimumPayment'].forEach(k=>o[k]=o[k]===''?'':num(o[k],0));
  ['plannedPayment','spendingBudget','startingBalance','statementDay','dueDay'].forEach(k=>{if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')o[k]=num(o[k],0)});
  o.role=text(o.role||'spending');return o;
}
function walletFingerprint(a){return [text(a.accountType).toLowerCase(),text(a.issuer).toLowerCase(),text(a.cardProduct||a.customProduct).toLowerCase(),text(a.nickname||a.name).toLowerCase(),text(a.baseCurrency||'SGD').toUpperCase()].join('|')}
function normalizeWallet(a,index){
  const o={...obj(a)};o.id=text(o.id)||idFor('WALLET',index);o.accountType=text(o.accountType||'wallet');o.issuer=text(o.issuer||'Other / Custom Provider');o.cardProduct=text(o.cardProduct||'Other / Custom Card');o.customProduct=text(o.customProduct);o.nickname=text(o.nickname||o.name||o.cardProduct);o.name=text(o.name||o.nickname||o.cardProduct);o.baseCurrency=text(o.baseCurrency||'SGD').toUpperCase();if(o.balance!==''&&o.balance!=null)o.balance=num(o.balance,0);return o;
}
function dedupeWallets(list,report){
  const seen=new Map(),out=[];arr(list).forEach((x,i)=>{const o=normalizeWallet(x,i),key=walletFingerprint(o);if(seen.has(key)){report.walletDuplicatesRemoved++;return}seen.set(key,o.id);out.push(o)});return out;
}
function normalizePayLater(a,index){
  const o={...obj(a)};o.id=text(o.id)||idFor('LATER',index);o.name=text(o.name||`Pay-Later ${index+1}`);o.outstanding=num(o.outstanding,0);o.cycleDue=num(o.cycleDue,0);
  if(o.nextDueDate&&!validDate(o.nextDueDate)){o.rawNextDueDate=o.nextDueDate;o.nextDueDate=''}
  if(o.purchaseDate&&!validDate(o.purchaseDate)){o.rawPurchaseDate=o.purchaseDate;o.purchaseDate=''}
  if(o.firstDueDate&&!validDate(o.firstDueDate)){o.rawFirstDueDate=o.firstDueDate;o.firstDueDate=''}
  if(o.recurrenceEnabled===true){o.durationMonths=Math.max(1,num(o.durationMonths,1));['productCost','downpayment','fees','interestAmount','customMonthlyPayment','totalRepayable'].forEach(k=>o[k]=num(o[k],0));o.status=text(o.status||'active')}
  else{o.recurrenceEnabled=false;o.status=text(o.status||(o.outstanding>0?'active':'completed'))}
  return o;
}
function normalizeHistory(list,report){
  const good=[],bad=[];arr(list).forEach((x,i)=>{const o={...obj(x),id:text(x?.id)||idFor('IMP',i)};if(o.date&&!validDate(o.date)){bad.push({...o,quarantineReason:'invalid-date'});return}good.push(o)});report.historyQuarantined=bad.length;return {good,bad};
}
function normalizeBackup(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.expenses)||!Array.isArray(input.income))throw new Error('Missing expenses/income arrays');
  const source=clone(input),report={expenseQuarantined:0,incomeQuarantined:0,historyQuarantined:0,walletDuplicatesRemoved:0};
  const base=typeof emptyDB==='function'?emptyDB():{version:1,expenses:[],income:[],budgets:{monthly:0,categories:{}},settings:{currency:'SGD'}};
  const out={...base,...source};
  const badExpenses=[],badIncome=[];
  out.expenses=arr(source.expenses).map((x,i)=>normalizeTxn(x,i,'expense')).flatMap(r=>{if(r.invalid){badExpenses.push({...r.invalid,quarantineReason:'invalid-expense'});return[]}return[r.value]});
  out.income=arr(source.income).map((x,i)=>normalizeTxn(x,i,'income')).flatMap(r=>{if(r.invalid){badIncome.push({...r.invalid,quarantineReason:'invalid-income'});return[]}return[r.value]});
  report.expenseQuarantined=badExpenses.length;report.incomeQuarantined=badIncome.length;
  out.budgets={monthly:num(source.budgets?.monthly,0),categories:{...obj(source.budgets?.categories)}};
  out.settings={...obj(base.settings),...obj(source.settings),currency:text(source.settings?.currency||base.settings?.currency||'SGD').toUpperCase()};
  out.creditAccounts=uniqueById(source.creditAccounts,'CARD').map(normalizeCredit);
  out.creditPayments=uniqueById(source.creditPayments,'CARDPAY');
  out.walletAccounts=dedupeWallets(source.walletAccounts,report);
  out.payLaterAccounts=uniqueById(source.payLaterAccounts,'LATER').map(normalizePayLater);
  out.payLaterPayments=uniqueById(source.payLaterPayments,'LATERPAY');
  ['monthlyCommitments','recurringIncome','recurringCommitments','recurringBills','importQueue'].forEach(k=>out[k]=uniqueById(source[k],k.toUpperCase()));
  const hist=normalizeHistory(source.importHistory,report);out.importHistory=hist.good;
  out.importQuarantine={...obj(source.importQuarantine),expenses:[...arr(source.importQuarantine?.expenses),...badExpenses],income:[...arr(source.importQuarantine?.income),...badIncome],history:[...arr(source.importQuarantine?.history),...hist.bad]};
  out.importMeta={...obj(source.importMeta),sourceBackupMeta:source.backupMeta||null,sourceVersion:source.version??null,lastNormalization:{...currentMeta(),report}};
  out.backupMeta={...currentMeta(),exportedAt:source.backupMeta?.exportedAt||new Date().toISOString()};
  out.version=typeof MGW!=='undefined'?MGW.version:(source.version||1);
  return {db:out,report};
}
function reportText(r){const fixes=[];if(r.walletDuplicatesRemoved)fixes.push(`${r.walletDuplicatesRemoved} duplicate wallet`);const q=r.expenseQuarantined+r.incomeQuarantined+r.historyQuarantined;if(q)fixes.push(`${q} invalid record${q===1?'':'s'} quarantined`);return fixes.length?`Backup restored · ${fixes.join(' · ')}`:'Backup restored and normalized'}
function normalizedImport(file){
  const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);const result=normalizeBackup(parsed);db=result.db;window.db=db;localStorage.setItem(MGW.key,JSON.stringify(db));if(typeof renderAll==='function')renderAll();if(typeof toast==='function')toast(reportText(result.report));document.dispatchEvent(new CustomEvent('mgw:db-imported',{detail:result.report}))}catch(err){console.error('MoneyGoWhere backup import failed',err);if(typeof toast==='function')toast('Invalid or incompatible MoneyGoWhere backup')}};reader.readAsText(file);
}
function normalizeCurrent(){
  try{
    if(typeof db==='undefined'||!db||!Array.isArray(db.expenses)||!Array.isArray(db.income))return;
    const marker=db.importMeta?.lastNormalization;
    if(marker?.appVersion===RELEASE.appVersion&&Number(marker?.dataVersion)===Number(RELEASE.dataVersion)&&Number(marker?.schemaVersion)===Number(RELEASE.schemaVersion))return;
    const result=normalizeBackup(db);db=result.db;window.db=db;localStorage.setItem(MGW.key,JSON.stringify(db));if(typeof renderAll==='function')renderAll();console.info('MoneyGoWhere existing DB normalized',result.report);
  }catch(err){console.warn('MoneyGoWhere existing DB normalization skipped',err)}
}
window.MGWImportNormalizer={normalizeBackup,importFile:normalizedImport,normalizeCurrent};
window.importData=normalizedImport;
const input=document.querySelector('#importInput');if(input)input.onchange=e=>e.target.files?.[0]&&normalizedImport(e.target.files[0]);
normalizeCurrent();
})();
