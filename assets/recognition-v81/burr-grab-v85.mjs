import {RecognitionEngine as CombinedEngine} from '../recognition-v79/engine.mjs?v=85';
import {PinchGrabController,analyzeHand} from '../recognition-v33/pinch-controller.mjs?v=85';
export {startRecognitionCamera,drawCameraHand} from '../recognition-v33/engine.mjs';

export class BurrGrabController extends PinchGrabController{
 constructor(){super();this.setThresholds({close:.68,arm:.86,release:1.08});}
 calibrate(baseline){
  if(!Number.isFinite(baseline)||baseline<.55)return false;
  const close=Math.max(.62,Math.min(.82,baseline*.65));
  this.setThresholds({close,arm:close+.12,release:close+.26});return true;
 }
 canArm(){
  const h=this.lastHand;
  return Boolean(h&&h.indexReach>=.75&&h.thumbReach>=.3&&(h.extended>=1||h.indexReach>=.98));
 }
}

// Gameplay one keeps the archive's anchor, filtering and release timing.
// A clear pinch takes priority over the separate open-palm rotation mode.
export class RecognitionEngine extends CombinedEngine{
 constructor(options){super(options);this.controller=new BurrGrabController();}
 start(now=performance.now()){super.start(now);this.controller=new BurrGrabController();}
 process(results,{now=performance.now(),aspect=16/9,mode='interact'}={}){
  if(!this.baseline&&!this.fallback&&now-this.startedAt>4500){
   this.fallback=true;this.controller.setThresholds({close:.68,arm:.86,release:1.08});
  }
  const analysis=analyzeHand(results.multiHandLandmarks?.[0],results.multiHandWorldLandmarks?.[0],aspect);
  if(this.openRotate&&analysis&&analysis.pinchRatio<=this.controller.thresholds.arm)this.resetInteraction();
  const holding=['ARMED','GRABBED','HOLD'].includes(this.controller.state);
  this.rotationOpenRatio=holding?Infinity:this.controller.thresholds.release+.05;
  this.rotationHoldRatio=this.controller.thresholds.arm+.08;
  return super.process(results,{now,aspect,mode});
 }
}

