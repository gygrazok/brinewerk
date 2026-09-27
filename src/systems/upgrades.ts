import type { GameState, ResourceBundle } from '../core/game-state';
import { isReleaseUnlocked } from './achievements';
import { hasShallowSlot } from './coords';

// ---------------------------------------------------------------------------
// Upgrade definitions
// ---------------------------------------------------------------------------

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
  costFn: (level: number) => number;
  effectFn: (level: number) => number;
  /** Resource used to pay for this upgrade. Defaults to plankton. */
  costResource?: keyof ResourceBundle;
  /** When set, the upgrade is hidden from the shop until this returns true. */
  visible?: (state: GameState) => boolean;
}

const costs = (arr: number[]) => (lv: number) => arr[lv] ?? Infinity;
const geometric = (base: number, growth: number) => (lv: number) => Math.ceil(base * Math.pow(growth, lv));

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
    description: 'All creatures produce 25% more plankton. Stacks with each level.',
    icon: '🌿',
    maxLevel: 15,
    costFn: geometric(100, 3),
    effectFn: (lv) => Math.pow(1.25, lv),
  },
  {
    id: 'plankton_surge',
    name: 'Plankton Surge',
    description: 'Floating plankton clumps are worth 50% more per level.',
    icon: '💚',
    maxLevel: 5,
    costFn: geometric(300, 6),
    effectFn: (lv) => 1 + lv * 0.50,
  },
  {
    id: 'magnetic_current',
    name: 'Magnetic Current',
    description: 'Your cursor pulls in floating clumps from 30% farther away per level.',
    icon: '🧲',
    maxLevel: 3,
    costFn: costs([150, 1500, 15000]),
    effectFn: (lv) => 1 + lv * 0.30,
  },
  {
    id: 'swift_tides',
    name: 'Swift Tides',
    description: 'Tides arrive 10% sooner per level, bringing new creatures more often.',
    icon: '🌊',
    maxLevel: 3,
    costFn: costs([300, 5000, 80000]),
    effectFn: (lv) => 1 - lv * 0.10,
  },
  {
    id: 'bountiful_shore',
    name: 'Bountiful Shore',
    description: 'Each tide brings one more creature to choose from.',
    icon: '🏖️',
    maxLevel: 2,
    costFn: costs([800, 25000]),
    effectFn: (lv) => 2 + lv,
  },
  {
    id: 'coral_growth',
    name: 'Coral Growth',
    description: 'Coral sprouts on the seabed 15% more often per level.',
    icon: '🪸',
    maxLevel: 3,
    costFn: costs([500, 8000, 120000]),
    effectFn: (lv) => 1 - lv * 0.15,
  },
  {
    id: 'nacre_refinement',
    name: 'Nacre Refinement',
    description: 'Releasing a creature gives 25% more nacre per level.',
    icon: '⚬',
    maxLevel: 5,
    costFn: geometric(2000, 8),
    effectFn: (lv) => 1 + lv * 0.25,
    visible: nacreVisible,
  },

  // --- Nacre ---
  {
    id: 'pearl_bloom',
    name: 'Pearl Bloom',
    description: 'All creatures produce 20% more plankton. Stacks with each level.',
    icon: '🦪',
    maxLevel: 30,
    costFn: geometric(3, 1.6),
    effectFn: (lv) => Math.pow(1.2, lv),
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'rich_brine',
    name: 'Rich Brine',
    description: 'Feeding creatures costs 15% less per level.',
    icon: '🧂',
    maxLevel: 10,
    costFn: geometric(5, 2),
    effectFn: (lv) => Math.pow(0.85, lv),
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'rare_lure',
    name: 'Rare Lure',
    description: 'Rare creatures show up on the shore more often (+1% chance per level).',
    icon: '🎣',
    maxLevel: 7,
    costFn: geometric(4, 2),
    effectFn: (lv) => lv * 0.01,
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'strange_tides',
    name: 'Strange Tides',
    description: 'Tides can bring creatures with uncommon effects, such as Glitch, On Fire and Frost.',
    icon: '🌀',
    maxLevel: 1,
    costFn: costs([15]),
    effectFn: (lv) => lv,
    costResource: 'nacre',
    visible: nacreVisible,
  },
  {
    id: 'deep_drilling',
    name: 'Deep Drilling',
    description: 'Creatures placed in the deep slots at the bottom of the pool start producing minerite.',
    icon: '⛏',
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
    description: 'Creatures near the surface produce more lux. The brighter their glow, the bigger the boost.',
    icon: '💡',
    maxLevel: 5,
    costFn: geometric(50, 3),
    effectFn: (lv) => lv,
    costResource: 'minerite',
    visible: hasUpgrade('deep_drilling'),
  },
  {
    id: 'mineral_feed',
    name: 'Mineral Feed',
    description: 'Minerite-enriched water: all creatures produce 50% more plankton. Stacks with each level.',
    icon: '💎',
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
    description: 'Tides can bring creatures with legendary effects, such as Hologram, Holy and X-Ray.',
    icon: '🌌',
    maxLevel: 1,
    costFn: costs([100]),
    effectFn: (lv) => lv,
    costResource: 'lux',
    visible: luxVisible,
  },
  {
    id: 'glow_lure',
    name: 'Glow Lure',
    description: 'Glowing lures draw rare creatures to the shore (+1% chance per level).',
    icon: '🏮',
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
