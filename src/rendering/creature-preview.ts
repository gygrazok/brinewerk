import { Application } from 'pixi.js';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import {
  createCreatureVisual, updateCreatureVisual, destroyCreatureVisual,
  type CreatureVisual,
} from './creature-renderer';

/** A self-contained animated creature preview (PixiJS app + visual + ticker). */
export interface CreaturePreviewApp {
  app: Application;
  visual: CreatureVisual;
  /** Destroy the preview and free all resources. */
  destroy: () => void;
}

/**
 * Create an animated creature preview inside a DOM container.
 * Renders the full creature visual including rare shader effects.
 * Returns a handle to destroy it when no longer needed.
 */
export async function createCreaturePreviewApp(
  creature: Creature,
  container: HTMLElement,
  size: number,
): Promise<CreaturePreviewApp> {
  const app = new Application();
  await app.init({
    width: size,
    height: size,
    background: '#060e12',
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.imageRendering = 'pixelated';
  container.appendChild(canvas);

  // Context loss handling
  const onLost = (e: Event) => { e.preventDefault(); app.ticker.stop(); };
  const onRestored = () => { app.ticker.start(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // Create the creature visual with its own filter instances
  const visual = createCreatureVisual(creature, true);
  visual.mainSprite.width = size;
  visual.mainSprite.height = size;
  if (visual.glowSprite) {
    visual.glowSprite.width = size;
    visual.glowSprite.height = size;
  }

  // Pivot setup for movement-based rare effects
  const pivotMode = creature.rare ? getRareInfo(creature.rare).pivotMode : undefined;
  if (pivotMode === 'center') {
    const half = size / 2;
    visual.sprite.pivot.set(half, half);
    visual.sprite.x = half;
    visual.sprite.y = half;
  } else if (pivotMode === 'inverted') {
    const half = size / 2;
    visual.sprite.pivot.set(half, 0);
    visual.sprite.scale.y = -1;
    visual.sprite.x = half;
    visual.sprite.y = size;
  } else {
    visual.sprite.x = 0;
    visual.sprite.y = 0;
  }

  app.stage.addChild(visual.sprite);

  // Animate via the preview app's ticker
  const tickerFn = (tick: { deltaTime: number }) => {
    const deltaSec = tick.deltaTime / 60;
    const elapsed = performance.now() / 1000;
    updateCreatureVisual(visual, deltaSec, elapsed);
  };
  app.ticker.add(tickerFn);

  return {
    app,
    visual,
    destroy() {
      app.ticker.remove(tickerFn);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      destroyCreatureVisual(visual);
      app.stage.removeChildren();
      app.destroy(false);
    },
  };
}
