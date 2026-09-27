import { Texture } from 'pixi.js';
import type { ResourceBundle } from '../core/game-state';
import type { RareEffect } from '../creatures/creature';
import type { CreatureType } from '../creatures/types';
import { ICON_DATA, ICON_PALETTE, ICON_SIZE, type IconId } from './icon-data';

export type { IconId };

/** Icon shown next to each resource amount (HUD, costs, popups). */
export const RESOURCE_ICON: Record<keyof ResourceBundle, IconId> = {
  plankton: 'plankton',
  minerite: 'minerite',
  lux: 'lux',
  nacre: 'nacre',
  coral: 'coral',
};

export function rareIcon(rare: RareEffect): IconId {
  return `rare-${rare}` as IconId;
}

export function typeIcon(type: CreatureType): IconId {
  return `type-${type}` as IconId;
}

/** Species material icon (dropped on release, spent on growth stages). */
export function materialIcon(type: CreatureType): IconId {
  return `mat-${type}` as IconId;
}

const canvasCache = new Map<IconId, HTMLCanvasElement>();
const urlCache = new Map<IconId, string>();
const textureCache = new Map<IconId, Texture>();

/** 9×9 canvas with the icon drawn at 1 px per cell (scale it with nearest-neighbour). */
export function iconCanvas(id: IconId): HTMLCanvasElement {
  let canvas = canvasCache.get(id);
  if (canvas) return canvas;

  canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  const rows = ICON_DATA[id];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      ctx.fillStyle = ICON_PALETTE[ch];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  canvasCache.set(id, canvas);
  return canvas;
}

/** PNG data URL for DOM `<img>` use. */
export function iconUrl(id: IconId): string {
  let url = urlCache.get(id);
  if (!url) {
    url = iconCanvas(id).toDataURL('image/png');
    urlCache.set(id, url);
  }
  return url;
}

/** Shared Pixi texture (nearest scaling) for in-canvas labels. */
export function iconTexture(id: IconId): Texture {
  let tex = textureCache.get(id);
  if (!tex) {
    tex = Texture.from(iconCanvas(id));
    tex.source.scaleMode = 'nearest';
    textureCache.set(id, tex);
  }
  return tex;
}

/** Free GPU textures (HMR / WebGL context loss). DOM caches stay valid. */
export function destroyIconTextures(): void {
  for (const tex of textureCache.values()) tex.destroy(true);
  textureCache.clear();
  canvasCache.clear();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => destroyIconTextures());
}
