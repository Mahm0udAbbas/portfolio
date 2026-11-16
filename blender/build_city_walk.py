"""Original dusk city block inspired by the supplied streetscape references.

Run in background Blender. No external assets, textures or user scenes are modified.
"""
import bpy, os, math, random, json
from mathutils import Vector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
exec(compile(open(ROOT+'/blender/_helpers.py', encoding='utf-8').read(), '_helpers.py','exec'))
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(19)
sc = bpy.context.scene
sc.name = 'CityWalk'
c = new_collection('CityWalk')
stone = material('Warm limestone', '#B6A89A', rough=.9)
asphalt = material('Blue asphalt', '#222A39', rough=.94)
metal = material('Ironwork', '#202B34', rough=.45, metal=.65)
roof = material('Roof felt', '#30333D', rough=.95)
white = material('Road paint', '#D8D7CB', rough=.8)
yellow = material('Centre lines', '#C39747', rough=.8)
wood = material('Bench timber', '#825034', rough=.85)
green = material('Awning green', '#244E43', rough=.9)
leaf = material('Foliage', '#36563C', rough=1)
red = material('Hydrant red', '#893B2D', rough=.6, metal=.3)
glow = material('Warm windows', '#FFD79A', rough=.5, emission='#FFC47A', strength=1.2)
dark = material('Unlit windows', '#303E58', rough=.22, metal=.25)
lamp = material('Lamp bulbs', '#FFE7B0', rough=.3, emission='#FFD699', strength=5)
facades = [material('Ochre facade','#AA8545',rough=.95), material('Terracotta facade','#A3583F',rough=.95), material('Brick facade','#66443E',rough=.95), material('Olive facade','#586743',rough=.95), material('Rose facade','#97635B',rough=.95)]
def cube(n,s,p,m=stone,b=.025): return box(n,s,p,m,c,bevel=b,segments=2)
def cyl(n,r,d,p,m=metal): return cylinder(n,r,d,p,m,c,bevel=.008,verts=12)
def rod(n,a,b,r=.025,m=metal):
    a,b=Vector(a),Vector(b)
    o=cyl(n,r,(b-a).length,(a+b)/2,m)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o
def sign(n,words,x,y,z,w,m=green):
    cube(n,(w,.15,.64),(x,y,z),m)
    text3d(n+' letters',words,.30,.003,(x,y-.09,z),white,c,bevel=0)

cube('Road foundation',(110,36,.6),(21.5,0,-.36),asphalt,.15)
cube('Raised sidewalk',(91,16,.28),(21.5,2,-.04),stone,.06)
# Paving grid and a pale curb outline.
for x in range(-24,68,2): cube('Paving joint',(.018,16,.008),(x,2,.104),roof,0)
for y in range(-6,11,2): cube('Paving joint',(91,.018,.008),(21.5,y,.104),roof,0)
for y in (-6.1,10.1): cube('Curb',(91,.18,.30),(21.5,y,-.01),white,.02)
for x in (-24.1,67.1): cube('Curb',(.18,16,.30),(x,2,-.01),white,.02)
for y in (-13.8,-14.15): cube('Double yellow',(110,.10,.012),(21.5,y,-.047),yellow,0)
for x in (-27,70):
    for y in range(-12,-6): cube('Crosswalk',(4,.48,.015),(x,y,-.04),white,0)
for x in range(-21,67,6): cube('Parking bay',(.10,2.8,.012),(x,-7.9,-.045),white,0)

def window(x,y,z):
    cube('Window surround',(1.25,.18,1.95),(x,y,z),stone)
    cube('Window glazing',(1.04,.20,1.72),(x,y-.04,z),glow if random.random()<.7 else dark,.01)
    cube('Window mullion',(1.08,.07,.055),(x,y-.17,z),metal,.005)
    cube('Window sill',(1.45,.40,.12),(x,y-.12,z-.99),stone)
    cube('Window lintel',(1.45,.26,.12),(x,y-.06,z+1.02),stone)

centres=(-17.2,-8.6,0,8.6,17.2,25.8,34.4,43,51.6,60.2)
heights=(15,12,8.7,12.8,8,11,14,9,12,8)
shops=json.load(open(ROOT+'/src/content/journey-street.json',encoding='utf-8'))
for i,(x,h) in enumerate(zip(centres,heights)):
    mat=facades[i % len(facades)]
    cube('Building %d'%i,(8.3,10,h),(x,2,h/2+.1),mat,.07)
    cube('Storefront plinth',(8.45,10.1,.45),(x,2,.32),roof)
    for z in (3.8,h-.25,h+.15): cube('Cornice',(8.65,10.4,.25),(x,2,z),mat,.04)
    cube('Flat rooftop',(8.1,9.8,.16),(x,2,h+.33),roof)
    for yy in (-2.94,6.94): cube('Roof parapet',(8.5,.18,.55),(x,yy,h+.56),mat)
    for xx in (x-4.1,x+4.1): cube('Roof parapet',(.18,10,.55),(xx,2,h+.56),mat)
    # Street-facing floors and side wall windows.
    for z in (5.4,8.6,11.8):
        if z+1.2>h: continue
        for xx in (x-2.55,x,x+2.55): window(xx,-3.08,z)
    # Shop windows, door, illuminated transom and fabric awning.
    for xx in (x-2.5,x):
        cube('Shop frame',(2.1,.18,2.5),(xx,-3.12,1.65),metal)
        cube('Shop display',(1.88,.20,2.25),(xx,-3.17,1.65),glow)
        cube('Shop window divider',(.055,.12,2.3),(xx,-3.31,1.65),metal,0)
        # Products silhouetted inside the lit shop window.
        for k in range(4): cube('Display object',(.22,.20,.25+random.random()*.35),(xx-.65+k*.43,-3.32,.85),wood,.02)
    cube('Door frame',(1.38,.25,2.8),(x+2.7,-3.12,1.55),metal)
    cube('Door glass',(1.13,.28,2.48),(x+2.7,-3.18,1.55),dark)
    rod('Door handle',(x+3.08,-3.37,1.2),(x+3.08,-3.37,1.65),.022,white)
    cube('Shop sign',(7.8,.15,.64),(x,-3.23,3.35),green)
    for body,size,z in ((shops[i]['title'],.29,3.44),(shops[i]['subtitle'],.14,3.18)):
        text3d('Journey sign',body,size,.003,(x,-3.32,z),white,c,bevel=0)
    for k in range(12):
        o=cube('Striped awning',(.61,1.35,.09),(x-3.36+k*.61,-3.78,2.9),green if k%2 else white,.01)
        o.rotation_euler.x=.20
        cube('Awning fringe',(.61,.08,.24),(x-3.36+k*.61,-4.44,2.65),green if k%2 else white,.01)
    # Roof plant and vents.
    cube('HVAC',(1.3,1.2,.7),(x+2,3,h+.76),stone)
    for j in range(6): cube('HVAC grille',(.04,1.23,.48),(x+1.52+j*.19,3,h+.78),metal,0)
    cyl('Vent',.18,.8,(x-2,4,h+.8))
    if i in (0,3,6,8):
        for dx in (-.65,.65):
            for dy in (-.65,.65): rod('Tank leg',(x+dx,3+dy,h+.4),(x+dx*.75,3+dy*.75,h+1.65),.055)
        cyl('Water tank',.93,1.6,(x,3,h+2.25),wood)
        for z in (h+1.6,h+2.15,h+2.85): cyl('Tank band',.96,.07,(x,3,z))
        bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=1.04,radius2=0,depth=.6,location=(x,3,h+3.3))
        o=bpy.context.object; o.name='Tank roof'; o.data.materials.append(metal)
        for co in list(o.users_collection):co.objects.unlink(o)
        c.objects.link(o)
    # Fire escapes on the two tall middle facades.
    if i in (1,3,6,8):
        for z in (4.25,7.45,10.65):
            if z>h-1:continue
            cube('Escape platform',(4.4,.95,.12),(x,-3.65,z),metal)
            for dx in range(12): rod('Escape railing',(x-2.1+dx*.38,-4.10,z),(x-2.1+dx*.38,-4.10,z+1),.025)
            rod('Escape handrail',(x-2.2,-4.10,z+1),(x+2.2,-4.10,z+1),.035)
            for side in (-.24,.24): rod('Ladder side',(x-1+side,-4.1,z),(x+1+side,-4.1,z+3.2),.035)
            for k in range(12):
                t=k/11; rod('Ladder rung',(x-1+2*t-.24,-4.12,z+3.2*t),(x-1+2*t+.24,-4.12,z+3.2*t),.025)

for x in (-22,-12,-2,9,22,33,43,54,65):
    y=-5.65
    cyl('Lamp base',.26,.32,(x,y,.24))
    cyl('Lamp post',.075,4.8,(x,y,2.65))
    pts=[(x,y,4.95),(x,y,5.25),(x,y-.28,5.48),(x,y-.7,5.48),(x,y-1,5.2)]
    tube('Curved lamp arm',pts,.055,(0,0,0),metal,c,segs=8)
    cyl('Lamp shade',.32,.13,(x,y-1,5.12))
    cyl('Lamp glow',.23,.05,(x,y-1,5.04),lamp)
    # Lights are exported as punctual lights and kept within a small radius.
    d=bpy.data.lights.new('Streetlight','POINT');d.energy=95;d.color=(1,.65,.32);d.shadow_soft_size=.5
    o=bpy.data.objects.new('Streetlight',d);c.objects.link(o);o.location=(x,y-1,4.9)
for x in (-13,5,19,30,48,62):
    for j in range(4):cube('Bench slat',(1.8,.12,.09),(x,-4.65+j*.15,.65),wood)
    for z in (.95,1.13):cube('Bench back',(1.8,.09,.14),(x,-4.15,z),wood)
    for dx in (-.65,.65):
        rod('Bench leg',(x+dx,-4.6,.1),(x+dx,-4.6,.65),.045)
        rod('Bench leg',(x+dx,-4.18,.1),(x+dx,-4.18,1.2),.045)
for x in (-20,3,15,28,46,58):
    cyl('Bin',.27,.85,(x,-4.05,.52),green)
    cyl('Bin lid',.30,.08,(x,-4.05,.98),metal)
for x in (-18,15,40,58):
    cyl('Hydrant body',.15,.62,(x,-5.55,.44),red)
    sphere('Hydrant cap',.18,(x,-5.55,.78),red,c)
    rod('Hydrant outlet',(x-.27,-5.55,.53),(x+.27,-5.55,.53),.09,red)
for x in (-22.4,65.5):
    cube('Tree planter',(1.1,1.1,.55),(x,-3.8,.38),roof)
    cyl('Tree trunk',.12,2.7,(x,-3.8,1.7),wood)
    for z,r in ((2.2,.8),(2.9,.95),(3.6,.65)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=(x,-3.8,z))
        o=bpy.context.object;o.name='Tree crown';o.scale.z=1.2;o.data.materials.append(leaf)
        for co in list(o.users_collection):co.objects.unlink(o)
        c.objects.link(o)

# Consolidate static mesh parts by material: detail without thousands of draw calls.
bpy.ops.object.select_all(action='DESELECT')
for o in list(c.objects):
    if o.type=='MESH':
        bpy.context.view_layer.objects.active=o;o.select_set(True)
        for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(False)
for mat in list(bpy.data.materials):
    group=[o for o in c.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
    if not group:continue
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]
    bpy.ops.object.join();group[0].name=mat.name
    bpy.ops.object.select_all(action='DESELECT')

sc.world=bpy.data.worlds.new('Blue hour');sc.world.use_nodes=True
sc.world.node_tree.nodes['Background'].inputs[0].default_value=(*srgb('#7196DE'),1)
sc.world.node_tree.nodes['Background'].inputs[1].default_value=.45
sun=bpy.data.lights.new('Dusk sun','SUN');sun.energy=2;sun.color=(1,.74,.49);sun.angle=.15
o=bpy.data.objects.new('Dusk sun',sun);sc.collection.objects.link(o);o.rotation_euler=(.5,-.6,-.5)
cam=bpy.data.objects.new('City camera',bpy.data.cameras.new('City camera'));sc.collection.objects.link(cam)
cam.location=(80,-85,43);aim(cam,(21,-1,5));cam.data.type='PERSP';cam.data.lens=44;sc.camera=cam
sc.render.engine='CYCLES';sc.cycles.samples=24
sc.render.resolution_x=1440;sc.render.resolution_y=900;sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX'
sc.render.filepath=ROOT+'/blender/renders/city-walk.png'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/blender/city-walk.blend')
for o in c.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/models/city-walk.glb',use_selection=True,
    export_format='GLB',export_animations=False,export_lights=True,export_cameras=False,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
bpy.ops.render.render(write_still=True)
print('CITY_EXPORT_BYTES='+str(os.path.getsize(ROOT+'/public/models/city-walk.glb')))
