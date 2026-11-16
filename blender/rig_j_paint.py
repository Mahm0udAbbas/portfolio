# Step J: paint the scan (vertex colors), decimate, model clean skis + poles bound to their bones,
# join into one skinned mesh, add SkiL/SkiR markers.
import bpy, bmesh, math, mathutils
V = mathutils.Vector
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
mesh = bpy.data.objects["SkierScan"]
arm = next(o for o in sc.objects if o.type == "ARMATURE")
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
me = mesh.data

C = {k: srgb(v) for k, v in {
    "jacket": "#E4572E", "pants": "#1F2A44", "skin": "#C99A7E", "hat": "#F1F1F1",
    "gear": "#1C1D21", "ski": "#20252E", "ski_tip": "#FF8A4C", "steel": "#B5BCC6", "binding": "#5A606C",
}.items()}

gnames = {g.index: g.name for g in mesh.vertex_groups}
def dominant(v):
    best, bw = None, -1.0
    for g in v.groups:
        if g.weight > bw:
            bw, best = g.weight, gnames.get(g.group)
    return best or "Spine"

hb = arm.data.bones["Head"]
head_z0, head_top = hb.head_local.z, hb.tail_local.z
brim = head_z0 + (head_top - head_z0) * 0.52
face_y = hb.head_local.y
JACKET_HEM = arm.data.bones["Pelvis"].head_local.z - 0.04

col = me.color_attributes.get("Col") or me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
for v in me.vertices:
    g = dominant(v)
    p = v.co
    if g in ("AnkleL", "AnkleR", "WristL", "WristR", "PoleL", "PoleR"):
        c = C["gear"]  # boots, gloves
    elif g in ("HipL", "HipR", "KneeL", "KneeR"):
        c = C["pants"]
    elif g == "Pelvis":
        c = C["jacket"] if p.z > JACKET_HEM else C["pants"]
    elif g == "Head":
        c = C["skin"] if (p.z < brim and p.y > face_y + 0.012 and p.z > head_z0 + 0.01) else C["hat"]
    else:
        c = C["jacket"]
    col.data[v.index].color = (c[0], c[1], c[2], 1.0)

mat = bpy.data.materials.get("SkierSuit") or bpy.data.materials.new("SkierSuit")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.68
vc = next((n for n in nt.nodes if n.type == "VERTEX_COLOR"), None) or nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
me.materials.clear()
me.materials.append(mat)

bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.shade_smooth()
dec = mesh.modifiers.new("Dec", "DECIMATE")
dec.ratio = 0.17
bpy.ops.object.modifier_move_to_index(modifier="Dec", index=0)
bpy.ops.object.modifier_apply(modifier="Dec")

# ── modeled gear (rest pose: standing, skis along +Y) ──
bones = {b.name: b for b in arm.data.bones}
boot_z = {}
for L in ("AnkleL", "AnkleR"):
    gi = mesh.vertex_groups[L].index
    zs = [v.co.z for v in me.vertices if any(g.group == gi and g.weight > 0.5 for g in v.groups)]
    boot_z[L] = min(zs) if zs else 0.0

def part(name, bm, color, bone):
    m = bpy.data.meshes.new(name)
    bm.to_mesh(m)
    bm.free()
    a = m.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    for i, cc in enumerate(color if isinstance(color, list) else [color] * len(m.vertices)):
        a.data[i].color = (cc[0], cc[1], cc[2], 1.0)
    o = bpy.data.objects.new(name, m)
    sc.collection.objects.link(o)
    o.vertex_groups.new(name=bone).add(list(range(len(m.vertices))), 1.0, "REPLACE")
    return o

parts = []
markers = {}
for L, side in (("AnkleL", "L"), ("AnkleR", "R")):
    an = bones[L].head_local
    zb = boot_z[L]
    cy = an.y + 0.06  # binding a touch behind ski centre
    bm = bmesh.new()
    # deck: tapered plank with an upturned tip and a small tail kick
    length, w = 1.7, 0.1
    n = 28
    rows = []
    for k in range(n + 1):
        t = k / n
        y = cy - length / 2 + t * length
        tip = max(0.0, (t - 0.86) / 0.14)
        tail = max(0.0, (0.05 - t) / 0.05)
        z = zb - 0.022 + 0.11 * tip ** 1.8 + 0.035 * tail ** 2
        ww = w * (1.0 - 0.18 * math.sin(math.pi * t)) * (1 - 0.55 * tip ** 3)
        rows.append([bm.verts.new((an.x + s * ww / 2, y, z + h)) for s in (-1, 1) for h in (0.0, 0.018)])
    for a, b in zip(rows, rows[1:]):
        # verts per row: [-x bottom, -x top, +x bottom, +x top]
        for f in ((0, 2, 2, 0), ):
            pass
        bm.faces.new((a[1], a[3], b[3], b[1]))  # top
        bm.faces.new((a[2], a[0], b[0], b[2]))  # base
        bm.faces.new((a[0], a[1], b[1], b[0]))  # -x edge
        bm.faces.new((a[3], a[2], b[2], b[3]))  # +x edge
    bm.faces.new((rows[0][0], rows[0][2], rows[0][3], rows[0][1]))
    bm.faces.new((rows[-1][1], rows[-1][3], rows[-1][2], rows[-1][0]))
    bm.verts.index_update()
    cols = []
    for v in bm.verts:
        t = (v.co.y - (cy - length / 2)) / length
        cols.append(C["ski_tip"] if t > 0.84 else (C["binding"] if abs(v.co.y - cy) < 0.17 and v.co.z > zb - 0.006 else C["ski"]))
    o = part("Ski" + side + "Mesh", bm, cols, L)
    parts.append(o)
    markers["Ski" + side] = (V((an.x, cy, zb - 0.022)), L)
    # binding block
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=mathutils.Matrix.LocRotScale(V((an.x, cy, zb - 0.002)), None, V((0.075, 0.34, 0.03))))
    parts.append(part("Binding" + side, bm, C["binding"], L))

for P, side in (("PoleL", "L"), ("PoleR", "R")):
    b = bones[P]
    h, d = b.head_local, (b.tail_local - b.head_local).normalized()
    length = 1.12
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    bm = bmesh.new()
    mid = h + d * (length / 2 - 0.06)
    bmesh.ops.create_cone(bm, segments=10, radius1=0.009, radius2=0.009, depth=length - 0.12, cap_ends=True,
                          matrix=mathutils.Matrix.Translation(mid) @ rot)
    bmesh.ops.create_cone(bm, segments=12, radius1=0.016, radius2=0.016, depth=0.16, cap_ends=True,  # grip
                          matrix=mathutils.Matrix.Translation(h + d * 0.02) @ rot)
    n0 = len(bm.verts)
    bmesh.ops.create_cone(bm, segments=16, radius1=0.045, radius2=0.045, depth=0.01, cap_ends=True,  # basket
                          matrix=mathutils.Matrix.Translation(h + d * (length - 0.17)) @ rot)
    bm.verts.ensure_lookup_table()
    cols = []
    for v in bm.verts:
        along = (v.co - h).dot(d)
        cols.append(C["gear"] if along < 0.1 or along > length - 0.2 else C["steel"])
    parts.append(part(P + "Mesh", bm, cols, P))

# join gear into the scan (one skinned mesh)
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh
bpy.ops.object.join()
mesh.data.materials.clear()
mesh.data.materials.append(mat)

# SkiL / SkiR markers (ski base centres) bone-parented to the ankles
for name, (loc, bone) in markers.items():
    old = [o for o in sc.objects if o.name.startswith(name + "_rig")]
    for o in old:
        bpy.data.objects.remove(o, do_unlink=True)
    e = bpy.data.objects.new(name + "_rig", None)
    e.empty_display_size = 0.1
    sc.collection.objects.link(e)
    e.parent = arm
    e.parent_type = "BONE"
    e.parent_bone = bone
    bpy.context.view_layer.update()
    e.matrix_world = mathutils.Matrix.Translation(loc)
result = {"tris": sum(len(p.vertices) - 2 for p in mesh.data.polygons), "verts": len(mesh.data.vertices)}
