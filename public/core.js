export const MONTHS = ['Januari','Februari','Mac','April','Mei','Jun','Julai','Ogos','September','Oktober','November','Disember'];
export const MONTH_ALIASES = [['jan','januari'],['feb','februari'],['mac','mar','march'],['apr','april'],['mei','may'],['jun','june'],['jul','julai','july'],['ogs','ogos','aug','august'],['sep','sept','september'],['okt','oktober','oct','october'],['nov','november'],['dis','disember','dec','december']];
export const compact = value => String(value ?? '').replace(/\s+/g,' ').trim();
export const classKey = value => compact(value).normalize('NFKC').toUpperCase();
export function normalizeIc(value) { const ic=String(value ?? '').replace(/[\s-]/g,''); if(!/^\d{12}$/.test(ic)) throw new Error('Masukkan nombor IC 12 digit.'); return ic; }
export function parseMonth(value) { const caption=compact(value).toLowerCase(); const match=caption.match(/\b([a-z]+)\s+(20\d{2})\b/); if(!match) return null; const month=MONTH_ALIASES.findIndex(aliases=>aliases.includes(match[1]))+1; return month ? {month,year:Number(match[2])}:null; }
export function fraction(value) { const match=compact(value).match(/^(\d+)\s*\/\s*(\d+)$/); if(!match) return null; const present=Number(match[1]),possible=Number(match[2]); if(present>possible) throw new Error('Jumlah hadir melebihi jumlah sesi dalam data IDME.'); return {present,possible}; }
export function number(value) { const raw=compact(value).replace(/,/g,'').replace(/%$/,''); return raw!=='' && /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw):null; }
export function expandCells(cells) { return cells.flatMap(cell=>Array.from({length:Math.min(Number(cell.colSpan)||1,100)},(_,index)=>index===0 ? cell:{...cell,text:'',continuation:true})); }
export function reportHeader(cells) {
  const expanded=expandCells(cells),days=[];
  expanded.forEach((cell,index)=> { const label=compact(cell.text); if(/^\d{1,2}$/.test(label) && Number(label)>=1 && Number(label)<=31) days.push({day:Number(label),column:index}); });
  if(!days.length || new Set(days.map(item=>item.day)).size!==days.length) throw new Error('Tidak dapat mengenal pasti semua lajur tarikh laporan IDME.');
  const totalColumn=expanded.findIndex((cell,index)=>index>days.at(-1).column && /jumlah\s+hadir/i.test(cell.text));
  if(totalColumn<0) throw new Error('Lajur Jumlah Hadir tidak ditemui dalam laporan IDME.');
  return {days,totalColumn,nameColumn:days[0].column-1,serialColumn:days[0].column-2};
}
export function mark(value) { const raw=compact(value); if(raw==='/' || ['✓','✔'].includes(raw)) return {status:'present',raw}; if(raw==='0') return {status:'absent',raw}; if(!raw) return {status:'blank',raw:''}; return {status:'unknown',raw}; }
export function normalizeReport(raw, ownerIc) {
  const ic=normalizeIc(ownerIc),year=Number(raw.year),month=Number(raw.month);
  if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(month)||month<1||month>12) throw new Error('Tahun atau bulan laporan tidak sah.');
  const name=compact(raw.className),spec=reportHeader(raw.header);
  if(!name) throw new Error('Nama kelas tidak ditemui.');
  const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  if(spec.days.some(item=>item.day>lastDay)) throw new Error('Tarikh laporan tidak sepadan dengan bulan yang dipilih.');
  const studentRows=raw.rows.filter(row=> {const cells=expandCells(row);return /^\d+$/.test(compact(cells[spec.serialColumn]?.text)) && compact(cells[spec.nameColumn]?.text) && cells.length>spec.totalColumn;});
  if(!studentRows.length) throw new Error('Tiada baris murid ditemui dalam laporan bulan ini.');
  const warnings=[];
  const students=studentRows.map((row,index)=> {
    const cells=expandCells(row),studentName=compact(cells[spec.nameColumn].text);
    const attendance=spec.days.map(({day,column})=>({day,...mark(cells[column]?.text),color:compact(cells[column]?.color)||null}));
    const countedPresent=attendance.filter(item=>item.status==='present').length,countedAbsent=attendance.filter(item=>item.status==='absent').length;
    const totals=fraction(cells[spec.totalColumn]?.text);
    if(!totals) throw new Error(`Jumlah hadir murid baris ${index+1} tidak dapat dibaca.`);
    if(countedPresent!==totals.present || countedAbsent!==totals.possible-totals.present) {
      throw new Error(`Tanda harian dan jumlah murid baris ${index+1} tidak sepadan. Bulan ini belum diimport; cuba segerak semula.`);
    }
    if(attendance.some(item=>item.status==='unknown')) throw new Error(`Tanda kehadiran tidak dikenali pada murid baris ${index+1}.`);
    const serial=Number(cells[spec.serialColumn].text);
    return {serial,name:studentName,attendance,present:totals.present,possible:totals.possible,absent:totals.possible-totals.present,absentPrevious:number(cells[spec.totalColumn+2]?.text),absentCumulative:number(cells[spec.totalColumn+3]?.text)};
  });
  if(new Set(students.map(student=>student.serial)).size!==students.length) throw new Error('Nombor baris murid berganda ditemui.');
  const sumPresent=students.reduce((sum,student)=>sum+student.present,0),sumPossible=students.reduce((sum,student)=>sum+student.possible,0);
  const overview=fraction(raw.overview?.fraction);
  if(overview && (overview.present!==sumPresent||overview.possible!==sumPossible)) throw new Error('Jumlah murid tidak sepadan dengan rumusan IDME. Tunggu laporan siap dimuatkan dan cuba lagi.');
  const footers=(raw.footerRows||[]).map(expandCells).filter(row=>row.length>spec.days.at(-1).column);
  const getFooter=(position,day)=>number(footers[position]?.[spec.days.find(item=>item.day===day).column]?.text);
  const calendar=spec.days.map(({day,column})=> {
    const potential=getFooter(2,day);
    const colors=students.map(student=>student.attendance.find(item=>item.day===day)?.color).filter(Boolean);
    const color=colors.sort((a,b)=>colors.filter(x=>x===b).length-colors.filter(x=>x===a).length)[0] || raw.header[column]?.color || null;
    const legend=(raw.legend||[]).find(item=>item.color===color);
    const marker=compact(footers[3]?.[column]?.text);
    return {day,color,holiday:legend?.text||null,isSchoolDay:marker==='/' ? true:potential!==null ? potential>0:null,present:getFooter(0,day),absent:getFooter(1,day),enrolled:potential};
  });
  for(const day of calendar){const present=students.filter(student=>student.attendance.find(item=>item.day===day.day)?.status==='present').length,absent=students.filter(student=>student.attendance.find(item=>item.day===day.day)?.status==='absent').length;if(day.present!==null&&day.present!==present||day.absent!==null&&day.absent!==absent||day.enrolled!==null&&day.enrolled!==present+absent)throw new Error(`Jumlah harian ${day.day} haribulan tidak sepadan dengan tanda murid. Tunggu data IDME siap dan cuba lagi.`);}
  const metrics=(raw.metrics||[]).filter(item=>compact(item.label)).map(item=>({label:compact(item.label),value:compact(item.value)}));
  const schoolDaysMetric=metrics.find(item=>/hari\s+belajar.*bulan\s+ini/i.test(item.label));
  const schoolDays=number(schoolDaysMetric?.value)??calendar.filter(day=>day.isSchoolDay===true).length;
  const present=overview?.present??sumPresent,possible=overview?.possible??sumPossible,absent=possible-present;
  const percentage=number(raw.overview?.percentage)??(possible>0?Math.round(present/possible*10000)/100:0);
  if(possible>0 && Math.abs(percentage-present/possible*100)>0.06) throw new Error('Peratus kehadiran tidak sepadan dengan jumlah asal IDME.');
  const now=new Date(),sgNow=new Date(now.getTime()+8*3600e3);
  const currentMonth=year===sgNow.getUTCFullYear()&&month===sgNow.getUTCMonth()+1;
  if(currentMonth) warnings.push('Bulan sedang berjalan; jumlah mengikut data IDME ketika disegerakkan.');
  return {
    schemaVersion:'1.0',teacherIc:ic,year,month,className:name,classKey:classKey(name),reportClassName:compact(raw.reportClassName)||name,
    teacherName:compact(raw.teacherName),schoolName:compact(raw.schoolName)||'SEKOLAH KEBANGSAAN SUNGAI ABONG',
    capturedAt:new Date(raw.capturedAt||now).toISOString(),source:'IDME',status:currentMonth?'ongoing':'imported',warnings,
    summary:{present,possible,absent,percentage,studentCount:students.length,schoolDays},students,calendar,metrics,
    legend:(raw.legend||[]).filter(item=>compact(item.text)).map(item=>({text:compact(item.text),color:compact(item.color)}))
  };
}
export function validateRecord(record, ownerIc) {
  const ic=normalizeIc(ownerIc);
  if(record?.schemaVersion!=='1.0'||record?.source!=='IDME'||record.teacherIc!==ic) throw new Error('Rekod bukan milik IC ini atau format import tidak disokong.');
  const year=Number(record.year),month=Number(record.month);
  if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(month)||month<1||month>12||!compact(record.className)||compact(record.className).length>120) throw new Error('Butiran kelas, tahun atau bulan tidak sah.');
  if(!Array.isArray(record.students)||!record.students.length||record.students.length>500) throw new Error('Senarai murid tidak sah.');
  const students=record.students.map(student=> {
    if(!compact(student.name)||compact(student.name).length>200||!Array.isArray(student.attendance)||student.attendance.length>31) throw new Error('Butiran murid tidak sah.');
    const present=Number(student.present),possible=Number(student.possible),absent=Number(student.absent);
    if(![present,possible,absent].every(value=>Number.isInteger(value)&&value>=0&&value<=31)||present+absent!==possible) throw new Error('Jumlah murid tidak sah.');
    const attendance=student.attendance.map(item=> {
      const day=Number(item.day),status=item.status;
      if(!Number.isInteger(day)||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||!['present','absent','blank'].includes(status)) throw new Error('Rekod harian tidak sah.');
      return {day,status,raw:status==='present'?'/':status==='absent'?'0':'',color:validColor(item.color)};
    });
    if(new Set(attendance.map(item=>item.day)).size!==attendance.length||attendance.filter(item=>item.status==='present').length!==present||attendance.filter(item=>item.status==='absent').length!==absent) throw new Error('Tanda harian tidak sepadan dengan jumlah murid.');
    return {serial:Number(student.serial)||1,name:compact(student.name),present,possible,absent,absentPrevious:nullableCount(student.absentPrevious),absentCumulative:nullableCount(student.absentCumulative),attendance};
  });
  const sumPresent=students.reduce((sum,item)=>sum+item.present,0),sumPossible=students.reduce((sum,item)=>sum+item.possible,0);
  if(sumPresent!==record.summary?.present||sumPossible!==record.summary?.possible||record.summary.absent!==sumPossible-sumPresent||record.summary.studentCount!==students.length) throw new Error('Rumusan bulanan tidak sepadan dengan jumlah murid.');
  if(!Number.isFinite(record.summary.percentage)||record.summary.percentage<0||record.summary.percentage>100||sumPossible>0&&Math.abs(record.summary.percentage-sumPresent/sumPossible*100)>0.06) throw new Error('Peratus laporan tidak sah.');
  const calendar=(record.calendar||[]).slice(0,31).map(item=> {
    if(!Number.isInteger(item.day)||item.day<1||item.day>new Date(Date.UTC(year,month,0)).getUTCDate()) throw new Error('Tarikh kalendar tidak sah.');
    return {day:item.day,color:validColor(item.color),holiday:compact(item.holiday).slice(0,90)||null,isSchoolDay:typeof item.isSchoolDay==='boolean'?item.isSchoolDay:null,present:nullableCount(item.present),absent:nullableCount(item.absent),enrolled:nullableCount(item.enrolled)};
  });
  if(!calendar.length||new Set(calendar.map(item=>item.day)).size!==calendar.length||students.some(student=>student.attendance.length!==calendar.length||student.attendance.some(item=>!calendar.some(day=>day.day===item.day)))) throw new Error('Kalendar laporan tidak lengkap.');
  if(new Set(students.map(student=>student.serial)).size!==students.length||students.some(student=>!Number.isInteger(student.serial)||student.serial<1||student.serial>500))throw new Error('Nombor baris murid tidak sah atau berganda.');
  for(const day of calendar){const present=students.filter(student=>student.attendance.find(item=>item.day===day.day)?.status==='present').length,absent=students.filter(student=>student.attendance.find(item=>item.day===day.day)?.status==='absent').length;if(day.present!==null&&day.present!==present||day.absent!==null&&day.absent!==absent||day.enrolled!==null&&day.enrolled!==present+absent)throw new Error('Rumusan harian tidak sepadan dengan tanda murid.');}
  const capturedAt=new Date(record.capturedAt);if(!Number.isFinite(capturedAt.getTime())) throw new Error('Tarikh import tidak sah.');
  return {schemaVersion:'1.0',source:'IDME',teacherIc:ic,year,month,className:compact(record.className),classKey:classKey(record.className),reportClassName:compact(record.reportClassName)||compact(record.className),teacherName:compact(record.teacherName).slice(0,200),schoolName:compact(record.schoolName).slice(0,200),capturedAt:capturedAt.toISOString(),status:record.status==='ongoing'?'ongoing':'imported',warnings:(record.warnings||[]).slice(0,20).map(item=>compact(item).slice(0,300)),summary:{present:sumPresent,possible:sumPossible,absent:sumPossible-sumPresent,percentage:record.summary.percentage,studentCount:students.length,schoolDays:nullableCount(record.summary.schoolDays)},students,calendar,metrics:(record.metrics||[]).slice(0,30).map(item=>({label:compact(item.label).slice(0,150),value:compact(item.value).slice(0,80)})),legend:(record.legend||[]).slice(0,15).map(item=>({text:compact(item.text).slice(0,90),color:validColor(item.color)}))};
}
function nullableCount(value) {return value!==null&&value!==undefined&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=20000 ? Number(value):null;}
export function validColor(value) {const color=compact(value);return /^(?:#[0-9a-f]{3,8}|rgba?\([\d.,\s]+\))$/i.test(color)?color:null;}
export function recordKey(record) {return `${record.teacherIc}|${record.year}|${classKey(record.className)}|${record.month}`;}
export function mergeRecords(previous,incoming) {const records=new Map(previous.map(record=>[recordKey(record),record]));for(const next of incoming){const key=recordKey(next),old=records.get(key);if(!old||Date.parse(next.capturedAt)>=Date.parse(old.capturedAt))records.set(key,next);}return [...records.values()].sort((a,b)=>b.year-a.year||a.className.localeCompare(b.className)||a.month-b.month);}
