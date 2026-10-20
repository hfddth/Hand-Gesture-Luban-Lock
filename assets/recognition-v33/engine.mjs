import {PinchGrabController,analyzeHand} from './pinch-controller.mjs';
import {THREE} from '../landing/three-runtime-v5.mjs';

// Palm basis and pose mapping from 第一次数据/lab/orientation-box.js.
export function getHandQuaternion(landmarks,worldLandmarks,aspect=16/9){
  if(!landmarks||landmarks.length<21)return null;
  const metric=worldLandmarks&&worldLandmarks.length>=21?worldLandmarks:null,points=metric||landmarks,scale=metric?1:aspect;
  const point=index=>new THREE.Vector3(-points[index].x*scale,-points[index].y,-(points[index].z||0)*scale);
  const across=point(5).sub(point(17)),forward=point(9).sub(point(0));
  if(across.lengthSq()<1e-8||forward.lengthSq()<1e-8)return null;
  across.normalize();forward.addScaledVector(across,-forward.dot(across));if(forward.lengthSq()<1e-8)return null;
  forward.normalize();const normal=new THREE.Vector3().crossVectors(across,forward).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across,forward,normal)).normalize();
}
const median=values=>{const a=[...values].sort((a,b)=>a-b),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};

/** The archive's grab-lab controller plus gesture-lab open-palm rotation gates. */
export class RecognitionEngine{
  constructor({hitTest=()=>null,getRotation=()=>new THREE.Quaternion()}={}){this.hitTest=hitTest;this.getRotation=getRotation;this.controller=new PinchGrabController();this.startedAt=0;this.baseline=null;this.samples=[];this.fallback=false;this.resetInteraction();}
  start(now=performance.now()){this.startedAt=now;this.baseline=null;this.samples=[];this.fallback=false;this.controller=new PinchGrabController();this.resetInteraction();}
  resetInteraction(){this.controller.reset();this.openRotate=false;this.openSince=null;this.openExitSince=null;this.openHand=null;this.openLock=null;this.rotationTarget=null;this.mode=null;}
  process(results,{now=performance.now(),aspect=16/9,mode='grab'}={}){
    if(this.mode!==mode){this.resetInteraction();this.mode=mode;}
    const marks=results.multiHandLandmarks?.[0]||null,world=results.multiHandWorldLandmarks?.[0]||null;
    const analysis=marks?analyzeHand(marks,world,aspect):null;
    const handQuaternion=marks?(getHandQuaternion(marks,world,aspect)||getHandQuaternion(marks,null,aspect)):null;
    if(analysis&&!this.baseline&&analysis.extended>=1&&analysis.pinchRatio>.75){this.samples.push(analysis.pinchRatio);if(this.samples.length>30)this.samples.shift();if(this.samples.length>=18){const baseline=median(this.samples);if(this.controller.calibrate(baseline))this.baseline=baseline;}}
    if(!this.baseline&&!this.fallback&&now-this.startedAt>4500){this.fallback=true;this.controller.setThresholds({close:.42,arm:.55,release:.65});}
    const calibrated=Boolean(this.baseline||this.fallback);let hoverId=null;
    if(mode==='rotate'&&calibrated){
      const openGesture=Boolean(analysis&&analysis.extended>=3&&analysis.pinchRatio>.45),stillOpen=Boolean(analysis&&analysis.extended>=2&&analysis.pinchRatio>.3);
      if(!this.openRotate){if(openGesture&&handQuaternion){this.openSince??=now;if(now-this.openSince>=100){this.openRotate=true;this.openHand=handQuaternion.clone();this.openLock=this.getRotation().clone();this.rotationTarget=this.openLock.clone();this.openSince=null;}}else this.openSince=null;}
      else if(stillOpen&&handQuaternion){this.openExitSince=null;this.rotationTarget=handQuaternion.clone().multiply(this.openHand.clone().invert()).multiply(this.openLock).normalize();}
      else{this.openExitSince??=now;if(now-this.openExitSince>=400){this.openRotate=false;this.openHand=null;this.openLock=null;this.openExitSince=null;}}
    }
    if(mode==='grab'&&calibrated&&analysis&&this.controller.state==='POINT')hoverId=this.hitTest(analysis.pointer);
    const snapshot=this.controller.update(analysis,{now,hoverId:mode==='grab'?hoverId:null});
    return {marks,analysis,handQuaternion,calibrated,calibrationSamples:this.samples.length,baseline:this.baseline,openRotate:mode==='rotate'&&this.openRotate,rotationTarget:this.rotationTarget?.clone()||null,hoverId,snapshot,events:this.controller.drainEvents()};
  }
}

const HANDS_BASE='https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/';
let runtimePromise;
function loadScript(url,fallback){return new Promise((resolve,reject)=>{const s=document.createElement('script');let retried=false;s.src=url;s.onload=resolve;s.onerror=()=>{if(retried){s.remove();reject(new Error('手部模型资源加载失败'));}else{retried=true;s.src=fallback;}};document.head.append(s);});}
export async function startRecognitionCamera(video,onResults){
  if(!globalThis.Hands||!globalThis.Camera){runtimePromise??=Promise.all([loadScript(HANDS_BASE+'hands.js','https://unpkg.com/@mediapipe/hands@0.4.1675469240/hands.js'),loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js','https://unpkg.com/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js')]).catch(error=>{runtimePromise=null;throw error;});await runtimePromise;}
  const hands=new globalThis.Hands({locateFile:file=>HANDS_BASE+file});hands.setOptions({maxNumHands:1,modelComplexity:0,minDetectionConfidence:.62,minTrackingConfidence:.68});hands.onResults(onResults);
  const camera=new globalThis.Camera(video,{onFrame:async()=>hands.send({image:video}),width:640,height:480});
  try{await camera.start();}catch(error){camera.stop?.();hands.close?.();throw error;}
  return {hands,camera,stop(){camera.stop?.();hands.close?.();video.srcObject?.getTracks().forEach(track=>track.stop());}};
}

// Match the archive's fixed 1.30x source-pixel preview and skeleton mapping.
export function drawCameraHand(video,canvas,marks){
  const width=canvas.clientWidth||300,height=canvas.clientHeight||135,dpr=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const drawWidth=(video.videoWidth||640)*1.3,drawHeight=(video.videoHeight||480)*1.3,offsetX=(width-drawWidth)/2,offsetY=(height-drawHeight)/2;
  Object.assign(video.style,{width:drawWidth+'px',height:drawHeight+'px',maxWidth:'none',maxHeight:'none',left:'50%',top:'50%',inset:'auto',transform:'translate(-50%,-50%) scaleX(-1)',objectFit:'fill'});video.style.left='50%';video.style.top='50%';
  Object.assign(canvas.style,{inset:'0',width:'100%',height:'100%',transform:'none'});if(!marks)return;
  const points=marks.map(p=>({x:width-(offsetX+p.x*drawWidth),y:offsetY+p.y*drawHeight}));
  const pairs=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
  ctx.lineWidth=2;ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle='rgba(215,169,75,.85)';for(const [a,b]of pairs){ctx.beginPath();ctx.moveTo(points[a].x,points[a].y);ctx.lineTo(points[b].x,points[b].y);ctx.stroke();}for(let i=0;i<points.length;i++){const tip=[4,8,12,16,20].includes(i);ctx.beginPath();ctx.arc(points[i].x,points[i].y,tip?4.2:2.2,0,Math.PI*2);ctx.fillStyle=tip?'#f0d99a':'#62b49a';ctx.fill();}
}
