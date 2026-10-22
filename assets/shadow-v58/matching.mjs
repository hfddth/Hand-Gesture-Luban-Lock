// UI-side comparison only. Camera/hand recognition is supplied separately.
export function overlapScore(target,actual){
 if(target.length!==actual.length)throw new Error('Mask dimensions differ');
 let intersection=0,union=0;
 for(let i=0;i<target.length;i++){const a=!!target[i],b=!!actual[i];if(a&&b)intersection++;if(a||b)union++;}
 return union?100*intersection/union:0;
}
export function normalizeMask(input,width,height,size=128){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>2048||height>2048||!input||input.length!==width*height)throw new Error('Invalid mask');
 const out=new Uint8Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)out[y*size+x]=Number(input[Math.floor(y*height/size)*width+Math.floor(x*width/size)])>0?1:0;
 return out;
}
export class ShadowSession{
 constructor({threshold=70,holdMs=1000}={}){this.threshold=threshold;this.holdMs=holdMs;this.reset();}
 reset(){this.score=0;this.heldMs=0;this.lastFrame=null;this.complete=false;this.paused=false;}
 update(score,now){
  if(!Number.isFinite(score)||score<0||score>100||!Number.isFinite(now))throw new Error('Invalid match result');
  if(this.paused||this.complete)return this.snapshot();
  const continuous=this.lastFrame!==null&&now>=this.lastFrame&&now-this.lastFrame<=350;
  const dt=continuous?Math.min(100,now-this.lastFrame):0;
  if(score>=this.threshold)this.heldMs=(continuous?this.heldMs:0)+dt;else this.heldMs=0;
  this.score=score;this.lastFrame=now;this.complete=this.heldMs>=this.holdMs;return this.snapshot();
 }
 stale(now){if(!this.complete&&this.lastFrame!==null&&now-this.lastFrame>350){this.score=0;this.heldMs=0;this.lastFrame=null;}return this.snapshot();}
 pause(value){this.paused=value;this.heldMs=0;this.lastFrame=null;}
 snapshot(){return {score:this.score,heldMs:Math.min(this.holdMs,this.heldMs),complete:this.complete,paused:this.paused};}
}
export function contourLoops(mask,size=128){
 const edges=new Map(),add=(x,y,a,b)=>{const key=x+','+y;if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(mask[y*size+x]){
  if(!y||!mask[(y-1)*size+x])add(x,y,x+1,y);
  if(x===size-1||!mask[y*size+x+1])add(x+1,y,x+1,y+1);
  if(y===size-1||!mask[(y+1)*size+x])add(x+1,y+1,x,y+1);
  if(!x||!mask[y*size+x-1])add(x,y+1,x,y);
 }
 const loops=[];
 while(edges.size){const start=[...edges.keys()][0].split(',').map(Number),loop=[start];let p=start;
  for(let limit=0;limit<size*size*4;limit++){
   const key=p.join(','),next=edges.get(key);if(!next?.length)break;
   const q=next.pop();if(!next.length)edges.delete(key);loop.push(q);p=q;if(p[0]===start[0]&&p[1]===start[1])break;
  }
  if(loop.length>12)loops.push(loop);
 }
 return loops;
}
export function simplifyLoop(points,tolerance=.6){
 const simplify=p=>{if(p.length<3)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;let best=0,index=0;
  for(let i=1;i<p.length-1;i++){const v=p[i],t=length?Math.max(0,Math.min(1,((v[0]-a[0])*dx+(v[1]-a[1])*dy)/length)):0,d=Math.hypot(v[0]-a[0]-t*dx,v[1]-a[1]-t*dy);if(d>best){best=d;index=i;}}
  return best>tolerance?[...simplify(p.slice(0,index+1)).slice(0,-1),...simplify(p.slice(index))]:[a,b];
 };
 const half=Math.floor(points.length/2);return [...simplify(points.slice(0,half+1)).slice(0,-1),...simplify(points.slice(half))];
}
