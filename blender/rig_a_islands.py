# Step A: analyze the scan's connected islands (body / skis / poles?) in a dedicated scene.
import bpy, mathutils
for old in [x for x in bpy.data.scenes if x.name.startswith("SkierRig")]:
    if len(bpy.data.scenes) > 1:
        bpy.data.scenes.remove(old)
# purge leftovers from inspection
for o in list(bpy.data.objects):
    if o.name.startswith(("Scan", "tmp")):
        bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.data.scenes.new("SkierRig")
bpy.context.window.scene = sc
bpy.ops.import_scene.gltf(filepath=ROOT + "/blender/assets/skier/white_mesh.glb")
mesh = next(o for o in sc.objects if o.type == "MESH")
mesh.name = "SkierScan"
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# face +Y like the primitive skier (scan faces -Y)
mesh.rotation_euler = (0, 0, 3.14159265)
bpy.ops.object.transform_apply(rotation=True)

me = mesh.data
n = len(me.vertices)
parent = list(range(n))
def find(a):
    while parent[a] != a:
        parent[a] = parent[parent[a]]
        a = parent[a]
    return a
for e in me.edges:
    a, b = find(e.vertices[0]), find(e.vertices[1])
    if a != b:
        parent[a] = b
from collections import defaultdict
groups = defaultdict(list)
for i in range(n):
    groups[find(i)].append(i)
isl = []
for root, idxs in groups.items():
    xs = [me.vertices[i].co for i in idxs]
    mn = [round(min(c[k] for c in xs), 3) for k in range(3)]
    mx = [round(max(c[k] for c in xs), 3) for k in range(3)]
    isl.append({"n": len(idxs), "min": mn, "max": mx})
isl.sort(key=lambda d: -d["n"])
result = {"islands": len(isl), "top": isl[:12]}
