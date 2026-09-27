import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CreatureType, CREATURE_NAMES, CREATURE_ICONS } from '../creatures/types';
import { renderCreatureThumbnail } from '../rendering/creature-renderer';
import {
  REGISTRY_SLOTS, type RegistrySlotDef,
  getRegistryMultiplier, getRegisteredCount, isSighted, specimenBonus,
} from '../systems/registry';
import { getUnlockedRareTiers } from '../systems/rarity';
import { formatMultiplier, formatPercent } from '../util/format';
import { createModal } from './modal';

/** Colour strip under each cell: common, then rare tiers 1-3. */
const TIER_COLORS: Record<number, string> = { 0: '#3a5a5f', 1: '#c0c8d0', 2: '#a070e0', 3: '#f0c040' };
/** Upgrade that unlocks each rare tier, for locked-cell tooltips. */
const TIER_UNLOCK_HINT: Record<number, string> = { 2: 'Strange Tides', 3: 'Abyssal Legends' };

let stateRef: GameState | null = null;
let onOpenSpecimenCb: ((creature: Creature) => void) | null = null;
/** Thumbnails keyed by creature id: specimens never change, so render each once. */
const thumbCache = new Map<string, HTMLCanvasElement>();

const controller = createModal({
  id: 'registry',
  width: 'min(92vw, 760px)',
  render: (panel, signal) => {
    injectStyles();
    if (!stateRef) return;
    renderContent(panel, stateRef, signal);
  },
});

export function openRegistryModal(state: GameState): void {
  stateRef = state;
  controller.open();
}

export function isRegistryModalOpen(): boolean {
  return controller.isOpen;
}

/** Called when the player clicks a registered specimen. */
export function setOnOpenSpecimen(cb: (creature: Creature) => void): void {
  onOpenSpecimenCb = cb;
}

export function destroyRegistryModal(): void {
  controller.destroy();
  thumbCache.clear();
  document.getElementById('registry-modal-styles')?.remove();
}

// ---------------------------------------------------------------------------
// Content rendering
// ---------------------------------------------------------------------------

function thumbnailFor(creature: Creature): HTMLCanvasElement {
  let canvas = thumbCache.get(creature.id);
  if (!canvas) {
    canvas = renderCreatureThumbnail(creature);
    thumbCache.set(creature.id, canvas);
  }
  return canvas;
}

function cellTitle(def: RegistrySlotDef, specimen: Creature | undefined, sighted: boolean, tierUnlocked: boolean): string {
  const effect = def.rare ? getRareInfo(def.rare).label : 'Common';
  if (specimen) return `${specimen.name} · ${effect} · ${formatPercent(specimenBonus(specimen))} production`;
  if (sighted) return `${effect}: sighted, not registered`;
  if (!tierUnlocked) return `Unknown · requires ${TIER_UNLOCK_HINT[def.tier]}`;
  return 'Unknown';
}

function renderContent(modal: HTMLElement, state: GameState, signal: AbortSignal): void {
  const unlockedTiers = getUnlockedRareTiers(state);
  const total = REGISTRY_SLOTS.length;

  let sectionsHtml = '';
  for (const type of Object.values(CreatureType)) {
    const defs = REGISTRY_SLOTS.filter((d) => d.type === type);
    const filled = defs.filter((d) => d.key in state.registry).length;

    let cells = '';
    for (const def of defs) {
      const specimen = state.registry[def.key];
      const sighted = isSighted(state, def.key);
      const tierUnlocked = def.tier === 0 || unlockedTiers.has(def.tier);
      const info = def.rare ? getRareInfo(def.rare) : null;
      const cls = specimen ? 'filled' : sighted ? 'sighted' : 'unknown';
      const border = specimen && info ? ` style="border-color:${info.color}"` : '';
      const icon = info && (specimen || sighted) ? `<span class="reg-icon">${info.icon}</span>` : '';
      const body = specimen ? '' : `<span class="reg-q">${sighted ? (info?.icon ?? CREATURE_ICONS[type]) : '?'}</span>`;
      cells += `
        <div class="reg-cell ${cls}" data-key="${def.key}" title="${cellTitle(def, specimen, sighted, tierUnlocked)}"${border}>
          ${body}${specimen ? icon : ''}
          <span class="reg-tier" style="background:${TIER_COLORS[def.tier]}"></span>
        </div>
      `;
    }

    sectionsHtml += `
      <div class="reg-section">
        <div class="reg-section-head">
          <span>${CREATURE_ICONS[type]} ${CREATURE_NAMES[type]}</span>
          <span class="reg-count">${filled}/${defs.length}</span>
        </div>
        <div class="reg-grid">${cells}</div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="reg-header">
      <span class="reg-title">📖 Registry</span>
      <span class="reg-summary">${getRegisteredCount(state)}/${total} · ${formatMultiplier(getRegistryMultiplier(state))} production</span>
      <button class="btn btn-ghost" id="registry-close-btn">✕</button>
    </div>
    <div class="reg-hint">One specimen per species and effect. Better genes give a bigger bonus; rarer effects give much more.</div>
    <div class="reg-body">${sectionsHtml}</div>
  `;

  // Mount cached thumbnails into filled cells
  modal.querySelectorAll<HTMLElement>('.reg-cell.filled').forEach((cell) => {
    const specimen = state.registry[cell.dataset.key!];
    if (specimen) cell.prepend(thumbnailFor(specimen));
  });

  document.getElementById('registry-close-btn')!.addEventListener('click', () => controller.close(), { signal });

  modal.querySelector('.reg-body')!.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.reg-cell.filled');
    if (!cell || !stateRef) return;
    const specimen = stateRef.registry[cell.dataset.key!];
    if (!specimen) return;
    controller.close();
    onOpenSpecimenCb?.(specimen);
  }, { signal });
}

// ---------------------------------------------------------------------------
// Content-specific styles (frame/animation CSS is provided by modal.ts)
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById('registry-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'registry-modal-styles';
  style.textContent = `
    .reg-header {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .reg-title { font-family: var(--font-display); font-size: 13px; color: var(--name); flex: 1; }
    .reg-summary { font-size: 13px; color: var(--accent-hi); }
    .reg-hint { padding: 8px 16px 0; font-size: 12px; color: var(--text-dim); }

    .reg-body {
      padding: 12px 16px 16px;
      display: flex; flex-direction: column; gap: 14px;
      overflow-y: auto;
    }
    .reg-section-head {
      display: flex; justify-content: space-between;
      font-size: 14px; color: var(--text); margin-bottom: 6px;
    }
    .reg-count { color: var(--text-dim); font-size: 13px; }

    .reg-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
      gap: 6px;
    }
    .reg-cell {
      position: relative;
      aspect-ratio: 1;
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .reg-cell canvas {
      width: 100%; height: 100%;
      image-rendering: pixelated;
    }
    .reg-cell.filled { cursor: pointer; border-color: var(--accent); }
    .reg-cell.filled:hover { background: var(--bg-slot); }
    .reg-cell.sighted .reg-q { opacity: 0.55; font-size: 16px; }
    .reg-cell.unknown .reg-q { color: var(--border); font-family: var(--font-display); font-size: 10px; }
    .reg-icon {
      position: absolute; top: 1px; right: 3px;
      font-size: 11px; line-height: 1;
    }
    .reg-tier {
      position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
      opacity: 0.8;
    }

    @media (max-width: 640px) {
      .reg-grid { grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); }
      .reg-summary { font-size: 12px; }
    }
  `;
  document.head.appendChild(style);
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => destroyRegistryModal());
}
