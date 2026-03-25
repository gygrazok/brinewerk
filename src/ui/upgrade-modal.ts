import type { GameState } from '../core/game-state';
import { UPGRADES, getUpgradeLevel, purchaseUpgrade } from '../systems/upgrades';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let modalOpen = false;
let stateRef: GameState | null = null;
let modalAbort: AbortController | null = null;
let onPurchaseCb: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function openUpgradeModal(state: GameState): void {
  if (modalOpen) return;
  stateRef = state;
  modalOpen = true;

  modalAbort?.abort();
  modalAbort = new AbortController();
  const { signal } = modalAbort;

  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'upgrade-overlay';
  overlay.addEventListener('click', () => closeUpgradeModal(), { signal });
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'upgrade-modal';
  modal.addEventListener('click', (e) => e.stopPropagation(), { signal });
  document.body.appendChild(modal);

  renderContent(state);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    modal.classList.add('open');
  });
}

export function closeUpgradeModal(): void {
  if (!modalOpen) return;
  modalOpen = false;
  modalAbort?.abort();
  modalAbort = null;

  const overlay = document.getElementById('upgrade-overlay');
  const modal = document.getElementById('upgrade-modal');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
  }
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  }
}

export function updateUpgradeModal(state: GameState): void {
  if (!modalOpen) return;
  stateRef = state;
  updateBuyButtons(state);
}

export function isUpgradeModalOpen(): boolean {
  return modalOpen;
}

export function setOnUpgradePurchase(cb: () => void): void {
  onPurchaseCb = cb;
}

export function destroyUpgradeModal(): void {
  closeUpgradeModal();
  const styles = document.getElementById('upgrade-modal-styles');
  if (styles) styles.remove();
}

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

function renderContent(state: GameState): void {
  const modal = document.getElementById('upgrade-modal');
  if (!modal) return;

  const signal = modalAbort?.signal;

  let cardsHtml = '';
  for (const def of UPGRADES) {
    const level = getUpgradeLevel(state, def.id);
    const isMaxed = level >= def.maxLevel;
    const cost = isMaxed ? 0 : def.costFn(level);
    const affordable = state.resources.plankton >= cost;

    const levelStr = isMaxed
      ? '<span class="upgrade-max">MAX</span>'
      : `Lv ${level}/${def.maxLevel}`;

    const buttonHtml = isMaxed
      ? '<span class="upgrade-purchased">Purchased</span>'
      : `<button class="btn btn-secondary btn-sm upgrade-buy-btn${affordable ? '' : ' unaffordable'}" data-id="${def.id}">${cost} 🟢</button>`;

    cardsHtml += `
      <div class="upgrade-card${isMaxed ? ' maxed' : ''}" data-id="${def.id}">
        <div class="upgrade-card-top">
          <span class="upgrade-icon">${def.icon}</span>
          <div class="upgrade-info">
            <div class="upgrade-name">${def.name}</div>
            <div class="upgrade-desc">${def.description}</div>
          </div>
          <div class="upgrade-level">${levelStr}</div>
        </div>
        <div class="upgrade-card-bottom">
          ${buttonHtml}
        </div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="upgrade-header">
      <span class="upgrade-title">⬆ Upgrades</span>
      <button class="btn btn-ghost upgrade-close" id="upgrade-close-btn">✕</button>
    </div>
    <div class="upgrade-list">
      ${cardsHtml}
    </div>
  `;

  // Close button
  document.getElementById('upgrade-close-btn')!.addEventListener('click', () => closeUpgradeModal(), { signal });

  // Buy buttons
  modal.querySelectorAll('.upgrade-buy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!stateRef) return;
      const id = (btn as HTMLElement).dataset.id!;
      if (purchaseUpgrade(stateRef, id)) {
        renderContent(stateRef);
        onPurchaseCb?.();
      }
    }, { signal });
  });
}

function updateBuyButtons(state: GameState): void {
  const modal = document.getElementById('upgrade-modal');
  if (!modal) return;

  for (const def of UPGRADES) {
    const level = getUpgradeLevel(state, def.id);
    if (level >= def.maxLevel) continue;
    const cost = def.costFn(level);
    const btn = modal.querySelector(`.upgrade-buy-btn[data-id="${def.id}"]`);
    if (btn) {
      btn.classList.toggle('unaffordable', state.resources.plankton < cost);
    }
  }
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('upgrade-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'upgrade-modal-styles';
  style.textContent = `
    /* Overlay */
    #upgrade-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(4, 10, 14, 0.7);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #upgrade-overlay.open { opacity: 1; pointer-events: auto; }

    /* Modal */
    #upgrade-modal {
      position: fixed; z-index: 101;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      font-family: var(--font-body);
      color: var(--text);
      display: flex; flex-direction: column;
      overflow-y: auto;
    }
    @media (min-width: 641px) {
      #upgrade-modal {
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        opacity: 0;
        width: 420px;
        max-height: 85vh;
        border-radius: 10px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      }
      #upgrade-modal.open { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @media (max-width: 640px) {
      #upgrade-modal {
        left: 0; right: 0; bottom: 0;
        max-height: 85vh;
        border-radius: 12px 12px 0 0;
        border-bottom: none;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #upgrade-modal.open { transform: translateY(0); }
    }

    .upgrade-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .upgrade-title { font-family: var(--font-display); font-size: 11px; color: var(--name); }

    .upgrade-list {
      padding: 12px 16px;
      display: flex; flex-direction: column; gap: 10px;
      overflow-y: auto;
    }

    .upgrade-card {
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      transition: border-color 0.15s;
    }
    .upgrade-card:hover:not(.maxed) { border-color: var(--accent); }
    .upgrade-card.maxed { opacity: 0.6; }

    .upgrade-card-top {
      display: flex; align-items: flex-start; gap: 10px;
    }

    .upgrade-icon { font-size: 20px; flex-shrink: 0; line-height: 1; }

    .upgrade-info { flex: 1; min-width: 0; }
    .upgrade-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .upgrade-desc { font-size: 11px; color: var(--text-dim); }

    .upgrade-level {
      font-size: 10px; color: var(--text-dim);
      flex-shrink: 0; text-align: right;
      white-space: nowrap;
    }
    .upgrade-max {
      color: var(--accent);
      font-weight: 700;
      font-size: 10px;
      letter-spacing: 1px;
    }

    .upgrade-card-bottom {
      margin-top: 8px;
      display: flex; justify-content: flex-end;
    }

    .upgrade-purchased {
      font-size: 11px;
      color: var(--accent);
      font-style: italic;
    }

    @media (max-width: 640px) {
      .upgrade-icon { font-size: 18px; }
      .upgrade-name { font-size: 12px; }
      .upgrade-desc { font-size: 10px; }
    }
  `;
  document.head.appendChild(style);
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => destroyUpgradeModal());
}
