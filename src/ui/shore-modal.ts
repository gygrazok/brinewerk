import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_NAMES, CREATURE_ICONS } from '../creatures/types';
import { getDisplayTraits, TRAIT_COLORS } from '../genetics/traits';
import { createCreaturePreviewApp, type CreaturePreviewApp } from '../rendering/creature-preview';
import { findEmptySlot } from '../systems/pool';
import {
  SHORE_REFRESH_COST, SHORE_RARE_REFRESH_COST,
} from '../core/balance';
import {
  pickUpCreature, refreshShore, rareRefreshShore, flushTide,
  getTideTimeRemaining, isTideReady,
} from '../systems/tides';
import { openUpgradeModal } from './upgrade-modal';
import { openAchievementModal } from './achievement-modal';
import { getCompletedCount, getTotalCount } from '../systems/achievements';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let modalOpen = false;
let selectedIndex: number | null = null;
let onTakeCreatureCb: ((creature: Creature) => void) | null = null;
let stateRef: GameState | null = null;
let mounted = false;
/** Track last known tide timestamp to detect new tide arrivals */
let lastKnownTideTimestamp = 0;
/** Active PixiJS creature previews */
let activePreviews: CreaturePreviewApp[] = [];
/** AbortController for modal event listeners — aborted on close/destroy */
let modalAbort: AbortController | null = null;

function destroyPreviews(): void {
  for (const p of activePreviews) p.destroy();
  activePreviews = [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setOnTakeCreature(cb: (creature: Creature) => void): void {
  onTakeCreatureCb = cb;
}

export function isShoreModalOpen(): boolean {
  return modalOpen;
}

/** Update the always-visible shore button at the bottom of the screen. */
export function renderShoreButton(state: GameState): void {
  stateRef = state;
  injectStyles();
  const bar = document.getElementById('bottom-bar');
  if (!bar) return;

  if (!mounted) {
    bar.innerHTML = `
      <button id="shore-btn" class="btn btn-secondary"></button>
      <button id="upgrades-btn" class="btn btn-secondary">⬆ Upgrades</button>
      <button id="achievements-btn" class="btn btn-secondary">🏆</button>
    `;
    document.getElementById('shore-btn')!.addEventListener('click', () => {
      if (stateRef) openShoreModal(stateRef);
    });
    document.getElementById('upgrades-btn')!.addEventListener('click', () => {
      if (stateRef) openUpgradeModal(stateRef);
    });
    document.getElementById('achievements-btn')!.addEventListener('click', () => {
      if (stateRef) openAchievementModal(stateRef);
    });
    mounted = true;
  }

  const btn = document.getElementById('shore-btn');
  if (!btn) return;

  if (!state.shoreTaken && state.shore.length > 0) {
    btn.innerHTML = `<span class="shore-btn-icon">🌊</span> Shore (${state.shore.length})`;
    btn.classList.add('btn-pulse');
  } else {
    const remaining = getTideTimeRemaining(state);
    const min = Math.floor(remaining / 60);
    const sec = Math.floor(remaining % 60);
    const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
    btn.innerHTML = `<span class="shore-btn-icon">🌊</span> ${remaining <= 0 ? 'Tide ready!' : timeStr}`;
    btn.classList.remove('btn-pulse');
  }

  // Update achievements badge
  const achBtn = document.getElementById('achievements-btn');
  if (achBtn) {
    const done = getCompletedCount(state);
    const total = getTotalCount();
    achBtn.textContent = `🏆 ${done}/${total}`;
  }
}

/** Update modal contents if open (called every ~1s from game loop). */
export function updateShoreModal(state: GameState): void {
  if (!modalOpen) return;
  stateRef = state;

  // Detect new tide arrival (timestamp changed since we last rendered)
  if (state.lastTideTimestamp !== lastKnownTideTimestamp) {
    lastKnownTideTimestamp = state.lastTideTimestamp;
    selectedIndex = null;
    renderModalContent(state);
    return;
  }

  // Update timer and button states
  updateTimer(state);
  updateRefreshButtons(state);
  updateTakeButton(state);
}

/** Destroy all modal DOM for HMR cleanup. */
export function destroyShoreModal(): void {
  destroyPreviews();
  closeShoreModal();
  const styles = document.getElementById('shore-modal-styles');
  if (styles) styles.remove();
  mounted = false;
  const bar = document.getElementById('bottom-bar');
  if (bar) bar.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Modal open / close
// ---------------------------------------------------------------------------

export function openShoreModal(state: GameState): void {
  if (modalOpen) return;
  stateRef = state;
  selectedIndex = null;
  modalOpen = true;
  lastKnownTideTimestamp = state.lastTideTimestamp;

  // Abort any previous listeners
  modalAbort?.abort();
  modalAbort = new AbortController();
  const { signal } = modalAbort;

  injectStyles();

  const overlay = document.createElement('div');
  overlay.id = 'shore-overlay';
  overlay.addEventListener('click', () => closeShoreModal(), { signal });
  document.body.appendChild(overlay);

  const modal = document.createElement('div');
  modal.id = 'shore-modal';
  modal.addEventListener('click', (e) => e.stopPropagation(), { signal });
  document.body.appendChild(modal);

  renderModalContent(state);

  requestAnimationFrame(() => {
    overlay.classList.add('open');
    modal.classList.add('open');
  });
}

export function closeShoreModal(): void {
  if (!modalOpen) return;
  modalOpen = false;
  selectedIndex = null;
  modalAbort?.abort();
  modalAbort = null;
  destroyPreviews();

  const overlay = document.getElementById('shore-overlay');
  const modal = document.getElementById('shore-modal');
  if (overlay) {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 250);
  }
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 300);
  }
}

// ---------------------------------------------------------------------------
// Modal content rendering
// ---------------------------------------------------------------------------

function renderModalContent(state: GameState): void {
  const modal = document.getElementById('shore-modal');
  if (!modal) return;

  modal.innerHTML = `
    <div class="shore-header">
      <span class="shore-title">🌊 Shore</span>
      <button class="btn btn-ghost shore-close" id="shore-close-btn">✕</button>
    </div>
    <div class="shore-timer" id="shore-timer"></div>
    <div class="shore-actions" id="shore-actions">
      <button class="btn btn-secondary shore-action-btn" id="shore-refresh">Refresh<br><span class="btn-cost">${SHORE_REFRESH_COST} 🟢</span></button>
      <button class="btn btn-secondary btn-rare shore-action-btn" id="shore-rare-refresh">Rare Refresh<br><span class="btn-cost">${SHORE_RARE_REFRESH_COST} 🪸</span></button>
    </div>
    <div class="shore-creatures" id="shore-creatures"></div>
    <div class="shore-stats" id="shore-stats"></div>
    <div class="shore-take-area" id="shore-take-area">
      <button class="btn btn-primary shore-take-btn disabled" id="shore-take-btn">Select a creature</button>
    </div>
  `;

  const signal = modalAbort?.signal;

  // Close button
  document.getElementById('shore-close-btn')!.addEventListener('click', () => closeShoreModal(), { signal });

  // Refresh buttons
  document.getElementById('shore-refresh')!.addEventListener('click', () => {
    if (!stateRef) return;
    if (refreshShore(stateRef)) {
      selectedIndex = null;
      renderModalContent(stateRef);
      renderShoreButton(stateRef);
    }
  }, { signal });
  document.getElementById('shore-rare-refresh')!.addEventListener('click', () => {
    if (!stateRef) return;
    if (rareRefreshShore(stateRef)) {
      selectedIndex = null;
      renderModalContent(stateRef);
      renderShoreButton(stateRef);
    }
  }, { signal });

  // Take button
  document.getElementById('shore-take-btn')!.addEventListener('click', () => {
    if (selectedIndex === null || !stateRef) return;
    const creature = pickUpCreature(stateRef, selectedIndex);
    if (creature) {
      closeShoreModal();
      renderShoreButton(stateRef);
      onTakeCreatureCb?.(creature);
    }
  }, { signal });

  renderCreatureCards(state);
  updateTimer(state);
  updateRefreshButtons(state);
  updateTakeButton(state);
}

// ---------------------------------------------------------------------------
// Creature cards with pixel art preview
// ---------------------------------------------------------------------------

function renderCreatureCards(state: GameState): void {
  const container = document.getElementById('shore-creatures');
  if (!container) return;

  if (state.shoreTaken || state.shore.length === 0) {
    container.innerHTML = '<div class="shore-empty-msg">Waiting for the next tide...</div>';
    renderStats(null);
    updateTakeButton(state);
    return;
  }

  // Only rebuild DOM + previews if cards haven't been created yet
  const needsBuild = container.childElementCount === 0
    || container.querySelector('.shore-empty-msg') !== null;

  if (needsBuild) {
    let html = '';
    for (let i = 0; i < state.shore.length; i++) {
      const c = state.shore[i];
      const rareInfo = c.rare ? getRareInfo(c.rare) : null;
      const rareBadge = rareInfo
        ? `<span class="shore-card-rare" style="color:${rareInfo.color}; border-color:${rareInfo.color}40; background:${rareInfo.color}15;">${rareInfo.icon} ${rareInfo.label}</span>`
        : '';

      html += `
        <div class="shore-creature-card" data-index="${i}">
          <div class="shore-card-preview" id="shore-preview-${i}"></div>
          <div class="shore-card-info">
            <div class="shore-card-name">${c.name}</div>
            <div class="shore-card-type">${CREATURE_ICONS[c.type]} ${CREATURE_NAMES[c.type]}</div>
            ${rareBadge}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;

    // Create PixiJS creature previews (with rare shader effects)
    destroyPreviews();
    const PREVIEW_SIZE = 120;
    for (let i = 0; i < state.shore.length; i++) {
      const previewEl = document.getElementById(`shore-preview-${i}`);
      if (previewEl) {
        createCreaturePreviewApp(state.shore[i], previewEl, PREVIEW_SIZE).then((preview) => {
          activePreviews.push(preview);
        });
      }
    }

    // Click handlers (use modal AbortController for cleanup)
    const signal = modalAbort?.signal;
    container.querySelectorAll('.shore-creature-card').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = parseInt((card as HTMLElement).dataset.index!, 10);
        selectedIndex = idx;
        updateSelection(state);
      }, { signal });
    });
  }

  updateSelection(state);
}

/** Update selection highlight, stats, and take button without rebuilding cards. */
function updateSelection(state: GameState): void {
  const container = document.getElementById('shore-creatures');
  if (container) {
    container.querySelectorAll('.shore-creature-card').forEach((card) => {
      const idx = parseInt((card as HTMLElement).dataset.index!, 10);
      const selected = idx === selectedIndex;
      const c = state.shore[idx];
      const rareInfo = c?.rare ? getRareInfo(c.rare) : null;

      card.classList.toggle('selected', selected);
      (card as HTMLElement).style.borderColor = selected
        ? (rareInfo ? rareInfo.color : 'var(--accent)')
        : '';
    });
  }

  renderStats(selectedIndex !== null ? state.shore[selectedIndex] : null);
  updateTakeButton(state);
}

// ---------------------------------------------------------------------------
// Stats panel (shown when a creature is selected)
// ---------------------------------------------------------------------------

function renderStats(creature: Creature | null): void {
  const statsEl = document.getElementById('shore-stats');
  if (!statsEl) return;

  if (!creature) {
    statsEl.innerHTML = '';
    return;
  }

  const traits = getDisplayTraits(creature.type);
  let html = '<div class="shore-stats-inner">';
  for (const trait of traits) {
    const val = creature.genes[trait as keyof typeof creature.genes] as number;
    const color = TRAIT_COLORS[trait] ?? '#3aada8';
    const pct = Math.round(val * 100);
    html += `
      <div class="shore-trait-row">
        <span class="shore-trait-label">${trait.toUpperCase()}</span>
        <div class="shore-trait-bar-bg">
          <div class="shore-trait-bar-fill" style="width:${pct}%; background:${color};"></div>
        </div>
        <span class="shore-trait-val">${pct}%</span>
      </div>
    `;
  }
  html += '</div>';
  statsEl.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Take button state
// ---------------------------------------------------------------------------

function updateTakeButton(state: GameState): void {
  const takeBtn = document.getElementById('shore-take-btn');
  if (!takeBtn) return;

  const noSlots = findEmptySlot(state) === null;

  if (state.shoreTaken || state.shore.length === 0) {
    takeBtn.classList.add('disabled');
    takeBtn.textContent = 'Select a creature';
  } else if (noSlots) {
    takeBtn.classList.add('disabled');
    takeBtn.textContent = 'No empty slots';
  } else if (selectedIndex !== null) {
    takeBtn.classList.remove('disabled');
    takeBtn.textContent = `Take ${state.shore[selectedIndex].name}`;
  } else {
    takeBtn.classList.add('disabled');
    takeBtn.textContent = 'Select a creature';
  }
}

// ---------------------------------------------------------------------------
// Timer & refresh buttons
// ---------------------------------------------------------------------------

function updateTimer(state: GameState): void {
  const timerEl = document.getElementById('shore-timer');
  if (!timerEl) return;

  const tideReady = isTideReady(state);

  if (tideReady && !state.shoreTaken && state.shore.length > 0) {
    timerEl.innerHTML = '<button class="btn btn-primary" id="tide-flush-btn">🌊 New Tide!</button>';
    document.getElementById('tide-flush-btn')!.addEventListener('click', () => {
      if (!stateRef) return;
      flushTide(stateRef);
      lastKnownTideTimestamp = stateRef.lastTideTimestamp;
      selectedIndex = null;
      renderModalContent(stateRef);
      renderShoreButton(stateRef);
    }, { signal: modalAbort?.signal });
  } else {
    const remaining = getTideTimeRemaining(state);
    if (remaining <= 0) {
      timerEl.innerHTML = '<span class="timer-label">Tide incoming...</span>';
    } else {
      const min = Math.floor(remaining / 60);
      const sec = Math.floor(remaining % 60);
      timerEl.innerHTML = `<span class="timer-label">Next tide</span> <span class="timer-value">${min}:${sec.toString().padStart(2, '0')}</span>`;
    }
  }
}

function updateRefreshButtons(state: GameState): void {
  const refreshBtn = document.getElementById('shore-refresh');
  const rareBtn = document.getElementById('shore-rare-refresh');
  if (refreshBtn) {
    refreshBtn.classList.toggle('unaffordable', state.resources.plankton < SHORE_REFRESH_COST);
  }
  if (rareBtn) {
    rareBtn.classList.toggle('unaffordable', state.resources.coral < SHORE_RARE_REFRESH_COST);
  }
}

// ---------------------------------------------------------------------------
// CSS injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('shore-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'shore-modal-styles';
  style.textContent = `

    /* Overlay */
    #shore-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(4, 10, 14, 0.7);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #shore-overlay.open { opacity: 1; pointer-events: auto; }

    /* Modal */
    #shore-modal {
      position: fixed; z-index: 101;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      font-family: var(--font-body);
      color: var(--text);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    @media (min-width: 641px) {
      #shore-modal {
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        opacity: 0;
        width: min(90vw, 800px);
        max-height: 85vh;
        border-radius: 10px;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
      }
      #shore-modal.open { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    @media (max-width: 640px) {
      #shore-modal {
        left: 0; right: 0; bottom: 0;
        max-height: 85vh;
        border-radius: 12px 12px 0 0;
        border-bottom: none;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #shore-modal.open { transform: translateY(0); }
    }

    .shore-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .shore-title { font-family: var(--font-display); font-size: 13px; color: var(--name); }
    /* Timer */
    .shore-timer { text-align: center; padding: 10px 16px; font-size: 15px; color: var(--text-dim); flex-shrink: 0; }
    .timer-value { color: var(--accent); margin-left: 6px; font-family: var(--font-body); }

    /* Refresh actions */
    .shore-actions { display: flex; gap: 8px; padding: 0 16px 10px; justify-content: center; flex-shrink: 0; }
    .shore-action-btn { flex: 1; }

    /* Creature cards */
    .shore-creatures {
      padding: 0 16px 10px; display: flex; gap: 8px;
      overflow-x: auto; flex-shrink: 1; min-height: 0;
      -webkit-overflow-scrolling: touch;
    }
    .shore-creatures::-webkit-scrollbar { height: 4px; }
    .shore-creatures::-webkit-scrollbar-track { background: transparent; }
    .shore-creatures::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
    .shore-empty-msg {
      text-align: center; color: var(--text-dim); font-size: 14px;
      padding: 24px 0; width: 100%; font-style: italic;
    }
    .shore-creature-card {
      flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; gap: 8px;
      background: var(--bg-deep); border: 2px solid var(--border); border-radius: 6px;
      padding: 12px; cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .shore-creature-card:hover { border-color: var(--accent); background: var(--bg-slot); }
    .shore-creature-card.selected { background: var(--bg-slot); }

    .shore-card-preview {
      width: 128px; height: 128px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg-panel); border-radius: 4px;
      overflow: hidden;
    }
    .shore-card-preview canvas {
      image-rendering: pixelated;
    }
    .shore-card-info { display: flex; flex-direction: column; align-items: center; gap: 3px; }
    .shore-card-name { font-family: var(--font-display); font-size: 9px; color: var(--name); text-align: center; }
    .shore-card-type { font-size: 13px; color: var(--accent); }
    .shore-card-rare {
      display: inline-block; font-size: 12px; padding: 2px 8px;
      border: 1px solid; border-radius: 3px; margin-top: 2px;
    }

    /* Stats panel */
    .shore-stats { padding: 0 16px; flex-shrink: 0; }
    .shore-stats-inner { display: flex; flex-direction: column; gap: 5px; padding: 10px 0; }
    .shore-trait-row { display: flex; align-items: center; gap: 6px; }
    .shore-trait-label { width: 60px; text-align: right; font-size: 12px; color: var(--text-dim); flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .shore-trait-bar-bg { flex: 1; height: 10px; background: var(--bg-deep); border-radius: 2px; overflow: hidden; }
    .shore-trait-bar-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
    .shore-trait-val { width: 34px; text-align: right; font-size: 12px; color: var(--text-dim); flex-shrink: 0; }

    /* Take button */
    .shore-take-area { padding: 8px 16px 16px; flex-shrink: 0; }

    @media (max-width: 640px) {
      .shore-timer { font-size: 13px; }
      .shore-card-preview { width: 96px; height: 96px; }
      .shore-card-type { font-size: 12px; }
      .shore-card-rare { font-size: 11px; }
      .shore-trait-label { font-size: 11px; width: 50px; }
      .shore-trait-val { font-size: 11px; }
      .shore-trait-bar-bg { height: 8px; }
      .shore-empty-msg { font-size: 13px; }
    }
  `;
  document.head.appendChild(style);
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyShoreModal();
  });
}
