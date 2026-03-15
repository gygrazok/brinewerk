# Brinewerk — Technical Architecture

## Overview

Brinewerk is a web-based idle game with procedural creature breeding, published on itch.io as a static build. The game renders pixel art creatures procedurally via GPU shaders and overlays idle game UI in HTML/CSS.

## Stack

| Layer | Technology | Rationale |
|---|---|---|
| Language | TypeScript | Type safety on genetics/trait systems, good IDE support |
| Bundler | Vite | Fast dev server, simple static build, itch.io-friendly output |
| Renderer | PixiJS v8 | WebGL-accelerated 2D rendering, native custom shader support (Filters), lightweight |
| Shaders | GLSL (fragment) | Rare effects run as GPU post-process filters on creature sprites |
| UI | HTML/CSS overlay | Idle game chrome (resources, buttons, skill tree) lives in DOM above the Pixi canvas |
| State | Vanilla TS | No framework needed; game state is a single serializable object |
| Persistence | localStorage | Save/load game state; export/import as JSON for backup |
| Audio (future) | Tone.js or Howler.js | Ambient sounds, SFX |

## Project Structure

```
brinewerk/
├── index.html                  # Entry point, mounts canvas + UI overlay
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.ts                 # Bootstrap: init Pixi, load state, start game loop
│   ├── core/
│   │   ├── game-state.ts       # Central state object, serialization, save/load
│   │   ├── game-loop.ts        # requestAnimationFrame loop, offline time calc
│   │   └── clock.ts            # Time tracking, delta, offline elapsed
│   ├── genetics/
│   │   ├── traits.ts           # Trait definitions, value ranges, dominance
│   │   ├── genes.ts            # Genotype representation, random generation
│   │   ├── breeding.ts         # Crossover, mutation, inheritance rules
│   │   └── taxonomy.ts         # Name generator, species classification
│   ├── creatures/
│   │   ├── creature.ts         # Creature entity: genes, type, rare effect, stats
│   │   ├── types.ts            # Stellarid, Blobid, Corallid, Nucleid definitions
│   │   └── production.ts       # Resource output calculation per creature
│   ├── rendering/
│   │   ├── renderer.ts         # Pixi app setup, main render orchestration
│   │   ├── creature-renderer.ts # Dispatches to type-specific renderers
│   │   ├── types/
│   │   │   ├── stellarid.ts    # Radial star pixel art generation
│   │   │   ├── blobid.ts       # Jellyfish/anemone dome + tentacles
│   │   │   ├── corallid.ts     # Branching coral fractal
│   │   │   └── nucleid.ts      # Geometric polygon rings
│   │   ├── shaders/
│   │   │   ├── metallic.glsl   # Specular highlight bands
│   │   │   ├── glitch.glsl     # Scanline displacement, chromatic aberration
│   │   │   ├── fire.glsl       # Rising flame particles, orange tint
│   │   │   ├── frost.glsl      # Ice crystals, cool tint
│   │   │   ├── shiny.glsl      # Traveling highlight wave, sparkles
│   │   │   ├── starry.glsl     # Internal star field, cosmic tint
│   │   │   ├── toxic.glsl      # Green shift, drip particles
│   │   │   └── phantom.glsl    # Phase transparency, horizontal drift
│   │   └── shader-loader.ts    # Loads GLSL, creates Pixi Filters
│   ├── economy/
│   │   ├── resources.ts        # Plankton, Minerite, Lux definitions
│   │   ├── structures.ts       # Algae Colony, Reef, Abyss — tiered buildings
│   │   ├── production-engine.ts # Calculates total output per tick
│   │   └── tide-events.ts      # Periodic tide events, creature arrivals
│   ├── progression/
│   │   ├── skill-tree.ts       # Phylogenesis tree: Adaptation, Mutation, Abyss
│   │   ├── prestige.ts         # Fossilization reset logic
│   │   └── biomes.ts           # Biome unlocks, creature pool per biome
│   ├── systems/
│   │   ├── pool.ts             # The tide pool: creature slots, adjacency, symbiosis
│   │   ├── expeditions.ts      # Send creatures out, risk/reward, timers
│   │   ├── tides.ts            # Tide arrival: random creatures on shore, pickup cost
│   │   └── bestiary.ts         # Collection tracking, discovery log
│   └── ui/
│       ├── hud.ts              # Resource counters, top bar
│       ├── creature-panel.ts   # Selected creature details, trait bars
│       ├── pool-view.ts        # Grid view of the tide pool
│       ├── skill-tree-view.ts  # Phylogenesis tree UI
│       ├── tide-shore.ts       # Shore UI for incoming tide creatures
│       └── bestiary-view.ts    # Collection grid with silhouettes
├── public/
│   └── fonts/                  # Press Start 2P or similar pixel font
└── docs/
    ├── ARCHITECTURE.md         # This file
    └── GDD.md                  # Game Design Document
```

## Rendering Architecture

### Creature Rendering Pipeline

1. **Genotype → Pixel Grid**: Each creature type has a TypeScript renderer that reads gene values and writes colored pixels into a grid (hashmap of `{x,y} → color`). This runs on CPU and produces a sparse pixel map.

2. **Pixel Grid → Texture**: The grid is drawn onto an offscreen canvas, then uploaded as a Pixi Texture. This happens once at creature creation and when genes change (breeding), not every frame.

3. **Rare Effect Shader**: If the creature has a rare trait, a GLSL fragment shader is applied as a Pixi Filter on the sprite. The shader runs per-pixel on GPU every frame, enabling animated effects (fire flicker, glitch scanlines, phantom phase) at near-zero CPU cost.

4. **Animation**: Base animations (wobble, glow pulse) are handled by updating simple uniforms on the shader or by slight sprite transforms. No re-rendering of the pixel grid needed.

### Shader Approach

Each rare effect is a standalone `.glsl` fragment shader that receives:
- `uTime` — elapsed time for animation
- `uSampler` — the creature's base texture
- Custom uniforms per effect (intensity, color, seed)

The shader modifies pixel colors in-place. This means:
- Effects are composable (future: stack two rare effects)
- Zero CPU overhead for visual effects
- Easy to add new effects: write a `.glsl` file, register it

### Performance Budget

Target: 60fps on a 2019 mid-range phone.
- Max ~50 creatures visible simultaneously
- Each creature is one sprite + one filter (if rare)
- Pixel grid generation is cached; only runs on breed/create
- Shader complexity is trivial (no raymarching, just color math)

## State & Persistence

Game state is a single TypeScript object:

```typescript
interface GameState {
  creatures: Creature[];
  pool: PoolSlot[][];
  resources: { plankton: number; minerite: number; lux: number };
  structures: Structure[];
  skillTree: SkillNodeState[];
  bestiary: Set<string>; // discovered trait combos
  shore: Creature[]; // current tide arrivals
  expeditions: Expedition[];
  prestige: { level: number; permanentBonuses: Bonus[] };
  lastSaveTimestamp: number; // for offline calculation
}
```

Saved to `localStorage` as JSON on every significant action and every 30 seconds. On load, elapsed offline time is calculated and resources/timers are advanced accordingly.

## Build & Deploy

```bash
npm run build    # Vite produces dist/ with static files
# zip dist/ → upload to itch.io as HTML5 game
```

No server needed. Entire game runs client-side.
