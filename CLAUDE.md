# CLAUDE.md — Brinewerk

## What is this?

Brinewerk is a web-based retro idle game about cultivating procedurally-generated marine creatures in a tide pool. It renders pixel art creatures via GPU shaders and overlays idle game UI in HTML/CSS. Published on itch.io as a static HTML5 build.

## Tech Stack

- **Language**: TypeScript (strict mode, ES2020 target)
- **Bundler**: Vite with `vite-plugin-glsl` for GLSL shader imports
- **Renderer**: PixiJS v8 (WebGL 2D rendering, custom shader filters)
- **Shaders**: GLSL fragment shaders for rare creature visual effects
- **UI**: Plain HTML/CSS overlays on top of the Pixi canvas (no UI framework)
- **State**: Vanilla TypeScript — single serializable `GameState` object
- **Persistence**: localStorage with JSON import/export

## Commands

```bash
npm run dev       # Start Vite dev server with HMR (port 5173)
npm run build     # Type-check (tsc) then produce optimized dist/ bundle
npm run preview   # Preview the production build locally
```

There is no test framework. The build command (`tsc && vite build`) is the primary validation — it catches type errors and import issues.

## Project Structure

```
src/
├── main.ts                    # Bootstrap: init Pixi app, wire UI, start game loop
├── core/                      # Game state, timing, balance constants
│   ├── game-state.ts          # GameState interface, save/load, migrations
│   ├── game-loop.ts           # requestAnimationFrame loop, offline time calc
│   ├── clock.ts               # Delta time tracking
│   └── balance.ts             # Game balance constants (costs, rates, multipliers)
├── creatures/                 # Creature entity definitions
│   ├── creature.ts            # Creature interface, Genotype, RareEffect types
│   ├── types.ts               # CreatureType enum (Stellarid, Blobid, Corallid, Nucleid)
│   └── production.ts          # Per-creature resource output calculation
├── genetics/                  # Breeding & trait system
│   ├── traits.ts              # Trait definitions (universal + type-specific)
│   ├── genes.ts               # Genotype generation
│   └── taxonomy.ts            # Name generator, species classification
├── rendering/                 # Pixel art + shader rendering
│   ├── renderer.ts            # Pixi app setup, render orchestration
│   ├── creature-renderer.ts   # Dispatches to type-specific renderers
│   ├── shader-loader.ts       # GLSL loading, Pixi Filter creation, shader cache
│   ├── pixel-grid.ts          # Low-level pixel grid utilities
│   ├── palette.ts             # Color palettes
│   ├── render-settings.ts     # Render quality settings
│   ├── seabed-bg.ts           # Procedural background terrain
│   ├── types/                 # Per-creature-type pixel art generators
│   │   ├── stellarid.ts       # Radial star shapes
│   │   ├── blobid.ts          # Jellyfish/anemone domes + tentacles
│   │   ├── corallid.ts        # Branching coral fractals
│   │   └── nucleid.ts         # Geometric polygon rings
│   ├── effects/               # Pixel-level animation effects (fire, frost, etc.)
│   └── shaders/               # ~21 GLSL fragment shaders for rare effects
├── systems/                   # Gameplay mechanics
│   ├── coords.ts              # Seabed slot coordinate system
│   ├── pool.ts                # Creature placement, adjacency, symbiosis
│   ├── seabed-layout.ts       # Fixed seabed slot definitions
│   └── tides.ts               # Tide arrival timers, shore management
├── economy/                   # Resource production
│   ├── resources.ts           # Resource type definitions
│   └── production-engine.ts   # Per-tick resource calculation
├── ui/                        # HTML/CSS overlay UI
│   ├── hud.ts                 # Top bar resource counters
│   ├── creature-panel.ts      # Creature detail panel with trait visualization
│   ├── pool-view.ts           # Main grid viewport (drag, zoom, pan, slot click)
│   ├── tide-shore.ts          # Shore UI for incoming creatures
│   ├── debug-menu.ts          # Dev-only debug tools
│   └── theme.ts               # CSS injection & styling
└── util/
    └── prng.ts                # Mulberry32 seeded PRNG + helpers
```

Key non-source files:
- `ARCHITECTURE.md` — detailed technical architecture documentation
- `GDD.md` — game design document (mechanics, progression, content)
- `EFFECTS.md` — rare effects specifications
- `index.html` — entry point that mounts canvas + UI overlay
- `vite.config.ts` — Vite config with GLSL plugin, `base: './'` for itch.io

## Code Conventions

- **Strict TypeScript**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **Naming**: PascalCase for types/interfaces/enums, camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- **File structure**: Types/interfaces at the top of each file, then functions
- **One concern per file**: clear separation between types, logic, rendering, and UI
- **No classes for game logic**: prefer plain interfaces + pure functions
- **Seeded RNG**: use `src/util/prng.ts` (Mulberry32) for any procedural generation — never use `Math.random()` for game-affecting randomness
- **HMR cleanup**: always register `import.meta.hot.dispose(() => cleanup())` when creating persistent resources (event listeners, caches, Pixi objects)
- **Shader cache management**: call `destroyRareFilterCache()` on teardown to avoid WebGL resource leaks

## Architecture Notes

### Rendering Pipeline
1. Genotype → pixel grid (CPU, cached at creature creation)
2. Pixel grid → Pixi Texture (offscreen canvas upload, one-time)
3. Rare effect GLSL shader → Pixi Filter on sprite (GPU, per-frame)
4. Animations via shader uniforms — no pixel grid re-render needed

### State Management
- Single `GameState` object in `src/core/game-state.ts`
- Saved to localStorage every 30s and on significant actions
- Save versioning with migration chain (currently v4) — always increment `CURRENT_SAVE_VERSION` and add a migration step when changing the state shape
- Offline progress calculated from `lastSaveTimestamp` on load

### Adding a New Rare Effect
1. Write a `.glsl` fragment shader in `src/rendering/shaders/`
2. Register it in the shader loader (`src/rendering/shader-loader.ts`)
3. Add the effect name to the `RareEffect` type in `src/creatures/creature.ts`
4. Optionally add pixel-level effects in `src/rendering/effects/`

## Important Constraints

- **No server**: entire game is client-side static files
- **No test framework**: rely on `tsc` for type checking and `vite build` for validation
- **Performance target**: 60fps with ~50 visible creatures on a 2019 mid-range phone
- **itch.io deployment**: `dist/` is zipped and uploaded directly; `base: './'` in Vite config is required for relative asset paths
- **No UI framework**: all DOM UI is vanilla TypeScript + CSS
