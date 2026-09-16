// MoneyGoWhere feature v1.5.5-dev.10 — navigation and grouped-card UI only.
// Global app version identity and Purchase History are owned by newer runtime modules.
(()=>{
'use strict';
const RELEASE='1.5.5-dev.10';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
const norm=v=>String(v||'').replace(/^[^A-Za-z0-9]+/,'').trim().replace(/\s+/g,' ').toUpperCase();
let refreshQueued=false;

function installStyles(){
  if(document.querySelector('#mgwUiHistoryStyles'))return;
  const s=document.createElement('style');s.id='mgwUiHistoryStyles';s.textContent=`
    .mgw-duplicate-card-group{border:1px solid var(--border,#dbe4e4);border-radius:14px;overflow:hidden;background:var(--card,#fff)}
    .mgw-duplicate-card-group>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 14px;background:rgba(18,130,119,.045)}
    .mgw-duplicate-card-group>summary::-webkit-details-marker{display:none}
    .mgw-duplicate-card-body{display:grid;gap:8px;padding:8px}
    .mgw-duplicate-card-body>.mgw-account{margin:0}
    .mgw-parent-copy b,.mgw-parent-copy small{display:block;min-width:0}.mgw-parent-copy small{opacity:.65;margin-top:2px}
    .mgw-parent-right{display:flex;align-items:center;gap:9px;white-space:nowrap;text-align:right}.mgw-parent-right strong{display:block}
    .mgw-ui-chevron{display:inline-block;font-size:1.15rem;line-height:1;transition:transform .18s ease;opacity:.65}
    details[open]>summary .mgw-ui-chevron{transform:rotate(90deg)}
    @media(max-width:520px){.mgw-parent-right strong{font-size:.92rem}.mgw-duplicate-card-group>summary{padding:11px 12px}}
  `;document.head.appendChild(s)
}

function installNavigation(){
  const bar=document.querySelector('.bottom-nav');if(!bar)return;
  const desired=['add','dashboard','insights','settings'];
  const labels={add:['＋','Add New'],dashboard:['⌂','Dashboards'],insights:['▥','Insights'],settings:['⚙','Settings']};
  desired.forEach(name=>{const b=bar.querySelector(`[data-nav="${name}"]`);if(!b)return;const [icon,label]=labels[name];const span=b.querySelector('span'),small=b.querySelector('small');if(span)span.textContent=icon;if(small)small.textContent=label;bar.appendChild(b)});
  if(typeof nav==='function'&&!nav.__mgwUiNav){
    const base=nav;
    const wrapped=function(name){base(name);const t=document.querySelector('#pageTitle');if(t)t.textContent={add:'Add New',dashboard:'Dashboards',insights:'Insights',settings:'Settings'}[name]||t.textContent};
    wrapped.__mgwUiNav=true;nav=wrapped;
  }
}

function cardAccountName(node){
  const b=node.querySelector('.mgw-account-summary b,.mgw-account-head b');return norm(b?.textContent||'');
}
function groupDuplicateCards(){
  const host=document.querySelector('#mgwAccountsDashboard .mgw-account-grid');if(!host)return;
  host.querySelectorAll(':scope > .mgw-duplicate-card-group').forEach(g=>{const body=g.querySelector('.mgw-duplicate-card-body');if(body)while(body.firstChild)host.insertBefore(body.firstChild,g);g.remove()});
  const modelGroups=new Map();
  (db?.creditAccounts||[]).forEach(a=>{const k=norm(a.name);if(!k)return;if(!modelGroups.has(k))modelGroups.set(k,[]);modelGroups.get(k).push(a)});
  for(const [key,models] of modelGroups){
    if(models.length<2)continue;
    const nodes=[...host.querySelectorAll(':scope > .mgw-account')].filter(n=>cardAccountName(n)===key);if(nodes.length<2)continue;
    const name=models[0].name||key,total=models.reduce((t,a)=>t+num(a.outstanding),0);
    const details=document.createElement('details');details.className='mgw-duplicate-card-group';
    details.innerHTML=`<summary><div class="mgw-parent-copy"><b>💳 ${esc(name)}</b><small>${nodes.length} card entries grouped</small></div><div class="mgw-parent-right"><strong>${money(total)}</strong><i class="mgw-ui-chevron">›</i></div></summary><div class="mgw-duplicate-card-body"></div>`;
    host.insertBefore(details,nodes[0]);const body=details.querySelector('.mgw-duplicate-card-body');nodes.forEach(n=>body.appendChild(n));
  }
}
function queueRefresh(){
  if(refreshQueued)return;refreshQueued=true;
  queueMicrotask(()=>{refreshQueued=false;installNavigation();groupDuplicateCards()});
}
function boot(){
  installStyles();installNavigation();
  if(typeof renderAll==='function'&&!renderAll.__mgwUiHistory){const base=renderAll;const wrapped=function(){base();queueRefresh()};wrapped.__mgwUiHistory=true;renderAll=wrapped}
  queueRefresh();
  window.addEventListener('mgw:accounts-changed',queueRefresh);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWUiHistory={version:RELEASE,refresh:queueRefresh};
})();