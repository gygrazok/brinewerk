import type { GameState } from '../core/game-state';
import { getTotalProductionRate } from '../economy/production-engine';

let mounted = false;

/** Resource definitions — easy to extend with new resources */
interface ResourceDef {
  key: keyof GameState['resources'];
  icon: string;
  showRate?: boolean;
}

const RESOURCES: ResourceDef[] = [
  { key: 'plankton', icon: '🟢', showRate: true },
  { key: 'minerite', icon: '🔵' },
  { key: 'lux',      icon: '✨' },
  { key: 'nacre',    icon: '⚬' },
];

export function updateHud(state: GameState): void {
  const bar = document.getElementById('top-bar');
  if (!bar) return;

  if (!mounted) {
    bar.innerHTML = '<div class="resource-list" id="resource-list"></div>';
    mounted = true;
  }

  const rate = getTotalProductionRate(state);
  const resList = document.getElementById('resource-list')!;
  const visibleResources = RESOURCES.filter(
    (r) => r.key !== 'nacre' || state.releaseUnlocked,
  );
  resList.innerHTML = visibleResources
    .map((r) => {
      const val = Math.floor(state.resources[r.key]);
      const rateHtml = r.showRate
        ? `<span class="res-rate">+${rate.toFixed(1)}/s</span>`
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
