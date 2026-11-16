"""Review the exported assets together at the actual street-side camera angle."""
import bpy, os, math
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=ROOT+'/blender/city-walk.blend')
sc=bpy.context.scene
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=ROOT+'/public/models/walker.glb')
objects=set(bpy.data.objects)-before
root=bpy.data.objects.new('WalkerPlacement',None);sc.collection.objects.link(root)
for o in objects:
    if o.parent is None:o.parent=root
root.location=(-11,-5.05,.12)
root.rotation_euler.z=math.pi/2
sc.frame_set(12)
cam=sc.camera
cam.location=(-17.8,-15.45,4.6)
cam.rotation_euler=(Vector((-13.4,-3.75,1.8))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=47
sc.cycles.samples=24
sc.render.filepath=ROOT+'/blender/renders/city-walk-character.png'
bpy.ops.render.render(write_still=True)
