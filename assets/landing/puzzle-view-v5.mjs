const host = document.querySelector('.puzzle-view');
if (host) init().catch(error => {
  host.querySelector('.rotate-hint').textContent = '三维预览暂不可用';
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
  camera.position.set(8, 5.2, 9);
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
  let texture;
  try { texture = await loadWood(T); } catch { texture = makeWood(T); }
  const root = new T.Group();
  const initial = new T.Euler(.12, -.12, -.21);
  root.rotation.copy(initial);
  scene.add(root);
  buildLock(T, root, texture);

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
    renderer.render(scene, camera);
    host.classList.add('model-ready');
    if (visible && !document.hidden && (!reduce.matches || root.quaternion.angleTo(desired) > .001)) wake();
  }
  new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const half = 3.35;
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
  const source = await new T.TextureLoader().loadAsync(new URL('./wood-albedo-v5.svg', import.meta.url).href);
  // 以均匀暖木色为底，只保留细微纹理，表现细磨后的光滑木面。
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 384;
  const context = canvas.getContext('2d');
  context.fillStyle = '#bb834b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = .22;
  context.filter = 'blur(0.65px) saturate(0.7)';
  context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
  source.dispose();
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
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
  const step = .25, half = .625, length = 3;
  const bars = [
    { axis: 0, center: [0, -half, 0] }, { axis: 0, center: [0, half, 0] },
    { axis: 1, center: [0, 0, -half] }, { axis: 1, center: [0, 0, half] },
    { axis: 2, center: [-half, 0, 0] }, { axis: 2, center: [half, 0, 0] }
  ];
  const cells = new Map(), key = (x,y,z) => `${x},${y},${z}`;
  for (let x=-12;x<12;x++) for(let y=-12;y<12;y++) for(let z=-12;z<12;z++) {
    const p=[(x+.5)*step,(y+.5)*step,(z+.5)*step];
    let owner=-1,score=Infinity;
    bars.forEach((bar,id) => {
      if(Math.abs(p[bar.axis])>length) return;
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
  bars.forEach((bar,id) => {
    const positions=[],normals=[],uv=[],colors=[];
    for(const cell of cells.values()) if(cell.owner===id) for(const face of faces) {
      const other=cells.get(key(cell.x+face.n[0],cell.y+face.n[1],cell.z+face.n[2]));
      if(other?.owner===id)continue;
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
        uv.push((p[bar.axis]+length)/(length*2), p[transverse]/1.25);
      }
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const material=new T.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.0015,color:0xffffff,vertexColors:true,roughness:.82,metalness:0});
    const mesh=new T.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  });
}

