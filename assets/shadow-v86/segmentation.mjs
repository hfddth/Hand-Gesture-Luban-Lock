// Pixel segmentation adapted from the user-provided Shadow Art V10, Oct 2026.
// Hand landmarks restrict candidates only. They are never rendered as silhouette.
export function createShadowSegmenter({width:W=640,height:H=480}={}){
 const N=W*H,options={threshold:24,cleanup:2,stability:45,minArea:90,repair:50,skinRange:60,autoNoise:true,guided:true};
 const rawMask=new Uint8Array(N),denoiseMask=new Uint8Array(N),scratch=new Uint8Array(N),stable=new Float32Array(N),cleanMask=new Uint8Array(N),visited=new Uint8Array(N),queue=new Int32Array(N),region=new Int32Array(N),handGuide=new Uint8Array(N),exclusionMask=new Uint8Array(N),bgNoise=new Uint8Array(N);
 const guideCanvas=document.createElement('canvas');guideCanvas.width=W;guideCanvas.height=H;const guideCtx=guideCanvas.getContext('2d',{willReadFrequently:true});
 let background=null,lastPixels=null,handColors=[],handGuideCount=0,handStamp=0,hasRoi=true,roi={x:Math.round(W*.1),y:Math.round(H*45/480),w:Math.round(W*.8),h:Math.round(H*354/480)},exclusions=[],bgAcc=null,bgLumSq=null,bgCount=0,calibrateStart=null;
 const guideValid=()=>options.guided&&handGuideCount>0&&performance.now()-handStamp<650;
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
function updateHandGuide(landmarks){
 
 guideCtx.clearRect(0,0,W,H);guideCtx.fillStyle='#fff';guideCtx.strokeStyle='#fff';
 guideCtx.lineJoin='round';guideCtx.lineCap='round';
 const samples=[];
 const pixels=lastPixels;
 for(const p of landmarks){
  const span=Math.max(24,Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y));
  // Hand-area prior only: never draw this prior as the final silhouette.
  guideCtx.beginPath();
  guideCtx.moveTo(p[0].x,p[0].y);
  for(const index of [1,2,5,9,13,17])guideCtx.lineTo(p[index].x,p[index].y);
  guideCtx.closePath();guideCtx.fill();guideCtx.lineWidth=Math.max(9,span*.20);guideCtx.stroke();
  for(const [a,b,c,d] of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
   guideCtx.beginPath();guideCtx.moveTo(p[a].x,p[a].y);
   guideCtx.lineTo(p[b].x,p[b].y);guideCtx.lineTo(p[c].x,p[c].y);guideCtx.lineTo(p[d].x,p[d].y);
   guideCtx.lineWidth=span*(a===1?.29:.25)+9;guideCtx.stroke();
  }
  if(pixels){
   let cb=0,cr=0,count=0;
   for(const t of [.32,.5,.68])for(const idx of [5,9,13]){
    const x=p[0].x*(1-t)+p[idx].x*t,y=p[0].y*(1-t)+p[idx].y*t;
    const c=handPixelColor(pixels,x,y);cb+=c[0];cr+=c[1];count++;
   }
   if(count)samples.push([cb/count,cr/count]);
  }
 }
 handColors=samples;
 const a=guideCtx.getImageData(0,0,W,H).data;
 for(let i=0,q=3;i<N;i++,q+=4)handGuide[i]=a[q]>10?1:0;
 handGuideCount=landmarks.length;handStamp=performance.now();
}
function difference(framePixels,threshold,useRoi,r){
 const low=useRoi?Math.max(0,Math.floor(r.y)):0,high=useRoi?Math.min(H,Math.ceil(r.y+r.h)):H;
 const left=useRoi?Math.max(0,Math.floor(r.x)):0,right=useRoi?Math.min(W,Math.ceil(r.x+r.w)):W;
 const guided=guideValid(),repair=options.repair/100,skinTol=options.skinRange/100;
 const skinRange=9+22*skinTol;
 rawMask.fill(0);
 for(let y=low;y<high;y++){let pos=y*W+left,p=pos*4,b=pos*3;for(let x=left;x<right;x++,pos++,p+=4,b+=3){
   // When AI locates an overlapping hand, allow hand pixels to pass an orange
   // exclusion rectangle that otherwise masks the person's face/body.
   if(exclusionMask[pos]&&!(guided&&handGuide[pos]))continue;
   if(guided&&!handGuide[pos])continue;
   const R=framePixels[p],G=framePixels[p+1],B=framePixels[p+2];
   const dr=Math.abs(R-background[b]),dg=Math.abs(G-background[b+1]),db=Math.abs(B-background[b+2]);
   const delta=.33*dr+.49*dg+.18*db;
   // Previous v9 6+2.2*sigma often erased large skin regions. Cap the jitter
   // margin and use a lower change threshold when a hand has been localized.
   const local=options.autoNoise?Math.min(13,2+bgNoise[pos]*.65):0;
   const changed=delta>=Math.max(7,threshold*(guided?.62:1))+local;
   let skin=false;
   if(guided&&repair>0&&handColors.length){
    const cb=128-.168736*R-.331264*G+.5*B;
    const cr=128+.5*R-.418688*G-.081312*B;
    for(const [kcb,kcr] of handColors){
     if(Math.abs(cb-kcb)<skinRange&&Math.abs(cr-kcr)<skinRange){skin=true;break;}
    }
   }
   // The guide only gates candidate pixels; pixels/skin still determine the mask.
   rawMask[pos]=(changed||(guided&&skin&&repair>.05))?1:0;
 }}
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
 dilated.fill(0);
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const i=y*W+x;if(!handGuide[i])continue;
  const any=denoiseMask[i]||denoiseMask[i-1]||denoiseMask[i+1]||denoiseMask[i-W]||denoiseMask[i+W];
  dilated[i]=any?1:0;
 }
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const i=y*W+x;
  if(!handGuide[i]||denoiseMask[i])continue;
  const n=dilated[i-1]+dilated[i+1]+dilated[i-W]+dilated[i+W];
  if(n>=3)denoiseMask[i]=1;
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
 if(!background)return {regions:0,pixels:0};
 difference(framePixels,config.threshold,config.useRoi,config.roi);
 despeckle(config.cleanup);repairTinyHoles();temporal(config.stability);
 // Do not allow temporal ghost pixels outside the locked workspace or in any
 // manually masked body rectangle, even if the ROI changed a moment ago.
 for(let i=0;i<N;i++)if(scratch[i]){
   const x=i%W,y=(i/W)|0;
   if((config.useRoi&&!roiValid(x,y))||(exclusionMask[i]&&!(guideValid()&&handGuide[i]))||(guideValid()&&!handGuide[i])){scratch[i]=0;stable[i]=0;}
 }
 return connectedComponents(config.minArea);
}

 function process(pixels){lastPixels=pixels;const result=segment(pixels,{...options,useRoi:hasRoi,roi});return {...result,mask:cleanMask,guided:guideValid()};}
 function project(size=128,zoom=1){const out=new Uint8Array(size*size),side=Math.max(W,H),cx=W/2,cy=H/2;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const sx=Math.floor(cx+(x+.5-size/2)*side/size/zoom),sy=Math.floor(cy+(y+.5-size/2)*side/size/zoom);if(sx>=0&&sy>=0&&sx<W&&sy<H&&roiValid(sx,sy))out[y*size+x]=cleanMask[sy*W+sx];}return out;}
 return {width:W,height:H,options,process,project,beginCalibration,sample,invalidate,setRoi,setExclusions,updateHandGuide,clearGuide(){handGuideCount=0;handGuide.fill(0);},setPixels(pixels){lastPixels=pixels;},reset:resetSeg,snapshot:()=>({ready:!!background,calibrating:calibrateStart!==null,roi:{...roi},exclusions:exclusions.map(r=>({...r})),guided:guideValid(),hands:guideValid()?handGuideCount:0}),
 setBackground(rgb){if(rgb.length!==N*3)throw Error('Invalid background');background=new Uint8Array(rgb);bgNoise.fill(0);calibrateStart=null;resetSeg();},setGuide(mask,colors=[]){if(mask.length!==N)throw Error('Invalid guide');handGuide.set(mask);handColors=colors;handGuideCount=1;handStamp=performance.now();}};
}
