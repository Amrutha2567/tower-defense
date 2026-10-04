# Performance Numbers

All numbers below must be measured live on the same machine/browser used for the demo. Do not estimate them.

## Required stress target

| Version | Enemies | Towers | Projectiles | Avg FPS | % frames >33ms | 95% FPS threshold | Interactive? |
|---|---:|---:|---:|---:|---:|---:|---|
| Baseline | 5,000 | 100 | 1,000 | **MEASURE** | **MEASURE** | **MEASURE** | **MEASURE** |
| + spatial hash | 5,000 | 100 | 1,000 | **MEASURE** | **MEASURE** | **MEASURE** | **MEASURE** |
| + object pools | 5,000 | 100 | 1,000 | **MEASURE** | **MEASURE** | **MEASURE** | **MEASURE** |
| Final | 5,000 | 100 | 1,000 | **MEASURE** | **MEASURE** | **MEASURE** | **MEASURE** |

## Optimization deltas

| Optimization | Before avg FPS | After avg FPS | Delta | Before >33ms | After >33ms |
|---|---:|---:|---:|---:|---:|
| Spatial hash | — | — | — | — | — |
| Object pooling | — | — | — | — | — |
| Render culling | — | — | — | — | — |
| Fixed-step / bounded loop | — | — | — | — | — |

## Measurement notes

- Browser: **FILL IN**
- Version: **FILL IN**
- OS: **FILL IN**
- CPU/GPU: **FILL IN**
- Display refresh rate: **FILL IN**
- Resolution / browser zoom: **FILL IN**
- Test duration: **10+ seconds after warm-up**
- DevTools method: **FILL IN**

### How to calculate the 95% frame requirement

A 45 FPS requirement means the frame budget is approximately 22.22 ms. The separate requirement says fewer than 5% of frames may exceed 33 ms. Report both the FPS statistic and the percentage of frames above 33 ms; do not substitute one for the other.
