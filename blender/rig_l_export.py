import bpy, os
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc
if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
arm = next(o for o in sc.objects if o.type == "ARMATURE")
mesh = bpy.data.objects["SkierScan"]
marks = [o for o in sc.objects if o.type == "EMPTY" and o.name.startswith(("SkiL_rig", "SkiR_rig", "RigSki"))]
for m in marks:
    if not m.name.startswith("RigSki"):
        m.name = "RigSki" + m.name[3]  # RigSkiL / RigSkiR
arm.name = "SkierRigObj"
coll = bpy.data.collections.get("SkierExport") or bpy.data.collections.new("SkierExport")
if coll.name not in sc.collection.children:
    sc.collection.children.link(coll)
for o in [arm, mesh] + marks:
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
bpy.ops.object.select_all(action="DESELECT")
for o in [arm, mesh] + marks:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
out = ROOT + "/public/models/skier.glb"
with bpy.context.temp_override(window=bpy.context.window, scene=sc, view_layer=sc.view_layers[0]):
  bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", use_selection=True, use_active_scene=True, export_apply=False,
    export_cameras=False, export_lights=False, export_yup=True, export_normals=True,
    export_texcoords=False, export_materials="EXPORT", export_skins=True, export_animations=False,
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_draco_position_quantization=14, export_draco_normal_quantization=10,
)
ids = set([arm, mesh] + marks)
mats = set(mesh.data.materials)
bpy.data.libraries.write(ROOT + "/blender/skier.blend", ids | {arm.data, mesh.data} | mats | {coll}, fake_user=True)
result = {"glb_kb": round(os.path.getsize(out) / 1024), "marks": [m.name for m in marks]}
