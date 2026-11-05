import { mkdir, copyFile, readdir, writeFile, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
const root = process.cwd();
const dest = path.join(root, 'dist/vendor');
await mkdir(path.join(dest, 'core'), { recursive: true });
await mkdir(path.join(dest, 'lang'), { recursive: true });
for (const [source, target] of [
  ['tesseract.js/dist/tesseract.min.js', 'tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['docx/dist/index.iife.js', 'docx.js'],
  ['fflate/umd/index.js', 'fflate.js'],
  ['jspdf/dist/jspdf.umd.min.js', 'jspdf.js'],
]) await copyFile(path.join(root, 'node_modules', source), path.join(dest, target));
const core = path.join(root, 'node_modules/tesseract.js-core');
for (const file of await readdir(core)) {
  if (/^tesseract-core.*\.wasm(\.js)?$/.test(file)) await copyFile(path.join(core, file), path.join(dest, 'core', file));
}
for (const lang of ['kor', 'eng']) {
  const output = path.join(dest, 'lang', `${lang}.traineddata.gz`);
  if (await stat(output).catch(() => null)) continue;
  const response = await fetch(lang === 'kor' ? 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/kor.traineddata' : `https://tessdata.projectnaptha.com/4.0.0_fast/${lang}.traineddata.gz`);
  if (!response.ok) throw new Error(`Language download failed: ${lang} ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(output, lang === 'kor' ? gzipSync(bytes) : bytes);
  console.log(`Prepared ${lang} OCR model`);
}
console.log('All browser dependencies are self-hosted.');
let notices='문제모음 — third-party software notices\n';
for(const name of ['tesseract.js','tesseract.js-core','docx','jspdf','fflate']) {
  const dir=path.join(root,'node_modules',name);
  const license=(await readdir(dir)).find(file=>/^licen[cs]e/i.test(file));
  if(license)notices+=`\n\n=== ${name} ===\n`+await readFile(path.join(dir,license),'utf8');
}
notices+='\n\nKorean model: tesseract-ocr/tessdata_best (Apache-2.0). English OCR model: Project Naptha fast (Apache-2.0).\nhttps://github.com/tesseract-ocr/tessdata_best\n';
await writeFile(path.join(dest,'THIRD-PARTY-NOTICES.txt'),notices);
