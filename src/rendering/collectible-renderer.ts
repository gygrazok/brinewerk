import { Container, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { SeededRng } from '../util/prng';
import type { Collectible, CollectibleManager, CollectionEvent } from '../systems/collectibles';
import type { ResourceBundle } from '../core/game-state';
import {
  COLLECTIBLE_SPRITE_SIZE,
  COLLECTIBLE_DISPLAY_SIZE,
  COLLECTIBLE_FADE_IN_DIST,
} from '../core/balance';

// ---------------------------------------------------------------------------
// Plankton palette (green / yellow-green oceanic tones)
// ---------------------------------------------------------------------------

const PLANKTON_COLORS = [
  '#2a6b2a', // dark green
  '#4aad4a', // mid green
  '#6bcb6b', // bright green
  '#8aee8a', // light green
  '#b8b44a', // yellow-green
];

// ---------------------------------------------------------------------------
// Sprite generation (per-type, extensible)
// ---------------------------------------------------------------------------

type SpriteGenerator = (rng: SeededRng) => HTMLCanvasElement;

const SPRITE_GENERATORS: Record<string, SpriteGenerator> = {
  plankton: generatePlanktonSprite,
};

function generatePlanktonSprite(rng: SeededRng): HTMLCanvasElement {
  const size = COLLECTIBLE_SPRITE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Scatter 4-7 dots in a loose cluster around the center
  const dotCount = rng.int(4, 7);
  const cx = size / 2;
  const cy = size / 2;
  const spread = size * 0.3;

  for (let i = 0; i < dotCount; i++) {
    const x = Math.round(cx + rng.float(-spread, spread));
    const y = Math.round(cy + rng.float(-spread, spread));
    const color = PLANKTON_COLORS[rng.int(0, PLANKTON_COLORS.length - 1)];
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.max(0, Math.min(size - 1, x)),
      Math.max(0, Math.min(size - 1, y)),
      1,
      1,
    );
  }

  // 1-2 brighter "core" pixels near center
  const cores = rng.int(1, 2);
  for (let i = 0; i < cores; i++) {
    const x = Math.round(cx + rng.float(-1, 1));
    const y = Math.round(cy + rng.float(-1, 1));
    ctx.fillStyle = '#dfffdf';
    ctx.fillRect(
      Math.max(0, Math.min(size - 1, x)),
      Math.max(0, Math.min(size - 1, y)),
      1,
      1,
    );
  }

  return canvas;
}

// ---------------------------------------------------------------------------
// Collectible layer (manages Pixi sprites)
// ---------------------------------------------------------------------------

export interface CollectibleLayer {
  container: Container;
  sprites: Map<number, Sprite>;
  textures: Map<number, Texture>;
}

export function createCollectibleLayer(): CollectibleLayer {
  return {
    container: new Container(),
    sprites: new Map(),
    textures: new Map(),
  };
}

/**
 * Sync the visual layer with the collectible manager state.
 * Creates sprites for new collectibles, updates positions, removes collected ones.
 */
export function syncCollectibleVisuals(layer: CollectibleLayer, mgr: CollectibleManager, worldW: number): void {
  const activeIds = new Set<number>();

  for (const c of mgr.items) {
    activeIds.add(c.id);
    let sprite = layer.sprites.get(c.id);

    if (!sprite) {
      // Create new sprite
      sprite = createSpriteForCollectible(c, layer);
      layer.container.addChild(sprite);
    }

    // Position (anchor is centered)
    sprite.x = c.x;
    sprite.y = c.y;

    // State-based visual feedback
    if (c.state === 'magnetized') {
      sprite.scale.set(1.2);
      sprite.alpha = 1;
    } else {
      sprite.scale.set(1);
      // Fade in from right edge
      const distFromEdge = worldW - c.x + 20; // 20 = spawn offset
      sprite.alpha = Math.min(1, distFromEdge / COLLECTIBLE_FADE_IN_DIST);
    }
  }

  // Remove sprites for collected / despawned items
  for (const [id, sprite] of layer.sprites) {
    if (!activeIds.has(id)) {
      sprite.destroy();
      layer.sprites.delete(id);
      const tex = layer.textures.get(id);
      if (tex) {
        tex.destroy(true);
        layer.textures.delete(id);
      }
    }
  }
}

function createSpriteForCollectible(c: Collectible, layer: CollectibleLayer): Sprite {
  const generator = SPRITE_GENERATORS[c.typeKey] ?? SPRITE_GENERATORS.plankton;
  const rng = new SeededRng(c.seed);
  const canvas = generator(rng);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';

  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = COLLECTIBLE_DISPLAY_SIZE;
  sprite.height = COLLECTIBLE_DISPLAY_SIZE;

  layer.sprites.set(c.id, sprite);
  layer.textures.set(c.id, texture);
  return sprite;
}

// ---------------------------------------------------------------------------
// Floating pickup popups (+5 🟢)
// ---------------------------------------------------------------------------

const RESOURCE_ICONS: Record<keyof ResourceBundle, string> = {
  plankton: '🟢',
  minerite: '🔵',
  lux: '✨',
  nacre: '⚬',
};

const POPUP_STYLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 8,
  fill: '#ffffff',
  stroke: { color: '#000000', width: 2 },
  align: 'center',
});

const POPUP_DURATION = 0.8; // seconds
const POPUP_RISE_SPEED = 60; // world px/sec

interface Popup {
  text: Text;
  age: number;
  startY: number;
}

export interface PopupLayer {
  container: Container;
  popups: Popup[];
}

export function createPopupLayer(): PopupLayer {
  return { container: new Container(), popups: [] };
}

/** Spawn floating popups for collection events. */
export function spawnPickupPopups(layer: PopupLayer, events: CollectionEvent[]): void {
  for (const ev of events) {
    const label = `+${ev.amount} ${RESOURCE_ICONS[ev.resource]}`;
    const text = new Text({ text: label, style: POPUP_STYLE });
    text.anchor.set(0.5);
    text.x = ev.x;
    text.y = ev.y;
    text.resolution = 4; // crisp at zoom
    layer.container.addChild(text);
    layer.popups.push({ text, age: 0, startY: ev.y });
  }
}

/** Animate popups (float up + fade out). Call every frame. */
export function updatePopups(layer: PopupLayer, dt: number): void {
  for (let i = layer.popups.length - 1; i >= 0; i--) {
    const p = layer.popups[i];
    p.age += dt;
    const t = p.age / POPUP_DURATION; // 0→1

    if (t >= 1) {
      p.text.destroy();
      layer.popups.splice(i, 1);
      continue;
    }

    // Rise upward
    p.text.y = p.startY - p.age * POPUP_RISE_SPEED;
    // Fade out in the second half
    p.text.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
  }
}

/** Destroy the entire layer and free all GPU resources. */
export function destroyCollectibleLayer(layer: CollectibleLayer): void {
  for (const sprite of layer.sprites.values()) sprite.destroy();
  for (const tex of layer.textures.values()) tex.destroy(true);
  layer.sprites.clear();
  layer.textures.clear();
  layer.container.destroy({ children: true });
}

/** Destroy popup layer. */
export function destroyPopupLayer(layer: PopupLayer): void {
  for (const p of layer.popups) p.text.destroy();
  layer.popups.length = 0;
  layer.container.destroy({ children: true });
}
