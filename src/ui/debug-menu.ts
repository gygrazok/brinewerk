import type { GameState } from '../core/game-state';
import { createDefaultState, clearSave } from '../core/game-state';

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
        position: fixed; top: 8px; right: 8px; z-index: 9999;
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
      #debug-menu .debug-row { display: flex; gap: 4px; flex-wrap: wrap; }
      #debug-menu .debug-section { margin-top: 4px; color: #1a3a3f; font-size: 7px; }
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
      <div class="debug-section">Grid</div>
      <div class="debug-row">
        <button data-action="reset-grid">Reset Grid</button>
        <button data-action="reset-all">Reset All</button>
      </div>
    </details>
  `;

  document.body.appendChild(panel);

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
      case 'reset-grid': {
        // Reset pool to single slot, remove creatures from pool
        const def = createDefaultState();
        state.pool = def.pool;
        state.upgradeNodes = [];
        // Remove placed creatures (keep shore)
        state.creatures = state.creatures.filter((c) =>
          state.shore.some((s) => s.id === c.id)
        );
        break;
      }
      case 'reset-all':
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
