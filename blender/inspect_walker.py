import bpy, json, os
root = r'C:/Users/Mahmoud Abbas/.t3/userdata/attachments/'
prefix = 'f797900c-dbdd-450b-8ea3-2e9921ffe2f2-'
files = {'Boss':'24e7bf87-4216-4a5f-9fbd-61886a6e35dc', 'Walking':'62938fb9-c40c-4aad-9ac6-7710491c63ea', 'Start':'77cc470f-199a-49df-81d2-2fd36d195bcb', 'Stop':'650d9c07-8cac-4dfc-a109-9c57d41e211b', 'Left':'fe49f618-60bd-42cb-9eca-2f38546825d9', 'Turn':'fa68cefb-61e1-4dfa-b0ec-d2e63d676c3a'}
report = {}
for name, suffix in files.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=root+prefix+suffix+'-fbx.fbx')
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    action = arm.animation_data.action if arm.animation_data else None
    report[name] = {'bones':len(arm.data.bones), 'scale':list(arm.scale), 'rotation':list(arm.rotation_euler),
        'meshes':[(o.name,len(o.data.vertices),list(o.dimensions)) for o in bpy.context.scene.objects if o.type=='MESH'],
        'images':[(i.name,i.size[:],i.packed_file is not None,i.filepath) for i in bpy.data.images],
        'action':action.name if action else None, 'frames':list(action.frame_range) if action else None,
        'root_bones':[(b.name,list(b.head_local)) for b in arm.data.bones if not b.parent]}
    if action:
        report[name]['slots'] = [(s.identifier,s.target_id_type) for s in action.slots]
        curves = [fc for layer in action.layers for strip in layer.strips for bag in strip.channelbags for fc in bag.fcurves]
        report[name]['root_curves'] = [(fc.data_path,fc.array_index,fc.keyframe_points[0].co[:],fc.keyframe_points[-1].co[:]) for fc in curves if 'Hips' in fc.data_path]
print('WALKER_REPORT='+json.dumps(report))
