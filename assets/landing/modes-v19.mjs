
const descriptions={
 burr:{title:"榫卯解谜",copy:"观察榫木之间的咬合，寻找活榫，按正确顺序解开木中巧局。",steps:["转动视角，观察接缝与结构。","选中构件，沿合适的方向抽取。","逐一解除约束，完成拆解。"]},
 repair:{title:"机关修复",copy:"从停转的机关中寻找故障，把缺失的构件放回合适位置，让传动重新运转。",steps:["观察故障，找到缺失或错位的构件。","抓取大构件，靠近安装点后归位。","启动机关，观察修复后的联动。"]},
 treasure:{title:"机关盒寻宝",copy:"留意盒面纹样和活动面板，循着线索逐层打开机关，发现藏在其中的秘密。",steps:["旋转观察，发现隐藏线索。","尝试移动面板，逐步解开机关。","开启暗格，发现盒中珍藏。"]}
};
const cards=[...document.querySelectorAll(".mode-card")],dialog=document.getElementById("modeDialog");
let selected="burr";
try{const saved=localStorage.getItem("sunju-selected-mode");if(descriptions[saved])selected=saved;}catch{}
function choose(mode){selected=mode;cards.forEach(card=>{const active=card.dataset.mode===mode;card.classList.toggle("selected",active);card.setAttribute("aria-pressed",String(active));});document.getElementById("selectedDescription").textContent="当前选择："+descriptions[mode].title;try{localStorage.setItem("sunju-selected-mode",mode);}catch{}}
cards.forEach(card=>card.addEventListener("click",()=>choose(card.dataset.mode)));
choose(selected);
document.getElementById("modeDetails").addEventListener("click",()=>{const info=descriptions[selected];document.getElementById("modeDialogTitle").textContent=info.title;document.getElementById("modeDialogCopy").textContent=info.copy;document.getElementById("modeDialogSteps").replaceChildren(...info.steps.map(text=>{const li=document.createElement("li");li.textContent=text;return li;}));dialog.showModal();});
document.querySelectorAll("#closeDetails,.dialog-close").forEach(button=>button.addEventListener("click",()=>dialog.close()));
async function makeScenes(){
 const {THREE:T}=await import("./three-runtime-v5.mjs");
 const {buildLock}=await import("./tutorial-models-v16.mjs");
 const source=await new T.TextureLoader().loadAsync("./assets/landing/wood-reference-v7.svg");
 const canvas=document.createElement("canvas");canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext("2d");ctx.filter="saturate(.65) brightness(.94)";ctx.drawImage(source.image,0,0,1024,256);source.dispose();
 const grain=new T.CanvasTexture(canvas);grain.colorSpace=T.SRGBColorSpace;grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.anisotropy=4;
 const wood=new T.MeshStandardMaterial({map:grain,color:0xe0c79e,roughness:.65,bumpMap:grain,bumpScale:.005});
 const dark=wood.clone();dark.color.setHex(0x73502d);
 const brass=new T.MeshStandardMaterial({color:0xc9a45e,metalness:.65,roughness:.38});
 const jade=new T.MeshStandardMaterial({color:0x87b89a,roughness:.35,metalness:.12});
 function box(group,x,y,z,px,py,pz,mat=wood){const m=new T.Mesh(new T.BoxGeometry(x,y,z),mat);m.position.set(px,py,pz);m.castShadow=m.receiveShadow=true;group.add(m);return m;}
 function gear(radius,teeth,depth,mat=wood){
  const shape=new T.Shape();
  for(let i=0;i<teeth*4;i++){const angle=i/(teeth*4)*Math.PI*2,r=i%4===1||i%4===2?radius:radius*.84;const x=Math.cos(angle)*r,y=Math.sin(angle)*r;i===0?shape.moveTo(x,y):shape.lineTo(x,y);}shape.closePath();
  const hole=new T.Path();hole.absarc(0,0,radius*.15,0,Math.PI*2,true);shape.holes.push(hole);
  const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:2,steps:1});
  const uv=geo.attributes.uv,p=geo.attributes.position;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+radius)/(radius*2),(p.getY(i)+radius)/(radius*2));
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;return mesh;
 }
 const views=[];
 for(const host of document.querySelectorAll(".mode-scene")){
  const kind=host.dataset.model,scene=new T.Scene();
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:"low-power"});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.domElement.setAttribute("aria-hidden","true");host.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-3.6,3.6,3.6,-3.6,.1,40);camera.position.set(6,3.8,8);camera.lookAt(0,-.15,0);
  scene.add(new T.HemisphereLight(0xffe5b6,0x243226,2));
  const key=new T.DirectionalLight(0xffe4b6,3.1);key.position.set(3,7,5);scene.add(key);
  const rim=new T.DirectionalLight(0xffb861,1.7);rim.position.set(-5,3,-4);scene.add(rim);
  const model=new T.Group();scene.add(model);
  let driven=null,secondary=null;
  if(kind==="burr"){
   buildLock(T,model,grain);model.scale.setScalar(.82);model.rotation.set(.12,-.18,.15);
   const pedestal=new T.Mesh(new T.CylinderGeometry(2.8,2.95,.22,64),dark);pedestal.position.y=-2.65;scene.add(pedestal);
   const gold=new T.Mesh(new T.TorusGeometry(2.77,.015,6,96),brass);gold.rotation.x=-Math.PI/2;gold.position.y=-2.53;scene.add(gold);
  }else if(kind==="repair"){
   box(model,5,.25,2.7,0,-2.1,0,dark);
   for(const x of [-2,2])box(model,.32,3.35,.4,x,-.3,-.5,dark);
   const wheel=new T.Group();wheel.position.set(-.45,.1,-.6);model.add(wheel);
   const rimMesh=new T.Mesh(new T.TorusGeometry(1.7,.16,8,64),wood);wheel.add(rimMesh);
   for(let i=0;i<10;i++){const a=i*Math.PI/5;const spoke=box(wheel,3.25,.13,.16,0,0,0);spoke.rotation.z=a;const paddle=box(wheel,.42,.65,.75,Math.cos(a)*1.73,Math.sin(a)*1.73,0,dark);paddle.rotation.z=a;}
   driven=gear(1.12,14,.3);driven.position.set(-.45,-.2,.45);model.add(driven);
   secondary=gear(.74,11,.27);secondary.position.set(1.05,-1.08,.49);model.add(secondary);
   const hub=new T.Mesh(new T.CylinderGeometry(.13,.13,1.5,16),brass);hub.rotation.x=Math.PI/2;hub.position.set(-.45,-.2,.6);model.add(hub);
   const spare=gear(.55,9,.25,dark);spare.rotation.x=-Math.PI/2;spare.position.set(1.65,-1.82,1.0);model.add(spare);model.scale.setScalar(.95);
  }else{
   const y=-.4;
   box(model,4,.22,2.5,0,-1.65,0,dark);box(model,4,2.3,.18,0,y,-1.2);
   box(model,4,2.3,.18,0,y,1.2);box(model,.18,2.3,2.4,-1.9,y,0,dark);box(model,.18,2.3,2.4,1.9,y,0);
   const hinge=new T.Group();hinge.position.set(0,.86,-1.22);hinge.rotation.x=-.48;model.add(hinge);
   box(hinge,4.18,.23,2.63,0,0,1.2,wood);
   for(const x of [-1.93,1.93])box(hinge,.09,.04,2.57,x,.14,1.2,brass);
   for(const z of [-.04,2.45])box(hinge,3.95,.04,.07,0,.14,z,brass);
   const pattern=new T.Mesh(new T.TorusGeometry(.58,.035,6,6),brass);pattern.rotation.x=-Math.PI/2;pattern.position.set(0,.15,1.2);hinge.add(pattern);
   for(const x of [-1.92,1.92])for(const z of [-1.22,1.22]){
    box(model,.24,2.25,.055,x,y,z,brass);
    for(const yy of [-1.47,.65])box(model,.48,.23,.08,x*.94,yy,z,brass);
   }
   const drawer=box(model,2.55,.75,.25,0,-.65,1.58,dark);
   box(model,1.0,.13,.13,0,-.65,1.79,brass);
   const treasure=new T.Mesh(new T.DodecahedronGeometry(.5,0),jade);treasure.position.set(0,.1,0);model.add(treasure);
   const light=new T.PointLight(0xffca6b,5,8);light.position.set(0,.2,.2);scene.add(light);
   const clasp=box(model,.55,.48,.06,0,.65,1.27,brass);model.rotation.y=-.12;
  }
  const view={kind,host,renderer,scene,camera,model,driven,secondary,visible:true};views.push(view);
  new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;const aspect=width/height,half=kind==="burr"?3.15:3.0;camera.left=-half*Math.max(1,aspect);camera.right=-camera.left;camera.top=half*Math.max(1,1/aspect);camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.setSize(width,height,false);renderer.render(scene,camera);}).observe(host);
  new IntersectionObserver(entries=>{view.visible=entries[0].isIntersecting;}).observe(host);
  host.dataset.ready="true";
 }
 const reduce=matchMedia("(prefers-reduced-motion: reduce)");
 let frame=0;
 function draw(time){
  frame=0;
  for(const v of views){if(!v.visible)continue;if(!reduce.matches&&v.kind===selected){if(v.driven){v.driven.rotation.z=time*.00007;v.secondary.rotation.z=-time*.00007*14/11;}}
   v.renderer.render(v.scene,v.camera);
  }
  if(!document.hidden&&!reduce.matches)frame=requestAnimationFrame(draw);
 }
 function wake(){if(!frame)frame=requestAnimationFrame(draw);}
 document.addEventListener("visibilitychange",()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();});
 reduce.addEventListener("change",wake);cards.forEach(c=>c.addEventListener("click",wake));wake();
 document.body.dataset.ready="true";
}
makeScenes().catch(error=>{document.body.dataset.ready="fallback";console.warn("Mode previews unavailable",error);});
