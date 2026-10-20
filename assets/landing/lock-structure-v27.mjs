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
async function loadWood(T) {
  const original = await new T.TextureLoader().loadAsync(new URL('./wood-reference-v7.svg', import.meta.url).href);
  const surface=document.createElement('canvas');surface.width=1024;surface.height=512;
  const paint=surface.getContext('2d');paint.filter='saturate(.68) brightness(1.08)';paint.drawImage(original.image,0,0,1024,512);
  const texture=new T.CanvasTexture(surface);original.dispose();
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
  // Source geometry kept intact; only uniform normalization and material assignments.
  const data={"vertices":[[-20,-60,-20],[-20,60,-20],[-20,60,-40],[-20,-60,-40],[-20,-60,0],[-20,-40,0],[-20,-40,-20],[-20,-60,-20],[-20,40,0],[-20,60,0],[-20,60,-20],[-20,40,-20],[-20,-60,-40],[20,-60,-40],[20,-60,0],[-20,-60,0],[-20,-20,-40],[20,-20,-40],[20,-60,-40],[-20,-60,-40],[-20,60,-40],[0,60,-40],[0,-20,-40],[-20,-20,-40],[0,60,-40],[20,60,-40],[20,20,-40],[0,20,-40],[-20,-40,0],[20,-40,0],[20,-40,-20],[-20,-40,-20],[-20,-60,0],[20,-60,0],[20,-40,0],[-20,-40,0],[-20,40,0],[20,40,0],[20,60,0],[-20,60,0],[-20,-40,-20],[20,-40,-20],[20,-20,-20],[-20,-20,-20],[-20,-20,-20],[0,-20,-20],[0,40,-20],[-20,40,-20],[0,20,-20],[20,20,-20],[20,40,-20],[0,40,-20],[0,-20,-40],[0,20,-40],[0,20,-20],[0,-20,-20],[-20,60,0],[20,60,0],[20,60,-40],[-20,60,-40],[-20,40,-20],[20,40,-20],[20,40,0],[-20,40,0],[20,-60,-40],[20,-20,-40],[20,-20,-20],[20,-60,-20],[20,-60,-20],[20,-40,-20],[20,-40,0],[20,-60,0],[20,20,-40],[20,60,-40],[20,60,-20],[20,20,-20],[20,40,-20],[20,60,-20],[20,60,0],[20,40,0],[0,-20,-20],[20,-20,-20],[20,-20,-40],[0,-20,-40],[0,20,-40],[20,20,-40],[20,20,-20],[0,20,-20],[-40,0,-20],[-40,20,-20],[-40,20,20],[-40,0,20],[-60,0,20],[-60,40,20],[-60,40,-20],[-60,0,-20],[-60,0,-20],[-40,0,-20],[-40,0,20],[-60,0,20],[-20,0,-20],[0,0,-20],[0,0,20],[-20,0,20],[40,0,-20],[60,0,-20],[60,0,20],[40,0,20],[-60,40,-20],[-40,40,-20],[-40,0,-20],[-60,0,-20],[-40,40,-20],[60,40,-20],[60,20,-20],[-40,20,-20],[-20,20,-20],[0,20,-20],[0,0,-20],[-20,0,-20],[40,20,-20],[60,20,-20],[60,0,-20],[40,0,-20],[-60,0,20],[-40,0,20],[-40,40,20],[-60,40,20],[-40,20,20],[60,20,20],[60,40,20],[-40,40,20],[-20,0,20],[0,0,20],[0,20,20],[-20,20,20],[40,0,20],[60,0,20],[60,20,20],[40,20,20],[-60,40,20],[60,40,20],[60,40,-20],[-60,40,-20],[-40,20,-20],[-20,20,-20],[-20,20,20],[-40,20,20],[0,20,-20],[40,20,-20],[40,20,20],[0,20,20],[0,0,-20],[0,20,-20],[0,20,20],[0,0,20],[-20,0,20],[-20,20,20],[-20,20,-20],[-20,0,-20],[60,0,-20],[60,40,-20],[60,40,20],[60,0,20],[40,0,20],[40,20,20],[40,20,-20],[40,0,-20],[0,-20,60],[0,20,60],[0,20,-60],[0,-20,-60],[0,-20,-60],[40,-20,-60],[40,-20,60],[0,-20,60],[0,20,-60],[40,20,-60],[40,-20,-60],[0,-20,-60],[0,-20,60],[40,-20,60],[40,20,60],[0,20,60],[0,20,60],[40,20,60],[40,20,-60],[0,20,-60],[40,-20,-60],[40,20,-60],[40,20,60],[40,-20,60],[-40,-20,-20],[-40,20,-20],[-40,20,-60],[-40,-20,-60],[-40,-20,60],[-40,20,60],[-40,20,0],[-40,-20,0],[-40,0,0],[-40,20,0],[-40,20,-20],[-40,0,-20],[-40,-20,-60],[0,-20,-60],[0,-20,-40],[-40,-20,-40],[-40,-20,-40],[-20,-20,-40],[-20,-20,-20],[-40,-20,-20],[-40,-20,0],[-20,-20,0],[-20,-20,60],[-40,-20,60],[-20,-20,40],[0,-20,40],[0,-20,60],[-20,-20,60],[-40,20,-60],[0,20,-60],[0,-20,-60],[-40,-20,-60],[-20,-20,-40],[-20,20,-40],[-20,20,-20],[-20,-20,-20],[-20,-20,0],[-20,20,0],[-20,20,40],[-20,-20,40],[-20,0,-20],[-20,20,-20],[-20,20,0],[-20,0,0],[-40,-20,-20],[-20,-20,-20],[-20,0,-20],[-40,0,-20],[-40,0,0],[-20,0,0],[-20,-20,0],[-40,-20,0],[-40,-20,60],[0,-20,60],[0,20,60],[-40,20,60],[-40,20,-40],[0,20,-40],[0,20,-60],[-40,20,-60],[-40,20,60],[-20,20,60],[-20,20,-40],[-40,20,-40],[-20,20,60],[0,20,60],[0,20,40],[-20,20,40],[-40,0,-20],[-20,0,-20],[-20,0,0],[-40,0,0],[0,-20,-60],[0,20,-60],[0,20,-40],[0,-20,-40],[0,-20,40],[0,20,40],[0,20,60],[0,-20,60],[-20,-20,-40],[0,-20,-40],[0,20,-40],[-20,20,-40],[-20,20,40],[0,20,40],[0,-20,40],[-20,-20,40],[-20,-60,40],[-20,0,40],[-20,0,0],[-20,-60,0],[-20,0,40],[-20,60,40],[-20,60,20],[-20,0,20],[-20,40,20],[-20,60,20],[-20,60,0],[-20,40,0],[-20,-60,0],[20,-60,0],[20,-60,40],[-20,-60,40],[-20,-20,0],[20,-20,0],[20,-60,0],[-20,-60,0],[-20,0,0],[0,0,0],[0,-20,0],[-20,-20,0],[-20,60,0],[20,60,0],[20,40,0],[-20,40,0],[-20,-60,40],[20,-60,40],[20,-20,40],[-20,-20,40],[-20,-20,40],[0,-20,40],[0,60,40],[-20,60,40],[0,20,40],[20,20,40],[20,60,40],[0,60,40],[0,-20,0],[0,0,0],[0,0,40],[0,-20,40],[0,0,20],[0,20,20],[0,20,40],[0,0,40],[-20,0,20],[0,0,20],[0,0,0],[-20,0,0],[-20,40,20],[0,40,20],[0,0,20],[-20,0,20],[0,40,20],[20,40,20],[20,20,20],[0,20,20],[-20,60,40],[20,60,40],[20,60,0],[-20,60,0],[-20,40,0],[20,40,0],[20,40,20],[-20,40,20],[20,-60,0],[20,-20,0],[20,-20,40],[20,-60,40],[20,20,20],[20,60,20],[20,60,40],[20,20,40],[20,40,0],[20,60,0],[20,60,20],[20,40,20],[0,-20,40],[20,-20,40],[20,-20,0],[0,-20,0],[0,20,20],[20,20,20],[20,20,40],[0,20,40],[-60,-40,20],[-60,0,20],[-60,0,-20],[-60,-40,-20],[-60,-40,-20],[60,-40,-20],[60,-40,0],[-60,-40,0],[-60,-40,0],[-20,-40,0],[-20,-40,20],[-60,-40,20],[20,-40,0],[60,-40,0],[60,-40,20],[20,-40,20],[-60,-20,-20],[60,-20,-20],[60,-40,-20],[-60,-40,-20],[-60,0,-20],[0,0,-20],[0,-20,-20],[-60,-20,-20],[40,0,-20],[60,0,-20],[60,-20,-20],[40,-20,-20],[-60,-40,20],[-20,-40,20],[-20,-20,20],[-60,-20,20],[-60,-20,20],[-40,-20,20],[-40,0,20],[-60,0,20],[20,-40,20],[60,-40,20],[60,-20,20],[20,-20,20],[40,-20,20],[60,-20,20],[60,0,20],[40,0,20],[-60,0,0],[0,0,0],[0,0,-20],[-60,0,-20],[-60,0,20],[-40,0,20],[-40,0,0],[-60,0,0],[40,0,20],[60,0,20],[60,0,-20],[40,0,-20],[-40,-20,0],[-40,0,0],[-40,0,20],[-40,-20,20],[-20,-40,0],[-20,-20,0],[-20,-20,20],[-20,-40,20],[-40,-20,20],[-20,-20,20],[-20,-20,0],[-40,-20,0],[0,-20,0],[40,-20,0],[40,-20,-20],[0,-20,-20],[20,-20,20],[40,-20,20],[40,-20,0],[20,-20,0],[-40,-20,0],[0,-20,0],[0,0,0],[-40,0,0],[-20,-40,0],[20,-40,0],[20,-20,0],[-20,-20,0],[0,-20,-20],[0,0,-20],[0,0,0],[0,-20,0],[20,-40,20],[20,-20,20],[20,-20,0],[20,-40,0],[60,-40,-20],[60,0,-20],[60,0,20],[60,-40,20],[40,-20,20],[40,0,20],[40,0,-20],[40,-20,-20]],"parts":[{"name":"Part_1","faces":[[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],[16,17,18,19],[20,21,22,23],[24,25,26,27],[28,29,30,31],[32,33,34,35],[36,37,38,39],[40,41,42,43],[44,45,46,47],[48,49,50,51],[52,53,54,55],[56,57,58,59],[60,61,62,63],[64,65,66,67],[68,69,70,71],[72,73,74,75],[76,77,78,79],[80,81,82,83],[84,85,86,87]]},{"name":"Part_2","faces":[[88,89,90,91],[92,93,94,95],[96,97,98,99],[100,101,102,103],[104,105,106,107],[108,109,110,111],[112,113,114,115],[116,117,118,119],[120,121,122,123],[124,125,126,127],[128,129,130,131],[132,133,134,135],[136,137,138,139],[140,141,142,143],[144,145,146,147],[148,149,150,151],[152,153,154,155],[156,157,158,159],[160,161,162,163],[164,165,166,167]]},{"name":"Part_3","faces":[[168,169,170,171],[172,173,174,175],[176,177,178,179],[180,181,182,183],[184,185,186,187],[188,189,190,191]]},{"name":"Part_4","faces":[[192,193,194,195],[196,197,198,199],[200,201,202,203],[204,205,206,207],[208,209,210,211],[212,213,214,215],[216,217,218,219],[220,221,222,223],[224,225,226,227],[228,229,230,231],[232,233,234,235],[236,237,238,239],[240,241,242,243],[244,245,246,247],[248,249,250,251],[252,253,254,255],[256,257,258,259],[260,261,262,263],[264,265,266,267],[268,269,270,271],[272,273,274,275],[276,277,278,279]]},{"name":"Part_5","faces":[[280,281,282,283],[284,285,286,287],[288,289,290,291],[292,293,294,295],[296,297,298,299],[300,301,302,303],[304,305,306,307],[308,309,310,311],[312,313,314,315],[316,317,318,319],[320,321,322,323],[324,325,326,327],[328,329,330,331],[332,333,334,335],[336,337,338,339],[340,341,342,343],[344,345,346,347],[348,349,350,351],[352,353,354,355],[356,357,358,359],[360,361,362,363],[364,365,366,367]]},{"name":"Part_6","faces":[[368,369,370,371],[372,373,374,375],[376,377,378,379],[380,381,382,383],[384,385,386,387],[388,389,390,391],[392,393,394,395],[396,397,398,399],[400,401,402,403],[404,405,406,407],[408,409,410,411],[412,413,414,415],[416,417,418,419],[420,421,422,423],[424,425,426,427],[428,429,430,431],[432,433,434,435],[436,437,438,439],[440,441,442,443],[444,445,446,447],[448,449,450,451],[452,453,454,455],[456,457,458,459],[460,461,462,463],[464,465,466,467]]}],"center":[0,0,0],"scale":0.05333333333333334};
  const materials=[],endTexture=texture;
  const tints=[0xffefd7,0xddba94,0xf1d5b0,0xc29770,0xf9e2bf,0xcda17b];
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
  root.userData.structure='obj-burr';root.userData.parts=data.parts.length;return materials;
}


export async function createCoverLock(T,root){const fallback=makeWood(T);const materials=buildLock(T,root,fallback);const reference=await loadWood(T);for(const material of materials){material.map=reference;material.bumpMap=reference;material.needsUpdate=true;}fallback.dispose();return root;}
