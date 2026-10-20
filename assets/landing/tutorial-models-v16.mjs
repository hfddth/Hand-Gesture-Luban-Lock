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

export function buildLock(T, root, texture) {
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

