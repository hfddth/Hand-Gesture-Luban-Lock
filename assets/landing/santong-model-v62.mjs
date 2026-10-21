export async function createSantong(T,root,referenceMaterials){
 const response=await fetch(new URL('../burr-v62/santong-model.json',import.meta.url));if(!response.ok)throw Error('三通模型加载失败');const data=await response.json();
 root.clear();const colors=[0xd8b080,0xa86b3b,0xc89458];
 for(const [i,part]of data.parts.entries()){
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(part.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(part.uv,2));geometry.computeVertexNormals();geometry.addGroup(0,part.positions.length/3,0);
  const material=referenceMaterials[i%referenceMaterials.length].clone();material.vertexColors=false;material.color.setHex(colors[i%colors.length]);material.roughness=.59;material.metalness=.035;
  const mesh=new T.Mesh(geometry,[material]);mesh.name=part.name;mesh.userData={source:part.source,partId:part.id,sourceGeometry:true};mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 root.userData.sourceModel='user-santong';root.userData.partCount=data.parts.length;return data;
}

