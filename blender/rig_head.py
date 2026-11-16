import bpy, math
OUT = "C:/Users/MAHMOU~1/AppData/Local/Temp/claude/3dd23b1de639733f/0a7b492a-767c-4e34-8a39-0f82790352f5/scratchpad"
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
cam = bpy.data.objects["RigCam"]
cam.data.ortho_scale = 0.7
sun = bpy.data.objects["RigSun"]
sun.data.energy = 8.0
# head is near z 1.75-2.0 after flooring; find exact head centre
me = bpy.data.objects["SkierScan"].data
zm = max(v.co.z for v in me.vertices)
hs = [v.co for v in me.vertices if v.co.z > zm - 0.25]
hc = [sum(c[k] for c in hs) / len(hs) for k in range(3)]
Z = hc[2]
views = {"headYpos": ((hc[0], hc[1] + 3, Z), (math.radians(90), 0, math.radians(180))),
         "headYneg": ((hc[0], hc[1] - 3, Z), (math.radians(90), 0, 0))}
for name, (loc, rot) in views.items():
    cam.location = loc
    cam.rotation_euler = rot
    sun.rotation_euler = (math.radians(60), 0, rot[2])
    sc.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
result = {"head_centre": [round(v, 3) for v in hc]}
