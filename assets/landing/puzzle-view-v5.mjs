const host = document.querySelector('.puzzle-view');
if (host) init().catch(error => {
  host.querySelector('.rotate-hint').textContent = '三维预览暂不可用';
  host.setAttribute('aria-busy', 'false');
  host.classList.add('model-ready');
  host.removeAttribute('tabindex');
  console.warn('Cover model:', error);
});

async function init() {
  const { THREE: T } = await import('./three-runtime-v5.mjs');
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-4.7, 4.7, 4.7, -4.7, .1, 70);
  camera.position.set(8, 4.4, 9);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight(0xffebc3, 0x3e2515, 1.45));
  const key = new T.DirectionalLight(0xffdda0, 3.2);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .1, far: 30 });
  key.shadow.bias = -.0003;
  key.shadow.normalBias = .025;
  key.shadow.radius = 2;
  scene.add(key);
  const rim = new T.DirectionalLight(0xffbd60, 2.6);
  rim.position.set(-5, 3, -4); scene.add(rim);
  const fill = new T.DirectionalLight(0xc8dfd3, .75);
  fill.position.set(-4, 0, 5); scene.add(fill);
  const texture = makeWood(T);
  const root = new T.Group();
  const initial = new T.Euler(.08, -.18, .25);
  root.rotation.copy(initial);
  scene.add(root);
  const woodMaterials = buildLock(T, root, texture);
  const updateHalo = addHalo(T, scene, camera);
  host.dataset.halo = 'gold';
  loadWood(T).then(referenceTexture => {
    woodMaterials.forEach(material => {
      material.map = referenceTexture;
      material.bumpMap = referenceTexture;
      material.needsUpdate = true;
    });
    texture.dispose();
    host.dataset.material = 'reference-wood';
    wake();
  }).catch(() => { host.dataset.material = 'procedural-wood'; });

  let pointer = null, lastX = 0, lastY = 0, moved = false;
  const desired = root.quaternion.clone();
  const cameraQ = camera.quaternion.clone();
  const cameraInverse = cameraQ.clone().invert();
  const turn = (dx, dy) => {
    // Turn in the camera's axes, so dragging stays intuitive after any rotation.
    const q = new T.Quaternion().setFromEuler(new T.Euler(dy * .007, dx * .007, 0, 'YXZ'));
    q.premultiply(cameraQ).multiply(cameraInverse);
    desired.premultiply(q).normalize();
    moved = true;
    wake();
  };
  host.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId; lastX = event.clientX; lastY = event.clientY;
    host.setPointerCapture(pointer);
    host.classList.add('is-dragging');
    host.focus({ preventScroll: true });
    event.preventDefault();
    wake();
  });
  host.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    turn(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX; lastY = event.clientY;
    event.preventDefault();
  });
  const stop = event => {
    if (event.pointerId !== pointer) return;
    if (host.hasPointerCapture(pointer)) host.releasePointerCapture(pointer);
    pointer = null; host.classList.remove('is-dragging');
  };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => host.addEventListener(name, stop));
  const reset = () => { desired.setFromEuler(initial); moved = false; wake(); };
  host.addEventListener('dblclick', reset);
  host.addEventListener('keydown', event => {
    const keys = { ArrowLeft: [-17, 0], ArrowRight: [17, 0], ArrowUp: [0, -17], ArrowDown: [0, 17] };
    if (keys[event.key]) { event.preventDefault(); turn(...keys[event.key]); }
    if (event.key === 'Home') { event.preventDefault(); reset(); }
  });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, last = 0, visible = true;
  function wake() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw); }
  function draw(time) {
    frame = 0;
    const dt = last ? Math.min((time - last) / 1000, .05) : 1 / 60;
    last = time;
    root.quaternion.slerp(desired, reduce.matches ? 1 : 1 - Math.exp(-dt / .045));
    root.position.y = !moved && !reduce.matches ? Math.sin(time * .0008) * .07 : 0;
    updateHalo(reduce.matches ? 0 : time);
    renderer.render(scene, camera);
    host.classList.add('model-ready');
    host.setAttribute('aria-busy', 'false');
    if (visible && !document.hidden && (!reduce.matches || root.quaternion.angleTo(desired) > .001)) wake();
  }
  new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const half = 3.55;
    camera.left = -half * Math.max(1, aspect);
    camera.right = half * Math.max(1, aspect);
    camera.top = half * Math.max(1, 1 / aspect);
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); wake();
  }).observe(host);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) { last = 0; wake(); } }).observe(host);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; wake(); } });
  reduce.addEventListener('change', wake);
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); host.classList.remove('model-ready'); });
  renderer.domElement.addEventListener('webglcontextrestored', wake);
  wake();
}

async function loadWood(T) {
  const texture = await new T.TextureLoader().loadAsync(new URL('./wood-reference-v7.svg', import.meta.url).href);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeEndGrain(T) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bf8444';ctx.fillRect(0,0,256,256);
  ctx.lineWidth = 1;
  for(let radius=5;radius<220;radius+=4.3){
    ctx.strokeStyle=radius%3<1?'rgba(105,57,23,.13)':'rgba(222,168,92,.12)';
    ctx.beginPath();
    for(let i=0;i<=120;i++){
      const a=i*Math.PI/60, r=radius+Math.sin(a*5+radius*.09)*1.6+Math.sin(a*9)*.6;
      const x=118+Math.cos(a)*r,y=141+Math.sin(a)*r*.85;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=4;return texture;
}

function makeWood(T) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const context = canvas.getContext('2d');
  const data = context.createImageData(1024, 256);
  let seed = 31;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let y = 0; y < 256; y++) for (let x = 0; x < 1024; x++) {
    const wave = y + Math.sin(x * .006 + y * .03) * 8 + Math.sin(x * .019) * 1.5;
    const grain = Math.sin(wave * .6) * 2.4 + Math.sin(wave * 2.8) * .8;
    const pore = (noise() - .5) * 2;
    const i = (y * 1024 + x) * 4;
    data.data[i] = 182 + grain + pore;
    data.data[i + 1] = 101 + grain * .72 + pore;
    data.data[i + 2] = 43 + grain * .4 + pore * .65;
    data.data[i + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function buildLock(T, root, texture) {
  // Six perpendicular bars. Shared cells become complementary notches instead of intersecting solid boxes.
  const step = .2, half = .6, offset = .8, length = 3.2;
  const bars = [
    { axis: 0, center: [0, -offset, 0] }, { axis: 0, center: [0, offset, 0] },
    { axis: 1, center: [0, 0, -offset] }, { axis: 1, center: [0, 0, offset] },
    { axis: 2, center: [-offset, 0, 0] }, { axis: 2, center: [offset, 0, 0] }
  ];
  const cells = new Map(), key = (x,y,z) => `${x},${y},${z}`;
  for (let x=-16;x<16;x++) for(let y=-16;y<16;y++) for(let z=-16;z<16;z++) {
    const p=[(x+.5)*step,(y+.5)*step,(z+.5)*step];
    let owner=-1,score=Infinity;
    bars.forEach((bar,id) => {
      if(Math.abs(p[bar.axis])>length) return;
      // Open the inward seating channel, leaving a continuous outer spine.
      const inwardAxis=bar.center.findIndex(value=>value!==0);
      const towardCenter=(p[inwardAxis]-bar.center[inwardAxis])*Math.sign(bar.center[inwardAxis]);
      if(Math.abs(p[bar.axis])<1.05&&towardCenter<-.2)return;
      let cost=0;
      for(let axis=0;axis<3;axis++) if(axis!==bar.axis){const d=Math.abs(p[axis]-bar.center[axis]);if(d>half+.0001)return;cost+=d*d;}
      if(cost<score){score=cost;owner=id;}
    });
    if(owner>=0)cells.set(key(x,y,z),{x,y,z,owner});
  }
  const faces=[
    {n:[1,0,0],v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]},
    {n:[-1,0,0],v:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]},
    {n:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]},
    {n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]},
    {n:[0,0,1],v:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]},
    {n:[0,0,-1],v:[[0,1,0],[1,1,0],[1,0,0],[0,0,0]]}
  ];
  const materials = [];
  const endTexture = makeEndGrain(T);
  bars.forEach((bar,id) => {
    const positions=[],normals=[],uv=[],colors=[],groups=[];
    for(const cell of cells.values()) if(cell.owner===id) for(const face of faces) {
      const other=cells.get(key(cell.x+face.n[0],cell.y+face.n[1],cell.z+face.n[2]));
      if(other?.owner===id)continue;
      const isEnd = Math.abs(face.n[bar.axis])>.5;
      groups.push({start:positions.length/3,count:6,materialIndex:isEnd?1:0});
      for(const index of [0,1,2,0,2,3]) {
        const p=face.v[index].map((v,i)=>([cell.x,cell.y,cell.z][i]+v)*step);
        const rounded=p.slice();
        const edgeNormals=[];
        for(let axis=0;axis<3;axis++){
          const boundary=axis===bar.axis?length:half;
          const local=p[axis]-(axis===bar.axis?0:bar.center[axis]);
          if(Math.abs(Math.abs(local)-boundary)<.00001){
            const n=[0,0,0];n[axis]=Math.sign(local);edgeNormals.push(n);
          }
        }
        let normal=face.n;
        if(edgeNormals.length>1&&edgeNormals.some(n=>n.some((v,i)=>v!==0&&v===face.n[i]))){
          const merged=new T.Vector3();edgeNormals.forEach(n=>merged.add(new T.Vector3(...n)));merged.normalize();normal=merged.toArray();
          edgeNormals.forEach(n=>n.forEach((v,i)=>{rounded[i]-=v*.025;}));
        }
        positions.push(...rounded);normals.push(...normal);
        const radius=Math.hypot(...p),shade=Math.min(1,.77+radius*.075);
        colors.push(shade,shade*.99,shade*.97);
        const transverse = Math.abs(face.n[(bar.axis+1)%3])>.5 ? (bar.axis+2)%3 : (bar.axis+1)%3;
        if(isEnd){
          const axes=[0,1,2].filter(axis=>axis!==bar.axis);
          uv.push((p[axes[0]]-bar.center[axes[0]]+half)/(half*2),(p[axes[1]]-bar.center[axes[1]]+half)/(half*2));
        }else{
          uv.push((p[bar.axis]+length)/(length*2)+id*.13, (p[transverse]-bar.center[transverse])/(half*2));
        }
      }
    }
    // Two contiguous material ranges per beam keep mobile draw calls low.
    const sideGroups=groups.filter(group=>group.materialIndex===0);
    const endGroups=groups.filter(group=>group.materialIndex===1);
    const ordered=[...sideGroups,...endGroups];
    const reorder=(source,size)=>{
      const out=[];
      ordered.forEach(group=>{for(let i=group.start*size;i<(group.start+group.count)*size;i++)out.push(source[i]);});
      return out;
    };
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(reorder(positions,3),3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(reorder(normals,3),3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(reorder(uv,2),2));
    geometry.setAttribute('color',new T.Float32BufferAttribute(reorder(colors,3),3));
    const sideCount=sideGroups.reduce((sum,group)=>sum+group.count,0);
    geometry.addGroup(0,sideCount,0);
    geometry.addGroup(sideCount,positions.length/3-sideCount,1);
    geometry.translate(-bar.center[0],-bar.center[1],-bar.center[2]);
    geometry.scale(.985,.985,.985);
    geometry.translate(...bar.center);
    const material=new T.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.006,color:0xffffff,vertexColors:true,roughness:.7,metalness:0});
    const endMaterial=new T.MeshStandardMaterial({map:endTexture,bumpMap:endTexture,bumpScale:.003,color:0xffffff,vertexColors:true,roughness:.74,metalness:0});
    const mesh=new T.Mesh(geometry,[material,endMaterial]);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
    materials.push(material);
  });
  return materials;
}



function addHalo(T, scene, camera) {
  // Open, tapered light trails with depth occlusion, rather than a solid torus.
  const orbit = new T.Group();
  orbit.quaternion.copy(camera.quaternion);
  orbit.rotateZ(.18);
  const point = u => {
    const a = -.65 * Math.PI + u * Math.PI * 3.35;
    return new T.Vector3(3.55 * Math.cos(a), -1.7 + u * 3.45 + .48 * Math.sin(a), 2.9 * Math.sin(a));
  };
  const positions = [], uv = [], indices = [];
  const count = 360;
  for (let i = 0; i <= count; i++) {
    const u = i / count, p = point(u);
    const tangent = point(Math.min(1,u+.001)).sub(point(Math.max(0,u-.001)));
    const normal = new T.Vector3(-tangent.y,tangent.x,0).normalize();
    const width = .15 * (.62 + .38 * Math.sin(Math.PI*u));
    for (const side of [-1,1]) {
      positions.push(...p.clone().addScaledVector(normal,width*side).toArray());
      uv.push(u,(side+1)/2);
    }
    if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geometry.setIndex(indices);
  const material = new T.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,
    blending:T.AdditiveBlending,toneMapped:false,
    uniforms:{time:{value:0}},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      varying vec2 vUv; uniform float time;
      void main(){
        float x=vUv.x, d=abs(vUv.y-.5)*2.;
        float ends=smoothstep(0.,.085,x)*(1.-smoothstep(.90,1.,x));
        float pulse=.58+.26*sin(x*31.+.7)+.16*sin(x*77.);
        float flare=pow(max(0.,sin(x*24.-time*.35)),14.);
        float core=exp(-d*d*650.)*(.50+pulse*.50);
        float warm=exp(-d*d*75.)*(.30+flare*.48);
        float haze=exp(-d*d*5.)*(.055+flare*.09);
        vec3 color=vec3(1.,.48,.08)*(warm+haze)+vec3(1.,.86,.48)*core;
        float strength=max(color.r,max(color.g,color.b));
        gl_FragColor=vec4(color/max(strength,.0001),clamp(strength*ends,0.,1.));
      }`
  });
  orbit.add(new T.Mesh(geometry,material));
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d');
  const glow=context.createRadialGradient(32,32,0,32,32,32);
  glow.addColorStop(0,'rgba(255,245,194,1)');
  glow.addColorStop(.09,'rgba(255,207,105,.95)');
  glow.addColorStop(.25,'rgba(255,155,37,.35)');
  glow.addColorStop(1,'rgba(255,122,0,0)');
  context.fillStyle=glow;context.fillRect(0,0,64,64);
  const map=new T.CanvasTexture(canvas);
  for(let i=0;i<25;i++){
    const u=(i+.33)/25,p=point(u);
    p.x+=Math.sin(i*9.3)*.19;p.y+=Math.cos(i*5.7)*.18;
    const sprite=new T.Sprite(new T.SpriteMaterial({map,color:0xffd48a,transparent:true,opacity:.35+(i%4)*.13,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
    sprite.position.copy(p);const size=i%7===0?.21:.055+(i%3)*.018;
    sprite.scale.set(size,size,1);orbit.add(sprite);
  }
  scene.add(orbit);
  return time => {material.uniforms.time.value=time*.001;};
}
