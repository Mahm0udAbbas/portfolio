"""Replace the baked sign lettering without rebuilding all street geometry."""
import bpy, bmesh, os, json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
exec(compile(open(ROOT+'/blender/_helpers.py',encoding='utf-8').read(),'_helpers.py','exec'))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/city-walk.blend')
sc=bpy.context.scene
c=bpy.data.collections['CityWalk']
removed=0
for o in list(c.objects):
    if o.get('journey_sign'):
        bpy.data.objects.remove(o,do_unlink=True)
        continue
    if o.type!='MESH' or not any(m and m.name=='Road paint' for m in o.data.materials):continue
    bm=bmesh.new();bm.from_mesh(o.data)
    old=[]
    for v in bm.verts:
        p=o.matrix_world @ v.co
        if -3.35<p.y<-3.30 and 3.0<p.z<3.72:old.append(v)
    removed+=len(old)
    bmesh.ops.delete(bm,geom=old,context='VERTS')
    bm.to_mesh(o.data);bm.free();o.data.update()
signs=json.load(open(ROOT+'/src/content/journey-street.json',encoding='utf-8'))
for i,sign in enumerate(signs):
    x=-17.2+i*8.6
    for field,size,z in (('title',.29,3.44),('subtitle',.14,3.18)):
        o=text3d('Journey sign '+str(i)+' '+field,sign[field],size,.003,(x,-3.32,z),bpy.data.materials['Road paint'],c,bevel=0)
        o['journey_sign']=True
        o['text']=sign[field]
        bpy.context.view_layer.update()
        if o.dimensions.x>7.3:o.scale.x*=7.3/o.dimensions.x
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/city-walk.blend')
bpy.ops.object.select_all(action='DESELECT')
for o in c.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/city-walk.glb',use_selection=True,
    export_format='GLB',export_animations=False,export_lights=True,export_cameras=False,export_extras=True,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
# Check the first career checkpoint at a legible storefront angle.
sc.camera.location=(-7,-16,5.2);aim(sc.camera,(-8.6,-3,3))
sc.camera.data.lens=45;sc.cycles.samples=16
sc.render.resolution_x=1200;sc.render.resolution_y=800
sc.render.filepath=ROOT+'/blender/renders/journey-signs.png'
bpy.ops.render.render(write_still=True)
print('REPLACED_SIGN_VERTICES='+str(removed))
