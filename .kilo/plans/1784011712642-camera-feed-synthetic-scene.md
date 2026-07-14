# Camera Feed — Synthesized Live Scene

## Context
`src/components/CameraFeed.js` currently renders only a near-black flat fill (Optical: `hsl(220,20%,6%)`, Thermal: faint gradient, IR: faint grid) plus a CSS scanline. A bounding box + classification label appears **only** when a target is selected. With no selection the panel reads as a black screen.

Goal: replace the black fill with a **synthesized, channel-aware live feed** rendered from the existing simulation targets (`x, y, r, theta, altitude, rcs, v, omega, threatLevel, status`). No image/video assets are added (none exist in the repo, and this model cannot read images).

## Decision: projection model
Keep the **existing top-down tactical projection** already used by `_updateBBox` (center-anchored, `scale = min(cx,cy)/RADAR_CONFIG.maxRange`, `x = cx + target.x*scale`). This stays consistent with the radar/lock-box math and the simulation data (which is polar top-down). The "camera" becomes an optical/thermal/IR overlay of the same contacts. Do **not** introduce a separate perspective model.

## Files to change
- `src/components/CameraFeed.js` — main rewrite of `_drawFeed` + helpers; minor DOM/listener additions.
- `src/styles/components.css` — small tweaks only if needed (e.g., vignette/scanline already exist; possibly tune `.camera-scanline`/`.camera-viewport` glow). No new CSS classes required for core behavior.

## Implementation tasks

### 1. Shared projection helper
Add `_project(target)` returning `{ x, y, size, cx, cy, scale }` based on canvas logical size (`this._width/this._height`) and `_apparentSize(target)`. Use it in both `_drawFeed` (silhouettes) and `_updateBBox` (DOM lock box) so they never diverge.

`_apparentSize(target)`:
- `rangeFactor = 1 - clamp(target.r / RADAR_CONFIG.maxRange, 0, 1)` (1 = close, 0 = far)
- `base = 18 + rangeFactor * 64`
- `rcsFactor = clamp(0.6 + target.rcs, 0.6, 1.8)`
- return `base * rcsFactor`

### 2. Replace `_drawFeed` with: environment → targets → selected overlay
Each frame (called from `_tick`):
1. `clearRect`
2. `_drawEnvironment(channel, w, h, time)` (channel-specific)
3. `_drawTargets(ctx, w, h, time)` — all active targets as objects
4. `_drawGrain(ctx, w, h)` — cheap procedural noise (≈150 random low-alpha specks/frame)
5. vignette overlay (radial gradient, dark edges)
6. `_drawScanning(ctx, w, h, time)` when `this._targets.size === 0` (rotating sweep line + centered "NO CONTACTS" text)

### 3. Channel-specific environment (`_drawEnvironment`)
- **OPTICAL**: sky gradient (dusk blue → horizon amber) over top ~60%, dark ground below, horizon line with subtle glow, faint distant silhouette band, light vignette.
- **THERMAL**: dark cool→warm vertical gradient (blacks/purples), warm blobs only from targets; cool surroundings.
- **IR**: dark green-tinted background + faint grid + green noise (extends current IR look).

### 4. Target rendering (`_drawTargets` / `_drawDrone`)
For each target, project to `{x,y,size}`; skip if far outside viewport (with margin) or `r > RADAR_CONFIG.maxRange * 1.1`.
- `def = THREAT_LEVELS[target.threatLevel] || THREAT_LEVELS.FALSE_POSITIVE`.
- **OPTICAL**: drop shadow ellipse, central body (rounded rect/ellipse), 4 arms to rotor circles with blur rings, subtle `def.color` tint.
- **THERMAL**: radial heat blob `createRadialGradient` core→transparent using warm palette by threat; brighter/larger for higher RCS/threat; small hot core.
- **IR**: green stroke-only drone outline + faint fill (edge/contour look).
- If `target.id === this._hoveredTargetId` (from camera mousemove), draw a highlight ring.
- Critical targets: add a pulsing outer ring (time-based alpha) regardless of channel.

### 5. Selection integration (camera → rest of app)
- Add `mousemove` on `this._canvas`: compute nearest target within `size` radius → set `this._hoveredTargetId`, set `cursor: pointer`, draw highlight ring (step 4). `mouseleave` clears it.
- Add `click` on `this._canvas`: if a target is under the cursor, `this._emitter.emit(EVENT_TYPES.TARGET_SELECT, { targetId })`; else emit `null`. This mirrors radar/list selection and drives the DOM lock box + HUD.
- Keep existing DOM lock box + classification label in `_updateBBox` (uses `_project`), repositioned every `TARGET_UPDATE` so it tracks motion. Keep channel-tab switching.

### 6. HUD (`_updateBBox`)
Already sets CH/AZ/EL/ZOOM from selected target. Add a no-selection fallback: `AZ/EL/ZOOM = ---`, hide box. Populate from selected target only (unchanged); ensure destroy clears it (already does).

## Edge cases
- **No targets**: environment + scanning sweep + "NO CONTACTS".
- **Engine paused**: targets freeze; feed still renders last state (no special handling needed).
- **Target out of range / off-viewport**: skip silhouette; DOM box clamps (existing `Math.max(0,...)` logic).
- **Target destroyed while selected**: box hides, HUD resets (existing).
- **0-size viewport at first paint**: `_resize` guard already prevents draw; feed appears once layout resolves (ResizeObserver present).

## Risks / mitigations
- **Performance**: cap grain specks (~150) and keep silhouette primitive counts low; ≤15 targets/frame. Validate FPS via HeaderBar stat.
- **Projection drift** between canvas silhouette and DOM box: both use `_project` (single source).
- **createRadialGradient** per target per frame: acceptable at ≤15 targets; reuse where possible.

## Validation
- `npm run build` — must succeed (Vite transform).
- `npm test` — all existing suites (46 tests) stay green; no component test for CameraFeed exists, so verify manually.
- `npm run dev` manual check:
  - Camera shows non-black sky/thermal/IR environment immediately.
  - Switching Optical/Thermal/IR changes look.
  - Drone objects appear, move, scale with range/RCS, recolor by threat.
  - Selecting a target (radar/list/camera click) shows lock box + HUD AZ/EL/ZOOM and tracks motion.
  - Empty state shows "NO CONTACTS" + scanning sweep.
  - No console errors; FPS stable.
