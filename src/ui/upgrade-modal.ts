import type { GameState, UpgradeType } from '../core/game-state';
import { UPGRADE_DEFS, getAvailableUpgrades, canInstallUpgrade } from '../economy/upgrades';

let overlayEl: HTMLDivElement | null = null;
let modalEl: HTMLDivElement | null = null;
let isOpen = false;

let _onInstall: ((type: UpgradeType) => void) | null = null;

function injectStyles(): void {
  if (document.getElementById('upgrade-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'upgrade-modal-styles';
  style.textContent = `
    #upgrade-overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(4, 10, 14, 0.7);
      opacity: 0; pointer-events: none;
      transition: opacity 0.2s ease;
      display: flex; align-items: center; justify-content: center;
    }
    #upgrade-overlay.open {
      opacity: 1; pointer-events: auto;
    }

    #upgrade-modal {
      background: #0a1a20;
      border: 1px solid #1a3a3f;
      border-radius: 8px;
      font-family: 'Press Start 2P', monospace;
      color: #b8d4d8;
      width: 300px;
      max-width: 90vw;
      transform: scale(0.9);
      transition: transform 0.2s ease;
    }
    #upgrade-overlay.open #upgrade-modal {
      transform: scale(1);
    }

    #upgrade-modal .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #1a3a3f;
    }
    #upgrade-modal .modal-title {
      font-size: 9px; color: #7eeee4;
    }
    #upgrade-modal .modal-close {
      background: none; border: none; color: #5a8a8f;
      font-family: 'Press Start 2P', monospace; font-size: 12px;
      cursor: pointer; padding: 4px 8px;
      transition: color 0.15s;
    }
    #upgrade-modal .modal-close:hover { color: #7eeee4; }

    #upgrade-modal .modal-body {
      padding: 12px 16px;
      display: flex; flex-direction: column; gap: 10px;
    }

    #upgrade-modal .upgrade-item {
      background: #0d2228;
      border: 1px solid #1a3a3f;
      border-radius: 6px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    #upgrade-modal .upgrade-item:hover:not(.disabled) {
      border-color: #3aada8;
      background: #112a30;
    }
    #upgrade-modal .upgrade-item.disabled {
      opacity: 0.4; cursor: not-allowed;
    }
    #upgrade-modal .upgrade-name {
      font-size: 8px; color: #dadaff; margin-bottom: 6px;
    }
    #upgrade-modal .upgrade-desc {
      font-size: 7px; color: #5a8a8f; margin-bottom: 6px; line-height: 1.6;
    }
    #upgrade-modal .upgrade-cost {
      font-size: 7px; color: #3aada8;
    }
  `;
  document.head.appendChild(style);
}

function ensureModal(): { overlay: HTMLDivElement; modal: HTMLDivElement } {
  if (overlayEl && modalEl) return { overlay: overlayEl, modal: modalEl };

  injectStyles();

  overlayEl = document.createElement('div');
  overlayEl.id = 'upgrade-overlay';
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) hideUpgradeModal();
  });
  document.body.appendChild(overlayEl);

  modalEl = document.createElement('div');
  modalEl.id = 'upgrade-modal';
  overlayEl.appendChild(modalEl);

  return { overlay: overlayEl, modal: modalEl };
}

export function showUpgradeModal(
  state: GameState,
  nodeR: number,
  nodeC: number,
  onInstall: (type: UpgradeType) => void,
): void {
  const { overlay, modal } = ensureModal();
  _onInstall = onInstall;

  const upgrades = getAvailableUpgrades();

  let html = `
    <div class="modal-header">
      <span class="modal-title">UPGRADE NODE</span>
      <button class="modal-close" id="upgrade-close-btn">\u2715</button>
    </div>
    <div class="modal-body">
  `;

  for (const type of upgrades) {
    const def = UPGRADE_DEFS[type];
    const canAfford = canInstallUpgrade(state, nodeR, nodeC, type);
    const disabledClass = canAfford ? '' : 'disabled';

    let costStr = '';
    if (def.cost.plankton > 0) costStr += `${def.cost.plankton}\u{1F7E2} `;
    if (def.cost.minerite > 0) costStr += `${def.cost.minerite}\u{1F535} `;
    if (def.cost.lux > 0) costStr += `${def.cost.lux}\u2728 `;

    html += `
      <div class="upgrade-item ${disabledClass}" data-type="${type}">
        <div class="upgrade-name">${def.label.toUpperCase()}</div>
        <div class="upgrade-desc">${def.description}</div>
        <div class="upgrade-cost">${costStr.trim()}</div>
      </div>
    `;
  }

  html += '</div>';
  modal.innerHTML = html;

  // Close button
  document.getElementById('upgrade-close-btn')!.addEventListener('click', () => hideUpgradeModal());

  // Upgrade item clicks
  const items = modal.querySelectorAll('.upgrade-item:not(.disabled)');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      const type = (item as HTMLElement).dataset.type as UpgradeType;
      _onInstall?.(type);
      hideUpgradeModal();
    });
  });

  // Open with animation
  requestAnimationFrame(() => {
    overlay.classList.add('open');
  });
  isOpen = true;
}

export function hideUpgradeModal(): void {
  if (!isOpen) return;
  if (overlayEl) overlayEl.classList.remove('open');
  isOpen = false;
  _onInstall = null;
}
