import bpy, math, mathutils
OUT = "C:/Users/MAHMOU~1/AppData/Local/Temp/claude/3dd23b1de639733f/0a7b492a-767c-4e34-8a39-0f82790352f5/scratchpad"
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
for o in list(sc.objects):
    if o.name.startswith("MK_"):
        bpy.data.objects.remove(o, do_unlink=True)
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 900
w = bpy.data.worlds.get("WR") or bpy.data.worlds.new("WR")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.94, 0.96, 1)
sc.world = w
cam = bpy.data.objects.get("RigCam")
if cam is None:
    cam = bpy.data.objects.new("RigCam", bpy.data.cameras.new("RigCam"))
sun = bpy.data.objects.get("RigSun")
if sun is None:
    sun = bpy.data.objects.new("RigSun", bpy.data.lights.new("RigSun", "SUN"))
for ob in (cam, sun):
    if ob.name not in sc.collection.objects:
        sc.collection.objects.link(ob)
sc.camera = cam
cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.4
cam.data.clip_start, cam.data.clip_end = 0.1, 100
sun.data.energy = 3.5
try:
    VIEWS
except NameError:
    VIEWS = {"p_front": (0.5, 4, 1.2), "p_back34": (-2.8, -2.8, 1.5), "p_top": (0.01, 0.0, 5)}
for name, loc in VIEWS.items():
    cam.location = loc
    d = mathutils.Vector((0, 0, 0.95)) - mathutils.Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sun.rotation_euler = (math.radians(55), 0, math.atan2(loc[0], -loc[1]) + 0.6)
    sc.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
result = {"ok": list(VIEWS)}
