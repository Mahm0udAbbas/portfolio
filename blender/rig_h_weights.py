# Step H2: bind with auto weights; enforce skis by nearest foot LINE, poles by shaft distance.
import bpy, json, mathutils
V = mathutils.Vector
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
mesh = bpy.data.objects["SkierScan"]
arm = next(o for o in sc.objects if o.type == "ARMATURE")
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
for o in list(sc.objects):
    if o.name.startswith("MK_"):
        bpy.data.objects.remove(o, do_unlink=True)
# unbind any previous attempt
for m in list(mesh.modifiers):
    if m.type == "ARMATURE":
        mesh.modifiers.remove(m)
for g in list(mesh.vertex_groups):
    mesh.vertex_groups.remove(g)
mesh.parent = None

bpy.ops.object.select_all(action="DESELECT")
mesh.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

me = mesh.data
bones = {b.name: (V(b.head_local), V(b.tail_local)) for b in arm.data.bones}
def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length
def line_dist(p, a, d):
    return ((p - a) - d * (p - a).dot(d)).length
vg = {g.name: g for g in mesh.vertex_groups}
def assign(idx, name):
    for g in mesh.vertex_groups:
        g.remove([idx])
    vg[name].add([idx], 1.0, "REPLACE")

ski_ids = {"AnkleL": [], "AnkleR": []}
pole_ids = {"PoleL": [], "PoleR": []}
legs = [(bones[n][0], bones[n][1]) for n in ("HipL", "HipR", "KneeL", "KneeR")]
arms_ = [(bones[n][0], bones[n][1]) for n in ("ElbowL", "ElbowR", "WristL", "WristR")]

# Split the skis by GEODESIC distance from each boot (the skis cross in the scan, so a
# straight-line split tears one apart; surface distance from the right boot is unambiguous).
import heapq
cand = {}
for v in me.vertices:
    p = v.co
    if p.z < 0.10 or (p.z < 0.26 and abs(p.y) > 0.55 and abs(p.x) < 0.45):
        cand[v.index] = True
seeds = {"AnkleL": [], "AnkleR": []}
for v in me.vertices:
    p = v.co
    if 0.10 < p.z < 0.32:
        for L in ("AnkleL", "AnkleR"):
            if (p - bones[L][0]).length < 0.12:
                seeds[L].append(v.index)
                cand[v.index] = True
                break
adj = {}
for e in me.edges:
    a, b = e.vertices
    if a in cand and b in cand:
        w = (me.vertices[a].co - me.vertices[b].co).length
        adj.setdefault(a, []).append((b, w))
        adj.setdefault(b, []).append((a, w))
dist = {}
owner = {}
pq = []
for L, ss in seeds.items():
    for i in ss:
        dist[i] = 0.0
        owner[i] = L
        heapq.heappush(pq, (0.0, i, L))
while pq:
    d, i, L = heapq.heappop(pq)
    if d > dist.get(i, 1e9) or owner.get(i) != L:
        continue
    for j, w in adj.get(i, ()):
        nd = d + w
        if nd < dist.get(j, 1e9) - 1e-9:
            dist[j] = nd
            owner[j] = L
            heapq.heappush(pq, (nd, j, L))
for v in me.vertices:
    p = v.co
    if v.index in cand and p.z < 0.10 or (v.index in cand and p.z < 0.26 and abs(p.y) > 0.55):
        side = owner.get(v.index)
        if side is None:  # unreachable islands: nearest ankle by x
            side = "AnkleL" if abs(p.x - bones["AnkleL"][0].x) < abs(p.x - bones["AnkleR"][0].x) else "AnkleR"
        assign(v.index, side)
        ski_ids[side].append(v.index)
# poles: flood along the mesh from each basket, staying within a thin tube around the shaft
nbr = {}
for e in me.edges:
    x, y = e.vertices
    nbr.setdefault(x, []).append(y)
    nbr.setdefault(y, []).append(x)
for pn in ("PoleL", "PoleR"):
    a, b = bones[pn]
    b2 = b + (b - a).normalized() * 0.08
    wr = bones["Wrist" + pn[-1]][0]
    inside = lambda p: seg_dist(p, a, b2) < 0.045 and (p - wr).length > 0.10
    start = min((v for v in me.vertices if inside(v.co)), key=lambda v: (v.co - b).length)
    seen = {start.index}
    stack = [start.index]
    while stack:
        i = stack.pop()
        for j in nbr.get(i, ()):
            if j not in seen and inside(me.vertices[j].co):
                seen.add(j)
                stack.append(j)
    for i in seen:
        assign(i, pn)
    pole_ids[pn] = sorted(seen)
# pole bones must only move pole verts: strip auto weights elsewhere (gloves kept clean)
pole_all = set(pole_ids["PoleL"]) | set(pole_ids["PoleR"])
for pn in ("PoleL", "PoleR"):
    g = vg[pn]
    for v in me.vertices:
        if v.index not in pole_all:
            g.remove([v.index])
# part mask as a mesh attribute (survives vertex deletion): 1 ski L, 2 ski R, 3 pole
att = me.attributes.get("part") or me.attributes.new("part", "INT", "POINT")
vals = [0] * len(me.vertices)
for i in ski_ids["AnkleL"]: vals[i] = 1
for i in ski_ids["AnkleR"]: vals[i] = 2
for i in pole_all: vals[i] = 3
att.data.foreach_set("value", vals)
# ski axes (scan pose) per ankle, then cut the scanned skis + poles out (replaced by modeled gear)
axes = {}
for L in ("AnkleL", "AnkleR"):
    pts = [me.vertices[i].co.copy() for i in ski_ids[L] if me.vertices[i].co.z < 0.08]
    c = sum(pts, V((0, 0, 0))) / len(pts)
    ax = V((0, 1, 0))
    for _ in range(30):
        n = V((0, 0, 0))
        for p in pts[::2]:
            d = p - c
            n += d * d.dot(ax)
        ax = n.normalized()
    if ax.y < 0:
        ax = -ax
    axes[L] = {"axis": list(ax), "centre": list(c)}
import bmesh
cut = set()
for i in ski_ids["AnkleL"] + ski_ids["AnkleR"]:
    if me.vertices[i].co.z < 0.07 or abs(me.vertices[i].co.y) > 0.5:
        cut.add(i)
for v in me.vertices:
    p = v.co
    for pn in ("PoleL", "PoleR"):
        a, b = bones[pn]
        b2 = b + (b - a).normalized() * 0.1
        if seg_dist(p, a, b2) < 0.05 and (p - bones["Wrist" + pn[-1]][0]).length > 0.09:
            cut.add(v.index)
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in cut], context="VERTS")
bm.to_mesh(me)
bm.free()
me.update()
with open(ROOT + "/blender/assets/skier/ski_axes.json", "w") as fh:
    json.dump(axes, fh)
with open(ROOT + "/blender/assets/skier/part_ids.json", "w") as fh:
    json.dump({"ski": ski_ids, "pole": pole_ids}, fh)
result = {"skiL": len(ski_ids["AnkleL"]), "skiR": len(ski_ids["AnkleR"]),
          "poleL": len(pole_ids["PoleL"]), "poleR": len(pole_ids["PoleR"])}
