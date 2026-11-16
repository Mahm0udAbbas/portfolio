"""Finish the recovered SkierRig scene through the live Blender bridge.

Run with blender/_helpers.py. Re-export later by opening blender/skier.blend.
"""
import bpy
from mathutils import Vector

sc = bpy.data.scenes['SkierRig']
bpy.context.window.scene = sc
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
mesh = next(o for o in sc.objects if o.type == 'MESH')
for bone in arm.pose.bones:
    bone.matrix_basis.identity()
for side in ('L', 'R'):
    marker = next(o for o in sc.objects if o.name.startswith('Ski' + side + '_new'))
    # Export names must be exact, independent of other scenes' object names.
    marker['contactSide'] = side
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=ROOT + '/blender/skier.blend')
bpy.ops.object.select_all(action='DESELECT')
for o in sc.objects:
    if o.type in ('ARMATURE', 'MESH', 'EMPTY'):
        o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT + '/public/models/skier.glb',
    export_format='GLB', use_selection=True, export_animations=False,
    export_extras=True, export_yup=True)

# A separate review scene leaves the export scene and rig untouched.
review = bpy.data.scenes.get('SkierReview') or bpy.data.scenes.new('SkierReview')
for o in list(review.objects):
    review.collection.objects.unlink(o)
for o in sc.objects:
    review.collection.objects.link(o)
bpy.context.window.scene = review
review.render.engine = 'CYCLES'
review.cycles.samples = 24
review.render.resolution_x = 900
review.render.resolution_y = 900
review.render.resolution_percentage = 100
review.world = bpy.data.worlds.new('SkierReviewWorld')
review.world.use_nodes = True
review.world.node_tree.nodes['Background'].inputs[0].default_value = (0.22, 0.25, 0.3, 1)
review.world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
cam = bpy.data.objects.new('SkierReviewCamera', bpy.data.cameras.new('SkierReviewCamera'))
review.collection.objects.link(cam)
cam.location = (3, 4, 2.6)
cam.rotation_euler = (Vector((0, 0, 0.85)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.8
review.camera = cam
light = bpy.data.objects.new('SkierReviewLight', bpy.data.lights.new('SkierReviewLight', 'AREA'))
review.collection.objects.link(light)
light.location = (2, 3, 5)
light.rotation_euler = (Vector((0, 0, 1)) - light.location).to_track_quat('-Z', 'Y').to_euler()
light.data.energy = 450
light.data.shape = 'DISK'
light.data.size = 4
review.render.filepath = ROOT + '/blender/renders/skier-painted.png'
bpy.ops.render.render(write_still=True)
bpy.context.window.scene = sc
result = {'export': 'public/models/skier.glb', 'saved': 'blender/skier.blend'}
