export async function createSantong(T,root,referenceMaterials,modelFile="../burr-v62/santong-model.json"){
 const response=await fetch(new URL(modelFile,import.meta.url),{cache:"no-store"});if(!response.ok)throw Error('三通模型加载失败');const data=await response.json();
 root.clear();const colors=[0xd8b080,0xa86b3b,0xc89458,0xb1824d,0xe2c293,0x8d5937,0xb19b71];
 for(const [i,part]of data.parts.entries()){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(part.uv,2));geometry.computeVertexNormals();geometry.addGroup(0,part.positions.length/3,0);
  const material=referenceMaterials[i%referenceMaterials.length].clone();material.vertexColors=false;material.color.setHex(colors[i%colors.length]);material.roughness=.59;material.metalness=.035;
  const mesh=new T.Mesh(geometry,[material]);mesh.name=part.name;mesh.userData={source:part.source,partId:part.id,sourceGeometry:true};mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 root.userData.sourceModel=['three-v70','six-v70','nine-v70'].includes(data.id)?'user-'+data.id.split('-')[0]:data.id==='meihua-v68'?'user-meihua':data.id==='santong-turn-v67'?'video-santong-turn':'user-santong';root.userData.collisionParts=data.collisionParts||null;root.userData.collisionTolerance=data.id==='three-v70'?.003:.001;root.userData.turnProfile=data.turnProfile||null;root.userData.collisionFrames=data.parts.map(p=>p.frame||[0,0,0,1]);root.userData.partCount=data.parts.length;return data;
}
