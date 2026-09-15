// MoneyGoWhere DEV — iPhone/PWA bottom navigation dock.
(()=>{'use strict';
const RELEASE='1.5.5-dev.38';
function install(){if(document.querySelector('#mgwMobileNavDockCss'))return;const s=document.createElement('style');s.id='mgwMobileNavDockCss';s.textContent=`
.app-shell{padding-bottom:calc(96px + env(safe-area-inset-bottom))!important}
.bottom-nav{position:fixed!important;left:0!important;right:0!important;bottom:0!important;transform:none!important;margin:0 auto!important;width:min(100%,1100px)!important;border-radius:22px 22px 0 0!important;padding:8px max(12px,env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left))!important;box-sizing:border-box!important}
@media(min-width:760px){.app-shell{padding-bottom:110px!important}.bottom-nav{left:50%!important;right:auto!important;bottom:12px!important;transform:translateX(-50%)!important;width:min(calc(100% - 40px),720px)!important;border-radius:24px!important;padding:8px!important}}
`;document.head.appendChild(s)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();window.MGWMobileNavFix={version:RELEASE};
})();