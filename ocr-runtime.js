// MoneyGoWhere — lazy OCR runtime loader.
// Tesseract is fetched only when receipt OCR is actually requested, so a slow
// third-party CDN cannot block MoneyGoWhere startup.
(()=>{
  'use strict';
  const TESSERACT_URL='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  let loading=null;

  function ensureTesseract(){
    if(window.Tesseract)return Promise.resolve(window.Tesseract);
    if(loading)return loading;
    loading=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-mgw-tesseract]');
      if(existing){
        existing.addEventListener('load',()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library unavailable')),{once:true});
        existing.addEventListener('error',()=>reject(new Error('OCR library failed to load')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=TESSERACT_URL;
      s.async=true;
      s.dataset.mgwTesseract='1';
      s.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('OCR library unavailable'));
      s.onerror=()=>reject(new Error('OCR library failed to load'));
      document.head.appendChild(s);
    }).catch(err=>{loading=null;throw err});
    return loading;
  }

  if(window.MGWReceiptOCR?.readFile&&!window.MGWReceiptOCR.readFile.__mgwLazyOcr){
    const base=window.MGWReceiptOCR.readFile;
    const wrapped=async(...args)=>{await ensureTesseract();return base(...args)};
    wrapped.__mgwLazyOcr=true;
    window.MGWReceiptOCR.readFile=wrapped;
  }

  if(typeof scanReceipt==='function'&&!scanReceipt.__mgwLazyOcr){
    const base=scanReceipt;
    const wrapped=async e=>{
      const status=document.querySelector('#ocrStatus');
      try{if(status)status.textContent='Loading receipt reader…';await ensureTesseract();return base(e)}
      catch(err){if(status)status.textContent='OCR library could not be loaded. You can still enter the receipt details manually.';console.warn('MoneyGoWhere OCR load failed',err)}
    };
    wrapped.__mgwLazyOcr=true;
    scanReceipt=wrapped;
  }

  window.MGWOCRRuntime={version:window.MGW_RELEASE?.appVersion||'dev',ensureTesseract};
})();
