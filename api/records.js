import {sqlClient,databaseError} from '../lib/database.js';
import {normalizeIc,validateRecord,mergeRecords} from '../public/core.js';
export function createRecordsHandler(connect=sqlClient){return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Kaedah tidak disokong.'});}
  let ic;try{ic=normalizeIc(req.headers['x-sksa-ic']);}catch(error){return res.status(400).json({error:error.message});}
  if(req.method==='GET'){
    const year=Number(req.query.year);if(!Number.isInteger(year)||year<2020||year>2100)return res.status(400).json({error:'Tahun tidak sah.'});
    try{const sql=await connect();const rows=await sql`SELECT data FROM sksa_attendance_months WHERE teacher_ic = ${ic} AND year = ${year} ORDER BY class_name, month`;return res.status(200).json({records:rows.map(row=>row.data),storage:'server'});}catch(error){const failure=databaseError(error);return res.status(failure.status).json(failure.body);}
  }
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))return res.status(415).json({error:'Gunakan format JSON.'});
  let records;try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(JSON.stringify(body||{}).length>2000000)return res.status(413).json({error:'Import terlalu besar. Hantar dalam kelompok lebih kecil.'});
    if(!Array.isArray(body?.records)||body.records.length<1||body.records.length>10)throw new Error('Hantar 1 hingga 10 laporan dalam satu permintaan.');
    records=mergeRecords([],body.records.map(record=>validateRecord(record,ic)));
  }catch(error){return res.status(400).json({error:error.message||'Fail import tidak sah.'});}
  const rows=records.map(record=>({teacher_ic:ic,year:record.year,class_key:record.classKey,class_name:record.className,month:record.month,captured_at:record.capturedAt,data:record}));
  try{
    const sql=await connect();const saved=await sql`
      INSERT INTO sksa_attendance_months (teacher_ic, year, class_key, class_name, month, captured_at, data)
      SELECT teacher_ic, year, class_key, class_name, month, captured_at::timestamptz, data
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
      AS incoming(teacher_ic TEXT, year INTEGER, class_key TEXT, class_name TEXT, month INTEGER, captured_at TEXT, data JSONB)
      ON CONFLICT (teacher_ic, year, class_key, month)
      DO UPDATE SET class_name = EXCLUDED.class_name, captured_at = EXCLUDED.captured_at, data = EXCLUDED.data, updated_at = NOW()
      WHERE sksa_attendance_months.captured_at <= EXCLUDED.captured_at
      RETURNING year, class_key, month`;
    return res.status(200).json({savedCount:saved.length,ignoredCount:records.length-saved.length,storage:'server'});
  }catch(error){const failure=databaseError(error);return res.status(failure.status).json(failure.body);}
};}
export default createRecordsHandler();
