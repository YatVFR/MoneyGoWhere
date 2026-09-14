// MoneyGoWhere DEV — show likely receipt matches for pending Apple Pay imports
(()=>{'use strict';
const RELEASE='1.5.5-dev.31';
const num=v=>Number(v)||0;
function match(x){return (db?.expenses||[]).find(e=>String(e.source||'').includes('receipt')&&Math.abs(num(e.amount)-num(x.amount))<0.005&&String(e.date||'').slice(0,10)===String(x.date||'').slice(0,10))}
function apply(){document.querySelectorAll('#mgwWalletImportQueue [data-id]').forEach(row=>{const x=(db?.importQueue||[]).find(q=>q.id===row.dataset.id);if(!x||!match(x)||row.querySelector('.mgw-receipt-match'))return;const pill=document.createElement('span');pill.className='mgw-import-pill mgw-receipt-match';pill.textContent='Receipt match';const wallet=row.querySelector('.mgw-import-pill');wallet?.insertAdjacentElement('afterend',pill)})}
function boot(){apply();new MutationObserver(()=>queueMicrotask(apply)).observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.MGWReceiptMatchHint={version:RELEASE};})();