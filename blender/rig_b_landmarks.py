# Step B: landmark statistics on SkierScan (faces +Y, Z-up, in scene SkierRig).
import bpy, mathutils
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
me = bpy.data.objects["SkierScan"].data
co = [v.co for v in me.vertices]

def band(z0, z1, pred=lambda c: True):
    return [c for c in co if z0 <= c.z < z1 and pred(c)]
def centroid(cs):
    if not cs: return None
    return [round(sum(c[k] for c in cs) / len(cs), 3) for k in range(3)]

out = {}
# legs: below -0.3, split by x sign; walk up to find crotch (where the x~0 gap closes)
for z in [round(-0.95 + i * 0.05, 2) for i in range(16)]:
    cs = band(z, z + 0.05)
    mid = [c for c in cs if abs(c.x) < 0.04]
    out.setdefault("midcount", []).append((z, len(mid)))
# per-side leg centroids at a few heights
for name, z0, z1 in [("sole", -1.0, -0.93), ("ankle", -0.93, -0.8), ("shin", -0.7, -0.6), ("knee", -0.55, -0.4), ("thigh", -0.35, -0.25), ("hipband", -0.2, -0.1)]:
    cs = band(z0, z1)
    out[name + "_L"] = centroid([c for c in cs if c.x < -0.02 and abs(c.y) < 0.55])
    out[name + "_R"] = centroid([c for c in cs if c.x > 0.02 and abs(c.y) < 0.55])
# hands: far-out x clusters anywhere above knees
hands = [c for c in co if c.z > -0.4]
out["hand_L"] = centroid(sorted([c for c in hands if c.x < -0.45], key=lambda c: c.x)[:2000])
out["hand_R"] = centroid(sorted([c for c in hands if c.x > 0.45], key=lambda c: -c.x)[:2000])
# arms: slices by |x|
for name, a, b in [("forearm", 0.32, 0.5), ("elbow", 0.22, 0.34), ("upperarm", 0.14, 0.26)]:
    cs = [c for c in co if c.z > -0.25]
    out[name + "_L"] = centroid([c for c in cs if -b < c.x < -a])
    out[name + "_R"] = centroid([c for c in cs if a < c.x < b])
# torso/shoulders/head
for name, z0, z1 in [("waist", -0.1, 0.0), ("chest", 0.2, 0.3), ("shoulderband", 0.35, 0.5), ("neck", 0.5, 0.62), ("head", 0.7, 1.0)]:
    cs = band(z0, z1, lambda c: abs(c.x) < 0.4)
    out[name] = centroid(cs)
    if cs:
        out[name + "_xrange"] = [round(min(c.x for c in cs), 3), round(max(c.x for c in cs), 3)]
# poles: thin far-back/low verts beyond body in y
pol = [c for c in co if c.z < -0.3 and abs(c.x) > 0.3]
out["pole_low_L"] = centroid(sorted([c for c in pol if c.x < 0], key=lambda c: c.z)[:800])
out["pole_low_R"] = centroid(sorted([c for c in pol if c.x > 0], key=lambda c: c.z)[:800])
# ski extents: lowest 6 cm
sk = band(-1.0, -0.94)
for sname, pred in [("ski_L", lambda c: c.x < 0), ("ski_R", lambda c: c.x >= 0)]:
    cs = [c for c in sk if pred(c)]
    out[sname] = {"n": len(cs)}
    if cs:
        out[sname]["y"] = [round(min(c.y for c in cs), 3), round(max(c.y for c in cs), 3)]
        out[sname]["x"] = [round(min(c.x for c in cs), 3), round(max(c.x for c in cs), 3)]
result = out
