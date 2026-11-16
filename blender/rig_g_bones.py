# Step G2: armature from trusted landmarks + anatomical lengths (IK-solved knees/elbows).
import bpy, mathutils
V = mathutils.Vector
sc = bpy.data.scenes["SkierRig"]
bpy.context.window.scene = sc

def ik(a, c, l1, l2, bend):
    """Middle joint position for a 2-bone chain a->b->c with lengths l1, l2, bending toward `bend`."""
    a, c, bend = V(a), V(c), V(bend)
    d = c - a
    L = min(d.length, (l1 + l2) * 0.999)
    # distance along a->c of the knee foot point
    t = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
    h2 = max(l1 * l1 - t * t, 1e-6)
    dirn = d.normalized()
    side = (bend - dirn * bend.dot(dirn)).normalized()
    return a + dirn * t + side * (h2 ** 0.5)

pc = V((-0.015, -0.44, 0.92))
shL, shR = V((-0.225, -0.36, 1.49)), V((0.195, -0.33, 1.49))
wrL, wrR = V((-0.50, -0.14, 1.11)), V((0.40, 0.07, 1.18))
hipL, hipR = pc + V((-0.125, 0.015, -0.03)), pc + V((0.125, 0.015, -0.03))
anL, anR = V((-0.13, -0.37, 0.17)), V((0.072, -0.14, 0.20))
elL = ik(shL, wrL, 0.35, 0.31, V((-0.5, -0.86, 0)))
elR = ik(shR, wrR, 0.35, 0.31, V((0.5, -0.86, 0)))
knL = ik(hipL, anL, 0.509, 0.485, V((0, 1, 0)))
knR = ik(hipR, anR, 0.509, 0.485, V((0, 1, 0)))
FOOT = V((0.02, 0.27, -0.075))

J = {
    "Pelvis":    (tuple(pc), "Spine"),
    "Spine":     ((-0.015, -0.43, 1.05), "Neck"),
    "Neck":      ((-0.02, -0.42, 1.60), "Head"),
    "Head":      ((-0.03, -0.405, 1.72), (-0.045, -0.375, 1.99)),
    "ShoulderL": (tuple(shL), "ElbowL"),
    "ElbowL":    (tuple(elL), "WristL"),
    "WristL":    (tuple(wrL), tuple(wrL + (wrL - elL).normalized() * 0.12)),
    "PoleL":     (tuple(wrL + V((-0.01, -0.02, -0.02))), (-0.83, -0.25, 0.27)),
    "ShoulderR": (tuple(shR), "ElbowR"),
    "ElbowR":    (tuple(elR), "WristR"),
    "WristR":    (tuple(wrR), tuple(wrR + (wrR - elR).normalized() * 0.12)),
    "PoleR":     (tuple(wrR + V((0.01, 0.02, -0.02))), (0.64, -0.06, 0.26)),
    "HipL":      (tuple(hipL), "KneeL"),
    "KneeL":     (tuple(knL), "AnkleL"),
    "AnkleL":    (tuple(anL), tuple(anL + FOOT)),
    "HipR":      (tuple(hipR), "KneeR"),
    "KneeR":     (tuple(knR), "AnkleR"),
    "AnkleR":    (tuple(anR), tuple(anR + FOOT)),
}
PARENT = {
    "Spine": "Pelvis", "Neck": "Spine", "Head": "Neck",
    "ShoulderL": "Spine", "ElbowL": "ShoulderL", "WristL": "ElbowL", "PoleL": "WristL",
    "ShoulderR": "Spine", "ElbowR": "ShoulderR", "WristR": "ElbowR", "PoleR": "WristR",
    "HipL": "Pelvis", "KneeL": "HipL", "AnkleL": "KneeL",
    "HipR": "Pelvis", "KneeR": "HipR", "AnkleR": "KneeR",
}
def head_of(n):
    return V(J[n][0])
def tail_of(n):
    t = J[n][1]
    return head_of(t) if isinstance(t, str) else V(t)

if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
for o in list(sc.objects):
    if o.type == "ARMATURE":
        bpy.data.objects.remove(o, do_unlink=True)
arm_data = bpy.data.armatures.new("SkierArm")
arm = bpy.data.objects.new("SkierRigObj", arm_data)
sc.collection.objects.link(arm)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = {}
for name in J:
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head_of(name), tail_of(name)
    eb[name] = b
for name, par in PARENT.items():
    eb[name].parent = eb[par]
bpy.ops.object.mode_set(mode="OBJECT")
result = {"bones": len(arm_data.bones), "kneeL": [round(v, 3) for v in knL], "kneeR": [round(v, 3) for v in knR],
          "elL": [round(v, 3) for v in elL], "elR": [round(v, 3) for v in elR]}
