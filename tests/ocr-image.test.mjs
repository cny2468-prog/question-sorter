import test from 'node:test';
import assert from 'node:assert/strict';
import {ocrQuality,scaledOcrLines} from '../dist/ocr-image.mjs';

test('빈 결과와 낮은 신뢰도 결과는 인식 성공으로 처리하지 않는다',()=>{
  assert.equal(ocrQuality({text:'',confidence:99}).readable,false);
  assert.equal(ocrQuality({text:'가 8 앨나 23 박흐고 소사머 벼 션',confidence:22}).readable,false);
  assert.equal(ocrQuality({text:'시험주제: 뇌기반 교육에서의 이슈를 중심으로 주제를 정하여 선행 연구를 바탕으로 보고서 작성',confidence:88}).strong,true);
});
test('확대 인식 좌표를 원본 사진으로 되돌려 잘못된 문제 영역을 방지한다',()=>{
  const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t200\t600\t1000\t60\t90\t1. 세포의 구조는 무엇인가?';
  const [line]=scaledOcrLines(tsv,2);
  assert.deepEqual({x:line.x,y:line.y,w:line.w,h:line.h},{x:100,y:300,w:500,h:30});
  assert.equal(line.text,'1. 세포의 구조는 무엇인가?');
});
