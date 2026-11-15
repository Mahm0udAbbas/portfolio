"""
Experience: a realistic ski run — summit to summit by chairlift. Run with the helpers prepended:
    python -I tools/fetch_polyhaven.py                                    (once: CC0 textures + sky)
    python -I tools/blender_bridge.py blender/_helpers.py blender/build_ski_run.py

Story (oldest -> newest): Summit 1 (Civil Eng) -> descent w/ jump -> Lift 1 -> Summit 2 (ITI) -> descent ->
Lift 2 -> Summit 3 (Nami Tech, highest, orange flag). Units are metres. Blender: Z up. glTF/three: (x, z, -y).

Exports
  public/models/ski-run.glb   Terrain (vertex mask: R rock, G piste), Kicker, Lift_1/Lift_2 (towers+cables+
                              chairs+stations), Chair (ride template), Flag_0..2, TreeA/B/C (instanced on the web),
                              Skier (articulated: Pelvis/Spine/Neck/Head, Shoulder/Elbow/Wrist/Pole L/R,
                              Hip/Knee/Ankle L/R — empties, rotate them to animate)
  public/models/ski-trees.json  tree instances [x, y, z, rotY, scale, variant] (three coords)
  src/components/experience/ski-route.json  summits, skier descent lines (with jump), lift cable lines
"""
import json
import random

from mathutils import Matrix, noise

reset_scene()
scene = bpy.context.scene
export = new_collection("Export")
render_only = new_collection("RenderOnly")
R = math.radians
PH = ROOT + "/blender/assets/polyhaven"

# ── Layout (metres) ───────────────────────────────────────────────────────────
SUMMITS = [  # x, y, peak height above valley, radius
    (-120.0, 25.0, 58.0, 85.0),
    (15.0, 35.0, 84.0, 95.0),
    (155.0, 15.0, 112.0, 105.0),
]
BASES = [(-48.0, -30.0), (88.0, -36.0)]  # lift bottom stations (end of each descent)
BACKGROUND = []
random.seed(21)
for _ in range(22):
    bx = random.uniform(-260, 290)
    by = random.choice((random.uniform(115, 190), random.uniform(-200, -125)))
    BACKGROUND.append((bx, by, random.uniform(70, 160), random.uniform(60, 110)))


def smooth(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def ridge(x, y):
    v = noise.ridged_multi_fractal(Vector((x * 0.012, y * 0.012, 0.0)), 1.0, 2.1, 6, 1.0, 2.2,
                                   noise_basis="PERLIN_ORIGINAL")
    return v / 2.6


def fbm(x, y, f=0.03, o=4):
    return noise.fractal(Vector((x * f, y * f, 3.7)), 0.8, 2.0, o, noise_basis="PERLIN_ORIGINAL")


def lerp2(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# Piste centre lines: summit -> base, gentle curve (the skier carves S-turns across them)
PISTES = []
for i, (sx, sy, _, _) in enumerate(SUMMITS[:2]):
    bx, by = BASES[i]
    pts = []
    for k in range(61):
        t = k / 60
        px, py = lerp2((sx, sy - 6), (bx, by), t)
        bend = 9 * math.sin(math.pi * t) * (1 if i == 0 else -1)
        pts.append((px + bend * 0.6, py + bend * 0.4))
    PISTES.append(pts)


def piste_dist(x, y):
    best = 1e9
    for pts in PISTES:
        for px, py in pts:
            d = (x - px) ** 2 + (y - py) ** 2
            if d < best:
                best = d
    return math.sqrt(best)


def raw_height(x, y):
    r1 = ridge(x, y)
    h = 3.0 + 4.0 * fbm(x, y, 0.012, 3)
    for sx, sy, H, r in SUMMITS:
        d = math.hypot(x - sx, y - sy)
        h += H * math.exp(-((d / r) ** 2) * 2.2) * (0.86 + 0.28 * r1)
    r2 = None
    for bx, by, H, r in BACKGROUND:
        d = math.hypot(x - bx, y - by)
        if d < r * 1.6:
            r2 = ridge(x + 500, y) if r2 is None else r2
            h += H * math.exp(-((d / r) ** 2) * 2.0) * (0.8 + 0.4 * r2)
    return h


SUMMIT_TOP = [raw_height(sx, sy) - 1.0 for sx, sy, _, _ in SUMMITS]


def height(x, y, pd=None):
    h = raw_height(x, y)
    pd = piste_dist(x, y) if pd is None else pd
    # groomed pistes: smooth out the fine detail; summits: small flat platforms for the skier
    h += 1.6 * fbm(x, y, 0.09, 3) * smooth((pd - 6) / 10)
    for (sx, sy, _, _), top in zip(SUMMITS, SUMMIT_TOP):
        d = math.hypot(x - sx, y - sy)
        if d < 14:
            h = top + (h - top) * smooth((d - 6) / 8)
    return h


# ── Terrain mesh + mask (R rock, G piste) ─────────────────────────────────────
X0, X1, Y0, Y1, STEP = -240.0, 300.0, -170.0, 180.0, 2.0
nx, ny = int((X1 - X0) / STEP) + 1, int((Y1 - Y0) / STEP) + 1
bm = bmesh.new()
grid, pdist = [], {}
for j in range(ny):
    row = []
    for i in range(nx):
        x, y = X0 + i * STEP, Y0 + j * STEP
        pd = piste_dist(x, y) if -150 < x < 110 and -60 < y < 60 else 999
        pdist[(i, j)] = pd
        row.append(bm.verts.new((x, y, height(x, y, pd))))
    grid.append(row)
for j in range(ny - 1):
    for i in range(nx - 1):
        bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
bm.normal_update()
col = bm.loops.layers.color.new("Col")
vidx = {grid[j][i]: (i, j) for j in range(ny) for i in range(nx)}
for f in bm.faces:
    for loop in f.loops:
        v = loop.vert
        steep = 1 - smooth((v.normal.z - 0.55) / 0.2)  # steep faces shed their snow
        rock = steep * (0.85 + 0.15 * fbm(v.co.x, v.co.y, 0.08, 2))
        piste = 0.55 * (1 - smooth((pdist[vidx[v]] - 5) / 3))  # groomed: brighter, but keeps the snow grain
        loop[col] = (min(max(rock, 0.0), 1.0), piste, 0.0, 1.0)


def image(path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def sock(sockets, name, kind):
    return next(s for s in sockets if s.name == name and s.type == kind)


def terrain_material():
    m = bpy.data.materials.new("Terrain")
    try:
        m.use_nodes = True
    except Exception:
        pass
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    tc = nodes.new("ShaderNodeTexCoord")
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / 36, 1 / 36, 1 / 36)
    links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def tex(path):
        t = nodes.new("ShaderNodeTexImage")
        t.image = image(path)
        links.new(mp.outputs["Vector"], t.inputs["Vector"])
        return t

    snow = tex(f"{PH}/snow_field_aerial/snow_field_aerial_Diffuse_1k.jpg")
    rock = tex(f"{PH}/aerial_rocks_02/aerial_rocks_02_Diffuse_1k.jpg")
    attr = nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    sep = nodes.new("ShaderNodeSeparateColor")
    links.new(attr.outputs["Color"], sep.inputs["Color"])

    def mix(fac, a, b_val=None):
        n = nodes.new("ShaderNodeMix")
        n.data_type = "RGBA"
        links.new(fac, sock(n.inputs, "Factor", "VALUE"))
        links.new(a, sock(n.inputs, "A", "RGBA"))
        return n

    groomed = mix(sep.outputs["Green"], snow.outputs["Color"])
    sock(groomed.inputs, "B", "RGBA").default_value = (*srgb("#F3F6FB"), 1)
    rocky = mix(sep.outputs["Red"], sock(groomed.outputs, "Result", "RGBA"))
    links.new(rock.outputs["Color"], sock(rocky.inputs, "B", "RGBA"))
    links.new(sock(rocky.outputs, "Result", "RGBA"), bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.78
    return m


terrain = _object("Terrain", from_bmesh("Terrain", bm, terrain_material()), (0, 0, 0), export)

# ── Skier route: S-turns across each piste, jump on the first descent ─────────
JUMP_T = (0.44, 0.52)  # fraction of descent 1
N_DESC = 160


def descent_line(i):
    pts = PISTES[i]
    out = []
    for k in range(N_DESC + 1):
        t = k / N_DESC
        f = min(t * (len(pts) - 1), len(pts) - 1.0001)
        a, b = pts[int(f)], pts[int(f) + 1]
        u = f - int(f)
        cx, cy = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nxp, nyp = -dy / L, dx / L
        turns = 4.5 if i == 0 else 5.5
        amp = 4.2 * smooth(t / 0.08) * smooth((1 - t) / 0.08)
        if i == 0 and JUMP_T[0] - 0.05 < t < JUMP_T[1] + 0.03:
            amp *= 0.15  # straight-line into the kicker
        off = amp * math.sin(t * turns * 2 * math.pi)
        x, y = cx + nxp * off, cy + nyp * off
        out.append((x, y, height(x, y) + 0.02))
    return out


DESCENTS = [descent_line(0), descent_line(1)]

# Kicker on descent 1
k0 = DESCENTS[0][int(JUMP_T[0] * N_DESC) - 4]
k1 = DESCENTS[0][int(JUMP_T[0] * N_DESC)]
kyaw = math.atan2(k1[1] - k0[1], k1[0] - k0[0]) - math.pi / 2
bm = bmesh.new()
vv = [bm.verts.new(v) for v in [(-2.2, -3.0, 0), (2.2, -3.0, 0), (2.2, 0.6, 0), (-2.2, 0.6, 0), (2.2, 0.6, 1.3),
                                 (-2.2, 0.6, 1.3)]]
bm.faces.new((vv[0], vv[1], vv[4], vv[5]))
bm.faces.new((vv[3], vv[2], vv[4], vv[5]))
bm.faces.new((vv[0], vv[3], vv[5]))
bm.faces.new((vv[1], vv[4], vv[2]))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
snow_mat = material("SnowSolid", "#F4F7FB", rough=0.7)
kick = _object("Kicker", from_bmesh("Kicker", bm, snow_mat, smooth=False), (k1[0], k1[1], k1[2] - 0.05), export,
               rot=(0, 0, kyaw))
add_bevel(kick, 0.35, 4)

# ── Chairlifts: base station -> next summit ───────────────────────────────────
steel = material("Steel", "#8A9099", rough=0.35, metal=0.8)
seat = material("Seat", "#2C3442", rough=0.5)
LIFTS = []


def add_cyl(bm, a, b, r, segs=10):
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=d.length,
                                matrix=Matrix.Translation((a + b) / 2) @ rot)
    return res["verts"]


def add_box(bm, c, size, yaw=0.0):
    m = Matrix.Translation(c) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Diagonal((*size, 1))
    return bmesh.ops.create_cube(bm, size=1.0, matrix=m)["verts"]


def chair_bm(bm, top, yaw):
    """A 2-seat chair hanging 2.3 m below a cable point (seat faces local +Y)."""
    add_cyl(bm, top, (top[0], top[1], top[2] - 2.1), 0.035, 8)
    m = Matrix.Translation((top[0], top[1], top[2] - 2.3)) @ Matrix.Rotation(yaw, 4, "Z")
    for c, s in [((0, 0, 0), (1.3, 0.5, 0.08)), ((0, -0.24, 0.32), (1.3, 0.07, 0.6)),
                 ((0, 0.32, -0.25), (1.2, 0.05, 0.05))]:
        bmesh.ops.create_cube(bm, size=1.0, matrix=m @ Matrix.Translation(c) @ Matrix.Diagonal((*s, 1)))


for li in range(2):
    bx, by = BASES[li]
    sx, sy, _, _ = SUMMITS[li + 1]
    base = Vector((bx, by, height(bx, by)))
    away = Vector((bx - sx, by - sy, 0)).normalized()
    top_ground = Vector((sx, sy, 0)) + away * 18  # top station 18 m below the summit platform
    top_ground.z = height(top_ground.x, top_ground.y)
    yaw = math.atan2(top_ground.y - base.y, top_ground.x - base.x) - math.pi / 2
    side = Vector((math.cos(yaw), math.sin(yaw), 0))
    span = (top_ground - base).length
    n_t = max(3, int(span / 28))
    tower_tops = []
    bmL = bmesh.new()
    for k in range(n_t + 1):
        t = k / n_t
        p = base.lerp(top_ground, t)
        g = height(p.x, p.y)
        hgt = 7.5 if 0 < k < n_t else 5.5
        add_cyl(bmL, (p.x, p.y, g - 1), (p.x, p.y, g + hgt), 0.28 if 0 < k < n_t else 0.4)
        add_box(bmL, (p.x, p.y, g + hgt), (4.6, 0.35, 0.35), yaw)
        tower_tops.append(Vector((p.x, p.y, g + hgt - 0.15)))
    for p, s in ((base, 1.0), (top_ground, 0.9)):  # stations
        add_box(bmL, (p.x, p.y, p.z + 1.8), (7.5 * s, 9 * s, 3.6 * s), yaw)
        add_box(bmL, (p.x, p.y, p.z + 3.9 * s), (8.5 * s, 10 * s, 0.4), yaw)
    lines = []
    for sgn in (1, -1):  # up line on +side, down line on -side, with sag between towers
        pts = []
        for a, b in zip(tower_tops, tower_tops[1:]):
            for k in range(12):
                t = k / 12
                p = a.lerp(b, t) + side * (2.1 * sgn)
                p.z -= 1.4 * 4 * t * (1 - t)
                pts.append(p)
        pts.append(tower_tops[-1] + side * (2.1 * sgn))
        for a, b in zip(pts, pts[1:]):
            add_cyl(bmL, a, b, 0.03, 6)
        lines.append(pts)
    for li2, pts in enumerate(lines):  # static chairs (the ride chair moves on the web)
        for k in range(3, len(pts) - 2, 6):
            chair_bm(bmL, pts[k], yaw)
    _object(f"Lift_{li + 1}", from_bmesh(f"Lift_{li + 1}", bmL, steel, smooth=False), (0, 0, 0), export)
    LIFTS.append([[round(p.x, 2), round(p.z, 2), round(-p.y, 2)] for p in lines[0]])

bmC = bmesh.new()
chair_bm(bmC, (0, 0, 0), 0)
_object("Chair", from_bmesh("Chair", bmC, seat, smooth=False), (0, -440, 0), export)

# ── Summit flags ──────────────────────────────────────────────────────────────
for i, (sx, sy, _, _) in enumerate(SUMMITS):
    flag = empty(f"Flag_{i}", (sx + 3, sy + 2, SUMMIT_TOP[i]), export)
    cylinder(f"Flag_{i}_Pole", 0.05, 4.2, (0, 0, 2.1), steel, export, bevel=0.0, parent=flag)
    cloth = material(f"Cloth{i}", "#FF8A4C" if i == 2 else "#F2F2F2", rough=0.7)
    extruded_shape(f"Flag_{i}_Cloth", [(0, 0), (1.9, -0.5), (0, -1.0)], 0.03, (0.05, 0, 4.1), cloth, export,
                   bevel=0.0, parent=flag)

# ── Conifers: layered drooping tiers, snow on the upper surfaces ──────────────
needles = material("Needles", "#2E4A35", rough=0.85)
needles_dark = material("NeedlesDark", "#22382A", rough=0.9)
bark = material("Bark", "#4A3729", rough=0.9)
tree_snow = material("TreeSnow", "#F2F5FA", rough=0.75)


def conifer(name, tiers, height_m, spread, seed):
    rnd = random.Random(seed)
    bm = bmesh.new()
    tv = add_cyl(bm, (0, 0, -0.3), (0, 0, height_m * 0.35), 0.18, 8)
    for f in {f for v in tv for f in v.link_faces}:
        f.material_index = 2
    for k in range(tiers):
        u = k / (tiers - 1)
        z = height_m * (0.18 + 0.76 * u)
        r = spread * (1 - u) ** 0.9 + 0.35
        n = 13
        ring = []
        for j in range(n * 2):
            a = j / (n * 2) * math.tau + rnd.uniform(-0.08, 0.08)
            rr = r * (1.0 if j % 2 == 0 else 0.62) * rnd.uniform(0.88, 1.08)
            droop = height_m * 0.09 * (1 if j % 2 == 0 else 0.45)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z - droop)))
        apex = bm.verts.new((0, 0, z + height_m * 0.11))
        mi = 0 if k % 2 else 1
        for j in range(len(ring)):
            bm.faces.new((ring[j], ring[(j + 1) % len(ring)], apex)).material_index = mi
        under = bm.verts.new((0, 0, z - height_m * 0.07))
        for j in range(len(ring)):
            bm.faces.new((ring[(j + 1) % len(ring)], ring[j], under)).material_index = 1
        sring = [bm.verts.new((v.co.x * 0.72, v.co.y * 0.72, v.co.z + height_m * 0.03 + (0.06 if q % 4 else 0)))
                 for q, v in enumerate(ring) if q % 2 == 0]
        sapex = bm.verts.new((0, 0, z + height_m * 0.115))
        for j in range(len(sring)):
            if rnd.random() < 0.8:
                bm.faces.new((sring[j], sring[(j + 1) % len(sring)], sapex)).material_index = 3
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in (needles, needles_dark, bark, tree_snow):
        me.materials.append(m)
    return _object(name, me, (0, -400, 0), export)


TREES = [conifer("TreeA", 7, 11.0, 2.9, 1), conifer("TreeB", 6, 8.5, 2.5, 2), conifer("TreeC", 8, 14.0, 3.2, 3)]

random.seed(9)
instances = []
lift_xy = [[(p[0], -p[2]) for p in L] for L in LIFTS]


def near_lift(x, y):
    return any((x - px) ** 2 + (y - py) ** 2 < 49 for L in lift_xy for px, py in L[::3])


tries = 0
while len(instances) < 700 and tries < 25000:
    tries += 1
    x, y = random.uniform(-230, 290), random.uniform(-160, 170)
    z = height(x, y)
    if z > 48 or z < 1:
        continue
    gx = height(x + 1.5, y) - height(x - 1.5, y)
    gy = height(x, y + 1.5) - height(x, y - 1.5)
    if math.hypot(gx, gy) / 3 > 0.75:
        continue
    if piste_dist(x, y) < 9 or near_lift(x, y) or any(math.hypot(x - bx, y - by) < 16 for bx, by in BASES):
        continue
    if fbm(x, y, 0.025, 2) < -0.05:  # forests come in clumps, with clearings
        continue
    v = random.randrange(3)
    s = random.uniform(0.75, 1.25) * (1 - z / 140)
    instances.append([round(x, 2), round(z - 0.2, 2), round(-y, 2), round(random.uniform(0, 6.283), 3), round(s, 3), v])

for x, z, my, rot, s, v in instances:  # linked duplicates for the Blender preview only
    o = _object(f"T_{len(render_only.objects)}", TREES[v].data, (x, -my, z), render_only, rot=(0, 0, rot))
    o.scale = (s, s, s)

# ── Skier: articulated human (standing, facing +Y); joints are empties ────────
jacket = material("Jacket", "#E4572E", rough=0.62, coat=0.15)
pants = material("Pants", "#1F2A44", rough=0.75)
skin = material("Skin", "#C99A7E", rough=0.6)
helmet_m = material("Helmet", "#F1F1F1", rough=0.25, coat=0.8)
lens = material("Lens", "#F2A65A", rough=0.05, metal=0.9)
dark = material("Gear", "#1C1D21", rough=0.5)
ski_top = material("SkiTop", "#20252E", rough=0.3, coat=0.6)
ski_accent = material("SkiAccent", "#FF8A4C", rough=0.35)


def limb(name, length, r_top, r_bot, parent, mat, segs=20):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r_bot, radius2=r_top, depth=length,
                          matrix=Matrix.Translation((0, 0, -length / 2)))
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=r_top)
    return _object(name, from_bmesh(name, bm, mat), (0, 0, 0), export, parent=parent)


def blob(name, r, sc, loc, parent, mat):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=r)
    for v in bm.verts:
        v.co.x *= sc[0]
        v.co.y *= sc[1]
        v.co.z *= sc[2]
    return _object(name, from_bmesh(name, bm, mat), loc, export, parent=parent)


skier = empty("Skier", (0, -420, 0), export)
PELVIS_H = 1.08  # standing straight, ski soles exactly on the ground (hip 0.06 + legs 0.86 + boot/ski 0.16)
pelvis = empty("Pelvis", (0, 0, PELVIS_H), export, parent=skier)
blob("PelvisMesh", 1.0, (0.17, 0.12, 0.13), (0, 0, 0), pelvis, pants)
spine = empty("Spine", (0, 0, 0.06), export, parent=pelvis)
blob("Torso", 1.0, (0.2, 0.135, 0.3), (0, 0, 0.27), spine, jacket)
blob("Chest", 1.0, (0.21, 0.14, 0.14), (0, 0.005, 0.44), spine, jacket)
box("Zip", (0.02, 0.01, 0.42), (0, 0.137, 0.3), dark, export, bevel=0.004, parent=spine)
blob("Collar", 1.0, (0.09, 0.09, 0.06), (0, 0, 0.58), spine, jacket)
neck = empty("Neck", (0, 0, 0.6), export, parent=spine)
head = empty("Head", (0, 0, 0.08), export, parent=neck)
blob("Face", 0.1, (0.95, 1.0, 1.15), (0, 0.035, 0.09), head, skin)
blob("Helmet", 0.13, (1.0, 1.12, 0.92), (0, -0.005, 0.15), head, helmet_m)
box("GoggleBand", (0.21, 0.07, 0.07), (0, 0.075, 0.12), dark, export, bevel=0.025, parent=head)
box("GoggleLens", (0.19, 0.02, 0.06), (0, 0.11, 0.12), lens, export, bevel=0.012, parent=head)
for s, L in ((-1, "L"), (1, "R")):
    sh = empty(f"Shoulder{L}", (s * 0.215, 0, 0.5), export, parent=spine)
    limb(f"UpperArm{L}", 0.29, 0.058, 0.05, sh, jacket)
    el = empty(f"Elbow{L}", (0, 0, -0.29), export, parent=sh)
    limb(f"ForeArm{L}", 0.25, 0.05, 0.043, el, jacket)
    wr = empty(f"Wrist{L}", (0, 0, -0.25), export, parent=el)
    blob(f"Glove{L}", 0.055, (0.9, 1.1, 1.2), (0, 0.01, -0.04), wr, dark)
    pole = empty(f"Pole{L}", (0, 0.02, -0.04), export, parent=wr)
    cylinder(f"PoleShaft{L}", 0.009, 1.18, (0, 0, -0.59), steel, export, bevel=0.0, verts=10, parent=pole)
    cylinder(f"PoleBasket{L}", 0.045, 0.012, (0, 0, -1.08), dark, export, bevel=0.0, verts=16, parent=pole)
    hp = empty(f"Hip{L}", (s * 0.095, 0, -0.06), export, parent=pelvis)
    limb(f"Thigh{L}", 0.44, 0.08, 0.06, hp, pants)
    kn = empty(f"Knee{L}", (0, 0, -0.44), export, parent=hp)
    limb(f"Shin{L}", 0.42, 0.06, 0.045, kn, pants)
    an = empty(f"Ankle{L}", (0, 0, -0.42), export, parent=kn)
    box(f"Boot{L}", (0.12, 0.3, 0.2), (0, 0.04, -0.03), dark, export, bevel=0.035, parent=an)
    box(f"Ski{L}", (0.095, 1.72, 0.022), (0, 0.1, -0.14), ski_top, export, bevel=0.01, parent=an)
    box(f"SkiTip{L}", (0.095, 0.2, 0.024), (0, 1.0, -0.12), ski_accent, export, bevel=0.01, parent=an,
        rot=(R(20), 0, 0))
    box(f"Binding{L}", (0.08, 0.36, 0.05), (0, 0.04, -0.115), steel, export, bevel=0.01, parent=an)

J = {o.name: o for o in export.objects if o.type == "EMPTY" and not o.name.startswith("Flag")}


def pose(**rot):
    for name, o in J.items():
        if name != "Skier":
            o.rotation_euler = (0, 0, 0)
    for k, v in rot.items():
        J[k].rotation_euler = v


def stance(angulate=0.0, crouch=0.0):
    """Athletic carving stance (angulate + = hips into a right turn)."""
    f = 1 + crouch
    pose(
        Pelvis=(0, angulate, 0),
        Spine=(-0.38 * f, -angulate * 0.8, 0),
        Neck=(0.22, 0, 0),
        HipL=(0.62 * f, 0, 0), HipR=(0.62 * f, 0, 0),
        KneeL=(-0.95 * f, 0, 0), KneeR=(-0.95 * f, 0, 0),
        AnkleL=(0.33 * f, -angulate, 0), AnkleR=(0.33 * f, -angulate, 0),
        ShoulderL=(0.5, 0, R(-12)), ShoulderR=(0.5, 0, R(12)),
        ElbowL=(0.75, 0, 0), ElbowR=(0.75, 0, 0),
        PoleL=(-1.45, 0, 0), PoleR=(-1.45, 0, 0),
    )


# ── Path data for the web ─────────────────────────────────────────────────────
route = {
    "summits": [[round(sx, 2), round(top, 2), round(-sy, 2)] for (sx, sy, _, _), top in zip(SUMMITS, SUMMIT_TOP)],
    "descents": [[[round(x, 2), round(z, 2), round(-y, 2)] for x, y, z in d] for d in DESCENTS],
    "jump": list(JUMP_T),
    "lifts": LIFTS,
}
with open(ROOT + "/src/components/experience/ski-route.json", "w", encoding="utf-8") as fh:
    json.dump(route, fh, separators=(",", ":"))
with open(ROOT + "/public/models/ski-trees.json", "w", encoding="utf-8") as fh:
    json.dump({"variants": ["TreeA", "TreeB", "TreeC"], "trees": instances}, fh, separators=(",", ":"))

# ── Lighting: winter sky HDRI + sun; preview renders ──────────────────────────
world = scene.world or bpy.data.worlds.new("World")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
wn, wl = world.node_tree.nodes, world.node_tree.links
envt = wn.new("ShaderNodeTexEnvironment")
envt.image = image(f"{PH}/lago_disola/lago_disola_1k.hdr")
wl.new(envt.outputs["Color"], wn["Background"].inputs["Color"])
wn["Background"].inputs["Strength"].default_value = 1.0
sun_d = bpy.data.lights.new("Sun", "SUN")
sun_d.energy = 3.2
sun_d.angle = R(2.5)
sun = bpy.data.objects.new("Sun", sun_d)
sun.rotation_euler = (R(52), 0, R(-35))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("Camera", bpy.data.cameras.new("Camera"))
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = "BLENDER_EEVEE"
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_x, scene.render.resolution_y = 1280, 800
for attr, val in (("taa_render_samples", 32), ("use_raytracing", True), ("use_shadows", True)):
    if hasattr(scene.eevee, attr):
        setattr(scene.eevee, attr, val)


def shot(name, cam_loc, target, lens_mm):
    cam.location = cam_loc
    aim(cam, target)
    cam.data.lens = lens_mm
    cam.data.clip_end = 2000
    scene.render.filepath = f"{ROOT}/blender/renders/ski-{name}.png"
    bpy.ops.render.render(write_still=True)


def leg_drop():
    """How much the bent legs lower the hips vs. standing straight (so skis stay on the snow)."""
    th = J["HipL"].rotation_euler[0]
    sh = th + J["KneeL"].rotation_euler[0]
    return 0.44 * (1 - math.cos(th)) + 0.42 * (1 - math.cos(sh))


def place_skier(p, heading_xy, lean=0.0):
    J["Pelvis"].location = (0, 0, PELVIS_H - leg_drop())
    J["Skier"].location = (p[0], p[1], p[2])
    J["Skier"].rotation_euler = (0, lean, math.atan2(heading_xy[1], heading_xy[0]) - math.pi / 2)


# 1) high overview
ox, oy = -150.0, -110.0
shot("overview", (ox, oy, max(150.0, height(ox, oy) + 70)), (30, 25, 30), 30)

# 2) carving mid-turn on descent 1
d = DESCENTS[0]
p, q = d[38], d[40]
hx, hy = q[0] - p[0], q[1] - p[1]
L = math.hypot(hx, hy)
stance(angulate=R(14))
place_skier(p, (hx, hy), lean=R(-24))
shot("carve", (p[0] - hx / L * 6 + hy / L * 3.5, p[1] - hy / L * 6 - hx / L * 3.5, p[2] + 2.6),
     (p[0], p[1], p[2] + 0.8), 40)

# 3) summit close-up (Nami Tech), standing tall, looking at the view
sx, sy, _, _ = SUMMITS[2]
g = SUMMIT_TOP[2]
stance(crouch=-0.45)
J["Neck"].rotation_euler = (0.05, 0, R(25))
place_skier((sx, sy, g), (-0.3, 1.0))  # facing north, over the range
shot("summit", (sx + 3.6, sy + 1.4, g + 1.8), (sx - 0.4, sy + 0.6, g + 1.15), 32)

# 4) chairlift ride on lift 2, seated
Lp = LIFTS[1]
mid, nxt = Lp[len(Lp) // 2], Lp[len(Lp) // 2 + 1]
cx, cy, cz = mid[0], -mid[2], mid[1]
ryaw = math.atan2(-nxt[2] - cy, nxt[0] - cx) - math.pi / 2
bmR = bmesh.new()
chair_bm(bmR, (cx, cy, cz), ryaw)
_object("RideChair", from_bmesh("RideChair", bmR, seat, smooth=False), (0, 0, 0), render_only)
pose(HipL=(1.5, 0, 0), HipR=(1.5, 0, 0), KneeL=(-1.35, 0, 0), KneeR=(-1.35, 0, 0), AnkleL=(0.1, 0, 0),
     AnkleR=(0.1, 0, 0), Spine=(0.05, 0, 0), ShoulderL=(0.25, 0, R(-8)), ShoulderR=(0.25, 0, R(8)),
     ElbowL=(0.9, 0, 0), ElbowR=(0.9, 0, 0), PoleL=(-1.2, 0, 0), PoleR=(-1.2, 0, 0), Neck=(0.0, 0, R(-20)))
J["Skier"].location = (cx, cy, cz - 2.3 + 0.12 - 0.98)
J["Skier"].rotation_euler = (0, 0, ryaw)
shot("lift", (cx + 7 * math.cos(ryaw), cy + 7 * math.sin(ryaw) - 2, cz - 1.0), (cx, cy, cz - 2.6), 38)

# reset for export
pose()
J["Skier"].location, J["Skier"].rotation_euler = (0, -420, 0), (0, 0, 0)

bpy.ops.wm.save_as_mainfile(filepath=ROOT + "/blender/ski-run.blend")
size = export_glb("Export", ROOT + "/public/models/ski-run.glb")
result = {"glb_bytes": size, "trees": len(instances), "terrain_verts": nx * ny, "lift_pts": [len(l) for l in LIFTS]}
