import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_ICONS, CREATURE_NAMES } from '../creatures/types';
import { calculatePickupCost, pickUpCreature } from '../systems/tides';

let shoreEl: HTMLDivElement | null = null;
let onPickUp: ((creature: Creature) => void) | null = null;

function ensureShoreEl(): HTMLDivElement {
  if (shoreEl) return shoreEl;

  shoreEl = document.createElement('div');
  shoreEl.id = 'tide-shore';
  shoreEl.style.cssText = `
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 8px; pointer-events: auto;
  `;
  document.getElementById('ui')!.appendChild(shoreEl);
  return shoreEl;
}

export function setOnPickUp(cb: (creature: Creature) => void): void {
  onPickUp = cb;
}

export function renderShore(state: GameState): void {
  const el = ensureShoreEl();
  el.innerHTML = '';

  if (state.shore.length === 0) {
    el.innerHTML = `
      <div style="background:#0a1a20; border:1px solid #1a3a3f; border-radius:4px;
        padding:10px 20px; font-size:8px; color:#3aada8; text-align:center;">
        Waiting for tide...
      </div>
    `;
    return;
  }

  for (let i = 0; i < state.shore.length; i++) {
    const creature = state.shore[i];
    const cost = calculatePickupCost(creature);
    const canAfford = state.resources.plankton >= cost;
    const rareInfo = getRareInfo(creature.rare);

    const card = document.createElement('div');
    card.style.cssText = `
      background: #0a1a20; border: 1px solid ${creature.rare ? rareInfo.color + '60' : '#1a3a3f'};
      border-radius: 4px; padding: 10px; width: 140px; text-align: center; cursor: pointer;
      transition: border-color 0.2s, opacity 0.2s;
      opacity: ${canAfford ? '1' : '0.5'};
    `;

    card.innerHTML = `
      <div style="font-size:20px; margin-bottom:4px;">${CREATURE_ICONS[creature.type]}</div>
      <div style="font-size:8px; color:#dadaff; margin-bottom:4px;">${creature.name}</div>
      <div style="font-size:7px; color:#3aada8; margin-bottom:2px;">${CREATURE_NAMES[creature.type]}</div>
      ${creature.rare ? `<div style="font-size:7px; color:${rareInfo.color}; margin-bottom:4px;">${rareInfo.icon} ${rareInfo.label}</div>` : ''}
      <div style="font-size:8px; color:${canAfford ? '#7eeee4' : '#8b3a5a'}; margin-top:4px;">
        ${cost} 🟢
      </div>
    `;

    card.addEventListener('click', () => {
      const picked = pickUpCreature(state, state.shore.indexOf(creature));
      if (picked) {
        onPickUp?.(picked);
        renderShore(state);
      }
    });

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = canAfford ? '#3aada8' : '#8b3a5a';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = creature.rare ? rareInfo.color + '60' : '#1a3a3f';
    });

    el.appendChild(card);
  }
}
