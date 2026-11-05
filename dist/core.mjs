export const questionStart = text => /^\s*(?:\[\s*\d{1,3}\s*\]|\d{1,3}\s*[.)．。]|\d{1,3}\s*번\s*[.)]?)/u.test(text);
export function normalizedText(text) {
  return text.normalize('NFKC').replace(/^\s*(?:\[\s*\d{1,3}\s*\]|\d{1,3}\s*[.)．。]|\d{1,3}\s*번\s*[.)]?)/u, '').replace(/\s+/gu, '').toLocaleLowerCase();
}
export function normalizedTitle(text) { return text.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase(); }
export function safeName(text) { return (text.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 90) || '제목 미확인'); }
export function parseTSV(tsv, offsetX = 0, offsetY = 0) {
  const groups = new Map();
  for (const row of (tsv || '').split('\n').slice(1)) {
    const p = row.split('\t');
    if (p.length < 12 || p[0] !== '5' || !p.slice(11).join('\t').trim()) continue;
    const key = p.slice(1,5).join('-');
    const word = {text:p.slice(11).join('\t'), x:+p[6]+offsetX, y:+p[7]+offsetY, w:+p[8], h:+p[9], confidence:+p[10]};
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return [...groups.values()].map(words => {
    const x = Math.min(...words.map(w=>w.x)), y = Math.min(...words.map(w=>w.y));
    const medianHeight=words.map(w=>w.h).sort((a,b)=>a-b)[Math.floor(words.length/2)];
    let text=words[0].text;
    for(let i=1;i<words.length;i++) { const prev=words[i-1], word=words[i];const join=/[가-힣]$/.test(prev.text)&&/^[가-힣]/.test(word.text)&&word.x-prev.x-prev.w<medianHeight*.5;text+=(join?'':' ')+word.text; }
    return {text, x, y, w:Math.max(...words.map(w=>w.x+w.w))-x, h:Math.max(...words.map(w=>w.y+w.h))-y, confidence:words.reduce((a,w)=>a+w.confidence,0)/words.length};
  }).sort((a,b)=>a.y-b.y || a.x-b.x);
}
export function inferTitle(lines, width, height, fallback) {
  const first = lines.find(l=>questionStart(l.text));
  const candidates = lines.filter(l=>l.y < Math.min(first?.y ?? height*.25, height*.3) && l.text.length >= 3 && !/이름|성명|학번|반\s*번호|학년\s*반/.test(l.text));
  if (!candidates.length) return {title:fallback, inferred:false};
  candidates.sort((a,b)=> (b.h + (/단원|평가|학습|문제|구조|기능|과학|수학|영어|국어/.test(b.text)?8:0)) - (a.h + (/단원|평가|학습|문제|구조|기능|과학|수학|영어|국어/.test(a.text)?8:0)));
  return {title:candidates[0].text.trim(), inferred:true};
}
export function splitQuestions(lines, width, height, region = {x:0,y:0,w:width,h:height}) {
  if (!lines.length) return [];
  let anchors = lines.filter(l=>questionStart(l.text) && l.x < region.x+region.w*.32 && (l.text.match(/(?:^|\s)\(?\d{1,2}\)/g)||[]).length<2);
  // OCR can read circled option numbers as "3)"; prefer the page's dotted question numbering.
  if(anchors.some(l=>/^\s*\d{1,3}\s*[.．。]/.test(l.text))) anchors=anchors.filter(l=>!/^\s*\d{1,3}\s*\)/.test(l.text));
  if (!anchors.length) return [{text:lines.map(l=>l.text).join('\n'), box:{...region}, confidence:Math.round(lines.reduce((s,l)=>s+l.confidence,0)/lines.length), needsBounds:true}];
  return anchors.map((anchor,i)=> {
    const y = Math.max(region.y, anchor.y-12);
    const end = i+1 < anchors.length ? anchors[i+1].y-12 : region.y+region.h;
    const ownLines = lines.filter(l=>l.y>=anchor.y-3 && l.y<end && l.x>=region.x-5 && l.x<region.x+region.w);
    // Keep blank space and drawings through the next numbered question; never crop to OCR text alone.
    return {text:ownLines.map(l=>l.text).join('\n'), box:{x:region.x,y,w:region.w,h:Math.max(20,end-y)}, confidence:Math.round(ownLines.reduce((s,l)=>s+l.confidence,0)/Math.max(1,ownLines.length)), needsBounds:false};
  });
}
export function similarity(a,b) {
  if (a===b) return 1;
  if (Math.min(a.length,b.length)<12 || Math.min(a.length,b.length)/Math.max(a.length,b.length)<.7) return 0;
  const grams = s=> { const r=new Set(); for(let i=0;i<s.length-2;i++) r.add(s.slice(i,i+3)); return r; };
  const aa=grams(a), bb=grams(b); let same=0;
  for(const g of aa) if(bb.has(g)) same++;
  return 2*same/(aa.size+bb.size || 1);
}
export function duplicatePairs(questions) {
  const pairs=[];
  const kept=questions.filter(q=>!q.excluded);
  for(let i=0;i<kept.length;i++) for(let j=0;j<i;j++) {
    const a=kept[j], b=kept[i];
    if (b.distinctFrom?.includes(a.id) || a.distinctFrom?.includes(b.id)) continue;
    const ta=normalizedText(a.text), tb=normalizedText(b.text);
    const score=similarity(ta,tb);
    if ((ta.length>0 && ta===tb) || (ta.length>=12 && score>=.8) || (a.cropHash && a.cropHash===b.cropHash)) pairs.push({a:a.id,b:b.id,score,exact:ta.length>0&&ta===tb});
  }
  return pairs;
}
export function repairAutomaticDuplicates(questions) {
  const groups=new Map();let promoted=0;
  for(const q of questions){if(!q.cropHash)continue;if(!groups.has(q.cropHash))groups.set(q.cropHash,[]);groups.get(q.cropHash).push(q);}
  for(const group of groups.values()){
    const automatic=group.filter(q=>q.excluded&&q.autoDuplicate);
    if(!automatic.length)continue;
    let keeper=group.find(q=>!q.excluded);
    if(!keeper){keeper=automatic[0];keeper.excluded=false;keeper.autoDuplicate=null;keeper.reviewed=false;promoted++;}
    for(const q of automatic)if(q!==keeper)q.autoDuplicate=keeper.id;
  }
  return promoted;
}
export function groupedQuestions(questions) {
  const result=new Map();
  for(const q of questions.filter(q=>!q.excluded)) {
    const key=normalizedTitle(q.title || '제목 미확인');
    if(!result.has(key)) result.set(key,{title:q.title || '제목 미확인',questions:[]});
    result.get(key).questions.push(q);
  }
  return [...result.values()];
}
export function clampBox(box,width,height) {
  const x=Math.max(0,Math.min(width-1,Math.round(box.x))), y=Math.max(0,Math.min(height-1,Math.round(box.y)));
  return {x,y,w:Math.max(1,Math.min(width-x,Math.round(box.w))),h:Math.max(1,Math.min(height-y,Math.round(box.h)))};
}
