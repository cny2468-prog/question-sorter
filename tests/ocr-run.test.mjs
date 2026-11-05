import test from 'node:test';
import assert from 'node:assert/strict';
import {createOcrRun} from '../dist/ocr-run.mjs';

test('워커 종료가 recognize 대기를 끝내지 않아도 취소는 즉시 끝난다',async()=>{
  const run=createOcrRun();let terminated=0;
  await run.attachWorker({terminate:async()=>{terminated++;}});
  const result=run.wait(()=>new Promise(()=>{}));const rejected=assert.rejects(result,{name:'AbortError'});
  await run.cancel();await rejected;assert.equal(terminated,1);assert.equal(run.worker,null);await run.dispose();assert.equal(terminated,1);
});
test('초기화 도중 취소해도 늦게 생성된 예전 워커만 정리한다',async()=>{
  const old=createOcrRun(),next=createOcrRun();let resolveWorker,oldTerminated=0,nextTerminated=0;
  const created=new Promise(resolve=>{resolveWorker=resolve;});
  const waiting=old.wait(()=>created.then(worker=>old.attachWorker(worker)));const rejected=assert.rejects(waiting,{name:'AbortError'});
  await Promise.resolve();await old.cancel();await rejected;
  await next.attachWorker({terminate:async()=>{nextTerminated++;}});
  resolveWorker({terminate:async()=>{oldTerminated++;}});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(oldTerminated,1);assert.equal(nextTerminated,0);assert.ok(next.worker);await next.dispose();assert.equal(nextTerminated,1);
});
test('이전 취소가 새 실행을 중단하지 않으며 중복 종료와 새 작업 시작을 막는다',async()=>{
  const old=createOcrRun(),next=createOcrRun();let terminated=0;
  await old.attachWorker({terminate:async()=>{terminated++;}});await Promise.all([old.cancel(),old.cancel()]);
  assert.equal(terminated,1);assert.throws(()=>old.wait(()=>42),{name:'AbortError'});assert.equal(await next.wait(()=>42),42);assert.equal(next.cancelled,false);
});
