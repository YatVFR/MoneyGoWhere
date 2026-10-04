// MoneyGoWhere DEV — optional startup import assistant + calibrated local batch receipt OCR.
// Receipt images are processed locally and are never persisted or uploaded by this module.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toUpperCase();
const persist=()=>localStorage.setItem(MGW.key,JSON.stringify(db));
let shownThisLoad=false,processing=false;
if(typeof window.MGWStartupImportDone!=='boolean')window.MGWStartupImportDone=false;
function markStartupImportDone(){if(window.MGWStartupImportDone)return;window.MGWStartupImportDone=true;document.dispatchEvent(new CustomEvent('mgw:startup-import:done'))}
function ensure(){
  db.settings=db.settings||{};
  db.settings.startupImport=db.settings.startupImport&&typeof db.settings.startupImport==='object'?db.settings.startupImport:{};
  if(db.settings.startupImport.preferenceVersion!==1){db.settings.startupImport.enabled=false;db.settings.startupImport.preferenceVersion=1}
  db.receiptImportQueue=Array.isArray(db.receiptImportQueue)?db.receiptImportQueue:[];
  db.receiptImportHistory=Array.isArray(db.receiptImportHistory)?db.receiptImportHistory:[];
}
function currencyFromText(text=''){return window.MGWReceiptReview.currency(text).value}
function duplicate(x){
  const rows=[...(db.expenses||[]),...db.receiptImportQueue,...db.receiptImportHistory];
  return rows.some(y=>y.sourceId===x.sourceId||(x.amount>0&&String(y.date||'').slice(0,10)===String(x.date||'').slice(0,10)&&Math.abs(num(y.amount)-num(x.amount))<.005&&String(y.currency||'SGD')===String(x.currency||'SGD')&&norm(y.vendor||y.merchant)===norm(x.merchant)));
}
function closePrompt(){
  const d=document.querySelector('#mgwStartupImportDialog');
  if(d?.open)try{d.close()}catch{}
}
function closeOnCommittedSelection(input){
  if(!input)return;
  input.addEventListener('change',()=>{if(input.files?.length)closePrompt()},{once:true});
}
function makeReceiptInput(){
  let input=document.querySelector('#mgwBatchReceiptInput');
  if(input)return input;
  input=document.createElement('input');input.id='mgwBatchReceiptInput';input.type='file';input.accept='image/*,application/pdf,.pdf';input.multiple=true;input.hidden=true;
  input.addEventListener('change',async()=>{if(input.files?.length){closePrompt();await processReceipts(input.files)}input.value=''});
  document.body.appendChild(input);return input;
}
function style(){
  if(document.querySelector('#mgwStartupImportCss'))return;
  const s=document.createElement('style');s.id='mgwStartupImportCss';s.textContent=`
.mgw-startup-import{border:0;border-radius:24px;padding:0;width:min(560px,calc(100% - 28px));box-shadow:0 24px 70px rgba(0,0,0,.24)}
.mgw-startup-import::backdrop{background:rgba(8,25,23,.44);backdrop-filter:blur(3px)}
.mgw-startup-import-shell{padding:22px}.mgw-startup-import h2{margin:5px 0 8px}.mgw-startup-import p{color:var(--muted,#6b7774)}
.mgw-startup-import-actions{display:grid;gap:10px;margin-top:18px}.mgw-startup-import-actions button{width:100%;text-align:left;padding:14px 16px}
.mgw-startup-import-actions button b,.mgw-startup-import-actions button small{display:block}.mgw-startup-import-actions button small{margin-top:3px;font-weight:400;opacity:.72}
.mgw-startup-import-status{min-height:20px;margin-top:12px;font-size:.84rem;color:var(--muted,#6b7774)}
.mgw-receipt-batch-row{position:relative;overflow:hidden;border:1px solid var(--line,#e4e9e7);border-radius:14px;margin-top:9px;touch-action:pan-y}.mgw-receipt-swipe-actions{position:absolute;inset:0 0 0 auto;width:216px;display:grid;grid-template-columns:repeat(3,1fr)}.mgw-receipt-swipe-actions button{border:0;border-radius:0;color:#fff;font-size:.72rem;font-weight:900}.mgw-receipt-accept{background:var(--brand,#0f766e)}.mgw-receipt-edit{background:#64748b}.mgw-receipt-delete{background:#be123c}.mgw-receipt-content{position:relative;z-index:1;background:#fff;padding:12px;transition:transform .18s ease;will-change:transform}.mgw-receipt-batch-row.is-open .mgw-receipt-content{transform:translate3d(-216px,0,0)}.mgw-receipt-batch-grid{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px 10px;width:100%}.mgw-receipt-batch-grid .field{min-width:0;margin:0}.mgw-receipt-batch-grid .field.full{grid-column:1/-1}.mgw-receipt-batch-grid label{display:block;margin:0 0 6px;font-size:.78rem;font-weight:700}.mgw-receipt-batch-grid input,.mgw-receipt-batch-grid select{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;margin:0}.mgw-receipt-modal-form{display:block!important;width:100%}.mgw-receipt-modal-form>.field.full{width:100%;margin-top:14px}.mgw-receipt-modal-form>.field.full .primary-btn{width:100%}.mgw-receipt-batch-actions{display:flex;gap:7px;margin-top:9px}.mgw-receipt-batch-actions button{border:0;border-radius:10px;padding:8px 10px}.mgw-receipt-pill{display:inline-block;padding:3px 7px;border-radius:999px;background:var(--brand-soft,#e8f5f2);color:var(--brand,#0f766e);font-size:.72rem;font-weight:800;margin:0 6px 8px 0}.mgw-receipt-pill.warn{background:#fff7ed;color:#b45309}.mgw-receipt-confidence{font-size:.76rem;opacity:.68;margin:0 0 8px}.mgw-startup-toggle{width:44px;height:26px;border-radius:999px;background:#cfd8d5;position:relative;transition:.18s}.mgw-startup-toggle:after{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:.18s}.mgw-startup-toggle.on{background:var(--brand,#0f766e)}.mgw-startup-toggle.on:after{transform:translateX(18px)}
@media(max-width:520px){.mgw-receipt-batch-grid{grid-template-columns:1fr}.mgw-receipt-batch-grid .field.full{grid-column:auto}}
`;document.head.appendChild(s);
}
function queueCard(){
  const view=document.querySelector('#view-add');if(!view)return null;
  let card=document.querySelector('#mgwReceiptBatchQueue');
  if(!card){card=document.createElement('article');card.className='card';card.id='mgwReceiptBatchQueue';const wallet=document.querySelector('#mgwWalletImportQueue');wallet?.insertAdjacentElement('afterend',card)||view.prepend(card)}
  return card;
}
function currencyOptions(selected='SGD'){
  if(window.MGWCurrency?.currencyOptions)return window.MGWCurrency.currencyOptions(selected);
  return [...new Set([selected,'SGD','MYR','USD','EUR','GBP'])].map(c=>`<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('');
}
function categoryOptions(selected=''){
  return '<option value="">Choose category</option>'+Object.keys(MGW.cats).map(c=>`<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('');
}
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function receiptFields(x){return `<div class="mgw-receipt-batch-grid full"><div class="field full"><label>Merchant</label><input data-k="merchant" value="${esc(x.merchant)}"></div><div class="field"><label>Date</label><input data-k="date" type="date" value="${esc(x.date)}"></div><div class="field"><label>Time</label><input data-k="time" type="time" value="${esc(x.time)}"></div><div class="field"><label>Amount</label><input data-k="amount" type="number" min="0" step="0.01" value="${x.amount!==''&&x.amount!=null&&Number.isFinite(Number(x.amount))?Number(x.amount):''}"></div><div class="field"><label>Currency</label><select data-k="currency">${currencyOptions(x.currency||'SGD')}</select></div><div class="field full"><label>Location</label><input data-k="location" value="${esc(x.location)}"></div><div class="field full"><label>Payment</label><input data-k="paymentMethod" value="${esc(x.paymentMethod||'')}" placeholder="Optional"></div><div class="field full"><label>Category</label><select data-k="category">${categoryOptions(x.category||'')}</select></div>${window.MGWUnifiedWallet?.choiceFields(x)||''}</div>`}
function acceptReceipt(item){return editReceipt(item,{accept:true})}
function deleteReceipt(item){if(!confirm(`Delete pending receipt from ${item.merchant||'this scan'}?`))return;db.receiptImportHistory.push({...item,status:'deleted'});db.receiptImportQueue=db.receiptImportQueue.filter(x=>x.id!==item.id);persist();renderQueue();toast?.('Pending receipt deleted')}
function editReceipt(item,{accept=false}={}){
 const m=document.querySelector('#modal'),body=document.querySelector('#modalBody'),title=document.querySelector('#modalTitle');if(!m||!body||!title)return;
 title.textContent=accept?'Review and Save Receipt':'Edit Receipt Scan';body.innerHTML=`<form id="mgwEditReceiptImport" class="mgw-receipt-modal-form">${receiptFields(item)}${window.MGWReceiptReview.fields()}<div class="field full"><button class="primary-btn">${accept?'Save Receipt':'Save Review Changes'}</button></div></form>`;
 window.MGWReceiptWorkbench.textPanel(body,{rawText:item.rawText||'',values:{vendor:item.merchant,date:item.date,amount:item.amount,category:item.category},confidence:item.fieldConfidence||{}});
 try{m.showModal()}catch{return}
 const form=body.querySelector('#mgwEditReceiptImport');
 form.addEventListener('input',e=>{if(e.target.name!=='receiptReviewed')form.elements.receiptReviewed.checked=false});
 form.onsubmit=e=>{e.preventDefault();const get=k=>body.querySelector(`[data-k="${k}"]`)?.value||'',copy={...item,merchant:get('merchant').trim(),date:get('date'),time:get('time'),amount:get('amount'),currency:get('currency')||'SGD',location:get('location').trim(),paymentMethod:get('paymentMethod').trim(),category:get('category'),zeroValue:Number(get('amount'))===0};
  try{window.MGWReceiptReview.validate(copy,Boolean(form.elements.receiptReviewed.checked));window.MGWUnifiedWallet?.choose(copy,get('paymentSourceId'));
   if(accept)window.MGWReceiptReview.save(copy,{queueId:item.id,reviewed:true});else{const next=JSON.parse(JSON.stringify(window.db)),index=next.receiptImportQueue.findIndex(x=>x.id===item.id);if(index<0)throw Error('This receipt is no longer pending.');next.receiptImportQueue[index]={...copy,amount:Number(copy.amount),reviewed:true};window.MGWReceiptReview.adopt(next)}
   m.close();try{renderQueue();renderAll?.()}catch(err){console.warn('Receipt saved; display refresh failed',err)}toast?.(accept?'Receipt saved':'Receipt review updated');
  }catch(err){toast?.(err.message||'Could not save the receipt.')}return false;
 };
}
function bindReceiptSwipe(row){let start=null;row.addEventListener('pointerdown',e=>{if(e.target.closest('button,input,select'))return;start={x:e.clientX,y:e.clientY}},{passive:true});row.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)<36||Math.abs(dx)<Math.abs(dy))return;if(dx<0){document.querySelectorAll('#mgwReceiptBatchQueue .mgw-receipt-batch-row.is-open').forEach(r=>{if(r!==row)r.classList.remove('is-open')});row.classList.add('is-open')}else row.classList.remove('is-open')},{passive:true})}
function renderQueue(){
 ensure();const card=queueCard();if(!card)return;const rows=db.receiptImportQueue.filter(x=>x.status==='pending');if(!rows.length){card.remove();return}
 card.innerHTML=`<div class="card-head"><div><span class="section-icon">🧾</span><b>Receipt Batch Review</b></div><strong>${rows.length}</strong></div><p class="mgw-muted">SGD is the default unless a currency is printed. Swipe left to review and save, edit or delete.</p>${rows.map(x=>`<div class="mgw-receipt-batch-row" data-receipt-id="${x.id}"><div class="mgw-receipt-swipe-actions"><button class="mgw-receipt-accept" data-accept>✓<br>Review / Save</button><button class="mgw-receipt-edit" data-edit>✏️<br>Edit</button><button class="mgw-receipt-delete" data-delete>🗑️<br>Delete</button></div><div class="mgw-receipt-content"><span class="mgw-receipt-pill">Receipt · ${Math.round(x.ocrConfidence||0)}% OCR</span>${x.zeroValue?'<span class="mgw-receipt-pill warn">Zero-value receipt</span>':''}<div class="mgw-ocr-warning">${esc(x.reviewWarnings||'Review all details before saving.')}</div><div><b>${esc(x.merchant||'Receipt scan')}</b></div><div class="mgw-receipt-confidence">${esc([x.date,x.time].filter(Boolean).join(' · '))} · ${esc(x.currency||'SGD')} · ${money(num(x.amount))}</div>${window.MGWUnifiedWallet?.choiceFields(x)||''}<div class="mgw-receipt-confidence">Swipe left for actions</div></div></div>`).join('')}`;
 card.querySelectorAll('[data-receipt-id]').forEach(row=>{const item=db.receiptImportQueue.find(x=>x.id===row.dataset.receiptId);if(!item)return;const walletSource=row.querySelector('[data-k="paymentSourceId"]');walletSource?.addEventListener('change',()=>{window.MGWUnifiedWallet.choose(item,walletSource.value);persist()});row.querySelector('[data-accept]')?.addEventListener('click',()=>acceptReceipt(item));row.querySelector('[data-edit]')?.addEventListener('click',()=>editReceipt(item));row.querySelector('[data-delete]')?.addEventListener('click',()=>deleteReceipt(item));bindReceiptSwipe(row)})
}
function confidenceSummary(result){
  const c=result?.confidence||{};return [`Merchant ${c.vendor||0}%`,`Date ${c.date||0}%`,`Amount ${c.amount||0}%`,`Location ${c.location||0}%`,`Currency ${c.currency||0}%`].join(' · ');
}
async function ocrOne(file,status){
  if(window.MGWReceiptOCR?.readFile){const result=await window.MGWReceiptOCR.readFile(file,{status});return{result,raw:result?.rawText||''}}
  throw new Error('Receipt tools unavailable. Reload the app and try again.');
}
async function processReceipts(files){
 ensure();if(processing)return;processing=true;
 const statusEl=document.querySelector('#mgwStartupImportStatus');const setStatus=t=>{if(statusEl)statusEl.textContent=t};
 let added=0,duplicates=0,failed=0,cancelled=0,index=0;
 try{for(const file of [...files]){index++;setStatus(`Receipt ${index}/${files.length}: prepare and scan…`);
  try{const {result,raw}=await ocrOne(file,setStatus);if(!result){cancelled++;continue}const v=result.values||{},amountRaw=String(v.amount??'').trim(),hasAmount=amountRaw!==''&&Number.isFinite(Number(amountRaw)),sourceId=`RCP-${file.lastModified||0}-${file.size||0}-${norm(file.name)}-P${result.pageNumber||0}`;
   const item={id:uid('RCP'),source:'receipt_batch',sourceId,merchant:String(v.vendor||'').trim(),amount:hasAmount?Number(amountRaw):'',date:String(v.date||'').slice(0,10),time:String(v.time||'').slice(0,5),location:String(v.location||''),currency:v.currency||currencyFromText(raw),category:v.category||'',paymentMethod:String(v.paymentMethod||''),cardLast4:String(v.cardLast4||''),ocrConfidence:Number(result.confidence?.ocr)||0,fieldConfidence:result.confidence||{},confidenceSummary:confidenceSummary(result),rawText:String(raw||'').slice(0,100000),reviewWarnings:window.MGWReceiptReview.issues(result).join(' · '),receiptPage:result.pageNumber||0,receiptInputMethod:result.inputMethod||'',notes:result.amountEvidence?`OCR amount source: ${result.amountEvidence}`:'',zeroValue:hasAmount&&Number(amountRaw)===0,status:'pending'};
   item.paymentEvidence=result.paymentEvidence||'';Object.assign(item,window.MGWUnifiedWallet?.prepare(item)||item);if(duplicate(item)){duplicates++;continue}window.MGWReceiptReview.enqueue([item]);added++;
  }catch(err){failed++;setStatus(err.message||'Receipt could not be read.')}
 }
 renderQueue();if(added){if(typeof nav==='function')nav('add');setTimeout(()=>document.querySelector('#mgwReceiptBatchQueue')?.scrollIntoView({behavior:'smooth',block:'start'}),100)}
 setStatus(`${added} receipt(s) queued · ${duplicates} duplicates skipped · ${cancelled} cancelled · ${failed} need retry`);toast?.(added?`${added} receipt(s) ready for review`:'No receipts were queued');
 }finally{processing=false}
}
function openApplePay(){
  const dir=document.querySelector('#mgwApplePayFolderInput');if(dir){closePrompt();dir.click();return}
  const files=document.querySelector('#mgwApplePayInboxInput');if(files){closePrompt();files.click();return}
  if(typeof toast==='function')toast('Apple Pay importer is still loading');
}
function showPrompt({manual=false}={}){
  ensure();style();makeReceiptInput();
  if(!manual&&(!db.settings.startupImport.enabled||shownThisLoad)){markStartupImportDone();return}
  let d=document.querySelector('#mgwStartupImportDialog');if(!d){d=document.createElement('dialog');d.id='mgwStartupImportDialog';d.className='mgw-startup-import';document.body.appendChild(d)}
  d.innerHTML=`<div class="mgw-startup-import-shell"><div class="eyebrow">Quick Import</div><h2>Anything to add?</h2><p>Add receipt images or PDFs for local scanning, scan your MGW Apple Pay folder, or continue without importing.</p><div class="mgw-startup-import-actions"><button class="secondary-btn" data-receipts><b>🧾 Add Images / PDFs</b><small>Select receipt images or PDFs. Choose a page, crop or rotate, then review extracted details.</small></button><button class="secondary-btn" data-apple><b>🍎 Scan Apple Pay Folder</b><small>Check MGW JSON/TXT transaction files and queue new transactions.</small></button><button class="primary-btn" data-done><b>Continue to MoneyGoWhere</b></button></div><div class="mgw-startup-import-status" id="mgwStartupImportStatus"></div></div>`;
  d.querySelector('[data-receipts]').addEventListener('click',()=>{closePrompt();makeReceiptInput().click()});d.querySelector('[data-apple]').addEventListener('click',openApplePay);d.querySelector('[data-done]').addEventListener('click',()=>d.close());
  if(!manual&&!d.dataset.mgwStartupSequenceBound){d.dataset.mgwStartupSequenceBound='1';d.addEventListener('close',markStartupImportDone,{once:true})}
  shownThisLoad=true;
  try{d.showModal()}catch{if(!manual)markStartupImportDone()}
}
function installSettings(){
  if(window.MGWSettingsLayout){window.MGWSettingsLayout.refresh();return}
  ensure();const list=document.querySelector('#view-settings .settings-list');if(!list||document.querySelector('#mgwStartupImportToggle'))return;
  const toggle=document.createElement('button');toggle.type='button';toggle.id='mgwStartupImportToggle';toggle.innerHTML=`<span>📥</span><span><b>Startup Import Check</b><small>Ask for batch receipts and Apple Pay when the app opens</small></span><span class="mgw-startup-toggle ${db.settings.startupImport.enabled?'on':''}" aria-hidden="true"></span>`;
  toggle.addEventListener('click',()=>{db.settings.startupImport.enabled=!db.settings.startupImport.enabled;persist();toggle.querySelector('.mgw-startup-toggle')?.classList.toggle('on',db.settings.startupImport.enabled);if(typeof toast==='function')toast(db.settings.startupImport.enabled?'Startup import check enabled':'Startup import check disabled')});
  const run=document.createElement('button');run.type='button';run.id='mgwRunStartupImport';run.innerHTML='<span>🧾</span><span><b>Run Import Check</b><small>Batch-process receipts or scan Apple Pay now</small></span><span>›</span>';run.addEventListener('click',()=>showPrompt({manual:true}));
  const integrity=[...list.querySelectorAll('button')].find(b=>/Data Integrity Check/i.test(b.textContent||''));list.insertBefore(toggle,integrity||null);list.insertBefore(run,integrity||null);
}
function startup(){
  ensure();if(!db.settings.startupImport.enabled||document.querySelector('#view-settings.active')){markStartupImportDone();return}
  const wait=()=>{
    if(!db.settings.startupImport.enabled||document.querySelector('#view-settings.active')){markStartupImportDone();return}
    const syncPending=window.MGWStartupSyncDone!==true;
    const onboarding=document.querySelector('#mgwOnboarding');
    const tour=document.querySelector('.mgw-walk-bubble,.mgw-walk-mask');
    const blocking=[...document.querySelectorAll('dialog[open]')].some(x=>x.id!=='mgwStartupImportDialog');
    if(syncPending||onboarding||tour||blocking){setTimeout(wait,250);return}
    showPrompt();
  };
  setTimeout(wait,300);
}
function boot(){ensure();style();makeReceiptInput();renderQueue();installSettings();if(!window.MGWSettingsLayout)startup();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWStartupImport={version:RELEASE,show:()=>showPrompt({manual:true}),selectReceipts:()=>makeReceiptInput().click(),processReceipts,renderQueue,startup,startupDone:()=>window.MGWStartupImportDone};
})();
