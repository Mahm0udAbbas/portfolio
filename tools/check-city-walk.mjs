import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { walkTimeline, walkPath, chapterProgress, WALK_LENGTH, WALK_CORNER, crossedCheckpoint, smoothDamp } from '../src/components/experience/walk-timeline.ts';
import { WalkAnimator } from '../src/components/experience/walk-animator.ts';

// Geometry/animation checks run without a browser; omit material images only for this test.
const bytes = fs.readFileSync(new URL('../public/models/walker.glb', import.meta.url));
const length = bytes.readUInt32LE(12);
const json = JSON.parse(bytes.subarray(20, 20 + length).toString());
const binary = bytes.subarray(28 + length);
json.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
delete json.images; delete json.textures; delete json.samplers; delete json.materials;
for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
globalThis.ProgressEvent ??= class { constructor(type, data) { Object.assign(this, { type }, data); } };
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
assert.deepEqual(gltf.animations.map(c => c.name).sort(), ['Idle','Left','Start','Stop','Turn','Walk']);
const mixer = new THREE.AnimationMixer(gltf.scene);
const v = new THREE.Vector3();
let sampled = 0;
for (const clip of gltf.animations) {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip).play();
  for (const f of [0, .25, .5, .75, .99]) {
    action.time = clip.duration * f;
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    gltf.scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      o.skeleton.update();
      for (let i=0;i<o.geometry.attributes.position.count;i+=7) {
        o.getVertexPosition(i,v).applyMatrix4(o.matrixWorld);
        assert.ok(Number.isFinite(v.length()), `${clip.name}: nonfinite vertex`);
        box.expandByPoint(v); sampled++;
      }
    });
    assert.ok(box.max.y > 1.3 && box.max.y < 2.6, `${clip.name}: invalid character height ${box.max.y}`);
    assert.ok(box.min.y > -.15 && box.min.y < .25, `${clip.name}: feet not near ground ${box.min.y}`);
    assert.ok(Math.abs(box.getCenter(v).x) < .6 && Math.abs(v.z) < .6, `${clip.name}: root motion escaped path`);
  }
}
mixer.stopAllAction();
const animator = new WalkAnimator(gltf.scene,gltf.animations);
const foot = gltf.scene.getObjectByProperty('name', gltf.scene.getObjectsByProperty('isBone', true).find(b => /LeftFoot$/.test(b.name)).name);
const steps = [];
for(let i=0;i<480;i++) {
  animator.update(1.35,1,false,1/60);
  gltf.scene.updateMatrixWorld(true);
  if(i>120) steps.push(foot.getWorldPosition(new THREE.Vector3()).z);
}
// Every one-second interval after the transition must still contain a full step.
for(let i=0;i+60<=steps.length;i+=60) {
  const window=steps.slice(i,i+60);
  assert.ok(Math.max(...window)-Math.min(...window)>.20, 'Walk froze after its first step');
}
for(let i=0;i<600;i++) animator.update(i<90 || i>500 ? 0 : 1.4, i<300 ? 1 : -1, i>400 && i<450, 1/60);
animator.dispose(gltf.scene);
// Sparse wheel events must not restart the start/stop clips between every notch.
const burstAnimator = new WalkAnimator(gltf.scene,gltf.animations);
const walkAction = burstAnimator.mixer.clipAction(gltf.animations.find(c=>c.name==='Walk'));
let walkingFrames=0;
for(let i=0;i<360;i++) {
  burstAnimator.update(i%4===0 ? 5.4 : 0,1,false,1/60);
  if(i>60 && walkAction.getEffectiveWeight()>.9) walkingFrames++;
}
assert.ok(walkingFrames>270,'Wheel-event gaps repeatedly interrupted the walking cycle');
for(let i=0;i<90;i++) burstAnimator.update(0,1,false,1/60);
const idleAction=burstAnimator.mixer.clipAction(gltf.animations.find(c=>c.name==='Idle'));
assert.ok(idleAction.getEffectiveWeight()>.9,'Character failed to settle after scrolling stopped');
burstAnimator.dispose(gltf.scene);
for(const count of [1,3,5]) {
  let previous=0;
  for(let i=0;i<=10000;i++) {
    const s=walkTimeline(i/10000,count);
    assert.ok(s.distance>=previous-1e-9 && s.distance<=WALK_LENGTH);
    assert.ok(s.index>=0 && s.index<count);
    previous=s.distance;
  }
  for(let i=0;i<count;i++) {
    const s=walkTimeline(chapterProgress(i,count),count);
    assert.equal(s.kind,'entry');assert.equal(s.index,i);
  }
}
for(const boundary of [WALK_CORNER,WALK_CORNER+Math.PI]) {
  const a=walkPath(boundary-1e-5), b=walkPath(boundary+1e-5);
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.0001,'Path corner is discontinuous');
}
assert.equal(crossedCheckpoint(0,1,3),0,'Fast scroll skipped first checkpoint');
assert.equal(crossedCheckpoint(1,0,3),2,'Reverse scroll skipped last checkpoint');
for(let i=0;i<3;i++) {
  const stop=chapterProgress(i,3);
  assert.equal(crossedCheckpoint(stop-.001,stop+.001,3),i);
  assert.equal(crossedCheckpoint(stop+.001,stop-.001,3),i);
  assert.equal(crossedCheckpoint(stop,stop,3),null,'Stopped input retriggered checkpoint');
  assert.equal(crossedCheckpoint(stop,stop+.001,3),null,'Continue immediately locked again');
  assert.equal(crossedCheckpoint(stop,stop-.001,3),null,'Reverse continue immediately locked again');
}
const stops=[0,1,2].map(i=>walkTimeline(chapterProgress(i,3),3).distance);
assert.ok(stops[1]-stops[0]>=29 && stops[2]-stops[1]>=29,'Checkpoints too close');
// Wheel notches every 4 frames must become one continuous, non-reversing glide.
{
  let value=0, velocity=0, target=0, last=0, lastStep=0, maxJerk=0;
  for(let i=0;i<300;i++) {
    if(i<120 && i%4===0) target+=.36;
    ({value,velocity}=smoothDamp(value,target,velocity,.32,4.5,1/60));
    const step=value-last;
    assert.ok(step>=-1e-9,'Smoothed walk moved backward');
    assert.ok(step<=4.5/60+1e-6,'Smoothed walk exceeded its speed cap');
    if(i>0) maxJerk=Math.max(maxJerk,Math.abs(step-lastStep));
    last=value; lastStep=step;
  }
  assert.ok(Math.abs(value-target)<.01,'Smoothed walk did not settle on the scroll position');
  assert.ok(maxJerk<.02,`Walk speed changed abruptly between frames (${maxJerk})`);
  // A chip walk across the street arrives without overshooting.
  value=0; velocity=0;
  let peak=0;
  for(let i=0;i<60*30;i++) { ({value,velocity}=smoothDamp(value,58,velocity,.7,3.2,1/60)); peak=Math.max(peak,value); }
  assert.ok(Math.abs(value-58)<.01 && peak<=58+1e-9,'Chip walk overshot or failed to arrive');
}
console.log(`PASS: six clips, ${sampled} skinned vertex samples, repeated steps, checkpoint interception in both directions, continuation, path continuity, and smoothed walking.`);
