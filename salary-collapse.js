// MoneyGoWhere DEV — collapsible salary and bonus sections
(()=>{
'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const KEY_SALARY='mgw-salary-expanded';
const KEY_BONUS='mgw-bonus-expanded';

function installStyles(){
  if(document.querySelector('#mgwSalaryCollapseStyles'))return;
  const s=document.createElement('style');
  s.id='mgwSalaryCollapseStyles';
  s.textContent=`
    .mgw-income-collapse{border:1px solid var(--line,#e4e9e7);border-radius:16px;overflow:hidden;background:rgba(255,255,255,.72);margin-top:10px}
    .mgw-income-collapse>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:13px 14px;-webkit-tap-highlight-color:transparent}
    .mgw-income-collapse>summary::-webkit-details-marker{display:none}
    .mgw-income-collapse-title{display:flex;align-items:center;gap:9px;min-width:0}
    .mgw-income-collapse-title b,.mgw-income-collapse-title small{display:block}.mgw-income-collapse-title small{opacity:.62;margin-top:2px}
    .mgw-income-collapse-chevron{font-size:1.2rem;line-height:1;opacity:.62;transition:transform .18s ease}
    .mgw-income-collapse[open]>summary .mgw-income-collapse-chevron{transform:rotate(90deg)}
    .mgw-income-collapse-body{padding:2px 14px 14px;border-top:1px solid var(--line,#edf1f1)}
    .mgw-income-collapse-body>.mgw-bonus-panel{margin-top:0;padding-top:0;border-top:0}
    .mgw-income-collapse-body #mgwSalaryProgression>.mgw-income-section-title,
    .mgw-income-collapse-body .mgw-bonus-panel>.mgw-income-section-title{display:none}
  `;
  document.head.appendChild(s);
}

function state(key, fallback=false){try{const v=sessionStorage.getItem(key);return v===null?fallback:v==='1'}catch(_){return fallback}}
function remember(el,key){el.addEventListener('toggle',()=>{try{sessionStorage.setItem(key,el.open?'1':'0')}catch(_){}})}

function wrap(target,id,key,icon,title,subtitle){
  if(!target||document.querySelector(`#${id}`))return;
  const details=document.createElement('details');
  details.id=id;
  details.className='mgw-income-collapse';
  details.open=state(key,false);
  details.innerHTML=`<summary><div class="mgw-income-collapse-title"><span>${icon}</span><div><b>${title}</b><small>${subtitle}</small></div></div><i class="mgw-income-collapse-chevron">›</i></summary><div class="mgw-income-collapse-body"></div>`;
  target.parentNode.insertBefore(details,target);
  details.querySelector('.mgw-income-collapse-body').appendChild(target);
  remember(details,key);
}

function ensure(){
  installStyles();
  wrap(document.querySelector('#salaryTrend'),'mgwSalaryCollapse',KEY_SALARY,'💼','Salary Progression','Base and net salary trends');
  wrap(document.querySelector('#bonusHistory'),'mgwBonusCollapse',KEY_BONUS,'🎁','Bonus History','Yearly bonus records');
}

function boot(){
  ensure();
  if(typeof renderAll==='function'&&!renderAll.__mgwSalaryCollapse){
    const base=renderAll;
    const wrapped=function(){base();queueMicrotask(ensure)};
    wrapped.__mgwSalaryCollapse=true;
    renderAll=wrapped;
  }
  setTimeout(ensure,100);
  setTimeout(ensure,600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWSalaryCollapse={version:RELEASE,ensure};
})();