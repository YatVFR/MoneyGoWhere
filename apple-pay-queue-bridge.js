// MoneyGoWhere DEV — Apple Pay pending-import visibility bridge.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
let watching=false;
function pending(){return Array.isArray(window.db?.importQueue)?window.db.importQueue.filter(x=>x?.status==='pending'):[]}
function showQueue(message){
  try{if(typeof renderAll==='function')renderAll()}catch(e){console.warn('MoneyGoWhere queue refresh render failed',e)}
  try{if(typeof nav==='function')nav('add')}catch{}
  setTimeout(()=>{
    const card=document.querySelector('#mgwWalletImportQueue');
    if(card){card.scrollIntoView({behavior:'smooth',block:'start'});card.classList.add('mgw-import-highlight');setTimeout(()=>card.classList.remove('mgw-import-highlight'),1200)}
    if(message&&typeof toast==='function')toast(message);
  },120);
}
function monitor(before){
  if(watching)return;watching=true;let tries=0;
  const timer=setInterval(()=>{
    tries++;const now=pending();
    if(now.length>before){clearInterval(timer);watching=false;showQueue(`${now.length-before} Apple Pay transaction${now.length-before===1?'':'s'} ready for review`);return}
    if(tries>=40){clearInterval(timer);watching=false;if(now.length)showQueue('Apple Pay transaction already waiting for review')}
  },100);
}
document.addEventListener('change',e=>{
  const input=e.target;
  if(!(input instanceof HTMLInputElement)||input.id!=='mgwApplePayInboxInput'||!input.files?.length)return;
  monitor(pending().length);
},true);
const style=document.createElement('style');style.textContent='.mgw-import-highlight{outline:2px solid var(--brand,#0f766e);outline-offset:3px;transition:outline-color .4s ease}.mgw-import-highlight .card-head{background:var(--brand-soft,#e8f5f2);border-radius:12px;padding:8px}';document.head.appendChild(style);
window.MGWApplePayQueueBridge={version:RELEASE,show:showQueue};
})();