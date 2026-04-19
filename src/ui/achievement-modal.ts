import type { GameState } from '../core/game-state';
import { ACHIEVEMENTS } from '../systems/achievements';
import { createModal } from './modal';

let stateRef: GameState | null = null;

const controller = createModal({
  id: 'ach',
  width: '460px',
  render: (panel, signal) => {
    injectStyles();
    if (!stateRef) return;
    renderContent(panel, stateRef, signal);
  },
});

export function openAchievementModal(state: GameState): void {
  stateRef = state;
  controller.open();
}

export function closeAchievementModal(): void {
  controller.close();
}

export function updateAchievementModal(state: GameState): void {
  if (!controller.isOpen) return;
  stateRef = state;
  controller.rerender();
}

export function isAchievementModalOpen(): boolean {
  return controller.isOpen;
}

export function destroyAchievementModal(): void {
  controller.destroy();
  document.getElementById('ach-modal-styles')?.remove();
}

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

function renderContent(modal: HTMLElement, state: GameState, signal: AbortSignal): void {
  const completed = Object.values(state.achievements).filter(Boolean).length;

  let cardsHtml = '';
  for (const def of ACHIEVEMENTS) {
    const done = state.achievements[def.id] === true;
    cardsHtml += `
      <div class="ach-card${done ? ' completed' : ''}">
        <span class="ach-icon">${def.icon}</span>
        <div class="ach-info">
          <div class="ach-name">${def.name}</div>
          <div class="ach-desc">${def.description}</div>
          <div class="ach-reward">${done ? '✓' : '▸'} ${def.reward.label}</div>
        </div>
        ${done ? '<span class="ach-check">✓</span>' : ''}
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="ach-header">
      <span class="ach-title">🏆 Achievements</span>
      <span class="ach-count">${completed}/${ACHIEVEMENTS.length}</span>
      <button class="btn btn-ghost" id="ach-close-btn">✕</button>
    </div>
    <div class="ach-list">
      ${cardsHtml}
    </div>
  `;

  document.getElementById('ach-close-btn')!.addEventListener(
    'click',
    () => controller.close(),
    { signal },
  );
}

// ---------------------------------------------------------------------------
// Content-specific styles (frame/animation CSS is provided by modal.ts)
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('ach-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'ach-modal-styles';
  style.textContent = `
    .ach-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      gap: 8px;
    }
    .ach-title { font-family: var(--font-display); font-size: 13px; color: var(--name); flex: 1; }
    .ach-count { font-size: 13px; color: var(--text-dim); }

    .ach-list {
      padding: 12px 16px;
      display: flex; flex-direction: column; gap: 10px;
      overflow-y: auto;
    }

    .ach-card {
      display: flex; align-items: flex-start; gap: 12px;
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px;
      opacity: 0.5;
      transition: border-color 0.15s, opacity 0.15s;
    }
    .ach-card.completed {
      opacity: 1;
      border-color: var(--accent);
    }

    .ach-icon { font-size: 24px; flex-shrink: 0; line-height: 1; }

    .ach-info { flex: 1; min-width: 0; }
    .ach-name { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .ach-desc { font-size: 13px; color: var(--text-dim); margin-bottom: 4px; }
    .ach-reward { font-size: 12px; color: var(--accent); }
    .ach-card.completed .ach-reward { color: var(--accent-hi); }

    .ach-check {
      font-size: 18px;
      color: var(--accent-hi);
      flex-shrink: 0;
      line-height: 1;
    }

    @media (max-width: 640px) {
      .ach-icon { font-size: 20px; }
      .ach-name { font-size: 14px; }
      .ach-desc { font-size: 12px; }
      .ach-reward { font-size: 11px; }
    }
  `;
  document.head.appendChild(style);
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => destroyAchievementModal());
}
