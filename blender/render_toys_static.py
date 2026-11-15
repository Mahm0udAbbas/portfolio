"""
Static, transparent render of the hero toys for phones (no WebGL there). Run after build_ui_toys.py:
    python -I tools/blender_bridge.py blender/_helpers.py blender/render_toys_static.py
Writes public/hero/toys.png (served as WebP/AVIF by next/image).
"""
import os

BLEND = ROOT + "/blender/ui-toys.blend"
OUT = ROOT + "/public/hero/toys.png"

if bpy.data.filepath.replace("\\", "/") != BLEND:
    bpy.ops.wm.open_mainfile(filepath=BLEND)

scene = bpy.context.scene
os.makedirs(os.path.dirname(OUT), exist_ok=True)
prev = (scene.render.film_transparent, scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath)
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_x, scene.render.resolution_y = 1200, 825
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
scene.render.film_transparent, scene.render.resolution_x, scene.render.resolution_y, scene.render.filepath = prev

result = {"png": OUT, "bytes": os.path.getsize(OUT)}
