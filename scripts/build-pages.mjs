import {stat,writeFile} from 'node:fs/promises';
const required=['index.html','app.mjs','core.mjs','exports.mjs','ocr-run.mjs','pdf-layout.mjs','styles.css','vendor/tesseract.min.js','vendor/worker.min.js','vendor/docx.js','vendor/fflate.js','vendor/jspdf.js','vendor/lang/kor.traineddata.gz','vendor/core/tesseract-core-simd-lstm.wasm.js','vendor/core/tesseract-core-simd-lstm.wasm'];
for(const file of required)if(!(await stat('dist/'+file)).isFile())throw new Error('Missing asset: '+file);
await writeFile('dist/.nojekyll','');
await writeFile('dist/build-info.json',JSON.stringify({app:'question-sorter',commit:process.env.GITHUB_SHA||'local',builtAt:new Date().toISOString()},null,2));
console.log('Static app and local OCR assets verified.');
