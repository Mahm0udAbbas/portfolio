# Step C: calibrated ortho renders of SkierScan (+ optional joint markers) for visual landmarking.
import bpy, math, mathutils
OUT = "C:/Users/MAHMOU~1/AppData/Local/Temp/claude/3dd23b1de639733f/0a7b492a-767c-4e34-8a39-0f82790352f5/scratchpad"
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
mesh = bpy.data.objects["SkierScan"]
if not mesh.data.materials:
    mesh.data.materials.append(material("ScanGrey", "#AEB4BE", rough=0.6))

# markers (JOINTS dict may be injected by later steps)
for o in list(sc.objects):
    if o.name.startswith("MK_"):
        bpy.data.objects.remove(o, do_unlink=True)
try:
    JOINTS
except NameError:
    JOINTS = {}
arm_o = next((o for o in sc.objects if o.type == "ARMATURE"), None)
if arm_o and not JOINTS:
    JOINTS = {b.name: tuple(b.head_local) for b in arm_o.data.bones}
red = material("MarkerRed", "#FF2D00", rough=0.4, emission="#FF2D00", strength=4)
for name, loc in JOINTS.items():
    mk = sphere(f"MK_{name}", 0.025, loc, red, sc.collection)

if "RigSun" not in bpy.data.objects:
    sun = bpy.data.objects.new("RigSun", bpy.data.lights.new("RigSun", "SUN"))
    sun.data.energy = 4.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(200))
    sc.collection.objects.link(sun)
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = sc.render.resolution_y = 1024
if sc.world is None:
    sc.world = bpy.data.worlds.new("WR")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.95, 0.96, 0.98, 1)
if "RigCam" not in bpy.data.objects:
    camd = bpy.data.cameras.new("RigCam")
    cam = bpy.data.objects.new("RigCam", camd)
    sc.collection.objects.link(cam)
cam = bpy.data.objects["RigCam"]
for ob in (cam, bpy.data.objects.get("RigSun")):
    if ob and ob.name not in sc.collection.objects:
        sc.collection.objects.link(ob)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.2
sc.camera = cam
cam.data.ortho_scale = 2.3
Z = 1.0  # frame centre height
views = {
    "front": ((0, 4, Z), (math.radians(90), 0, math.radians(180))),  # looking -Y at his face
    "left":  ((-4, 0, Z), (math.radians(90), 0, math.radians(-90))),  # looking +X: his left side
    "top":   ((0, 0, 4), (0, 0, 0)),
}
for name, (loc, rot) in views.items():
    cam.location = loc
    cam.rotation_euler = rot
    sc.render.filepath = f"{OUT}/rig_{name}.png"
    bpy.ops.render.render(write_still=True)
result = {"rendered": list(views), "markers": len(JOINTS)}
