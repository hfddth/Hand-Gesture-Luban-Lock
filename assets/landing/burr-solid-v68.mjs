// Exact convex cells for low-poly wooden CAD: split coordinate cells at every
// oblique boundary plane, then classify against the closed source triangle mesh.
const EPS=1e-6;
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
const unique=points=>[...new Map(points.map(v=>[v.map(x=>Math.round(x*1e7)).join(','),v])).values()];
const centerOf=points=>[0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/points.length);
function cube(min,max){const v=[[min[0],min[1],min[2]],[max[0],min[1],min[2]],[max[0],max[1],min[2]],[min[0],max[1],min[2]],[min[0],min[1],max[2]],[max[0],min[1],max[2]],[max[0],max[1],max[2]],[min[0],max[1],max[2]]];return [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]].map(f=>f.map(i=>v[i]));}
function clip(faces,n,d){const out=[],cuts=[];for(const face of faces){const poly=[];for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],da=dot(n,a)-d,db=dot(n,b)-d;if(da<=EPS)poly.push(a);if((da<-EPS&&db>EPS)||(da>EPS&&db<-EPS)){const t=da/(da-db),p=a.map((v,k)=>v+(b[k]-v)*t);poly.push(p);cuts.push(p);}}const points=unique(poly);if(points.length>=3)out.push(points);}
 const cap=unique(cuts);if(cap.length>=3){const c=centerOf(cap),u=norm(sub(cap[0],c)),v=cross(n,u);cap.sort((a,b)=>Math.atan2(dot(sub(a,c),v),dot(sub(a,c),u))-Math.atan2(dot(sub(b,c),v),dot(sub(b,c),u)));out.push(cap);}return out;
}
function directions(vectors){const map=new Map();for(let n of vectors){if(Math.hypot(...n)<EPS)continue;n=norm(n);const k=n.findIndex(v=>Math.abs(v)>EPS);if(n[k]<0)n=n.map(v=>-v);map.set(n.map(v=>Math.round(v*1e6)).join(','),n);}return [...map.values()];}
export function decomposeSolid(positions){
 const points=[];for(let i=0;i<positions.length;i+=3)points.push(Array.from(positions.slice(i,i+3),v=>Math.round(v*1e5)/1e5));
 const coords=[0,1,2].map(k=>[...new Set(points.map(p=>p[k]))].sort((a,b)=>a-b)),planes=new Map(),triangles=[];
 for(let i=0;i<points.length;i+=3){const tri=points.slice(i,i+3),n0=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));if(Math.hypot(...n0)<EPS)continue;const n=norm(n0);triangles.push({tri,n});if(n.filter(v=>Math.abs(v)>EPS).length>1){const k=n.findIndex(v=>Math.abs(v)>EPS),sign=n[k]<0?-1:1,normal=n.map(v=>v*sign),d=dot(normal,tri[0]);planes.set([...normal,d].map(v=>Math.round(v*1e5)).join(','),{normal,d});}}
 if(planes.size>20){for(let k=0;k<3;k++){const cuts=[coords[k][0],coords[k].at(-1),...triangles.filter(t=>Math.abs(t.n[k])>1-EPS).map(t=>t.tri[0][k])];coords[k]=[...new Set(cuts)].sort((a,b)=>a-b);}}
 const rayFaces=triangles.filter(t=>Math.abs(t.n[0])>EPS);
 function inside(p){const xs=[];for(const {tri:[a,b,c],n}of rayFaces){const x=a[0]-(n[1]*(p[1]-a[1])+n[2]*(p[2]-a[2]))/n[0];if(x<=p[0]+EPS)continue;const u=[b[1]-a[1],b[2]-a[2]],v=[c[1]-a[1],c[2]-a[2]],w=[p[1]-a[1],p[2]-a[2]],den=u[0]*v[1]-u[1]*v[0],s=(w[0]*v[1]-w[1]*v[0])/den,t=(u[0]*w[1]-u[1]*w[0])/den;if(s>=-EPS&&t>=-EPS&&s+t<=1+EPS&&!xs.some(v=>Math.abs(v-x)<EPS))xs.push(x);}return xs.length%2===1;}
 // Exact triangular prisms for CAD profiles extruded through a constant thickness.
 for(let axis=0;axis<3;axis++){
  const lo=coords[axis][0],hi=coords[axis].at(-1);
  if(!triangles.every(({tri,n})=>Math.abs(n[axis])<EPS||tri.every(p=>Math.abs(p[axis]-lo)<EPS)||tri.every(p=>Math.abs(p[axis]-hi)<EPS)))continue;
  const caps=triangles.filter(({tri})=>tri.every(p=>Math.abs(p[axis]-hi)<EPS));if(!caps.length)continue;
  const cells=caps.map(({tri})=>{const vs=[...tri,...tri.map(p=>p.map((v,k)=>k===axis?lo:v))],center=centerOf(vs),normal=[0,0,0];normal[axis]=1;const edges=tri.map((p,i)=>sub(tri[(i+1)%3],p)),normals=[normal,...edges.map(e=>cross(e,normal))];return {center,half:[0,1,2].map(k=>(Math.max(...vs.map(p=>p[k]))-Math.min(...vs.map(p=>p[k])))/2),vertices:vs.map(p=>sub(p,center)),normals:directions(normals),edges:directions([...edges,normal])};});
  return {cells,min:coords.map(c=>c[0]),max:coords.map(c=>c.at(-1))};
 }
 const cells=[];for(let x=0;x<coords[0].length-1;x++)for(let y=0;y<coords[1].length-1;y++)for(let z=0;z<coords[2].length-1;z++){const idx=[x,y,z],min=idx.map((v,k)=>coords[k][v]),max=idx.map((v,k)=>coords[k][v+1]);let regions=[{faces:cube(min,max),cut:false}];
  for(const {normal,d}of planes.values()){const next=[];for(const region of regions){const dots=region.faces.flat().map(v=>dot(normal,v)-d);if(Math.min(...dots)<-EPS&&Math.max(...dots)>EPS){for(const sign of [1,-1]){const faces=clip(region.faces,normal.map(v=>v*sign),d*sign);if(faces.length>=4)next.push({faces,cut:true});}}else next.push(region);}regions=next;}
  for(const region of regions){const vertices=unique(region.faces.flat()),center=centerOf(vertices);if(!inside(center))continue;const half=[0,1,2].map(k=>(Math.max(...vertices.map(v=>v[k]))-Math.min(...vertices.map(v=>v[k])))/2);if(!region.cut){cells.push({center,half});continue;}const normals=[],edges=[];for(const f of region.faces){for(let i=0;i<f.length;i++)edges.push(sub(f[(i+1)%f.length],f[i]));for(let i=1;i<f.length-1;i++){const n=cross(sub(f[i],f[0]),sub(f[i+1],f[0]));if(Math.hypot(...n)>EPS){normals.push(n);break;}}}cells.push({center,half,vertices:vertices.map(v=>sub(v,center)),normals:directions(normals),edges:directions(edges)});}
 }
 if(!cells.length)throw Error('无法建立构件碰撞实体');return {cells,min:coords.map(c=>c[0]),max:coords.map(c=>c.at(-1))};
}
