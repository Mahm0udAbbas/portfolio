"""Replace scan poles torn by the original automatic binding with rigid equipment."""
import bpy, bmesh
from mathutils import Vector

sc = bpy.data.scenes['SkierRig']
bpy.context.window.scene = sc
mesh = bpy.data.objects['SkierScan']
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
bm = bmesh.new()
bm.from_mesh(mesh.data)
# The scan fused the poles to the clothes. Remove the stretched exterior below
# the hands; retain the boots, legs, and the sleeves above the grips.
bad = [v for v in bm.verts if
       (0.16 < v.co.z < 0.78 and abs(v.co.x) > 0.215) or
       (0.16 < v.co.z < 1.12 and abs(v.co.x) > 0.285)]
bmesh.ops.delete(bm, geom=bad, context='VERTS')
bm.to_mesh(mesh.data)
bm.free()
mesh.data.update()
steel = material('PoleSilver', '#9BA2AD', rough=0.3, metal=0.8)
grip = material('PoleGrip', '#1C1D21', rough=0.8)

def cylinder_between(name, a, b, radius, mat, bone):
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=radius, depth=d.length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    world = obj.matrix_world.copy()
    obj.parent = arm
    obj.parent_type = 'BONE'
    obj.parent_bone = bone
    bpy.context.view_layer.update()
    obj.matrix_world = world

for side in ('L', 'R'):
    name = 'Pole' + side
    head = arm.data.bones[name].head_local.copy()
    tip = head + Vector((0, 0, -0.86))
    cylinder_between('Shaft' + side, head, tip, 0.009, steel, name)
    cylinder_between('Grip' + side, head + Vector((0,0,0.04)), head + Vector((0,0,-0.08)), 0.022, grip, name)
    cylinder_between('Basket' + side, tip + Vector((0,0,0.04)), tip + Vector((0,0,0.05)), 0.045, grip, name)
result = {'removed_vertices': len(bad)}
