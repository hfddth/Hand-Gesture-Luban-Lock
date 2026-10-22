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
export function solidCells(positions){
 const points=[];for(let i=0;i<positions.length;i+=3)points.push(Array.from(positions.slice(i,i+3)));
 const coords=[0,1,2].map(a=>[...new Set(points.map(p=>Math.round(p[a]*1e5)/1e5))].sort((a,b)=>a-b));
 const faces=[];for(let i=0;i<points.length;i+=3){const [a,b,c]=points.slice(i,i+3);if(Math.abs(a[0]-b[0])<EPS&&Math.abs(a[0]-c[0])<EPS)faces.push([a,b,c]);}
 function inside(p){const crossings=[];for(const [a,b,c]of faces){if(a[0]<=p[0]+EPS)continue;const u=[b[1]-a[1],b[2]-a[2]],v=[c[1]-a[1],c[2]-a[2]],w=[p[1]-a[1],p[2]-a[2]],den=u[0]*v[1]-u[1]*v[0];if(Math.abs(den)<EPS)continue;const s=(w[0]*v[1]-w[1]*v[0])/den,t=(u[0]*w[1]-u[1]*w[0])/den;if(s>=-EPS&&t>=-EPS&&s+t<=1+EPS&&!crossings.some(x=>Math.abs(x-a[0])<EPS))crossings.push(a[0]);}return crossings.length%2===1;}
 const cells=[];for(let x=0;x<coords[0].length-1;x++)for(let y=0;y<coords[1].length-1;y++)for(let z=0;z<coords[2].length-1;z++){const indices=[x,y,z],min=indices.map((i,a)=>coords[a][i]),max=indices.map((i,a)=>coords[a][i+1]),c=min.map((v,a)=>(v+max[a])/2);if(inside(c))cells.push({center:c,half:min.map((v,a)=>(max[a]-v)/2)});}
 if(!cells.length)throw Error('无法建立构件碰撞实体');return {cells,min:coords.map(c=>c[0]),max:coords.map(c=>c.at(-1))};
}
function boxes(part,pose){const axes=[[1,0,0],[0,1,0],[0,0,1]].map(v=>rotate(v,pose.quaternion));return part.cells.map(cell=>({center:add(pose.position,rotate(cell.center,pose.quaternion)),half:cell.half,axes}));}
function aabb(b){const extent=[0,1,2].map(k=>b.half.reduce((s,h,j)=>s+h*Math.abs(b.axes[j][k]),0));return {min:sub(b.center,extent),max:add(b.center,extent)};}
function union(boxes){const bs=boxes.map(aabb);return {min:[0,1,2].map(k=>Math.min(...bs.map(b=>b.min[k]))),max:[0,1,2].map(k=>Math.max(...bs.map(b=>b.max[k])))};}
function overlapBounds(a,b){return [0,1,2].every(k=>a.max[k]>b.min[k]+CONTACT&&b.max[k]>a.min[k]+CONTACT);}
export function boxesOverlap(a,b){if(!overlapBounds(aabb(a),aabb(b)))return false;const d=sub(b.center,a.center),axes=[...a.axes,...b.axes];for(const u of a.axes)for(const v of b.axes)axes.push(cross(u,v));for(const v of axes){const n=length(v);if(n<1e-7)continue;const axis=mul(v,1/n),ra=a.half.reduce((s,h,k)=>s+h*Math.abs(dot(axis,a.axes[k])),0),rb=b.half.reduce((s,h,k)=>s+h*Math.abs(dot(axis,b.axes[k])),0);if(Math.abs(dot(d,axis))>=ra+rb-CONTACT)return false;}return true;}
export class BurrPhysics{
 constructor(geometries){this.parts=geometries.map(p=>{const data=solidCells(p),center=data.min.map((v,k)=>(v+data.max[k])/2),size=sub(data.max,data.min);return {...data,center,size,axis:size.indexOf(Math.max(...size)),cells:data.cells.map(c=>({...c,center:sub(c.center,center)}))};});this.reset();}
 reset(){this.poses=this.parts.map(p=>({position:[...p.center],quaternion:[0,0,0,1]}));this.removed=new Set();this.cache=this.parts.map((p,i)=>boxes(p,this.poses[i]));}
 collision(id,pose){const moving=boxes(this.parts[id],pose),bounds=union(moving);for(let j=0;j<this.parts.length;j++){if(j===id||this.removed.has(j)||!overlapBounds(bounds,union(this.cache[j])))continue;for(const a of moving)for(const b of this.cache[j])if(boxesOverlap(a,b))return j;}return -1;}
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
 outside(id){const current=union(this.cache[id]),others=this.cache.flatMap((boxes,j)=>j===id||this.removed.has(j)?[]:boxes);if(!others.length)return length(sub(this.poses[id].position,this.parts[id].center))>Math.max(...this.parts[id].size)*.7+.35;const rest=union(others);return [0,1,2].some(k=>current.min[k]>rest.max[k]+.15||current.max[k]<rest.min[k]-.15);}
 remove(id){if(this.removed.has(id)||!this.outside(id))return false;this.removed.add(id);return true;}
 get complete(){return this.removed.size===this.parts.length;}
 hint(){for(let id=0;id<this.parts.length;id++){if(this.removed.has(id))continue;const pose=this.poses[id];for(const axis of [this.parts[id].axis,...[0,1,2].filter(k=>k!==this.parts[id].axis)])for(const sign of [1,-1]){const v=rotate([0,0,0].map((_,k)=>k===axis?sign:0),pose.quaternion),r=this.sweep(id,{position:add(pose.position,mul(v,.35)),quaternion:pose.quaternion},false);if(length(sub(r.pose.position,pose.position))>.09)return {id,kind:'slide',axis,sign,vector:v};}for(const axis of [0,1,2])for(const sign of [1,-1]){const v=[0,0,0].map((_,k)=>k===axis?1:0),r=this.sweep(id,{position:pose.position,quaternion:qMultiply(pose.quaternion,qAxis(v,sign*Math.PI/12))},false);if(2*Math.acos(Math.min(1,Math.abs(dot4(pose.quaternion,r.pose.quaternion))))>Math.PI/90)return {id,kind:'turn',axis,sign};}}return null;}
}
