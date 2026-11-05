export const PDF_PAGE={top:18,bottom:279,width:174};

// Linked blocks (heading → image, last image → source) must share a page.
export function placePdfBlocks(blocks,startY,{top=PDF_PAGE.top,bottom=PDF_PAGE.bottom}={}) {
  let y=startY,page=0;const placements=[];
  for(let i=0;i<blocks.length;){
    let last=i;while(last+1<blocks.length&&blocks[last].keepWithNext)last++;
    let height=0;
    for(let j=i;j<=last;j++)height+=blocks[j].height+(j<last?(blocks[j].spacing||0):0);
    if(!Number.isFinite(height)||height>bottom-top+1e-7)throw new Error('문제 영역이 PDF 페이지보다 큽니다.');
    if(y+height>bottom+1e-7&&y>top){page++;y=top;}
    for(let j=i;j<=last;j++){
      placements.push({index:j,page,y});y+=blocks[j].height+(blocks[j].spacing||0);
    }
    i=last+1;
  }
  return {placements,y};
}
