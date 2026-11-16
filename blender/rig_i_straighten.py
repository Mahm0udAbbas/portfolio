# Step I: straighten to neutral rest (stand, arms down, skis flat +Y), bake as rest pose.
import bpy, json, math, mathutils
V = mathutils.Vector
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
mesh = bpy.data.objects["SkierScan"]
arm = next(o for o in sc.objects if o.type == "ARMATURE")
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.matrix_basis.identity()
bpy.context.view_layer.update()

def rotate_about_head(pb, R):
    head = pb.matrix.to_translation()
    Rm = R.to_matrix().to_4x4() if hasattr(R, "to_matrix") else R.to_4x4()
    M = mathutils.Matrix.Translation(head) @ Rm @ mathutils.Matrix.Translation(-head)
    pb.matrix = M @ pb.matrix
    bpy.context.view_layer.update()

def align(name, target):
    pb = arm.pose.bones[name]
    d = (pb.tail - pb.head).normalized()
    R = d.rotation_difference(V(target).normalized())
    rotate_about_head(pb, R)

def twist_z(name, childL, childR):
    """Rotate about +Z at the bone head so childL->childR runs along +X."""
    pb = arm.pose.bones[name]
    hl = arm.pose.bones[childL].head
    hr = arm.pose.bones[childR].head
    d = hr - hl
    ang = math.atan2(d.y, d.x)
    rotate_about_head(pb, mathutils.Matrix.Rotation(-ang, 3, "Z"))

# pelvis upright + hips level in plan
align("Pelvis", (0, 0, 1))
twist_z("Pelvis", "HipL", "HipR")
align("Spine", (0, 0, 1))
twist_z("Spine", "ShoulderL", "ShoulderR")
align("Neck", (0, 0, 1))
align("Head", (0, 0, 1))
for L, sx in (("L", -1), ("R", 1)):
    align("Shoulder" + L, (sx * 0.12, 0, -0.99))
    align("Elbow" + L, (sx * 0.12, 0.02, -0.99))
    align("Wrist" + L, (sx * 0.10, 0.25, -0.95))
    align("Pole" + L, (0, 0, -1))
    align("Hip" + L, (0, 0, -1))
    align("Knee" + L, (0, 0, -1))

# feet: rotate each ankle so the (removed) scan ski's long axis runs along +Y, level
axes = json.load(open(ROOT + "/blender/assets/skier/ski_axes.json"))
for L in ("L", "R"):
    pb = arm.pose.bones["Ankle" + L]
    rest = arm.data.bones["Ankle" + L].matrix_local.to_3x3()
    local = rest.inverted() @ V(axes["Ankle" + L]["axis"])
    for _ in range(3):
        bpy.context.view_layer.update()
        now = (pb.matrix.to_3x3() @ local).normalized()
        R = now.rotation_difference(V((0, 1, 0)))
        rotate_about_head(pb, R)
bpy.ops.object.mode_set(mode="OBJECT")
# bake: apply armature modifier on mesh, apply pose as rest, re-add modifier
bpy.context.view_layer.objects.active = mesh
mod = next(m for m in mesh.modifiers if m.type == "ARMATURE")
bpy.ops.object.modifier_apply(modifier=mod.name)
# the scan fuses poles to legs/gloves: straightening stretches that webbing — cut it out
import bmesh
bm = bmesh.new()
bm.from_mesh(mesh.data)
bad = [f for f in bm.faces if max(e.calc_length() for e in f.edges) > 0.07]
bmesh.ops.delete(bm, geom=bad, context="FACES")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
# keep only the body: leftover bits of the scanned poles/skis are now separate islands
bm.verts.ensure_lookup_table()
seen = set()
islands = []
for v0 in bm.verts:
    if v0.index in seen:
        continue
    comp, stack = [], [v0]
    seen.add(v0.index)
    while stack:
        v = stack.pop()
        comp.append(v)
        for e in v.link_edges:
            w = e.other_vert(v)
            if w.index not in seen:
                seen.add(w.index)
                stack.append(w)
    islands.append(comp)
islands.sort(key=len, reverse=True)
ISLANDS = [len(c) for c in islands[:8]]
drop = [v for c in islands[1:] if len(c) < 0.2 * len(islands[0]) for v in c]
bmesh.ops.delete(bm, geom=drop, context="VERTS")
bm.to_mesh(mesh.data)
bm.free()
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode="OBJECT")
m2 = mesh.modifiers.new("Armature", "ARMATURE")
m2.object = arm

# floor + scale to 1.86 m, centre feet
me = mesh.data
zmin = min(v.co.z for v in me.vertices)
zmax = max(v.co.z for v in me.vertices)
s = 1.86 / (zmax - zmin)
aL = arm.data.bones["AnkleL"].head_local
aR = arm.data.bones["AnkleR"].head_local
fx = (aL.x + aR.x) / 2
fy = (aL.y + aR.y) / 2
T = mathutils.Matrix.Translation((-fx * s, -fy * s, -zmin * s)) @ mathutils.Matrix.Scale(s, 4)
me.transform(T)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for b in arm.data.edit_bones:
    b.head = T @ b.head
    b.tail = T @ b.tail
bpy.ops.object.mode_set(mode="OBJECT")
result = {"islands": ISLANDS, "scale": round(s, 4), "pelvis_z": round(arm.data.bones["Pelvis"].head_local.z, 3),
          "height": round((zmax - zmin) * s, 3)}
