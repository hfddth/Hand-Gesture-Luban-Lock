import {createShadowSegmenter} from './segmentation.mjs?v=91';

const HANDS='https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/';
let scriptPromise;
function loadHands(){
 if(globalThis.Hands)return Promise.resolve();
 return scriptPromise??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let fallback=false;
  const timer=setTimeout(()=>{script.remove();reject(Error('手部辅助加载超时'));},15000);
  script.onload=()=>{clearTimeout(timer);globalThis.Hands?resolve():reject(Error('手部辅助未初始化'));};
  script.onerror=()=>{if(!fallback){fallback=true;script.src='https://unpkg.com/@mediapipe/hands@0.4.1675469240/hands.js';}else{clearTimeout(timer);script.remove();reject(Error('手部辅助加载失败'));}};
  script.src=HANDS+'hands.js';document.head.append(script);
 }).catch(error=>{scriptPromise=null;throw error;});
}

export class ShadowCamera{
 constructor({video,preview,settingsPreview,onMask,onState,assist=true}){
  Object.assign(this,{video,preview,settingsPreview,onMask,onState,assist});
  this.segmenter=createShadowSegmenter();this.zoom=1.25;this.active=false;this.generation=0;
  this.frame=document.createElement('canvas');this.frame.width=640;this.frame.height=480;
  this.ctx=this.frame.getContext('2d',{willReadFrequently:true});
  for(const canvas of [preview,settingsPreview]){canvas.width=640;canvas.height=480;}
 }
 report(phase,message,progress=0){this.onState?.({phase,message,progress,...this.segmenter.snapshot()});}
 async start(){
  if(!navigator.mediaDevices?.getUserMedia)throw Error('请通过 HTTPS 或 localhost 连接摄像头');
  const token=++this.generation;
  const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
  if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
  await this.attach(stream);
 }
 async attach(stream){
  this.stop();const token=this.generation;this.stream=stream;this.video.srcObject=stream;
  try{await this.video.play();}catch(error){this.stop();throw error;}
  if(token!==this.generation)return;
  this.active=true;this.lastFrame=0;this.lastInference=0;this.modelFailed=false;
  for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(this.stream===stream){this.stop();this.report('error','摄像头已断开，请重新连接');}},{once:true});
  this.report('connected','手移出绿色框，保持身体和摄像头不动，再采集空背景');
  this.raf=requestAnimationFrame(t=>this.tick(t));if(this.assist)this.loadModel(token);
 }
 async loadModel(token){
  let model;
  try{
   await loadHands();if(token!==this.generation||!this.active)return;
   model=new globalThis.Hands({locateFile:file=>HANDS+file});
   model.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:.48,minTrackingConfidence:.47});
   model.onResults(result=>{
    if(token!==this.generation||!this.active)return;
    // Match the supplied HTML: infer from native video, then map its landmarks into the mirrored center crop.
    const vw=this.video.videoWidth,vh=this.video.videoHeight,sw=Math.min(vw,vh*4/3),sh=Math.min(vh,vw*3/4),sx=(vw-sw)/2,sy=(vh-sh)/2;
    const hands=(result.multiHandLandmarks||[]).map(hand=>hand.map(p=>({x:640-(p.x*vw-sx)*640/sw,y:(p.y*vh-sy)*480/sh})));
    if(hands.length)this.segmenter.updateHandGuide(hands); // Retain the last guide for the V10 650 ms dropout grace.
   });
   this.model=model;
  }catch{
   model?.close?.();this.modelFailed=true;
   if(token===this.generation&&this.active)this.report(this.segmenter.snapshot().ready?'tracking':'connected','手部辅助不可用，继续使用真实背景差分；可在影像设置中排除身体干扰');
  }
 }
 capture(){
  if(!this.active||!this.pixels)throw Error('请先连接摄像头，等待画面出现');
  this.segmenter.beginCalibration();this.report('calibrating','正在采集空背景，请把双手移出绿色框',0);
 }
 invalidate(message='区域已调整，请重新采集空背景'){
  this.segmenter.invalidate();this.onMask?.(new Uint8Array(128*128));this.report('connected',message);
 }
 tick(now){
  if(!this.active)return;this.raf=requestAnimationFrame(t=>this.tick(t));
  if(document.hidden||now-this.lastFrame<50||this.video.readyState<2)return;this.lastFrame=now;
  const token=this.generation;
  try{
   const vw=this.video.videoWidth,vh=this.video.videoHeight,sw=Math.min(vw,vh*4/3),sh=Math.min(vh,vw*3/4);
   this.ctx.setTransform(-1,0,0,1,640,0);this.ctx.drawImage(this.video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,640,480);this.ctx.setTransform(1,0,0,1,0,0);
   this.pixels=this.ctx.getImageData(0,0,640,480).data;this.segmenter.setPixels(this.pixels);
   const snapshot=this.segmenter.snapshot();
   if(snapshot.calibrating){const result=this.segmenter.sample(this.pixels,now);this.report(result.error?'error':result.ready?'tracking':'calibrating',result.error||(result.ready?'背景已锁定，把单手或双手伸入绿色框':'采集空背景中，请保持不动'),result.progress);}
   else if(snapshot.ready){const result=this.segmenter.process(this.pixels);this.onMask?.(this.segmenter.project(128,this.zoom),{mask:new Uint8Array(result.mask),width:640,height:480,zoom:this.zoom});this.report('tracking',result.guided?'已定位 '+this.segmenter.snapshot().hands+' 只手 · 真实轮廓成影':'真实差分成影 · 请在绿色框内调整手影');}
   this.drawPreview();
   if(this.model&&!this.inferenceBusy&&!this.modelFailed&&now-this.lastInference>=110){
    this.inferenceBusy=true;this.lastInference=now;
    this.model.send({image:this.video}).catch(()=>{if(token===this.generation){this.modelFailed=true;this.segmenter.clearGuide();}}).finally(()=>{this.inferenceBusy=false;});
   }
  }catch{this.stop();this.report('error','画面读取中断，请重新连接摄像头');}
 }
 drawPreview(){
  const {roi,exclusions}=this.segmenter.snapshot();
  for(const canvas of [this.preview,this.settingsPreview]){
   const c=canvas.getContext('2d');c.clearRect(0,0,640,480);c.drawImage(this.frame,0,0);
   c.fillStyle='#07161065';c.beginPath();c.rect(0,0,640,480);c.rect(roi.x,roi.y,roi.w,roi.h);c.fill('evenodd');
   c.strokeStyle='#b4db99';c.lineWidth=1.4;c.strokeRect(roi.x,roi.y,roi.w,roi.h);
   c.fillStyle='#e6f8c9';c.font='10px sans-serif';c.fillText('手影区域',roi.x+4,roi.y+12);
   c.fillStyle='#eea04a30';c.strokeStyle='#eeb569';
   for(const r of exclusions){c.fillRect(r.x,r.y,r.w,r.h);c.strokeRect(r.x,r.y,r.w,r.h);}
  }
 }
 stop(){
  ++this.generation;this.active=false;cancelAnimationFrame(this.raf);
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  const model=this.model;this.model=null;Promise.resolve(model?.close?.()).catch(()=>{});
  this.video.pause();this.video.srcObject=null;this.pixels=null;this.segmenter.invalidate();this.segmenter.clearGuide();
  this.report('disconnected','摄像头未连接');
 }
 suspend(){if(this.segmenter.snapshot().calibrating)this.invalidate('采集已中断，请回到页面重新采集空背景');else this.segmenter.reset();}
}
