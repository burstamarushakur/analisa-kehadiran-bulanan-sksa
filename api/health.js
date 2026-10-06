import {sqlClient,databaseError} from '../lib/database.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Kaedah tidak disokong.'});}
  if(!process.env.DATABASE_URL)return res.status(200).json({version:'0.2.0',database:'missing',code:'DATABASE_NOT_CONFIGURED'});
  try{const sql=await sqlClient();const [row]=await sql`SELECT to_regclass('public.sksa_attendance_months') IS NOT NULL AS ready`;return res.status(200).json({version:'0.2.0',database:row?.ready?'ready':'schema_missing'});}catch(error){const failure=databaseError(error);return res.status(200).json({version:'0.2.0',database:'unavailable',code:failure.body.code});}
}
