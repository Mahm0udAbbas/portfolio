# Clean import: SkierScan faces +Y, soles on z=0, feet centered.
import bpy, mathutils
for old in [x for x in bpy.data.scenes if x.name.startswith("SkierRig")]:
    if len(bpy.data.scenes) > 1:
        bpy.data.scenes.remove(old)
for o in list(bpy.data.objects):
    if o.name.startswith(("SkierScan", "Scan", "tmp", "world")):
        bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.data.scenes.new("SkierRig")
bpy.context.window.scene = sc
bpy.ops.import_scene.gltf(filepath=ROOT + "/blender/assets/skier/white_mesh.glb")
mesh = next(o for o in sc.objects if o.type == "MESH")
mesh.name = "SkierScan"
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
if mesh.parent:
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
for o in list(sc.objects):
    if o.type == "EMPTY":
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = mesh.data
me.transform(mathutils.Matrix.Rotation(3.14159265358979, 4, "Z"))  # face +Y
co = [v.co for v in me.vertices]
zmin = min(c.z for c in co)
feet = [c for c in co if c.z < zmin + 0.22 and abs(c.x) < 0.5 and abs(c.y) < 0.5]
fx = sum(c.x for c in feet) / len(feet)
fy = sum(c.y for c in feet) / len(feet)
me.transform(mathutils.Matrix.Translation((-fx, -fy, -zmin)))
me.update()
result = {"dims": [round(v, 3) for v in mesh.dimensions]}
