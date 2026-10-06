(() => {
  if(globalThis.__SKSA_ATTENDANCE_BRIDGE__)return;globalThis.__SKSA_ATTENDANCE_BRIDGE__=true;
  const requestSource='SKSA_ATTENDANCE_WEBAPP',responseSource='SKSA_ATTENDANCE_EXTENSION';
  window.addEventListener('message',async event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.source!==requestSource||typeof event.data.id!=='string')return;
    const allowed=['GET_SETTINGS','START','GET_JOB','GET_DATA','CANCEL','OPEN_TAB'];if(!allowed.includes(event.data.type))return;
    try{
      const response=await chrome.runtime.sendMessage({scope:'SKSA_ATTENDANCE_BRIDGE',type:event.data.type,ic:event.data.ic,year:event.data.year});
      window.postMessage({source:responseSource,id:event.data.id,...response},location.origin);
    }catch{window.postMessage({source:responseSource,id:event.data.id,ok:false,error:'Extension perlu dimuat semula. Refresh webapp selepas reload extension.'},location.origin);}
  });
  chrome.runtime.onMessage.addListener(message=>{if(message.scope==='SKSA_ATTENDANCE_BRIDGE'&&message.type==='JOB_UPDATED')window.postMessage({source:responseSource,type:'JOB_UPDATED'},location.origin);});
  window.postMessage({source:responseSource,type:'READY'},location.origin);
})();
