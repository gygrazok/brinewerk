import type { RareEffect } from '../../creatures/creature';
import type { PixelGrid } from '../pixel-grid';
import { applyFireEffect } from './fire';
import { applyToxicEffect } from './toxic';
import { applyFrostEffect } from './frost';
import { cleanupFrostState } from './frost';
import { cleanupToxicState } from './toxic';

export type PixelEffect = (grid: PixelGrid, time: number, creatureId: string) => void;

const PIXEL_EFFECTS: Partial<Record<RareEffect, PixelEffect>> = {
  fire: (grid, time) => applyFireEffect(grid, time),
  toxic: (grid, time, id) => applyToxicEffect(grid, time, id),
  frost: (grid, time, id) => applyFrostEffect(grid, time, id),
};

/** Get the pixel-level effect for a rare type (if any). */
export function getPixelEffect(rare: RareEffect): PixelEffect | undefined {
  return PIXEL_EFFECTS[rare];
}

/** Clean up per-creature effect state (call when a creature is removed) */
export function cleanupEffectState(creatureId: string): void {
  cleanupFrostState(creatureId);
  cleanupToxicState(creatureId);
}
