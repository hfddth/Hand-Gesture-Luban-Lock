import {RecognitionEngine as ArchiveEngine} from '../recognition-v33/engine.mjs';
import {PinchGrabController} from '../recognition-v33/pinch-controller.mjs?v=88';
export {startRecognitionCamera,drawCameraHand} from '../recognition-v33/engine.mjs';

export class RepairGrabController extends PinchGrabController{
 constructor(){super({timings:{releaseMs:320}});this.setThresholds({close:.68,arm:.82,release:1.02});}
 calibrate(baseline){
  if(!Number.isFinite(baseline)||baseline<.55)return false;
  const close=Math.max(.58,Math.min(.78,baseline*.65));
  this.setThresholds({close,arm:close+.12,release:Math.max(close+.24,Math.min(1.2,baseline*.88))});return true;
 }
 canArm(){const h=this.lastHand;return Boolean(h&&h.indexReach>=.75&&h.thumbReach>=.3&&(h.extended>=1||h.indexReach>=.98));}
 updateGrabbed(now){
  this.pointer={x:this.anchorPointer.x+this.palm.x-this.anchorPalm.x,y:this.anchorPointer.y+this.palm.y-this.anchorPalm.y};
  if(now-this.grabbedAt<this.timings.grabGraceMs)return;
  const h=this.lastHand,opening=h&&this.ratio>this.thresholds.release&&h.pinchLocal>.95&&h.pinch2D>this.thresholds.release*.9;
  if(opening){if(!this.releaseSince)this.releaseSince=now;if(now-this.releaseSince>=this.timings.releaseMs)this.release(now);}else this.releaseSince=0;
 }
}

// Grab-only engine: retain the archive's frozen anchor, palm dragging and HOLD.
export class RecognitionEngine extends ArchiveEngine{
 constructor(options){super(options);this.controller=new RepairGrabController();}
 start(now=performance.now()){super.start(now);this.controller=new RepairGrabController();}
 process(results,{now=performance.now(),aspect=16/9}={}){
  if(!this.baseline&&!this.fallback&&now-this.startedAt>4500){this.fallback=true;this.controller.setThresholds({close:.68,arm:.82,release:1.02});}
  return super.process(results,{now,aspect,mode:'grab'});
 }
}
