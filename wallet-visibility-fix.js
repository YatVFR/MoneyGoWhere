// MoneyGoWhere DEV — keep wallet/debit account UI synchronized after add/edit/delete.
(()=>{'use strict';
const RELEASE=window.MGW_RELEASE?.appVersion||'dev';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Math.max(0,Number(v)||0);
const TYPES={credit:'Credit Card',debit:'Debit Card',wallet:'Multi-Currency / Travel Wallet',prepaid:'Prepaid / Stored Value',other:'Other'};
const displayName=a=>a?.nickname||a?.name||a?.cardProduct||'Card / Wallet';
const moneyText=v=>typeof money==='function'?money(num(v)):`${num(v).toFixed(2)}`;
function walletCard(a){return `<div class="mgw-account"><div class="mgw-account-head"><div><b>💼 ${esc(displayName(a))}</b><small>${esc(a.issuer||'')} · ${esc(a.cardProduct||'')}</small></div><strong>${a.balance===''||a.balance==null?'—':moneyText(a.balance)}</strong></div><div class="mgw-mini"><div><small>Type</small><strong>${esc(TYPES[a.accountType]||'Wallet')}</strong></div><div><small>Base currency</small><strong>${esc(a.baseCurrency||'SGD')}</strong></div></div><div class="mgw-account-actions"><button data-wallet-edit="${esc(a.id||'')}">Edit</button></div></div>`}
function syncBlock(host,id,title){if(!host)return;let block=document.getElementById(id);const rows=Array.isArray(window.db?.walletAccounts)?window.db.walletAccounts:[];if(!rows.length){block?.remove();return}if(!block){block=document.createElement('div');block.id=id;host.appendChild(block)}block.innerHTML=`<p class="mgw-muted"><b>${title}</b>${id==='mgwWalletAccountsBlock'?' · excluded from credit debt/utilisation':''}</p>${rows.map(walletCard).join('')}`}
function sync(){syncBlock(document.querySelector('#mgwCreditSettings .mgw-account-grid'),'mgwWalletAccountsBlock','Debit Cards & Wallets');syncBlock(document.querySelector('#mgwAccountsDashboard .mgw-account-grid'),'mgwWalletDashboardBlock','Wallets & Debit')}
function schedule(){requestAnimationFrame?requestAnimationFrame(sync):setTimeout(sync,0)}
document.addEventListener('mgw:accounts-changed',schedule);
document.addEventListener('mgw:data-ready',schedule);
document.addEventListener('mgw:app-ready',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.MGWWalletVisibility={version:RELEASE,refresh:sync};
})();