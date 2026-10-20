/*
GitHub: matajoh/4M26-burrsolver / puzzle 0
MIT License; Copyright (c) 2024 Matthew A Johnson
Units: millimeters; source STL default scale 10; voxel edge 20 mm.
MIT License

Copyright (c) 2024 Matthew A Johnson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
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
  root.scale.setScalar(.88);
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
  const original = await new T.TextureLoader().loadAsync(new URL('./wood-reference-v7.svg', import.meta.url).href);
  const surface=document.createElement('canvas');surface.width=1024;surface.height=512;
  const paint=surface.getContext('2d');paint.filter='saturate(.68) brightness(.96)';paint.drawImage(original.image,0,0,1024,512);
  const texture=new T.CanvasTexture(surface);original.dispose();
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function makeEndGrain(T) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b98d5c';ctx.fillRect(0,0,256,256);
  ctx.lineWidth = .7;
  for(let radius=5;radius<250;radius+=3.2){
    ctx.strokeStyle=radius%3<1?'rgba(82,49,24,.24)':'rgba(229,195,137,.18)';
    ctx.beginPath();
    for(let i=0;i<=120;i++){
      const a=i*Math.PI/60, r=radius+Math.sin(a*5+radius*.09)*2.8+Math.sin(a*9+radius*.13)*1.5+Math.sin(a*13)*.7;
      const x=118+Math.cos(a)*r,y=141+Math.sin(a)*r*.85;
      i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  let grainSeed=57;for(let i=0;i<10000;i++){grainSeed=(Math.imul(grainSeed,1664525)+1013904223)|0;const x=(grainSeed>>>0)%256;grainSeed=(Math.imul(grainSeed,1664525)+1013904223)|0;const y=(grainSeed>>>0)%256;ctx.fillStyle=i%3?'rgba(65,38,19,.07)':'rgba(255,225,176,.1)';ctx.fillRect(x,y,.7,1.1);}
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
  // Source geometry kept intact; only uniform normalization and material assignments.
  const data={"vertices":[[-20,-60,-20],[-20,60,-20],[-20,60,-40],[-20,-60,-40],[-20,-60,0],[-20,-40,0],[-20,-40,-20],[-20,-60,-20],[-20,40,0],[-20,60,0],[-20,60,-20],[-20,40,-20],[-20,-60,-40],[20,-60,-40],[20,-60,0],[-20,-60,0],[-20,-20,-40],[20,-20,-40],[20,-60,-40],[-20,-60,-40],[-20,60,-40],[0,60,-40],[0,-20,-40],[-20,-20,-40],[0,60,-40],[20,60,-40],[20,20,-40],[0,20,-40],[-20,-40,0],[20,-40,0],[20,-40,-20],[-20,-40,-20],[-20,-60,0],[20,-60,0],[20,-40,0],[-20,-40,0],[-20,40,0],[20,40,0],[20,60,0],[-20,60,0],[-20,-40,-20],[20,-40,-20],[20,-20,-20],[-20,-20,-20],[-20,-20,-20],[0,-20,-20],[0,40,-20],[-20,40,-20],[0,20,-20],[20,20,-20],[20,40,-20],[0,40,-20],[0,-20,-40],[0,20,-40],[0,20,-20],[0,-20,-20],[-20,60,0],[20,60,0],[20,60,-40],[-20,60,-40],[-20,40,-20],[20,40,-20],[20,40,0],[-20,40,0],[20,-60,-40],[20,-20,-40],[20,-20,-20],[20,-60,-20],[20,-60,-20],[20,-40,-20],[20,-40,0],[20,-60,0],[20,20,-40],[20,60,-40],[20,60,-20],[20,20,-20],[20,40,-20],[20,60,-20],[20,60,0],[20,40,0],[0,-20,-20],[20,-20,-20],[20,-20,-40],[0,-20,-40],[0,20,-40],[20,20,-40],[20,20,-20],[0,20,-20],[-40,0,-20],[-40,20,-20],[-40,20,20],[-40,0,20],[-60,0,20],[-60,40,20],[-60,40,-20],[-60,0,-20],[-60,0,-20],[-40,0,-20],[-40,0,20],[-60,0,20],[-20,0,-20],[0,0,-20],[0,0,20],[-20,0,20],[40,0,-20],[60,0,-20],[60,0,20],[40,0,20],[-60,40,-20],[-40,40,-20],[-40,0,-20],[-60,0,-20],[-40,40,-20],[60,40,-20],[60,20,-20],[-40,20,-20],[-20,20,-20],[0,20,-20],[0,0,-20],[-20,0,-20],[40,20,-20],[60,20,-20],[60,0,-20],[40,0,-20],[-60,0,20],[-40,0,20],[-40,40,20],[-60,40,20],[-40,20,20],[60,20,20],[60,40,20],[-40,40,20],[-20,0,20],[0,0,20],[0,20,20],[-20,20,20],[40,0,20],[60,0,20],[60,20,20],[40,20,20],[-60,40,20],[60,40,20],[60,40,-20],[-60,40,-20],[-40,20,-20],[-20,20,-20],[-20,20,20],[-40,20,20],[0,20,-20],[40,20,-20],[40,20,20],[0,20,20],[0,0,-20],[0,20,-20],[0,20,20],[0,0,20],[-20,0,20],[-20,20,20],[-20,20,-20],[-20,0,-20],[60,0,-20],[60,40,-20],[60,40,20],[60,0,20],[40,0,20],[40,20,20],[40,20,-20],[40,0,-20],[0,-20,60],[0,20,60],[0,20,-60],[0,-20,-60],[0,-20,-60],[40,-20,-60],[40,-20,60],[0,-20,60],[0,20,-60],[40,20,-60],[40,-20,-60],[0,-20,-60],[0,-20,60],[40,-20,60],[40,20,60],[0,20,60],[0,20,60],[40,20,60],[40,20,-60],[0,20,-60],[40,-20,-60],[40,20,-60],[40,20,60],[40,-20,60],[-40,-20,-20],[-40,20,-20],[-40,20,-60],[-40,-20,-60],[-40,-20,60],[-40,20,60],[-40,20,0],[-40,-20,0],[-40,0,0],[-40,20,0],[-40,20,-20],[-40,0,-20],[-40,-20,-60],[0,-20,-60],[0,-20,-40],[-40,-20,-40],[-40,-20,-40],[-20,-20,-40],[-20,-20,-20],[-40,-20,-20],[-40,-20,0],[-20,-20,0],[-20,-20,60],[-40,-20,60],[-20,-20,40],[0,-20,40],[0,-20,60],[-20,-20,60],[-40,20,-60],[0,20,-60],[0,-20,-60],[-40,-20,-60],[-20,-20,-40],[-20,20,-40],[-20,20,-20],[-20,-20,-20],[-20,-20,0],[-20,20,0],[-20,20,40],[-20,-20,40],[-20,0,-20],[-20,20,-20],[-20,20,0],[-20,0,0],[-40,-20,-20],[-20,-20,-20],[-20,0,-20],[-40,0,-20],[-40,0,0],[-20,0,0],[-20,-20,0],[-40,-20,0],[-40,-20,60],[0,-20,60],[0,20,60],[-40,20,60],[-40,20,-40],[0,20,-40],[0,20,-60],[-40,20,-60],[-40,20,60],[-20,20,60],[-20,20,-40],[-40,20,-40],[-20,20,60],[0,20,60],[0,20,40],[-20,20,40],[-40,0,-20],[-20,0,-20],[-20,0,0],[-40,0,0],[0,-20,-60],[0,20,-60],[0,20,-40],[0,-20,-40],[0,-20,40],[0,20,40],[0,20,60],[0,-20,60],[-20,-20,-40],[0,-20,-40],[0,20,-40],[-20,20,-40],[-20,20,40],[0,20,40],[0,-20,40],[-20,-20,40],[-20,-60,40],[-20,0,40],[-20,0,0],[-20,-60,0],[-20,0,40],[-20,60,40],[-20,60,20],[-20,0,20],[-20,40,20],[-20,60,20],[-20,60,0],[-20,40,0],[-20,-60,0],[20,-60,0],[20,-60,40],[-20,-60,40],[-20,-20,0],[20,-20,0],[20,-60,0],[-20,-60,0],[-20,0,0],[0,0,0],[0,-20,0],[-20,-20,0],[-20,60,0],[20,60,0],[20,40,0],[-20,40,0],[-20,-60,40],[20,-60,40],[20,-20,40],[-20,-20,40],[-20,-20,40],[0,-20,40],[0,60,40],[-20,60,40],[0,20,40],[20,20,40],[20,60,40],[0,60,40],[0,-20,0],[0,0,0],[0,0,40],[0,-20,40],[0,0,20],[0,20,20],[0,20,40],[0,0,40],[-20,0,20],[0,0,20],[0,0,0],[-20,0,0],[-20,40,20],[0,40,20],[0,0,20],[-20,0,20],[0,40,20],[20,40,20],[20,20,20],[0,20,20],[-20,60,40],[20,60,40],[20,60,0],[-20,60,0],[-20,40,0],[20,40,0],[20,40,20],[-20,40,20],[20,-60,0],[20,-20,0],[20,-20,40],[20,-60,40],[20,20,20],[20,60,20],[20,60,40],[20,20,40],[20,40,0],[20,60,0],[20,60,20],[20,40,20],[0,-20,40],[20,-20,40],[20,-20,0],[0,-20,0],[0,20,20],[20,20,20],[20,20,40],[0,20,40],[-60,-40,20],[-60,0,20],[-60,0,-20],[-60,-40,-20],[-60,-40,-20],[60,-40,-20],[60,-40,0],[-60,-40,0],[-60,-40,0],[-20,-40,0],[-20,-40,20],[-60,-40,20],[20,-40,0],[60,-40,0],[60,-40,20],[20,-40,20],[-60,-20,-20],[60,-20,-20],[60,-40,-20],[-60,-40,-20],[-60,0,-20],[0,0,-20],[0,-20,-20],[-60,-20,-20],[40,0,-20],[60,0,-20],[60,-20,-20],[40,-20,-20],[-60,-40,20],[-20,-40,20],[-20,-20,20],[-60,-20,20],[-60,-20,20],[-40,-20,20],[-40,0,20],[-60,0,20],[20,-40,20],[60,-40,20],[60,-20,20],[20,-20,20],[40,-20,20],[60,-20,20],[60,0,20],[40,0,20],[-60,0,0],[0,0,0],[0,0,-20],[-60,0,-20],[-60,0,20],[-40,0,20],[-40,0,0],[-60,0,0],[40,0,20],[60,0,20],[60,0,-20],[40,0,-20],[-40,-20,0],[-40,0,0],[-40,0,20],[-40,-20,20],[-20,-40,0],[-20,-20,0],[-20,-20,20],[-20,-40,20],[-40,-20,20],[-20,-20,20],[-20,-20,0],[-40,-20,0],[0,-20,0],[40,-20,0],[40,-20,-20],[0,-20,-20],[20,-20,20],[40,-20,20],[40,-20,0],[20,-20,0],[-40,-20,0],[0,-20,0],[0,0,0],[-40,0,0],[-20,-40,0],[20,-40,0],[20,-20,0],[-20,-20,0],[0,-20,-20],[0,0,-20],[0,0,0],[0,-20,0],[20,-40,20],[20,-20,20],[20,-20,0],[20,-40,0],[60,-40,-20],[60,0,-20],[60,0,20],[60,-40,20],[40,-20,20],[40,0,20],[40,0,-20],[40,-20,-20]],"parts":[{"name":"Part_1","faces":[[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[16,17,18,19],[20,21,22,23],[24,25,26,27],[28,29,30,31],[32,33,34,35],[36,37,38,39],[40,41,42,43],[44,45,46,47],[48,49,50,51],[52,53,54,55],[56,57,58,59],[60,61,62,63],[64,65,66,67],[68,69,70,71],[72,73,74,75],[76,77,78,79],[80,81,82,83],[84,85,86,87]]},{"name":"Part_2","faces":[[88,89,90,91],[92,93,94,95],[96,97,98,99],[100,101,102,103],[104,105,106,107],[108,109,110,111],[112,113,114,115],[116,117,118,119],[120,121,122,123],[124,125,126,127],[128,129,130,131],[132,133,134,135],[136,137,138,139],[140,141,142,143],[144,145,146,147],[148,149,150,151],[152,153,154,155],[156,157,158,159],[160,161,162,163],[164,165,166,167]]},{"name":"Part_3","faces":[[168,169,170,171],[172,173,174,175],[176,177,178,179],[180,181,182,183],[184,185,186,187],[188,189,190,191]]},{"name":"Part_4","faces":[[192,193,194,195],[196,197,198,199],[200,201,202,203],[204,205,206,207],[208,209,210,211],[212,213,214,215],[216,217,218,219],[220,221,222,223],[224,225,226,227],[228,229,230,231],[232,233,234,235],[236,237,238,239],[240,241,242,243],[244,245,246,247],[248,249,250,251],[252,253,254,255],[256,257,258,259],[260,261,262,263],[264,265,266,267],[268,269,270,271],[272,273,274,275],[276,277,278,279]]},{"name":"Part_5","faces":[[280,281,282,283],[284,285,286,287],[288,289,290,291],[292,293,294,295],[296,297,298,299],[300,301,302,303],[304,305,306,307],[308,309,310,311],[312,313,314,315],[316,317,318,319],[320,321,322,323],[324,325,326,327],[328,329,330,331],[332,333,334,335],[336,337,338,339],[340,341,342,343],[344,345,346,347],[348,349,350,351],[352,353,354,355],[356,357,358,359],[360,361,362,363],[364,365,366,367]]},{"name":"Part_6","faces":[[368,369,370,371],[372,373,374,375],[376,377,378,379],[380,381,382,383],[384,385,386,387],[388,389,390,391],[392,393,394,395],[396,397,398,399],[400,401,402,403],[404,405,406,407],[408,409,410,411],[412,413,414,415],[416,417,418,419],[420,421,422,423],[424,425,426,427],[428,429,430,431],[432,433,434,435],[436,437,438,439],[440,441,442,443],[444,445,446,447],[448,449,450,451],[452,453,454,455],[456,457,458,459],[460,461,462,463],[464,465,466,467]]}],"center":[0,0,0],"scale":0.05333333333333334};
  const materials=[],endTexture=texture;
  const tints=[0xf6e4c8,0xcaa077,0xe5c39d,0xa97b56,0xf3dbb8,0xb98a65];
  for(const [id,part] of data.parts.entries()){
    const used=part.faces.flat().map(i=>data.vertices[i]);
    const lo=[0,1,2].map(a=>Math.min(...used.map(v=>v[a]))),hi=[0,1,2].map(a=>Math.max(...used.map(v=>v[a])));
    const axis=[0,1,2].reduce((a,b)=>hi[b]-lo[b]>hi[a]-lo[a]?b:a,0),side=[],end=[];
    for(const face of part.faces){const a=new T.Vector3(...data.vertices[face[0]]),b=new T.Vector3(...data.vertices[face[1]]),c=new T.Vector3(...data.vertices[face[2]]);const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const isEnd=Math.abs(n.getComponent(axis))>.9;const target=isEnd?end:side;
      for(let i=1;i<face.length-1;i++)for(const index of [face[0],face[i],face[i+1]]){const p=data.vertices[index],out=p.map((v,a)=>(v-data.center[a])*data.scale);const axes=[0,1,2].filter(a=>a!==axis),transverse=axes.find(a=>Math.abs(n.getComponent(a))<.5)??axes[0];const uv=isEnd?axes.map(a=>(p[a]-lo[a])/(hi[a]-lo[a])):[(p[axis]-lo[axis])/(hi[axis]-lo[axis])+id*.13,(p[transverse]-lo[transverse])/(hi[transverse]-lo[transverse])];const shade=Math.min(1,.77+Math.hypot(...out)*.075);target.push({p:out,n:n.toArray(),uv,color:[shade,shade*.99,shade*.97]});}
    }
    const ordered=[...side,...end],g=new T.BufferGeometry();for(const [name,key,size]of [['position','p',3],['normal','n',3],['uv','uv',2],['color','color',3]])g.setAttribute(name,new T.Float32BufferAttribute(ordered.flatMap(v=>v[key]),size));g.addGroup(0,side.length,0);g.addGroup(side.length,end.length,1);
    const material=new T.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.012,color:tints[id],vertexColors:true,roughness:.82,metalness:0});const endMaterial=new T.MeshStandardMaterial({map:endTexture,bumpMap:endTexture,bumpScale:.007,color:tints[id],vertexColors:true,roughness:.85,metalness:0});const mesh=new T.Mesh(g,[material,endMaterial]);mesh.name=part.name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);materials.push(material,endMaterial);
  }
  host.dataset.structure='obj-burr';host.dataset.parts=String(data.parts.length);return materials;
}

function addHalo(T, scene, camera) {
  // One closed spatial circle; a broad luminous crest tapers into a fine gold thread.
  const orbit = new T.Group();
  orbit.quaternion.copy(camera.quaternion);
  orbit.rotateZ(.30);
  const point = u => {
    const a = u * Math.PI * 2;
    return new T.Vector3(3.65 * Math.cos(a), .95 * Math.sin(a), -3.524 * Math.sin(a));
  };
  const positions = [], uv = [], indices = [];
  const count = 360;
  for (let i = 0; i <= count; i++) {
    const u = i / count, p = point(u);
    const tangent = point(u+.001).sub(point(u-.001));
    const normal = new T.Vector3(-tangent.y,tangent.x,0).normalize();
    const crest = Math.pow(.5 + .5 * Math.cos(u * Math.PI * 2 - 3.85), 5);
    const far = .5 + .5 * Math.sin(u * Math.PI * 2);
    const width = .07 + .38 * crest + .10 * far;
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
        float crest=pow(.5+.5*cos(x*6.2831853-3.85),5.);
        float nearSide=.5-.5*sin(x*6.2831853);
        float focus=smoothstep(.18,.88,nearSide);
        float veil=.50+.50*pow(.5+.5*cos(x*6.2831853-.55),2.);
        float pulse=.48+.52*crest;
        float flare=crest*(.90+.10*sin(time*.5));
        float core=exp(-d*d*mix(90.,360.,focus))*(.16+.84*focus)*(.50+pulse*.50);
        float warm=exp(-d*d*mix(16.,65.,focus))*(.12+flare*.38);
        float haze=exp(-d*d*mix(3.,6.,focus))*(.035+flare*.11);
        vec3 color=vec3(1.,.64,.10)*(warm+haze)*1.18+vec3(1.,.92,.58)*core*1.2;
        float strength=max(color.r,max(color.g,color.b));
        gl_FragColor=vec4(color/max(strength,.0001),clamp(strength*(.36+.64*focus)*veil,0.,1.));
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
  for(let i=0;i<12;i++){
    const u=(i+.33)/12,p=point(u);
    p.x+=Math.sin(i*9.3)*.19;p.y+=Math.cos(i*5.7)*.18;
    const sprite=new T.Sprite(new T.SpriteMaterial({map,color:0xffd34d,transparent:true,opacity:.35+(i%4)*.13,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
    sprite.position.copy(p);const size=i%7===0?.21:.055+(i%3)*.018;
    sprite.scale.set(size,size,1);orbit.add(sprite);
  }
  // A few gold chips catch the light; they do not form a second orbit.
  const chipGeometry = new T.BufferGeometry();
  chipGeometry.setAttribute('position',new T.Float32BufferAttribute([0,.11,0,-.035,0,0,0,-.11,0,0,.11,0,0,-.11,0,.035,0,0],3));
  const chipMaterial = new T.MeshBasicMaterial({color:0xffcf64,transparent:true,opacity:.82,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  [[-.12,.56,.06],[.57,-.3,.11],[.76,-.42,-.08]].forEach(([u,dy,dx],i)=>{
    const p=point(u);p.y+=dy;p.x+=dx;
    const chip=new T.Mesh(chipGeometry,chipMaterial);chip.position.copy(p);chip.rotation.z=-.65+i*.25;chip.scale.setScalar(.6+i*.15);orbit.add(chip);
    const glint=new T.Sprite(new T.SpriteMaterial({map,color:0xffb939,transparent:true,opacity:.4,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
    glint.position.copy(p);glint.scale.set(.38,.38,1);orbit.add(glint);
  });
  scene.add(orbit);
  return time => {material.uniforms.time.value=time*.001;};
}
