import type { GameState, ResourceBundle } from '../core/game-state';
import { UPGRADES, getUpgradeLevel, purchaseUpgrade, getUpgradeCostResource } from '../systems/upgrades';
import { createModal } from './modal';

const RESOURCE_ICONS: Record<keyof ResourceBundle, string> = {
  plankton: '🟢',
  minerite: '🔵',
  lux: '✨',
  nacre: '⚬',
  coral: '🪸',
};

let stateRef: GameState | null = null;
let onPurchaseCb: (() => void) | null = null;

const controller = createModal({
  id: 'upgrade',
  width: '420px',
  render: (panel, signal) => {
    injectStyles();
    if (!stateRef) return;
    renderContent(panel, stateRef, signal);
  },
});

export function openUpgradeModal(state: GameState): void {
  stateRef = state;
  controller.open();
}

export function closeUpgradeModal(): void {
  controller.close();
}

export function updateUpgradeModal(state: GameState): void {
  if (!controller.isOpen) return;
  stateRef = state;
  updateBuyButtons(state);
}

export function isUpgradeModalOpen(): boolean {
  return controller.isOpen;
}

export function setOnUpgradePurchase(cb: () => void): void {
  onPurchaseCb = cb;
}

export function destroyUpgradeModal(): void {
  controller.destroy();
  document.getElementById('upgrade-modal-styles')?.remove();
}

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

function renderContent(modal: HTMLElement, state: GameState, signal: AbortSignal): void {
  // Sort: affordable (not maxed) first, then unaffordable (not maxed), then maxed.
  // Within each bucket preserve UPGRADES declaration order.
  const bucketed = UPGRADES.map((def) => {
    const level = getUpgradeLevel(state, def.id);
    const isMaxed = level >= def.maxLevel;
    const cost = isMaxed ? 0 : def.costFn(level);
    const resource = getUpgradeCostResource(def);
    const affordable = state.resources[resource] >= cost;
    const bucket = isMaxed ? 2 : affordable ? 0 : 1;
    return { def, level, isMaxed, cost, resource, affordable, bucket };
  }).sort((a, b) => a.bucket - b.bucket);

  let cardsHtml = '';
  for (const { def, level, isMaxed, cost, resource, affordable } of bucketed) {
    const costIcon = RESOURCE_ICONS[resource];

    const levelStr = isMaxed
      ? '<span class="upgrade-max">MAX</span>'
      : `Lv ${level}/${def.maxLevel}`;

    const buttonHtml = isMaxed
      ? '<span class="upgrade-purchased">Purchased</span>'
      : `<button class="btn btn-secondary btn-sm upgrade-buy-btn${affordable ? '' : ' unaffordable'}" data-id="${def.id}">${cost} ${costIcon}</button>`;

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

  document.getElementById('upgrade-close-btn')!.addEventListener(
    'click',
    () => controller.close(),
    { signal },
  );

  modal.querySelectorAll('.upgrade-buy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!stateRef) return;
      const id = (btn as HTMLElement).dataset.id!;
      if (purchaseUpgrade(stateRef, id)) {
        controller.rerender();
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
    const resource = getUpgradeCostResource(def);
    const btn = modal.querySelector(`.upgrade-buy-btn[data-id="${def.id}"]`);
    if (btn) {
      btn.classList.toggle('unaffordable', state.resources[resource] < cost);
    }
  }
}

// ---------------------------------------------------------------------------
// Content-specific styles (frame/animation CSS is provided by modal.ts)
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('upgrade-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'upgrade-modal-styles';
  style.textContent = `
    .upgrade-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .upgrade-title { font-family: var(--font-display); font-size: 13px; color: var(--name); }

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
    .upgrade-name { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .upgrade-desc { font-size: 13px; color: var(--text-dim); }

    .upgrade-level {
      font-size: 12px; color: var(--text-dim);
      flex-shrink: 0; text-align: right;
      white-space: nowrap;
    }
    .upgrade-max {
      color: var(--accent);
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 1px;
    }

    .upgrade-card-bottom {
      margin-top: 8px;
      display: flex; justify-content: flex-end;
    }

    .upgrade-purchased {
      font-size: 13px;
      color: var(--accent);
      font-style: italic;
    }

    @media (max-width: 640px) {
      .upgrade-icon { font-size: 18px; }
      .upgrade-name { font-size: 14px; }
      .upgrade-desc { font-size: 12px; }
    }
  `;
  document.head.appendChild(style);
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => destroyUpgradeModal());
}
