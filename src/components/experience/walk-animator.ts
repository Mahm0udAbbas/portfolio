import * as THREE from "three";

type Motion = "Idle" | "Start" | "Walk" | "Stop" | "Left" | "Turn";

/** A single skeleton with cross-faded, in-place Mixamo clips. */
export class WalkAnimator {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private state: Motion = "Idle";
  private elapsed = 0;
  private lastDirection = 1;
  private moving = false;
  private quietTime = 1;
  private cadence = 1;

  constructor(model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of clips)
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    for (const name of ["Idle", "Start", "Walk", "Stop", "Left", "Turn"]) {
      if (!this.actions.has(name))
        throw new Error(`Walker animation missing: ${name}`);
    }
    this.actions.get("Idle")!.play();
  }

  private play(next: Motion) {
    if (next === this.state) return;
    const before = this.actions.get(this.state)!;
    const action = this.actions.get(next)!;
    const loop = next === "Idle" || next === "Walk";
    action
      .reset()
      .setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1).play();
    // Skip the stationary lead-in: scrolling must produce steps immediately.
    if (next === "Start") action.time = Math.max(0, action.getClip().duration - 0.45);
    // Use the settling portion of the supplied three-second stop clip.
    if (next === "Stop")
      action.time = Math.max(0, action.getClip().duration - 0.75);
    before.crossFadeTo(action, 0.4, false);
    this.state = next;
    this.elapsed = 0;
  }

  update(speed: number, direction: number, corner: boolean, dt: number) {
    this.elapsed += dt;
    // Wheel events arrive in bursts. Keep one gait through the short gaps instead
    // of restarting Start/Stop on every animation frame without a wheel event.
    this.quietTime = speed > 0.035 ? 0 : this.quietTime + dt;
    const moving = speed > 0.1 || (this.moving && this.quietTime < 0.16);
    // Stride rate tracks ground speed, within a range that still reads as walking.
    this.cadence = THREE.MathUtils.damp(this.cadence, Math.min(2.4, Math.max(0.55, speed / 1.35)), 6, dt);
    if (moving && direction !== this.lastDirection) {
      this.lastDirection = direction;
      this.play("Turn");
    } else if (this.state === "Turn" && this.elapsed < 0.9) {
      // Let the supplied turn finish rather than immediately replacing it with Walk.
    } else if (!moving) {
      if (this.moving) this.play("Stop");
      else if (
        this.state !== "Idle" &&
        (this.state !== "Stop" || this.elapsed > 0.72)
      )
        this.play("Idle");
    } else if (!this.moving) this.play("Start");
    else if (this.state === "Start" && this.elapsed < 0.30) {
      // Blend the first step into the repeating walk cycle.
    } else if (corner && this.state !== "Left") this.play("Left");
    else if (this.state !== "Left" || this.elapsed > 1.1) this.play("Walk");
    this.moving = moving;
    if (this.state === "Walk")
      this.actions
        .get("Walk")!
        .setEffectiveTimeScale(this.cadence);
    this.mixer.update(dt);
  }

  dispose(model: THREE.Object3D) {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(model);
  }
}
