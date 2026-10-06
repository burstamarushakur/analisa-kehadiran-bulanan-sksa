import {copyFile,access} from 'node:fs/promises';
await copyFile(new URL('../public/core.js',import.meta.url),new URL('../extension/core.js',import.meta.url));
for(const path of ['public/index.html','public/app.js','public/pdf.js','public/assets/pdf-lib.min.js','public/assets/fontkit.min.js','public/assets/DejaVuSans.ttf','public/assets/DejaVuSans-Bold.ttf'])await access(path);
process.stdout.write('Webapp statik dan API Vercel sedia. Teras extension dipadankan.\n');
