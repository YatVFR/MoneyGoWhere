// MoneyGoWhere DEV — optional startup import assistant + calibrated local batch receipt OCR.
// Receipt images are processed locally and are never persisted or uploaded by this module.
(()=>{'use strict';
const RELEASE='1.5.5-dev.41';
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toUpperCase();
const persist=()=>localStorage.setItem(MGW.key,JSON.stringify(db));
let shownThisLoad=false,processing=false;
function ensure(){
  db.settings=db.settings||{};
  db.settings.startupImport=db.settings.startupImport&&typeof db.settings.startupImport==='object'?db.settings.startupImport:{};
  if(typeof db.settings.startupImport.enabled!=='boolean')db.settings.startupImport.enabled=true;
  db.receiptImportQueue=Array.isArray(db.receiptImportQueue)?db.receiptImportQueue:[];
  db.receiptImportHistory=Array.isArray(db.receiptImportHistory)?db.receiptImportHistory:[];
}
function currencyFromText(text=''){
  const t=String(text).toUpperCase();
  if(/\bMYR\b|(?:^|\s)RM\s*\d|\bJOHOR\b|\bBERHAD\b|\bSDN\.?\s*BHD\b|\bSST\b/.test(t))return'MYR';
  if(/\bUSD\b|US\$/.test(t))return'USD';
  if(/\bEUR\b|€/.test(t))return'EUR';
  if(/\bGBP\b|£/.test(t))return'GBP';
  return'SGD';
}
function duplicate(x){
  const rows=[...(db.expenses||[]),...db.receiptImportQueue,...db.receiptImportHistory];
  return rows.some(y=>y.sourceId===x.sourceId||(x.amount>0&&String(y.date||'').slice(0,10)===String(x.date||'').slice(0,10)&&Math.abs(num(y.amount)-num(x.amount))<.005&&norm(y.vendor||y.merchant)===norm(x.merchant)));
}
function makeReceiptInput(){
  let input=document.querySelector('#mgwBatchReceiptInput');
  if(input)return input;
  input=document.createElement('input');input.id='mgwBatchReceiptInput';input.type='file';input.accept='image/*';input.multiple=true;input.hidden=true;
  input.addEventListener('change',async()=>{if(input.files?.length)await processReceipts(input.files);input.value=''});
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
.mgw-receipt-batch-row{border:1px solid var(--line,#e4e9e7);border-radius:14px;padding:12px;margin-top:9px}.mgw-receipt-batch-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mgw-receipt-batch-grid .field.full{grid-column:1/-1}.mgw-receipt-batch-actions{display:flex;gap:7px;margin-top:9px}.mgw-receipt-batch-actions button{border:0;border-radius:10px;padding:8px 10px}.mgw-receipt-pill{display:inline-block;padding:3px 7px;border-radius:999px;background:var(--brand-soft,#e8f5f2);color:var(--brand,#0f766e);font-size:.72rem;font-weight:800;margin:0 6px 8px 0}.mgw-receipt-pill.warn{background:#fff7ed;color:#b45309}.mgw-receipt-confidence{font-size:.76rem;opacity:.68;margin:0 0 8px}.mgw-startup-toggle{width:44px;height:26px;border-radius:999px;background:#cfd8d5;position:relative;transition:.18s}.mgw-startup-toggle:after{content:'';position:absolute;width:20px;height:20px;left:3px;top:3px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.18);transition:.18s}.mgw-startup-toggle.on{background:var(--brand,#0f766e)}.mgw-startup-toggle.on:after{transform:translateX(18px)}
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
function renderQueue(){
  ensure();const card=queueCard();if(!card)return;
  const rows=db.receiptImportQueue.filter(x=>x.status==='pending');
  if(!rows.length){card.remove();return}
  card.innerHTML=`<div class="card-head"><div><span class="section-icon">🧾</span><b>Receipt Batch Review</b></div><strong>${rows.length}</strong></div><p class="mgw-muted">Receipt images were processed locally. Review the extracted fields before saving.</p>${rows.map(x=>`<div class="mgw-receipt-batch-row" data-receipt-id="${x.id}"><span class="mgw-receipt-pill">Receipt · ${Math.round(x.ocrConfidence||0)}% OCR</span>${x.zeroValue?'<span class="mgw-receipt-pill warn">Zero-value receipt</span>':''}<div class="mgw-receipt-confidence">${esc(x.confidenceSummary||'')}</div><div class="mgw-receipt-batch-grid"><div class="field full"><label>Merchant</label><input data-k="merchant" value="${esc(x.merchant)}"></div><div class="field"><label>Date</label><input data-k="date" type="date" value="${esc(x.date)}"></div><div class="field"><label>Time</label><input data-k="time" type="time" value="${esc(x.time)}"></div><div class="field"><label>Amount</label><input data-k="amount" type="number" min="0" step="0.01" value="${Number.isFinite(Number(x.amount))?Number(x.amount):''}"></div><div class="field"><label>Currency</label><select data-k="currency">${currencyOptions(x.currency||'SGD')}</select></div><div class="field full"><label>Location</label><input data-k="location" value="${esc(x.location)}"></div><div class="field full"><label>Payment</label><input data-k="paymentMethod" value="${esc([x.paymentMethod,x.cardLast4?`••••${x.cardLast4}`:''].filter(Boolean).join(' '))}" placeholder="Optional"></div><div class="field full"><label>Category</label><select data-k="category">${categoryOptions(x.category||'')}</select></div></div><div class="mgw-receipt-batch-actions"><button class="primary-btn" data-save>${x.zeroValue?'Save if amount changes':'Save Expense'}</button><button class="secondary-btn" data-dismiss>Dismiss</button></div></div>`).join('')}`;
  card.querySelectorAll('[data-receipt-id]').forEach(row=>{
    const item=db.receiptImportQueue.find(x=>x.id===row.dataset.receiptId);if(!item)return;
    row.querySelector('[data-save]').addEventListener('click',()=>{
      const get=k=>row.querySelector(`[data-k="${k}"]`)?.value||'';
      const merchant=get('merchant').trim(),amount=num(get('amount')),category=get('category'),date=get('date');
      if(!merchant||!date||amount<=0||!category){if(typeof toast==='function')toast(item.zeroValue?'Zero-value receipt detected. Change the amount to save it as an expense, or dismiss it.':'Review merchant, date, amount and category first.');return}
      const pay=get('paymentMethod').trim();Object.assign(item,{merchant,amount,date,time:get('time'),currency:get('currency')||'SGD',location:get('location').trim(),category,paymentMethod:pay,zeroValue:false});
      const tx={id:uid('EXP'),date:item.date,time:item.time,vendor:item.merchant,location:item.location,amount:item.amount,currency:item.currency,category:item.category,source:'receipt_batch',sourceId:item.sourceId,notes:item.notes||'',paymentMethod:item.paymentMethod||''};
      db.expenses.push(tx);db.receiptImportHistory.push({...item,status:'accepted',acceptedExpenseId:tx.id});db.receiptImportQueue=db.receiptImportQueue.filter(x=>x.id!==item.id);persist();renderQueue();if(typeof renderAll==='function')renderAll();window.MGWCurrency?.syncRates?.({force:true});if(typeof toast==='function')toast('Receipt saved');
    });
    row.querySelector('[data-dismiss]').addEventListener('click',()=>{db.receiptImportHistory.push({...item,status:'dismissed'});db.receiptImportQueue=db.receiptImportQueue.filter(x=>x.id!==item.id);persist();renderQueue()});
  });
}
function confidenceSummary(result){
  const c=result?.confidence||{};return [`Merchant ${c.vendor||0}%`,`Date ${c.date||0}%`,`Amount ${c.amount||0}%`,`Location ${c.location||0}%`,`Currency ${c.currency||0}%`].join(' · ');
}
async function ocrOne(file,status){
  if(window.MGWReceiptOCR?.readFile){const result=await window.MGWReceiptOCR.readFile(file,{status});return{result,raw:result?.rawText||''}}
  if(!window.Tesseract||typeof mgwPreprocessReceipt!=='function'||typeof mgwParseReceiptSmart!=='function')throw new Error('OCR unavailable');
  status(`Preparing ${file.name}…`);const enhanced=await mgwPreprocessReceipt(file),first=await Tesseract.recognize(enhanced,'eng'),result=mgwParseReceiptSmart(first.data.text,first.data.confidence);return{result,raw:first.data.text};
}
async function processReceipts(files){
  ensure();if(processing)return;processing=true;
  const statusEl=document.querySelector('#mgwStartupImportStatus');const setStatus=t=>{if(statusEl)statusEl.textContent=t};
  let added=0,duplicates=0,failed=0,zero=0,index=0;
  try{
    for(const file of [...files]){
      index++;setStatus(`Receipt ${index}/${files.length}: processing…`);
      try{
        const {result,raw}=await ocrOne(file,setStatus),v=result?.values||{},merchant=String(v.vendor||'').trim(),amountRaw=String(v.amount??'').trim(),hasAmount=amountRaw!==''&&Number.isFinite(Number(amountRaw)),amount=hasAmount?Number(amountRaw):NaN,date=String(v.date||'').slice(0,10),currency=String(v.currency||currencyFromText(raw)),sourceId=`RCP-${file.lastModified||0}-${file.size||0}-${norm(file.name)}`;
        if(!merchant||!hasAmount){failed++;continue}
        const zeroValue=amount===0,item={id:uid('RCP'),source:'receipt_batch',sourceId,merchant,amount,date,time:String(v.time||'').slice(0,5),location:String(v.location||''),currency,category:result.suggestion?.confidence>=80?String(result.suggestion.category||''):'',paymentMethod:String(v.paymentMethod||''),cardLast4:String(v.cardLast4||''),ocrConfidence:Number(result.confidence?.ocr)||0,confidenceSummary:confidenceSummary(result),notes:result.amountEvidence?`OCR amount source: ${result.amountEvidence}`:'',zeroValue,status:'pending'};
        if(duplicate(item)){duplicates++;continue}db.receiptImportQueue.push(item);added++;if(zeroValue)zero++;
      }catch{failed++}
    }
    if(added)persist();renderQueue();if(added){if(typeof nav==='function')nav('add');setTimeout(()=>document.querySelector('#mgwReceiptBatchQueue')?.scrollIntoView({behavior:'smooth',block:'start'}),100)}
    setStatus(`${added} receipt${added===1?'':'s'} queued${zero?` · ${zero} zero-value`:''}${duplicates?` · ${duplicates} duplicate${duplicates===1?'':'s'} skipped`:''}${failed?` · ${failed} need manual review`:''}`);if(typeof toast==='function')toast(added?`${added} receipt${added===1?'':'s'} ready for review`:'No receipts were queued');
  }finally{processing=false}
}
function openApplePay(){
  const dir=document.querySelector('#mgwApplePayFolderInput');if(dir){dir.click();return}
  const files=document.querySelector('#mgwApplePayInboxInput');if(files){files.click();return}
  if(typeof toast==='function')toast('Apple Pay importer is still loading');
}
function showPrompt({manual=false}={}){
  ensure();style();makeReceiptInput();if(!manual&&(!db.settings.startupImport.enabled||shownThisLoad))return;
  let d=document.querySelector('#mgwStartupImportDialog');if(!d){d=document.createElement('dialog');d.id='mgwStartupImportDialog';d.className='mgw-startup-import';document.body.appendChild(d)}
  d.innerHTML=`<div class="mgw-startup-import-shell"><div class="eyebrow">Quick Import</div><h2>Anything to add?</h2><p>Add several receipt images for calibrated local OCR, scan your MGW Apple Pay folder, or continue without importing.</p><div class="mgw-startup-import-actions"><button class="secondary-btn" data-receipts><b>🧾 Add Receipt Images</b><small>Select multiple receipt photos. MGW checks orientation, totals, dates, merchant and currency before review.</small></button><button class="secondary-btn" data-apple><b>🍎 Scan Apple Pay Folder</b><small>Check MGW JSON/TXT transaction files and queue new transactions.</small></button><button class="primary-btn" data-done><b>Continue to MoneyGoWhere</b></button></div><div class="mgw-startup-import-status" id="mgwStartupImportStatus"></div></div>`;
  d.querySelector('[data-receipts]').addEventListener('click',()=>makeReceiptInput().click());d.querySelector('[data-apple]').addEventListener('click',openApplePay);d.querySelector('[data-done]').addEventListener('click',()=>d.close());shownThisLoad=true;try{d.showModal()}catch{}
}
function installSettings(){
  ensure();const list=document.querySelector('#view-settings .settings-list');if(!list||document.querySelector('#mgwStartupImportToggle'))return;
  const toggle=document.createElement('button');toggle.type='button';toggle.id='mgwStartupImportToggle';toggle.innerHTML=`<span>📥</span><span><b>Startup Import Check</b><small>Ask for batch receipts and Apple Pay when the app opens</small></span><span class="mgw-startup-toggle ${db.settings.startupImport.enabled?'on':''}" aria-hidden="true"></span>`;
  toggle.addEventListener('click',()=>{db.settings.startupImport.enabled=!db.settings.startupImport.enabled;persist();toggle.querySelector('.mgw-startup-toggle')?.classList.toggle('on',db.settings.startupImport.enabled);if(typeof toast==='function')toast(db.settings.startupImport.enabled?'Startup import check enabled':'Startup import check disabled')});
  const run=document.createElement('button');run.type='button';run.id='mgwRunStartupImport';run.innerHTML='<span>🧾</span><span><b>Run Import Check</b><small>Batch-process receipts or scan Apple Pay now</small></span><span>›</span>';run.addEventListener('click',()=>showPrompt({manual:true}));
  const integrity=[...list.querySelectorAll('button')].find(b=>/Data Integrity Check/i.test(b.textContent||''));list.insertBefore(toggle,integrity||null);list.insertBefore(run,integrity||null);
}
function startup(){
  ensure();if(!db.settings.startupImport.enabled)return;
  let tries=0;const wait=()=>{tries++;const sync=document.querySelector('#mgwStartupSyncDialog'),onboarding=document.querySelector('#mgwOnboarding'),blocking=[...document.querySelectorAll('dialog[open]')].some(x=>x.id!=='mgwStartupImportDialog');if(sync?.open||onboarding||blocking){if(tries<180)setTimeout(wait,500);return}showPrompt()};setTimeout(wait,1300);
}
function boot(){ensure();style();makeReceiptInput();renderQueue();installSettings();startup();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWStartupImport={version:RELEASE,show:()=>showPrompt({manual:true}),processReceipts,renderQueue};
})();
