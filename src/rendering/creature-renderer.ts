import { Sprite, Texture, Filter } from 'pixi.js';
import type { Creature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import { renderStellarid } from './types/stellarid';
import { renderBlobid } from './types/blobid';
import { renderCorallid } from './types/corallid';
import { renderNucleid } from './types/nucleid';
import { type PixelGrid, CANVAS_PX, BLOCK_PX, GRID_SIZE, renderGridToCanvas } from './pixel-grid';
import { getRareFilter, createGlowFilter } from './shader-loader';
import { getPalette } from './palette';

type TypeRenderer = (genes: Creature['genes'], time: number, seed: number) => PixelGrid;

const TYPE_RENDERERS: Record<CreatureType, TypeRenderer> = {
  [CreatureType.Stellarid]: renderStellarid,
  [CreatureType.Blobid]: renderBlobid,
  [CreatureType.Corallid]: renderCorallid,
  [CreatureType.Nucleid]: renderNucleid,
};

export interface CreatureVisual {
  sprite: Sprite;
  creature: Creature;
  /** Offscreen canvas for real-time pixel grid rendering */
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The single texture backed by the canvas — updated every frame */
  texture: Texture;
  glowFilter: Filter | null;
  timeOffset: number;
}

/** Hex color to [r, g, b, a] normalized */
function hexToVec4(hex: string, alpha: number = 1): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, alpha];
}

/** Build the filter chain for a creature sprite */
function buildFilterChain(creature: Creature): {
  filters: Filter[];
  glowFilter: Filter | null;
} {
  const filters: Filter[] = [];
  const texelSize: [number, number] = [1 / CANVAS_PX, 1 / CANVAS_PX];

  // Glow (if gene glow > 0.5)
  let glowFilter: Filter | null = null;
  if (creature.genes.glow > 0.5) {
    const pal = getPalette(creature.genes.palette1);
    const glowColor = hexToVec4(pal.accent, 0.7);
    glowFilter = createGlowFilter(glowColor, creature.genes.glow, texelSize);
    filters.push(glowFilter);
  }

  // Rare effect (if present)
  if (creature.rare) {
    filters.push(getRareFilter(creature.rare));
  }

  return { filters, glowFilter };
}

/** Create a renderable creature visual with real-time rendering */
export function createCreatureVisual(creature: Creature): CreatureVisual {
  // Create offscreen canvas for pixel grid rendering
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const ctx = canvas.getContext('2d')!;

  // Render initial frame
  const renderer = TYPE_RENDERERS[creature.type];
  const grid = renderer(creature.genes, 0, creature.seed);
  renderGridToCanvas(grid, ctx);

  // Create texture from canvas — PixiJS will use this canvas as source
  const texture = Texture.from(canvas);
  const sprite = new Sprite(texture);
  sprite.width = GRID_SIZE * BLOCK_PX;
  sprite.height = GRID_SIZE * BLOCK_PX;

  const { filters, glowFilter } = buildFilterChain(creature);
  sprite.filters = filters;

  return {
    sprite,
    creature,
    canvas,
    ctx,
    texture,
    glowFilter,
    timeOffset: Math.random() * 100,
  };
}

/** Update creature animation — re-render pixel grid every frame (like POC) */
export function updateCreatureVisual(visual: CreatureVisual, _deltaSec: number, totalTime: number): void {
  const time = totalTime + visual.timeOffset;

  // Re-render pixel grid with current time
  const renderer = TYPE_RENDERERS[visual.creature.type];
  const grid = renderer(visual.creature.genes, time, visual.creature.seed);
  renderGridToCanvas(grid, visual.ctx);

  // Tell PixiJS the texture source has changed
  visual.texture.source.update();

  // Update glow filter time
  if (visual.glowFilter) {
    visual.glowFilter.resources.glowUniforms.uniforms.uTime = time;
  }
}

/** Destroy a creature visual and free resources */
export function destroyCreatureVisual(visual: CreatureVisual): void {
  visual.sprite.destroy();
  visual.texture.destroy(true);
}
