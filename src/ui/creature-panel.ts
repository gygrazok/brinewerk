import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_NAMES, CREATURE_ICONS } from '../creatures/types';
import { calculateProduction } from '../creatures/production';
import { getDisplayTraits, TRAIT_COLORS } from '../genetics/traits';

let panelEl: HTMLDivElement | null = null;

function ensurePanel(): HTMLDivElement {
  if (panelEl) return panelEl;

  panelEl = document.createElement('div');
  panelEl.id = 'creature-panel';
  panelEl.style.cssText = `
    position: absolute; bottom: 16px; right: 16px;
    background: #0a1a20; border: 1px solid #1a3a3f;
    border-radius: 4px; padding: 12px; width: 220px;
    font-family: 'Press Start 2P', monospace; font-size: 8px;
    color: #b8d4d8; display: none; pointer-events: auto;
  `;
  document.getElementById('ui')!.appendChild(panelEl);
  return panelEl;
}

export function showCreaturePanel(creature: Creature, adjacencyBonus: number = 0): void {
  const panel = ensurePanel();
  const rareInfo = getRareInfo(creature.rare);
  const production = calculateProduction(creature, adjacencyBonus);
  const traits = getDisplayTraits(creature.type);

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="color:#dadaff; font-size:10px;">${creature.name}</span>
      <span style="font-size:7px; padding:2px 6px; background:#1a3a3f; border-radius:2px;">
        ${CREATURE_ICONS[creature.type]} ${CREATURE_NAMES[creature.type]}
      </span>
    </div>
  `;

  if (creature.rare) {
    html += `
      <div style="margin-bottom:8px;">
        <span style="font-size:7px; padding:2px 6px; border-radius:2px;
          background:${rareInfo.color}20; color:${rareInfo.color};">
          ${rareInfo.icon} ${rareInfo.label.toUpperCase()}
        </span>
      </div>
    `;
  }

  html += `<div style="margin-bottom:8px; color:#3aada8;">+${production.toFixed(2)} plankton/s</div>`;

  html += `<div style="display:flex; flex-direction:column; gap:3px;">`;
  for (const trait of traits) {
    const val = creature.genes[trait as keyof typeof creature.genes] as number;
    const color = TRAIT_COLORS[trait] ?? '#3aada8';
    html += `
      <div style="display:flex; align-items:center; gap:4px;">
        <span style="width:42px; text-align:right; font-size:7px; color:#3aada8; flex-shrink:0;">
          ${trait.slice(0, 5).toUpperCase()}
        </span>
        <div style="flex:1; height:6px; background:#0d2228; border-radius:1px; overflow:hidden;">
          <div style="width:${Math.round(val * 100)}%; height:100%; background:${color}; border-radius:1px;"></div>
        </div>
      </div>
    `;
  }
  html += `</div>`;

  panel.innerHTML = html;
  panel.style.display = 'block';
}

export function hideCreaturePanel(): void {
  if (panelEl) panelEl.style.display = 'none';
}
