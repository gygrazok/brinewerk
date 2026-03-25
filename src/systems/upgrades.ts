import type { GameState } from '../core/game-state';

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
}

const costs = (arr: number[]) => (lv: number) => arr[lv] ?? Infinity;

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: 'fertile_waters',
    name: 'Fertile Waters',
    description: '+15% creature production per level',
    icon: '🌿',
    maxLevel: 5,
    costFn: costs([50, 100, 200, 400, 800]),
    effectFn: (lv) => 1 + lv * 0.15,
  },
  {
    id: 'magnetic_current',
    name: 'Magnetic Current',
    description: '+30% plankton magnet radius per level',
    icon: '🧲',
    maxLevel: 3,
    costFn: costs([75, 200, 500]),
    effectFn: (lv) => 1 + lv * 0.30,
  },
  {
    id: 'swift_tides',
    name: 'Swift Tides',
    description: '-10% tide interval per level',
    icon: '🌊',
    maxLevel: 3,
    costFn: costs([100, 300, 700]),
    effectFn: (lv) => 1 - lv * 0.10,
  },
  {
    id: 'bountiful_shore',
    name: 'Bountiful Shore',
    description: '+1 creature on shore per level',
    icon: '🏖️',
    maxLevel: 2,
    costFn: costs([200, 500]),
    effectFn: (lv) => 2 + lv,
  },
  {
    id: 'plankton_surge',
    name: 'Plankton Surge',
    description: 'Plankton collectibles worth +50%',
    icon: '💚',
    maxLevel: 1,
    costFn: costs([400]),
    effectFn: (lv) => 1 + lv * 0.50,
  },
  {
    id: 'coral_growth',
    name: 'Coral Growth',
    description: '-15% coral spawn interval per level',
    icon: '🪸',
    maxLevel: 3,
    costFn: costs([150, 350, 750]),
    effectFn: (lv) => 1 - lv * 0.15,
  },
  {
    id: 'nacre_refinement',
    name: 'Nacre Refinement',
    description: '+25% nacre from release per level',
    icon: '⚬',
    maxLevel: 3,
    costFn: costs([200, 450, 900]),
    effectFn: (lv) => 1 + lv * 0.25,
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

export function purchaseUpgrade(state: GameState, upgradeId: string): boolean {
  const def = UPGRADES.find((u) => u.id === upgradeId);
  if (!def) return false;
  const level = getUpgradeLevel(state, upgradeId);
  if (level >= def.maxLevel) return false;
  const cost = def.costFn(level);
  if (state.resources.plankton < cost) return false;
  state.resources.plankton -= cost;
  state.upgrades[upgradeId] = level + 1;
  return true;
}
