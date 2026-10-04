// Shared receipt currency, review and atomic persistence. No media is stored.
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function currency(text=''){
 const t=String(text).toUpperCase(),found=[];
 for(const [code,re] of [['MYR',/\bMYR\b|(?:^|[^A-Z])RM(?=\s*\d|\s*[:$])/],['SGD',/\bSGD\b|S\$/],['USD',/\bUSD\b|US\$/],['EUR',/\bEUR\b|€/],['GBP',/\bGBP\b|£/]])if(re.test(t))found.push(code);
 return{value:found.length===1?found[0]:'SGD',confidence:found.length===1?98:found.length?0:60,explicit:found.length===1,ambiguous:found.length>1,evidence:found.length?found.join(' / '):'SGD default — no printed currency'};
}
function validDate(value){const m=String(value||'').match(/^(20\d{2})-(\d{2})-(\d{2})$/);if(!m)return false;const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]}
function issues(result){const v=result?.values||{},c=result?.confidence||{},out=[];
 for(const [key,label] of [['vendor','Merchant'],['date','Date'],['amount','Amount']])if(String(v[key]??'').trim()==='')out.push(label+' missing');else if(Number(c[key]||0)<80)out.push(label+' uncertain');
 if(!v.category)out.push('Choose a category');if(Number(c.currency||0)<90)out.push('Review currency');if(Number(c.payment||0)<80)out.push('Review payment source');return out;
}
function fields(){return '<div class="field full mgw-receipt-confirm"><label><input type="checkbox" name="receiptReviewed" required> I have reviewed the merchant, date, amount, currency, category and payment source.</label></div>'}
function validate(input,reviewed){
 if(!reviewed)throw Error('Review the receipt and confirm the details before saving.');
 if(!String(input.vendor||input.merchant||'').trim())throw Error('Enter the merchant.');
 if(!validDate(input.date))throw Error('Enter a valid receipt date.');
 if(String(input.amount??'').trim()===''||!Number.isFinite(Number(input.amount))||Number(input.amount)<=0)throw Error('Enter a positive receipt amount.');
 if(!String(input.category||'').trim())throw Error('Choose a spending category.');
 if(!/^[A-Z]{3}$/.test(String(input.currency||'')))throw Error('Choose a currency.');return true;
}
function adopt(next){if(window.MGWDatabaseSchema?.touch)next=window.MGWDatabaseSchema.touch(next);localStorage.setItem(window.MGW?.key||'moneygowhere-db-v1',JSON.stringify(next));if(window.MGWAdoptDatabase)window.MGWAdoptDatabase(next);else window.db=next;return next}
function save(input,{reviewed=false,queueId=''}={}){
 validate(input,reviewed);const next=JSON.parse(JSON.stringify(window.db));
 const tx={...input,id:'EXP-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),vendor:String(input.vendor||input.merchant).trim(),amount:Number(input.amount),source:queueId?'receipt_batch':'receipt_scan',receiptReviewedAt:new Date().toISOString(),rawText:String(input.rawText||'')};
 delete tx.receiptReviewed;delete tx.status;delete tx.merchant;
 Object.assign(tx,window.MGWUnifiedWallet?.paymentDetails(tx)||{});
 const prepared=window.MGWTransactionEngine?.prepareExpense?window.MGWTransactionEngine.prepareExpense(tx,next.expenses.length):tx;
 next.expenses.push(prepared);
 if(queueId){const item=(next.receiptImportQueue||[]).find(x=>x.id===queueId);if(!item)throw Error('This receipt is no longer pending.');next.receiptImportHistory=next.receiptImportHistory||[];next.receiptImportHistory.push({...item,...input,status:'accepted',acceptedExpenseId:prepared.id});next.receiptImportQueue=next.receiptImportQueue.filter(x=>x.id!==queueId)}
 adopt(next);return prepared;
}
function enqueue(items){const next=JSON.parse(JSON.stringify(window.db));next.receiptImportQueue=next.receiptImportQueue||[];next.receiptImportQueue.push(...items);adopt(next)}
async function copy(text,textarea){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(String(text||''));return true}}catch{}if(textarea){textarea.focus();textarea.select();try{return document.execCommand('copy')}catch{}}return false}
window.MGWReceiptReview={currency,issues,fields,validate,validDate,save,enqueue,adopt,copy,esc};
})();
