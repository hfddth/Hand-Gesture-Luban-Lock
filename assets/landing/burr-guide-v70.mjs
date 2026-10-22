export class BurrGuide {
 constructor(physics,steps){this.physics=physics;this.steps=steps;this.reset();}
 reset(){this.index=0;this.progress=0;}
 get step(){return this.steps[this.index];}
 advance(amount){
  const s=this.step;if(!s)return {done:true};const total=s.kind==='turn'?Math.abs(s.angle):s.distance,delta=Math.max(0,Math.min(amount,total-this.progress));
  let moved=0;
  if(s.kind==='turn'){const axis=[0,0,0];axis[s.axis]=1;moved=Math.abs(this.physics.turn(s.ids[0],axis,Math.sign(s.angle)*delta,s.pivot||[0,0,0]).angle);}
  else moved=Math.abs(this.physics.groupSlide(s.ids,s.vector,delta).amount);
  this.progress+=moved;
  if(total-this.progress<.0001){for(const id of s.removed||[])if(!this.physics.remove(id))throw Error('构件尚未脱离，不能完成此步');this.index++;this.progress=0;return {stepDone:true,done:!this.step};}
  return {blocked:moved<delta-.0001};
 }
}
