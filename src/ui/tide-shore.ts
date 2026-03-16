import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_ICONS, CREATURE_NAMES } from '../creatures/types';
import { calculatePickupCost, pickUpCreature } from '../systems/tides';
import { TIDE_INTERVAL_MIN } from '../core/balance';
import { findEmptySlot } from '../systems/pool';

let onPickUp: ((creature: Creature) => void) | null = null;

export function setOnPickUp(cb: (creature: Creature) => void): void {
  onPickUp = cb;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'soon';
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function renderShore(state: GameState): void {
  const bar = document.getElementById('bottom-bar');
  if (!bar) return;

  bar.innerHTML = '';

  if (state.shore.length === 0) {
    // Show tide countdown
    const elapsed = (Date.now() - state.lastTideTimestamp) / 1000;
    const nextTide = Math.max(0, TIDE_INTERVAL_MIN - elapsed);
    bar.innerHTML = `
      <div class="tide-status">
        <span class="tide-label">Next tide</span>
        <span class="tide-value">${formatTime(nextTide)}</span>
      </div>
    `;
    return;
  }

  const gridFull = findEmptySlot(state) === null;

  for (let i = 0; i < state.shore.length; i++) {
    const creature = state.shore[i];
    const cost = calculatePickupCost(creature);
    const canAfford = state.resources.plankton >= cost;
    const blocked = !canAfford || gridFull;
    const rareInfo = getRareInfo(creature.rare);

    const card = document.createElement('div');
    card.className = `shore-card${blocked ? ' unaffordable' : ''}`;

    if (creature.rare) {
      card.style.borderColor = rareInfo.color + '60';
    }

    let rareHtml = '';
    if (creature.rare) {
      rareHtml = `<span class="shore-rare" style="color:${rareInfo.color};">${rareInfo.icon} ${rareInfo.label}</span>`;
    }

    const costColor = gridFull ? 'var(--text-dim)' : canAfford ? 'var(--accent-hi)' : 'var(--warn)';
    const costLabel = gridFull ? 'FULL' : `${cost} 🟢`;

    card.innerHTML = `
      <span class="shore-icon">${CREATURE_ICONS[creature.type]}</span>
      <div class="shore-info">
        <span class="shore-name">${creature.name}</span>
        <span class="shore-type">${CREATURE_NAMES[creature.type]}</span>
        ${rareHtml}
      </div>
      <span class="shore-cost" style="color:${costColor};">
        ${costLabel}
      </span>
    `;

    if (!blocked) {
      card.addEventListener('click', () => {
        const picked = pickUpCreature(state, state.shore.indexOf(creature));
        if (picked) {
          onPickUp?.(picked);
          renderShore(state);
        }
      });
    }

    bar.appendChild(card);
  }
}
