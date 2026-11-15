"""
Skills: sculpted keycaps in three widths. Run with the helpers prepended:
    python -I tools/blender_bridge.py blender/_helpers.py blender/build_keycaps.py

Export: meshes "Key1u", "Key15u", "Key2u", each centred on its own origin, base at z=0
(1 unit = 1u wide). Colours + labels are applied on the web from site.ts, so the geometry never changes.
"""

reset_scene()
scene = bpy.context.scene
export = new_collection("Export")
preview = new_collection("RenderOnly")
M = toy_materials()

HEIGHT = 0.62
TOP_INSET = 0.13  # how much each side tapers in at the top
TOP_SHIFT = 0.05  # tops lean slightly toward the back, like real caps


def keycap(name, units, loc, mat, coll, rot=(0, 0, 0)):
    w, d = units, 1.0
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        top = v.co.z > 0
        v.co.x *= w - (2 * TOP_INSET if top else 0)
        v.co.y = v.co.y * (d - (2 * TOP_INSET if top else 0)) + (TOP_SHIFT if top else 0)
        v.co.z = HEIGHT if top else 0.0
    # Dish the top: split it and sink the middle a touch
    top_faces = [f for f in bm.faces if f.normal.z > 0.9]
    res = bmesh.ops.inset_region(bm, faces=top_faces, thickness=0.09, depth=-0.035)
    o = _object(name, from_bmesh(name, bm, mat), loc, coll, rot=rot)
    return add_bevel(o, 0.1, 8)


# Export set (spaced out so the preview shows them; positions don't matter on the web)
keycap("Key1u", 1.0, (-2.2, 0, 0), M["cream"], export)
keycap("Key15u", 1.5, (-0.6, 0, 0), M["accent"], export)
keycap("Key2u", 2.0, (1.6, 0, 0), M["charcoal"], export)

# A little pile for the preview render only
import random

random.seed(7)
for i in range(9):
    units = random.choice([1.0, 1.0, 1.5, 2.0])
    mat = random.choice([M["cream"], M["cream"], M["accent"], M["charcoal"]])
    keycap(f"Pile{i}", units, (random.uniform(-2.5, 2.5), random.uniform(1.6, 3.4), random.uniform(0, 0.4)),
           mat, preview, rot=(random.uniform(-0.4, 0.4), random.uniform(-0.4, 0.4), random.uniform(-1, 1)))
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30)
_object("Floor", from_bmesh("Floor", bm, material("Floor", "#EEF0F4", rough=0.6)), (0, 0, 0), preview)

studio(scene, cam_loc=(0.6, -7.5, 4.6), cam_target=(0, 1.2, 0.3), lens=45)
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
scene.render.filepath = ROOT + "/blender/renders/keycaps.png"
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=ROOT + "/blender/keycaps.blend")
size = export_glb("Export", ROOT + "/public/models/keycaps.glb")

result = {"glb_bytes": size, "meshes": [o.name for o in export.objects]}
