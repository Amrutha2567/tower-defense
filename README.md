# Fortress 50 — Tower Defense

A polished browser tower-defense game built with vanilla JavaScript and Canvas 2D. It is designed to run entirely client-side with no backend or external game services.

## Play

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

The generated `dist/` directory can be deployed to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or any static host.

## Architecture

- **Rendering:** one `<canvas>` using Canvas 2D. The game does not create DOM nodes for enemies, bullets, or towers.
- **Simulation:** one `requestAnimationFrame` loop drives a fixed 60 Hz simulation step. A bounded accumulator prevents simulation speed from depending on monitor refresh rate.
- **State:** a small central state object holds game flow, economy, wave progression, selection, pause/speed state, and benchmark state. Entity collections are flat arrays.
- **Entities:** towers, enemies, and projectiles are plain objects. Dead entities are compacted into dense arrays rather than being removed one-by-one.
- **Object pooling:** enemy and projectile objects are recycled through pools to reduce allocation and garbage collection during large waves.
- **Target lookup:** enemies are indexed in an 80px spatial hash. Towers query only nearby cells instead of scanning every enemy.
- **Rendering culling:** only entities inside the canvas bounds are drawn. Off-screen simulation still progresses consistently.
- **Pathing:** enemies use a deterministic polyline path and a scalar `progress` distance along it, avoiding per-enemy pathfinding.

## Game design

- 50 waves, with enemy count and health scaling by wave.
- 3 distinct towers:
  - **Cannon:** slower, high damage, splash damage.
  - **Frost:** rapid shots with a strong slow effect.
  - **Tesla:** chains damage into nearby enemies.
- 4 enemy types:
  - **Scout:** basic.
  - **Runner:** fast and fragile.
  - **Brute:** slow and durable.
  - **Tank:** very durable, slow, and deals heavy base damage.
- Towers can be placed, selected, upgraded to level 5, and sold.
- Gold, score, base HP, victory, game-over, pause, restart, and 0.5×/1×/1.5×/2× speeds are included.

## Performance bottlenecks and optimizations

The intentionally expensive baseline is tower-to-enemy target acquisition. A naive implementation would scan all enemies for every tower every frame, creating O(T×E) work. Projectile collision and allocation can also become expensive at high counts.

The final implementation addresses this with:

1. **Spatial hashing** — tower target queries inspect only nearby grid cells.
2. **Object pools** — enemies/projectiles are recycled rather than constantly allocated.
3. **Dense-array compaction** — dead entities are removed in a linear pass.
4. **Fixed-step simulation** — simulation behavior is consistent across 60/120/144 Hz displays.
5. **Bounded catch-up** — the loop caps simulation steps per frame to avoid a runaway spiral after a long frame.
6. **Canvas-only entities** — no per-enemy DOM nodes or timers.
7. **Render culling** — entities outside the visible canvas are skipped during rendering.
8. **Scalar path progress** — no per-enemy pathfinding or repeated waypoint traversal.

## Stress test

The right sidebar contains **Stress Lab**. It can create deterministic loads of up to 10,000 enemies, 200 towers, and 3,000 projectiles. The required target scenario is pre-filled as 5,000 / 100 / 1,000.

For the required demo, first show the baseline implementation or deliberately disable the spatial-hash optimization in a local branch, then use the same stress inputs. Record the browser's live FPS/Performance panel and visually show where it becomes unstable. Re-enable the optimized implementation and run the exact same load.

The project itself exposes the stress load and live FPS in the game UI. Use Chrome DevTools Performance/Rendering tools to capture the official before/after measurements.

## Measurement protocol

For every optimization, keep the browser window, zoom, resolution, machine, and workload constant:

1. Open the production build.
2. Open DevTools → Performance.
3. Enable FPS meter / frame rendering stats if available.
4. Run the stress scenario for at least 10 seconds after warm-up.
5. Record average FPS, worst FPS, frames over 33 ms, and approximate JS/rendering time.
6. Repeat three times and report the median.
7. Put the measured values in `NUMBERS.md`.

Do **not** claim the required 45 FPS / 95% frame target until it has been measured on the target hardware/browser. The stress harness is included specifically so the submitted numbers are reproducible rather than invented.

## Deployment

Run `npm run build` and deploy the resulting `dist/` folder as a static site. No environment variables or server-side services are required.

## Demo video checklist

Target 3–4 minutes, with face + screen visible, spoken in English.

- 0:00–0:30 — immediately show the first before/after optimization in action.
- Show the baseline breaking point with visible enemy/tower/projectile counts and FPS.
- Explain the main bottleneck and optimization idea.
- Repeat the exact workload after each major optimization.
- Show the final stress result and the delta.
- Briefly play normal waves to show placement, upgrades, enemy variety, pause/speed, and game-over/victory flow.
- Show `NUMBERS.md` and the deployed URL before finishing.
