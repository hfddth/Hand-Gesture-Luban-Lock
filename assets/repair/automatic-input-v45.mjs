import {RecognitionEngine} from '../recognition-v33/engine.mjs?v=34';
// Reuse the supplied controller and palm mapping; grabbing takes priority over table rotation.
export class AutomaticRepairInput{
  constructor(options){this.grab=new RecognitionEngine(options);this.rotate=new RecognitionEngine({getRotation:options.getRotation});}
  start(now=performance.now()){this.grab.start(now);this.rotate.start(now);}
  resetInteraction(){this.grab.resetInteraction();this.rotate.resetInteraction();}
  process(results,{holding=false,...options}={}){
    const frame=this.grab.process(results,{...options,mode:'grab'});
    if(holding||['ARMED','GRABBED','HOLD'].includes(frame.snapshot.state)){
      this.rotate.resetInteraction();return {...frame,openRotate:false,rotationTarget:null};
    }
    const rotation=this.rotate.process(results,{...options,mode:'rotate'});
    return {...frame,openRotate:rotation.openRotate,rotationTarget:rotation.rotationTarget};
  }
}
