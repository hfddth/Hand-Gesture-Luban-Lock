// Pixel segmentation adapted from the user-provided Shadow Art V10, Oct 2026.
// Camera landmarks restrict pixel segmentation to the hands, including over the torso.
// The target outline never participates in segmentation or mask generation.
export function createShadowSegmenter({width:W=640,height:H=480}={}){
 const N=W*H,options={threshold:24,cleanup:2,stability:45,minArea:90,repair:50,skinRange:60,autoNoise:true,guided:true};
 const rawMask=new Uint8Array(N),denoiseMask=new Uint8Array(N),scratch=new Uint8Array(N),stable=new Float32Array(N),cleanMask=new Uint8Array(N),visited=new Uint8Array(N),queue=new Int32Array(N),region=new Int32Array(N),handGuide=new Uint8Array(N),exclusionMask=new Uint8Array(N),bgNoise=new Uint8Array(N);
 const recoveryMask=new Uint8Array(N),supportMask=new Uint8Array(N),protectedGuide=new Uint8Array(N),candidates=new Uint8Array(N);
 let observedHands=0,geometry=null,recoveredPixels=0,wristCuts=[],observedBounds=[];
 const guideCanvas=document.createElement('canvas');guideCanvas.width=W;guideCanvas.height=H;const guideCtx=guideCanvas.getContext('2d',{willReadFrequently:true});
 let background=null,lastPixels=null,handColors=[],handGuideCount=0,handStamp=0,hasRoi=true,roi={x:Math.round(W*.1),y:Math.round(H*45/480),w:Math.round(W*.8),h:Math.round(H*354/480)},exclusions=[],bgAcc=null,bgLumSq=null,bgCount=0,calibrateStart=null;
 const guideValid=()=>options.guided&&handGuideCount>0&&performance.now()-handStamp<450;
 const roiValid=(x,y)=>!hasRoi||(x>=roi.x&&x<roi.x+roi.w&&y>=roi.y&&y<roi.y+roi.h);
 function resetSeg(){stable.fill(0);cleanMask.fill(0);rawMask.fill(0);denoiseMask.fill(0);scratch.fill(0);}
 function invalidate(){background=null;bgAcc=null;bgLumSq=null;bgCount=0;calibrateStart=null;resetSeg();}
 function beginCalibration(now=performance.now()){invalidate();bgAcc=new Float64Array(N*3);bgLumSq=new Float64Array(N);calibrateStart=now;}
 function sample(pixels,now=performance.now()){
  if(calibrateStart===null)return {ready:!!background,progress:0};
  for(let k=0,j=0;k<N;k++,j+=4){const i=k*3,R=pixels[j],G=pixels[j+1],B=pixels[j+2];bgAcc[i]+=R;bgAcc[i+1]+=G;bgAcc[i+2]+=B;const lum=.299*R+.587*G+.114*B;bgLumSq[k]+=lum*lum;}
  bgCount++;const progress=Math.max(0,Math.min(1,(now-calibrateStart)/3000));
  if(progress>=1){if(bgCount<6){invalidate();return {ready:false,progress:0,error:'采样帧数不足，请保持网页在前台后重试'};}background=new Uint8Array(N*3);for(let k=0;k<N;k++){const i=k*3,R=bgAcc[i]/bgCount,G=bgAcc[i+1]/bgCount,B=bgAcc[i+2]/bgCount,lum=.299*R+.587*G+.114*B;background[i]=Math.round(R);background[i+1]=Math.round(G);background[i+2]=Math.round(B);bgNoise[k]=Math.min(52,Math.round(Math.sqrt(Math.max(0,bgLumSq[k]/bgCount-lum*lum))));}bgAcc=bgLumSq=null;calibrateStart=null;resetSeg();}
  return {ready:!!background,progress};
 }
 function setRoi(r){if(!r||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<10||r.h<10)throw Error('Invalid ROI');const x=Math.max(0,Math.min(W-10,r.x)),y=Math.max(0,Math.min(H-10,r.y));roi={x:Math.floor(x),y:Math.floor(y),w:Math.ceil(Math.min(W-x,r.w)),h:Math.ceil(Math.min(H-y,r.h))};invalidate();}
 function setExclusions(rects){exclusions=rects.slice(0,8).map(r=>({...r}));exclusionMask.fill(0);for(const r of exclusions){const left=Math.max(0,Math.floor(r.x)),right=Math.min(W,Math.ceil(r.x+r.w));for(let y=Math.max(0,Math.floor(r.y));y<Math.min(H,Math.ceil(r.y+r.h));y++)exclusionMask.fill(1,y*W+left,y*W+right);}resetSeg();}
function rgbToChroma(r,g,b){return [128-.168736*r-.331264*g+.5*b,128+.5*r-.418688*g-.081312*b];}
function handPixelColor(pxArr,x,y){
 const X=Math.max(0,Math.min(W-1,Math.round(x))),Y=Math.max(0,Math.min(H-1,Math.round(y))),q=(Y*W+X)*4;
 return rgbToChroma(pxArr[q],pxArr[q+1],pxArr[q+2]);
}
let trackedHands=[];
const handBounds=p=>({x0:Math.min(...p.map(v=>v.x)),x1:Math.max(...p.map(v=>v.x)),y0:Math.min(...p.map(v=>v.y)),y1:Math.max(...p.map(v=>v.y))});
function updateHandGuide(landmarks,sourcePixels=null){
 landmarks=landmarks.filter(p=>p?.length>=21&&p.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
 const now=performance.now(),used=new Set();observedHands=landmarks.length;
 const current=landmarks.map(points=>{
  const center=points[9];let best=-1,distance=100;
  trackedHands.forEach((t,i)=>{if(used.has(i))return;const d=Math.hypot(t.points[9].x-center.x,t.points[9].y-center.y);if(d<distance){best=i;distance=d;}});
  const delta=best>=0?[center.x-trackedHands[best].points[9].x,center.y-trackedHands[best].points[9].y]:[0,0];
  if(best>=0)used.add(best);return {points,seen:now,supported:now,delta};
 });
 observedBounds=current.map(t=>handBounds(t.points));
 const motion=current.length===1?current[0].delta:[0,0];
 const history=trackedHands.filter((t,i)=>!used.has(i)&&now-Math.max(t.seen,t.supported||0)<1800).map(t=>Math.hypot(...motion)<45?{...t,points:t.points.map(p=>({...p,x:p.x+motion[0],y:p.y+motion[1]}))}:t);
 const overlap=(a,b)=>a.x0<b.x1+14&&a.x1>b.x0-14&&a.y0<b.y1+14&&a.y1>b.y0-14;
 const nearby=history.filter(t=>current.some(c=>overlap(handBounds(t.points),handBounds(c.points))));
 const retained=nearby.filter(t=>now-t.seen<280).slice(0,2-current.length);
 trackedHands=[...current,...nearby].slice(0,2);
 landmarks=[...current,...retained].map(t=>t.points);
 recoveryMask.fill(0);
 wristCuts=[...current,...nearby].map(({points:p})=>{const dx=p[9].x-p[0].x,dy=p[9].y-p[0].y,n=Math.hypot(dx,dy)||1;return {x:p[0].x,y:p[0].y,dx:dx/n,dy:dy/n,span:Math.max(24,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y))};});
 for(const t of [...current,...nearby]){
  const p=t.points,b=handBounds(p),span=Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y),pad=Math.max(24,Math.min(88,span));
  const left=Math.max(1,Math.floor(b.x0-pad)),right=Math.min(W-1,Math.ceil(b.x1+pad));
  for(let y=Math.max(1,Math.floor(b.y0-pad));y<Math.min(H-1,Math.ceil(b.y1+pad));y++)recoveryMask.fill(1,y*W+left,y*W+right);
 }
 const spans=current.map(({points:p})=>Math.sqrt(Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y)*Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y))).sort((a,b)=>a-b);
 const centers=[...current,...retained].map(({points:p})=>({x:(p[0].x+p[5].x+p[9].x+p[13].x+p[17].x)/5,y:(p[0].y+p[5].y+p[9].y+p[13].y+p[17].y)/5}));
 geometry=current.length?{span:spans.length===2?(spans[0]+spans[1])/2:spans[0],cx:centers.reduce((s,p)=>s+p.x,0)/centers.length,cy:centers.reduce((s,p)=>s+p.y,0)/centers.length,observedHands:current.length,recoveredHands:retained.length,stamp:now,clipped:current.some(t=>t.points.some(p=>!roiValid(p.x,p.y)))}:null;
 guideCtx.clearRect(0,0,W,H);guideCtx.fillStyle='#fff';guideCtx.strokeStyle='#fff';
 guideCtx.lineJoin='round';guideCtx.lineCap='round';
 const samples=[];
 const observedPoints=new Set(current.map(t=>t.points));
 const pixels=sourcePixels||lastPixels;
 for(const p of landmarks){
  const span=Math.max(24,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y));
  // Hand-area prior only: never draw this prior as the final silhouette.
  guideCtx.beginPath();
  guideCtx.moveTo(p[0].x,p[0].y);
  for(const index of [1,2,5,9,13,17])guideCtx.lineTo(p[index].x,p[index].y);
  guideCtx.closePath();guideCtx.fill();guideCtx.lineWidth=Math.max(2,span*.10);guideCtx.stroke();
  for(const [a,b,c,d] of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
   guideCtx.beginPath();guideCtx.moveTo(p[a].x,p[a].y);
   guideCtx.lineTo(p[b].x,p[b].y);guideCtx.lineTo(p[c].x,p[c].y);guideCtx.lineTo(p[d].x,p[d].y);
   guideCtx.lineWidth=Math.max(5,span*(a===1?.28:.23)+2);guideCtx.stroke();
  }
  if(pixels&&observedPoints.has(p)){
   let cb=0,cr=0,count=0;
   for(const t of [.32,.5,.68])for(const idx of [5,9,13]){
    const x=p[0].x*(1-t)+p[idx].x*t,y=p[0].y*(1-t)+p[idx].y*t;
    const c=handPixelColor(pixels,x,y);cb+=c[0];cr+=c[1];count++;
   }
   if(count){const middle=p[9],wrist=p[0],q=(Math.max(0,Math.min(H-1,Math.round((middle.y+wrist.y)/2)))*W+Math.max(0,Math.min(W-1,Math.round((middle.x+wrist.x)/2))))*4;samples.push([cb/count,cr/count,.299*pixels[q]+.587*pixels[q+1]+.114*pixels[q+2]]);}
  }
 }
 handColors=samples;
 const a=guideCtx.getImageData(0,0,W,H).data;
 for(let i=0,q=3;i<N;i++,q+=4)handGuide[i]=a[q]>10?1:0;
 // A known opposite hand's fingers may cross the other wrist cut. This prior
 // only opens candidate connectivity; it never paints the remembered hand.
 for(const t of nearby){const p=t.points,span=Math.max(24,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y));
  for(const ids of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
   guideCtx.beginPath();guideCtx.moveTo(p[ids[0]].x,p[ids[0]].y);for(const id of ids.slice(1))guideCtx.lineTo(p[id].x,p[id].y);guideCtx.lineWidth=Math.max(5,span*.26+2);guideCtx.stroke();
  }
 }
 const protection=guideCtx.getImageData(0,0,W,H).data;for(let i=0;i<N;i++)protectedGuide[i]=protection[i*4+3]>10?1:0;
 handGuideCount=landmarks.length;handStamp=performance.now();
}
function difference(framePixels,threshold,useRoi,r){
 const low=useRoi?Math.max(0,Math.floor(r.y)):0,high=useRoi?Math.min(H,Math.ceil(r.y+r.h)):H;
 const left=useRoi?Math.max(0,Math.floor(r.x)):0,right=useRoi?Math.min(W,Math.ceil(r.x+r.w)):W;
 const guided=guideValid(),repair=options.repair/100,skinTol=options.skinRange/100;
 const skinRange=9+22*skinTol;
 rawMask.fill(0);candidates.fill(0);supportMask.set(handGuide);recoveredPixels=0;
 for(let y=low;y<high;y++){let pos=y*W+left,p=pos*4,b=pos*3;for(let x=left;x<right;x++,pos++,p+=4,b+=3){
   // When AI locates an overlapping hand, allow hand pixels to pass an orange
   // exclusion rectangle that otherwise masks the person's face/body.
   if(exclusionMask[pos]&&!(guided&&handGuide[pos]))continue;
   if(guided&&!handGuide[pos]&&!recoveryMask[pos])continue;
   const R=framePixels[p],G=framePixels[p+1],B=framePixels[p+2];
   const dr=background?Math.abs(R-background[b]):0,dg=background?Math.abs(G-background[b+1]):0,db=background?Math.abs(B-background[b+2]):0;
   const delta=.33*dr+.49*dg+.18*db;
   // Previous v9 6+2.2*sigma often erased large skin regions. Cap the jitter
   // margin and use a lower change threshold when a hand has been localized.
   const local=options.autoNoise?Math.min(13,2+bgNoise[pos]*.65):0;
   const changed=delta>=Math.max(7,threshold*(guided?.62:1))+local;
   let skin=false;
   if(guided&&handColors.length){
    const cb=128-.168736*R-.331264*G+.5*B;
    const cr=128+.5*R-.418688*G-.081312*B;
    for(const [kcb,kcr] of handColors){
     if(Math.abs(cb-kcb)<skinRange&&Math.abs(cr-kcr)<skinRange){skin=true;break;}
    }
   }
   // The guide only gates candidate pixels; pixels/skin still determine the mask.
   if(guided){
    rawMask[pos]=handGuide[pos]&&(changed||skin)?1:0;
    const lum=.299*R+.587*G+.114*B;
    const wristBarrier=wristCuts.some(w=>{const px=x-w.x,py=y-w.y,along=px*w.dx+py*w.dy,across=Math.abs(px*w.dy-py*w.dx);return along<-w.span*.10&&along>-w.span*.24&&across<w.span*1.6;});
    candidates[pos]=(!wristBarrier||protectedGuide[pos])&&skin&&handColors.some(([cb,cr,y])=>Math.abs((128-.168736*R-.331264*G+.5*B)-cb)<Math.min(18,skinRange)&&Math.abs((128+.5*R-.418688*G-.081312*B)-cr)<Math.min(18,skinRange)&&(!Number.isFinite(y)||Math.abs(lum-y)<42))?1:0;
   }else rawMask[pos]=changed?1:0;
 }}
 if(guided)recoverVisiblePixels();
}
// Grow actual connected hand-colour pixels, not the landmark skeleton. Reject
// components that flood the search boundary (uniform torso/background colours).
function recoverVisiblePixels(){
 visited.fill(0);let beyondObserved=0;
 for(let start=0;start<N;start++){
  if(!rawMask[start]||!candidates[start]||visited[start])continue;
  let head=0,tail=1,boundary=false;queue[0]=start;visited[start]=1;
  while(head<tail){
   const k=queue[head++],x=k%W,y=(k/W)|0;
   if(x<1||y<1||x>=W-1||y>=H-1){boundary=true;continue;}
   for(const j of [k-1,k+1,k-W,k+W]){
    if(!recoveryMask[j]||!roiValid(j%W,(j/W)|0)){boundary=true;continue;}
    if(candidates[j]&&!visited[j]&&!exclusionMask[j]){visited[j]=1;queue[tail++]=j;}
   }
  }
  if(boundary)continue;
  let evidence=0;
  for(let i=0;i<tail;i++){const k=queue[i],x=k%W,y=(k/W)|0;if(!rawMask[k])recoveredPixels++;rawMask[k]=supportMask[k]=1;
   if(observedBounds.every(b=>x<b.x0-10||x>b.x1+10||y<b.y0-10||y>b.y1+10))evidence++;
  }
  // Renew only the search boundary/wrist cut while real protruding pixels remain;
  // never renew the missing skeleton or paint a hidden hand from its old pose.
  beyondObserved+=evidence;
  if(evidence>120)for(const t of trackedHands)if(t.seen<performance.now())t.supported=performance.now();
 }
 if(geometry&&beyondObserved>120&&observedHands===1&&trackedHands.some(t=>t.seen<geometry.stamp))geometry.recoveredHands=Math.max(1,geometry.recoveredHands);
}
// 2. Small-neighborhood majority filter. Unlike heavy morphology, this keeps
//    thin fingertips and the white gaps between the fingers.
function despeckle(level){
 if(level===0){denoiseMask.set(rawMask);return;}
 denoiseMask.fill(0);
 const min=[0,2,3,4,5][level]-(guideValid()?1:0);
 for(let y=1;y<H-1;y++){
  const base=y*W;for(let x=1;x<W-1;x++){
   const i=base+x;
   if(!rawMask[i]){if(level>=4)continue;}
   const t=i-W,b=i+W;
   const count=rawMask[t-1]+rawMask[t]+rawMask[t+1]+rawMask[i-1]+rawMask[i]+rawMask[i+1]+rawMask[b-1]+rawMask[b]+rawMask[b+1];
   if(count>=min)denoiseMask[i]=1;
  }
 }
}
// Small local closing repairs pinholes/1-2 pixel breaks without creating the
// long floating strokes seen in the earlier skeleton-silhouette versions.
const dilated=new Uint8Array(N);
function repairTinyHoles(){
 if(!guideValid()||options.repair<20)return;
 // Local closing fills short cracks and palm pinholes; the guide bounds it.
 // It never uses the target silhouette, so a different gesture stays different.
 const radius=options.repair>=40?3:1;
 dilated.fill(0);
 for(let y=radius;y<H-radius;y++)for(let x=radius;x<W-radius;x++){
  const i=y*W+x;if(!supportMask[i])continue;
  let found=false;
  for(let dy=-radius;dy<=radius&&!found;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy<=radius*radius&&denoiseMask[i+dy*W+dx]){found=true;break;}
  }
  dilated[i]=found?1:0;
 }
 for(let y=radius;y<H-radius;y++)for(let x=radius;x<W-radius;x++){
  const i=y*W+x;if(!supportMask[i]||denoiseMask[i])continue;
  let enclosed=true;
  for(let dy=-radius;dy<=radius&&enclosed;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy<=radius*radius&&!dilated[i+dy*W+dx]){enclosed=false;break;}
  }
  if(enclosed)denoiseMask[i]=1;
 }
}
// 3. Temporal alpha filter suppresses 1-frame flicker; faster for additions
//    than removals to reduce trails when fingers move quickly.
function temporal(strength){
 const preserve=strength/100,attack=.96-.22*preserve,release=.95-.56*preserve;
 for(let i=0;i<N;i++){stable[i]+=((denoiseMask[i]?1:0)-stable[i])*(denoiseMask[i]?attack:release);scratch[i]=stable[i]>.46?1:0;}
}
// 4. Keep meaningful connected foreground regions. This naturally supports
//    zero, one or two hands and their merged shape when they overlap.
function connectedComponents(minArea){
 visited.fill(0);cleanMask.fill(0);const comps=[];
 for(let i=0;i<N;i++){
  if(!scratch[i]||visited[i])continue;
  let head=0,tail=1;queue[0]=i;visited[i]=1;
  while(head<tail){const k=queue[head++],x=k%W,y=(k/W)|0;
   if(x>0){const u=k-1;if(scratch[u]&&!visited[u]){visited[u]=1;queue[tail++]=u;}}
   if(x<W-1){const u=k+1;if(scratch[u]&&!visited[u]){visited[u]=1;queue[tail++]=u;}}
   if(y>0){const u=k-W;if(scratch[u]&&!visited[u]){visited[u]=1;queue[tail++]=u;}}
   if(y<H-1){const u=k+W;if(scratch[u]&&!visited[u]){visited[u]=1;queue[tail++]=u;}}
  }
  if(tail>=minArea)comps.push({size:tail,pixels:Array.from(queue.slice(0,tail))});
 }
 comps.sort((a,b)=>b.size-a.size);
 const kept=comps.slice(0,guideValid()?4:3);let total=0;
 for(const comp of kept){total+=comp.size;for(const idx of comp.pixels)cleanMask[idx]=1;}
 return {regions:kept.length,pixels:total};
}
// Pure segmentation entrypoint also supports synthetic validation in tests.
function segment(framePixels,config){
 // In hand mode a lost hand must not turn the torso into a scoring silhouette.
 if((options.guided&&!guideValid())||(!background&&!guideValid())){resetSeg();return {regions:0,pixels:0};}
 difference(framePixels,config.threshold,config.useRoi,config.roi);
 despeckle(config.cleanup);repairTinyHoles();temporal(config.stability);
 // Do not allow temporal ghost pixels outside the locked workspace or in any
 // manually masked body rectangle, even if the ROI changed a moment ago.
 const guided=guideValid();
 for(let i=0;i<N;i++)if(scratch[i]){
   const x=i%W,y=(i/W)|0;
   if((config.useRoi&&!roiValid(x,y))||(exclusionMask[i]&&!(guided&&handGuide[i]))||(guided&&!supportMask[i])){scratch[i]=0;stable[i]=0;}
 }
 return connectedComponents(config.minArea);
}

 function process(pixels){lastPixels=pixels;const result=segment(pixels,{...options,useRoi:hasRoi,roi});return {...result,mask:cleanMask,guided:guideValid()};}
 function project(size=128,zoom=1,offset={}){const out=new Uint8Array(size*size),side=Math.max(W,H),cx=W/2,cy=H/2;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const sx=Math.floor(cx+(x+.5-size/2-(offset.offsetX||0))*side/size/zoom),sy=Math.floor(cy+(y+.5-size/2-(offset.offsetY||0))*side/size/zoom);if(sx>=0&&sy>=0&&sx<W&&sy<H&&roiValid(sx,sy))out[y*size+x]=cleanMask[sy*W+sx];}return out;}
 return {width:W,height:H,options,process,project,beginCalibration,sample,invalidate,setRoi,setExclusions,updateHandGuide,clearGuide(){geometry=null;observedHands=0;wristCuts=[];trackedHands=[];handGuideCount=0;handGuide.fill(0);},setPixels(pixels){lastPixels=pixels;},reset:resetSeg,snapshot:()=>({ready:!!background||guideValid(),backgroundReady:!!background,calibrating:calibrateStart!==null,roi:{...roi},exclusions:exclusions.map(r=>({...r})),guided:guideValid(),hands:guideValid()?handGuideCount:0,observedHands:guideValid()?observedHands:0,recoveredPixels:guideValid()?recoveredPixels:0,geometry:guideValid()?geometry:null}),
 setBackground(rgb){if(rgb.length!==N*3)throw Error('Invalid background');background=new Uint8Array(rgb);bgNoise.fill(0);calibrateStart=null;resetSeg();},setGuide(mask,colors=[]){if(mask.length!==N)throw Error('Invalid guide');handGuide.set(mask);handColors=colors;handGuideCount=1;handStamp=performance.now();}};
}


