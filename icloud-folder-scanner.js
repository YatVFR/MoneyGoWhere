// MoneyGoWhere — manual iCloud folder scanners.
// Startup never blocks on a folder picker. iOS requires each folder selection
// to originate from a direct user gesture, so the native input covers the row.
(()=>{
'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const META_KEY='mgw-icloud-folder-scan-meta-v1',RECOVERY_KEY='mgw-pre-restore-recovery-v1';
const loadMeta=()=>{try{return JSON.parse(localStorage.getItem(META_KEY)||'{}')}catch{return{}}};
const saveMeta=x=>localStorage.setItem(META_KEY,JSON.stringify(x));
const niceTime=t=>{try{return new Date(t).toLocaleString('en-SG',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return''}};
const folderName=file=>{const p=String(file?.webkitRelativePath||'');return p.includes('/')?p.split('/')[0]:'Selected folder'};
const currentDb=()=>{try{return JSON.parse(localStorage.getItem(MGW.key)||'{}')}catch{return{}}};

function markStartupComplete(){
  const changed=window.MGWStartupSyncDone!==true;
  window.MGWStartupSyncDone=true;
  if(changed)document.dispatchEvent(new CustomEvent('mgw:startup-sync:done'));
}
function mark(kind,files,count,extra={}){const meta=loadMeta();meta[kind]={folder:folderName(files?.[0]),scannedAt:Date.now(),count:Number(count)||0,...extra};saveMeta(meta);refreshStatus()}
function statusText(kind){const m=loadMeta()[kind];if(!m)return'Not scanned yet';const count=kind==='apple'?` · ${Number(m.count)||0} found`:'';return `Last scan: ${m.folder||'Selected folder'} · ${niceTime(m.scannedAt)}${count}`}
function appleFileTypes(files){return [...files].filter(f=>/\.(txt|json)$/i.test(f.name)&&!/backup|moneygowhere-backup/i.test(f.name))}
async function appleCandidates(files){const out=[];for(const f of appleFileTypes(files)){try{const rows=window.MGWWalletFileInbox?.parseText?window.MGWWalletFileInbox.parseText(await f.text()):[];if(rows?.some(r=>String(r?.merchant||r?.vendor||'').trim()&&Number(String(r?.amount||r?.total||'').replace(/[^0-9.-]/g,''))>0))out.push(f)}catch{}}return out}
async function scanApple(files){const candidates=await appleCandidates(files);mark('apple',files,candidates.length);if(!candidates.length){toast?.('No Apple Pay transaction files found');return false}if(!confirm(`${candidates.length} Apple Pay transaction ${candidates.length===1?'file was':'files were'} found. Import to MoneyGoWhere now?`)){toast?.(`${candidates.length} Apple Pay transaction ${candidates.length===1?'file':'files'} ready`);return false}if(!window.MGWWalletFileInbox?.importFiles){toast?.('Apple Pay importer is not ready yet');return false}await window.MGWWalletFileInbox.importFiles(candidates);return true}
async function readBackup(file){if(!/\.json$/i.test(file.name))return null;try{const x=JSON.parse(await file.text());if(!Array.isArray(x.expenses)||!Array.isArray(x.income))return null;return x}catch{return null}}
async function findBackup(files){const candidates=[...files].filter(f=>/\.json$/i.test(f.name)).sort((a,b)=>(b.lastModified||0)-(a.lastModified||0));for(const f of candidates){const data=await readBackup(f);if(data)return{file:f,data}}return null}
function sig(x){const ex=Array.isArray(x?.expenses)?x.expenses:[],inc=Array.isArray(x?.income)?x.income:[];const last=[...ex,...inc].map(r=>`${r.date||''} ${r.time||''}`).sort().pop()||'';return`${ex.length}|${inc.length}|${last}`}
function summary(x){const ex=Array.isArray(x?.expenses)?x.expenses.length:0,inc=Array.isArray(x?.income)?x.income.length:0;return`${ex} expenses · ${inc} income records`}
function safeRestore(data,file){try{const local=currentDb();localStorage.setItem(RECOVERY_KEY,JSON.stringify({savedAt:Date.now(),data:local}));db=Object.assign(typeof emptyDB==='function'?emptyDB():{},data);window.db=db;localStorage.setItem(MGW.key,JSON.stringify(db));mark('backup',[file],1,{file:file.name,modified:file.lastModified||0});renderAll?.();toast?.('MoneyGoWhere database restored');return true}catch(err){console.error('MoneyGoWhere restore failed',err);toast?.('Database restore failed');return false}}
async function scanBackup(files){const found=await findBackup(files);mark('backup',files,found?1:0);if(!found){toast?.('No valid MoneyGoWhere database backup found');return false}const {file,data}=found,local=currentDb();if(sig(local)===sig(data)){toast?.('Local database already matches this backup');return true}const modified=file.lastModified?niceTime(file.lastModified):'date unavailable';const ok=confirm(`MoneyGoWhere backup found:\n\n${file.name}\nModified: ${modified}\nBackup: ${summary(data)}\nLocal: ${summary(local)}\n\nRestore this backup to this device?\n\nA local recovery snapshot will be kept before replacement.`);if(!ok){toast?.('Local database kept unchanged');return false}return safeRestore(data,file)}

function installCss(){if(document.querySelector('#mgwFolderScannerStyles'))return;const s=document.createElement('style');s.id='mgwFolderScannerStyles';s.textContent=`
.mgw-native-folder-row{position:relative!important;overflow:hidden!important}.mgw-native-folder-row>input[type="file"]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;opacity:0!important;cursor:pointer!important;z-index:3!important}.mgw-native-folder-row .mgw-settings-copy{min-width:0}.mgw-native-folder-row .mgw-settings-copy b,.mgw-native-folder-row .mgw-settings-copy small{display:block}.mgw-native-folder-row .mgw-scan-status{font-size:.72rem;opacity:.7;margin-top:3px}.mgw-wallet-folder-row{margin-top:10px;display:block;width:100%;text-align:center}
`;document.head.appendChild(s)}
function folderInput(id,onFiles){const input=document.createElement('input');input.id=id;input.type='file';input.multiple=true;input.setAttribute('webkitdirectory','');input.setAttribute('directory','');input.addEventListener('change',async()=>{const files=input.files;if(files?.length)await onFiles(files);input.value=''});return input}
function settingsRow({id,inputId,icon,title,subtitle,kind,onFiles}){const row=document.createElement('label');row.id=id;row.className='settings-button mgw-native-folder-row';row.innerHTML=`<span>${icon}</span><div class="mgw-settings-copy"><b>${title}</b><small>${subtitle}</small><small class="mgw-scan-status" data-mgw-scan-status="${kind}">${statusText(kind)}</small></div><i>›</i>`;row.appendChild(folderInput(inputId,onFiles));return row}
function installSettingsRows(){const list=document.querySelector('#view-settings .settings-list');if(!list)return false;let dbRow=document.querySelector('#mgwScanBackupFolder');if(!dbRow){dbRow=settingsRow({id:'mgwScanBackupFolder',inputId:'mgwBackupFolderInput',icon:'☁️',title:'Scan / Sync DB Folder',subtitle:'Compare the latest iCloud backup with local data',kind:'backup',onFiles:scanBackup});const restore=list.querySelector('#importInput')?.closest('label.settings-button');restore?.insertAdjacentElement('afterend',dbRow)||list.appendChild(dbRow)}if(!document.querySelector('#mgwScanApplePayFolderSettings')){const ap=settingsRow({id:'mgwScanApplePayFolderSettings',inputId:'mgwApplePayFolderSettingsInput',icon:'🍎',title:'Scan Apple Pay Folder',subtitle:'Check the iCloud inbox and queue new transactions',kind:'apple',onFiles:scanApple});dbRow.insertAdjacentElement('afterend',ap)}return true}
function installWalletRow(){const q=document.querySelector('#mgwWalletImportQueue');if(!q||q.querySelector('#mgwScanApplePayFolder'))return Boolean(q);const row=document.createElement('label');row.id='mgwScanApplePayFolder';row.className='secondary-btn mgw-native-folder-row mgw-wallet-folder-row';row.textContent='Scan Apple Pay Folder';row.appendChild(folderInput('mgwApplePayFolderInput',scanApple));q.appendChild(row);return true}
function refreshStatus(){document.querySelectorAll('[data-mgw-scan-status]').forEach(el=>{el.textContent=statusText(el.dataset.mgwScanStatus)})}
function install(){installCss();const settingsReady=installSettingsRows(),walletReady=installWalletRow();refreshStatus();return settingsReady&&walletReady}
function boot(){markStartupComplete();if(install())return;if(!window.MutationObserver)return;const observer=new MutationObserver(()=>{if(install())observer.disconnect()});observer.observe(document.body,{subtree:true,childList:true});setTimeout(()=>observer.disconnect(),15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.MGWICloudFolderScanner={version:RELEASE,scanApple,scanBackup,startupDone:()=>true};
})();
