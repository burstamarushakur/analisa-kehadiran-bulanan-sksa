import {readdir,readFile,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
async function visit(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='assets')await visit(path);}else if(/\.(?:js|mjs)$/.test(entry.name)){const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr);}}}
for(const dir of ['public','extension','api','lib','scripts','tests'])await visit(dir);
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));for(const file of [manifest.background.service_worker,manifest.action.default_popup,...manifest.content_scripts.flatMap(script=>script.js),'core.js','bridge.js','vault.js'])await access('extension/'+file);
if(!Buffer.from(await readFile('public/core.js')).equals(Buffer.from(await readFile('extension/core.js'))))throw new Error('Jalankan npm run build untuk padankan teras extension.');
const html=await readFile('public/index.html','utf8');for(const match of html.matchAll(/(?:src|href)="\/(?!\/)([^"#]+)"/g))await access('public/'+match[1]);
process.stdout.write('Sintaks, manifest, aset dan teras bersama lulus.\n');
