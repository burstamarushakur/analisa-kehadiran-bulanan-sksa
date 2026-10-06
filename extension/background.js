import {normalizeIc,normalizeReport,validateRecord,mergeRecords,MONTHS} from './core.js';
import {savePassword,getPassword,clearPassword} from './vault.js';
const ATTENDANCE='https://moeispel.moe.gov.my/sahsiah/kehadiran/tabguru';
const running=new Set();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
const read=async key=>(await chrome.storage.local.get(key))[key];
const write=async(key,value)=>chrome.storage.local.set({[key]:value});
function originOf(value){try{return new URL(value).origin;}catch{return '';}}
function originPattern(origin){const url=new URL(origin);return `${url.protocol}//${url.hostname}/*`;}
function appOrigin(value){if(!value)return '';const url=new URL(value);if(url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Gunakan pautan webapp HTTPS. localhost dibenarkan untuk ujian.');return url.origin;}
async function bridgeRegistration(settings){
  await chrome.scripting.unregisterContentScripts({ids:['sksa-attendance-webapp']}).catch(()=>{});
  if(!settings.webappOrigin)return;
  const pattern=originPattern(settings.webappOrigin);
  if(!await chrome.permissions.contains({origins:[pattern]}))throw new Error('Kebenaran untuk pautan webapp belum diberikan. Tekan Simpan tetapan sekali lagi.');
  await chrome.scripting.registerContentScripts([{id:'sksa-attendance-webapp',matches:[pattern],js:['bridge.js'],runAt:'document_idle',persistAcrossSessions:true}]);
  const tabs=await chrome.tabs.query({url:pattern});
  for(const tab of tabs)if(originOf(tab.url)===settings.webappOrigin)await chrome.scripting.executeScript({target:{tabId:tab.id},files:['bridge.js']}).catch(()=>{});
}
async function settingsSave(message){
  const previous=await read('settings')||{},ic=normalizeIc(message.ic),webappOrigin=appOrigin(message.webappOrigin);
  if(previous.ic&&previous.ic!==ic)await clearPassword();
  if(message.rememberPassword&&message.password)await savePassword(ic,message.password);
  else if(!message.rememberPassword)await clearPassword();
  const settings={ic,webappOrigin,passwordSaved:Boolean(await getPassword(ic)),updatedAt:new Date().toISOString()};
  await bridgeRegistration(settings);const job=await read('job');if(job&&job.ic!==ic&&['running','waiting'].includes(job.status))await jobUpdate(job,{cancelled:true});await write('settings',settings);return settings;
}
async function publicSettings(){const settings=await read('settings')||{};return {ic:settings.ic||'',webappOrigin:settings.webappOrigin||'',passwordSaved:Boolean(settings.passwordSaved),version:'0.2.0'};}
async function jobUpdate(job,changes={}){const latest=await read('job');if(latest&&latest.id!==job.id)throw new Error('Penyegerakan ini telah diganti dengan sesi baharu.');if(latest?.id===job.id){if(latest.tabId&&latest.tabId!==job.tabId)job.tabId=latest.tabId;if(latest.cancelled)job.cancelled=true;}Object.assign(job,changes,{updatedAt:new Date().toISOString()});if(job.cancelled){job.status='cancelled';job.message='Penyegerakan dihentikan.';}await write('job',job);}
async function phase(job,value){await jobUpdate(job,{message:value});}
async function driver(tabId,type,fields={}){
  const response=await chrome.tabs.sendMessage(tabId,{scope:'SKSA_ATTENDANCE_DRIVER',type,...fields});
  if(!response?.ok)throw new Error(response?.error||'Extension belum dapat membaca tab IDME.');return response.result;
}
async function waitState(job){
  const started=Date.now();while(Date.now()-started<45000){
    if((await read('job'))?.cancelled)throw new Error('Penyegerakan dihentikan.');
    try{const latest=await read('job');if(latest?.id===job.id&&latest.tabId)job.tabId=latest.tabId;const tab=await chrome.tabs.get(job.tabId);if(tab.status==='complete'){const result=await driver(job.tabId,'STATE');if(result.kind!=='loading')return result;}}catch(error){if(/No tab|Invalid tab/i.test(error.message))throw new Error('Tab IDME ditutup. Mulakan penyegerakan semula.');}
    await delay(700);
  }throw new Error('Tab IDME belum selesai dimuatkan. Cuba semula selepas IDME boleh dibuka.');
}
async function authenticated(job,settings){
  const started=Date.now();let icSent=false,passwordSentAt=Number(job.passwordSubmittedAt)||0,moduleAttempted=false,directAttempted=false;
  while(Date.now()-started<110000){
    const current=await waitState(job);
    if(current.kind==='attendance')return true;
    if(current.kind==='blocked')throw new Error('IDME menolak akses. Buka tab IDME dan login seperti biasa; extension boleh menyambung selepas itu.');
    if(current.kind==='login-ic'){
      if(passwordSentAt)throw new Error('Login IDME tidak berjaya. Semak password dalam tetapan extension.');
      if(!await getPassword(settings.ic)){await jobUpdate(job,{status:'waiting',message:'Password IDME belum disimpan. Simpan dalam extension untuk auto login, atau login sendiri pada tab IDME.'});return false;}
      if(icSent){await delay(1000);continue;}
      await phase(job,'Memasukkan IC pada IDME…');icSent=true;await driver(job.tabId,'LOGIN_IC',{ic:settings.ic});await delay(1200);continue;
    }
    if(current.kind==='login-password'){
      if(passwordSentAt){if(Date.now()-passwordSentAt>10000)throw new Error('Login IDME belum berjaya selepas password dihantar. Buka tab IDME untuk semakan; extension tidak mengulang cubaan password.');await delay(900);continue;}
      const password=await getPassword(settings.ic);
      if(!password){await jobUpdate(job,{status:'waiting',message:'Login IDME pada tab yang dibuka, atau simpan password pada extension.'});return false;}
      passwordSentAt=Date.now();job.passwordSubmittedAt=passwordSentAt;await phase(job,'Menanda pengesahan dan login IDME…');await driver(job.tabId,'LOGIN_PASSWORD',{ic:settings.ic,password});await delay(1400);continue;
    }
    if(current.kind==='idme-home'){
      if(!moduleAttempted){moduleAttempted=true;await phase(job,'Membuka Modul Murid…');const result=await driver(job.tabId,'OPEN_MODULE');if(result.found){await delay(1800);continue;}}
      if(!directAttempted){directAttempted=true;await chrome.tabs.update(job.tabId,{url:ATTENDANCE});await delay(1400);continue;}
      await jobUpdate(job,{status:'waiting',message:'Login selesai. Buka Modul Murid / Kehadiran Guru Kelas pada tab IDME. Extension akan menyambung selepas halaman kehadiran muncul.'});return false;
    }
    await delay(800);
  }throw new Error('Login IDME mengambil terlalu lama. Semak tab IDME dan cuba semula.');
}
async function runJob(jobId){
  if(running.has(jobId))return;running.add(jobId);
  try{
    let job=await read('job');if(!job||job.id!==jobId||job.cancelled)return;
    const settings=await read('settings');if(!settings||settings.ic!==job.ic)throw new Error('Tetapan akaun berubah. Mulakan penyegerakan semula.');
    await jobUpdate(job,{status:'running'});
    if(!await authenticated(job,settings))return;
    await phase(job,'Membaca rumusan semua bulan…');
    const {tasks}=await driver(job.tabId,'OVERVIEW',{year:job.year});
    if(!tasks.length)throw new Error('Tiada bulan dengan data kehadiran ditemui dalam rumusan IDME.');
    const old=new Map((job.progress||[]).map(item=>[`${item.className}|${item.month}`,item]));
    job.progress=tasks.map(task=>({className:task.className,month:task.month,year:task.year,status:old.get(`${task.className}|${task.month}`)?.status==='done'?'done':'pending',studentCount:old.get(`${task.className}|${task.month}`)?.studentCount||0,message:''}));
    await jobUpdate(job,{total:tasks.length});
    for(const task of tasks){
      const latest=await read('job');if(latest.cancelled)throw new Error('Penyegerakan dihentikan.');
      const progress=job.progress.find(item=>item.className===task.className&&item.month===task.month);if(progress.status==='done')continue;
      progress.status='reading';await phase(job,`Mengambil ${MONTHS[task.month-1]} ${task.year} · ${task.className}…`);
      try{
        const raw=await driver(job.tabId,'SCRAPE',{task});
        const record=validateRecord(normalizeReport(raw,job.ic),job.ic);
        await write('records',mergeRecords(await read('records')||[],[record]));
        job.records=(job.records||[]).filter(item=>!(item.classKey===record.classKey&&item.month===record.month&&item.year===record.year));job.records.push(record);
        progress.status='done';progress.studentCount=record.students.length;progress.message=`${record.students.length} murid · ${record.summary.present}/${record.summary.possible}`;
      }catch(error){progress.status='failed';progress.message=String(error.message||'Bulan ini belum dapat dibaca.').slice(0,350);}
      await jobUpdate(job);
    }
    const done=job.progress.filter(item=>item.status==='done').length,failed=job.progress.filter(item=>item.status==='failed').length;
    await jobUpdate(job,{status:failed?'partial':'done',finishedAt:new Date().toISOString(),message:failed?`${done} bulan berjaya, ${failed} bulan belum berjaya. Semak senarai status.`:`Semua ${done} bulan berjaya diambil.`});
    if(job.webappTabId)await chrome.tabs.sendMessage(job.webappTabId,{scope:'SKSA_ATTENDANCE_BRIDGE',type:'JOB_UPDATED'}).catch(()=>{});
  }catch(error){const job=await read('job');if(job?.id===jobId)await jobUpdate(job,{status:job.cancelled?'cancelled':'failed',message:String(error.message||'Penyegerakan gagal.').slice(0,350),finishedAt:new Date().toISOString()});}
  finally{running.delete(jobId);}
}
async function start(message,sender){
  const settings=await read('settings');if(!settings?.ic)throw new Error('Simpan IC dan tetapan dalam extension terlebih dahulu.');
  const ic=normalizeIc(message.ic),year=Number(message.year);
  if(settings.ic!==ic)throw new Error('IC webapp berbeza daripada IC akaun extension. Kemaskini tetapan extension pada browser guru ini.');
  if(!Number.isInteger(year)||year<2020||year>2100)throw new Error('Tahun tidak sah.');
  const previous=await read('job');if(previous&&['running','waiting'].includes(previous.status)&&!previous.cancelled&&previous.ic===ic){if(previous.year!==year)throw new Error('Hentikan penyegerakan tahun sebelumnya sebelum memilih tahun lain.');runJob(previous.id);return {id:previous.id};}
  const job={id:crypto.randomUUID(),ic,year,status:'running',message:'Membuka IDME…',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),records:[],progress:[],total:0,tabId:null,webappTabId:sender.tab?.id||null,cancelled:false};
  const tab=await chrome.tabs.create({url:ATTENDANCE,active:false});job.tabId=tab.id;await write('job',job);
  await chrome.alarms.create('sksa-attendance-resume',{periodInMinutes:0.5});runJob(job.id);return {id:job.id};
}
async function response(message,sender){
  const fromPopup=sender.id===chrome.runtime.id&&sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`)&&!sender.tab;
  const settings=await read('settings');const fromBridge=message.scope==='SKSA_ATTENDANCE_BRIDGE'&&settings?.webappOrigin&&originOf(sender.url)===settings.webappOrigin;
  if(message.scope==='SKSA_ATTENDANCE_DRIVER'){
    const job=await read('job');if(message.type==='READY'&&job&&job.tabId===sender.tab?.id&&['running','waiting'].includes(job.status)&&!job.cancelled)runJob(job.id);return {ready:true};
  }
  if(!fromPopup&&!fromBridge)throw new Error('Halaman ini belum dipadankan dengan extension.');
  switch(message.type){
    case 'GET_SETTINGS':return publicSettings();
    case 'SAVE_SETTINGS':if(!fromPopup)throw new Error('Tetapan hanya boleh diubah dalam extension.');return settingsSave(message);
    case 'START':return start(message,sender);
    case 'GET_JOB':{const job=await read('job');if(fromBridge&&job&&job.ic!==normalizeIc(message.ic))return null;if(!job)return null;const {records,...publicJob}=job;return publicJob;}
    case 'GET_DATA':{const job=await read('job'),ic=normalizeIc(message.ic),records=mergeRecords(await read('records')||[],job?.records||[]).filter(record=>record.teacherIc===ic);return {tool:'sksa-idme-kehadiran-data',schemaVersion:'1.0',extensionVersion:'0.2.0',teacherIc:ic,status:job?.ic===ic?job.status:'ready',records,progress:job?.ic===ic?job.progress||[]:[],exportedAt:new Date().toISOString()};}
    case 'CANCEL':{const job=await read('job');if(job&&(!fromBridge||job.ic===normalizeIc(message.ic)))await jobUpdate(job,{cancelled:true,status:'cancelled',message:'Penyegerakan dihentikan.'});return {cancelled:true};}
    case 'OPEN_TAB':{const job=await read('job');if(job?.tabId)await chrome.tabs.update(job.tabId,{active:true});return {opened:true};}
    case 'FORGET_PASSWORD':if(!fromPopup)throw new Error('Arahan tidak dibenarkan.');await clearPassword();if(settings){settings.passwordSaved=false;await write('settings',settings);}return {forgotten:true};
    default:throw new Error('Arahan tidak dikenali.');
  }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!['SKSA_ATTENDANCE_POPUP','SKSA_ATTENDANCE_BRIDGE','SKSA_ATTENDANCE_DRIVER'].includes(message?.scope))return;
  response(message,sender).then(result=>respond({ok:true,result})).catch(error=>respond({ok:false,error:error.message||'Operasi extension gagal.'}));return true;
});
chrome.alarms.onAlarm.addListener(async alarm=>{if(alarm.name!=='sksa-attendance-resume')return;const job=await read('job');if(job&&job.status==='running'&&!job.cancelled)runJob(job.id);else if(!job||!['running','waiting'].includes(job.status))await chrome.alarms.clear(alarm.name);});
chrome.tabs.onUpdated.addListener(async(tabId,changeInfo,tab)=>{
  if(changeInfo.status!=='complete')return;const job=await read('job');if(!job||!['running','waiting'].includes(job.status)||job.cancelled)return;
  if(tab.openerTabId===job.tabId&&originOf(tab.url)==='https://moeispel.moe.gov.my'){await jobUpdate(job,{tabId});runJob(job.id);}
  else if(tabId===job.tabId)runJob(job.id);
});
chrome.runtime.onInstalled.addListener(async()=>{const settings=await read('settings');if(settings?.webappOrigin)await bridgeRegistration(settings).catch(()=>{});});
