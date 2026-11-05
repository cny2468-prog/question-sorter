// Tesseract worker termination does not settle pending recognize promises.
// Race each operation against this run's cancellation and keep worker ownership local.
export function createOcrRun() {
  let cancelled=false, worker=null, rejectCancellation, disposal=Promise.resolve();
  const abortError=()=>new DOMException('인식을 중단했습니다.','AbortError');
  const cancellation=new Promise((_,reject)=>{rejectCancellation=reject;});
  cancellation.catch(()=>{});
  const ensureActive=()=>{if(cancelled)throw abortError();};
  const dispose=()=>{
    if(worker){const owned=worker;worker=null;disposal=Promise.resolve().then(()=>owned.terminate()).catch(()=>{});}
    return disposal;
  };
  return {
    get cancelled(){return cancelled;},
    get worker(){return worker;},
    ensureActive,
    async attachWorker(created){
      if(cancelled){await Promise.resolve().then(()=>created.terminate()).catch(()=>{});throw abortError();}
      worker=created;return created;
    },
    wait(operation){ensureActive();return Promise.race([Promise.resolve().then(()=>{ensureActive();return operation();}),cancellation]);},
    cancel(){if(!cancelled){cancelled=true;rejectCancellation(abortError());}return dispose();},
    dispose,
  };
}
