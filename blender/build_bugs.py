"""
Footer bugs: three toy species in one file. Run with the helpers prepended:
    python -I tools/blender_bridge.py blender/_helpers.py blender/build_bugs.py

Blender axes: forward = +Y, up = +Z (glTF/three: forward = -Z, up = +Y). Each bug ~1.6-2 units long.
Top-level empties: "Ladybug", "Ant", "Spider". Children are named "<Species>_<Part>":
  Shell        main body colour, recoloured per bug on the web
  Head         bobs while walking
  AntennaL/R   wiggle (ladybug, ant)
  Leg_L1..Ln / Leg_R1..Rn   (1 = front; spider has 4 pairs) — origin at the hip, swing around local up
"""

reset_scene()
scene = bpy.context.scene
export = new_collection("Export")
preview = new_collection("RenderOnly")
M = toy_materials()


def squashed_sphere(name, radius, scale, loc, mat, coll, **kw):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=20, radius=radius)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    return _object(name, from_bmesh(name, bm, mat), loc, coll, **kw)


def legs(prefix, coll, parent, hips, reach, span, lift, drop, radius):
    """Pairs of jointed legs. hips: y per pair; reach: forward offset of each foot."""
    for side, lbl in ((-1, "L"), (1, "R")):
        for i, (y, r) in enumerate(zip(hips, reach), start=1):
            tube(f"{prefix}_Leg_{lbl}{i}",
                 [(0, 0, 0), (side * span * 0.5, r * 0.55, lift), (side * span, r, drop)],
                 radius, (side * hips_x[prefix], y, 0.18), M["charcoal"], coll, segs=14, parent=parent)


hips_x = {"Ladybug": 0.3, "Ant": 0.1, "Spider": 0.16}


def ladybug(coll, loc=(0, 0, 0), rot=(0, 0, 0), shell=None):
    p = "Ladybug"
    bug = empty(p, loc, coll, rot=rot)
    squashed_sphere(f"{p}_Shell", 1.0, (0.5, 0.68, 0.36), (0, -0.08, 0.26), shell or M["lime"], coll, parent=bug)
    for i, (sx, sy, r) in enumerate([(-0.2, 0.08, 0.1), (0.2, 0.08, 0.1), (-0.18, -0.36, 0.085), (0.18, -0.36, 0.085)]):
        k = 1 - (sx / 0.5) ** 2 - ((sy + 0.08) / 0.68) ** 2
        sz = 0.26 + 0.36 * math.sqrt(max(k, 0)) - 0.025
        squashed_sphere(f"{p}_Spot{i}", r, (1, 1, 0.45), (sx, sy, sz), M["charcoal"], coll, parent=bug)
    squashed_sphere(f"{p}_Thorax", 0.3, (1.15, 0.8, 0.75), (0, 0.55, 0.24), M["charcoal"], coll, parent=bug)
    head = squashed_sphere(f"{p}_Head", 0.24, (1.0, 0.95, 0.85), (0, 0.84, 0.24), M["charcoal"], coll, parent=bug)
    for side, lbl in ((-1, "L"), (1, "R")):
        sphere(f"{p}_Eye{lbl}", 0.075, (side * 0.13, 0.17, 0.08), M["cream"], coll, parent=head)
        tube(f"{p}_Antenna{lbl}", [(0, 0, 0), (side * 0.12, 0.3, 0.14), (side * 0.32, 0.5, 0.1)], 0.026,
             (side * 0.08, 0.16, 0.12), M["charcoal"], coll, segs=14, parent=head)
    legs(p, coll, bug, hips=(0.42, 0.12, -0.2), reach=(0.14, 0.02, -0.14), span=0.62, lift=0.12, drop=-0.18,
         radius=0.035)
    return bug


def ant(coll, loc=(0, 0, 0), rot=(0, 0, 0), shell=None):
    p = "Ant"
    bug = empty(p, loc, coll, rot=rot)
    squashed_sphere(f"{p}_Shell", 1.0, (0.3, 0.44, 0.27), (0, -0.5, 0.27), shell or M["lime"], coll, parent=bug)
    sphere(f"{p}_Waist", 0.075, (0, -0.07, 0.25), M["charcoal"], coll, parent=bug)
    squashed_sphere(f"{p}_Thorax", 1.0, (0.15, 0.3, 0.15), (0, 0.2, 0.27), M["charcoal"], coll, parent=bug)
    head = squashed_sphere(f"{p}_Head", 0.21, (1.0, 1.05, 0.85), (0, 0.66, 0.28), M["charcoal"], coll, parent=bug)
    for side, lbl in ((-1, "L"), (1, "R")):
        sphere(f"{p}_Eye{lbl}", 0.06, (side * 0.14, 0.08, 0.07), M["cream"], coll, parent=head)
        # elbowed antennae: up-forward, then bend out
        tube(f"{p}_Antenna{lbl}", [(0, 0, 0), (side * 0.05, 0.22, 0.28), (side * 0.3, 0.46, 0.16)], 0.022,
             (side * 0.07, 0.14, 0.1), M["charcoal"], coll, segs=14, parent=head)
    # mandibles
    for side in (-1, 1):
        tube(f"{p}_Jaw{'L' if side < 0 else 'R'}", [(0, 0, 0), (side * 0.06, 0.1, -0.02), (0, 0.16, -0.03)], 0.02,
             (side * 0.07, 0.17, -0.05), M["charcoal"], coll, segs=12, parent=head)
    legs(p, coll, bug, hips=(0.32, 0.2, 0.08), reach=(0.3, 0.0, -0.32), span=0.78, lift=0.2, drop=-0.22,
         radius=0.024)
    return bug


def spider(coll, loc=(0, 0, 0), rot=(0, 0, 0), shell=None):
    p = "Spider"
    bug = empty(p, loc, coll, rot=rot)
    squashed_sphere(f"{p}_Shell", 1.0, (0.42, 0.5, 0.36), (0, -0.36, 0.33), shell or M["lime"], coll, parent=bug)
    # hourglass-ish marking on top
    for i, y in enumerate((-0.26, -0.46)):
        squashed_sphere(f"{p}_Mark{i}", 0.09, (1, 0.8, 0.4), (0, y, 0.67), M["charcoal"], coll, parent=bug)
    head = squashed_sphere(f"{p}_Head", 1.0, (0.27, 0.29, 0.2), (0, 0.24, 0.25), M["charcoal"], coll, parent=bug)
    for i, (ex, ey, ez, r) in enumerate([(-0.07, 0.25, 0.1, 0.05), (0.07, 0.25, 0.1, 0.05),
                                         (-0.15, 0.2, 0.08, 0.035), (0.15, 0.2, 0.08, 0.035)]):
        sphere(f"{p}_Eye{i}", r, (ex, ey, ez), M["cream"], coll, parent=head)
    # 8 long legs with high knees
    legs(p, coll, bug, hips=(0.36, 0.28, 0.2, 0.12), reach=(0.55, 0.2, -0.12, -0.45), span=1.0, lift=0.42,
         drop=-0.22, radius=0.03)
    return bug


# Real colourways — mirrors src/components/bugs/bug-palettes.ts (the web recolours per bug from that file)
PALETTES = {
    "Ladybug": [
        dict(shell="#D3201B", spots="#121214", head="#151517", legs="#151517", eyes="#F4F1EA"),  # seven-spot
        dict(shell="#EE7418", spots="#121214", head="#151517", legs="#151517", eyes="#F4F1EA"),  # harlequin
        dict(shell="#F5C21A", spots="#121214", head="#151517", legs="#2A2318", eyes="#F4F1EA"),  # 22-spot
    ],
    "Ant": [
        dict(shell="#6E2410", spots="#6E2410", head="#B4421C", legs="#8E3416", eyes="#111113"),  # fire ant
        dict(shell="#16161A", spots="#16161A", head="#1B1B1F", legs="#3A1F14", eyes="#0D0D0F",
             Thorax="#A93C19", Waist="#A93C19"),  # red wood ant
    ],
    "Spider": [
        dict(shell="#17171C", spots="#E3242B", head="#17171C", legs="#1C1C22", eyes="#3E3E48"),  # black widow
        dict(shell="#F08A1E", spots="#6B3410", head="#8A5528", legs="#7A4A22", eyes="#121214"),  # orange orb-weaver
    ],
}
import re

_mat_cache = {}


def role_of(part):
    if part == "Shell":
        return "shell"
    if re.match(r"^(Spot|Mark)", part):
        return "spots"
    if re.match(r"^(Head|Thorax|Waist)$", part):
        return "head"
    if re.match(r"^(Leg_|Antenna|Jaw)", part):
        return "legs"
    if part.startswith("Eye"):
        return "eyes"
    return None


def paint(root, species, palette):
    for o in [root, *root.children_recursive]:
        if o.type != "MESH":
            continue
        part = o.name.split(".")[0][len(species) + 1:]
        role = role_of(part)
        if not role:
            continue
        color = palette.get(part, palette[role])
        key = (color, role == "shell" or role == "spots")
        if key not in _mat_cache:
            glossy = key[1]
            _mat_cache[key] = material(f"Bug{color}", color, rough=0.22 if glossy else 0.35, coat=0.9 if glossy else 0.4)
        o.data = o.data.copy()
        o.data.materials.clear()
        o.data.materials.append(_mat_cache[key])


builders = {"Ladybug": ladybug, "Ant": ant, "Spider": spider}
for sp, x in (("Ladybug", -2.6), ("Ant", 0), ("Spider", 2.8)):
    paint(builders[sp](export, loc=(x, 0, 0)), sp, PALETTES[sp][0])

# Preview copies: every colourway, in two rows
row = [("Ladybug", 1, -3.6, -2.6), ("Ladybug", 2, -1.2, -2.6), ("Ant", 1, 1.0, -2.6), ("Spider", 1, 3.4, -2.6)]
for sp, vi, x, y in row:
    paint(builders[sp](preview, loc=(x, y, 0), rot=(0, 0, math.radians(15))), sp, PALETTES[sp][vi])

bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
_object("Floor", from_bmesh("Floor", bm, material("Floor", "#0B0B0F", rough=0.55)), (0, 0, -0.02), preview)

studio(scene, cam_loc=(0.0, -8.6, 9.0), cam_target=(0.0, -1.3, 0.2), lens=40)
scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
scene.render.filepath = ROOT + "/blender/renders/bugs.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT + "/blender/bugs.blend")

# Export at the origin (positions are set on the web)
for name in ("Ladybug", "Ant", "Spider"):
    bpy.data.objects[name].location = (0, 0, 0)
size = export_glb("Export", ROOT + "/public/models/bugs.glb")

result = {"glb_bytes": size, "roots": [o.name for o in export.objects if o.parent is None]}
