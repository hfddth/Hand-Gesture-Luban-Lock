import {decomposeSolid} from './burr-solid-v68.mjs';
// Rectilinear source meshes -> exact solid cells (not the piece's outer bounding box).
// Each cell is a rigid oriented box; SAT checks all 15 separating axes after rotation.
const EPS=1e-5,CONTACT=.001;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,k)=>v-b[k]),add=(a,b)=>a.map((v,k)=>v+b[k]),mul=(a,s)=>a.map(v=>v*s),length=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const qMultiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
export function qAxis(axis,angle){const n=length(axis);return [...mul(axis,Math.sin(angle/2)/(n||1)),Math.cos(angle/2)];}
export function rotate(v,q){const t=mul(cross(q,v),2);return add(v,add(mul(t,q[3]),cross(q,t)));}
function qLerp(a,b,t){const sign=dot4(a,b)<0?-1:1,q=a.map((v,k)=>v+(b[k]*sign-v)*t),n=Math.hypot(...q);return q.map(v=>v/n);}
const dot4=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),clone=p=>({position:[...p.position],quaternion:[...p.quaternion]});
export const solidCells=decomposeSolid;
function boxes(part,pose){const axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rotate(v,pose.quaternion));return part.cells.map(cell=>{const center=add(pose.position,rotate(cell.center,pose.quaternion));return {center,half:cell.half,axes,...(cell.vertices?{vertices:cell.vertices.map(v=>add(center,rotate(v,pose.quaternion))),faceAxes:cell.normals.map(v=>rotate(v,pose.quaternion)),edgeAxes:cell.edges.map(v=>rotate(v,pose.quaternion))}:{})};});}
function aabbRaw(b){if(b.vertices)return {min:[0,1,2].map(k=>Math.min(...b.vertices.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...b.vertices.map(v=>v[k])))};const extent=[0,1,2].map(k=>b.half.reduce((s,h,j)=>s+h*Math.abs(b.axes[j][k]),0));return {min:sub(b.center,extent),max:add(b.center,extent)};}
function aabb(b){return b._bounds||(b._bounds=aabbRaw(b));}
function union(boxes){const bs=boxes.map(aabb);return {min:[0,1,2].map(k=>Math.min(...bs.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...bs.map(b=>b.max[k])))};}
function overlapBounds(a,b){return [0,1,2].every(k=>a.max[k]>b.min[k]+CONTACT&&b.max[k]>a.min[k]+CONTACT);}
export function boxesOverlap(a,b,contact=CONTACT){if(!overlapBounds(aabb(a),aabb(b)))return false;const axes=[...(a.faceAxes||a.axes),...(b.faceAxes||b.axes)];for(const u of a.edgeAxes||a.axes)for(const v of b.edgeAxes||b.axes)axes.push(cross(u,v));const interval=(box,axis)=>{if(box.vertices){const dots=box.vertices.map(v=>dot(v,axis));return [Math.min(...dots),Math.max(...dots)];}const c=dot(box.center,axis),r=box.half.reduce((s,h,k)=>s+h*Math.abs(dot(axis,box.axes[k])),0);return [c-r,c+r];};for(const v of axes){const n=length(v);if(n<1e-7)continue;const axis=mul(v,1/n),ra=interval(a,axis),rb=interval(b,axis);if(ra[1]<=rb[0]+contact||rb[1]<=ra[0]+contact)return false;}return true;}
const trees=new WeakMap();
function tree(cells){if(trees.has(cells))return trees.get(cells);const bounds=union(cells),node={bounds};if(cells.length<=6)node.cells=cells;else{const spans=bounds.max.map((v,k)=>v-bounds.min[k]),axis=spans.indexOf(Math.max(...spans)),sorted=[...cells].sort((a,b)=>a.center[axis]-b.center[axis]),mid=sorted.length>>1;node.left=tree(sorted.slice(0,mid));node.right=tree(sorted.slice(mid));}trees.set(cells,node);return node;}
function intersects(a,b,tolerance){if(!overlapBounds(a.bounds,b.bounds))return false;if(a.cells&&b.cells)return a.cells.some(x=>b.cells.some(y=>boxesOverlap(x,y,tolerance)));if(!a.cells)return intersects(a.left,b,tolerance)||intersects(a.right,b,tolerance);return intersects(a,b.left,tolerance)||intersects(a,b.right,tolerance);}
export class BurrPhysics{
 constructor(geometries,frames=[],contact=CONTACT,preparedParts=null){this.contact=contact;this.parts=preparedParts||geometries.map((positions,index)=>{const frame=frames[index]||[0,0,0,1],inverse=[-frame[0],-frame[1],-frame[2],frame[3]],local=[];for(let i=0;i<positions.length;i+=3)local.push(...rotate(positions.slice(i,i+3),inverse));const data=solidCells(local),localCenter=data.min.map((v,k)=>(v+data.max[k])/2),center=rotate(localCenter,frame),size=sub(data.max,data.min);return {...data,frame,center,size,axis:size.indexOf(Math.max(...size)),cells:data.cells.map(c=>({...c,center:sub(c.center,localCenter)}))};});this.reset();}
 reset(){this.poses=this.parts.map(p=>({position:[...p.center],quaternion:[...p.frame]}));this.removed=new Set();this.cache=this.parts.map((p,i)=>boxes(p,this.poses[i]));}
 collision(id,pose){const moving=boxes(this.parts[id],pose),bounds=union(moving);for(let j=0;j<this.parts.length;j++){if(j===id||this.removed.has(j)||!overlapBounds(bounds,union(this.cache[j])))continue;if(intersects(tree(moving),tree(this.cache[j]),this.contact))return j;}return -1;}
 sweep(id,target,commit=true){
  const start=clone(this.poses[id]);if(this.removed.has(id))return {pose:start,blocked:true,other:-1};
  if(!target||!Array.isArray(target.position)||!Array.isArray(target.quaternion)||target.position.length!==3||target.quaternion.length!==4||![...target.position,...target.quaternion].every(Number.isFinite)||Math.hypot(...target.quaternion)<.5||length(target.position)>100)return {pose:start,blocked:true,other:-1};
  target=clone(target);const qn=Math.hypot(...target.quaternion);target.quaternion=target.quaternion.map(v=>v/qn);
  const distance=length(sub(target.position,start.position)),angle=2*Math.acos(Math.min(1,Math.abs(dot4(start.quaternion,target.quaternion)))),steps=Math.max(1,Math.ceil(distance/.035),Math.ceil(angle/(Math.PI/240)));
  if(steps>4096)return {pose:start,blocked:true,other:-1};
  const at=t=>({position:add(start.position,mul(sub(target.position,start.position),t)),quaternion:qLerp(start.quaternion,target.quaternion,t)});let accepted=start,t=0,other=-1;
  for(let i=1;i<=steps;i++){const next=i/steps,p=at(next);other=this.collision(id,p);if(other>=0){let lo=t,hi=next;for(let k=0;k<9;k++){const mid=(lo+hi)/2;if(this.collision(id,at(mid))>=0)hi=mid;else lo=mid;}accepted=at(lo);break;}accepted=p;t=next;}
  if(commit){this.poses[id]=accepted;this.cache[id]=boxes(this.parts[id],accepted);}return {pose:clone(accepted),blocked:other>=0,other};
 }
 turn(id,axis,angle,pivot=[0,0,0],commit=true){
  const start=clone(this.poses[id]),fixed=add(start.position,rotate(pivot,start.quaternion));
  if(!Number.isFinite(angle)||Math.abs(angle)>Math.PI*8||this.removed.has(id))return {pose:start,blocked:true,other:-1,angle:0};
  const at=t=>{const quaternion=qMultiply(start.quaternion,qAxis(axis,angle*t));return {position:sub(fixed,rotate(pivot,quaternion)),quaternion};};
  const steps=Math.max(1,Math.ceil(Math.abs(angle)/(Math.PI/240)));let accepted=start,t=0,other=-1;
  for(let i=1;i<=steps;i++){const next=i/steps,p=at(next);other=this.collision(id,p);if(other>=0){let lo=t,hi=next;for(let k=0;k<9;k++){const m=(lo+hi)/2;if(this.collision(id,at(m))>=0)hi=m;else lo=m;}t=lo;accepted=at(t);break;}accepted=p;t=next;}
  if(commit){this.poses[id]=accepted;this.cache[id]=boxes(this.parts[id],accepted);}return {pose:clone(accepted),blocked:other>=0,other,angle:angle*t};
 }
 groupSlide(ids,vector,distance,commit=true){
 const starts=ids.map(id=>clone(this.poses[id])),removed=this.removed,steps=Math.max(1,Math.ceil(Math.abs(distance)/.035));let amount=0,blocked=false;
 this.removed=new Set([...removed,...ids]);
 for(let i=1;i<=steps;i++){const a=distance*i/steps;if(ids.some((id,j)=>this.collision(id,{position:starts[j].position.map((v,k)=>v+vector[k]*a),quaternion:starts[j].quaternion})>=0)){blocked=true;let lo=amount,hi=a;for(let j=0;j<12;j++){const mid=(lo+hi)/2;if(ids.some((id,k)=>this.collision(id,{position:starts[k].position.map((v,c)=>v+vector[c]*mid),quaternion:starts[k].quaternion})>=0))hi=mid;else lo=mid;}amount=lo;break;}amount=a;}
 this.removed=removed;const poses=starts.map(p=>({position:p.position.map((v,k)=>v+vector[k]*amount),quaternion:p.quaternion}));if(commit)ids.forEach((id,i)=>{this.poses[id]=poses[i];this.cache[id]=boxes(this.parts[id],poses[i]);});return {poses,amount,blocked};
 }
 outside(id){const current=union(this.cache[id]),others=this.cache.flatMap((boxes,j)=>j===id||this.removed.has(j)?[]:boxes);if(!others.length)return length(sub(this.poses[id].position,this.parts[id].center))>Math.max(...this.parts[id].size)*.7+.35;const rest=union(others);return [0,1,2].some(k=>current.min[k]>rest.max[k]+.15||current.max[k]<rest.min[k]-.15);}
 remove(id){if(this.removed.has(id)||!this.outside(id))return false;this.removed.add(id);return true;}
 get complete(){return this.removed.size===this.parts.length;}
 hint(){for(let id=0;id<this.parts.length;id++){if(this.removed.has(id))continue;const pose=this.poses[id];for(const axis of [this.parts[id].axis,...[0,1,2].filter(k=>k!==this.parts[id].axis)])for(const sign of [1,-1]){const v=rotate([0,0,0].map((_,k)=>k===axis?sign:0),pose.quaternion),r=this.sweep(id,{position:add(pose.position,mul(v,.35)),quaternion:pose.quaternion},false);if(length(sub(r.pose.position,pose.position))>.09)return {id,kind:'slide',axis,sign,vector:v};}for(const axis of [0,1,2])for(const sign of [1,-1]){const v=[0,0,0].map((_,k)=>k===axis?1:0),r=this.sweep(id,{position:pose.position,quaternion:qMultiply(pose.quaternion,qAxis(v,sign*Math.PI/12))},false);if(2*Math.acos(Math.min(1,Math.abs(dot4(pose.quaternion,r.pose.quaternion))))>Math.PI/90)return {id,kind:'turn',axis,sign};}}return null;}
}
