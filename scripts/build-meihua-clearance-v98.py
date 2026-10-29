"""Offline CAD clearance correction. Requires manifold3d and numpy.

Only key petal 0 is machined; the other eight user-supplied solids are unchanged.
The square neck is 3.4 mm across in a 5 mm opening: its 4.81 mm diagonal fits
during rotation. Shoulder relief is a 5% transverse trim, preserving the notches
by INTERSECTION rather than scaling concave vertices into occupied space.
"""
import copy, json, sys
from pathlib import Path
sys.path.insert(0, 'work/meihua-tools')
import manifold3d as M
import numpy as np

source = json.loads(Path('assets/burr-v68/meihua-model.json').read_text('utf-8'))
out = copy.deepcopy(source)
part = out['parts'][0]
frame = part['frame']
inverse = [-frame[0], -frame[1], -frame[2], frame[3]]

def rotate(points, q):
    points, q = np.array(points), np.array(q)
    t = 2 * np.cross(q[:3], points)
    return points + q[3] * t + np.cross(q[:3], t)

points = np.round(rotate(np.array(part['positions']).reshape(-1, 3), inverse), 5)
vertices, indices = np.unique(points, axis=0, return_inverse=True)
original = M.Manifold(M.Mesh(vertices.astype(np.float32), indices.reshape(-1, 3).astype(np.uint32)))
u = 3 / 7  # five millimetres in the imported model's unchanged scale
neck_center = np.array([0, -u / 2, -2.5 * u])

def box(lo, hi):
    return M.Manifold.cube(tuple(np.array(hi) - lo)).translate(lo)

# Stop the machining span just inside the shoulder to keep a watertight join.
neck_region = box(np.array([-u + .00002, -u, -3*u]), np.array([u - .00002, 0, -2*u]))
inner = box([-10, neck_center[1] - u*.34, neck_center[2] - u*.34],
            [10, neck_center[1] + u*.34, neck_center[2] + u*.34])
neck = original - (neck_region - inner)
relief = original.translate((-neck_center).tolist()).scale([1, .95, .95]).translate(neck_center.tolist())
corrected = neck ^ relief
assert str(corrected.status()) == 'Error.NoError'
assert len(corrected.decompose()) == 1, 'Key must remain one connected solid'
assert (corrected - original).volume() < 1e-8, 'Machining must never add interfering material'
mesh = corrected.to_mesh()
local = mesh.vert_properties[mesh.tri_verts].reshape(-1, 3)
part['positions'] = rotate(local, frame).reshape(-1).round(6).tolist()
part['uv'] = np.column_stack([local[:,0]*2, (local[:,1]+local[:,2])*2]).reshape(-1).round(6).tolist()
part['triangles'] = len(local) // 3
out['revision'] = 'meihua-clearance-v98'
out['clearance'] = {'keyPart': 0, 'neckWidthMm': 3.4, 'openingWidthMm': 5, 'shoulderScale': .95}
# Physics rounds local source coordinates to five decimals before recentering.
rounded = np.round(local, 5)
local_center = (rounded.min(axis=0) + rounded.max(axis=0)) / 2
out['turnProfile'] = {'id': 0, 'axis': 0, 'pivot': (neck_center-local_center).tolist(), 'sign': -1, 'angle': np.pi/2}
folder = Path('assets/burr-v98')
folder.mkdir(exist_ok=True)
(folder/'meihua-model.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), 'utf-8')
print(json.dumps({'triangles':part['triangles'], 'retainedVolume':corrected.volume()/original.volume(), 'turnProfile':out['turnProfile']}))
