// MoneyGoWhere v1.5.5-dev.41 — calibrated local receipt OCR.
// Uses multiple orientations and receipt-aware parsing. Receipt images remain local to the browser.
const MGW_OCR_RELEASE=Object.freeze({appVersion:'1.5.5-dev.41',schemaVersion:1,dataVersion:12,cacheVersion:'1.5.5-dev-41'});

function mgwLoadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image load failed'))};
    img.src=url;
  });
}

function mgwCanvasFromImage(img,rotation=0,maxSide=2600){
  const r=((rotation%360)+360)%360,swap=r===90||r===270;
  const baseW=img.naturalWidth||img.width,baseH=img.naturalHeight||img.height;
  const scale=Math.min(2.4,maxSide/Math.max(baseW,baseH));
  const sw=Math.max(1,Math.round(baseW*scale)),sh=Math.max(1,Math.round(baseH*scale));
  const canvas=document.createElement('canvas');canvas.width=swap?sh:sw;canvas.height=swap?sw:sh;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(r*Math.PI/180);ctx.drawImage(img,-sw/2,-sh/2,sw,sh);ctx.restore();
  return canvas;
}

function mgwAutoContrast(canvas,{binary=false}={}){
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(0,0,canvas.width,canvas.height),p=data.data,hist=new Uint32Array(256);
  for(let i=0;i<p.length;i+=4){const g=Math.round(.299*p[i]+.587*p[i+1]+.114*p[i+2]);hist[g]++}
  const total=canvas.width*canvas.height,lowTarget=total*.015,highTarget=total*.985;let acc=0,low=0,high=255;
  for(let i=0;i<256;i++){acc+=hist[i];if(acc>=lowTarget){low=i;break}}
  acc=0;for(let i=0;i<256;i++){acc+=hist[i];if(acc>=highTarget){high=i;break}}
  const span=Math.max(55,high-low);
  for(let i=0;i<p.length;i+=4){let g=Math.round(.299*p[i]+.587*p[i+1]+.114*p[i+2]);g=Math.max(0,Math.min(255,(g-low)*255/span));g=(g-128)*1.16+128;g=Math.max(0,Math.min(255,g));if(binary)g=g<174?0:255;p[i]=p[i+1]=p[i+2]=g}
  ctx.putImageData(data,0,0);return canvas;
}

async function mgwPreprocessReceipt(file,opts={}){
  const img=await mgwLoadImage(file),canvas=mgwCanvasFromImage(img,opts.rotation||0,opts.maxSide||2600);
  return mgwAutoContrast(canvas,{binary:Boolean(opts.binary)});
}

function mgwReceiptLines(text){
  return String(text||'').replace(/\r/g,'\n').replace(/[│┃]/g,' ').split(/\n+/).map(x=>x.replace(/[ \t]+/g,' ').replace(/^[-_=*·•\s]+|[-_=*·•\s]+$/g,'').trim()).filter(Boolean);
}
function mgwNum(v){const n=Number(String(v??'').replace(/,/g,''));return Number.isFinite(n)?n:null}
function mgwMoneyTokens(line){
  const src=String(line||'').replace(/(?<=\d)[Oo](?=\d)/g,'0').replace(/(?<=\d)[Il](?=\d)/g,'1');
  const re=/(?:\b(?:SGD|MYR|USD|EUR|GBP|RM)\s*|(?:S|US)?\$\s*|€\s*|£\s*)?(-?\d{1,3}(?:,\d{3})*|-?\d+)[.,](\d{2})\b/gi;
  return [...src.matchAll(re)].map(m=>({value:Number(`${m[1].replace(/,/g,'')}.${m[2]}`),raw:m[0],index:m.index||0})).filter(x=>Number.isFinite(x.value));
}
function mgwAmountFromLine(line){const a=mgwMoneyTokens(line);return a.length?a[a.length-1].value:null}
function mgwLineExcludedFromTotal(line){return /sub\s*-?\s*total|gst|sst|sales tax|service tax|discount|saving|round(?:ing)?|change\b|refund|cashback|deposit|balance|tax code/i.test(line)}
function mgwExtractAmount(lines){
  const rules=[
    [/total\s+price\s+payable|total\s+amount\s+payable|amount\s+payable|grand\s+total|net\s+total|paid\s+total/i,180],
    [/\btotal\s+(?:dine\s*in|take\s*away|due|paid)\b/i,170],
    [/^\s*(?:total|amount)\b|\btotal\s*:/i,155],
    [/\b(?:mastercard|master|visa|amex)\b/i,70]
  ],c=[];
  lines.forEach((line,i)=>{
    for(const [re,base] of rules){if(!re.test(line))continue;if(base<100&&mgwLineExcludedFromTotal(line))continue;
      const same=mgwMoneyTokens(line).filter(x=>x.value>=0);same.forEach(x=>c.push({value:x.value,score:base+i/100,line,evidence:line}));
      if(!same.length&&base>=150){for(const off of [1,-1,2]){const j=i+off;if(j<0||j>=lines.length)continue;const near=lines[j];if(mgwLineExcludedFromTotal(near))continue;const vals=mgwMoneyTokens(near).filter(x=>x.value>=0);vals.forEach(x=>c.push({value:x.value,score:base-12*Math.abs(off)+j/100,line:i,evidence:`${line} → ${near}`}));if(vals.length)break}}
    }
  });
  if(c.length){c.sort((a,b)=>b.score-a.score);const x=c[0];return{amount:x.value,confidence:Math.min(99,90+Math.floor((x.score-140)/10)),evidence:x.evidence}}
  const fallback=[];lines.forEach((line,i)=>{if(mgwLineExcludedFromTotal(line)||/approval|receipt|invoice|member|tel|phone|gst\s*(?:reg|no)|company\s*no/i.test(line))return;for(const x of mgwMoneyTokens(line)){if(x.value>=0)fallback.push({value:x.value,i,line})}});
  if(!fallback.length)return{amount:null,confidence:0,evidence:''};
  const fromBottom=fallback.filter(x=>x.i>=Math.floor(lines.length*.45));const pool=fromBottom.length?fromBottom:fallback;pool.sort((a,b)=>b.value-a.value||b.i-a.i);return{amount:pool[0].value,confidence:58,evidence:pool[0].line};
}

function mgwValidDate(y,m,d){const dt=new Date(y,m-1,d);return y>=2000&&y<=2100&&dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d}
function mgwDateScore(text,index){const ctx=text.slice(Math.max(0,index-40),index).toLowerCase();return 78+(/date|date\/time|order time|printed|entered|sales time/.test(ctx)?18:0)}
function mgwExtractDate(text){
  const s=String(text||''),c=[];
  for(const m of s.matchAll(/\b(20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g)){const y=+m[1],mo=+m[2],d=+m[3];if(mgwValidDate(y,mo,d))c.push({value:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,score:mgwDateScore(s,m.index||0)})}
  for(const m of s.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)){const d=+m[1],mo=+m[2],y=m[3].length===2?2000+(+m[3]):+m[3];if(mgwValidDate(y,mo,d))c.push({value:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,score:mgwDateScore(s,m.index||0)})}
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  for(const m of s.matchAll(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/gi)){const d=+m[1],mo=months.findIndex(x=>m[2].toLowerCase().startsWith(x))+1,y=+m[3];if(mgwValidDate(y,mo,d))c.push({value:`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,score:mgwDateScore(s,m.index||0)})}
  if(!c.length)return{value:'',confidence:0};c.sort((a,b)=>b.score-a.score);return{value:c[0].value,confidence:Math.min(99,c[0].score)};
}
function mgwExtractTime(text){
  const s=String(text||''),c=[];
  for(const m of s.matchAll(/\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM)?\b/gi)){
    let h=+m[1];if(h>23)continue;const ap=(m[4]||'').toUpperCase();if(ap){if(h>12)continue;if(ap==='PM'&&h<12)h+=12;if(ap==='AM'&&h===12)h=0}
    const ctx=s.slice(Math.max(0,(m.index||0)-35),m.index||0).toLowerCase(),score=82+(/time|date\/time|order|printed|entered|sales/.test(ctx)?14:0);
    c.push({value:`${String(h).padStart(2,'0')}:${m[2]}`,score});
  }
  if(!c.length)return{value:'',confidence:0};c.sort((a,b)=>b.score-a.score);return{value:c[0].value,confidence:Math.min(99,c[0].score)};
}

function mgwVendorReject(line){
  return /tax invoice|simplified tax invoice|official receipt|\breceipt\b|\binvoice\b|gst\s*(?:reg|id|no)|sst\s*(?:no|id)|company\s*no|roc\b|uen\b|date(?:\/time)?\b|order\s*(?:#|no|time)|printed\s+on|cashier|salesperson|member\s*(?:id|name|expiry)|description|qty\b|price\b|amount\b|subtotal|sub total|total\b|tender|approval|barcode|wifi|thank you|http|www\.|\btel\b|\bfax\b/i.test(line);
}
function mgwAddressLike(line){return /\b(?:street|st\b|road|rd\b|avenue|ave\b|drive|dr\b|lane|ln\b|central|tower|plaza|junction|mall|centre|center|building|level|jalan|taman|kawasan|johor|singapore|drive\s*thru|store\s*code|site\s*[:#])\b|#\s*[A-Z]?\d{1,3}[-/]\d{1,3}|\b\d{5,6}\b/i.test(line)}
function mgwExtractVendor(lines){
  const candidates=[];
  lines.slice(0,20).forEach((line,i)=>{
    if(mgwVendorReject(line)||(mgwAddressLike(line)&&!/@/.test(line))||!/[A-Za-z]{3}/.test(line)||line.length<3||line.length>80)return;
    const letters=(line.match(/[A-Za-z]/g)||[]).length,digits=(line.match(/\d/g)||[]).length;if(digits>letters*.7)return;
    let score=108-i*5;if(i<2)score+=10;
    if(/\b(?:pte\.?\s*ltd|sdn\.?\s*bhd|berhad|holdings?|pharmacy|restaurant|cafe|coffee|mart|market|store|shop|products?|ventures?|clinic|medical)\b/i.test(line))score+=4;
    if(line===line.toUpperCase()&&letters>=5)score+=8;
    if(/^[A-Za-z&'’ .-]+$/.test(line)&&letters>=4)score+=5;
    if(/^(?:the\s+)?[A-Za-z]/i.test(line))score+=3;
    candidates.push({value:line.replace(/\s{2,}/g,' ').trim(),score});
  });
  if(!candidates.length)return{value:'',confidence:0};candidates.sort((a,b)=>b.score-a.score);return{value:candidates[0].value,confidence:Math.min(98,Math.max(55,candidates[0].score-18))};
}
function mgwExtractLocation(lines,vendor){
  const vi=lines.findIndex(x=>x===vendor),start=vi>=0?vi+1:0,pool=lines.slice(start,Math.min(lines.length,start+28)),hits=[];
  pool.forEach((line,i)=>{if(/gst|sst|company\s*no|roc\b|uen\b|receipt|invoice|bill\s*(?:no|number)|order\s*(?:no|number)|\btel\b|\bfax\b|date|cashier/i.test(line))return;if(mgwAddressLike(line))hits.push({line,i})});
  if(!hits.length)return{value:'',confidence:0};
  const chosen=[];let last=-9;for(const h of hits){if(chosen.length>=4)break;if(chosen.length&&h.i-last>3)break;chosen.push(h.line);last=h.i}
  const unique=[...new Set(chosen.map(x=>x.trim().replace(/,+$/,'')))];return{value:unique.join(', '),confidence:Math.min(96,72+unique.length*7)};
}
function mgwExtractCurrency(text,location=''){
  const t=`${text||''}\n${location||''}`.toUpperCase();
  if(/\bMYR\b|(?:^|\s)RM\s*\d|\bJOHOR\b|\bBERHAD\b|\bSDN\.?\s*BHD\b|\bSST\b/.test(t))return{value:'MYR',confidence:/\bMYR\b|(?:^|\s)RM\s*\d/.test(t)?98:84};
  if(/\bUSD\b|US\$/.test(t))return{value:'USD',confidence:98};
  if(/\bEUR\b|€/.test(t))return{value:'EUR',confidence:98};
  if(/\bGBP\b|£/.test(t))return{value:'GBP',confidence:98};
  if(/\bSGD\b|S\$|\bSINGAPORE\b|\bGST\b/.test(t))return{value:'SGD',confidence:/\bSGD\b|S\$/.test(t)?98:84};
  return{value:'SGD',confidence:60};
}
function mgwExtractPayment(lines){
  const rules=[[/singtel\s+voucher/i,'Singtel Voucher'],[/dbs[_\s-]*cc/i,'DBS Card'],[/mastercard|\bmaster\b/i,'Mastercard'],[/\bvisa\b/i,'Visa'],[/amex|american express/i,'American Express'],[/\bpaynow\b/i,'PayNow'],[/\bnets\b/i,'NETS'],[/\bcash\b/i,'Cash'],[/\bcard\b/i,'Card']];
  for(const line of lines){if(/item|description/i.test(line))continue;for(const [re,name] of rules){if(!re.test(line))continue;const last=line.match(/(?:\*|x){3,}[- ]?(\d{4})\b/i);return{method:name,last4:last?last[1]:'',confidence:name==='Card'?76:90,evidence:line}}}
  return{method:'',last4:'',confidence:0,evidence:''};
}
function mgwReceiptScore(result){const c=result?.confidence||{};let s=(c.vendor||0)+(c.date||0)+(c.time||0)+(c.amount||0)+(c.location||0)+(c.currency||0)*.5;s+=(result?.values?.amount!==''?35:0)+(result?.values?.vendor?20:0);return s}
function mgwParseReceiptSmart(text,ocrConfidence=0){
  const lines=mgwReceiptLines(text),vendor=mgwExtractVendor(lines),date=mgwExtractDate(text),time=mgwExtractTime(text),amount=mgwExtractAmount(lines),location=mgwExtractLocation(lines,vendor.value),currency=mgwExtractCurrency(text,location.value),payment=mgwExtractPayment(lines);
  const suggestion=typeof mgwSuggestCategory==='function'?mgwSuggestCategory(vendor.value,text):{category:'',confidence:0,reason:'needs review'};
  const values={vendor:vendor.value,date:date.value,time:time.value,amount:amount.amount!==null?amount.amount.toFixed(2):'',location:location.value,currency:currency.value,paymentMethod:payment.method,cardLast4:payment.last4,category:suggestion.confidence>=90?suggestion.category:''};
  return{values,confidence:{ocr:Math.round(ocrConfidence||0),vendor:vendor.confidence,date:date.confidence,time:time.confidence,amount:amount.confidence,location:location.confidence,currency:currency.confidence,payment:payment.confidence,category:suggestion.confidence||0},suggestion,amountEvidence:amount.evidence,paymentEvidence:payment.evidence,rawText:text,zeroValue:amount.amount===0};
}
function mgwMergeReceiptResults(results){
  const valid=(results||[]).filter(Boolean);if(!valid.length)return null;valid.sort((a,b)=>mgwReceiptScore(b)-mgwReceiptScore(a));const best=valid[0],fields=['vendor','date','time','amount','location','currency','paymentMethod','cardLast4'],cmap={vendor:'vendor',date:'date',time:'time',amount:'amount',location:'location',currency:'currency',paymentMethod:'payment',cardLast4:'payment'};
  const merged={...best,values:{...best.values},confidence:{...best.confidence},rawText:valid.map(x=>x.rawText).filter(Boolean).join('\n--- OCR PASS ---\n')};
  for(const f of fields){let winner=best,score=Number(best.confidence?.[cmap[f]]||0);for(const r of valid){const v=String(r.values?.[f]??'').trim(),cs=Number(r.confidence?.[cmap[f]]||0);if(v&&cs>score){winner=r;score=cs}}if(String(winner.values?.[f]??'').trim()!==''){merged.values[f]=winner.values[f];merged.confidence[cmap[f]]=score}}
  const amountOwner=valid.find(r=>r.values?.amount===merged.values.amount);if(amountOwner)merged.amountEvidence=amountOwner.amountEvidence;const payOwner=valid.find(r=>r.values?.paymentMethod===merged.values.paymentMethod);if(payOwner)merged.paymentEvidence=payOwner.paymentEvidence;
  merged.zeroValue=Number(merged.values.amount)===0;return merged;
}

function mgwConfidenceMark(v){return v>=90?'✓':v>=70?'~':'!'}
function mgwOCRSummary(result){
  const c=result.confidence,s=result.suggestion,parts=[`OCR ${c.ocr}%`,`Vendor ${c.vendor}% ${mgwConfidenceMark(c.vendor)}`,`Date ${c.date}% ${mgwConfidenceMark(c.date)}`,`Amount ${c.amount}% ${mgwConfidenceMark(c.amount)}`,`${result.values.currency||'SGD'} ${c.currency||0}%`];
  if(result.values.location)parts.push(`Location ${c.location}% ${mgwConfidenceMark(c.location)}`);if(result.values.paymentMethod)parts.push(result.values.paymentMethod);if(s?.category)parts.push(`${s.category} ${s.confidence}%`);if(result.zeroValue)parts.push('Zero-value receipt');return parts.join(' · ');
}

async function mgwTesseractPass(source,label,status){
  const r=await Tesseract.recognize(source,'eng',{logger:m=>{if(m.status==='recognizing text'&&typeof status==='function')status(`${label} ${Math.round((m.progress||0)*100)}%`)}});return mgwParseReceiptSmart(r.data.text,r.data.confidence);
}
async function mgwReadReceiptFile(file,{status}={}){
  if(!window.Tesseract)throw new Error('OCR library unavailable');const say=t=>{if(typeof status==='function')status(t)},passes=[];
  say('Preparing receipt…');const enhanced=await mgwPreprocessReceipt(file,{rotation:0});passes.push(await mgwTesseractPass(enhanced,'Reading receipt…',say));
  let merged=mgwMergeReceiptResults(passes),strong=merged&&merged.confidence.amount>=92&&merged.confidence.vendor>=78&&merged.confidence.date>=88&&mgwReceiptScore(merged)>=430;
  if(!strong){passes.push(await mgwTesseractPass(file,'Cross-checking original…',say));merged=mgwMergeReceiptResults(passes);strong=merged&&merged.confidence.amount>=92&&merged.confidence.vendor>=78&&merged.confidence.date>=88&&mgwReceiptScore(merged)>=430}
  if(!strong){for(const rotation of [90,270]){say(`Checking ${rotation===90?'clockwise':'counter-clockwise'} orientation…`);const rotated=await mgwPreprocessReceipt(file,{rotation});passes.push(await mgwTesseractPass(rotated,'Reading rotated receipt…',say));merged=mgwMergeReceiptResults(passes);if(merged&&merged.confidence.amount>=92&&merged.confidence.vendor>=78&&merged.confidence.date>=88&&mgwReceiptScore(merged)>=430)break}}
  say('Validating receipt fields…');return mgwMergeReceiptResults(passes);
}

async function scanReceipt(e){
  const file=e.target.files[0];if(!file)return;const img=document.querySelector('#receiptPreview'),st=document.querySelector('#ocrStatus');img.src=URL.createObjectURL(file);img.classList.remove('hidden');
  if(!window.Tesseract){st.textContent='OCR library unavailable. You can still enter the receipt details manually.';return}
  try{const result=await mgwReadReceiptFile(file,{status:t=>{st.textContent=t}}),f=document.querySelector('#expenseForm');for(const [k,v] of Object.entries(result.values)){if(v!==''&&f.elements[k])f.elements[k].value=v}if(f.elements.category&&!f.elements.category.value&&result.suggestion?.category&&result.suggestion.confidence>=80){const o=[...f.elements.category.options].find(x=>x.value===result.suggestion.category);if(o)f.elements.category.value=result.suggestion.category}if(f.elements.notes){const bits=[];if(result.amountEvidence)bits.push(`OCR amount source: ${result.amountEvidence}`);if(result.values.paymentMethod)bits.push(`Payment: ${result.values.paymentMethod}${result.values.cardLast4?` ••••${result.values.cardLast4}`:''}`);f.elements.notes.value=[f.elements.notes.value,...bits].filter(Boolean).join('\n')}st.innerHTML=`<b>Receipt read — review before saving.</b><br><small>${mgwOCRSummary(result)}</small>`}catch(err){st.textContent='Could not read this receipt automatically. Try a flatter, brighter photo or enter the details manually.'}
}

window.MGWReceiptOCR={version:MGW_OCR_RELEASE.appVersion,preprocess:mgwPreprocessReceipt,parse:mgwParseReceiptSmart,readFile:mgwReadReceiptFile,merge:mgwMergeReceiptResults,score:mgwReceiptScore};
