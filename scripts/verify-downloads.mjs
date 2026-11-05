import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import assert from 'node:assert/strict';
await mkdir('test-results/extracted',{recursive:true});
const word=unzipSync(await readFile('test-results/word-groups.zip'));
assert.equal(Object.keys(word).length,2);
const expected=[3,2];let index=0;
for(const [name,bytes] of Object.entries(word)){
  const files=unzipSync(bytes),xml=strFromU8(files['word/document.xml']);
  const images=Object.keys(files).filter(p=>p.startsWith('word/media/')&&!p.endsWith('/'));
  assert.equal(images.length,expected[index++]);
  assert.ok(xml.includes(name.includes('세포')?'세포의 구조와 기능':'물질대사와 에너지'));
  await writeFile('test-results/extracted/'+name,bytes);
  console.log(JSON.stringify({file:name,imageCount:images.length,titlePresent:true}));
}
const pdf=unzipSync(await readFile('test-results/pdf-groups.zip'));
assert.equal(Object.keys(pdf).length,2);
for(const [name,bytes] of Object.entries(pdf)){assert.equal(strFromU8(bytes.slice(0,5)),'%PDF-');await writeFile('test-results/extracted/'+name,bytes);console.log(JSON.stringify({file:name,bytes:bytes.length,pdfHeader:true}));}
const txt=await readFile('test-results/cells.txt','utf8');assert.ok(txt.includes('세포의 구조와 기능'));assert.equal((txt.match(/【문제 /g)||[]).length,3);assert.ok(!txt.includes('3. 세포에서 유전 정보를 저장'));
const backup=JSON.parse(await readFile('test-results/work-backup.json','utf8'));assert.equal(backup.photos.length,3);assert.equal(backup.questions.filter(q=>!q.excluded).length,5);console.log('Text and backup content verified.');
