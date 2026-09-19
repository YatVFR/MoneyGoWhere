// MoneyGoWhere DEV — focused current-cycle dashboard
// UI-only: reads local runtime data and never bundles personal finance records.
(()=>{'use strict';
const RELEASE='1.5.5-dev.24';
let initialized=false;
function cfg(){const p=db?.settings?.payCycle||{};return{mode:p.mode==='payday'?'payday':'calendar',day:Math.min(31,Math.max(1,Number(p.day)||25))}}
function activeAnchor(now=new Date()){const c=cfg();if(c.mode!=='payday')return new Date(now.getFullYear(),now.getMonth(),1);const m=now.getDate()<c.day?now.getMonth()-1:now.getMonth();return new Date(now.getFullYear(),m,1)}
function cycleText(){if(typeof mgwCycleLabel==='function')return mgwCycleLabel(MGW.state.month);return monthName(MGW.state.month)}
function installStyles(){if(document.querySelector('#mgwCycleFocusCss'))return;const s=document.createElement('style');s.id='mgwCycleFocusCss';s.textContent=`
.mgw-cycle-focus{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:-3px 0 12px;padding:10px 12px;border:1px solid var(--line,#e4e9e7);border-radius:16px;background:var(--brand-soft,#e8f5f2)}.mgw-cycle-focus b,.mgw-cycle-focus small{display:block}.mgw-cycle-focus small{color:var(--muted,#6b7774);margin-top:2px}.mgw-cycle-focus span{font-size:1.35rem}.metric-grid.mgw-focused{grid-template-columns:repeat(3,minmax(0,1fr))}.metric-grid.mgw-focused .metric small{display:none}.metric-grid.mgw-focused .metric strong{font-size:clamp(1.25rem,5vw,1.7rem)}.metric-grid.mgw-focused .metric:nth-child(4){display:none!important}.budget-card.mgw-budget-compact .budget-copy{font-size:.86rem}@media(max-width:520px){.metric-grid.mgw-focused{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.metric-grid.mgw-focused .metric{padding:12px 9px}.metric-grid.mgw-focused .metric span{font-size:.72rem}.metric-grid.mgw-focused .metric strong{font-size:1.08rem}.mgw-cycle-focus{padding:9px 10px}}
`;document.head.appendChild(s)}
function focus(){installStyles();const c=cfg();if(!initialized){initialized=true;MGW.state.month=activeAnchor(new Date())}
 const row=document.querySelector('.month-row');if(row&&!document.querySelector('#mgwCycleFocus')){const el=document.createElement('div');el.id='mgwCycleFocus';el.className='mgw-cycle-focus';row.insertAdjacentElement('afterend',el)}
 const focus=document.querySelector('#mgwCycleFocus');if(focus)focus.innerHTML=`<div><b>${c.mode==='payday'?'Current pay cycle':'Current month'}</b><small>${cycleText()} · showing this period only</small></div><span aria-hidden="true">📅</span>`;
 const grid=document.querySelector('.metric-grid');grid?.classList.add('mgw-focused');const labels=grid?.querySelectorAll('.metric>span');if(labels?.[0])labels[0].textContent='Income';if(labels?.[1])labels[1].textContent='Spent';if(labels?.[2])labels[2].textContent='Left';document.querySelector('.budget-card')?.classList.add('mgw-budget-compact');
 const month=document.querySelector('#monthLabel');if(month)month.setAttribute('aria-label',c.mode==='payday'?'Pay cycle':'Month');
}
function boot(){focus();if(typeof renderAll==='function'&&!renderAll.__mgwCycleFocus){const base=renderAll;renderAll=function(){base();queueMicrotask(focus)};renderAll.__mgwCycleFocus=true;if(typeof renderAll==='function')renderAll()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.MGWCycleFocus={version:RELEASE,activeAnchor,focus};})();