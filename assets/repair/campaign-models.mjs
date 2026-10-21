import {THREE as T} from '../landing/three-runtime-v5.mjs';
// Parametric involute construction, rebuilt for Three.js; reference:
// Leemon Baird / zkarcher / TrinaryLogic public-domain gears, collected in SOURCES.md.
export function createCampaignModel(level,wood,bronze,jade){
 const root=new T.Group(),parts={},targets={},moving=[],labels=[],supports=[];const dark=wood[3],fixed=new T.Group();root.add(fixed);
 function box(w,h,d,mat,x=0,y=0,z=0,parent=fixed){const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 function cyl(r,h,mat,x=0,y=0,z=0,parent=fixed){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,36),mat);m.rotation.x=Math.PI/2;m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
 function ring(r,mat,parent){const m=new T.Mesh(new T.TorusGeometry(r,.075,8,64),mat);parent.add(m);return m;}
 function gear(teeth,mat){const mod=.065,r=teeth*mod/2,rb=r*Math.cos(Math.PI/9),rf=Math.max(.07,r-1.25*mod),ra=r+mod,inv=v=>{const t=Math.acos(Math.min(1,rb/v));return Math.tan(t)-t;},ip=inv(r),shape=new T.Shape();let first=true;const point=(radius,a)=>{const x=radius*Math.cos(a),y=radius*Math.sin(a);if(first){shape.moveTo(x,y);first=false;}else shape.lineTo(x,y);};for(let i=0;i<teeth;i++){const a=i*Math.PI*2/teeth;point(rf,a-Math.PI/teeth);for(let j=0;j<=5;j++){const rad=Math.max(rb,rf)+(ra-Math.max(rb,rf))*j/5;point(rad,a-(Math.PI/(2*teeth)+ip-inv(rad)));}for(let j=5;j>=0;j--){const rad=Math.max(rb,rf)+(ra-Math.max(rb,rf))*j/5;point(rad,a+(Math.PI/(2*teeth)+ip-inv(rad)));}point(rf,a+Math.PI/teeth);}shape.closePath();const hole=new T.Path();hole.absarc(0,0,.075,0,Math.PI*2,true);shape.holes.push(hole);const g=new T.Group(),m=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:true,bevelSize:.009,bevelThickness:.009,bevelSegments:1}),mat);m.position.z=-.1;m.castShadow=true;g.add(m);cyl(.11,.28,bronze,0,0,0,g);return g;}
 function belt(crossed){const g=new T.Group();for(const sign of [-1,1]){const pts=[];for(let i=0;i<=40;i++){const x=-1.35+i*2.7/40,y=crossed?sign*.69*(1-2*i/40):sign*.69;pts.push(new T.Vector3(x,y,0));}const curve=new T.CatmullRomCurve3(pts);g.add(new T.Mesh(new T.TubeGeometry(curve,40,.045,6,false),dark));}for(const cx of [-1.35,1.35]){const pts=[];for(let i=0;i<=32;i++){const a=-Math.PI/2+i*Math.PI/32;pts.push(new T.Vector3(cx+Math.cos(a)*.69*(cx<0?-1:1),Math.sin(a)*.69,0));}g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),32,.045,6,false),dark));}return g;}
 function piece(p){const g=new T.Group();switch(p.kind){
case 'ratchet':{const shape=new T.Shape();for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?.79:1.02;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();g.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSize:.015,bevelThickness:.015,bevelSegments:1}),wood[1]));cyl(.14,.3,bronze,0,0,.1,g);break;}
case 'pawl':box(.7,.11,.16,bronze,.28,0,0,g);box(.12,.24,.16,bronze,.6,-.08*p.direction,0,g);cyl(.12,.23,jade,0,0,0,g);break;
case 'arm':box(.14,p.length,.16,wood[1],0,p.length/2,0,g);for(const y of [0,p.length])cyl(.1,.24,bronze,0,y,0,g);break;
case 'geneva':{cyl(.3,.22,bronze,0,0,0,g);for(let i=0;i<p.slots;i++){const a=i*Math.PI*2/p.slots;for(const sign of [-1,1]){const b=box(.68,.2,.22,wood[2],0,0,0,g);b.position.set(Math.cos(a)*.59-Math.sin(a)*sign*.16,Math.sin(a)*.59+Math.cos(a)*sign*.16,0);b.rotation.z=a;}}break;}
case 'driverpin':box(p.radius,.12,.12,bronze,p.radius/2,0,0,g);cyl(.07,.4,bronze,p.radius,0,.15,g);break;
case 'gear':return gear(p.teeth,wood[1]);case 'belt':return belt(p.crossed);case 'bearing':{const s=new T.Shape();s.moveTo(-.29,-.29);s.lineTo(.29,-.29);s.lineTo(.29,.29);s.lineTo(-.29,.29);s.closePath();const h=new T.Path();h.absarc(0,0,.12,0,Math.PI*2,true);s.holes.push(h);g.add(new T.Mesh(new T.ExtrudeGeometry(s,{depth:.18,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2}),jade));break;}case 'crank':cyl(.14,.2,bronze,0,0,0,g);box(.12,.7,.12,wood[2],0,.25,0,g);cyl(.12,.3,wood[1],0,.58,.2,g);break;case 'drum':cyl(.32,.6,wood[2],0,0,0,g);cyl(.39,.05,bronze,0,0,-.3,g);cyl(.39,.05,bronze,0,0,.3,g);break;case 'fan':for(let i=0;i<4;i++){const b=box(.23,1.2,.1,wood[2],0,0,0,g);b.rotation.z=i*Math.PI/2;}cyl(.14,.18,bronze,0,0,.1,g);break;case 'rod':box(p.length,.12,.13,wood[1],0,0,0,g);for(const x of [-p.length/2,p.length/2])cyl(.1,.16,bronze,x,0,0,g);break;case 'slider':box(.5,.52,.4,wood[1],0,0,0,g);break;case 'pin':cyl(.09,.35,bronze,0,0,0,g);cyl(.16,.05,bronze,0,0,.18,g);break;case 'rack':{box(.22,1.7,.22,wood[1],0,0,0,g);const pitch=Math.PI*p.module;for(let y=-.8;y<.8;y+=pitch)box(.15,pitch*.42,.22,wood[2],-.17,y,0,g);break;}case 'guide':box(.18,2,.4,dark,-.3,0,0,g);box(.18,2,.4,dark,.3,0,0,g);box(.7,.16,.4,bronze,0,-1,0,g);break;case 'platform':box(.9,.15,.75,wood[2],0,0,0,g);if(level.family==='parallel'){cyl(.12,.2,bronze,0,.2,0,g);box(.24,.4,.3,jade,0,.45,0,g);box(.34,.07,.4,bronze,0,.69,0,g);}break;case 'cam':cyl(.65,.24,wood[2],p.eccentric,0,0,g);cyl(.1,.3,bronze,0,0,0,g);break;case 'follower':box(.12,1.3,.16,wood[1],0,.5,0,g);cyl(.13,.2,bronze,0,-.15,.06,g);break;case 'hammer':box(.65,.35,.4,wood[3],0,0,0,g);break;}return g;}
 const solution=id=>level.parts.find(p=>p.id===level.slots.find(s=>s.id===id)?.solution);let output=new T.Vector3(1,.3,.7),source=null,stageA=null,stageB=null,idlerOut=null,beltSource=null,beltDriven=null;let sourceX=-1.5,sourceY=.45;
 box(7,.22,3.5,dark,0,-1.65,.6);box(6,.23,1.1,wood[2],0,-1.4,0);for(const x of [-2.7,2.7])box(.22,2.9,.32,wood[3],x,0,-.35);box(5.7,.2,.32,wood[2],0,1.4,-.35);
 function shaft(x,y,z=.2){box(.28,y+1.4,.4,wood[2],x,(y-1.4)/2,-.25);cyl(.065,.95,bronze,x,y,z);supports.push([x,y]);}
 function fixedWheel(x,y,r=.72){const g=new T.Group();g.position.set(x,y,.25);fixed.add(g);ring(r,wood[1],g);for(let i=0;i<8;i++){const b=box(.08,r*2,.1,dark,0,0,0,g);b.rotation.z=i*Math.PI/4;}cyl(.16,.3,bronze,0,0,0,g);return g;}
 if(['belt','belt-cross','finale'].includes(level.family)){const y=level.family==='finale'?-.45:.35;beltSource=fixedWheel(-1.8,y,.72);beltDriven=fixedWheel(.9,y,.72);source=beltSource;targets.belt=new T.Vector3(-.45,y,.48);targets.support=new T.Vector3(-1.8,y,.54);shaft(-1.8,y);shaft(.9,y);output.set(.9,y,.65);if(level.family==='finale'){sourceX=.9;sourceY=y;}}
 if(level.fixed&&level.family!=='rack'){
   source=level.family==='water'?fixedWheel(sourceX,sourceY,1.2):gear(level.fixed,wood[3]);if(level.family!=='water'){source.position.set(sourceX,sourceY,.1);fixed.add(source);}if(level.family==='water'){source.position.z=-.35;const drive=gear(level.fixed,wood[3]);drive.position.z=.5;source.add(drive);}shaft(sourceX,sourceY);targets.support??=new T.Vector3(sourceX,sourceY,.48);const a=solution('a'),ax=sourceX+(level.fixed+a.teeth)*.0325;targets.a=new T.Vector3(ax,sourceY,.16);shaft(ax,sourceY);output.set(ax,sourceY,.55);
   if(level.last){const bx=ax+(a.teeth+level.last)*.0325;idlerOut=gear(level.last,wood[2]);idlerOut.position.set(bx,sourceY,.16);fixed.add(idlerOut);shaft(bx,sourceY);output.set(bx,sourceY,.55);}
   if(level.compound){stageA=gear(level.compound,wood[3]);stageA.position.set(ax,sourceY,.52);fixed.add(stageA);const bx=ax+(level.compound+solution('b').teeth)*.0325;targets.b=new T.Vector3(bx,sourceY,.52);shaft(bx,sourceY,.4);output.set(bx,sourceY,.9);}
   targets.out=output.clone();
 }else if(['belt','belt-cross'].includes(level.family))targets.out=output.clone();
 if(level.family==='slider'){
   source=fixedWheel(-1.5,.2,.68);shaft(-1.5,.2);targets.support=new T.Vector3(-1.5,.2,.5);targets.slide=new T.Vector3(.85,.2,.45);targets.rod=new T.Vector3(-.05,.2,.55);targets.out=new T.Vector3(-.95,.2,.65);for(const y of [-.16,.56])box(3.5,.1,.2,bronze,.7,y,.25);box(.5,1.7,.5,dark,2.2,-.5,.1);
 }
 if(level.family==='rack'){
   source=gear(24,wood[3]);source.position.set(-.6,.35,.15);fixed.add(source);shaft(-.6,.35);targets.support=new T.Vector3(-.6,.35,.52);targets.guide=new T.Vector3(.6,.3,-.15);targets.rack=new T.Vector3(.38,.3,.2);targets.out=new T.Vector3(.6,1.2,.45);
 }
 if(level.family==='cam'){
   source=fixedWheel(-1.2,.3,.48);shaft(-1.2,.3);targets.support=new T.Vector3(-1.2,.3,.5);targets.cam=new T.Vector3(0,-.1,.35);targets.follow=new T.Vector3(0,.8,.45);targets.out=new T.Vector3(0,1.8,.45);shaft(0,-.1);box(.18,1.5,.25,bronze,-.24,1,.3);box(.18,1.5,.25,bronze,.24,1,.3);box(1,.2,.7,dark,.5,-1.2,.4);box(1.2,.1,.08,dark,-.6,.3,.1);
 }

 if(level.family==='ratchet'){
 source=fixedWheel(-1.75,.35,.45);shaft(-1.75,.35);shaft(.2,.25);
 targets.wheel=new T.Vector3(.2,.25,.25);targets.pawl=new T.Vector3(-.4,1.24,.45);targets.out=new T.Vector3(.2,.25,.65);cyl(.1,.5,bronze,-.4,1.24,.2);box(.14,1.6,.2,dark,-.4,.44,-.2);
 }
 if(level.family==='parallel'){
 source=new T.Group();fixed.add(source);targets.left=new T.Vector3(-1,-.65,.4);targets.right=new T.Vector3(1,-.65,.4);targets.out=new T.Vector3(0,.95,.4);for(const x of [-1,1]){shaft(x,-.65);cyl(.15,.4,jade,x,-.65,.1);}box(2.2,.14,.25,bronze,0,-.65,.1);
 }
 if(level.family==='geneva'){
 source=fixedWheel(-.6,.25,.65);shaft(-.6,.25);shaft(.6,.25);targets.wheel=new T.Vector3(.6,.25,.25);targets.pin=new T.Vector3(-.6,.25,.5);targets.out=new T.Vector3(.6,.25,.65);ring(.95,bronze,source);
 }
 for(const s of level.slots)targets[s.id]??=output.clone();
 for(const p of level.parts){const g=piece(p);g.userData.partId=p.id;g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});parts[p.id]=g;root.add(g);}
 const defaults=new Map(),initialTransforms=new Map();
 root.traverse(o=>initialTransforms.set(o,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()}));
 function reset(){for(const [o,t] of initialTransforms){o.position.copy(t.position);o.quaternion.copy(t.quaternion);o.scale.copy(t.scale);}for(const o of defaults.values())o.removeFromParent();defaults.clear();}
 function animate(t,installed){const theta=t*.75;source.rotation.z=theta;
  const a=installed.a?parts[installed.a]:null,b=installed.b?parts[installed.b]:null;const gearA=a?-level.fixed/level.parts.find(p=>p.id===installed.a).teeth:1;const beltSign=installed.belt&&level.parts.find(p=>p.id===installed.belt).crossed?-1:1;
  if(beltSource){beltSource.rotation.z=theta;beltDriven.rotation.z=theta*beltSign;}if(level.family==='finale')source.rotation.z=theta*beltSign;if(a)a.rotation.z=theta*gearA*beltSign;if(stageA)stageA.rotation.z=theta*gearA*beltSign;if(b)b.rotation.z=theta*level.ratio;
  if(idlerOut)idlerOut.rotation.z=theta*level.ratio;const out=installed.out?parts[installed.out]:null;if(out&&!['slider','rack','cam','parallel','geneva','ratchet'].includes(level.family))out.rotation.z=theta*level.ratio;
  if(['lift','compound','finale'].includes(level.family)&&out){if(!defaults.has('bucket')){const bucket=new T.Group();box(.35,.4,.32,wood[2],0,0,0,bucket);fixed.add(bucket);defaults.set('bucket',bucket);const line=new T.Mesh(new T.CylinderGeometry(.018,.018,1,8),dark);fixed.add(line);defaults.set('rope',line);}const y=-.7+Math.sin(t*.65)*.35,bu=defaults.get('bucket'),rp=defaults.get('rope');bu.position.set(output.x+.45,y,.5);rp.position.set(output.x+.45,(y+sourceY)/2,.5);rp.scale.y=Math.max(.05,sourceY-y);}

  if(level.family==='ratchet'){const cycle=t*1.7,n=Math.floor(cycle),f=cycle-n,step=Math.PI/6;const angle=(n+Math.min(1,f*2))*step;parts[installed.wheel].rotation.z=angle;out.rotation.z=angle;parts[installed.pawl].rotation.z=f<.5?Math.sin(f*Math.PI*2)*.16:0;source.rotation.z=Math.sin(cycle*Math.PI*2)*.3;}
  if(level.family==='parallel'){const a=Math.sin(t)*.55;for(const id of ['left','right'])parts[installed[id]].rotation.z=a;out.position.set(-1.6*Math.sin(a),-.65+1.6*Math.cos(a),.4);out.scale.x=2.6;out.rotation.z=0;}
  if(level.family==='geneva'){const phase=t*1.8,turn=Math.floor((phase+Math.PI)/(2*Math.PI)),a=phase-turn*2*Math.PI,limit=Math.PI/4;let step;if(a< -limit)step=-Math.PI/4;else if(a>limit)step=Math.PI/4;else step=Math.atan2(Math.SQRT1_2*Math.sin(a),1-Math.SQRT1_2*Math.cos(a));const outputAngle=-(turn*Math.PI/2+step);source.rotation.z=phase;parts[installed.pin].rotation.z=phase;parts[installed.wheel].rotation.z=outputAngle;out.rotation.z=outputAngle;}
  if(level.family==='slider'){const r=level.eccentric,L=level.parts.find(p=>p.id===installed.rod).length,xp=-1.5+r*Math.cos(theta),yp=.2+r*Math.sin(theta),xs=xp+Math.sqrt(L*L-(yp-.2)**2);const slide=parts[installed.slide],rod=parts[installed.rod],pin=parts[installed.out];slide.position.set(xs,.2,.45);rod.position.set((xs+xp)/2,(yp+.2)/2,.55);rod.rotation.z=Math.atan2(.2-yp,xs-xp);pin.position.set(xp,yp,.65);}
  if(level.family==='rack'){source.rotation.z=Math.sin(t)*1.2;const dy=-source.rotation.z*(24*.065/2);parts[installed.rack].position.y=targets.rack.y+dy;out.position.y=targets.out.y+dy;}
  if(level.family==='cam'){const cam=parts[installed.cam],f=parts[installed.follow];cam.rotation.z=theta;const e=level.parts.find(p=>p.id===installed.cam).eccentric,dy=e*Math.sin(theta)+Math.sqrt(.65**2-(e*Math.cos(theta))**2)-Math.sqrt(.65**2-e**2);f.position.y=targets.follow.y+dy;out.position.y=targets.out.y+dy;}
 }
 return {root,parts,targets,animate,reset};
}
