import type { GameState, UpgradeType } from '../core/game-state';
import { getUpgradeNodePositions } from '../systems/coords';
import { UPGRADE_ALGAE_COLONY_COST, UPGRADE_ALGAE_COLONY_BONUS } from '../core/balance';

export interface UpgradeDef {
  type: UpgradeType;
  label: string;
  description: string;
  cost: { plankton: number; minerite: number; lux: number };
  bonus: number; // production multiplier bonus for surrounding creatures
}

export const UPGRADE_DEFS: Record<UpgradeType, UpgradeDef> = {
  algae_colony: {
    type: 'algae_colony',
    label: 'Algae Colony',
    description: '+25% production for 4 surrounding creatures',
    cost: { plankton: UPGRADE_ALGAE_COLONY_COST, minerite: 0, lux: 0 },
    bonus: UPGRADE_ALGAE_COLONY_BONUS,
  },
};

let _nextNodeId = 0;

/** Get upgrade bonus for a creature at (r, c) from surrounding upgrade nodes */
export function getUpgradeBonus(state: GameState, r: number, c: number): number {
  let bonus = 0;

  // A creature at (r,c) is part of a 2x2 block whose top-left is at:
  // (r-1,c-1), (r-1,c), (r,c-1), (r,c)
  const possibleNodes: [number, number][] = [
    [r - 1, c - 1],
    [r - 1, c],
    [r, c - 1],
    [r, c],
  ];

  for (const [nr, nc] of possibleNodes) {
    const node = state.upgradeNodes.find((n) => n.row === nr && n.col === nc);
    if (node?.upgradeType) {
      const def = UPGRADE_DEFS[node.upgradeType];
      if (def) bonus += def.bonus;
    }
  }

  return bonus;
}

/** Check if an upgrade can be installed at a node position */
export function canInstallUpgrade(state: GameState, nodeR: number, nodeC: number, type: UpgradeType): boolean {
  // Verify this is a valid 2x2 position
  const validPositions = getUpgradeNodePositions(state.pool);
  const isValid = validPositions.some(([r, c]) => r === nodeR && c === nodeC);
  if (!isValid) return false;

  // Check if already has an upgrade
  const existing = state.upgradeNodes.find((n) => n.row === nodeR && n.col === nodeC);
  if (existing?.upgradeType) return false;

  // Check cost
  const def = UPGRADE_DEFS[type];
  if (state.resources.plankton < def.cost.plankton) return false;
  if (state.resources.minerite < def.cost.minerite) return false;
  if (state.resources.lux < def.cost.lux) return false;

  return true;
}

/** Install an upgrade at a node position */
export function installUpgrade(state: GameState, nodeR: number, nodeC: number, type: UpgradeType): boolean {
  if (!canInstallUpgrade(state, nodeR, nodeC, type)) return false;

  const def = UPGRADE_DEFS[type];
  state.resources.plankton -= def.cost.plankton;
  state.resources.minerite -= def.cost.minerite;
  state.resources.lux -= def.cost.lux;

  // Find or create the node
  let node = state.upgradeNodes.find((n) => n.row === nodeR && n.col === nodeC);
  if (!node) {
    node = {
      id: `un_${Date.now()}_${_nextNodeId++}`,
      row: nodeR,
      col: nodeC,
      upgradeType: null,
    };
    state.upgradeNodes.push(node);
  }

  node.upgradeType = type;
  return true;
}

/** Get all available upgrade types for Phase 1 */
export function getAvailableUpgrades(): UpgradeType[] {
  return ['algae_colony'];
}
