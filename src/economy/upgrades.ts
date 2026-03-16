import type { GameState, UpgradeType } from '../core/game-state';
import { getSlotById } from '../systems/coords';
import { UPGRADE_ALGAE_COLONY_COST, UPGRADE_ALGAE_COLONY_BONUS } from '../core/balance';
import { UPGRADE_ANCHORS } from '../systems/seabed-layout';

/** Radius (world px) within which an upgrade affects nearby creature slots */
const UPGRADE_RADIUS = 150;

export interface UpgradeDef {
  type: UpgradeType;
  label: string;
  description: string;
  cost: { plankton: number; minerite: number; lux: number };
  bonus: number;
}

export const UPGRADE_DEFS: Record<UpgradeType, UpgradeDef> = {
  algae_colony: {
    type: 'algae_colony',
    label: 'Algae Colony',
    description: '+25% production for nearby creatures',
    cost: { plankton: UPGRADE_ALGAE_COLONY_COST, minerite: 0, lux: 0 },
    bonus: UPGRADE_ALGAE_COLONY_BONUS,
  },
};

/** Get upgrade bonus for a creature in a given slot from nearby upgrade anchors */
export function getUpgradeBonus(state: GameState, slotId: string): number {
  const slot = getSlotById(state.pool, slotId);
  if (!slot) return 0;

  let bonus = 0;
  const r2 = UPGRADE_RADIUS * UPGRADE_RADIUS;

  for (const anchor of state.upgradeAnchors) {
    if (!anchor.upgradeType) continue;
    const dx = anchor.x - slot.x;
    const dy = anchor.y - slot.y;
    if (dx * dx + dy * dy <= r2) {
      const def = UPGRADE_DEFS[anchor.upgradeType];
      if (def) bonus += def.bonus;
    }
  }

  return bonus;
}

/** Check if an upgrade can be installed at an anchor */
export function canInstallUpgrade(state: GameState, anchorId: string, type: UpgradeType): boolean {
  const anchorDef = UPGRADE_ANCHORS.find(a => a.id === anchorId);
  if (!anchorDef) return false;

  const existing = state.upgradeAnchors.find(a => a.id === anchorId);
  if (existing?.upgradeType) return false;

  const def = UPGRADE_DEFS[type];
  if (state.resources.plankton < def.cost.plankton) return false;
  if (state.resources.minerite < def.cost.minerite) return false;
  if (state.resources.lux < def.cost.lux) return false;

  return true;
}

/** Install an upgrade at an anchor */
export function installUpgrade(state: GameState, anchorId: string, type: UpgradeType): boolean {
  if (!canInstallUpgrade(state, anchorId, type)) return false;

  const anchorDef = UPGRADE_ANCHORS.find(a => a.id === anchorId)!;
  const def = UPGRADE_DEFS[type];
  state.resources.plankton -= def.cost.plankton;
  state.resources.minerite -= def.cost.minerite;
  state.resources.lux -= def.cost.lux;

  let anchor = state.upgradeAnchors.find(a => a.id === anchorId);
  if (!anchor) {
    anchor = {
      id: anchorDef.id,
      x: anchorDef.x,
      y: anchorDef.y,
      upgradeType: null,
    };
    state.upgradeAnchors.push(anchor);
  }

  anchor.upgradeType = type;
  return true;
}

/** Get all available upgrade types */
export function getAvailableUpgrades(): UpgradeType[] {
  return ['algae_colony'];
}
