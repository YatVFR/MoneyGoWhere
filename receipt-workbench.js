// Receipt preparation and review. Originals stay in memory; scans never auto-save.
(()=>{'use strict';
const MAX_SIDE=2200,MAX_BYTES=25*1024*1024;
let preparing=false,scanGeneration=0;
function cropRegion(width,height,crop={left:0,top:0,right:100,bottom:100}){
 const v=key=>Number(crop[key]);const l=v('left'),t=v('top'),r=v('right'),b=v('bottom');
 if(![l,t,r,b].every(Number.isFinite)||l<0||t<0||r>100||b>100||r<=l||b<=t)throw Error('Choose a crop inside the image with a positive width and height.');
 const x=Math.floor(width*l/100),y=Math.floor(height*t/100),w=Math.max(1,Math.ceil(width*r/100)-x),h=Math.max(1,Math.ceil(height*b/100)-y);return{x,y,width:Math.min(w,width-x),height:Math.min(h,height-y)};
}
function pdfText(items){
 const rows=[];let row=null;
 for(const item of items||[]){if(typeof item.str!=='string')continue;const y=Number(item.transform?.[5]||0),x=Number(item.transform?.[4]||0);
  if(!row||Math.abs(row.y-y)>3){row={y,parts:[]};rows.push(row)}row.parts.push({x,text:item.str});if(item.hasEOL)row=null;
 }return rows.map(r=>r.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' ')).join('\n');
}
function isPDF(file){return file?.type==='application/pdf'||/\.pdf$/i.test(file?.name||'')}
function validFile(file){if(!file||file.size>MAX_BYTES)throw Error('Choose an image or PDF smaller than 25 MB.');if(!isPDF(file)&&!/^image\//.test(file.type||'')&&!/\.(?:png|jpe?g|webp|gif|heic|heif)$/i.test(file.name||''))throw Error('Choose a receipt image or PDF.');return true}
function canvas(width,height){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(width));c.height=Math.max(1,Math.round(height));return c}
function rotate(source,angle){const swap=angle%180!==0,c=canvas(swap?source.height:source.width,swap?source.width:source.height),ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.translate(c.width/2,c.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(source,-source.width/2,-source.height/2);return c}
function selection(source,crop){const r=cropRegion(source.width,source.height,crop),c=canvas(r.width,r.height);c.getContext('2d').drawImage(source,r.x,r.y,r.width,r.height,0,0,r.width,r.height);return c}
async function prepare(file){
 validFile(file);if(preparing)throw Error('Finish the current receipt preparation first.');preparing=true;
 let task=null,pdf=null,url='',closed=false,seq=0,transferred=false;
 try{
  if(isPDF(file)){const lib=await window.MGWOCRRuntime.ensurePDF(),base=window.MGWOCRRuntime.pdfAssetBase;task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/'});pdf=await task.promise}
  const dialog=document.createElement('dialog');dialog.className='mgw-receipt-prep';dialog.setAttribute('aria-label','Prepare receipt');
  dialog.innerHTML='<div class="modal-shell"><div class="modal-head"><h2>Prepare Receipt</h2><button type="button" class="icon-btn" data-cancel aria-label="Cancel receipt preparation">×</button></div><p data-file></p><div class="mgw-receipt-tools"><label data-page-label>PDF page <input data-page type="number" min="1" value="1"></label><span data-page-count></span><button type="button" class="secondary-btn" data-rotate>Rotate 90°</button><button type="button" class="secondary-btn" data-crop>Drag to crop</button><button type="button" class="secondary-btn" data-reset>Reset original</button></div><canvas data-preview aria-label="Receipt preview; use the crop percentage fields to crop without dragging"></canvas><fieldset class="mgw-crop-fields"><legend>Crop edges (%)</legend><label>Left<input data-edge="left" type="number" min="0" max="99" value="0"></label><label>Top<input data-edge="top" type="number" min="0" max="99" value="0"></label><label>Right<input data-edge="right" type="number" min="1" max="100" value="100"></label><label>Bottom<input data-edge="bottom" type="number" min="1" max="100" value="100"></label></fieldset><p data-status role="status">Preparing preview…</p><button type="button" class="primary-btn" data-use disabled>Read this receipt</button></div>';
  document.body.appendChild(dialog);dialog.querySelector('[data-file]').textContent=file.name||'Receipt';
  let allPages=null;if(pdf){const label=document.createElement('label');label.className='mgw-pdf-all-pages';label.innerHTML='<input type="checkbox" data-all-pages checked> Read the full PDF (all pages, without cropping)';dialog.querySelector('.mgw-receipt-tools').after(label);allPages=label.querySelector('input');}
  const preview=dialog.querySelector('[data-preview]'),status=dialog.querySelector('[data-status]'),use=dialog.querySelector('[data-use]'),pageInput=dialog.querySelector('[data-page]');
  dialog.querySelector('[data-page-label]').hidden=!pdf;dialog.querySelector('[data-page-count]').textContent=pdf?'of '+pdf.numPages:'';pageInput.max=pdf?pdf.numPages:1;
  let original=null,oriented=null,angle=0,pageNumber=1,embedded='',crop={left:0,top:0,right:100,bottom:100},cropMode=false,drag=null,resolve;
  const completed=new Promise(r=>{resolve=r});
  function resetCrop(){crop={left:0,top:0,right:100,bottom:100};for(const el of dialog.querySelectorAll('[data-edge]'))el.value=crop[el.dataset.edge]}
  function draw(){if(!original)return;oriented=rotate(original,angle);preview.width=oriented.width;preview.height=oriented.height;const ctx=preview.getContext('2d');ctx.drawImage(oriented,0,0);try{const r=cropRegion(preview.width,preview.height,crop);ctx.strokeStyle='#f59e0b';ctx.lineWidth=Math.max(3,preview.width/220);ctx.strokeRect(r.x,r.y,r.width,r.height);use.disabled=false;status.textContent=embedded&&!angle&&crop.left===0&&crop.top===0&&crop.right===100&&crop.bottom===100?'Embedded PDF text available. Review the extracted fields after reading.':'Image OCR will run after preparation.'}catch(err){use.disabled=true;status.textContent=err.message}}
  async function loadPage(){const token=++seq;use.disabled=true;status.textContent='Preparing preview…';original=null;angle=0;resetCrop();try{let image,text='';
    if(pdf){const n=Number(pageInput.value);if(!Number.isInteger(n)||n<1||n>pdf.numPages)throw Error('Choose a valid PDF page.');pageNumber=n;const page=await pdf.getPage(n),view=page.getViewport({scale:1}),scale=Math.min(2,MAX_SIDE/Math.max(view.width,view.height)),vp=page.getViewport({scale});image=canvas(vp.width,vp.height);await page.render({canvasContext:image.getContext('2d'),viewport:vp}).promise;text=pdfText((await page.getTextContent()).items);page.cleanup()}
    else {const img=await mgwLoadImage(file),w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,s=Math.min(1,MAX_SIDE/Math.max(w,h));image=canvas(w*s,h*s);image.getContext('2d').drawImage(img,0,0,image.width,image.height)}
    if(closed||token!==seq)return;original=image;embedded=text;draw();
   }catch(err){if(!closed&&token===seq){status.textContent=err.message||'Could not prepare this receipt.';use.disabled=true}}
  }
  const finish=value=>{if(closed)return;closed=true;seq++;try{dialog.close()}catch{}dialog.remove();resolve(value)};
  dialog.querySelector('[data-cancel]').onclick=()=>finish(null);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null)});dialog.addEventListener('close',()=>finish(null));
  pageInput.onchange=()=>loadPage();dialog.querySelector('[data-rotate]').onclick=()=>{if(original){angle=(angle+90)%360;resetCrop();draw()}};
  const updateMode=()=>{const full=Boolean(allPages?.checked);dialog.querySelector('.mgw-crop-fields').hidden=full;dialog.querySelector('[data-crop]').disabled=full;if(full){cropMode=false;drag=null;preview.style.touchAction='auto';resetCrop();}use.textContent=full?'Read all '+pdf.numPages+' pages':'Read this receipt';draw();};if(allPages){allPages.onchange=updateMode;updateMode();}
  dialog.querySelector('[data-reset]').onclick=()=>{angle=0;resetCrop();draw()};
  dialog.querySelector('[data-crop]').onclick=()=>{cropMode=!cropMode;preview.style.touchAction=cropMode?'none':'auto';dialog.querySelector('[data-crop]').setAttribute('aria-pressed',String(cropMode));status.textContent=cropMode?'Drag a rectangle, or enter crop percentages below.':'Crop drag disabled. You can scroll the preview.'};
  for(const input of dialog.querySelectorAll('[data-edge]'))input.oninput=()=>{crop[input.dataset.edge]=Number(input.value);draw()};
  const point=e=>{const box=preview.getBoundingClientRect();return{x:Math.max(0,Math.min(100,(e.clientX-box.left)*100/box.width)),y:Math.max(0,Math.min(100,(e.clientY-box.top)*100/box.height))}};
  preview.onpointerdown=e=>{if(!cropMode||!original)return;e.preventDefault();drag=point(e);preview.setPointerCapture?.(e.pointerId)};
  preview.onpointermove=e=>{if(!drag)return;const end=point(e);crop={left:Math.min(drag.x,end.x),top:Math.min(drag.y,end.y),right:Math.max(drag.x,end.x),bottom:Math.max(drag.y,end.y)};for(const el of dialog.querySelectorAll('[data-edge]'))el.value=Number(crop[el.dataset.edge].toFixed(1));draw()};
  preview.onpointerup=()=>{drag=null};preview.onpointercancel=()=>{drag=null};
  use.onclick=()=>{try{const modified=angle!==0||crop.left!==0||crop.top!==0||crop.right!==100||crop.bottom!==100,source=selection(oriented,crop),prepared={source,embeddedText:!modified&&embedded.trim().length>=20?embedded:'',pageNumber:pdf?pageNumber:0,rotation:angle,crop:{...crop},modified,originalFile:file};
   if(pdf&&allPages.checked){transferred=true;let disposed=false;prepared.fullPDF=true;prepared.pageCount=pdf.numPages;prepared.pageNumber=0;prepared.dispose=async()=>{if(disposed)return;disposed=true;await task.destroy()};
    prepared.readAll=async function*(){try{for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);try{const text=pdfText((await page.getTextContent()).items);let image=null;if(text.trim().length<20){const v=page.getViewport({scale:1}),vp=page.getViewport({scale:Math.min(2,MAX_SIDE/Math.max(v.width,v.height))});image=canvas(vp.width,vp.height);await page.render({canvasContext:image.getContext('2d'),viewport:vp}).promise;if(angle)image=rotate(image,angle);}yield{pageNumber:n,embeddedText:text.trim().length>=20?text:'',source:image}}finally{page.cleanup()}}}finally{await prepared.dispose()}};
   }finish(prepared);
  }catch(err){status.textContent=err.message}};
  try{dialog.showModal()}catch(err){dialog.remove();throw err}loadPage();return await completed;
 }finally{preparing=false;if(url)URL.revokeObjectURL(url);if(task&&!transferred)try{await task.destroy()}catch{}}
}
function textPanel(container,result){
 const review=window.MGWReceiptReview;let panel=container.querySelector('.mgw-ocr-text');if(!panel){panel=document.createElement('div');panel.className='mgw-ocr-text';container.appendChild(panel)}
 panel.innerHTML='<p class="mgw-ocr-warning" role="status"></p><label>Scanned text<textarea readonly rows="7"></textarea></label><button type="button" class="secondary-btn">Copy scanned text</button>';
 const textarea=panel.querySelector('textarea');textarea.value=String(result?.rawText||'');panel.querySelector('p').textContent=(result?.fullPDF?'All '+result.pageCount+' PDF pages read. Verify this is one receipt; multiple transactions must not be saved as one total. ':'')+(review.issues(result).join(' · ')||'Review all details before saving.');
 panel.querySelector('button').onclick=async()=>{const ok=await review.copy(textarea.value,textarea);window.toast?.(ok?'Scanned text copied':'Select the scanned text and copy it manually.')};
}
async function scanIntoForm(e){const file=e.target.files?.[0],form=document.querySelector('#expenseForm'),status=document.querySelector('#ocrStatus');if(!file||!form)return;if(preparing||form.dataset.receiptBusy==='1'){if(status)status.textContent='Finish the current receipt scan first.';return}
 e.target.value='';const token=++scanGeneration;form.dataset.receiptBusy='1';form.elements.receiptReviewed&&(form.elements.receiptReviewed.checked=false);
 const say=text=>{if(token===scanGeneration&&form.isConnected&&status)status.textContent=text};
 try{say('Prepare the receipt before scanning…');const prepared=await prepare(file);if(!prepared)return;const result=await window.MGWReceiptOCR.readFile(file,{prepared,status:say});if(token!==scanGeneration||!form.isConnected)return;
  const values=result.values||{};for(const key of ['vendor','date','time','amount','location','currency']){const input=form.elements[key];if(input){input.value=values[key]||'';input.classList.toggle('mgw-ocr-uncertain',!values[key]||Number(result.confidence?.[key]||0)<80)}}
  if(form.elements.currency&&![...form.elements.currency.options].some(o=>o.value===values.currency)){const option=document.createElement('option');option.value=values.currency;option.textContent=values.currency;form.elements.currency.appendChild(option);form.elements.currency.value=values.currency}
  form.elements.category.value=values.category||'';form._mgwReceiptResult=result;window.MGWUnifiedWallet?.applyReceipt(form,result);textPanel(document.querySelector('.ocr-box')||form,result);
  const preview=document.querySelector('#receiptPreview');if(preview){preview.src=prepared.source.toDataURL('image/jpeg',.8);preview.classList.remove('hidden')}
  say('Receipt read. Correct highlighted fields, choose the payment source and confirm the review before saving.');
 }catch(err){say((err.message||'Could not read the receipt.')+' You can still enter the details manually.')}finally{if(token===scanGeneration)delete form.dataset.receiptBusy}
}
window.MGWReceiptWorkbench={prepare,scanIntoForm,textPanel,cropRegion,pdfText,isPDF,validFile};
})();
