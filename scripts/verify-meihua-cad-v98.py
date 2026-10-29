import json,sys
sys.path.insert(0,'work/meihua-tools')
import manifold3d as M
import numpy as np
from pathlib import Path
D=json.loads(Path('assets/burr-v98/meihua-model.json').read_text('utf-8'));T=json.loads(Path('outputs/meihua-trail-v98.json').read_text('utf-8'))
def rot(v,q):
 q=np.array(q);v=np.array(v);t=2*np.cross(q[:3],v);return v+q[3]*t+np.cross(q[:3],t)
solids=[]
for part,meta in zip(D['parts'],T['parts']):
 f=meta['frame'];pts=rot(np.array(part['positions']).reshape(-1,3)-meta['center'],[-f[0],-f[1],-f[2],f[3]])
 verts,ix=np.unique(np.round(pts,5),axis=0,return_inverse=True);s=M.Manifold(M.Mesh(verts.astype(np.float32),ix.reshape(-1,3).astype(np.uint32)));assert str(s.status())=='Error.NoError';solids.append(s)
def transformed(s,p):
 axes=rot(np.eye(3),p['quaternion']).T;matrix=np.column_stack([axes,p['position']]);return s.transform(matrix)
def overlap(a,b):return all(a[k]<b[k+3] and b[k]<a[k+3] for k in range(3))
maxv=0;tested=0
for i,frame in enumerate(T['trail']):
 poses=frame['poses'];cur=[transformed(s,p) for s,p in zip(solids,poses)]
 for a in frame['ids']:
  for b in range(9):
   if a==b or b in frame['removed'] or not overlap(cur[a].bounding_box(),cur[b].bounding_box()):continue
   volume=(cur[a]^cur[b]).volume();tested+=1;maxv=max(maxv,volume)
   assert volume<1e-5,(i,a,b,volume)
Path('outputs/meihua-cad-validation-v98.json').write_text(json.dumps({'frames':len(T['trail']),'solidBooleanChecks':tested,'maxIntersectionVolume':maxv},indent=2))
print('PASS',len(T['trail']),tested,maxv)
