import { safeName } from './core.mjs';
import { PDF_PAGE, placePdfBlocks } from './pdf-layout.mjs';
const font = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
export function loadImage(src) { return new Promise((resolve,reject)=>{const img=new Image(); img.onload=()=>resolve(img); img.onerror=()=>reject(new Error('이미지를 읽을 수 없습니다.')); img.src=src;}); }
export async function cropCanvas(photo,box) {
  const img=await loadImage(photo.data);
  const c=document.createElement('canvas'); c.width=box.w; c.height=box.h;
  const ctx=c.getContext('2d'); ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,box.x,box.y,box.w,box.h,0,0,box.w,box.h);return c;
}
export function textCanvas(text, width=1200, size=28, color='#233e30') {
  const c=document.createElement('canvas');const ctx=c.getContext('2d');ctx.font=`${size}px ${font}`;
  const lines=[];
  for(const paragraph of String(text).split('\n')) { let line='';for(const char of paragraph){if(ctx.measureText(line+char).width>width-40 && line){lines.push(line);line=char;}else line+=char;} lines.push(line);}
  c.width=width;c.height=Math.max(size*1.8,lines.length*size*1.7+20);ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.textBaseline='top';lines.forEach((line,i)=>ctx.fillText(line,20,10+i*size*1.7));return c;
}
function slices(canvas,maxRatio=1.35) {
  const height=Math.max(1,Math.min(canvas.height,Math.floor(canvas.width*maxRatio)));const result=[];
  for(let y=0;y<canvas.height;y+=height){const c=document.createElement('canvas');c.width=canvas.width;c.height=Math.min(height,canvas.height-y);c.getContext('2d').drawImage(canvas,0,y,c.width,c.height,0,0,c.width,c.height);result.push(c);}return result;
}
export async function makeDocument(group,photos,{format='docx',content='image',includeSource=false}) {
  if(format==='txt')return new TextEncoder().encode('\ufeff'+group.title+'\n\n'+group.questions.map((q,i)=>`【문제 ${i+1}】\n${q.text}${includeSource?'\n원본: '+photos.find(p=>p.id===q.photoId).name:''}`).join('\n\n'));
  const images=[];
  for(const q of group.questions){
    const photo=photos.find(p=>p.id===q.photoId),c=content==='image'?await cropCanvas(photo,q.box):textCanvas(q.text);
    const heading=format==='pdf'?textCanvas(`문제 ${images.length+1}`,1200,23):null;
    const source=format==='pdf'&&includeSource?textCanvas('원본: '+photo.name,1200,18,'#859178'):null;
    const height=canvas=>canvas.height/canvas.width*PDF_PAGE.width;
    const reserved=heading?height(heading)+1+(source?4+height(source):0):0;
    const ratio=format==='pdf'?Math.min(1.35,(PDF_PAGE.bottom-PDF_PAGE.top-reserved)/PDF_PAGE.width):1.35;
    if(ratio<=0)throw new Error('원본 파일명이 너무 깁니다.');
    images.push({q,photo,heading,source,parts:slices(c,ratio)});
  }
  if(format==='pdf') {
    const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true});pdf.setProperties({title:group.title,creator:'문제모음'});let y=18;
    const addCanvas=(canvas,spacing=5)=>{const w=174,h=canvas.height/canvas.width*w;if(y+h>279&&y>18){pdf.addPage();y=18;}pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',18,y,w,h,undefined,'FAST');y+=h+spacing;};
    addCanvas(textCanvas(group.title,1200,44),3);addCanvas(textCanvas(`문제 ${group.questions.length}개`,1200,20,'#859178'),7);
    for(const item of images){
      const blocks=[{canvas:item.heading,spacing:1,keepWithNext:true},...item.parts.map((canvas,i)=>({canvas,spacing:4,keepWithNext:!!item.source&&i===item.parts.length-1}))];
      if(item.source)blocks.push({canvas:item.source,spacing:6});
      for(const block of blocks)block.height=block.canvas.height/block.canvas.width*PDF_PAGE.width;
      const layout=placePdfBlocks(blocks,y);let page=0;
      for(const placement of layout.placements){
        while(page<placement.page){pdf.addPage();page++;}
        const block=blocks[placement.index];pdf.addImage(block.canvas.toDataURL('image/jpeg',.94),'JPEG',18,placement.y,PDF_PAGE.width,block.height,undefined,'FAST');
      }
      y=layout.y;
    }
    return new Uint8Array(pdf.output('arraybuffer'));
  }
  const {Document,Packer,Paragraph,TextRun,ImageRun,HeadingLevel}=window.docx;
  const children=[new Paragraph({text:group.title,heading:HeadingLevel.TITLE}),new Paragraph({text:`문제 ${group.questions.length}개`,spacing:{after:260}})];
  for(let i=0;i<images.length;i++){const item=images[i];children.push(new Paragraph({text:`문제 ${i+1}`,heading:HeadingLevel.HEADING_2,keepNext:true}));
    if(content==='text') {
      for(const line of item.q.text.split('\n'))children.push(new Paragraph({children:[new TextRun(line)],spacing:{after:100}}));
    } else for(const part of item.parts){const width=620;children.push(new Paragraph({children:[new ImageRun({type:'jpg',data:dataBytes(part.toDataURL('image/jpeg',.94)),transformation:{width,height:Math.round(part.height/part.width*width)}})],spacing:{after:150}}));}
    if(includeSource)children.push(new Paragraph({children:[new TextRun({text:'원본: '+item.photo.name,size:16,color:'8A9680'})],spacing:{after:250}}));
  }
  const doc=new Document({creator:'문제모음',title:group.title,styles:{default:{document:{run:{font:'맑은 고딕',size:22}}}},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1020,bottom:1020,left:1020,right:1020}}},children}]});
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
export function dataBytes(data){const binary=atob(data.split(',')[1]);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
export function download(bytes,name,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function downloadGroups(groups,photos,options){const entries={};for(let i=0;i<groups.length;i++){const group=groups[i];const name=`${String(i+1).padStart(2,'0')}_${safeName(group.title)}.${options.format}`;entries[name]=await makeDocument(group,photos,options);}
  if(groups.length===1){const [name,bytes]=Object.entries(entries)[0];download(bytes,name,options.format==='pdf'?'application/pdf':options.format==='txt'?'text/plain;charset=utf-8':'application/vnd.openxmlformats-officedocument.wordprocessingml.document');}
  else download(window.fflate.zipSync(entries,{level:6}),`제목별_문제모음_${new Date().toISOString().slice(0,10)}.zip`,'application/zip');
}
