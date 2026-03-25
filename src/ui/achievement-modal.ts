import type { GameState } from '../core/game-state';
import { ACHIEVEMENTS } from '../systems/achievements';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let modalOpen = false;
let modalAbort: AbortController | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function openAchievementModal(state: GameState): void {
  if (modalOpen) return;
  modalOpen = true;

  modalAbort?.abort();
  modalAbort = new AbortController();
  const { signal } = modalAbort;

  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'ach-overlay';
  overlay.addEventListener('click', () => closeAchievementModal(), { signal });
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'ach-modal';
  modal.addEventListener('click', (e) => e.stopPropagation(), { signal });
  document.body.appendChild(modal);

  renderContent(state);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    modal.classList.add('open');
  });
}

export function closeAchievementModal(): void {
  if (!modalOpen) return;
  modalOpen = false;
  modalAbort?.abort();
  modalAbort = null;

  const overlay = document.getElementById('ach-overlay');
  const modal = document.getElementById('ach-modal');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
  }
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  }
}

export function updateAchievementModal(state: GameState): void {
  if (!modalOpen) return;
  renderContent(state);
}

export function isAchievementModalOpen(): boolean {
  return modalOpen;
}

export function destroyAchievementModal(): void {
  closeAchievementModal();
  const styles = document.getElementById('ach-modal-styles');
  if (styles) styles.remove();
}

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

function renderContent(state: GameState): void {
  const modal = document.getElementById('ach-modal');
  if (!modal) return;

  const signal = modalAbort?.signal;

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

  document.getElementById('ach-close-btn')!.addEventListener('click', () => closeAchievementModal(), { signal });
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('ach-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'ach-modal-styles';
  style.textContent = `
    /* Overlay */
    #ach-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(4, 10, 14, 0.7);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #ach-overlay.open { opacity: 1; pointer-events: auto; }

    /* Modal */
    #ach-modal {
      position: fixed; z-index: 101;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      font-family: var(--font-body);
      color: var(--text);
      display: flex; flex-direction: column;
      overflow-y: auto;
    }
    @media (min-width: 641px) {
      #ach-modal {
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        opacity: 0;
        width: 460px;
        max-height: 85vh;
        border-radius: 10px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      }
      #ach-modal.open { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @media (max-width: 640px) {
      #ach-modal {
        left: 0; right: 0; bottom: 0;
        max-height: 85vh;
        border-radius: 12px 12px 0 0;
        border-bottom: none;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #ach-modal.open { transform: translateY(0); }
    }

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
