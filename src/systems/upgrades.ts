import type { GameState, ResourceBundle } from '../core/game-state';
import { isReleaseUnlocked } from './achievements';
import { hasShallowSlot } from './coords';
import { RARE_EFFECTS } from '../creatures/creature';
import { formatMultiplier } from '../util/format';
import type { IconId } from '../rendering/icon-data';

// ---------------------------------------------------------------------------
// Upgrade definitions
// ---------------------------------------------------------------------------

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  icon: IconId;
  maxLevel: number;
  costFn: (level: number) => number;
  effectFn: (level: number) => number;
  /** Resource used to pay for this upgrade. Defaults to plankton. */
  costResource?: keyof ResourceBundle;
  /** When set, the upgrade is hidden from the shop until this returns true. */
  visible?: (state: GameState) => boolean;
  /** Formats the cumulative effect for the shop ("×1.56"); omit for one-shot unlocks. */
  effectLabel?: (effect: number) => string;
}

const costs = (arr: number[]) => (lv: number) => arr[lv] ?? Infinity;
const geometric = (base: number, growth: number) => (lv: number) => Math.ceil(base * Math.pow(growth, lv));

const TIER_COUNT = (tier: number) => RARE_EFFECTS.filter((e) => e.tier === tier).length;

const hasUpgrade = (id: string) => (state: GameState) => getUpgradeLevel(state, id) > 0;
/** Nacre upgrades appear together with the nacre economy (release unlocked). */
const nacreVisible = isReleaseUnlocked;
/** Lux upgrades appear once the pool has a shallow slot, where lux is produced. */
const luxVisible = (state: GameState) => hasShallowSlot(state.pool);

export const UPGRADES: UpgradeDefinition[] = [
  // --- Plankton ---
  {
    id: 'fertile_waters',
    name: 'Fertile Waters',
    description: '×1.25 plankton production per level',
    effectLabel: formatMultiplier,
    icon: 'up-fertile_waters',
    maxLevel: 15,
    costFn: geometric(100, 3),
    effectFn: (lv) => Math.pow(1.25, lv),
  },
  {
    id: 'plankton_surge',
    name: 'Plankton Surge',
    description: '+50% plankton clump value per level',
    effectLabel: formatMultiplier,
    icon: 'up-plankton_surge',
    maxLevel: 5,
    costFn: geometric(300, 6),
    effectFn: (lv) => 1 + lv * 0.50,
  },
  {
    id: 'magnetic_current',
    name: 'Magnetic Current',
    description: '+30% clump collection radius per level',
    effectLabel: formatMultiplier,
    icon: 'up-magnetic_current',
    maxLevel: 3,
    costFn: costs([150, 1500, 15000]),
    effectFn: (lv) => 1 + lv * 0.30,
  },
  {
    id: 'swift_tides',
    name: 'Swift Tides',
    description: '-10% tide interval per level',
    effectLabel: formatMultiplier,
    icon: 'up-swift_tides',
    maxLevel: 3,
    costFn: costs([300, 5000, 80000]),
    effectFn: (lv) => 1 - lv * 0.10,
  },
  {
    id: 'bountiful_shore',
    name: 'Bountiful Shore',
    description: '+1 creature per tide',
    effectLabel: (e) => `${e} per tide`,
    icon: 'up-bountiful_shore',
    maxLevel: 2,
    costFn: costs([800, 25000]),
    effectFn: (lv) => 2 + lv,
  },
  {
    id: 'coral_growth',
    name: 'Coral Growth',
    description: '-15% coral spawn interval per level',
    effectLabel: formatMultiplier,
    icon: 'up-coral_growth',
    maxLevel: 3,
    costFn: costs([500, 8000, 120000]),
    effectFn: (lv) => 1 - lv * 0.15,
  },
  {
    id: 'nacre_refinement',
    name: 'Nacre Refinement',
    description: '+25% nacre from release per level',
    effectLabel: formatMultiplier,
    icon: 'up-nacre_refinement',
    maxLevel: 5,
    costFn: geometric(2000, 8),
    effectFn: (lv) => 1 + lv * 0.25,
    visible: nacreVisible,
  },

  // --- Nacre ---
  {
    id: 'pearl_bloom',
    name: 'Pearl Bloom',
    description: '×1.2 plankton production per level',
    effectLabel: formatMultiplier,
    icon: 'up-pearl_bloom',
    maxLevel: 30,
    costFn: geometric(3, 1.6),
    effectFn: (lv) => Math.pow(1.2, lv),
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'rich_brine',
    name: 'Rich Brine',
    description: '×0.85 feeding cost per level',
    effectLabel: formatMultiplier,
    icon: 'up-rich_brine',
    maxLevel: 10,
    costFn: geometric(5, 2),
    effectFn: (lv) => Math.pow(0.85, lv),
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'tidal_salvage',
    name: 'Tidal Salvage',
    description: '+25% species material from release per level',
    effectLabel: formatMultiplier,
    icon: 'up-tidal_salvage',
    maxLevel: 5,
    costFn: geometric(6, 2.5),
    effectFn: (lv) => 1 + lv * 0.25,
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'rare_lure',
    name: 'Rare Lure',
    description: '+1% rare creature chance per level',
    effectLabel: (e) => `+${Math.round(e * 100)}%`,
    icon: 'up-rare_lure',
    maxLevel: 7,
    costFn: geometric(4, 2),
    effectFn: (lv) => lv * 0.01,
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'strange_tides',
    name: 'Strange Tides',
    description: `Unlocks ${TIER_COUNT(2)} tier-2 rare effects`,
    icon: 'up-strange_tides',
    maxLevel: 1,
    costFn: costs([15]),
    effectFn: (lv) => lv,
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'deep_drilling',
    name: 'Deep Drilling',
    description: 'Unlocks minerite production in deep slots',
    icon: 'up-deep_drilling',
    maxLevel: 1,
    costFn: costs([10]),
    effectFn: (lv) => lv,
    costResource: 'nacre',
    visible: nacreVisible,
  },

  // --- Minerite ---
  {
    id: 'bioluminescence',
    name: 'Bioluminescence',
    description: 'Per-creature lux multiplier +2 × Glow per level',
    effectLabel: (e) => `×(1 + ${2 * e} × Glow)`,
    icon: 'up-bioluminescence',
    maxLevel: 5,
    costFn: geometric(50, 3),
    effectFn: (lv) => lv,
    costResource: 'minerite',
    visible: hasUpgrade('deep_drilling'),
  },
  {
    id: 'mineral_feed',
    name: 'Mineral Feed',
    description: '×1.5 plankton production per level',
    effectLabel: formatMultiplier,
    icon: 'up-mineral_feed',
    maxLevel: 12,
    costFn: geometric(20, 2.5),
    effectFn: (lv) => Math.pow(1.5, lv),
    costResource: 'minerite',
    visible: hasUpgrade('deep_drilling'),
  },

  // --- Lux ---
  {
    id: 'abyssal_legends',
    name: 'Abyssal Legends',
    description: `Unlocks ${TIER_COUNT(3)} tier-3 rare effects`,
    icon: 'up-abyssal_legends',
    maxLevel: 1,
    costFn: costs([100]),
    effectFn: (lv) => lv,
    costResource: 'lux',
    visible: luxVisible,
  },
  {
    id: 'glow_lure',
    name: 'Glow Lure',
    description: '+1% rare creature chance per level',
    effectLabel: (e) => `+${Math.round(e * 100)}%`,
    icon: 'up-glow_lure',
    maxLevel: 5,
    costFn: geometric(20, 2),
    effectFn: (lv) => lv * 0.01,
    costResource: 'lux',
    visible: luxVisible,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getUpgradeLevel(state: GameState, upgradeId: string): number {
  return state.upgrades[upgradeId] ?? 0;
}

export function getUpgradeEffect(upgradeId: string, level: number): number {
  const def = UPGRADES.find((u) => u.id === upgradeId);
  if (!def) return 1;
  return def.effectFn(level);
}

/** Current effect of an upgrade at the player's level. */
export function upgradeEffect(state: GameState, upgradeId: string): number {
  return getUpgradeEffect(upgradeId, getUpgradeLevel(state, upgradeId));
}

export function getUpgradeCostResource(def: UpgradeDefinition): keyof ResourceBundle {
  return def.costResource ?? 'plankton';
}

export function isUpgradeVisible(state: GameState, def: UpgradeDefinition): boolean {
  return def.visible ? def.visible(state) : true;
}

export function purchaseUpgrade(state: GameState, upgradeId: string): boolean {
  const def = UPGRADES.find((u) => u.id === upgradeId);
  if (!def || !isUpgradeVisible(state, def)) return false;
  const level = getUpgradeLevel(state, upgradeId);
  if (level >= def.maxLevel) return false;
  const cost = def.costFn(level);
  const resource = getUpgradeCostResource(def);
  if (state.resources[resource] < cost) return false;
  state.resources[resource] -= cost;
  state.upgrades[upgradeId] = level + 1;
  return true;
}
