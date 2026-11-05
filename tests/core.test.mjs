import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedText,questionStart,duplicatePairs,splitQuestions,groupedQuestions,parseTSV,inferTitle,clampBox,repairAutomaticDuplicates} from '../dist/core.mjs';
test('문제 번호만 제외하고 수치·수식·보기는 유지한다',()=>{
  assert.equal(normalizedText('1. x + 2 = 5\n① 3 ② 7'),normalizedText('12. x + 2 = 5 ① 3 ② 7'));
  assert.notEqual(normalizedText('1. x + 2 = 5'),normalizedText('1. x - 2 = 5'));
  assert.notEqual(normalizedText('1. x = 5'),normalizedText('1. x = 6'));
  assert.equal(questionStart('① 핵 ② 세포막'),false);
  assert.equal(questionStart('[12] 문제를 읽으시오'),true);
});
test('제목이 달라도 중복을 찾고 사용자 판단을 존중한다',()=>{
  const a={id:'a',title:'단원 1',text:'1. 세포에서 유전 정보를 저장하는 구조는 무엇인가? ① 핵 ② 세포막'};
  const b={id:'b',title:'단원 2',text:'7. 세포에서 유전 정보를 저장하는 구조는 무엇인가? ① 핵 ② 세포막'};
  assert.equal(duplicatePairs([a,b]).length,1);
  assert.equal(duplicatePairs([a,{...b,distinctFrom:['a']}]).length,0);
  assert.equal(duplicatePairs([a,{...b,excluded:true}]).length,0);
  // Similar questions are candidates only; this function never changes exclusion state.
  assert.equal(a.excluded,undefined);assert.equal(b.excluded,undefined);
});
test('OCR이 읽지 못한 그림 공간을 다음 문제 직전까지 보존한다',()=>{
  const lines=[{text:'1. 그림을 보고 고르시오.',x:60,y:100,w:500,h:30,confidence:90},{text:'① A ② B',x:60,y:160,w:300,h:30,confidence:90},{text:'2. 다음 문제',x:60,y:600,w:400,h:30,confidence:90}];
  const questions=splitQuestions(lines,1000,1200);
  assert.equal(questions.length,2);assert.equal(questions[0].box.y+questions[0].box.h,588);assert.equal(questions[1].box.y+questions[1].box.h,1200);
});
test('문제 번호 인식 실패 시 전체 영역을 보존하고 검토를 요구한다',()=>{
  const q=splitQuestions([{text:'번호 없는 문항',x:50,y:80,w:300,h:30,confidence:70}],1000,1200)[0];assert.equal(q.needsBounds,true);assert.equal(q.box.h,1200);
});
test('OCR이 선택지 원문자를 숫자와 괄호로 읽어도 별도 문제로 나누지 않는다',()=>{
  const lines=[{text:'1. 문제입니다',x:60,y:100,w:500,h:30,confidence:90},{text:'3) 핵 (2) 리보솜 3) 세포막',x:60,y:180,w:500,h:30,confidence:80},{text:'2. 다음 문제입니다',x:60,y:600,w:400,h:30,confidence:90}];
  assert.equal(splitQuestions(lines,1000,1200).length,2);
});
test('제목별 분류는 공백을 통일하되 단원 숫자는 유지한다',()=>{
  const groups=groupedQuestions([{title:' 단원  1 ',text:'A'},{title:'단원 1',text:'B'},{title:'단원 2',text:'C'},{title:'단원 1',text:'D',excluded:true}]);assert.equal(groups.length,2);assert.equal(groups[0].questions.length,2);
});
test('TSV 좌표를 읽고 제목을 문제보다 위에서 찾는다',()=>{
  const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t100\t40\t400\t50\t95\t세포의 구조\n5\t1\t2\t1\t1\t1\t50\t200\t20\t30\t90\t1.\n5\t1\t2\t1\t1\t2\t80\t200\t200\t30\t90\t문제입니다';
  const lines=parseTSV(tsv);assert.equal(lines.length,2);assert.equal(lines[1].text,'1. 문제입니다');assert.equal(inferTitle(lines,1000,1200,'파일명').title,'세포의 구조');assert.equal(parseTSV(tsv,500)[0].x,600);
});
test('영역 수정 좌표가 이미지 밖으로 나가지 않는다',()=>{assert.deepEqual(clampBox({x:-10,y:950,w:2000,h:100},1000,1000),{x:0,y:950,w:1000,h:50});});
test('번호만 다른 짧은 동일 문항도 후보로 찾되 수치가 다른 문항과 빈 텍스트는 구분한다',()=>{
  assert.equal(duplicatePairs([{id:'a',text:'1. 물의 화학식은?'},{id:'b',text:'2. 물의 화학식은 ?'}]).length,1);
  assert.equal(duplicatePairs([{id:'a',text:'1. 2+2=?'},{id:'b',text:'2. 2+3=?'}]).length,0);
  assert.equal(duplicatePairs([{id:'a',text:''},{id:'b',text:''}]).length,0);
});
test('원본이 삭제되면 동일 이미지의 자동 제외 문제 하나를 다시 포함한다',()=>{
  const qs=[{id:'copy1',cropHash:'same',excluded:true,autoDuplicate:'deleted',reviewed:true},{id:'copy2',cropHash:'same',excluded:true,autoDuplicate:'deleted',reviewed:false}];
  assert.equal(repairAutomaticDuplicates(qs),1);assert.equal(qs[0].excluded,false);assert.equal(qs[0].reviewed,false);assert.equal(qs[0].autoDuplicate,null);assert.equal(qs[1].excluded,true);assert.equal(qs[1].autoDuplicate,'copy1');assert.equal(repairAutomaticDuplicates(qs),0);
});
test('수동 제외는 유지하고 살아 있는 기준 문제로 자동 제외 참조를 갱신한다',()=>{
  const qs=[{id:'manual',cropHash:'same',excluded:true,autoDuplicate:null},{id:'kept',cropHash:'same',excluded:false},{id:'copy',cropHash:'same',excluded:true,autoDuplicate:'deleted'}];
  assert.equal(repairAutomaticDuplicates(qs),0);assert.equal(qs[0].excluded,true);assert.equal(qs[2].autoDuplicate,'kept');
  assert.equal(repairAutomaticDuplicates([{id:'manual',cropHash:'same',excluded:true,autoDuplicate:null}]),0);
});
test('기준 문제의 영역이 바뀌면 예전 영역의 사본을 복구하고 사용자가 포함한 사본을 지우지 않는다',()=>{
  const qs=[{id:'changed',cropHash:'new',excluded:false},{id:'copy',cropHash:'old',excluded:true,autoDuplicate:'changed'}];
  assert.equal(repairAutomaticDuplicates(qs),1);assert.equal(qs[1].excluded,false);
  const kept=[{id:'a',cropHash:'same',excluded:false},{id:'b',cropHash:'same',excluded:false}];repairAutomaticDuplicates(kept);assert.ok(kept.every(q=>!q.excluded));
});
