# Step D: canonicalize SkierScan — no parent, skis along +Y (facing +Y), feet centered at origin.
import bpy, math, mathutils
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
mesh = bpy.data.objects["SkierScan"]
bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
if mesh.parent:
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
# drop stray import empties
for o in list(sc.objects):
    if o.type == "EMPTY" and o.name.startswith(("world", "tmp")):
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

me = mesh.data
co = [v.co.copy() for v in me.vertices]
zmin = min(c.z for c in co)
base = [c for c in co if c.z < zmin + 0.03]  # ski bases
mx = sum(c.x for c in base) / len(base)
my = sum(c.y for c in base) / len(base)
# PCA major axis in XY of the ski bases
sxx = sum((c.x - mx) ** 2 for c in base)
syy = sum((c.y - my) ** 2 for c in base)
sxy = sum((c.x - mx) * (c.y - my) for c in base)
ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
axis = mathutils.Vector((math.cos(ang), math.sin(ang)))
# forward = side where the head is (head leans ahead of the feet in this stance)
head = [c for c in co if c.z > zmin + 1.6]
hx = sum(c.x for c in head) / len(head); hy = sum(c.y for c in head) / len(head)
fwd = (mathutils.Vector((hx - mx, hy - my)).dot(axis))
if fwd < 0:
    axis = -axis
rot = math.atan2(axis.y, axis.x) - math.pi / 2  # rotate so axis becomes +Y
M = mathutils.Matrix.Rotation(-rot, 4, "Z")
me.transform(mathutils.Matrix.Translation((-mx, -my, 0)))
me.transform(M)
# recenter: binding area (near-feet band) at x=0; keep y so bindings near 0
co2 = [v.co for v in me.vertices]
feet = [c for c in co2 if c.z < zmin + 0.25 and abs(c.x) < 0.45 and abs(c.y) < 0.5]
fx = sum(c.x for c in feet) / len(feet); fy = sum(c.y for c in feet) / len(feet)
me.transform(mathutils.Matrix.Translation((-fx, -fy, -zmin)))
me.update()
d = mesh.dimensions
result = {"rot_deg": round(math.degrees(rot), 1), "dims": [round(v, 3) for v in d],
          "head_xy": [round(hx - mx, 2), round(hy - my, 2)]}
