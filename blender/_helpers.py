"""
Shared modelling helpers — prepended to build scripts by tools/blender_bridge.py:
    python -I tools/blender_bridge.py blender/_helpers.py blender/build_<thing>.py
Style: smooth glossy "toy" plastic (white / soft orange / charcoal) for a light page. Objects face -Y (Blender front view).
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

ROOT = r"C:/Users/Mahmoud Abbas/.t3/projects/portfolio"


def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras, bpy.data.curves):
        for d in list(block):
            if d.users == 0:
                block.remove(d)


def new_collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def srgb(hex_str):
    h = hex_str.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def material(name, color, rough=0.35, metal=0.0, coat=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(color), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.08
    if emission:
        b.inputs["Emission Color"].default_value = (*srgb(emission), 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


TOY = {}


def toy_materials():
    TOY.update(
        cream=material("White", "#F7F7F9", rough=0.3, coat=0.6),
        accent=material("Accent", "#FF8A4C", rough=0.28, coat=0.6),
        charcoal=material("Charcoal", "#2A2D36", rough=0.35, coat=0.5),
        glow=material("Glow", "#FF8A4C", rough=0.2, emission="#FF8A4C", strength=0.5),
    )
    return TOY


def _object(name, mesh, loc, coll, rot=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, mesh)
    o.location = loc
    o.rotation_euler = rot
    coll.objects.link(o)
    if parent:
        o.parent = parent
    return o


def from_bmesh(name, bm, mat, smooth=True, sharp_angle=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.shade_smooth()
        if sharp_angle:
            me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    me.materials.append(mat)
    return me


def add_bevel(o, width, segments=6):
    md = o.modifiers.new("Bevel", "BEVEL")
    md.width = width
    md.segments = segments
    md.limit_method = "ANGLE"
    md.harden_normals = True
    return o


def box(name, size, loc, mat, coll, bevel=0.04, segments=6, **kw):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    o = _object(name, from_bmesh(name, bm, mat), loc, coll, **kw)
    return add_bevel(o, bevel, segments) if bevel else o


def sphere(name, radius, loc, mat, coll, **kw):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=radius)
    return _object(name, from_bmesh(name, bm, mat), loc, coll, **kw)


def cylinder(name, radius, depth, loc, mat, coll, bevel=0.01, verts=48, **kw):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=radius, radius2=radius, depth=depth)
    o = _object(name, from_bmesh(name, bm, mat), loc, coll, **kw)
    return add_bevel(o, bevel, 4) if bevel else o


def extruded_shape(name, pts_xz, depth, loc, mat, coll, bevel=0.04, **kw):
    """Flat polygon (x, z points, counter-clockwise seen from front) extruded along Y."""
    bm = bmesh.new()
    verts = [bm.verts.new((x, depth / 2, z)) for x, z in pts_xz]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, -depth, 0), verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _object(name, from_bmesh(name, bm, mat), loc, coll, **kw)
    return add_bevel(o, bevel, 6) if bevel else o


def _curve_to_mesh_object(name, curve_data, loc, mat, coll, sharp_angle=40, **kw):
    tmp = bpy.data.objects.new(name + "_tmp", curve_data)
    coll.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.curves.remove(curve_data)
    me.name = name
    me.materials.clear()
    me.materials.append(mat)
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    return _object(name, me, loc, coll, **kw)


def tube(name, pts_xz, radius, loc, mat, coll, segs=40, **kw):
    """Round 'neon' stroke along a polyline: a cylinder per segment + a sphere per joint/end.
    Points are (x, z) in the XZ plane, or full (x, y, z)."""
    from mathutils import Matrix

    bm = bmesh.new()
    pts = [Vector(p) if len(p) == 3 else Vector((p[0], 0, p[1])) for p in pts_xz]
    for a, b in zip(pts, pts[1:]):
        d = b - a
        rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
        m = Matrix.Translation((a + b) / 2) @ rot
        bmesh.ops.create_cone(bm, cap_ends=False, segments=segs, radius1=radius, radius2=radius, depth=d.length, matrix=m)
    for p in pts:
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=radius, matrix=Matrix.Translation(p))
    return _object(name, from_bmesh(name, bm, mat), loc, coll, **kw)


def text3d(name, body, size, extrude, loc, mat, coll, bevel=0.015, rot=(0, 0, 0), **kw):
    """Extruded text facing -Y, centred on its origin."""
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    r = (rot[0] + math.radians(90), rot[1], rot[2])
    return _curve_to_mesh_object(name, cu, loc, mat, coll, rot=r, **kw)


def empty(name, loc, coll, rot=(0, 0, 0), parent=None):
    """Invisible group node (exports as a plain glTF node)."""
    return _object(name, None, loc, coll, rot=rot, parent=parent)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def studio(scene, cam_loc, cam_target, lens=50, rim="#FFC79E", rim_energy=350, bg_color="#EEF0F4"):
    """Soft three-point studio on the site's background colour."""
    def area(name, loc, energy, size, color):
        d = bpy.data.lights.new(name, "AREA")
        d.energy, d.size, d.color = energy, size, srgb(color)
        o = bpy.data.objects.new(name, d)
        o.location = loc
        scene.collection.objects.link(o)
        aim(o, cam_target)

    area("Key", (-4, -6, 5), 1400, 5, "#FFF4E6")
    area("Fill", (5, -4, 0), 450, 4, "#DDE6FF")
    area("Rim", (1, 5, 4), rim_energy, 3, rim)

    cd = bpy.data.cameras.new("Camera")
    cd.lens = lens
    cam = bpy.data.objects.new("Camera", cd)
    cam.location = cam_loc
    scene.collection.objects.link(cam)
    aim(cam, cam_target)
    scene.camera = cam

    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*srgb(bg_color), 1)
    bg.inputs["Strength"].default_value = 1.0

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    for attr, val in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True)):
        if hasattr(scene.eevee, attr):
            setattr(scene.eevee, attr, val)


def export_glb(collection_name, out_path):
    layer = bpy.context.view_layer.layer_collection.children[collection_name]
    bpy.context.view_layer.active_layer_collection = layer
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_active_collection=True,
        use_active_collection_with_nested=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=True,
        export_draco_mesh_compression_enable=True,  # decoded on the web from /public/draco (self-hosted)
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    return os.path.getsize(out_path)
