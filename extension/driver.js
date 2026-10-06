(() => {
  if(globalThis.__SKSA_ATTENDANCE_DRIVER__) return;globalThis.__SKSA_ATTENDANCE_DRIVER__=true;
  const compact=value=>String(value??'').replace(/\s+/g,' ').trim();
  const visible=element=>element&&element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden';
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const aliases=[['jan','januari'],['feb','februari'],['mac','mar','march'],['apr','april'],['mei','may'],['jun','june'],['jul','julai','july'],['ogs','ogos','aug','august'],['sep','sept','september'],['okt','oktober','oct','october'],['nov','november'],['dis','disember','dec','december']];
  const parseMonth=value=> {const match=compact(value).toLowerCase().match(/\b([a-z]+)\s+(20\d{2})\b/);if(!match)return null;const month=aliases.findIndex(items=>items.includes(match[1]))+1;return month?{month,year:Number(match[2])}:null;};
  function classIdentity(value){let name=compact(value).toUpperCase().replace(/^KELAS\s+/,'');const words={SATU:1,DUA:2,TIGA:3,EMPAT:4,LIMA:5,ENAM:6},match=name.match(/^(?:D?(\d{1,2})|TAHUN\s+(SATU|DUA|TIGA|EMPAT|LIMA|ENAM|\d{1,2}))\s+(.+)$/);return match?{grade:Number(match[1]||words[match[2]]||match[2]),name:match[3]}:{grade:null,name};}
  function sameClass(task,scope,title){if(!task.className)return true;const content=compact(scope.innerText||scope.textContent),footer=content.match(/NAMA\s+KELAS\s*:\s*(.*?)\s*NAMA\s+SEKOLAH\s*:/i),expected=classIdentity(task.className);if(footer){const actual=classIdentity(footer[1]);return actual.name===expected.name&&(!actual.grade||!expected.grade||actual.grade===expected.grade);}return title.toUpperCase().includes(task.className.toUpperCase());}
  async function until(test,timeout=25000){const started=Date.now();while(Date.now()-started<timeout){const result=test();if(result)return result;await delay(200);}throw new Error('Halaman IDME belum selesai memuatkan data.');}
  function state(){
    if(location.hostname==='idme.moe.gov.my'){
      if(/^\/login(?:\/|$)/.test(location.pathname)&&visible(document.querySelector('#ic')))return {kind:'login-ic'};
      if(/^\/loginverification(?:\/|$)/.test(location.pathname))return {kind:'login-password',passwordVisible:visible(document.querySelector('#password'))};
      return {kind:'idme-home'};
    }
    if(location.hostname==='moeispel.moe.gov.my'&&document.querySelector('#rumusanKeseluruhanBtn'))return {kind:'attendance'};
    const body=compact(document.body?.innerText).toLowerCase();
    if(/access denied|forbidden|tidak dibenarkan|403/.test(body))return {kind:'blocked'};
    return {kind:'loading'};
  }
  function setInput(input,value){if(!input)throw new Error('Medan login IDME tidak ditemui.');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  async function loginIc(ic){
    if(location.origin!=='https://idme.moe.gov.my'||!/^\/login(?:\/|$)/.test(location.pathname))throw new Error('Halaman login IC tidak sepadan.');
    const input=document.querySelector('#ic'),form=input?.form;const button=form?.querySelector('button[type=submit]');
    if(!visible(input)||!visible(button)||!form||new URL(form.action,location.href).origin!==location.origin)throw new Error('Borang login IC belum bersedia.');
    setInput(input,ic);setTimeout(()=>button.click(),80);return {submitted:true};
  }
  async function loginPassword(ic,password){
    if(location.origin!=='https://idme.moe.gov.my'||!/^\/loginverification(?:\/|$)/.test(location.pathname))throw new Error('Halaman login password tidak sepadan.');
    const checkbox=document.querySelector('#check_log');if(!checkbox)throw new Error('Kotak pengesahan IDME tidak ditemui.');
    if(!checkbox.checked)checkbox.click();
    const input=await until(()=>visible(document.querySelector('#password'))&&document.querySelector('#password'),8000);
    const hiddenIc=document.querySelector('#ic');if(hiddenIc&&hiddenIc.value&&hiddenIc.value.replace(/[\s-]/g,'')!==ic)throw new Error('IC pada halaman IDME berbeza daripada akaun extension.');
    const form=input.form,button=document.querySelector('#log_open_form');
    if(!form||new URL(form.action,location.href).origin!==location.origin||!visible(button)||button.disabled)throw new Error('Butang login password belum bersedia.');
    setInput(input,password);setTimeout(()=>button.click(),80);return {submitted:true};
  }
  async function overview(year){
    const nav=document.querySelector('#rumusanKeseluruhanBtn');if(!nav)throw new Error('Tab Rumusan Kehadiran tidak ditemui.');
    if(nav.getAttribute('aria-selected')!=='true'&&!nav.classList.contains('active'))nav.click();
    const table=await until(()=>visible(document.querySelector('#rumusan'))&&document.querySelector('#rumusan'));
    await until(()=>Array.from(table.tBodies).some(body=>Array.from(body.rows).some(row=>row.cells.length>4)));
    const length=document.querySelector('select[name="rumusan_length"]');
    if(length){const all=Array.from(length.options).find(option=>option.value==='-1'||/^(all|semua)$/i.test(compact(option.textContent)));if(all&&length.value!==all.value){length.value=all.value;length.dispatchEvent(new Event('change',{bubbles:true}));await delay(700);}}
    const headings=Array.from(table.tHead?.rows[0]?.cells||[]);let cursor=0;const columns=[];
    for(const cell of headings){const date=parseMonth(cell.textContent);if(date&&date.year===Number(year))columns.push({...date,column:cursor});cursor+=cell.colSpan||1;}
    if(!columns.length)throw new Error(`IDME tidak memaparkan tahun ${year}. Buka tahun tersebut dalam IDME dahulu.`);
    const tasks=[];
    for(const row of Array.from(table.tBodies).flatMap(body=>Array.from(body.rows))){if(row.parentElement.closest('table')!==table||row.cells.length<cursor)continue;const className=compact(row.cells[1]?.textContent);if(!className)continue;
      for(const item of columns){const ratio=compact(row.cells[item.column+1]?.textContent),percent=compact(row.cells[item.column]?.textContent);const match=ratio.match(/^(\d+)\s*\/\s*(\d+)$/);if(match&&Number(match[2])>0)tasks.push({...item,className,fraction:ratio,percentage:percent});}
    }
    return {tasks};
  }
  function selectedReport(task){
    for(const table of document.querySelectorAll('#rumusan table.compTable, table.compTable')){
      if(!visible(table))continue;
      const scope=table.closest('td[colspan]')||table.parentElement.parentElement;
      const title=Array.from(scope.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(element=>compact(element.textContent)).find(value=>/laporan kehadiran/i.test(value));
      const date=title&&parseMonth(title);
      if(date&&date.year===Number(task.year)&&date.month===Number(task.month)&&sameClass(task,scope,title))return {table,scope,title};
    }
    return null;
  }
  function rowFor(task){const table=document.querySelector('#rumusan');return Array.from(table?.tBodies||[]).flatMap(body=>Array.from(body.rows)).find(row=>row.parentElement.closest('table')===table&&row.cells.length>task.column+1&&compact(row.cells[1]?.textContent).toUpperCase()===task.className.toUpperCase());}
  function cellData(cell){return {text:compact(cell.textContent),colSpan:cell.colSpan||1,rowSpan:cell.rowSpan||1,color:getComputedStyle(cell).backgroundColor};}
  function takeReport(task,selection){
    const {table,scope,title}=selection;
    const ownRows=Array.from(table.rows).filter(row=>row.closest('table')===table);
    const headerRow=ownRows.find(row=>Array.from(row.cells).some(cell=>/jumlah\s+hadir/i.test(cell.textContent))&&Array.from(row.cells).some(cell=>/^\d{1,2}$/.test(compact(cell.textContent))));
    if(!headerRow)throw new Error('Tajuk lajur laporan bulanan tidak ditemui.');
    const rows=ownRows.filter(row=>row!==headerRow&&row.parentElement.tagName!=='THEAD').map(row=>Array.from(row.cells).map(cellData));
    const studentIndexes=rows.map((row,index)=>/^\d+$/.test(row[0]?.text||'')&&row.length>5?index:-1).filter(index=>index>=0);
    const lastStudent=studentIndexes.at(-1);
    if(lastStudent===undefined)throw new Error('Laporan belum mengandungi senarai murid.');
    const footers=rows.slice(lastStudent+1).filter(row=>row.length>3).slice(-4);
    const content=compact(scope.innerText||scope.textContent);
    const teacher=content.match(/NAMA\s+GURU\s+KELAS\s*:\s*(.*?)\s*NAMA\s+KELAS\s*:/i);
    const reportClass=content.match(/NAMA\s+KELAS\s*:\s*(.*?)\s*NAMA\s+SEKOLAH\s*:/i);
    const school=content.match(/NAMA\s+SEKOLAH\s*:\s*(.*?)(?:\s*PETUNJUK\s*:|\n|$)/i);
    const metrics=[];
    for(const metricsTable of scope.querySelectorAll('table.calfonts'))for(const row of Array.from(metricsTable.rows))for(let index=0;index+1<row.cells.length;index+=2)metrics.push({label:compact(row.cells[index].textContent),value:compact(row.cells[index+1].textContent)});
    const legend=[];for(const cell of scope.querySelectorAll('td,th')){if(cell.closest('table')===table)continue;const caption=compact(cell.textContent);if(/^cuti\s+/i.test(caption)&&caption.length<80)legend.push({text:caption,color:getComputedStyle(cell).backgroundColor});}
    return {year:Number(task.year),month:Number(task.month),className:task.className,reportClassName:reportClass?.[1]||task.className,teacherName:teacher?.[1]||'',schoolName:school?.[1]||'',capturedAt:new Date().toISOString(),header:Array.from(headerRow.cells).map(cellData),rows,footerRows:footers,metrics,legend,overview:{fraction:task.fraction,percentage:task.percentage}};
  }
  async function scrape(task){
    let report=selectedReport(task);
    if(!report){const row=rowFor(task);if(!row)throw new Error('Baris kelas tidak ditemui dalam rumusan.');const cell=row.cells[task.column+1]||row.cells[task.column];
      const leaves=Array.from(cell.querySelectorAll('*')).filter(element=>!element.children.length&&compact(element.textContent));
      const target=cell.querySelector('a,button,[role=button],[onclick]')||leaves.at(-1)||cell;
      target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      report=await until(()=>selectedReport(task),30000);
    }
    await delay(350);
    report=selectedReport(task);if(!report)throw new Error('Laporan berubah sebelum sempat dibaca.');
    return takeReport(task,report);
  }
  function moduleLink(){
    const exact=Array.from(document.querySelectorAll('a[href]')).find(link=> {try{return new URL(link.href,location.href).hostname==='moeispel.moe.gov.my';}catch{return false;}});
    const named=Array.from(document.querySelectorAll('a,button,input[type=submit]')).find(element=>/^(?:pengurusan murid|modul murid|moeis)$/i.test(compact(element.textContent||element.value)));
    const target=exact||named;if(!target)return {found:false};setTimeout(()=>target.click(),80);return {found:true};
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.scope!=='SKSA_ATTENDANCE_DRIVER')return;
    const actions={STATE:()=>state(),LOGIN_IC:()=>loginIc(message.ic),LOGIN_PASSWORD:()=>loginPassword(message.ic,message.password),OVERVIEW:()=>overview(message.year),SCRAPE:()=>scrape(message.task),OPEN_MODULE:()=>moduleLink()};
    const action=actions[message.type];if(!action){respond({ok:false,error:'Arahan tidak dikenali.'});return;}
    Promise.resolve().then(action).then(result=>respond({ok:true,result})).catch(error=>respond({ok:false,error:error.message||'Operasi IDME gagal.'}));return true;
  });
  chrome.runtime.sendMessage({scope:'SKSA_ATTENDANCE_DRIVER',type:'READY'}).catch(()=>{});
})();
