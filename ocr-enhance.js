// MoneyGoWhere v1.5.0 — Smart Receipt OCR enhancement.
// Local-only image preprocessing + receipt-aware field extraction. No receipt image is uploaded.
const MGW_OCR_RELEASE=Object.freeze({appVersion:'1.5.0',schemaVersion:1,dataVersion:6,cacheVersion:'1.5.0'});

function mgwLoadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image load failed'))};
    img.src=url;
  });
}

async function mgwPreprocessReceipt(file){
  const img=await mgwLoadImage(file);
  const maxSide=2200,scale=Math.min(2,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  const w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,w,h);
  const data=ctx.getImageData(0,0,w,h),p=data.data;
  let min=255,max=0;
  for(let i=0;i<p.length;i+=4){const g=Math.round(.299*p[i]+.587*p[i+1]+.114*p[i+2]);if(g<min)min=g;if(g>max)max=g;p[i]=p[i+1]=p[i+2]=g;}
  const span=Math.max(40,max-min),low=Math.max(0,min-8),contrast=1.12;
  for(let i=0;i<p.length;i+=4){let g=(p[i]-low)*255/span;g=(g-128)*contrast+128;g=Math.max(0,Math.min(255,g));p[i]=p[i+1]=p[i+2]=g;}
  ctx.putImageData(data,0,0);
  return canvas;
}

function mgwReceiptLines(text){return String(text||'').replace(/\r/g,'\n').split(/\n+/).map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean)}
function mgwAmountFromLine(line){
  const vals=[...String(line).matchAll(/(?:S?\$\s*)?(-?\d{1,3}(?:,\d{3})*|\d+)[.,](\d{2})\b/g)]
    .map(m=>Number(`${m[1].replace(/,/g,'')}.${m[2]}`)).filter(Number.isFinite);
  return vals.length?vals[vals.length-1]:null;
}
function mgwExtractAmount(lines){
  const rules=[
    [/total amount payable|amount payable|amount paid|payment received|paid amount|net amount|nett amount/i,120],
    [/grand total|total due|balance due/i,105],
    [/\btotal\b/i,85],
    [/subtotal|sub-total/i,25]
  ];
  const candidates=[];
  lines.forEach((line,i)=>{
    const val=mgwAmountFromLine(line);if(val===null||val<0)return;
    if(/subsid|discount|saving|rounding|refund|change|outstanding balance/i.test(line))return;
    let score=0;
    for(const [re,s] of rules)if(re.test(line))score=Math.max(score,s);
    if(score)candidates.push({value:val,score:score+i/100,line});
  });
  if(candidates.length){candidates.sort((a,b)=>b.score-a.score);return {amount:candidates[0].value,confidence:Math.min(99,88+Math.floor(candidates[0].score/20)),evidence:candidates[0].line}}
  const fallback=[];lines.forEach(line=>{const v=mgwAmountFromLine(line);if(v!==null&&v>0)fallback.push(v)});
  return fallback.length?{amount:fallback[fallback.length-1],confidence:55,evidence:'last monetary value'}:{amount:null,confidence:0,evidence:''};
}

function mgwExtractDate(text){
  let m=String(text).match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if(m){let y=m[3].length===2?'20'+m[3]:m[3];return {value:`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`,confidence:96}}
  m=String(text).match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i);
  if(m){const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'],mi=months.findIndex(x=>m[2].toLowerCase().startsWith(x));return {value:`${m[3]}-${String(mi+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`,confidence:94}}
  return {value:'',confidence:0};
}
function mgwExtractTime(text){const m=String(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(AM|PM))?\b/i);if(!m)return {value:'',confidence:0};let h=Number(m[1]);if(m[3]){const pm=m[3].toUpperCase()==='PM';if(pm&&h<12)h+=12;if(!pm&&h===12)h=0;}return {value:`${String(h).padStart(2,'0')}:${m[2]}`,confidence:92}}
function mgwExtractVendor(lines){
  const reject=/tax invoice|invoice no|receipt|gst reg|co reg|company reg|date\b|patient|attending|description|qty|sell price|subtotal|amount payable|payment received|thank you/i;
  const address=/\b(road|rd\b|street|st\b|avenue|ave\b|drive|dr\b|lane|ln\b|singapore|#\d|tel\b|fax\b|uen\b)/i;
  const candidates=lines.slice(0,14).filter(x=>/[A-Za-z]{3}/.test(x)&&x.length>=3&&x.length<=70&&!reject.test(x)&&!address.test(x)).map((line,i)=>{
    let score=70-i*2;if(/[A-Z]{3}/.test(line))score+=5;if(/clinic|medical|restaurant|mart|market|store|shop|services|pte|ltd|llp|pharmacy|cafe|company/i.test(line))score+=12;return {line,score};
  }).sort((a,b)=>b.score-a.score);
  return candidates.length?{value:candidates[0].line,confidence:Math.min(96,candidates[0].score)}:{value:'',confidence:0};
}
function mgwExtractLocation(lines,vendor){
  const idx=lines.findIndex(x=>x===vendor),pool=lines.slice(idx>=0?idx+1:0,Math.min(lines.length,18));
  const hits=pool.filter(x=>/(road|rd\b|street|st\b|avenue|ave\b|drive|mall|plaza|centre|center|singapore\s*\d{6}|#\d{1,3}-\d{1,3})/i.test(x)&&!/gst|invoice|receipt/i.test(x));
  return hits.length?{value:hits.slice(0,2).join(', '),confidence:hits.length>1?88:76}:{value:'',confidence:0};
}

function mgwParseReceiptSmart(text,ocrConfidence=0){
  const lines=mgwReceiptLines(text),vendor=mgwExtractVendor(lines),date=mgwExtractDate(text),time=mgwExtractTime(text),amount=mgwExtractAmount(lines),location=mgwExtractLocation(lines,vendor.value);
  const suggestion=typeof mgwSuggestCategory==='function'?mgwSuggestCategory(vendor.value,text):{category:'',confidence:0,reason:'needs review'};
  return {
    values:{vendor:vendor.value,date:date.value,time:time.value,amount:amount.amount!==null?amount.amount.toFixed(2):'',location:location.value,category:suggestion.confidence>=90?suggestion.category:''},
    confidence:{ocr:Math.round(ocrConfidence||0),vendor:vendor.confidence,date:date.confidence,time:time.confidence,amount:amount.confidence,location:location.confidence,category:suggestion.confidence||0},
    suggestion,amountEvidence:amount.evidence,rawText:text
  };
}

function mgwConfidenceMark(v){return v>=90?'✓':v>=70?'~':'!'}
function mgwOCRSummary(result){
  const c=result.confidence,s=result.suggestion;
  const parts=[`OCR ${c.ocr}%`,`Vendor ${c.vendor}% ${mgwConfidenceMark(c.vendor)}`,`Date ${c.date}% ${mgwConfidenceMark(c.date)}`,`Amount ${c.amount}% ${mgwConfidenceMark(c.amount)}`];
  if(result.values.location)parts.push(`Location ${c.location}% ${mgwConfidenceMark(c.location)}`);
  if(s?.category)parts.push(`${s.category} ${s.confidence}%`);
  return parts.join(' · ');
}

async function scanReceipt(e){
  const file=e.target.files[0];if(!file)return;
  const img=document.querySelector('#receiptPreview'),st=document.querySelector('#ocrStatus');
  img.src=URL.createObjectURL(file);img.classList.remove('hidden');
  if(!window.Tesseract){st.textContent='OCR library unavailable. You can still enter the receipt details manually.';return}
  try{
    st.textContent='1/4 Preparing image…';
    const enhanced=await mgwPreprocessReceipt(file);
    st.textContent='2/4 Reading enhanced image…';
    let first=await Tesseract.recognize(enhanced,'eng',{logger:m=>{if(m.status==='recognizing text')st.textContent=`2/4 Reading enhanced image… ${Math.round((m.progress||0)*100)}%`}});
    let chosen=first,result=mgwParseReceiptSmart(first.data.text,first.data.confidence);
    const weak=result.confidence.ocr<68||result.confidence.amount<70||result.confidence.vendor<60;
    if(weak){
      st.textContent='3/4 Cross-checking original image…';
      const second=await Tesseract.recognize(file,'eng',{logger:m=>{if(m.status==='recognizing text')st.textContent=`3/4 Cross-checking original image… ${Math.round((m.progress||0)*100)}%`}});
      const secondParsed=mgwParseReceiptSmart(second.data.text,second.data.confidence);
      const score=r=>r.confidence.ocr+r.confidence.vendor+r.confidence.date+r.confidence.amount+r.confidence.location;
      if(score(secondParsed)>score(result)){chosen=second;result=secondParsed;}
    }
    st.textContent='4/4 Validating fields…';
    const f=document.querySelector('#expenseForm');
    Object.entries(result.values).forEach(([k,v])=>{if(v&&f.elements[k])f.elements[k].value=v});
    if(f.elements.category&&!f.elements.category.value&&result.suggestion?.category&&result.suggestion.confidence>=80){
      // Keep medium-confidence categories visible to the user without auto-saving anything.
      const option=[...f.elements.category.options].find(o=>o.value===result.suggestion.category);if(option)f.elements.category.value=result.suggestion.category;
    }
    if(f.elements.notes){
      const evidence=result.amountEvidence?`OCR amount source: ${result.amountEvidence}`:'';
      f.elements.notes.value=[f.elements.notes.value,evidence].filter(Boolean).join('\n');
    }
    st.innerHTML=`<b>Receipt read — review before saving.</b><br><small>${mgwOCRSummary(result)}</small>`;
  }catch(err){st.textContent='Could not read this receipt automatically. Try a flatter, brighter photo or enter the details manually.'}
}

// Keep the visible release marker aligned with this feature preview.
document.addEventListener('DOMContentLoaded',()=>{
  const badge=document.querySelector('#appVersionBadge');
  if(badge){badge.textContent=`v${MGW_OCR_RELEASE.appVersion}`;badge.title=`App ${MGW_OCR_RELEASE.appVersion} · Schema ${MGW_OCR_RELEASE.schemaVersion} · Data ${MGW_OCR_RELEASE.dataVersion}`;}
});
