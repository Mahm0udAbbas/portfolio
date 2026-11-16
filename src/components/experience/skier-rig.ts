import * as THREE from "three";

/** Apply the run's model-axis poses without discarding Blender's bone bind axes. */
export class SkierRig {
  readonly joints = new Map<string, THREE.Object3D>();
  private bindings: {
    bone: THREE.Bone;
    control: THREE.Object3D;
    rest: THREE.Quaternion;
    parentRest: THREE.Quaternion;
    parentInverse: THREE.Quaternion;
    position: THREE.Vector3;
  }[] = [];
  private delta = new THREE.Vector3();

  constructor(readonly model: THREE.Object3D) {
    model.updateMatrixWorld(true);
    const inverse = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    model.traverse((object) => {
      if (!(object as THREE.Bone).isBone) return;
      const bone = object as THREE.Bone;
      const control = new THREE.Object3D();
      control.name = bone.name;
      const parentRest = bone.parent!.getWorldQuaternion(new THREE.Quaternion()).premultiply(inverse);
      // Controls expose positions in model axes, matching the original articulated skier.
      control.position.copy(bone.position).applyQuaternion(parentRest);
      this.joints.set(bone.name, control);
      this.bindings.push({ bone, control, rest: bone.quaternion.clone(), parentRest,
        parentInverse: parentRest.clone().invert(), position: control.position.clone() });
    });
  }

  apply() {
    for (const { bone, control, rest, parentRest, parentInverse, position } of this.bindings) {
      bone.quaternion.copy(parentInverse).multiply(control.quaternion).multiply(parentRest).multiply(rest);
      this.delta.copy(control.position).sub(position).applyQuaternion(parentInverse);
      bone.position.copy(position).applyQuaternion(parentInverse).add(this.delta);
    }
  }
}
