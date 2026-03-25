import { Sprite, Texture, Container, BlurFilter, ColorMatrixFilter, Filter } from 'pixi.js';
import type { Creature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import { renderStellarid } from './types/stellarid';
import { renderBlobid } from './types/blobid';
import { renderCorallid } from './types/corallid';
import { renderNucleid } from './types/nucleid';
import { type PixelGrid, CANVAS_PX, BLOCK_PX, GRID_SIZE, renderGridToCanvas } from './pixel-grid';
import { getRareFilter, createRareFilter } from './shader-loader';
import { getPixelEffect, cleanupEffectState } from './effects';
import { getPalette } from './palette';

type TypeRenderer = (genes: Creature['genes'], time: number, seed: number) => PixelGrid;

const TYPE_RENDERERS: Record<CreatureType, TypeRenderer> = {
  [CreatureType.Stellarid]: renderStellarid,
  [CreatureType.Blobid]: renderBlobid,
  [CreatureType.Corallid]: renderCorallid,
  [CreatureType.Nucleid]: renderNucleid,
};

/** A lightweight animated creature preview (plain canvas, no PixiJS). */
export interface CanvasPreview {
  canvas: HTMLCanvasElement;
  /** Call each frame with elapsed seconds to animate. */
  update: (time: number) => void;
}

/**
 * Create an animated creature preview on a plain HTML canvas (no PixiJS, no shaders).
 * Call `update(time)` every frame to animate the creature.
 */
export function createCreaturePreview(creature: Creature): CanvasPreview {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext('2d')!;
  const renderer = TYPE_RENDERERS[creature.type];

  // Render initial frame
  const grid = renderer(creature.genes, 0, creature.seed);
  renderGridToCanvas(grid, ctx);

  return {
    canvas,
    update(time: number) {
      ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
      const g = renderer(creature.genes, time, creature.seed);
      renderGridToCanvas(g, ctx);
    },
  };
}

export interface CreatureVisual {
  /** The root container (holds glowSprite behind + main sprite on top) */
  sprite: Container;
  creature: Creature;
  /** The main creature sprite */
  mainSprite: Sprite;
  /** Optional blurred glow sprite behind main */
  glowSprite: Sprite | null;
  /** Offscreen canvas for real-time pixel grid rendering */
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The single texture backed by the canvas — updated every frame */
  texture: Texture;
  timeOffset: number;
  /** Private filter owned by this visual (if any) — destroyed with the visual */
  _ownedFilter: Filter | null;
  /** Key used for per-creature effect state (frost twinkles, toxic bubbles).
   *  Defaults to creature.id; preview visuals use a unique suffix to avoid
   *  sharing mutable state with the game visual. */
  effectKey: string;
}

/** Parse hex color to 0xRRGGBB number */
function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/**
 * Create a renderable creature visual with real-time rendering.
 * @param ownFilters If true, creates private filter instances owned by this visual
 *                   (for ephemeral views like panels). Defaults to false (shared cache).
 */
export function createCreatureVisual(creature: Creature, ownFilters = false): CreatureVisual {
  // Create offscreen canvas for pixel grid rendering
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext('2d')!;

  // Render initial frame
  const renderer = TYPE_RENDERERS[creature.type];
  const grid = renderer(creature.genes, 0, creature.seed);
  renderGridToCanvas(grid, ctx);

  // Create texture from canvas (nearest-neighbor for pixel art)
  const texture = Texture.from(canvas);
  texture.source.scaleMode = 'nearest';
  const displaySize = GRID_SIZE * BLOCK_PX; // 120

  // Main sprite
  const mainSprite = new Sprite(texture);
  mainSprite.width = displaySize;
  mainSprite.height = displaySize;

  // Rare effect filter on main sprite
  let ownedFilter: Filter | null = null;
  const mainFilters: Filter[] = [];
  if (creature.rare) {
    const rf = ownFilters ? createRareFilter(creature.rare) : getRareFilter(creature.rare);
    if (rf) {
      mainFilters.push(rf);
      if (ownFilters) ownedFilter = rf;
    }
  }
  if (mainFilters.length > 0) {
    mainSprite.filters = mainFilters;
  }

  // Container to hold glow + main
  const container = new Container();

  // Glow: a second sprite with BlurFilter + color tint, rendered behind
  let glowSprite: Sprite | null = null;
  if (creature.genes.glow > 0.5) {
    const pal = getPalette(creature.genes.palette1);

    glowSprite = new Sprite(texture); // shares same texture
    glowSprite.width = displaySize;
    glowSprite.height = displaySize;

    // Tint to glow color
    glowSprite.tint = hexToNum(pal.accent);
    // Intensity based on glow gene (0.5-1.0 → 0.2-0.5 alpha)
    glowSprite.alpha = 0.2 + (creature.genes.glow - 0.5) * 0.6;

    // Real multi-pass gaussian blur
    const blurFilter = new BlurFilter({
      strength: 6,
      quality: 4,
    });

    // Brighten so the tinted blur is visible
    const brighten = new ColorMatrixFilter();
    brighten.brightness(1.8, false);

    glowSprite.filters = [brighten, blurFilter];

    container.addChild(glowSprite); // behind
  }

  container.addChild(mainSprite); // on top

  return {
    sprite: container,
    creature,
    mainSprite,
    glowSprite,
    canvas,
    ctx,
    texture,
    timeOffset: Math.random() * 100,
    _ownedFilter: ownedFilter,
    effectKey: ownFilters ? `${creature.id}_preview` : creature.id,
  };
}

/** Update creature animation — re-render pixel grid every frame (like POC) */
export function updateCreatureVisual(visual: CreatureVisual, _deltaSec: number, totalTime: number): void {
  const time = totalTime + visual.timeOffset;

  // Re-render pixel grid with current time
  const renderer = TYPE_RENDERERS[visual.creature.type];
  const grid = renderer(visual.creature.genes, time, visual.creature.seed);

  // Apply pixel-level rare effect (if any)
  if (visual.creature.rare) {
    const fx = getPixelEffect(visual.creature.rare);
    if (fx) fx(grid, time, visual.effectKey);
  }

  renderGridToCanvas(grid, visual.ctx);

  // Tell PixiJS the texture source has changed (no-op if context lost)
  try {
    visual.texture.source.update();
  } catch {
    // WebGL context lost — skip this frame
    return;
  }

  // Update uTime on privately-owned filter (preview panels)
  if (visual._ownedFilter) {
    visual._ownedFilter.resources.rareUniforms.uniforms.uTime = time;
  }

  // Subtle glow pulse
  if (visual.glowSprite) {
    const baseAlpha = 0.2 + (visual.creature.genes.glow - 0.5) * 0.6;
    const pulse = Math.sin(time * 2.0) * 0.06 + 1.0;
    visual.glowSprite.alpha = baseAlpha * pulse;
  }

  // Rotating rare effect — layered cosine waves for organic accelerate/decelerate/reverse
  if (visual.creature.rare === 'rotating') {
    const s = visual.creature.seed;
    const p1 = 3 + (s % 1000) / 1000 * 7;
    const p2 = 3 + ((s * 7) % 1000) / 1000 * 7;
    const angle =
      Math.cos(time * (2 * Math.PI) / p1) * 1.8 +
      Math.cos(time * (2 * Math.PI) / p2) * 1.2;
    visual.sprite.rotation = angle;
  }

  // Pulse rare effect — heartbeat-like scale throb
  if (visual.creature.rare === 'pulse') {
    // Quick expand (systole) + slow relax (diastole) — asymmetric like a real heartbeat
    const beat = Math.abs(Math.sin(time * 2.5));
    const sharp = beat * beat; // sharpen the curve
    const scale = 1 + sharp * 0.15; // 1.0 → 1.15
    visual.sprite.scale.set(scale, scale);
  }

  // Tiny rare effect — half size, Lissajous bounce inside the cell
  if (visual.creature.rare === 'tiny') {
    const s = visual.creature.seed;
    visual.sprite.scale.set(0.5, 0.5);
    // Derive base pivot and bounce range from actual sprite size (works for both pool and preview)
    const baseP = visual.mainSprite.width / 2;
    const range = baseP * 0.375; // ~12px at 64, ~37px at 200
    const dx = Math.sin(time * 1.4 + s) * range;
    const dy = Math.sin(time * 1.9 + s * 0.7) * range;
    visual.sprite.pivot.x = baseP - dx;
    visual.sprite.pivot.y = baseP - dy;
  }
}

/** Destroy a creature visual and free resources */
export function destroyCreatureVisual(visual: CreatureVisual): void {
  // Destroy privately-owned filter (preview panels)
  if (visual._ownedFilter) {
    visual._ownedFilter.destroy();
    visual._ownedFilter = null;
  }
  // Clean up per-visual effect state (frost twinkles, toxic bubbles)
  cleanupEffectState(visual.effectKey);
  visual.sprite.destroy({ children: true });
  visual.texture.destroy(true);
}
