# Brinewerk — Technical Documentation

Area-specific technical references. Each doc covers one system end-to-end:
rationale, how to extend, gotchas, perf notes. `CLAUDE.md` links here for
depth instead of inlining; keep these docs lean and practical.

## Areas

- [ACHIEVEMENTS.md](ACHIEVEMENTS.md) — data-driven achievement registry, polling trigger, feature-unlock selector pattern

<!-- As the codebase grows, add: rendering, state & migrations, collectibles, production/economy, pool & slots, tides & shore, modals. -->

## Cross-references

Existing top-level design docs remain where they are:
- `../ARCHITECTURE.md` — system-wide architecture (rendering pipeline, state model)
- `../GDD.md` — game design document (mechanics, progression, content)
- `../EFFECTS.md` — rare-effect specifications (GLSL + pixel-level)
