import type { GameState } from '../core/game-state';
import { getProductionRates } from '../economy/production-engine';
import { getUpgradeLevel } from '../systems/upgrades';

let mounted = false;

/** Resource definitions — easy to extend with new resources */
interface ResourceDef {
  key: keyof GameState['resources'];
  icon: string;
  showRate?: boolean;
  /** Function returning true when this resource's slot should be rendered. */
  visible?: (state: GameState) => boolean;
}

const RESOURCES: ResourceDef[] = [
  { key: 'plankton', icon: '🟢', showRate: true },
  { key: 'minerite', icon: '🔵', showRate: true, visible: (s) => getUpgradeLevel(s, 'deep_drilling') > 0 },
  { key: 'lux',      icon: '✨', showRate: true, visible: (s) => getUpgradeLevel(s, 'bioluminescence') > 0 },
  { key: 'nacre',    icon: '⚬', visible: (s) => s.releaseUnlocked },
  { key: 'coral',    icon: '🪸', visible: (s) => s.resources.coral > 0 },
];

export function updateHud(state: GameState): void {
  const bar = document.getElementById('top-bar');
  if (!bar) return;

  if (!mounted) {
    bar.innerHTML = '<div class="resource-list" id="resource-list"></div>';
    mounted = true;
  }

  const rates = getProductionRates(state);
  const resList = document.getElementById('resource-list')!;
  const visibleResources = RESOURCES.filter((r) => r.visible ? r.visible(state) : true);
  resList.innerHTML = visibleResources
    .map((r) => {
      const val = Math.floor(state.resources[r.key]);
      const rate = r.key === 'plankton' ? rates.plankton
                 : r.key === 'minerite' ? rates.minerite
                 : r.key === 'lux'      ? rates.lux
                 : 0;
      const rateHtml = r.showRate
        ? `<span class="res-rate">+${rate.toFixed(2)}/s</span>`
        : '';
      return `
        <div class="resource-item">
          <span class="res-value">${val} ${r.icon}</span>
          ${rateHtml}
        </div>
      `;
    })
    .join('<div class="top-sep"></div>');
}
