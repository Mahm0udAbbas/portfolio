"""
Hero workstation — smooth, glossy "toy" style.
Run inside Blender (via tools/blender_bridge.py or Blender's text editor). Rebuilds the scene from scratch,
renders a preview to blender/renders/, and saves blender/workstation.blend.

Conventions for the web export:
- Everything to export lives in the "Export" collection; the floor is in "RenderOnly".
- The CRT screen is a separate object named "Screen" with UVs, so the site can swap its material
  for a live canvas texture (name / role / terminal).
"""
import math

import bmesh
import bpy
from mathutils import Vector

ROOT = r"C:/Users/Mahmoud Abbas/.t3/projects/portfolio"
RENDER_PATH = ROOT + "/blender/renders/workstation-style-test.png"
BLEND_PATH = ROOT + "/blender/workstation.blend"


# ── helpers ──────────────────────────────────────────────────────────────────
def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for d in list(block):
            if d.users == 0:
                block.remove(d)


def new_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def srgb(hex_str):
    """'#RRGGBB' → linear RGB tuple."""
    h = hex_str.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def material(name, color, rough=0.35, metal=0.0, coat=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True  # deprecated (always on) in newer Blender — harmless if it's a no-op
    except Exception:
        pass
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.08
    if emission:
        b.inputs["Emission Color"].default_value = (*srgb(emission), 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def finish(name, bm, loc, mat, coll, bevel=0.0, segments=6, rot=(0, 0, 0), parent=None, mesh=None):
    if mesh is None:
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.shade_smooth()
        mesh.materials.append(mat)
    o = bpy.data.objects.new(name, mesh)
    o.location = loc
    o.rotation_euler = rot
    coll.objects.link(o)
    if parent:
        o.parent = parent
    if bevel:
        md = o.modifiers.new("Bevel", "BEVEL")
        md.width = bevel
        md.segments = segments
        md.limit_method = "ANGLE"
        md.harden_normals = True
    return o


def box(name, size, loc, mat, coll, bevel=0.04, segments=6, taper=None, **kw):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
        if taper and v.co.y > 0:  # narrow the back (CRT tube)
            v.co.x *= taper
            v.co.z *= taper
    return finish(name, bm, loc, mat, coll, bevel=bevel, segments=segments, **kw)


def cylinder(name, radius, depth, loc, mat, coll, bevel=0.01, verts=48, **kw):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=radius, radius2=radius, depth=depth)
    return finish(name, bm, loc, mat, coll, bevel=bevel, segments=4, **kw)


def screen_panel(name, w, h, loc, mat, coll, bulge=0.03):
    """Slightly bulged CRT glass facing -Y, with UVs (0..1) for the live texture on the web."""
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    bmesh.ops.create_grid(bm, x_segments=32, y_segments=24, size=0.5, calc_uvs=True)
    for v in bm.verts:
        x, y = v.co.x, v.co.y  # -0.5..0.5
        d = bulge * (1 - (2 * x) ** 2) * (1 - (2 * y) ** 2)
        v.co = Vector((x * w, -d, y * h))
    return finish(name, bm, loc, mat, coll)


def aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# ── build ────────────────────────────────────────────────────────────────────
reset_scene()
scene = bpy.context.scene
export = new_collection("Export")
render_only = new_collection("RenderOnly")

M = {
    "plastic": material("Plastic", "#E9E5DA", rough=0.32, coat=0.6),
    "plastic_dark": material("PlasticDark", "#26262F", rough=0.38, coat=0.4),
    "bezel": material("Bezel", "#121218", rough=0.45),
    "screen": material("Screen", "#050805", rough=0.06, coat=1.0, emission="#0E1A06", strength=1.0),
    "lime": material("Lime", "#C6FF3D", rough=0.3, coat=0.5),
    "led": material("LED", "#C6FF3D", rough=0.2, emission="#C6FF3D", strength=6.0),
    "key": material("Keycap", "#F2EFE8", rough=0.36, coat=0.4),
    "coffee": material("Coffee", "#2A160C", rough=0.08, coat=1.0),
    "floor": material("Floor", "#0B0B0F", rough=0.55),
}

# Monitor
mon = box("MonitorHousing", (1.32, 0.95, 1.08), (0, 0, 0.74), M["plastic"], export, bevel=0.13, segments=10)
box("MonitorTube", (1.12, 0.78, 0.86), (0, 0.78, 0.74), M["plastic"], export, bevel=0.12, segments=8, taper=0.7)
box("MonitorNeck", (0.34, 0.3, 0.16), (0, 0.08, 0.13), M["plastic_dark"], export, bevel=0.05)
cylinder("MonitorBase", 0.4, 0.06, (0, 0.05, 0.03), M["plastic"], export, bevel=0.025)
box("Bezel", (1.12, 0.06, 0.86), (0, -0.47, 0.79), M["bezel"], export, bevel=0.08, segments=8)
screen_panel("Screen", 0.98, 0.72, (0, -0.503, 0.79), M["screen"], export, bulge=0.035)
cylinder("PowerLED", 0.024, 0.02, (0.5, -0.478, 0.27), M["led"], export, bevel=0.006, rot=(math.radians(90), 0, 0))
box("FloppySlot", (0.3, 0.02, 0.035), (0.18, -0.476, 0.27), M["bezel"], export, bevel=0.01)
for i in range(4):
    box(f"Vent{i}", (0.14, 0.02, 0.014), (-0.48, -0.476, 0.31 - i * 0.03), M["plastic_dark"], export, bevel=0.006)

# Keyboard (keys parented to a tilted slab, sharing meshes → instanced in glTF)
slab = box(
    "KeyboardBase", (1.46, 0.52, 0.07), (0, -1.08, 0.05), M["plastic"], export, bevel=0.035,
    rot=(math.radians(5), 0, 0),
)
key_mesh = None
accent_mesh = None
pitch, size = 0.107, 0.088
cols = 12
x0 = -(cols - 1) * pitch / 2
rows_y = [0.165, 0.058, -0.049, -0.156]
for r, y in enumerate(rows_y):
    for c in range(cols):
        x = x0 + c * pitch
        if r == 3 and 2 <= c <= 9:  # spacebar row
            continue
        accent = (r == 1 and c == cols - 1)
        o = box(
            f"Key_{r}_{c}", (size, size, 0.05), (x, y, 0.055), M["lime"] if accent else M["key"], export,
            bevel=0.018, segments=4, parent=slab,
            mesh=(accent_mesh if accent else key_mesh),
        )
        if accent:
            accent_mesh = accent_mesh or o.data
        else:
            key_mesh = key_mesh or o.data
box("Spacebar", (pitch * 7 + size, size, 0.05), (x0 + 5.5 * pitch, rows_y[3], 0.055), M["key"], export,
    bevel=0.018, segments=4, parent=slab)

# Cup
cup = cylinder("Cup", 0.115, 0.24, (1.05, -0.72, 0.12), M["lime"], export, bevel=0.02)
cylinder("Coffee", 0.096, 0.01, (1.05, -0.72, 0.226), M["coffee"], export, bevel=0.0)

# Floor (render only — the website has its own background)
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=20)
finish("Floor", bm, (0, 0, 0), M["floor"], render_only)

# ── lights, camera, world ────────────────────────────────────────────────────
def area(name, loc, energy, size, color="#FFFFFF", target=(0, -0.2, 0.6)):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = energy
    d.size = size
    d.color = srgb(color)
    o = bpy.data.objects.new(name, d)
    o.location = loc
    scene.collection.objects.link(o)
    aim(o, target)
    return o


area("Key", (-2.6, -3.2, 4.0), 900, 4.0, "#FFF4E6")
area("Fill", (3.2, -2.4, 1.8), 260, 3.0, "#DDE6FF")
area("Rim", (0.6, 3.4, 3.2), 700, 2.5, "#D8FF8A")

cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 55
cam = bpy.data.objects.new("Camera", cam_data)
cam.location = (2.75, -4.1, 1.85)
scene.collection.objects.link(cam)
aim(cam, (0.05, -0.25, 0.55))
scene.camera = cam

world = scene.world or bpy.data.worlds.new("World")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (*srgb("#0B0B0F"), 1)
bg.inputs["Strength"].default_value = 1.0

# ── render settings ──────────────────────────────────────────────────────────
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1400
scene.render.resolution_y = 1050
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = RENDER_PATH
ee = scene.eevee
for attr, val in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True)):
    if hasattr(ee, attr):
        setattr(ee, attr, val)

bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

result = {
    "render": RENDER_PATH,
    "blend": BLEND_PATH,
    "objects": len(export.objects),
}
