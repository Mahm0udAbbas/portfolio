# Experience city walk

The active Experience section uses `CityWalkStage`. The earlier ski scene remains
available in the repository but is no longer mounted by the section.

## Assets

- `city-walk.blend`: original modular street inspired by the user's six reference
  screenshots (ochre/brick/olive facades, awnings, fire escapes, tanks and lamps).
- Sign titles and subtitles live in `src/content/journey-street.json`, using the
  actual education, ITI training, Nami Tech role, dates and skills from the portfolio.
  `update_city_signs.py` replaces lettering in the saved scene without rebuilding
  the surrounding architecture, then exports the GLB and a sign review render.
- `walker.blend`: the supplied Mixamo **The Boss** character, with its packed textures.
- `public/models/city-walk.glb`: compressed static street, grouped by material.
- `public/models/walker.glb`: one character and Walk, Start, Stop, Left, Turn, Idle clips.
  Idle is a hold of the relaxed last pose of Stop, not a separately supplied animation.

`build_city_walk.py` runs in background Blender and rebuilds the world and review
render. `build_walker.py` imports the six supplied FBXs using their attachment paths
at the top of the script; update SOURCE/FILES if moving the sources to another machine.
It validates bone names, removes horizontal root motion, removes turning root yaw
(the path controller owns heading), and exports all clips as separate NLA tracks.

Run with Blender 5.3, for example:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' -b --python blender/build_city_walk.py
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' -b --python blender/build_walker.py
node tools/check-city-walk.mjs
pnpm.cmd lint
pnpm.cmd build
```

## Runtime

`walk-timeline.ts` owns the reversible scroll-to-distance mapping and reading stops.
`walk-animator.ts` cross-fades the supplied animations. `city-walk-canvas.tsx` loads
the GLBs only near the section, follows the character, and stops rendering offscreen.
The 92 m route follows two blocks and turns left around the final building. The
three current checkpoints are 29 m apart. Body position maps directly to scroll,
with no queued catch-up, and animation cadence follows distance. Wheel and touch
input bypass Lenis inertia within the section. Crossing a checkpoint (in either
direction) locks scrolling at its reading stop until Continue walking is pressed.
The lock is released on unmount, including switching to the plain timeline.
Chapter buttons seek directly and also pause at the chosen checkpoint. Amber
ground rings and overhead beacons label the stops and show remaining distance.
The animation controller bridges wheel-event gaps up to 160 ms, smooths cadence,
and blends poses over 300 ms; this changes the gait, not the world position.
The camera starts over the shoulder and eases into first person as walking begins.
At reading stops it eases out to an elevated right-side third-person shot, frames
the character left of the right-aligned card, and turns the character toward it.
Resuming travel returns to first person. Imported streetlights are normalized to
24 cd with a 10 m range at runtime, rather than Blender's >5,000 cd export values.

The server-rendered timeline is also used for narrow screens, reduced motion,
scene loading errors, and the Read timeline button. Blender renders are visual
asset checks; the final browser interaction still needs an interactive review.
