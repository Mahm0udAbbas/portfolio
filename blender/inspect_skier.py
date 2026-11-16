# Inspect the attached skier scan: import, report, render 4 views.
import bpy, math
OUT = "C:/Users/MAHMOU~1/AppData/Local/Temp/claude/3dd23b1de639733f/0a7b492a-767c-4e34-8a39-0f82790352f5/scratchpad"

# fresh scene
for old in [x for x in bpy.data.scenes if x.name.startswith("SkierInspect")]:
    if len(bpy.data.scenes) > 1:
        bpy.data.scenes.remove(old)
sc = bpy.data.scenes.new("SkierInspect")
bpy.context.window.scene = sc
bpy.ops.import_scene.gltf(filepath=ROOT + "/blender/assets/skier/white_mesh.glb")
objs = [o for o in sc.objects if o.type == "MESH"]
mesh = objs[0]
mesh.name = "Scan"
# apply any import transforms so bounds are world-space
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
d = mesh.dimensions
info = {"dims_xyz": [round(v, 3) for v in d], "verts": len(mesh.data.vertices), "tris": len(mesh.data.loop_triangles) or "n/a"}
bb = [mesh.matrix_world @ mathutils.Vector(c) for c in mesh.bound_box] if False else None
# bounds
import mathutils
pts = [mesh.matrix_world @ mathutils.Vector(c) for c in mesh.bound_box]
mn = [round(min(p[i] for p in pts), 3) for i in range(3)]
mx = [round(max(p[i] for p in pts), 3) for i in range(3)]
info["min"] = mn; info["max"] = mx

# neutral grey material so shading reads
m = material("ScanGrey", "#B8BDC6", rough=0.6)
mesh.data.materials.append(m)

# lights + floor-less studio
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(55), 0, math.radians(30))
sc.collection.objects.link(sun)
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 640
sc.world = bpy.data.worlds.new("W"); sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.94, 0.96, 1)

cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cz = (mn[2] + mx[2]) / 2
r = max(d) * 1.9
views = {"front": (0, -r, cz), "side": (r, 0, cz), "back": (0, r, cz), "top": (0.01, -0.01, mx[2] + r)}
for name, loc in views.items():
    cam.location = loc
    aim(cam, mathutils.Vector((0, 0, cz)) if name != "top" else mathutils.Vector((0, 0, cz)))
    sc.render.filepath = f"{OUT}/skier_{name}.png"
    bpy.ops.render.render(write_still=True)
result = info
