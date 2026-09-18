// MoneyGoWhere feature — local Wallet import review queue
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev',num=v=>Number(v)||0,norm=v=>String(v||'').trim().replace(/\s+/g,' ').toUpperCase(),uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const persist=()=>localStorage.setItem(MGW.key,JSON.stringify(db));
function ensure(){db.importQueue=Array.isArray(db.importQueue)?db.importQueue:[];db.importHistory=Array.isArray(db.importHistory)?db.importHistory:[];db.merchantRules=db.merchantRules&&typeof db.merchantRules==='object'?db.merchantRules:{};db.importQueue.forEach(x=>{if(x&&(!x.status||x.status==='queued'))x.status='pending'})}
function pendingRows(){ensure();return db.importQueue.filter(x=>x&&x.status==='pending')}
function css(){if(document.querySelector('#mgwWalletQueueCss'))return;const s=document.createElement('style');s.id='mgwWalletQueueCss';s.textContent='.mgw-import-row{border:1px solid var(--line,#e4e9e7);border-radius:14px;padding:12px;margin-top:8px;display:grid;grid-template-columns:1fr auto;gap:10px}.mgw-import-row small{display:block;color:var(--muted,#6b7774)}.mgw-import-actions{display:flex;gap:6px;margin-top:8px}.mgw-import-actions button{border:0;border-radius:9px;padding:7px 9px}.mgw-import-pill{display:inline-block;margin-top:5px;padding:3px 7px;border-radius:999px;background:#e8f5f2;color:#0f766e;font-size:.72rem;font-weight:800}.mgw-import-warn{background:#fff7ed;color:#c2410c}@media(max-width:520px){.mgw-import-row{grid-template-columns:1fr}}';document.head.appendChild(s)}
function suggest(merchant,hint=''){const learned=db.merchantRules[norm(merchant)];if(learned)return learned;if(typeof mgwSuggestCategory==='function'){const x=mgwSuggestCategory(merchant,hint);return {category:x.category||'',confidence:x.confidence||0}}return {category:'',confidence:0}}
function duplicate(x){return db.expenses.some(e=>Math.abs(num(e.amount)-num(x.amount))<.005&&String(e.date||'').slice(0,10)===String(x.date||'').slice(0,10)&&norm(e.vendor||e.merchant)===norm(x.merchant))}
function launchParams(){
  try{
    const captured=window.MGWLaunchCapture?.params?.();
    if(captured&&[...captured.keys()].length)return captured;
  }catch{}
  try{
    const n=performance.getEntriesByType('navigation')[0]?.name;
    if(n)return new URL(n).searchParams;
  }catch{}
  return new URLSearchParams(location.search);
}
function firstParam(p,names){for(const name of names){const v=p.get(name);if(v!=null&&String(v).trim()!=='')return String(v).trim()}return''}
function ingest(){
  const p=launchParams(),mode=firstParam(p,['mgw','mode']).toLowerCase();
  if(!['applepay','applewallet','walletqueue'].includes(mode))return false;
  const merchant=firstParam(p,['merchant','vendor','name','Merchant','Vendor']);
  const amount=Number(firstParam(p,['amount','total','Amount','Total']).replace(/[^0-9.-]/g,''));
  if(!merchant||!Number.isFinite(amount)||amount<=0){toast?.('Apple Pay transaction could not be read');return false}
  const d=new Date(),date=firstParam(p,['date','Date'])||d.toISOString().slice(0,10),time=firstParam(p,['time','Time'])||`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const card=firstParam(p,['card','paymentSource','pass','Card']);
  const sourceId=firstParam(p,['sourceId','transactionId','id'])||`${date.slice(0,10)}-${time.slice(0,5)}-${amount}-${norm(merchant)}-${norm(card)}`;
  const queued=pendingRows().find(x=>x.sourceId===sourceId);
  if(queued){window.MGWLaunchCapture?.clear?.();showPending();toast?.('Apple Pay transaction is already pending review');return true}
  if(db.importHistory.some(x=>x.sourceId===sourceId)){window.MGWLaunchCapture?.clear?.();toast?.('Apple Pay transaction was already reviewed');return true}
  db.importQueue=db.importQueue.filter(x=>x.sourceId!==sourceId||x.status==='pending');
  const s=suggest(merchant,firstParam(p,['hint','Hint']));
  const item={id:uid('IMP'),source:'apple_wallet',sourceId,merchant,amount,date:date.slice(0,10),time:time.slice(0,5),currency:firstParam(p,['currency','Currency'])||'SGD',card,paymentMethod:'Apple Pay',category:s.category||'',confidence:s.confidence||0,status:'pending'};
  item.possibleDuplicate=duplicate(item);db.importQueue.push(item);persist();window.MGWLaunchCapture?.clear?.();
  document.dispatchEvent(new CustomEvent('mgw:import-queue-changed',{detail:{added:1,source:'apple_wallet'}}));
  try{const m=document.querySelector('#modal');if(mode==='applepay'&&m?.open)m.close()}catch{}
  showPending();toast?.('Apple Pay transaction queued for review');return true
}
function options(selected=''){return '<option value="">Choose category</option>'+Object.keys(MGW.cats).map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('')}
function rowSignature(rows){return JSON.stringify(rows.map(x=>[x.id,x.merchant,num(x.amount),x.date,x.time,x.category,Boolean(x.possibleDuplicate)]))}
function render(){
  ensure();const view=document.querySelector('#view-add');if(!view)return;
  let card=document.querySelector('#mgwWalletImportQueue');if(!card){card=document.createElement('article');card.className='card';card.id='mgwWalletImportQueue';view.prepend(card)}
  const rows=pendingRows(),signature=rowSignature(rows);
  if(card.dataset.mgwSignature===signature)return;
  card.dataset.mgwSignature=signature;
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">⚡</span><b>Pending Imports</b></div><strong>${rows.length}</strong></div><p class="mgw-muted">Review Wallet transactions before saving them.</p>${rows.map(x=>`<div class="mgw-import-row" data-id="${esc(x.id)}"><div><b>${esc(x.merchant)}</b><small>${esc([x.date,x.time].filter(Boolean).join(' · '))}</small><span class="mgw-import-pill">Wallet</span>${x.possibleDuplicate?'<span class="mgw-import-pill mgw-import-warn">Possible duplicate</span>':''}<div class="field" style="margin-top:8px"><select>${options(x.category)}</select></div></div><div><strong>${money(x.amount)}</strong><div class="mgw-import-actions"><button data-accept>Accept</button><button data-dismiss>Dismiss</button></div></div></div>`).join('')||'<p class="empty-state">No pending imports.</p>'}`;
  card.querySelectorAll('[data-id]').forEach(r=>{const x=db.importQueue.find(q=>q.id===r.dataset.id),sel=r.querySelector('select');if(!x)return;r.querySelector('[data-accept]')?.addEventListener('click',()=>{const category=sel.value;if(!category)return toast?.('Choose a category first');if(duplicate(x)&&!confirm('Matching transaction exists. Add anyway?'))return;const tx={id:uid('EXP'),date:x.date,time:x.time,vendor:x.merchant,amount:num(x.amount),currency:x.currency,category,source:x.source,sourceId:x.sourceId};db.expenses.push(tx);db.merchantRules[norm(x.merchant)]={category,confidence:100,updatedAt:new Date().toISOString()};db.importHistory.push({...x,status:'accepted',category,acceptedExpenseId:tx.id});db.importQueue=db.importQueue.filter(q=>q.id!==x.id);persist();document.dispatchEvent(new CustomEvent('mgw:import-queue-changed',{detail:{accepted:1,source:x.source}}));window.MGWStability?.requestRender?.()||renderAll?.();render();toast?.('Import saved')});r.querySelector('[data-dismiss]')?.addEventListener('click',()=>{db.importHistory.push({...x,status:'dismissed'});db.importQueue=db.importQueue.filter(q=>q.id!==x.id);persist();document.dispatchEvent(new CustomEvent('mgw:import-queue-changed',{detail:{dismissed:1,source:x.source}}));render()})});
}
function settings(){const view=document.querySelector('#view-settings');if(!view||document.querySelector('#mgwWalletSettings'))return;const card=document.createElement('article');card.className='card';card.id='mgwWalletSettings';card.innerHTML='<div class="card-head"><div><span class="section-icon">⚡</span><b>Wallet Imports</b></div></div><p class="mgw-muted">Your existing Wallet automation can continue opening MoneyGoWhere. Transactions are reviewed locally before they become expenses.</p><button class="secondary-btn" id="mgwReviewWallet">Review pending imports</button>';view.insertBefore(card,view.querySelector('.privacy-note')||null);card.querySelector('#mgwReviewWallet').addEventListener('click',()=>{if(typeof nav==='function')nav('add');setTimeout(()=>document.querySelector('#mgwWalletImportQueue')?.scrollIntoView({behavior:'smooth'}),80)})}
function refresh(){ensure();render();settings()}
function showPending(){refresh();if(typeof nav==='function')nav('add');requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector('#mgwWalletImportQueue')?.scrollIntoView({behavior:'smooth',block:'start'})))}
function boot(){ensure();css();refresh();document.addEventListener('mgw:import-queue-changed',refresh);const afterData=()=>{ingest();refresh()};if(window.MGWBootState?.dataReady)afterData();else document.addEventListener('mgw:data-ready',afterData,{once:true});if(typeof renderAll==='function'&&!renderAll.__mgwWalletQueue){const base=renderAll;renderAll=function(){base();queueMicrotask(refresh)};renderAll.__mgwWalletQueue=true}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.MGWWalletQueue={version:RELEASE,items:()=>pendingRows(),refresh,render,showPending};})();