import type { UniqueId } from '../../creatures/uniques';
import { type PixelGrid, CANVAS_PX, renderGridToCanvas } from '../pixel-grid';
import { renderNautilus } from './nautilus';
import { renderLeviathan } from './leviathan';
import { renderAngler } from './angler';
import { renderSeaDragon } from './seadragon';
import { renderMantis } from './mantis';

export const UNIQUE_RENDERERS: Record<UniqueId, (time: number) => PixelGrid> = {
  nautilus: renderNautilus,
  leviathan: renderLeviathan,
  angler: renderAngler,
  seadragon: renderSeaDragon,
  mantis: renderMantis,
};

const SILHOUETTE = '#1a2e33';

/** Static frame of a unique on a 2D canvas; `silhouette` paints every pixel one flat colour. */
export function renderUniqueThumbnail(id: UniqueId, silhouette = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  const grid = UNIQUE_RENDERERS[id](0);
  if (silhouette) for (const k in grid) grid[k] = SILHOUETTE;
  renderGridToCanvas(grid, canvas.getContext('2d')!);
  return canvas;
}

/**
 * Animate a unique on a canvas inside `host` (shore card). Returns a stop function.
 * Frames are throttled to 20 Hz: the shapes move slowly and the canvas is small.
 */
export function mountUniquePreview(id: UniqueId, host: HTMLElement, sizePx: number): () => void {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;
  canvas.style.width = `${sizePx}px`;
  canvas.style.height = `${sizePx}px`;
  canvas.style.imageRendering = 'pixelated';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let image: ImageData | null = null;
  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    if (now - last >= 50) {
      image = renderGridToCanvas(UNIQUE_RENDERERS[id](now / 1000), ctx, image);
      last = now;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    canvas.remove();
  };
}
