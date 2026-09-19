// MoneyGoWhere DEV — first-launch helping bubbles
(()=>{'use strict';
const RELEASE='1.5.5-dev.52';let step=0,root=null,activeTarget=null;
const steps=[
 {sel:'#mgwCycleFocus',title:'Your current cycle',text:'MoneyGoWhere now starts with the active pay cycle, so the numbers you see belong to one clear period.'},
 {sel:'.metric-grid',title:'Three numbers first',text:'Income, Spent and Left are the main figures. Extra detail stays out of the way until you need it.'},
 {sel:'[data-nav="add"]',title:'Add transactions and recurring data',text:'Use Add New for expenses, receipts, income, recurring salary and recurring commitments.'},
 {sel:'[data-nav="insights"]',title:'Understand the pattern',text:'Insights shows spending, salary progression and bonus history without changing your data.'},
 {sel:'#refreshBtn',title:'Refresh safely',text:'Use Refresh to check for a newer app build and load it when one is available.'},
 {sel:'[data-nav="settings"]',title:'Backups and settings',text:'Back up your local database regularly. Settings also lets you manage recurring bills and replay this walkthrough.'}
];
function ensure(){db.settings=db.settings||{};db.settings.walkthrough=db.settings.walkthrough||{}}
function save(){localStorage.setItem(MGW.key,JSON.stringify(db))}
function css(){if(document.querySelector('#mgwWalkCss'))return;const s=document.createElement('style');s.id='mgwWalkCss';s.textContent=`
.mgw-walk-mask{position:fixed;inset:0;z-index:120;background:rgba(9,18,17,.48);pointer-events:none}.mgw-walk-bubble{position:fixed;z-index:122;width:min(310px,calc(100vw - 28px));background:#fff;border-radius:18px;padding:15px;box-shadow:0 18px 50px rgba(0,0,0,.24)}.mgw-walk-bubble b{display:block;font-size:1rem}.mgw-walk-bubble p{margin:6px 0 0;color:var(--muted,#6b7774);font-size:.9rem}.mgw-walk-actions{display:flex;gap:7px;margin-top:13px}.mgw-walk-actions button{flex:1;padding:9px 10px;border:0;border-radius:11px;font-weight:800}.mgw-walk-next{background:var(--brand,#0f766e);color:#fff}.mgw-walk-skip,.mgw-walk-back{background:#eef4f2;color:var(--text,#17201f)}.mgw-walk-count{font-size:.72rem;color:var(--muted,#6b7774);margin-bottom:5px}.mgw-walk-highlight{position:relative!important;z-index:121!important;outline:4px solid rgba(255,255,255,.96)!important;box-shadow:0 0 0 8px rgba(15,118,110,.28)!important;border-radius:16px!important}.mgw-walk-help{margin-top:10px}
`;document.head.appendChild(s)}
function clearTarget(){activeTarget?.classList.remove('mgw-walk-highlight');activeTarget=null}
function finish(skipped=false){clearTarget();root?.remove();document.querySelector('.mgw-walk-mask')?.remove();root=null;ensure();db.settings.walkthrough={completed:true,completedAt:new Date().toISOString(),skipped:Boolean(skipped),version:RELEASE};save()}
function pos(target,bubble){const r=target.getBoundingClientRect(),pad=10,bw=bubble.offsetWidth,bh=bubble.offsetHeight;let left=Math.max(14,Math.min(window.innerWidth-bw-14,r.left+r.width/2-bw/2));let top=r.bottom+pad;if(top+bh>window.innerHeight-14)top=Math.max(14,r.top-bh-pad);bubble.style.left=`${left}px`;bubble.style.top=`${top}px`}
function show(i){clearTarget();step=i;if(step<0)step=0;if(step>=steps.length){finish(false);return}const x=steps[step],target=document.querySelector(x.sel);if(!target){show(step+1);return}target.scrollIntoView({block:'center',behavior:'smooth'});setTimeout(()=>{activeTarget=target;target.classList.add('mgw-walk-highlight');if(!document.querySelector('.mgw-walk-mask')){const m=document.createElement('div');m.className='mgw-walk-mask';document.body.appendChild(m)}if(!root){root=document.createElement('div');root.className='mgw-walk-bubble';document.body.appendChild(root)}root.innerHTML=`<div class="mgw-walk-count">Quick tour · ${step+1}/${steps.length}</div><b>${x.title}</b><p>${x.text}</p><div class="mgw-walk-actions">${step?'<button class="mgw-walk-back">Back</button>':'<button class="mgw-walk-skip">Skip</button>'}<button class="mgw-walk-next">${step===steps.length-1?'Done':'Next'}</button></div>`;root.querySelector('.mgw-walk-back')?.addEventListener('click',()=>show(step-1));root.querySelector('.mgw-walk-skip')?.addEventListener('click',()=>finish(true));root.querySelector('.mgw-walk-next').addEventListener('click',()=>show(step+1));pos(target,root)},260)}
function installReplay(){const view=document.querySelector('#view-settings');if(!view||document.querySelector('#mgwWalkSettings'))return;const card=document.createElement('article');card.className='card';card.id='mgwWalkSettings';card.innerHTML='<div class="card-head"><div><span class="section-icon">💬</span><b>App Walk-through</b></div></div><p class="privacy-note" style="padding:0 0 10px">Replay the helping bubbles for the main MoneyGoWhere controls.</p><button class="secondary-btn" id="mgwReplayWalk">Replay walk-through</button>';view.insertBefore(card,view.querySelector('.privacy-note')||null);card.querySelector('#mgwReplayWalk').addEventListener('click',()=>{if(typeof nav==='function')nav('dashboard');setTimeout(()=>show(0),150)})}
function maybeStart(){
  ensure();installReplay();if(db.settings.walkthrough.completed)return;
  const wait=()=>{
    const onboarding=document.querySelector('#mgwOnboarding');
    // Optional feature prompts must never block the application from launching.
    const startupPending=window.MGWStartupSyncDone!==true||window.MGWStartupImportDone!==true;
    const blocking=[...document.querySelectorAll('dialog[open]')].length>0;
    if(onboarding||startupPending||blocking){setTimeout(wait,250);return}
    if(typeof nav==='function')nav('dashboard');setTimeout(()=>show(0),350);
  };
  setTimeout(wait,500);
}
function boot(){css();maybeStart();if(typeof renderAll==='function'&&!renderAll.__mgwWalk){const base=renderAll;renderAll=function(){base();queueMicrotask(installReplay)};renderAll.__mgwWalk=true}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.MGWGuidedWalkthrough={version:RELEASE,start:()=>show(0)};})();
