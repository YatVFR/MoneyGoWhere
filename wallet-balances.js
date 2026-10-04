// Derive wallet balances from immutable opening amounts and saved payment links.
// Rendering never writes balances back into transaction or account records.
(()=>{'use strict';
const rows=d=>[...(d.creditAccounts||[]).map(a=>({...a,type:'credit'})),...(d.bankAccounts||[]).map(a=>({...a,type:'bank'})),...(d.walletAccounts||[]).map(a=>({...a,type:a.accountType||'wallet'}))];
const sourceId=x=>x.paymentSourceId||x.paymentAccountId||x.paymentBankAccountId||'';
const finite=x=>x!==''&&x!=null&&Number.isFinite(Number(x));
const currency=a=>String(a.baseCurrency||a.currency||'SGD').toUpperCase();
const day=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function validDate(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;const d=new Date(v+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v}
function ownBalance(a){return /YOU\s*TRIP/i.test([a.issuer,a.cardProduct,a.name].join(' '))}
function resolve(id,d=window.db){const all=rows(d),a=all.find(x=>x.id===id);if(!a)return null;if((a.type==='debit'||a.type==='method')&&!ownBalance(a)){return a.linkedBankAccountId?all.find(x=>x.type==='bank'&&x.id===a.linkedBankAccountId)||null:null}return a}
function validate(entry,d=window.db){
 if(entry.availableToSpend!==undefined&&entry.availableToSpend!==''&&entry.availableToSpend!==null){
  if(!finite(entry.availableToSpend)||Number(entry.availableToSpend)<0)throw Error('Enter a valid non-negative available spending amount');
  if(!validDate(entry.availableAsOf))throw Error('Choose a valid amount-as-of date');
  if(entry.linkedBankAccountId)throw Error('Set the available spending amount on the linked bank account');
 }
 if(entry.baseCurrency&&!/^[A-Z]{3}$/.test(entry.baseCurrency))throw Error('Enter a three-letter currency code');
 if(entry.accountLast4&&!/^\d{4}$/.test(String(entry.accountLast4)))throw Error('Bank account identifier must contain exactly four digits');
 if(entry.linkedBankAccountId&&!(d.bankAccounts||[]).some(a=>a.id===entry.linkedBankAccountId))throw Error('Choose an existing bank account');
 if(entry.linkedBankAccountId&&!['debit','method'].includes(entry.accountType))throw Error('Only debit cards and payment methods can share a bank balance');
 if(entry.linkedBankAccountId&&ownBalance(entry))throw Error('YouTrip uses its own wallet balance');
 if(entry.balanceTracking){if(!finite(entry.openingBalance)||Number(entry.openingBalance)<0)throw Error('Enter a valid opening balance');if(!validDate(entry.trackingStartDate))throw Error('Choose a valid tracking start date');if(entry.linkedBankAccountId)throw Error('Set the opening balance on the linked bank account');}
}
function amount(x,target,d){
 const raw=Number(x.amount);if(!finite(x.amount))return null;
 const from=String(x.currency||'SGD').toUpperCase();if(from===target)return Math.round(raw*100);
 if(target!=='SGD')return null;
 // Use the rate against the current amount so an edited amount cannot reuse a stale conversion.
 const rate=Number(x.fxRateToSGD||d.settings?.fxRatesToSGD?.[from+'|'+String(x.date||'').slice(0,10)]?.rate);
 if(Number.isFinite(rate)&&rate>0)return Math.round(raw*rate*100);
 return finite(x.sgdAmount)?Math.round(Number(x.sgdAmount)*100):null;
}
function summary(id,d=window.db,asOf=day()){
 const byId=new Map(rows(d).map(a=>[a.id,a])),owner=id=>{const row=byId.get(id);if(!row)return null;return (row.type==='debit'||row.type==='method')&&!ownBalance(row)?(byId.get(row.linkedBankAccountId)?.type==='bank'?byId.get(row.linkedBankAccountId):null):row};
 const a=owner(id);if(!a)return {tracked:false,status:'unlinked',balance:null,currency:'SGD',pending:0};
 const base=currency(a),credit=a.type==='credit';
 if(!a.balanceTracking||!validDate(a.trackingStartDate)||!finite(a.openingBalance))return {tracked:false,status:'untracked',accountId:a.id,currency:base,balance:finite(credit?a.outstanding:a.balance)?Number(credit?a.outstanding:a.balance):null,pending:0,credit};
 let cents=Math.round(Number(a.openingBalance)*100),pending=0,count=0;
 const eligible=x=>validDate(String(x.date||'').slice(0,10))&&String(x.date).slice(0,10)>=a.trackingStartDate&&String(x.date).slice(0,10)<=asOf;
 const apply=(x,sign)=>{if(!eligible(x))return;const n=amount(x,base,d);if(n===null){pending++;return}cents+=sign*n;count++};
 for(const x of d.expenses||[]){if(owner(sourceId(x))?.id!==a.id||x.status==='pending'||x.status==='deleted'||x.voided)continue;const refund=x.transactionType==='refund'||x.kind==='refund';apply(x,(credit?1:-1)*(refund?-1:1));}
 if(credit){for(const p of d.creditPayments||[])if(p.accountId===a.id&&!p.voided)apply(p,-1)}
 else{
   for(const x of d.income||[]){if(owner(x.depositAccountId)?.id!==a.id)continue;const income={...x,amount:Number(x.netSalary||0)+Number(x.bonus||0)+Number(x.oneOff||0)};apply(income,1)}
   for(const p of [...(d.creditPayments||[]),...(d.payLaterPayments||[])])if(!p.voided&&owner(p.fundingAccountId)?.id===a.id)apply(p,-1);
 }
 const balance=cents/100;return {tracked:true,status:a.trackingStartDate>asOf?'scheduled':pending?'partial':'tracked',accountId:a.id,currency:base,balance,pending,count,credit,availableCredit:credit&&finite(a.limit)?Math.max(0,Number(a.limit)-balance):null};
}
function fields(a={},linked=false){const esc=window.MGWBalanceEsc||((v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));return `<div class="field full" id="mgwBalanceConfig" ${linked?'hidden':''}><label><input type="checkbox" name="balanceTracking" ${a.balanceTracking?'checked':''}> Track ${a.accountType==='credit'?'credit outstanding':'balance'}</label><div class="form-grid"><div class="field"><label>Opening ${a.accountType==='credit'?'outstanding':'balance'}</label><input name="openingBalance" type="number" min="0" step="0.01" value="${esc(a.openingBalance??'')}"></div><div class="field"><label>Tracking start date</label><input name="trackingStartDate" type="date" value="${esc(a.trackingStartDate||day())}"></div></div><small>Enter the balance at the beginning of this date. Saved transactions on or after this date are included once; earlier history is excluded. Linked methods share the bank's balance. Foreign spending waits for a recorded conversion.</small></div>`}
function config(fd){return {balanceTracking:fd.has('balanceTracking'),openingBalance:fd.get('openingBalance')===''?'':Number(fd.get('openingBalance')),trackingStartDate:String(fd.get('trackingStartDate')||'')}}
// A snapshot is the amount available at END of its date. Only later dated,
// saved transactions adjust it; rendering never changes the stored snapshot.
function available(id,d=window.db,asOf=day()){
 const all=rows(d),byId=new Map(all.map(a=>[a.id,a]));
 const owner=id=>{const a=byId.get(id);return a?.linkedBankAccountId&&['debit','method'].includes(a.type)&&!ownBalance(a)?(byId.get(a.linkedBankAccountId)?.type==='bank'?byId.get(a.linkedBankAccountId):null):a};
 const a=owner(id);if(!a)return {amount:null,currency:'SGD',status:'unlinked',pending:0};
 const base=currency(a),credit=a.type==='credit';
 if(!finite(a.availableToSpend)||!validDate(a.availableAsOf)){
  const s=summary(id,d,asOf),n=credit?(s.availableCredit??(finite(a.limit)&&finite(s.balance)?Math.max(0,Number(a.limit)-s.balance):null)):s.balance;
  return {amount:n,currency:base,status:n===null?'unset':s.status,pending:s.pending||0,accountId:a.id,source:'balance'};
 }
 if(a.availableAsOf>asOf)return {amount:null,currency:base,status:'scheduled',pending:0,accountId:a.id,asOf:a.availableAsOf,source:'snapshot'};
 let cents=Math.round(Number(a.availableToSpend)*100),pending=0,count=0;
 const apply=(x,sign)=>{const date=String(x.date||'').slice(0,10);if(x.voided||x.status==='pending'||x.status==='deleted'||!validDate(date)||date<=a.availableAsOf||date>asOf)return;const n=amount(x,base,d);if(n===null){pending++;return}cents+=sign*n;count++};
 for(const x of d.expenses||[])if(owner(sourceId(x))?.id===a.id)apply(x,x.transactionType==='refund'||x.kind==='refund'?1:-1);
 if(credit){for(const p of d.creditPayments||[])if(p.accountId===a.id)apply(p,1)}
 else{
  for(const x of d.income||[])if(owner(x.depositAccountId)?.id===a.id)apply({...x,amount:Number(x.netSalary||0)+Number(x.bonus||0)+Number(x.oneOff||0)},1);
  for(const p of [...(d.creditPayments||[]),...(d.payLaterPayments||[])])if(owner(p.fundingAccountId)?.id===a.id)apply(p,-1);
 }
 return {amount:cents/100,currency:base,status:pending?'partial':'tracked',pending,count,accountId:a.id,asOf:a.availableAsOf,source:'snapshot'};
}
function availableFields(a={}){const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return `<div class="field full" id="mgwAvailableConfig"><div class="form-grid"><div class="field"><label>Available to spend (optional)</label><input name="availableToSpend" type="number" min="0" step="0.01" value="${esc(a.availableToSpend??'')}"></div><div class="field"><label>Amount as of (end of day)</label><input name="availableAsOf" type="date" value="${esc(a.availableAsOf||day())}"></div></div><small>Enter funds available at the END of this date. Only saved transactions dated later adjust this estimate. Leave blank to use the tracked balance or available credit. Linked cards and methods share the bank's amount; it is not a separate pool of money.</small></div>`}
function availableConfig(fd){const raw=fd.get('availableToSpend');return {availableToSpend:raw==null||raw===''?'':Number(raw),availableAsOf:String(fd.get('availableAsOf')||'')}}
function availableLabel(id,d=window.db){const s=available(id,d);return s.amount===null?'Available: not set':`Available: ${s.currency} ${s.amount.toFixed(2)}${s.pending?' (conversion pending)':''}`}
function bankOptions(selected='',d=window.db){const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return '<option value="">Select bank account</option>'+(d.bankAccounts||[]).filter(a=>a.active!==false||a.id===selected).map(a=>`<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.nickname||a.name)}${a.accountLast4?' · •••• '+esc(a.accountLast4):''}</option>`).join('')}
window.MGWWalletBalances=Object.freeze({rows,sourceId,resolve,validate,amount,summary,fields,config,bankOptions,day,validDate,ownBalance,available,availableFields,availableConfig,availableLabel});
})();
