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
test('페이지 점수가 높아도 세로로 오독한 여러 줄은 방향 확정에 쓰지 않는다',()=>{
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const tsv=[header,...Array.from({length:10},(_,i)=>`5\t1\t1\t1\t${i+1}\t1\t100\t${100+i*50}\t20\t40\t59\t${i===0?'시험문제지':'가히 00 50 RS'}`)].join('\n');
  assert.equal(ocrQuality({text:'가히 시험문제지 00 50 RS 30 베 기교육대학원외국어 가히 시험문제지',confidence:90,tsv}).strong,false);
});
test('표와 제본 흔적이 있어도 여러 가로 문항이 선명하면 같은 방향을 불필요하게 반복하지 않는다',()=>{
  const header='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const noise=Array.from({length:10},(_,i)=>`5\t1\t1\t1\t${i+1}\t1\t10\t${10+i*20}\t20\t30\t30\t가히`);
  const questions=[`5\t1\t1\t1\t11\t1\t100\t400\t600\t30\t90\t1. 측정 원리를 설명하시오.`,`5\t1\t1\t1\t12\t1\t100\t500\t600\t30\t90\t2. 전두엽 기능을 설명하시오.`];
  assert.equal(ocrQuality({text:'가히 1. 측정 원리를 설명하시오. 2. 전두엽 기능을 설명하시오.',confidence:90,tsv:[header,...noise,...questions].join('\n')}).strong,true);
});
