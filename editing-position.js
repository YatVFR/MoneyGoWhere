// Preserve the current editing context across recurring data refreshes.
(()=>{'use strict';
let revision=0,interaction=0;
const activeView=()=>document.querySelector('.view.active');
function key(node,root){
  if(node.id)return 'id:'+node.id;
  if(node.dataset.settingsSection)return 'settings:'+node.dataset.settingsSection;
  const owner=node.parentElement?.closest('[id]')||root;
  return `${owner.id}:${node.tagName}:${[...owner.querySelectorAll(node.tagName)].indexOf(node)}`;
}
function capture(){
  const root=activeView();if(!root||!['view-dashboard','view-settings'].includes(root.id))return null;
  return {view:root.id,interaction,x:window.scrollX||0,y:window.scrollY||0,
    details:[...root.querySelectorAll('details')].map(node=>({key:key(node,root),open:node.open})),
    scroll:[...root.querySelectorAll('[id],.mgw-collapse-body,.mgw-obligation-body')].filter(node=>node.scrollTop||node.scrollLeft).map(node=>({key:key(node,root),top:node.scrollTop,left:node.scrollLeft}))};
}
function restore(snapshot){
  const root=activeView();if(!snapshot||!root||root.id!==snapshot.view||interaction!==snapshot.interaction)return false;
  const details=new Map(snapshot.details.map(x=>[x.key,x.open]));
  for(const node of root.querySelectorAll('details')){const saved=details.get(key(node,root));if(saved!==undefined&&node.open!==saved)node.open=saved}
  const scroll=new Map(snapshot.scroll.map(x=>[x.key,x]));
  for(const node of root.querySelectorAll('[id],.mgw-collapse-body,.mgw-obligation-body')){const saved=scroll.get(key(node,root));if(saved){node.scrollTop=saved.top;node.scrollLeft=saved.left}}
  window.scrollTo({left:snapshot.x,top:snapshot.y,behavior:'auto'});return true;
}
function preserve(){
  const snapshot=capture(),job=++revision;if(!snapshot)return;
  // Render wrappers queue microtasks and frames; restore once now and again after them.
  queueMicrotask(()=>{if(job!==revision)return;restore(snapshot);requestAnimationFrame(()=>{if(job!==revision)return;restore(snapshot);requestAnimationFrame(()=>{if(job===revision)restore(snapshot)})})});
}
function cancel(){revision++;interaction++}
function boot(){
  document.addEventListener('mgw:recurring-changed',preserve,true);
  document.addEventListener('mgw:data-restored',cancel);
  for(const type of ['pointerdown','touchstart','wheel','keydown'])document.addEventListener(type,()=>{interaction++},{capture:true,passive:true});
}
window.MGWEditingPosition=Object.freeze({capture,restore,preserve,cancel});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
