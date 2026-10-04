// Lazy pinned OCR/PDF dependencies, one reusable OCR worker and a serialized queue.
(()=>{'use strict';
const OCR_VERSION='7.0.0',PDF_VERSION='6.4.299';
const BASE='https://cdn.jsdelivr.net/npm/';
const OCR_SCRIPT='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
const OCR_WORKER='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js';
let library=null,worker=null,workerLoading=null,tail=Promise.resolve(),progress=null,pdfLoading=null;
function ensureTesseract(){
 if(window.Tesseract&&library)return Promise.resolve(window.Tesseract);if(library)return library;
 library=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=OCR_SCRIPT;s.async=true;s.dataset.mgwTesseract=OCR_VERSION;s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('Receipt reader unavailable'));s.onerror=()=>{s.remove();reject(Error('Could not load the receipt reader. Check your connection or enter details manually.'))};document.head.appendChild(s)}).catch(err=>{library=null;throw err});return library;
}
async function ensureWorker(){if(worker)return worker;if(workerLoading)return workerLoading;
 workerLoading=(async()=>{const t=await ensureTesseract();const w=await t.createWorker('eng',1,{workerPath:OCR_WORKER,corePath:BASE+'tesseract.js-core@7.0.0',logger:m=>{if(progress)progress(m.status==='recognizing text'?'Reading receipt '+Math.round((m.progress||0)*100)+'%':'Preparing receipt reader…')}});worker=w;return w})().finally(()=>{workerLoading=null});return workerLoading;
}
function recognize(source,{status}={}){const job=async()=>{progress=status||null;try{const w=await ensureWorker();return await w.recognize(source)}catch(err){if(worker){const bad=worker;worker=null;try{await bad.terminate()}catch{}}throw err}finally{progress=null}};const result=tail.then(job);tail=result.catch(()=>{});return result}
function ensurePDF(){if(pdfLoading)return pdfLoading;pdfLoading=import(BASE+'pdfjs-dist@'+PDF_VERSION+'/legacy/build/pdf.min.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc=BASE+'pdfjs-dist@'+PDF_VERSION+'/legacy/build/pdf.worker.min.mjs';return lib}).catch(err=>{pdfLoading=null;throw Error('Could not load the PDF reader. Check your connection and try again.')});return pdfLoading}
window.MGWOCRRuntime={version:window.MGW_RELEASE?.appVersion||'dev',ocrVersion:OCR_VERSION,pdfVersion:PDF_VERSION,ensureTesseract,ensurePDF,recognize,pdfAssetBase:BASE+'pdfjs-dist@'+PDF_VERSION+'/'};
})();
