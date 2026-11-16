# Per-side profiles: ortho side camera with clip planes slicing his-left (x<0) and his-right (x>0).
import bpy, math
OUT = "C:/Users/MAHMOU~1/AppData/Local/Temp/claude/3dd23b1de639733f/0a7b492a-767c-4e34-8a39-0f82790352f5/scratchpad"
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
cam = bpy.data.objects["RigCam"]
for ob in (cam, bpy.data.objects.get("RigSun")):
    if ob and ob.name not in sc.collection.objects:
        sc.collection.objects.link(ob)
sc.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = 2.3
sun = bpy.data.objects["RigSun"]
sun.data.energy = 5.0
sun.rotation_euler = (math.radians(55), 0, math.radians(-60))
cam.location = (-4, 0, 1.0)
cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
for name, c0, c1 in [("side_xneg", 3.0, 4.005), ("side_xpos", 4.005, 5.2), ("side_all", 0.1, 50)]:
    cam.data.clip_start = c0
    cam.data.clip_end = c1
    sc.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
cam.data.clip_start, cam.data.clip_end = 0.1, 100
result = {"ok": True}
