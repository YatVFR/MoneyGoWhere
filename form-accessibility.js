// Associate dynamically created form labels without changing entered values.
(()=>{'use strict';let serial=0,queued=false;
function refresh(){for(const label of document.querySelectorAll('form label')){if(label.htmlFor)continue;const field=label.closest('.field'),control=label.querySelector('input,select,textarea')||field?.querySelector('input:not([type="hidden"]),select,textarea');if(!control)continue;if(!control.id)control.id='mgw-field-'+(++serial);label.htmlFor=control.id}}
function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh()})}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.MGWFormAccessibility={refresh};refresh();
})();
