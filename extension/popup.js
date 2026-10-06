import {MONTHS,normalizeIc} from './core.js';
const $=id=>document.getElementById(id);let settings={};let timer;
async function send(type,fields={}){const response=await chrome.runtime.sendMessage({scope:'SKSA_ATTENDANCE_POPUP',type,...fields});if(!response?.ok)throw new Error(response?.error||'Extension belum bersedia.');return response.result;}
function message(value,error=false){$('status').textContent=value;$('status').classList.toggle('error',error);}
async function refresh(){const job=await send('GET_JOB');$('progress').replaceChildren();if(!job){const li=document.createElement('li');li.className='muted';li.textContent='Belum bermula.';$('progress').append(li);return;}
  if(!document.activeElement||!['ic','password','webapp'].includes(document.activeElement.id))message(job.message,['failed','partial'].includes(job.status));
  $('count').textContent=`${(job.progress||[]).filter(item=>item.status==='done').length}/${job.total||0} bulan`;
  for(const item of job.progress||[]){const li=document.createElement('li');li.className=item.status;const state={done:'✓',failed:'!',reading:'↻',pending:'…'}[item.status]||'';li.textContent=`${state} ${MONTHS[item.month-1]} · ${item.className} — ${item.message||item.status}`;$('progress').append(li);}
  $('sync').disabled=job.status==='running';
}
$('year').value=String(new Date().getFullYear());
$('settings-form').addEventListener('submit',async event=>{event.preventDefault();$('save').disabled=true;try{
  const ic=normalizeIc($('ic').value),value=$('webapp').value.trim();let webappOrigin='';
  if(value){const url=new URL(value);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw new Error('Gunakan pautan HTTPS.');webappOrigin=url.origin;const pattern=`${url.protocol}//${url.hostname}/*`;if(!await chrome.permissions.request({origins:[pattern]}))throw new Error('Kebenaran sambungan webapp belum diberikan.');}
  settings=await send('SAVE_SETTINGS',{ic,webappOrigin,password:$('password').value,rememberPassword:$('remember').checked});$('password').value='';$('password').placeholder=settings.passwordSaved?'Sudah disimpan; kosongkan untuk kekalkan':'Isi sekali untuk auto login';message('Tetapan disimpan. Refresh webapp jika sudah dibuka.');
}catch(error){message(error.message,true);}finally{$('save').disabled=false;}});
$('sync').addEventListener('click',async()=>{try{await send('START',{ic:normalizeIc($('ic').value),year:Number($('year').value)});await refresh();}catch(error){message(error.message,true);}});
$('open').addEventListener('click',()=>send('OPEN_TAB').catch(error=>message(error.message,true)));
$('cancel').addEventListener('click',()=>send('CANCEL').then(refresh).catch(error=>message(error.message,true)));
$('forget').addEventListener('click',async()=>{try{await send('FORGET_PASSWORD');$('password').value='';$('password').placeholder='Isi sekali untuk auto login';message('Password tersimpan dibuang.');}catch(error){message(error.message,true);}});
$('download').addEventListener('click',async()=>{try{const data=await send('GET_DATA',{ic:normalizeIc($('ic').value)});const stamp=new Date().toISOString().replace(/[:.]/g,'-');await chrome.downloads.download({url:`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data,null,2))}`,filename:`sksa-idme-kehadiran-data-${stamp}.json`,saveAs:true});message('Fail data dan status dimuat turun.');}catch(error){message(error.message,true);}});
try{settings=await send('GET_SETTINGS');$('ic').value=settings.ic||'';$('webapp').value=settings.webappOrigin||'';$('remember').checked=settings.passwordSaved||!settings.ic;$('password').placeholder=settings.passwordSaved?'Sudah disimpan; kosongkan untuk kekalkan':'Isi sekali untuk auto login';await refresh();timer=setInterval(()=>refresh().catch(()=>{}),1200);}catch(error){message(error.message,true);}
window.addEventListener('unload',()=>clearInterval(timer));
