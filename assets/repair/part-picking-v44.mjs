// Forgiving screen-space targets. Gesture classification stays in the shared controller.
export function pickPartNearPoint(rects,x,y,{padding=80,previous=null}={}){
  let best=null,bestScore=Infinity,previousScore=Infinity;
  for(const r of rects){
    const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),distance=Math.hypot(dx,dy);
    if(distance>padding)continue;
    const centerDistance=Math.hypot(x-(r.left+r.right)/2,y-(r.top+r.bottom)/2),score=distance+centerDistance*.16;
    if(r.id===previous)previousScore=score;
    if(score<bestScore){bestScore=score;best=r.id;}
  }
  return previousScore<=bestScore+12?previous:best;
}
