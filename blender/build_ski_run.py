"""
Experience: a ski run between mountains. Run with the helpers prepended:
    python -I tools/blender_bridge.py blender/_helpers.py blender/build_ski_run.py

Blender axes: run goes along +Y (downhill), up = +Z. glTF/three: (x, y, z) -> (x, z, -y).
Exports
  public/models/ski-run.glb  - "Terrain" (vertex-coloured snow/rock), "IcePath", "Pine_*" (shared mesh),
                               "Gate_<i>" (checkpoint gates), "SummitFlag", and "Skier" (at the origin:
                               "SkierBody" leans/crouches, "SkiL"/"SkiR", forward = +Y / three -Z)
  src/components/experience/ski-path.json - sampled centre line in three.js coords + checkpoints / jump / finish
Re-run when the number of experience entries changes (CHECKPOINTS below).
"""
import json
import random

reset_scene()
scene = bpy.context.scene
export = new_collection("Export")
M = toy_materials()

# ── Story layout (oldest -> newest). Peaks get taller toward the present. ─────
CHECKPOINTS = [  # y along the run, peak height, side of the path the peak stands on
    {"y": 12.0, "peak": 7.0, "side": -1},   # B.Sc. Civil Engineering
    {"y": 32.0, "peak": 11.0, "side": 1},   # ITI
    {"y": 52.0, "peak": 16.5, "side": -1},  # Nami Tech (now) - summit flag
]
JUMP = {"ramp_start": 20.5, "lip": 22.5, "land": 28.5}  # career-switch jump between 0 and 1
RUN_START, RUN_END = 0.0, 57.0
PATH_HALF = 1.4


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def path_x(y):
    return 5.5 * math.sin(y * 0.11) + 1.6 * math.sin(y * 0.27 + 0.6)


def path_z(y):
    z = 14.0 - 0.2 * y
    z -= 2.6 * smooth((y - JUMP["lip"]) / 1.6)  # ledge after the kicker
    return z


def ramp(y, d):
    if d > 2.2:
        return 0.0
    t = (y - JUMP["ramp_start"]) / (JUMP["lip"] - JUMP["ramp_start"])
    return 0.9 * t * t if 0 <= t <= 1 else 0.0


def ripple(x, y):
    return (0.6 * math.sin(x * 0.35 + 1.3) * math.cos(y * 0.29) + 0.3 * math.sin(x * 0.8 + y * 0.6)
            + 0.15 * math.sin(x * 1.7 - y * 1.3))


PEAKS = []
for c in CHECKPOINTS:
    PEAKS.append((path_x(c["y"]) + c["side"] * 10.5, c["y"] + 2.5, c["peak"], 7.5 + c["peak"] * 0.25))
random.seed(11)
for _ in range(14):  # background range
    side = random.choice((-1, 1))
    PEAKS.append((side * random.uniform(20, 30), random.uniform(-8, 70), random.uniform(8, 19), random.uniform(7, 11)))


def height(x, y):
    yc = min(max(y, RUN_START - 6), RUN_END + 10)
    px, pz = path_x(yc), path_z(yc)
    d = abs(x - px)
    walls = min(0.05 * max(d - PATH_HALF - 0.4, 0) ** 2, 10.0)
    h = pz + walls + ripple(x, y) * min(1.0, max(d - 1.5, 0) / 4.0) + ramp(y, d)
    for cx, cy, H, r in PEAKS:
        dd = math.hypot(x - cx, y - cy)
        if dd < r:
            h += H * (1 - dd / r) ** 1.5 * (1 + 0.06 * ripple(x * 2, y * 2))
    return h


# ── Terrain heightfield with snow / rock vertex colours ───────────────────────
X0, X1, Y0, Y1, STEP = -34.0, 34.0, -12.0, 74.0, 0.42
nx, ny = int((X1 - X0) / STEP) + 1, int((Y1 - Y0) / STEP) + 1
bm = bmesh.new()
grid = []
for j in range(ny):
    row = []
    for i in range(nx):
        x, y = X0 + i * STEP, Y0 + j * STEP
        row.append(bm.verts.new((x, y, height(x, y))))
    grid.append(row)
for j in range(ny - 1):
    for i in range(nx - 1):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
bm.normal_update()
col = bm.loops.layers.color.new("Col")
SNOW, ROCK, SHADE = srgb("#F7F9FC"), srgb("#AEB8CB"), srgb("#E2E8F1")
for f in bm.faces:
    for loop in f.loops:
        v = loop.vert
        nz = v.normal.z
        rock = 1 - smooth((nz - 0.68) / 0.16)
        rock *= 1 - smooth((v.co.z - 22) / 4)  # high summits stay snowy
        base = [SNOW[k] * (1 - 0.25 * (1 - nz)) + (SHADE[k] - SNOW[k]) * 0.3 * (1 - nz) for k in range(3)]
        c = [base[k] * (1 - rock) + ROCK[k] * rock for k in range(3)]
        loop[col] = (*c, 1.0)
terrain_mat = material("Snow", "#FFFFFF", rough=0.55, coat=0.15)
nodes, links = terrain_mat.node_tree.nodes, terrain_mat.node_tree.links
attr = nodes.new("ShaderNodeVertexColor")
attr.layer_name = "Col"
links.new(attr.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
terrain = _object("Terrain", from_bmesh("Terrain", bm, terrain_mat), (0, 0, 0), export)

# ── Icy path ribbon ───────────────────────────────────────────────────────────
ice_mat = material("Ice", "#CFE8F7", rough=0.06, coat=1.0)
bm = bmesh.new()
prev = None
y = RUN_START - 2
while y <= RUN_END + 2:
    px = path_x(y)
    l = bm.verts.new((px - PATH_HALF, y, height(px - PATH_HALF, y) + 0.04))
    r = bm.verts.new((px + PATH_HALF, y, height(px + PATH_HALF, y) + 0.04))
    if prev:
        bm.faces.new((prev[0], prev[1], r, l))
    prev = (l, r)
    y += 0.25
_object("IcePath", from_bmesh("IcePath", bm, ice_mat), (0, 0, 0), export)

# ── Toy pines (one shared mesh, many instances) ───────────────────────────────
from mathutils import Matrix

pine_green = material("Pine", "#3E7C5A", rough=0.4, coat=0.4)
trunk_mat = material("Trunk", "#6B4A35", rough=0.6)
bm = bmesh.new()
for k, (z, r, h) in enumerate([(0.45, 0.62, 0.9), (0.95, 0.48, 0.8), (1.4, 0.32, 0.7)]):
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=r, radius2=0.02, depth=h,
                                matrix=Matrix.Translation((0, 0, z + h / 2)))
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = 0
    snow = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=r * 0.42, radius2=0.02, depth=h * 0.38,
                                 matrix=Matrix.Translation((0, 0, z + h * 0.81)))
    for f in {f for v in snow["verts"] for f in v.link_faces}:
        f.material_index = 1
trunk = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.09, radius2=0.09, depth=0.5,
                              matrix=Matrix.Translation((0, 0, 0.25)))
for f in {f for v in trunk["verts"] for f in v.link_faces}:
    f.material_index = 2
pine_mesh = bpy.data.meshes.new("Pine")
bm.to_mesh(pine_mesh)
bm.free()
pine_mesh.shade_smooth()
pine_mesh.set_sharp_from_angle(angle=math.radians(40))
for m in (pine_green, material("PineSnow", "#F6F8FB", rough=0.5), trunk_mat):
    pine_mesh.materials.append(m)

random.seed(5)
placed = 0
tries = 0
while placed < 80 and tries < 3000:
    tries += 1
    y = random.uniform(-6, 66)
    x = path_x(min(max(y, 0), RUN_END)) + random.choice((-1, 1)) * random.uniform(2.8, 15)
    z = height(x, y)
    dz = abs(height(x + 0.5, y) - height(x - 0.5, y)) + abs(height(x, y + 0.5) - height(x, y - 0.5))
    if dz > 1.1 or z > path_z(min(max(y, 0), RUN_END)) + 7:
        continue
    s = random.uniform(0.7, 1.35)
    o = _object(f"Pine_{placed}", pine_mesh, (x, y, z - 0.05), export, rot=(0, 0, random.uniform(0, 6.28)))
    o.scale = (s, s, s * random.uniform(0.9, 1.15))
    placed += 1

# ── Checkpoint gates (slalom banners the skier passes under) + summit flag ────
for i, c in enumerate(CHECKPOINTS):
    y = c["y"]
    px = path_x(y)
    z = path_z(y)
    gate = empty(f"Gate_{i}", (px, y, z), export)
    for s in (-1, 1):
        cylinder(f"Gate_{i}_Pole{'L' if s < 0 else 'R'}", 0.06, 2.6, (s * (PATH_HALF + 0.35), 0, 1.3),
                 M["charcoal"], export, bevel=0.01, parent=gate)
    box(f"Gate_{i}_Banner", (2 * PATH_HALF + 0.7, 0.06, 0.42), (0, 0, 2.45),
        M["accent"] if i == len(CHECKPOINTS) - 1 else M["cream"], export, bevel=0.03, parent=gate)

top = CHECKPOINTS[-1]
cx, cy, H, r = PEAKS[len(CHECKPOINTS) - 1]
flag = empty("SummitFlag", (cx, cy, height(cx, cy)), export)
cylinder("SummitFlag_Pole", 0.08, 3.2, (0, 0, 1.6), M["charcoal"], export, bevel=0.01, parent=flag)
extruded_shape("SummitFlag_Cloth", [(0, 0), (1.7, -0.45), (0, -0.9)], 0.06, (0.08, 0, 3.15), M["accent"], export,
               bevel=0.02, parent=flag)
for i in range(len(CHECKPOINTS) - 1):  # small white flags on the earlier peaks
    cx, cy, H, r = PEAKS[i]
    f = empty(f"PeakFlag_{i}", (cx, cy, height(cx, cy)), export)
    cylinder(f"PeakFlag_{i}_Pole", 0.06, 2.2, (0, 0, 1.1), M["charcoal"], export, bevel=0.01, parent=f)
    extruded_shape(f"PeakFlag_{i}_Cloth", [(0, 0), (1.1, -0.3), (0, -0.6)], 0.05, (0.06, 0, 2.15), M["cream"],
                   export, bevel=0.015, parent=f)

# ── Skier (toy, at the origin, facing +Y) ─────────────────────────────────────
skier = empty("Skier", (0, 0, 0), export)
body = empty("SkierBody", (0, 0, 0), export, parent=skier)
for s, lbl in ((-1, "L"), (1, "R")):
    box(f"Ski{lbl}", (0.15, 1.55, 0.045), (s * 0.15, 0.12, 0.03), M["cream"], export, bevel=0.02, parent=skier)
    box(f"Ski{lbl}_Tip", (0.15, 0.22, 0.05), (s * 0.15, 0.86, 0.07), M["accent"], export, bevel=0.02, parent=skier,
        rot=(math.radians(22), 0, 0))
    tube(f"Leg{lbl}", [(s * 0.15, 0.0, 0.1), (s * 0.14, 0.14, 0.38), (s * 0.1, -0.04, 0.64)], 0.08, (0, 0, 0),
         M["charcoal"], export, segs=16, parent=body)
    box(f"Boot{lbl}", (0.16, 0.26, 0.14), (s * 0.15, 0.04, 0.12), M["charcoal"], export, bevel=0.04, parent=body)
    tube(f"Arm{lbl}", [(s * 0.21, 0.04, 1.0), (s * 0.3, 0.2, 0.86), (s * 0.33, 0.34, 0.76)], 0.065, (0, 0, 0),
         M["accent"], export, segs=16, parent=body)
    tube(f"Pole{lbl}", [(s * 0.34, 0.36, 0.78), (s * 0.4, -0.25, 0.04)], 0.018, (0, 0, 0), M["charcoal"], export,
         segs=10, parent=body)
squashed = lambda n, r, sc, loc, m: _object(n, from_bmesh(n, _sphere_bm(r, sc), m), loc, export, parent=body)  # noqa


def _sphere_bm(r, sc):
    b = bmesh.new()
    bmesh.ops.create_uvsphere(b, u_segments=40, v_segments=20, radius=r)
    for v in b.verts:
        v.co.x *= sc[0]
        v.co.y *= sc[1]
        v.co.z *= sc[2]
    return b


squashed("Torso", 1.0, (0.25, 0.21, 0.3), (0, 0.04, 0.86), M["accent"])
squashed("Helmet", 0.18, (1, 1.05, 0.95), (0, 0.1, 1.24), M["cream"])
box("Goggles", (0.27, 0.08, 0.08), (0, 0.25, 1.23), M["charcoal"], export, bevel=0.03, parent=body)
box("GoggleLens", (0.21, 0.02, 0.05), (0, 0.29, 1.23), M["glow"], export, bevel=0.012, parent=body)

# ── Path for the web (three.js coords) ────────────────────────────────────────
pts = []
y = RUN_START
while y <= RUN_END + 1e-6:
    px = path_x(y)
    pts.append([round(px, 3), round(height(px, y) + 0.04, 3), round(-y, 3)])
    y += 0.5
path_json = {
    "step": 0.5,
    "points": pts,
    "checkpoints": [round(c["y"], 2) for c in CHECKPOINTS],
    "jump": JUMP,
    "finish": RUN_END - 1.5,
    "summit": [round(v, 3) for v in (PEAKS[len(CHECKPOINTS) - 1][0], height(*PEAKS[len(CHECKPOINTS) - 1][:2]),
                                     -PEAKS[len(CHECKPOINTS) - 1][1])],
}
with open(ROOT + "/src/components/experience/ski-path.json", "w", encoding="utf-8") as fh:
    json.dump(path_json, fh, separators=(",", ":"))

# ── Previews: wide shot of the range + close-up of the skier on the slope ─────
studio(scene, cam_loc=(-4, -20, 26), cam_target=(2, 34, 2), lens=26, rim_energy=500)
for l in ("Key", "Fill", "Rim"):
    bpy.data.objects[l].data.energy *= 40  # big scene
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
scene.render.filepath = ROOT + "/blender/renders/ski-run-wide.png"
bpy.ops.render.render(write_still=True)

sy = 7.0
sx, sz = path_x(sy), height(path_x(sy), sy)
tangent = path_x(sy + 0.5) - path_x(sy - 0.5)
skier.location = (sx, sy, sz + 0.04)
skier.rotation_euler = (math.radians(-11), 0, -math.atan2(tangent, 1.0))
body.rotation_euler = (math.radians(14), math.radians(-12), 0)
cam = scene.camera
cam.location = (sx - 2.2, sy - 5.2, sz + 2.6)
aim(cam, (sx + 0.3, sy + 2.5, sz + 0.7))
cam.data.lens = 40
scene.render.filepath = ROOT + "/blender/renders/ski-run-skier.png"
bpy.ops.render.render(write_still=True)
skier.location, skier.rotation_euler, body.rotation_euler = (0, 0, 0), (0, 0, 0), (0, 0, 0)

bpy.ops.wm.save_as_mainfile(filepath=ROOT + "/blender/ski-run.blend")
size = export_glb("Export", ROOT + "/public/models/ski-run.glb")
result = {"glb_bytes": size, "path_points": len(pts), "pines": placed, "terrain_verts": nx * ny}
