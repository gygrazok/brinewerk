import type { SlotTheme } from '../core/game-state';

export interface SlotDef {
  id: string;
  x: number;
  y: number;
  unlocked: boolean;
  theme: SlotTheme;
  tier: number;
}

/**
 * Predefined seabed slot positions (~25 slots).
 * World space: 1920 x 1080.
 * Tier 0 = starter (unlocked), tiers 1-4 = progressively expensive.
 * Minimum 120px center-to-center spacing.
 */
export const SEABED_SLOTS: SlotDef[] = [
  // --- Tier 0: starter (center cluster) ---
  { id: 'slot_0',  x: 840,  y: 480, unlocked: true,  theme: 'rock',    tier: 0 },
  { id: 'slot_1',  x: 1000, y: 420, unlocked: true,  theme: 'coral',   tier: 0 },
  { id: 'slot_2',  x: 900,  y: 620, unlocked: true,  theme: 'shell',   tier: 0 },
  { id: 'slot_3',  x: 1080, y: 560, unlocked: true,  theme: 'rock',    tier: 0 },

  // --- Tier 1: near center (plankton only) ---
  { id: 'slot_4',  x: 680,  y: 380, unlocked: false, theme: 'coral',   tier: 1 },
  { id: 'slot_5',  x: 1200, y: 400, unlocked: false, theme: 'anemone', tier: 1 },
  { id: 'slot_6',  x: 720,  y: 700, unlocked: false, theme: 'shell',   tier: 1 },
  { id: 'slot_7',  x: 1240, y: 680, unlocked: false, theme: 'rock',    tier: 1 },
  { id: 'slot_8',  x: 960,  y: 280, unlocked: false, theme: 'coral',   tier: 1 },

  // --- Tier 2: spreading out (plankton + minerite) ---
  { id: 'slot_9',  x: 480,  y: 480, unlocked: false, theme: 'vent',    tier: 2 },
  { id: 'slot_10', x: 1400, y: 500, unlocked: false, theme: 'anemone', tier: 2 },
  { id: 'slot_11', x: 540,  y: 840, unlocked: false, theme: 'shell',   tier: 2 },
  { id: 'slot_12', x: 780,  y: 200, unlocked: false, theme: 'rock',    tier: 2 },
  { id: 'slot_13', x: 1340, y: 840, unlocked: false, theme: 'coral',   tier: 2 },

  // --- Tier 3: periphery (plankton + minerite + lux) ---
  { id: 'slot_14', x: 300,  y: 400, unlocked: false, theme: 'vent',    tier: 3 },
  { id: 'slot_15', x: 1580, y: 420, unlocked: false, theme: 'anemone', tier: 3 },
  { id: 'slot_16', x: 320,  y: 740, unlocked: false, theme: 'rock',    tier: 3 },
  { id: 'slot_17', x: 1500, y: 800, unlocked: false, theme: 'shell',   tier: 3 },
  { id: 'slot_18', x: 1120, y: 180, unlocked: false, theme: 'coral',   tier: 3 },

  // --- Tier 4: edges/deep (very expensive) ---
  { id: 'slot_19', x: 160,  y: 260, unlocked: false, theme: 'vent',    tier: 4 },
  { id: 'slot_20', x: 1740, y: 280, unlocked: false, theme: 'vent',    tier: 4 },
  { id: 'slot_21', x: 160,  y: 860, unlocked: false, theme: 'shell',   tier: 4 },
  { id: 'slot_22', x: 1740, y: 840, unlocked: false, theme: 'anemone', tier: 4 },
  { id: 'slot_23', x: 580,  y: 140, unlocked: false, theme: 'rock',    tier: 4 },
  { id: 'slot_24', x: 940,  y: 940, unlocked: false, theme: 'coral',   tier: 4 },
];
