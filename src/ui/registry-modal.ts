import type { GameState } from '../core/game-state';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CreatureType, CREATURE_NAMES } from '../creatures/types';
import { rareIcon, typeIcon } from '../rendering/pixel-icons';
import { icon } from './icons';
import { renderCreatureThumbnail } from '../rendering/creature-renderer';
import {
  REGISTRY_SLOTS, type RegistrySlotDef,
  getRegistryMultiplier, getRegisteredCount, isSighted, specimenBonus, specimenBonusFormula,
} from '../systems/registry';
import { getUnlockedRareTiers, getTierUnlockProgress } from '../systems/rarity';
import { UNIQUES } from '../creatures/uniques';
import { renderUniqueThumbnail } from '../rendering/uniques';
import { getFoundUniques, getUniqueChance, isUniqueFound } from '../systems/uniques';
import { formatMultiplier, formatNumber, formatPercent } from '../util/format';
import { createModal } from './modal';

/** Colour strip under each cell: common, then rare tiers 1-3. */
const TIER_COLORS: Record<number, string> = { 0: '#3a5a5f', 1: '#c0c8d0', 2: '#a070e0', 3: '#f0c040' };

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

/** "Tier 2 locked: 1/3 T1 specimens registered" */
function tierLockText(state: GameState, tier: number): string {
  const { have, need } = getTierUnlockProgress(state, tier);
  return `Tier ${tier} locked: ${Math.min(have, need)}/${need} T${tier - 1} specimens registered`;
}

function cellTitle(state: GameState, def: RegistrySlotDef, specimen: Creature | undefined, sighted: boolean, tierUnlocked: boolean): string {
  const effect = def.rare ? `${getRareInfo(def.rare).label} (T${def.tier})` : 'Common';
  if (specimen) return `${effect} · ${specimen.name} · ${formatPercent(specimenBonus(specimen))} (${specimenBonusFormula(specimen)})`;
  if (sighted) return `${effect} · sighted, empty slot`;
  if (!tierUnlocked) return `Unknown · ${tierLockText(state, def.tier)}`;
  return 'Unknown · not yet sighted';
}

/** "1 in 12.3K" */
function oneIn(p: number): string {
  return `1 in ${formatNumber(Math.round(1 / p))}`;
}

function renderUniqueSection(state: GameState): string {
  const chance = oneIn(getUniqueChance(state));
  let cells = '';
  for (const u of UNIQUES) {
    const found = isUniqueFound(state, u.id);
    const title = found
      ? `${u.name} · Unique · no level, no production`
      : `Unknown unique · spawn chance per shore creature: ${chance} (1 in 100K at 0% Collection, 1 in 1K at 100%)`;
    const border = found ? ` style="border-color:${u.color}"` : '';
    cells += `<div class="reg-cell reg-unique ${found ? 'found' : 'unknown'}" data-unique="${u.id}" title="${title}"${border}></div>`;
  }
  return `
    <div class="reg-section">
      <div class="reg-section-head">
        <span>${icon('unique')} Unique</span>
        <span class="reg-count">${getFoundUniques(state).length}/${UNIQUES.length}</span>
      </div>
      <div class="reg-grid">${cells}</div>
    </div>
  `;
}

function renderContent(modal: HTMLElement, state: GameState, signal: AbortSignal): void {
  const unlockedTiers = getUnlockedRareTiers(state);
  const total = REGISTRY_SLOTS.length;
  // Only the next locked tier is shown: later tiers chain behind it
  const nextLocked = [2, 3].find((t) => !unlockedTiers.has(t));
  const lockHtml = nextLocked ? `<div class="reg-hint reg-lock">${tierLockText(state, nextLocked)}</div>` : '';

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
      const cellIcon = def.rare ? icon(rareIcon(def.rare)) : icon(typeIcon(type));
      const badge = specimen && def.rare ? `<span class="reg-icon">${cellIcon}</span>` : '';
      const body = specimen ? '' : `<span class="reg-q">${sighted ? cellIcon : '?'}</span>`;
      cells += `
        <div class="reg-cell ${cls}" data-key="${def.key}" title="${cellTitle(state, def, specimen, sighted, tierUnlocked)}"${border}>
          ${body}${badge}
          <span class="reg-tier" style="background:${TIER_COLORS[def.tier]}"></span>
        </div>
      `;
    }

    sectionsHtml += `
      <div class="reg-section">
        <div class="reg-section-head">
          <span>${icon(typeIcon(type))} ${CREATURE_NAMES[type]}</span>
          <span class="reg-count">${filled}/${defs.length}</span>
        </div>
        <div class="reg-grid">${cells}</div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="reg-header">
      <span class="reg-title">${icon('collection')} Collection</span>
      <span class="reg-summary">${getRegisteredCount(state)}/${total} · ${formatMultiplier(getRegistryMultiplier(state))} global production</span>
      <button class="btn btn-ghost" id="registry-close-btn">✕</button>
    </div>
    <div class="reg-hint">1 slot per species × effect. Specimen bonus = tier base (Common 5%, T1 10%, T2 25%, T3 50%) × gene quality (1 + 2 × avg. trait distance from 50%). Bonuses add up into one multiplier on plankton, minerite and lux.</div>
    ${lockHtml}
    <div class="reg-body">${renderUniqueSection(state)}${sectionsHtml}</div>
  `;

  // Uniques: silhouettes until found (static frames, rendered once per open)
  modal.querySelectorAll<HTMLElement>('.reg-unique').forEach((cell) => {
    const id = cell.dataset.unique as (typeof UNIQUES)[number]['id'];
    cell.appendChild(renderUniqueThumbnail(id, !isUniqueFound(state, id)));
  });

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
    .reg-lock { color: var(--accent-hi); }
    .reg-unique.found { border-width: 2px; }
    .reg-unique.unknown canvas { opacity: 0.9; }
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
