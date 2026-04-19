import type { GameState } from '../core/game-state';
import { createDefaultState, clearSave } from '../core/game-state';
import { disableSaving } from '../core/game-loop';
import { forceTide } from '../systems/tides';
import { createCreature, RARE_EFFECTS, type RareEffect } from '../creatures/creature';
import { CreatureType, CREATURE_NAMES } from '../creatures/types';

export interface DebugMenuOptions {
  onStateChange: () => void;
  onReset: () => void;
  onSpawnCoral?: () => void;
}

/** Inject a floating debug menu (dev only). Returns cleanup function. */
export function initDebugMenu(
  state: GameState,
  opts: DebugMenuOptions,
): () => void {
  const { onStateChange, onReset, onSpawnCoral } = opts;
  const panel = document.createElement('div');
  panel.id = 'debug-menu';
  panel.innerHTML = `
    <style>
      #debug-menu {
        position: fixed; top: 50px; right: 8px; z-index: 50;
        background: #0a1a20ee; border: 1px solid #1a3a3f; border-radius: 6px;
        padding: 8px 10px; font-family: var(--font-body); font-size: 11px;
        color: #3aada8; display: flex; flex-direction: column; gap: 6px;
        max-width: 200px;
      }
      #debug-menu summary {
        cursor: pointer; font-size: 12px; font-weight: 600; color: #7eeee4; user-select: none;
      }
      #debug-menu button {
        background: #0d2228; border: 1px solid #1a3a3f; border-radius: 3px;
        color: #3aada8; font-family: inherit; font-size: 10px; padding: 4px 6px;
        cursor: pointer; text-align: left;
      }
      #debug-menu button:hover { border-color: #3aada8; color: #7eeee4; }
      #debug-menu .debug-row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
      #debug-menu .debug-section { margin-top: 4px; color: #1a3a3f; font-size: 9px; text-transform: uppercase; }
      #debug-menu select {
        background: #0d2228; border: 1px solid #1a3a3f; border-radius: 3px;
        color: #3aada8; font-family: inherit; font-size: 10px; padding: 3px 4px;
        cursor: pointer; flex: 1; min-width: 0;
      }
      #debug-menu select:hover { border-color: #3aada8; }
    </style>
    <details open>
      <summary>DEBUG</summary>
      <div class="debug-section">Resources</div>
      <div class="debug-row">
        <button data-action="add-plankton">+1k Plankton 🟢</button>
        <button data-action="add-minerite">+100 Minerite 🔵</button>
      </div>
      <div class="debug-row">
        <button data-action="add-lux">+50 Lux ✨</button>
        <button data-action="add-coral">+50 Coral 🪸</button>
      </div>
      <div class="debug-row">
        <button data-action="max-resources">Max All Resources</button>
      </div>
      <div class="debug-section">Tide &amp; Collectibles</div>
      <div class="debug-row">
        <button data-action="force-tide">Force Tide</button>
        <button data-action="spawn-coral">Spawn Coral</button>
      </div>
      <div class="debug-section">Spawn Creature</div>
      <div class="debug-row">
        <select id="dbg-type">
          <option value="">Random</option>
        </select>
        <select id="dbg-rare">
          <option value="">Random</option>
          <option value="none">None</option>
        </select>
      </div>
      <div class="debug-row">
        <button data-action="spawn">Spawn → Shore</button>
      </div>
      <div class="debug-section">Grid</div>
      <div class="debug-row">
        <button data-action="reset-grid">Reset Grid</button>
        <button data-action="reset-all">Reset All</button>
      </div>
    </details>
  `;

  document.body.appendChild(panel);

  // Populate type dropdown dynamically from CreatureType enum
  const typeSelect = panel.querySelector('#dbg-type') as HTMLSelectElement;
  for (const t of Object.values(CreatureType)) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = CREATURE_NAMES[t];
    typeSelect.appendChild(opt);
  }

  // Populate rare dropdown dynamically from RARE_EFFECTS registry
  const rareSelect = panel.querySelector('#dbg-rare') as HTMLSelectElement;
  for (const eff of RARE_EFFECTS) {
    if (eff.id === 'none') continue; // already added as static option
    const opt = document.createElement('option');
    opt.value = eff.id;
    opt.textContent = `${eff.icon} ${eff.label}`;
    rareSelect.appendChild(opt);
  }

  panel.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;

    switch (action) {
      case 'add-plankton':
        state.resources.plankton += 1000;
        break;
      case 'add-minerite':
        state.resources.minerite += 100;
        break;
      case 'add-lux':
        state.resources.lux += 50;
        break;
      case 'add-coral':
        state.resources.coral += 50;
        break;
      case 'max-resources':
        state.resources.plankton += 999999;
        state.resources.minerite += 99999;
        state.resources.lux += 9999;
        state.resources.coral += 9999;
        break;
      case 'spawn-coral':
        onSpawnCoral?.();
        break;
      case 'force-tide':
        forceTide(state);
        break;
      case 'spawn': {
        const typeSelect = panel.querySelector('#dbg-type') as HTMLSelectElement;
        const typeVal = typeSelect.value;
        const rareVal = rareSelect.value;
        const type = typeVal ? (typeVal as CreatureType) : undefined;
        const rare: RareEffect | null | undefined =
          rareVal === '' ? undefined :        // random
          rareVal === 'none' ? null :         // force no rare
          (rareVal as RareEffect);            // specific rare
        const creature = createCreature({ type, forceRare: rare });
        state.creatures.push(creature);
        state.shore.push(creature);
        break;
      }
      case 'reset-grid': {
        // Reset pool to default seabed layout, remove creatures from slots
        const def = createDefaultState();
        state.pool = def.pool;
        // Remove placed creatures (keep shore)
        state.creatures = state.creatures.filter((c) =>
          state.shore.some((s) => s.id === c.id)
        );
        break;
      }
      case 'reset-all':
        disableSaving();
        clearSave();
        onReset();
        return;
    }

    onStateChange();
  });

  return () => {
    panel.remove();
  };
}
