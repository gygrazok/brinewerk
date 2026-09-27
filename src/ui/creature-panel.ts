import type { Creature } from '../creatures/creature';
import type { GameState } from '../core/game-state';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_NAMES, MATERIAL_NAMES, TYPE_MULTIPLIERS } from '../creatures/types';
import { materialIcon, rareIcon, typeIcon } from '../rendering/pixel-icons';
import { levelCap, isAtCap, stageUpCost, canStageUp, stageCap, materialYield } from '../systems/growth';
import { icon, res } from './icons';
import {
  calculateGeneticRate, nextMilestone, milestonesReached, PRODUCTION_GENE,
} from '../creatures/production';
import { PROD_GENE_EXPONENT } from '../core/balance';
import { getDisplayTraits, TRAIT_COLORS } from '../genetics/traits';
import { createCreaturePreviewApp, type CreaturePreviewApp } from '../rendering/creature-preview';
import { calculateNacreYield } from '../systems/release';
import { quoteFeed } from '../systems/feeding';
import { findCreatureSlot } from '../systems/pool';
import { getRegisteredSpecimen, specimenBonus, specimenBonusFormula } from '../systems/registry';
import { isReleaseUnlocked, isRegistryUnlocked } from '../systems/achievements';
import { getCreatureRates, getPlanktonMultiplier } from '../economy/production-engine';
import { formatNumber, formatPercent, formatMultiplier } from '../util/format';

let overlayEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;
let previewHandle: CreaturePreviewApp | null = null;
let panelOpen = false;
/** AbortController for panel event listeners */
let panelAbort: AbortController | null = null;

/** Size of the preview PixiJS canvas in actual pixels */
const PREVIEW_SIZE = 200;

function injectStyles(): void {
  if (document.getElementById('creature-panel-styles')) return;
  const style = document.createElement('style');
  style.id = 'creature-panel-styles';
  style.textContent = `
    #creature-overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(4, 10, 14, 0.6);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s ease;
    }
    #creature-overlay.open {
      opacity: 1; pointer-events: auto;
    }

    #creature-detail {
      position: fixed; z-index: 101;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      font-family: var(--font-body);
      color: var(--text);
      display: flex; flex-direction: column;
      overflow-y: auto;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Desktop: right sidebar */
    @media (min-width: 641px) {
      #creature-detail {
        top: 0; right: 0; bottom: 0;
        width: 340px;
        border-radius: 8px 0 0 8px;
        border-right: none;
        transform: translateX(100%);
      }
      #creature-detail.open { transform: translateX(0); }
    }

    /* Mobile: bottom sheet */
    @media (max-width: 640px) {
      #creature-detail {
        left: 0; right: 0; bottom: 0;
        max-height: 70vh;
        border-radius: 12px 12px 0 0;
        border-bottom: none;
        transform: translateY(100%);
      }
      #creature-detail.open { transform: translateY(0); }
    }

    #creature-detail .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    #creature-detail .panel-body {
      padding: 16px;
      display: flex; flex-direction: column; gap: 16px;
      flex: 1; overflow-y: auto;
    }

    #creature-detail .preview-wrap {
      display: flex; justify-content: center; align-items: center;
      background: var(--bg-deep);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
    }
    #creature-detail .preview-wrap canvas { image-rendering: pixelated; }
    @media (min-width: 641px) {
      #creature-detail .preview-wrap canvas { width: 180px !important; height: 180px !important; }
    }
    @media (max-width: 640px) {
      #creature-detail .preview-wrap canvas { width: 140px !important; height: 140px !important; }
    }

    #creature-detail .type-badge {
      display: inline-block;
      font-family: var(--font-body);
      font-size: 13px; padding: 3px 10px;
      background: var(--border); border-radius: 3px;
      color: var(--accent-hi);
    }
    #creature-detail .rare-badge {
      display: inline-block;
      font-family: var(--font-body);
      font-size: 13px; padding: 3px 10px;
      border-radius: 3px;
    }
    #creature-detail .production {
      font-size: 15px; color: var(--accent);
    }

    #creature-detail .traits { display: flex; flex-direction: column; gap: 5px; }
    #creature-detail .trait-row { display: flex; align-items: center; gap: 6px; }
    #creature-detail .trait-label {
      width: 60px; text-align: right;
      font-size: 12px; color: var(--text-dim); flex-shrink: 0;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    #creature-detail .trait-bar-bg {
      flex: 1; height: 10px;
      background: var(--bg-slot); border-radius: 2px;
      overflow: hidden;
    }
    #creature-detail .trait-bar-fill {
      height: 100%; border-radius: 2px;
      transition: width 0.3s ease;
    }
    #creature-detail .trait-val {
      width: 34px; text-align: right;
      font-size: 12px; color: var(--text-dim); flex-shrink: 0;
    }

    #panel-confirm-overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(4, 10, 14, 0.75);
      display: flex; align-items: center; justify-content: center;
    }
    #panel-confirm-dialog {
      background: var(--bg-panel); border: 1px solid var(--border);
      border-radius: 8px; padding: 24px;
      font-family: var(--font-body);
      color: var(--text); max-width: 320px;
      text-align: center;
    }
    #panel-confirm-dialog .confirm-title {
      font-family: var(--font-display);
      font-size: 12px; color: var(--accent); margin-bottom: 12px;
    }
    #panel-confirm-dialog .confirm-text {
      font-size: 14px; line-height: 1.5; margin-bottom: 16px; color: var(--text-dim);
    }
    #panel-confirm-dialog .confirm-highlight {
      font-size: 18px; color: var(--accent); margin-bottom: 16px;
    }
    #panel-confirm-dialog .confirm-actions {
      display: flex; gap: 12px; justify-content: center;
    }

    #creature-detail .level-row {
      display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
    }
    #creature-detail .level-value {
      font-family: var(--font-display); font-size: 12px; color: var(--accent-hi);
    }
    #creature-detail .milestone { font-size: 12px; color: var(--text-dim); }
    #creature-detail .stat-lines { display: flex; flex-direction: column; gap: 2px; }
    #creature-detail .stat-dim { font-size: 12px; color: var(--text-dim); }
    #creature-detail .feed-row { display: flex; gap: 6px; }
    #creature-detail .feed-row .btn { flex: 1; padding: 6px 4px; }
    #creature-detail .panel-actions { display: flex; flex-direction: column; gap: 8px; }
    #creature-detail .registry-note {
      font-size: 13px; color: var(--accent-hi);
      border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px;
      background: var(--bg-deep);
    }
    #creature-detail .trait-label.prod { color: var(--accent-hi); }

    @media (max-width: 640px) {
      #creature-detail .type-badge { font-size: 12px; }
      #creature-detail .rare-badge { font-size: 12px; }
      #creature-detail .production { font-size: 13px; }
      #creature-detail .trait-label { font-size: 11px; width: 50px; }
      #creature-detail .trait-val { font-size: 11px; }
      #panel-confirm-dialog .confirm-text { font-size: 13px; }
      #panel-confirm-dialog .confirm-highlight { font-size: 16px; }
    }
  `;
  document.head.appendChild(style);
}

function ensurePanel(): { overlay: HTMLDivElement; panel: HTMLDivElement } {
  if (overlayEl && panelEl) return { overlay: overlayEl, panel: panelEl };

  injectStyles();

  overlayEl = document.createElement('div');
  overlayEl.id = 'creature-overlay';
  overlayEl.addEventListener('click', () => hideCreaturePanel());
  document.body.appendChild(overlayEl);

  panelEl = document.createElement('div');
  panelEl.id = 'creature-detail';
  panelEl.addEventListener('click', (e) => e.stopPropagation());
  document.body.appendChild(panelEl);

  return { overlay: overlayEl, panel: panelEl };
}

function cleanupPreview(): void {
  if (previewHandle) {
    previewHandle.destroy();
    previewHandle = null;
  }
}

export interface CreaturePanelOptions {
  state: GameState;
  /** 'pool' shows feeding and pool actions; 'registry' is a read-only specimen view. */
  mode?: 'pool' | 'registry';
  onFeed?: (creature: Creature, count: number | 'max') => void;
  onRelease?: (creature: Creature) => void;
  onStageUp?: (creature: Creature) => void;
  onRegister?: (creature: Creature) => void;
}

let currentCreature: Creature | null = null;
let pointerHeld = false;
let currentOpts: CreaturePanelOptions | null = null;

export async function showCreaturePanel(creature: Creature, opts: CreaturePanelOptions): Promise<void> {
  const { overlay, panel } = ensurePanel();

  // Clean previous preview
  cleanupPreview();
  currentCreature = creature;
  currentOpts = opts;

  const rareInfo = getRareInfo(creature.rare);
  const traits = getDisplayTraits(creature.type);
  const prodGenes = new Set<string>(['size', PRODUCTION_GENE[creature.type]]);

  let html = `
    <div class="panel-header">
      <span style="color:var(--name); font-family:var(--font-display); font-size:13px;">${creature.name}</span>
      <button class="btn btn-ghost panel-close" id="panel-close-btn">✕</button>
    </div>
    <div class="panel-body">
      <div class="preview-wrap" id="preview-container"></div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <span class="type-badge">${icon(typeIcon(creature.type))} ${CREATURE_NAMES[creature.type]}</span>
  `;

  if (creature.rare) {
    html += `
        <span class="rare-badge" style="background:${rareInfo.color}20; color:${rareInfo.color}; border:1px solid ${rareInfo.color}40;">
          ${icon(rareIcon(creature.rare))} ${rareInfo.label.toUpperCase()}
        </span>
    `;
  }

  html += `
      </div>
      <div id="panel-dynamic" style="display:flex; flex-direction:column; gap:12px;"></div>
      <div class="traits">
  `;

  for (const trait of traits) {
    const val = creature.genes[trait as keyof typeof creature.genes] as number;
    const color = TRAIT_COLORS[trait] ?? '#3aada8';
    const pct = Math.round(val * 100);
    const isProd = prodGenes.has(trait);
    const prodTitle = isProd
      ? ` title="Production gene: ×${Math.pow(2, PROD_GENE_EXPONENT * (val - 0.5)).toFixed(2)} plankton (×1 at 50%)"`
      : '';
    html += `
        <div class="trait-row"${prodTitle}>
          <span class="trait-label${isProd ? ' prod' : ''}">${isProd ? '★ ' : ''}${trait.toUpperCase()}</span>
          <div class="trait-bar-bg">
            <div class="trait-bar-fill" style="width:${pct}%; background:${color};"></div>
          </div>
          <span class="trait-val">${pct}%</span>
        </div>
    `;
  }

  html += `
      </div>
      <div class="panel-actions" id="panel-actions"></div>
    </div>
  `;

  panel.innerHTML = html;

  // Fresh controller per open: listeners on the persistent panel element must not pile up
  panelAbort?.abort();
  panelAbort = new AbortController();
  const signal = panelAbort.signal;

  document.getElementById('panel-close-btn')!.addEventListener('click', () => hideCreaturePanel(), { signal });

  // Delegated clicks: dynamic sections are re-rendered every second
  panel.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target || target.classList.contains('disabled') || target.classList.contains('unaffordable')) return;
    handleAction(target.dataset.action!, target.dataset.count);
  }, { signal });

  // While a press is in progress, periodic re-renders would swap the button under the
  // cursor and the click would land on the parent instead
  panel.addEventListener('pointerdown', () => { pointerHeld = true; }, { signal });
  window.addEventListener('pointerup', () => { pointerHeld = false; }, { signal });
  window.addEventListener('pointercancel', () => { pointerHeld = false; }, { signal });

  renderDynamic();

  // Setup PixiJS preview with creature visual (sprite + shader filters)
  const container = document.getElementById('preview-container')!;
  previewHandle = await createCreaturePreviewApp(creature, container, PREVIEW_SIZE);

  // Open with animation
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    panel.classList.add('open');
  });
  panelOpen = true;
}

/** Refresh live numbers (costs, rates, affordability) while the panel is open. */
export function updateCreaturePanel(): void {
  if (!panelOpen || pointerHeld) return;
  renderDynamic();
}

/** Replace markup only when it changed, so idle buttons keep their DOM identity. */
function setHtml(el: HTMLElement, html: string): void {
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
}

function handleAction(action: string, count: string | undefined): void {
  const creature = currentCreature;
  const opts = currentOpts;
  if (!creature || !opts) return;

  switch (action) {
    case 'feed':
      opts.onFeed?.(creature, count === 'max' ? 'max' : Number(count));
      renderDynamic();
      break;
    case 'register':
      showRegisterConfirm(creature, opts);
      break;
    case 'stage-up':
      opts.onStageUp?.(creature);
      renderDynamic();
      break;
    case 'release':
      showReleaseConfirm(creature, opts);
      break;
  }
}

function renderDynamic(): void {
  const creature = currentCreature;
  const opts = currentOpts;
  const dyn = document.getElementById('panel-dynamic');
  const actions = document.getElementById('panel-actions');
  if (!creature || !opts || !dyn || !actions) return;

  const state = opts.state;
  const geneMul = calculateGeneticRate(creature) / TYPE_MULTIPLIERS[creature.type];
  const geneLine = `<div class="stat-dim" title="Size gene × ${PRODUCTION_GENE[creature.type]} gene, relative to a 50%/50% ${CREATURE_NAMES[creature.type]}">Gene multiplier ${formatMultiplier(geneMul)}</div>`;

  if (opts.mode === 'registry') {
    setHtml(dyn, `
      <div class="registry-note" title="${specimenBonusFormula(creature)}">${icon('collection')} Collection specimen · ${formatPercent(specimenBonus(creature))} global production</div>
      ${geneLine}
    `);
    setHtml(actions, '');
    return;
  }

  const slotId = findCreatureSlot(state, creature.id);
  const slot = slotId ? state.pool.slots[slotId] : null;
  const rates = slot ? getCreatureRates(state, slot, creature) : null;
  const milestone = nextMilestone(creature.level);

  let rateLines = '';
  if (rates) {
    const breakdown = `Base ${formatNumber(calculateGeneticRate(creature), 2)}/s × Lv ${creature.level}`
      + ` × milestones ×${Math.pow(2, milestonesReached(creature.level))}`
      + ` × global ${formatMultiplier(getPlanktonMultiplier(state))}`;
    rateLines += `<div class="production" title="${breakdown}">+${formatNumber(rates.plankton, 2)} ${res('plankton')}/s</div>`;
    if (rates.minerite > 0) rateLines += `<div class="stat-dim">+${formatNumber(rates.minerite, 2)} ${res('minerite')}/s</div>`;
    if (rates.lux > 0) rateLines += `<div class="stat-dim">+${formatNumber(rates.lux, 2)} ${res('lux')}/s</div>`;
  }

  const feedBtn = (count: number | 'max', label: string): string => {
    const q = quoteFeed(state, creature, count);
    const affordable = q.levels > 0 && q.cost <= state.resources.plankton;
    // Show the real level gain when it differs from the button's nominal count (max, or clamped by the cap)
    const clamped = typeof count === 'number' && q.levels > 0 && q.levels < count;
    const title = (count === 'max' && affordable) || clamped ? `${count === 'max' ? label : 'Feed'} +${q.levels}` : label;
    return `<button class="btn btn-secondary${affordable ? '' : ' unaffordable'}" data-action="feed" data-count="${count}">${title}<br><span class="btn-cost">${formatNumber(q.cost)} ${res('plankton')}</span></button>`;
  };

  const cap = levelCap(creature);
  const mat = materialIcon(creature.type);
  const matName = MATERIAL_NAMES[creature.type];
  const stageTitle = `Stage ${creature.stage + 1}: level cap ${cap}. Next stage: cap ${stageCap(creature.stage + 1)}, costs ${stageUpCost(creature)} ${matName} (from releasing ${CREATURE_NAMES[creature.type]})`;
  let growRow: string;
  if (isAtCap(creature)) {
    const ok = canStageUp(state, creature);
    growRow = `<button class="btn btn-primary${ok ? '' : ' unaffordable'}" data-action="stage-up" title="${stageTitle}">`
      + `Grow · cap ${stageCap(creature.stage + 1)} · ${formatNumber(stageUpCost(creature))} ${icon(mat)}`
      + ` <span class="btn-cost">(${formatNumber(state.materials[creature.type])} owned)</span></button>`;
  } else {
    growRow = `
    <div class="feed-row">
      ${feedBtn(1, 'Feed')}
      ${feedBtn(10, '×10')}
      ${feedBtn('max', 'Max')}
    </div>`;
  }

  setHtml(dyn, `
    <div class="level-row">
      <span class="level-value" title="${stageTitle}">Lv ${creature.level}/${cap}</span>
      <span class="milestone" title="Each milestone doubles production">${milestone ? `×2 at Lv ${milestone}` : 'All milestones reached'}</span>
    </div>
    <div class="stat-lines">
      ${rateLines}
      ${geneLine}
    </div>
    ${growRow}
  `);

  let actionsHtml = '';
  if (isRegistryUnlocked(state) && opts.onRegister) {
    const existing = getRegisteredSpecimen(state, creature);
    const bonus = specimenBonus(creature);
    const label = existing
      ? `${icon('collection')} Replace specimen · ${formatPercent(specimenBonus(existing))} → ${formatPercent(bonus)}`
      : `${icon('collection')} Add to collection · ${formatPercent(bonus)} global production`;
    actionsHtml += `<button class="btn btn-secondary" data-action="register" title="${specimenBonusFormula(creature)}">${label}</button>`;
  }
  if (isReleaseUnlocked(state) && opts.onRelease) {
    const nacreYield = calculateNacreYield(creature, state);
    const nacrePart = nacreYield > 0 ? `+${formatNumber(nacreYield)} ${res('nacre')} ` : '';
    const title = `Nacre = (Lv / 10)² × gene quality × rare tier${nacreYield > 0 ? '' : ` (0 below Lv ${nextNacreLevel(creature, state)})`}`
      + ` · ${matName} per release = 1 + ${CREATURE_NAMES[creature.type]} Harvest level`;
    actionsHtml += `<button class="btn btn-secondary" data-action="release" title="${title}">Release · ${nacrePart}+${formatNumber(materialYield(creature, state))} ${icon(mat)}</button>`;
  }
  setHtml(actions, actionsHtml);
}

/** Lowest level at which releasing this creature yields at least 1 nacre. */
function nextNacreLevel(creature: Creature, state: GameState): number {
  let level = creature.level;
  while (calculateNacreYield({ ...creature, level }, state) < 1) level++;
  return level;
}

interface ConfirmOptions {
  title: string;
  text: string;
  highlight: string;
  confirmLabel: string;
  onConfirm: () => void;
}

function showConfirm(o: ConfirmOptions): void {
  if (document.getElementById('panel-confirm-overlay')) return;
  const confirmOverlay = document.createElement('div');
  confirmOverlay.id = 'panel-confirm-overlay';
  confirmOverlay.innerHTML = `
    <div id="panel-confirm-dialog">
      <div class="confirm-title">${o.title}</div>
      <div class="confirm-text">${o.text}</div>
      <div class="confirm-highlight">${o.highlight}</div>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn btn-primary" id="confirm-ok">${o.confirmLabel}</button>
      </div>
    </div>
  `;

  document.body.appendChild(confirmOverlay);

  // Use a local AbortController so all dialog listeners are cleaned up together
  const dialogAbort = new AbortController();
  const { signal: dialogSignal } = dialogAbort;

  const dismissDialog = () => {
    dialogAbort.abort();
    confirmOverlay.remove();
  };

  confirmOverlay.querySelector('#confirm-cancel')!.addEventListener('click', dismissDialog, { signal: dialogSignal });
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) dismissDialog();
  }, { signal: dialogSignal });

  confirmOverlay.querySelector('#confirm-ok')!.addEventListener('click', () => {
    dismissDialog();
    hideCreaturePanel();
    o.onConfirm();
  }, { signal: dialogSignal });
}

function showReleaseConfirm(creature: Creature, opts: CreaturePanelOptions): void {
  const nacre = formatNumber(calculateNacreYield(creature, opts.state));
  const material = formatNumber(materialYield(creature, opts.state));
  showConfirm({
    title: `Release ${creature.name}?`,
    text: 'Removes the creature from the pool permanently. Level and slot are lost.',
    highlight: `+${nacre} ${res('nacre')} · +${material} ${icon(materialIcon(creature.type))} ${MATERIAL_NAMES[creature.type]}`,
    confirmLabel: 'Release',
    onConfirm: () => opts.onRelease?.(creature),
  });
}

function showRegisterConfirm(creature: Creature, opts: CreaturePanelOptions): void {
  const existing = getRegisteredSpecimen(opts.state, creature);
  const replaceText = existing
    ? ` Replaces ${existing.name} (${formatPercent(specimenBonus(existing))}), which is discarded.`
    : '';
  showConfirm({
    title: `Add ${creature.name} to the collection?`,
    text: `Removes the creature from the pool permanently. The bonus applies to plankton, minerite and lux.${replaceText}`,
    highlight: `${icon('collection')} ${formatPercent(specimenBonus(creature))} global production`,
    confirmLabel: existing ? 'Replace' : 'Add',
    onConfirm: () => opts.onRegister?.(creature),
  });
}

export function hideCreaturePanel(): void {
  if (!panelOpen) return;

  panelAbort?.abort();
  panelAbort = null;
  cleanupPreview();
  currentCreature = null;
  currentOpts = null;

  if (overlayEl) overlayEl.classList.remove('open');
  if (panelEl) panelEl.classList.remove('open');
  panelOpen = false;
}

// HMR cleanup
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    hideCreaturePanel();
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    if (panelEl) { panelEl.remove(); panelEl = null; }
    const styles = document.getElementById('creature-panel-styles');
    if (styles) styles.remove();
  });
}
