"""
Hero: zero-gravity UI toys. Run with the helpers prepended:
    python -I tools/blender_bridge.py blender/_helpers.py blender/build_ui_toys.py

Every top-level object in "Export" is one toy (the site animates each independently).
Moving parts are children with stable names the site looks up:
  Toggle   → ToggleKnob          Slider → SliderThumb, SliderFill
  Button   → ButtonCap           Braces → BraceL, BraceR
  Logo     → LogoCursor          Checkbox → CheckMark
  Cursor   (single piece)        Dot_*  (small floating spheres)
Custom property "toy" on each top-level object = its kind (exported as glTF extras).
"""

reset_scene()
scene = bpy.context.scene
export = new_collection("Export")
M = toy_materials()
R = math.radians


def toy(o, kind):
    o["toy"] = kind
    return o


# ── Logo: "M>" neon tube + lime cursor block (centrepiece) ──────────────────
# SVG path M10 48V16l14 18 14-18 14 16-14 16 (64-unit box, y down) → x right, z up
S = 1 / 22
logo_pts = [((x - 31) * S, (32 - y) * S) for x, y in [(10, 48), (10, 16), (24, 34), (38, 16), (52, 32), (38, 48)]]
logo = toy(tube("Logo", logo_pts, 0.13, (0, 0, 0.15), M["cream"], export), "logo")
box("LogoCursor", (0.55, 0.26, 0.22), ((50 - 31) * S, 0, (32 - 49.5) * S), M["glow"], export, bevel=0.06, parent=logo)

# ── Cursor: classic arrow pointer ───────────────────────────────────────────
arrow = [(0, 0), (0, -1.55), (0.36, -1.2), (0.6, -1.78), (0.86, -1.67), (0.62, -1.1), (1.1, -1.1)]
arrow = [(x * 0.85, z * 0.85) for x, z in arrow]
toy(extruded_shape("Cursor", arrow, 0.22, (1.75, -0.35, 1.75), M["cream"], export, bevel=0.06,
                   rot=(0, R(-14), 0)), "cursor")

# ── Toggle: lime pill track + cream knob (ON) ──────────────────────────────
toggle = toy(box("Toggle", (1.25, 0.42, 0.62), (-1.9, 0.2, 1.45), M["lime"], export, bevel=0.3, segments=10,
                 rot=(0, R(10), 0)), "toggle")
sphere("ToggleKnob", 0.26, (0.31, -0.1, 0), M["cream"], export, parent=toggle)

# ── Slider: charcoal track, lime fill, cream thumb ─────────────────────────
slider = toy(box("Slider", (2.1, 0.18, 0.16), (-1.65, 0.1, -1.35), M["charcoal"], export, bevel=0.08,
                 rot=(0, R(12), 0)), "slider")
box("SliderFill", (1.15, 0.2, 0.17), (-0.47, -0.01, 0), M["lime"], export, bevel=0.08, parent=slider)
cylinder("SliderThumb", 0.24, 0.24, (0.12, -0.04, 0), M["cream"], export, bevel=0.06, parent=slider,
         rot=(R(90), 0, 0))

# ── Button: charcoal base + lime cap with label ────────────────────────────
button = toy(box("Button", (1.75, 0.34, 0.68), (1.85, 0.05, -1.1), M["charcoal"], export, bevel=0.2, segments=8,
                 rot=(0, R(-8), 0)), "button")
cap = box("ButtonCap", (1.6, 0.3, 0.56), (0, -0.14, 0.03), M["lime"], export, bevel=0.2, segments=8, parent=button)
text3d("ButtonLabel", "hire me", 0.3, 0.03, (0, -0.16, -0.02), M["charcoal"], export, bevel=0.006, parent=cap)

# ── Braces { } ─────────────────────────────────────────────────────────────
braces = toy(empty("Braces", (0.35, 0.4, 2.05), export), "braces")
text3d("BraceL", "{", 1.25, 0.12, (-0.32, 0, 0), M["cream"], export, bevel=0.03, parent=braces)
text3d("BraceR", "}", 1.25, 0.12, (0.32, 0, 0), M["cream"], export, bevel=0.03, parent=braces)

# ── Checkbox with check mark ───────────────────────────────────────────────
check = toy(box("Checkbox", (0.62, 0.3, 0.62), (-2.6, 0.6, 0.05), M["cream"], export, bevel=0.14, segments=8,
                rot=(0, R(-12), 0)), "checkbox")
tube("CheckMark", [(-0.17, 0.0), (-0.04, -0.13), (0.2, 0.15)], 0.055, (0, -0.17, 0.0), M["lime"], export,
     parent=check)

# ── Small floating dots for depth ──────────────────────────────────────────
for i, (pos, r, mat) in enumerate([
    ((0.9, 1.0, 1.1), 0.12, "lime"),
    ((-0.8, 1.4, -0.5), 0.16, "cream"),
    ((2.7, 1.2, 0.4), 0.1, "lime"),
    ((-1.1, -0.6, 2.4), 0.09, "cream"),
    ((0.2, 0.8, -1.85), 0.13, "charcoal"),
]):
    toy(sphere(f"Dot_{i}", r, pos, M[mat], export), "dot")

# ── Preview render + save + export ────────────────────────────────────────
studio(scene, cam_loc=(0.4, -10.5, 0.6), cam_target=(0.05, 0, 0.25), lens=50)
scene.render.resolution_x, scene.render.resolution_y = 1600, 1100
scene.render.filepath = ROOT + "/blender/renders/ui-toys.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT + "/blender/ui-toys.blend")
size = export_glb("Export", ROOT + "/public/models/ui-toys.glb")

result = {"glb_bytes": size, "toys": [o.name for o in export.objects if o.parent is None]}
