import type { GameState } from '../core/game-state';
import { createDefaultState, clearSave } from '../core/game-state';
import { disableSaving } from '../core/game-loop';
import { forceTide } from '../systems/tides';
import { createCreature, RARE_EFFECTS, type RareEffect } from '../creatures/creature';
import { CreatureType } from '../creatures/types';

/** Inject a floating debug menu (dev only). Returns cleanup function. */
export function initDebugMenu(
  state: GameState,
  onStateChange: () => void,
  onReset: () => void,
): () => void {
  const panel = document.createElement('div');
  panel.id = 'debug-menu';
  panel.innerHTML = `
    <style>
      #debug-menu {
        position: fixed; top: 50px; right: 8px; z-index: 50;
        background: #0a1a20ee; border: 1px solid #1a3a3f; border-radius: 6px;
        padding: 8px 10px; font-family: 'Press Start 2P', monospace; font-size: 8px;
        color: #3aada8; display: flex; flex-direction: column; gap: 6px;
        max-width: 200px;
      }
      #debug-menu summary {
        cursor: pointer; font-size: 9px; color: #7eeee4; user-select: none;
      }
      #debug-menu button {
        background: #0d2228; border: 1px solid #1a3a3f; border-radius: 3px;
        color: #3aada8; font-family: inherit; font-size: 7px; padding: 4px 6px;
        cursor: pointer; text-align: left;
      }
      #debug-menu button:hover { border-color: #3aada8; color: #7eeee4; }
      #debug-menu .debug-row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
      #debug-menu .debug-section { margin-top: 4px; color: #1a3a3f; font-size: 7px; }
      #debug-menu select {
        background: #0d2228; border: 1px solid #1a3a3f; border-radius: 3px;
        color: #3aada8; font-family: inherit; font-size: 7px; padding: 3px 4px;
        cursor: pointer; flex: 1; min-width: 0;
      }
      #debug-menu select:hover { border-color: #3aada8; }
    </style>
    <details open>
      <summary>DEBUG</summary>
      <div class="debug-section">Resources</div>
      <div class="debug-row">
        <button data-action="add-plankton">+1000 🟢</button>
        <button data-action="add-minerite">+100 🔵</button>
        <button data-action="add-lux">+50 ✨</button>
      </div>
      <div class="debug-row">
        <button data-action="max-resources">Max All</button>
      </div>
      <div class="debug-section">Tide</div>
      <div class="debug-row">
        <button data-action="force-tide">Force Tide</button>
      </div>
      <div class="debug-section">Spawn</div>
      <div class="debug-row">
        <select id="dbg-type">
          <option value="">Random</option>
          <option value="stellarid">Stellarid</option>
          <option value="blobid">Blobid</option>
          <option value="corallid">Corallid</option>
          <option value="nucleid">Nucleid</option>
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
      case 'max-resources':
        state.resources.plankton += 999999;
        state.resources.minerite += 99999;
        state.resources.lux += 9999;
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
        const creature = createCreature(type, undefined, rare);
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
