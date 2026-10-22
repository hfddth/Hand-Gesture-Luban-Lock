// Game interaction model: slide each independent piece along its own longitudinal axis.
// Source meshes remain intact. This is an axial disassembly interaction, not a CAD collision solver.
export class AxialExtraction{
 constructor(bounds){this.bounds=bounds;this.axes=bounds.map(b=>[0,1,2].reduce((a,k)=>b.max[k]-b.min[k]>b.max[a]-b.min[a]?k:a,0));this.reset();}
 reset(){this.offsets=this.bounds.map(()=>0);this.removed=new Set();}
 distance(id,sign){const axis=this.axes[id],b=this.bounds[id],others=this.bounds.filter((_,j)=>j!==id&&!this.removed.has(j));if(!others.length)return (b.max[axis]-b.min[axis])*.65+.4;return sign>0?Math.max(.8,Math.max(...others.map(o=>o.max[axis]))-b.min[axis]+.4):Math.max(.8,b.max[axis]-Math.min(...others.map(o=>o.min[axis]))+.4);}
 move(id,offset){if(this.removed.has(id)||!Number.isFinite(offset))return {complete:false,offset:this.offsets[id]};const sign=offset<0?-1:1,required=this.distance(id,sign);this.offsets[id]=Math.max(-this.distance(id,-1),Math.min(this.distance(id,1),offset));return {complete:Math.abs(offset)>=required,offset:this.offsets[id],fraction:Math.min(1,Math.abs(offset)/required)};}
 remove(id){if(this.removed.has(id))return false;this.removed.add(id);return true;}
 get complete(){return this.removed.size===this.bounds.length;}
}

