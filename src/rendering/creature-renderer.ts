import { Sprite, Texture, Container, BlurFilter, ColorMatrixFilter, Filter } from 'pixi.js';
import type { Creature } from '../creatures/creature';
import { CreatureType } from '../creatures/types';
import { renderStellarid } from './types/stellarid';
import { renderBlobid } from './types/blobid';
import { renderCorallid } from './types/corallid';
import { renderNucleid } from './types/nucleid';
import { type PixelGrid, CANVAS_PX, BLOCK_PX, GRID_SIZE, renderGridToCanvas } from './pixel-grid';
import { getRareFilter } from './shader-loader';
import { getPalette } from './palette';

type TypeRenderer = (genes: Creature['genes'], time: number, seed: number) => PixelGrid;

const TYPE_RENDERERS: Record<CreatureType, TypeRenderer> = {
  [CreatureType.Stellarid]: renderStellarid,
  [CreatureType.Blobid]: renderBlobid,
  [CreatureType.Corallid]: renderCorallid,
  [CreatureType.Nucleid]: renderNucleid,
};

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
}

/** Parse hex color to 0xRRGGBB number */
function hexToNum(hex: string): number {
  return parseInt(hex.slice(1), 16);
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

  // Create texture from canvas
  const texture = Texture.from(canvas);
  const displaySize = GRID_SIZE * BLOCK_PX; // 120

  // Main sprite
  const mainSprite = new Sprite(texture);
  mainSprite.width = displaySize;
  mainSprite.height = displaySize;

  // Rare effect filter on main sprite
  const mainFilters: Filter[] = [];
  if (creature.rare) {
    mainFilters.push(getRareFilter(creature.rare));
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

  // Subtle glow pulse
  if (visual.glowSprite) {
    const baseAlpha = 0.2 + (visual.creature.genes.glow - 0.5) * 0.6;
    const pulse = Math.sin(time * 2.0) * 0.06 + 1.0;
    visual.glowSprite.alpha = baseAlpha * pulse;
  }
}

/** Destroy a creature visual and free resources */
export function destroyCreatureVisual(visual: CreatureVisual): void {
  visual.sprite.destroy({ children: true });
  visual.texture.destroy(true);
}
