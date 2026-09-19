// MoneyGoWhere DEV — standardized Settings rows for DB sync and Apple Pay folder scan
(()=>{'use strict';
const RELEASE='1.5.5-dev.34';
const META_KEY='mgw-icloud-folder-scan-meta-v1';
const loadMeta=()=>{try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return{}}};
const niceTime=t=>{try{return new Date(t).toLocaleString('en-SG',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return''}};
function statusText(kind){const m=loadMeta()[kind];if(!m)return 'Not scanned yet';const count=kind==='apple'&&Number.isFinite(Number(m.count))?` · ${Number(m.count)} found`:'';return `Last scan: ${m.folder||'Selected folder'} · ${niceTime(m.scannedAt)}${count}`}
function installCss(){if(document.querySelector('#mgwStandardSyncRowsCss'))return;const s=document.createElement('style');s.id='mgwStandardSyncRowsCss';s.textContent=`
.mgw-settings-scan-row{margin:0!important;padding:0!important}
.settings-list #mgwScanBackupFolder.settings-button,.settings-list #mgwScanApplePayFolderSettings.settings-button{display:grid!important;grid-template-columns:38px minmax(0,1fr) auto!important;gap:10px!important;align-items:center!important;text-align:left!important;width:100%!important;padding:15px 0!important;border:0!important;border-bottom:1px solid var(--line)!important;background:none!important;border-radius:0!important;color:inherit!important;box-shadow:none!important}
.mgw-settings-scan-copy{min-width:0;display:block!important}
.mgw-settings-scan-copy b{display:block;font-weight:800;color:var(--text)}
.mgw-settings-scan-copy>small{display:block!important;color:var(--muted)!important;margin:0!important;padding:0!important}
.mgw-settings-scan-status{font-size:.72rem!important;line-height:1.3!important;margin-top:4px!important;opacity:.72!important}
.mgw-settings-scan-row>.mgw-folder-note,.mgw-settings-scan-row>[data-mgw-scan-status="backup"]{display:none!important}
`;document.head.appendChild(s)}
function makeCopy(icon,title,subtitle,statusAttr,status){return `<span>${icon}</span><div class="mgw-settings-scan-copy"><b>${title}</b><small>${subtitle}</small><small class="mgw-settings-scan-status" ${statusAttr}>${status}</small></div><i>›</i>`}
function standardizeDb(){const wrap=document.querySelector('#mgwScanBackupFolder')?.closest('.mgw-folder-scan');if(!wrap)return;wrap.classList.add('mgw-settings-scan-row');wrap.style.cssText='';const btn=wrap.querySelector('#mgwScanBackupFolder');if(!btn)return;btn.className='settings-button';btn.style.cssText='';btn.innerHTML=makeCopy('☁️','Scan / Sync DB Folder','Compare the latest iCloud backup with local data','data-mgw-db-inline-status',statusText('backup'));wrap.querySelector('.mgw-folder-note')?.remove()}
function addAppleRow(){const settings=document.querySelector('#view-settings .settings-list'),dbWrap=document.querySelector('#mgwScanBackupFolder')?.closest('.mgw-folder-scan'),input=document.querySelector('#mgwApplePayFolderInput');if(!settings||!dbWrap||!input)return;let wrap=document.querySelector('#mgwApplePaySettingsScan');if(!wrap){wrap=document.createElement('div');wrap.id='mgwApplePaySettingsScan';wrap.className='mgw-folder-scan mgw-settings-scan-row';wrap.innerHTML=`<button class="settings-button" id="mgwScanApplePayFolderSettings">${makeCopy('🍎','Scan Apple Pay Folder','Check the iCloud inbox and queue new transactions','data-mgw-apple-inline-status',statusText('apple'))}</button>`;dbWrap.insertAdjacentElement('afterend',wrap);wrap.querySelector('button').addEventListener('click',()=>input.click())}else{wrap.classList.add('mgw-settings-scan-row');const btn=wrap.querySelector('#mgwScanApplePayFolderSettings');if(btn){btn.className='settings-button';const status=btn.querySelector('[data-mgw-apple-inline-status]');if(status)status.textContent=statusText('apple')}}}
function refreshStatus(){const dbStatus=document.querySelector('[data-mgw-db-inline-status]');if(dbStatus)dbStatus.textContent=statusText('backup');const apStatus=document.querySelector('[data-mgw-apple-inline-status]');if(apStatus)apStatus.textContent=statusText('apple')}
function apply(){installCss();standardizeDb();addAppleRow();refreshStatus()}
function boot(){apply();window.addEventListener('focus',apply);document.addEventListener('visibilitychange',()=>{if(!document.hidden)apply()});let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}).observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWDbScanButton={version:RELEASE};
})();