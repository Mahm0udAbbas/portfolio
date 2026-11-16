# Landmarks v2 in the canonical frame (face +Y, his left = -X, soles at z=0).
import bpy
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
me = bpy.data.objects["SkierScan"].data
co = [v.co for v in me.vertices]

def centroid(cs):
    return [round(sum(c[k] for c in cs) / len(cs), 3) for k in range(3)] if cs else None
def sel(z0, z1, pred=lambda c: True):
    return [c for c in co if z0 <= c.z < z1 and pred(c)]

out = {}
body = lambda c: abs(c.x) < 0.45  # exclude far pole/ski ends
# ankles: boot cores (dense) 0.08..0.2, split by x sign
for L, pr in (("L", lambda c: c.x < -0.02), ("R", lambda c: c.x > 0.02)):
    out["ankle" + L] = centroid(sel(0.08, 0.2, lambda c, p=pr: p(c) and abs(c.y) < 0.45))
    out["knee" + L] = centroid(sel(0.5, 0.62, lambda c, p=pr: p(c) and abs(c.y) < 0.5))
    out["hip" + L] = centroid(sel(0.92, 1.02, lambda c, p=pr: p(c) and abs(c.y) < 0.6))
# crotch: lowest z where mid verts exist between legs
for z in [round(0.6 + i * 0.04, 2) for i in range(12)]:
    mid = sel(z, z + 0.04, lambda c: abs(c.x) < 0.03 and -0.5 < c.y < 0.3)
    if len(mid) > 30:
        out["crotch_z"] = z
        break
# torso line at a few heights (y drifts back as he sits)
for nm, z0, z1 in [("waist", 1.0, 1.1), ("chest", 1.25, 1.35), ("shband", 1.42, 1.52), ("neckband", 1.55, 1.65)]:
    cs = sel(z0, z1, lambda c: abs(c.x) < 0.3)
    out[nm] = centroid(cs)
# shoulders: widest |x| at shoulder band
shb = sel(1.38, 1.55, lambda c: abs(c.y) < 0.7)
out["shoulderL"] = centroid(sorted([c for c in shb if c.x < 0], key=lambda c: c.x)[:600])
out["shoulderR"] = centroid(sorted([c for c in shb if c.x > 0], key=lambda c: -c.x)[:600])
# hands: |x| extremes over a wide z band
hb = [c for c in co if 0.8 < c.z < 1.35]
out["handL"] = centroid(sorted([c for c in hb if c.x < 0], key=lambda c: c.x)[:1200])
out["handR"] = centroid(sorted([c for c in hb if c.x > 0], key=lambda c: -c.x)[:1200])
# elbows: between shoulder and hand x
for L, sh, hd in (("L", "shoulderL", "handL"), ("R", "shoulderR", "handR")):
    s, h = out[sh], out[hd]
    if s and h:
        xm = (s[0] + h[0]) / 2
        cs = [c for c in co if 1.0 < c.z < 1.5 and abs(c.x - xm) < 0.06 and (c.y > -0.1)]
        out["elbow" + L] = centroid(cs)
result = out
