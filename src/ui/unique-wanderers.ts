import { Container, Sprite, Texture } from 'pixi.js';
import type { GameState } from '../core/game-state';
import type { UniqueId } from '../creatures/uniques';
import { UNIQUE_RENDERERS } from '../rendering/uniques';
import { CANVAS_PX, renderGridToCanvas } from '../rendering/pixel-grid';
import { getFoundUniques } from '../systems/uniques';
import { mulberry32 } from '../util/prng';

/**
 * Found uniques swim freely over the pool: purely decorative sprites that drift between
 * random waypoints, flip to face their heading and ignore pointer events.
 */

/** On-screen size in world px (pool creatures are 64). */
const WANDERER_SIZE = 72;
const SPEED_MIN = 10;
const SPEED_MAX = 22;
/** Keep waypoints this far from the world edges. */
const EDGE_MARGIN = 80;
/** Grid regeneration rate: the shapes animate slowly. */
const ANIM_INTERVAL = 1 / 20;

interface Wanderer {
  id: UniqueId;
  sprite: Sprite;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: Texture;
  image: ImageData | null;
  targetX: number;
  targetY: number;
  speed: number;
  /** Seconds left idling at the current waypoint */
  pause: number;
  lastRender: number;
  rng: () => number;
}

export interface WandererLayer {
  container: Container;
  items: Map<UniqueId, Wanderer>;
  worldW: number;
  worldH: number;
}

export function createWandererLayer(worldW: number, worldH: number): WandererLayer {
  const container = new Container();
  container.eventMode = 'none';
  return { container, items: new Map(), worldW, worldH };
}

function pickTarget(layer: WandererLayer, w: Wanderer): void {
  w.targetX = EDGE_MARGIN + w.rng() * (layer.worldW - EDGE_MARGIN * 2);
  w.targetY = EDGE_MARGIN + w.rng() * (layer.worldH - EDGE_MARGIN * 2);
  w.speed = SPEED_MIN + w.rng() * (SPEED_MAX - SPEED_MIN);
}

function createWanderer(layer: WandererLayer, id: UniqueId, seed: number): Wanderer {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext('2d')!;
  const image = renderGridToCanvas(UNIQUE_RENDERERS[id](0), ctx);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = WANDERER_SIZE;
  sprite.height = WANDERER_SIZE;

  const rng = mulberry32(seed);
  const w: Wanderer = {
    id, sprite, canvas, ctx, texture, image,
    targetX: 0, targetY: 0, speed: SPEED_MIN, pause: 0, lastRender: 0, rng,
  };
  pickTarget(layer, w);
  sprite.x = EDGE_MARGIN + rng() * (layer.worldW - EDGE_MARGIN * 2);
  sprite.y = EDGE_MARGIN + rng() * (layer.worldH - EDGE_MARGIN * 2);
  return w;
}

function destroyWanderer(w: Wanderer): void {
  w.sprite.destroy();
  w.texture.destroy(true);
}

/** Add sprites for newly found uniques (found uniques are never lost). */
export function syncWanderers(layer: WandererLayer, state: GameState): void {
  getFoundUniques(state).forEach((id, i) => {
    if (layer.items.has(id)) return;
    const w = createWanderer(layer, id, (state.seabedSeed + i * 7919) & 0x7fffffff);
    layer.items.set(id, w);
    layer.container.addChild(w.sprite);
  });
}

/** Move and animate wanderers. `visible` culls grid regeneration for off-screen sprites. */
export function updateWanderers(
  layer: WandererLayer, deltaSec: number, totalTime: number, visible: (x: number, y: number) => boolean,
): void {
  for (const w of layer.items.values()) {
    if (w.pause > 0) {
      w.pause -= deltaSec;
    } else {
      const dx = w.targetX - w.sprite.x;
      const dy = w.targetY - w.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        pickTarget(layer, w);
        w.pause = w.rng() < 0.4 ? 1 + w.rng() * 3 : 0;
      } else {
        const step = Math.min(dist, w.speed * deltaSec);
        w.sprite.x += (dx / dist) * step;
        w.sprite.y += (dy / dist) * step;
        // Renderers face right: mirror when heading left
        if (Math.abs(dx) > 1) w.sprite.scale.x = Math.abs(w.sprite.scale.x) * Math.sign(dx);
      }
    }

    if (totalTime - w.lastRender >= ANIM_INTERVAL && visible(w.sprite.x, w.sprite.y)) {
      w.image = renderGridToCanvas(UNIQUE_RENDERERS[w.id](totalTime), w.ctx, w.image);
      try {
        w.texture.source.update();
      } catch {
        // WebGL context lost: skip this frame
      }
      w.lastRender = totalTime;
    }
  }
}

export function destroyWandererLayer(layer: WandererLayer): void {
  for (const w of layer.items.values()) destroyWanderer(w);
  layer.items.clear();
  layer.container.destroy({ children: true });
}
