import {RecognitionEngine as ArchiveEngine} from '../recognition-v33/engine.mjs';
export {getHandQuaternion,startRecognitionCamera,drawCameraHand,fitCameraPreview} from '../recognition-v33/engine.mjs';

// Combined application adapter for the archive's independent grab/rotation labs.
export class RecognitionEngine extends ArchiveEngine{
 resetInteraction(){super.resetInteraction();this.rotateCooldownUntil=0;}
 process(results,{now=performance.now(),aspect=16/9,mode='interact'}={}){
  if(mode!=='interact')return super.process(results,{now,aspect,mode});
  const hitTest=this.hitTest;let frame;
  if(this.openRotate||now<this.rotateCooldownUntil)this.hitTest=()=>null;
  try{frame=super.process(results,{now,aspect,mode:'grab'});}finally{this.hitTest=hitTest;}
  const {analysis,handQuaternion}=frame,open=analysis&&analysis.extended>=3&&analysis.pinchRatio>.45,still=analysis&&analysis.extended>=2&&analysis.pinchRatio>.3;
  if(frame.calibrated){
   if(!this.openRotate){if(open&&handQuaternion){this.openSince??=now;if(now-this.openSince>=100){this.openRotate=true;this.openSince=null;this.openExitSince=null;this.openHand=handQuaternion.clone();this.openLock=this.getRotation().clone();this.rotationTarget=this.openLock.clone();const held=['GRABBED','HOLD'].includes(frame.snapshot.state);this.controller.reset();frame.events=frame.events.filter(e=>!['ARM','GRAB'].includes(e.type));if(held&&!frame.events.some(e=>e.type==='RELEASE'))frame.events.push({type:'RELEASE',reason:'open-rotate'});frame.events.push({type:'OPEN_ROTATE'});}}else this.openSince=null;}
   else if(still&&handQuaternion){this.openExitSince=null;this.rotationTarget=handQuaternion.clone().multiply(this.openHand.clone().invert()).multiply(this.openLock).normalize();}
   else{this.openExitSince??=now;if(now-this.openExitSince>=400){this.openRotate=false;this.openExitSince=null;this.openHand=null;this.openLock=null;this.rotationTarget=null;this.rotateCooldownUntil=now+250;this.controller.reset();frame.events.push({type:'CLOSE_ROTATE'});}}
  }
  if(this.openRotate||now<this.rotateCooldownUntil){frame.hoverId=null;frame.snapshot={...frame.snapshot,state:this.openRotate?'ROTATE':'POINT',pointer:null};frame.events=frame.events.filter(e=>!['ARM','GRAB'].includes(e.type));}
  return {...frame,openRotate:this.openRotate,rotationTarget:this.rotationTarget?.clone()||null};
 }
}
