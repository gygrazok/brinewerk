# Rare Effects

Each creature has a chance of spawning with a rare effect modifier.
Some effects are restricted to specific creature types.

## Shader effects

These apply a WebGL fragment shader as a PixiJS filter on the sprite.

| Effect | Icon | Description | Notes |
|--------|------|-------------|-------|
| **Metallic** | ⚙ | Desaturated body with animated diagonal shine streaks | `metallic.glsl` |
| **Glitch** | ▦ | Chromatic aberration, scanline shifts and green noise bursts | `glitch.glsl` |
| **Fire** | 🔥 | Warm orange glow with procedural inner noise | `fire.glsl` + pixel strands rising from top |
| **Frost** | ❄ | Cool blue tint with icy shimmer waves | `frost.glsl` + pixel twinkles on edges |
| **Shiny** | ✨ | Golden sine-wave highlights with cross-shaped sparkles | `shiny.glsl` |
| **Nebula** | ★ | Dark cosmic desaturation with drifting purple cloud layers | `nebula.glsl` |
| **Toxic** | ☣ | Green tint with radial pulsing waves | `toxic.glsl` + pixel bubbles rising from top |
| **Phantom** | 👻 | Flickering semi-transparency with cyan tint and horizontal jitter | `phantom.glsl` |
| **Wave** | ∿ | Classic demoscene horizontal sine-wave distortion per row | `wave.glsl` |
| **Rainbow** | 🌈 | Prismatic hue cycling based on time and position | `rainbow.glsl` — HSV conversion |
| **Hologram** | ◇ | Scanlines, cyan tint, intermittent flicker and horizontal jitter | `hologram.glsl` |
| **Negative** | ◑ | Smooth pulsing between normal and inverted colors | `negative.glsl` |
| **Holy** | ✲ | Radiant rotating light rays behind + white pulsing aura around edges | `holy.glsl` — custom vertex shader for zoom-stable centering |

## Pixel effects

These manipulate the pixel grid directly before canvas conversion.

| Effect | Icon | Description | Notes |
|--------|------|-------------|-------|
| **Electric** | ⚡ | White/cyan spark chains crackling along the creature outline | `effects/electric.ts` — finds border pixels, spawns 2–4 short-lived arcs |
| **Shadow** | ▒ | Dark offset duplicate that oscillates around the creature | `effects/shadow.ts` — 0.3× RGB copy at 4±2 px offset |

## Transform effects

These animate the PixiJS container's scale, rotation or pivot.

| Effect | Icon | Description | Notes |
|--------|------|-------------|-------|
| **Rotating** | 🌀 | Organic spin with variable acceleration | Layered cosines (3–10 s periods). Stellarid & Nucleid only |
| **Upside Down** | 🔃 | Vertically flipped sprite | `scale.y = -1`. Blobid & Corallid only |
| **Pulse** | ♥ | Heartbeat-like scale throb (1.0 → 1.15) | Squared sine for sharp beat |
| **Tiny** | • | Half-size creature bouncing inside the cell | Lissajous pivot animation (two sine waves at different frequencies) |

## Proposed effects

### Shader

| Effect | Icon | Description | Notes |
|--------|------|-------------|-------|
| **X-Ray** | ☢ | Creature rendered as a medical scan: desaturated to grayscale, luminance inverted (dark→bone-white), blue-tinted, with a bright horizontal scan band sweeping top-to-bottom on a short loop. | `xray.glsl` — dot(rgb, lumWeights) for grayscale, 1-lum for inversion, add blue channel bias, animate scanband via `mod(uTime, period)` with gaussian falloff |
| **Caustic** | ≋ | Animated underwater light caustic patterns ripple and pool across the creature surface, as if sunlight is refracting through gently moving water above | `caustic.glsl` — Worley (cellular) noise with two overlapping time-offset layers; bright ridges at cell boundaries mimic real caustic focal lines, multiplied over the creature's existing color |
| **Dithered** | ▪ | The creature is quantized to a 4-color Game Boy-style palette using Bayer ordered dithering, reducing it to chunky monochrome dots; the active palette slowly cycles between warm amber, cool seafoam, and hot magenta tones | `dither.glsl` — 4×4 Bayer threshold matrix in a uniform; compare pixel luminance + Bayer offset against 4 thresholds; remap to palette colors passed as uniforms; cycle palette index every ~3 s |
| **Thermal** | 🌡 | Strips all color and remaps per-pixel luminance to an infrared heat-map gradient (deep blue → cyan → green → yellow → orange → red → white) with a slow ±5% shimmer that mimics thermal sensor drift — makes the creature look like live IR footage. | `thermal.glsl` — `lum = dot(rgb, vec3(0.299,0.587,0.114))` + `sin(uTime*0.7+uv.y*8.0)*0.05`; gradient via chained `mix()` over 5 stops |

### Pixel

| Effect | Icon | Description | Notes |
|--------|------|-------------|-------|
| **Liquify** | 💧 | Each pixel column slowly melts downward by a different amount, as if the creature is made of warm wax — then snaps back, perpetually oozing and reconstituting like a Dalí clock. | `effects/liquify.ts` — maintain a per-column float offset driven by low-frequency sine with per-column phase; shift each column's pixels down by `floor(offset)` pixels, wrapping overflow to fill the top; animate offsets each frame |
| **Stained Glass** | ⬡ | The creature's surface shatters into Voronoi-cell facets, each filled with a flat bold tint and separated by dark lead lines, like a cathedral window; a slow radial pulse of warm light sweeps across the cells. | `stained.glsl` — compute F1/F2 Worley distances for cell boundaries; hash each cell's seed to a discrete palette color; draw dark border where F2-F1 < threshold; modulate brightness with `sin(uTime*0.8 + cellHash)` for the light-sweep |
