import {createShadowSegmenter} from './segmentation.mjs?v=105';
import {createShadowProjection} from './projection-v104.mjs';
function timed(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}

const HANDS=new URL('../../vendor/mediapipe/hands/',import.meta.url).href;
let scriptPromise;
function loadHands(){
 if(globalThis.Hands)return Promise.resolve();
 return scriptPromise??=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let fallback=false;
  const timer=setTimeout(()=>{script.remove();reject(Error('手部辅助加载超时'));},15000);
  script.onload=()=>{clearTimeout(timer);globalThis.Hands?resolve():reject(Error('手部辅助未初始化'));};
  script.onerror=()=>{if(!fallback){fallback=true;script.src=HANDS+'hands.js?retry=100';}else{clearTimeout(timer);script.remove();reject(Error('手部辅助加载失败'));}};
  script.src=HANDS+'hands.js';document.head.append(script);
 }).catch(error=>{scriptPromise=null;throw error;});
}

export class ShadowCamera{
 constructor({video,preview,settingsPreview,onMask,onState,assist=true}){
  Object.assign(this,{video,preview,settingsPreview,onMask,onState,assist});
  this.projection=createShadowProjection();this.segmenter=createShadowSegmenter();if(!assist)this.segmenter.options.guided=false;this.zoom=1.35;this.active=false;this.generation=0;
  this.frame=document.createElement('canvas');this.frame.width=640;this.frame.height=480;
  this.inferenceFrame=document.createElement('canvas');this.inferenceFrame.width=640;this.inferenceFrame.height=480;
  this.ctx=this.frame.getContext('2d',{willReadFrequently:true});
  for(const canvas of [preview,settingsPreview]){canvas.width=640;canvas.height=480;}
 }
 report(phase,message,progress=0){this.onState?.({phase,message,progress,...this.segmenter.snapshot()});}
 async start(){
  if(!navigator.mediaDevices?.getUserMedia)throw Error('请通过 HTTPS 或 localhost 连接摄像头');
  const token=++this.generation;
  const pending=navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
  let abandoned=false;pending.then(s=>{if(abandoned||token!==this.generation)s.getTracks().forEach(t=>t.stop());},()=>{});
  let stream;try{stream=await timed(pending,20000,'等待摄像头授权超时，请允许后重试');}catch(e){abandoned=true;throw e;}
  if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
  await this.attach(stream);
 }
 async attach(stream){
  this.stop();const token=this.generation;this.stream=stream;this.video.srcObject=stream;
  try{await timed(this.video.play(),10000,'摄像头画面未就绪，请重新连接');}catch(error){this.stop();throw error;}
  if(token!==this.generation)return;
  this.active=true;this.inferenceBusy=false;this.lastFrame=0;this.lastInference=0;this.modelFailed=false;
  for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(this.stream===stream){this.stop();this.report('error','摄像头已断开，请重新连接');}},{once:true});
  this.report('connected',this.assist?'正在定位双手，请把双手伸入绿色框':'手动差分模式：先采集空背景');
  this.raf=requestAnimationFrame(t=>this.tick(t));if(this.assist)this.loadModel(token);
 }
 async loadModel(token){
  let model;
  try{
   await loadHands();if(token!==this.generation||!this.active)return;
   model=new globalThis.Hands({locateFile:file=>HANDS+file});
   model.setOptions({maxNumHands:2,modelComplexity:1,minDetectionConfidence:.48,minTrackingConfidence:.47});
   model.onResults(result=>{
    if(token!==this.generation||!this.active||this.modelFailed)return;
    // Infer from the same frozen, mirrored 4:3 pixels used for segmentation.
    const hands=(result.multiHandLandmarks||[]).map(hand=>hand.map(p=>({x:p.x*640,y:p.y*480})));
    this.segmenter.updateHandGuide(hands,this.inferencePixels);

   });
   const initialized=model.initialize();Promise.resolve(initialized).then(()=>{if(token!==this.generation||!this.active)Promise.resolve(model.close()).catch(()=>{});},()=>{});
   await timed(initialized,30000,'双手定位初始化超时，请重新连接');
   if(token!==this.generation||!this.active){await model.close();return;}
   this.model=model;
  }catch{
   try{Promise.resolve(model?.close?.()).catch(()=>{});}catch{}
   if(token!==this.generation||!this.active)return;this.modelFailed=true;
   if(token===this.generation&&this.active)this.report(this.segmenter.snapshot().ready?'tracking':'connected','双手定位加载失败，请重新连接；也可在影像设置中关闭双手定位，手动采集背景');
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
   else if(snapshot.ready||this.segmenter.options.guided){
    const result=this.segmenter.process(this.pixels),transform=this.projection.update(this.segmenter.snapshot().geometry,{baseZoom:this.zoom,now});
    const projected=this.segmenter.project(128,transform.zoom,transform);
    this.onMask?.(projected,{mask:new Uint8Array(result.mask),width:640,height:480,...transform});
    this.report('tracking',result.guided?(this.segmenter.snapshot().recoveredPixels>0?'可见轮廓恢复中 · 调整姿态贴合虚线':'双手定位中 · 身体区域已排除'):this.segmenter.options.guided?'等待双手定位 · 身体不参与匹配':'真实差分成影 · 请在绿色框内调整手影');
   }
   this.drawPreview();
   if(this.model&&!this.inferenceBusy&&!this.modelFailed&&now-this.lastInference>=110){
    this.inferenceBusy=true;this.lastInference=now;
    this.inferencePixels=this.pixels;
    this.inferenceFrame.getContext('2d').drawImage(this.frame,0,0);
    timed(this.model.send({image:this.inferenceFrame}),5000,'双手定位响应超时').catch(()=>{if(token===this.generation){this.modelFailed=true;this.segmenter.clearGuide();this.report('error','双手定位中断，请重新连接摄像头');}}).finally(()=>{if(token===this.generation)this.inferenceBusy=false;});
   }
  }catch{this.stop();this.report('error','画面读取中断，请重新连接摄像头');}
 }
 drawPreview(){
  const {roi,exclusions}=this.segmenter.snapshot();
  for(const canvas of [this.preview,this.settingsPreview]){
   if(canvas===this.settingsPreview&&canvas.closest('dialog')?.open===false)continue;
   const c=canvas.getContext('2d');c.clearRect(0,0,640,480);c.drawImage(this.frame,0,0);
   c.fillStyle='#07161065';c.beginPath();c.rect(0,0,640,480);c.rect(roi.x,roi.y,roi.w,roi.h);c.fill('evenodd');
   c.strokeStyle='#b4db99';c.lineWidth=1.4;c.strokeRect(roi.x,roi.y,roi.w,roi.h);
   c.fillStyle='#e6f8c9';c.font='10px sans-serif';c.fillText('手影区域',roi.x+4,roi.y+12);
   c.fillStyle='#eea04a30';c.strokeStyle='#eeb569';
   for(const r of exclusions){c.fillRect(r.x,r.y,r.w,r.h);c.strokeRect(r.x,r.y,r.w,r.h);}
  }
 }
 stop(){
  ++this.generation;this.active=false;this.projection.reset();cancelAnimationFrame(this.raf);
  this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
  const model=this.model;this.model=null;Promise.resolve(model?.close?.()).catch(()=>{});
  this.video.pause();this.video.srcObject=null;this.pixels=null;this.inferencePixels=null;this.segmenter.invalidate();this.segmenter.clearGuide();
  this.report('disconnected','摄像头未连接');
 }
 suspend(){if(this.segmenter.snapshot().calibrating)this.invalidate('采集已中断，请回到页面重新采集空背景');else this.segmenter.reset();}
}
