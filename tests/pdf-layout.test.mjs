import test from 'node:test';
import assert from 'node:assert/strict';
import {placePdfBlocks} from '../dist/pdf-layout.mjs';
test('마지막 원본 파일명만 다음 페이지에 분리하지 않는다',()=>{
  const result=placePdfBlocks([{height:8.57,spacing:1,keepWithNext:true},{height:58.93,spacing:4,keepWithNext:true},{height:7.34,spacing:6}],205.5);
  assert.deepEqual(result.placements.map(p=>p.page),[1,1,1]);assert.equal(result.placements[0].y,18);assert.ok(result.placements[2].y+7.34<=279);
});
test('여러 페이지 문제의 첫 이미지는 제목과, 마지막 이미지는 파일명과 함께 배치한다',()=>{
  const blocks=[{height:8.57,spacing:1,keepWithNext:true},{height:230,spacing:4},{height:180,spacing:4,keepWithNext:true},{height:20,spacing:6}];
  const result=placePdfBlocks(blocks,18);assert.deepEqual(result.placements.map(p=>p.page),[0,0,1,1]);
  for(const p of result.placements)assert.ok(p.y+blocks[p.index].height<=279);
});
test('파일명이 없거나 내용이 짧으면 불필요한 페이지를 추가하지 않는다',()=>{
  const result=placePdfBlocks([{height:8,spacing:1,keepWithNext:true},{height:50,spacing:4}],50);assert.deepEqual(result.placements.map(p=>p.page),[0,0]);
  assert.throws(()=>placePdfBlocks([{height:300}],18));
});
