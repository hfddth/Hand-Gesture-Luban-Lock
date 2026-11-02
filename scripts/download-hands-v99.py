import urllib.request,tarfile,io,hashlib,json
from pathlib import Path
url='https://registry.npmjs.org/@mediapipe/hands/-/hands-0.4.1675469240.tgz'
data=urllib.request.urlopen(url,timeout=45).read();tar=tarfile.open(fileobj=io.BytesIO(data),mode='r:gz');dest=Path('vendor/mediapipe/hands');dest.mkdir(parents=True,exist_ok=True)
entries=[]
for m in tar.getmembers():
 name=m.name.removeprefix('package/')
 if '/' in name or not m.isfile() or name.endswith(('.ts','.md','.json')):continue
 blob=tar.extractfile(m).read();(dest/name).write_bytes(blob);entries.append({'name':name,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()})
Path('outputs/camera-v99').mkdir(parents=True,exist_ok=True)
Path('outputs/camera-v99/vendor-manifest.json').write_text(json.dumps(entries,indent=2))
print(entries)
