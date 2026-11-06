import {parseTSV,questionStart} from './core.mjs';
import {loadImage} from './exports.mjs';

export function ocrQuality(data) {
  const characters=(data.text||'').match(/[\p{L}\p{N}]/gu)?.length||0;
  const lines=parseTSV(data.tsv),pageConfidence=Number.isFinite(data.confidence)?data.confidence:0;
  // A sideways page can have a high page score while producing many unreliable
  // short lines. Use the actual line scores before accepting its orientation.
  const lineConfidence=lines.length?lines.reduce((sum,line)=>sum+Math.max(0,line.confidence),0)/lines.length:pageConfidence;
  const numbered=lines.filter(line=>questionStart(line.text)&&line.w>=line.h*4&&(line.text.match(/\p{L}/gu)||[]).length>=3);
  const contentConfidence=numbered.length>=2?numbered.reduce((sum,line)=>sum+Math.max(0,line.confidence),0)/numbered.length:0;
  const confidence=Math.min(pageConfidence,Math.max(lineConfidence,contentConfidence));
  return {characters,confidence,score:confidence*Math.min(1,characters/30)*Math.log2(characters+2),readable:characters>=4&&confidence>=35,strong:characters>=20&&confidence>=78};
}
export function scaledOcrLines(tsv,scale) {
  return parseTSV(tsv).map(line=>({...line,x:line.x/scale,y:line.y/scale,w:line.w/scale,h:line.h/scale}));
}
function imageCanvas(image,angle,scale=1) {
  const sideways=angle%180!==0,canvas=document.createElement('canvas');
  canvas.width=Math.round((sideways?image.height:image.width)*scale);
  canvas.height=Math.round((sideways?image.width:image.height)*scale);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);
  ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);
  return canvas;
}
export async function rotatePhoto(photo,angle) {
  const image=await loadImage(photo.data),canvas=imageCanvas(image,angle);
  return {...photo,width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/jpeg',.96),rotation:((photo.rotation||0)+angle)%360};
}
export async function recognizeRegion(canvas,run) {
  const scale=Math.min(2,3200/Math.max(canvas.width,canvas.height));
  const enlarged=imageCanvas(canvas,0,scale);
  const {data}=await run.wait(()=>run.worker.recognize(enlarged,{tessedit_pageseg_mode:'6'}, {text:true,tsv:true}));
  return scaledOcrLines(data.tsv,scale);
}
// Test cardinal directions explicitly: deskew alone does not correct a sideways page.
// Keep the photographed image for export; only enlarge the separate OCR canvas.
export async function recognizeOrientedPhoto(photo,run,report=()=>{},preferredAngle=0) {
  const image=await run.wait(()=>loadImage(photo.data));
  const scale=Math.min(2,3200/Math.max(image.width,image.height));
  let best=null;
  for(const angle of new Set([preferredAngle,0,90,270,180])) {
    run.ensureActive();const canvas=imageCanvas(image,angle,scale);let candidate=null;
    // Compare both layouts at each angle. Automatic layout can return nothing
    // for a correctly oriented sparse worksheet while a wrong angle yields noise.
    for(const mode of ['3','6']) {
      run.ensureActive();report(`${angle}° 방향 · ${mode==='3'?'자동 배치':'문단 배치'}로 글자를 확인하고 있어요.`);
      const {data}=await run.wait(()=>run.worker.recognize(canvas,{tessedit_pageseg_mode:mode}, {text:true,tsv:true}));
      const quality=ocrQuality(data);
      if(!candidate||quality.score>candidate.quality.score)candidate={angle,data,quality};
    }
    if(!best||candidate.quality.score>best.quality.score)best=candidate;
    if(candidate.quality.strong)break;
  }
  run.ensureActive();
  if(!best.quality.readable)throw new Error('글자를 읽지 못했어요. 사진 방향·선명도를 확인하고 다시 인식해주세요.');
  const corrected=best.angle?await run.wait(()=>rotatePhoto(photo,best.angle)):{...photo};
  const lines=scaledOcrLines(best.data.tsv,scale);
  if(!lines.length)throw new Error('글자 위치를 읽지 못했어요. 사진 방향·선명도를 확인해주세요.');
  return {photo:corrected,lines,quality:best.quality,angle:best.angle};
}
