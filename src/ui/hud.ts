import type { GameState } from '../core/game-state';
import { getTotalProductionRate } from '../economy/production-engine';
import { TIDE_INTERVAL_MIN } from '../core/balance';

let hudEl: HTMLDivElement | null = null;

function ensureHud(): HTMLDivElement {
  if (hudEl) return hudEl;

  hudEl = document.createElement('div');
  hudEl.id = 'hud';
  hudEl.style.cssText = `
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 16px; align-items: center;
    background: #0a1a20cc; border: 1px solid #1a3a3f;
    border-radius: 4px; padding: 8px 20px; pointer-events: auto;
  `;
  document.getElementById('ui')!.appendChild(hudEl);
  return hudEl;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'soon';
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function updateHud(state: GameState): void {
  const el = ensureHud();
  const rate = getTotalProductionRate(state);
  const elapsed = (Date.now() - state.lastTideTimestamp) / 1000;
  const nextTide = Math.max(0, TIDE_INTERVAL_MIN - elapsed);

  el.innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:12px; color:#7eeee4;">${Math.floor(state.resources.plankton)} 🟢</div>
      <div style="font-size:7px; color:#3aada8; margin-top:2px;">+${rate.toFixed(1)}/s</div>
    </div>
    <div style="width:1px; height:20px; background:#1a3a3f;"></div>
    <div style="text-align:center;">
      <div style="font-size:8px; color:#b8d4d8;">TIDE</div>
      <div style="font-size:8px; color:#3aada8; margin-top:2px;">
        ${state.shore.length > 0 ? `${state.shore.length} on shore` : formatTime(nextTide)}
      </div>
    </div>
  `;
}
