"""Consolidate the supplied Mixamo character and clips into one web asset."""
import bpy, os, json, math
from mathutils import Quaternion
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = r'C:/Users/Mahmoud Abbas/.t3/userdata/attachments/'
PREFIX = 'f797900c-dbdd-450b-8ea3-2e9921ffe2f2-'
FILES = {'Boss':'24e7bf87-4216-4a5f-9fbd-61886a6e35dc', 'Walk':'62938fb9-c40c-4aad-9ac6-7710491c63ea', 'Start':'77cc470f-199a-49df-81d2-2fd36d195bcb', 'Stop':'650d9c07-8cac-4dfc-a109-9c57d41e211b', 'Left':'fe49f618-60bd-42cb-9eca-2f38546825d9', 'Turn':'fa68cefb-61e1-4dfa-b0ec-d2e63d676c3a'}
bpy.ops.wm.read_factory_settings(use_empty=True)
def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=SOURCE+PREFIX+FILES[name]+'-fbx.fbx', use_custom_props=False)
    objects = set(bpy.data.objects)-before
    arm = next(o for o in objects if o.type=='ARMATURE')
    return arm, objects
arm, objects = load('Boss')
arm.name = 'Walker'
arm.animation_data_clear()
for action in list(bpy.data.actions):
    if action.users == 0: bpy.data.actions.remove(action)
def curves(action):
    return [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
clips = []
for name in ('Walk','Start','Stop','Left','Turn'):
    other, imported = load(name)
    assert set(other.data.bones.keys()) == set(arm.data.bones.keys()), 'Incompatible skeleton'
    action = other.animation_data.action
    action.name = name
    action.use_fake_user = True
    # Remove horizontal root travel. The website owns path position and yaw.
    fcs = curves(action)
    for fc in fcs:
        if 'Hips' in fc.data_path and fc.data_path.endswith('.location') and fc.array_index in (0,2):
            for key in fc.keyframe_points:
                key.co.y = key.handle_left.y = key.handle_right.y = 0
    if name in ('Left','Turn'):
        qs = sorted([fc for fc in fcs if 'Hips' in fc.data_path and fc.data_path.endswith('rotation_quaternion')], key=lambda fc:fc.array_index)
        for i in range(len(qs[0].keyframe_points)):
            q = Quaternion(tuple(fc.keyframe_points[i].co.y for fc in qs))
            twist = Quaternion((q.w,0,q.y,0)).normalized()
            q = twist.inverted() @ q
            for j,fc in enumerate(qs):
                key = fc.keyframe_points[i]
                key.co.y = key.handle_left.y = key.handle_right.y = q[j]
    clips.append(action)
    for obj in imported: bpy.data.objects.remove(obj, do_unlink=True)

# The user supplied a stop clip, not an idle. Hold its relaxed final pose.
idle = next(a for a in clips if a.name=='Stop').copy()
idle.name = 'Idle'
idle_end = idle.frame_range[1]
for fc in curves(idle):
    value = fc.evaluate(idle_end)
    fc.keyframe_points.clear()
    fc.keyframe_points.insert(1,value)
    fc.keyframe_points.insert(31,value)
clips.append(idle)
arm.animation_data_create()
for action in clips:
    track = arm.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, 1, action)
    strip.action_slot = action.slots[0]
    track.mute = True
arm.animation_data.action = idle
arm.animation_data.action_slot = idle.slots[0]
bpy.context.scene.render.fps = 30
bpy.context.scene.frame_set(1)
# Reuse the original packed texture set and avoid unused imported materials in the blend.
for obj in objects:
    if obj.type == 'MESH':
        for mat in obj.data.materials:
            if mat and mat.use_nodes:
                bsdf = next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
                if bsdf: bsdf.inputs['Roughness'].default_value = 0.75
bpy.ops.object.select_all(action='DESELECT')
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/walker.blend')
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/walker.glb', export_format='GLB',
    use_selection=True, export_animation_mode='NLA_TRACKS', export_nla_strips_merged_animation_name='Idle',
    export_force_sampling=True, export_anim_slide_to_zero=True, export_materials='EXPORT',
    export_image_format='JPEG', export_jpeg_quality=85, export_yup=True)
print('WALKER_EXPORT='+json.dumps({'clips':[(a.name,list(a.frame_range)) for a in clips], 'bytes':os.path.getsize(ROOT+'/public/models/walker.glb')}))
