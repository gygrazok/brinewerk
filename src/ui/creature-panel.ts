import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_NAMES, CREATURE_ICONS } from '../creatures/types';
import { calculateProduction } from '../creatures/production';
import { getDisplayTraits, TRAIT_COLORS } from '../genetics/traits';
import { createCreaturePreviewApp, type CreaturePreviewApp } from '../rendering/creature-preview';
import { calculateNacreYield } from '../systems/release';

let overlayEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;
let previewHandle: CreaturePreviewApp | null = null;
let panelOpen = false;

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
    #creature-detail .panel-close {
      font-family: var(--font-body);
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
      font-size: 11px; padding: 3px 10px;
      background: var(--border); border-radius: 3px;
      color: var(--accent-hi);
    }
    #creature-detail .rare-badge {
      display: inline-block;
      font-family: var(--font-body);
      font-size: 11px; padding: 3px 10px;
      border-radius: 3px;
    }
    #creature-detail .production {
      font-size: 13px; color: var(--accent);
    }

    #creature-detail .traits { display: flex; flex-direction: column; gap: 5px; }
    #creature-detail .trait-row { display: flex; align-items: center; gap: 6px; }
    #creature-detail .trait-label {
      width: 56px; text-align: right;
      font-size: 10px; color: var(--text-dim); flex-shrink: 0;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    #creature-detail .trait-bar-bg {
      flex: 1; height: 8px;
      background: var(--bg-slot); border-radius: 2px;
      overflow: hidden;
    }
    #creature-detail .trait-bar-fill {
      height: 100%; border-radius: 2px;
      transition: width 0.3s ease;
    }
    #creature-detail .trait-val {
      width: 32px; text-align: right;
      font-size: 10px; color: var(--text-dim); flex-shrink: 0;
    }

    #release-confirm-overlay {
      position: fixed; inset: 0; z-index: 200;
      background: rgba(4, 10, 14, 0.75);
      display: flex; align-items: center; justify-content: center;
    }
    #release-confirm-dialog {
      background: var(--bg-panel); border: 1px solid var(--danger-border);
      border-radius: 8px; padding: 24px;
      font-family: var(--font-body);
      color: var(--text); max-width: 320px;
      text-align: center;
    }
    #release-confirm-dialog .confirm-title {
      font-family: var(--font-display);
      font-size: 10px; color: var(--danger-text); margin-bottom: 12px;
    }
    #release-confirm-dialog .confirm-text {
      font-size: 12px; line-height: 1.5; margin-bottom: 16px; color: var(--text-dim);
    }
    #release-confirm-dialog .confirm-nacre {
      font-size: 16px; color: var(--danger-text); margin-bottom: 16px;
    }
    #release-confirm-dialog .confirm-actions {
      display: flex; gap: 12px; justify-content: center;
    }

    @media (max-width: 640px) {
      #creature-detail .type-badge { font-size: 10px; }
      #creature-detail .rare-badge { font-size: 10px; }
      #creature-detail .production { font-size: 11px; }
      #creature-detail .trait-label { font-size: 9px; width: 46px; }
      #creature-detail .trait-val { font-size: 9px; }
      #release-confirm-dialog .confirm-text { font-size: 11px; }
      #release-confirm-dialog .confirm-nacre { font-size: 14px; }
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
  releaseUnlocked?: boolean;
  onRelease?: (creature: Creature) => void;
}

export async function showCreaturePanel(creature: Creature, opts: CreaturePanelOptions = {}): Promise<void> {
  const { overlay, panel } = ensurePanel();

  // Clean previous preview
  cleanupPreview();

  const rareInfo = getRareInfo(creature.rare);
  const production = calculateProduction(creature);
  const traits = getDisplayTraits(creature.type);

  // Build HTML
  let html = `
    <div class="panel-header">
      <span style="color:var(--name); font-family:var(--font-display); font-size:11px;">${creature.name}</span>
      <button class="btn btn-ghost panel-close" id="panel-close-btn">\u2715</button>
    </div>
    <div class="panel-body">
      <div class="preview-wrap" id="preview-container"></div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <span class="type-badge">${CREATURE_ICONS[creature.type]} ${CREATURE_NAMES[creature.type]}</span>
  `;

  if (creature.rare) {
    html += `
        <span class="rare-badge" style="background:${rareInfo.color}20; color:${rareInfo.color}; border:1px solid ${rareInfo.color}40;">
          ${rareInfo.icon} ${rareInfo.label.toUpperCase()}
        </span>
    `;
  }

  html += `
      </div>
      <div class="production">+${production.toFixed(2)} plankton/s</div>
      <div class="traits">
  `;

  for (const trait of traits) {
    const val = creature.genes[trait as keyof typeof creature.genes] as number;
    const color = TRAIT_COLORS[trait] ?? '#3aada8';
    const pct = Math.round(val * 100);
    html += `
        <div class="trait-row">
          <span class="trait-label">${trait.toUpperCase()}</span>
          <div class="trait-bar-bg">
            <div class="trait-bar-fill" style="width:${pct}%; background:${color};"></div>
          </div>
          <span class="trait-val">${pct}%</span>
        </div>
    `;
  }

  html += `
      </div>
  `;

  // Release button (only if feature is unlocked)
  if (opts.releaseUnlocked) {
    const nacreYield = calculateNacreYield(creature);
    if (nacreYield > 0) {
      html += `
        <button class="btn btn-danger" id="release-btn">
          ⚬ Release for ${nacreYield} Nacre
        </button>
      `;
    } else {
      html += `
        <button class="btn btn-danger disabled">
          ⚬ 0 Nacre earned
        </button>
      `;
    }
  }

  html += `
    </div>
  `;

  panel.innerHTML = html;

  // Close button
  document.getElementById('panel-close-btn')!.addEventListener('click', () => hideCreaturePanel());

  // Release button
  const releaseBtn = document.getElementById('release-btn');
  if (releaseBtn && opts.onRelease) {
    const onRelease = opts.onRelease;
    releaseBtn.addEventListener('click', () => {
      showReleaseConfirm(creature, onRelease);
    });
  }

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

function showReleaseConfirm(creature: Creature, onRelease: (creature: Creature) => void): void {
  const nacreYield = calculateNacreYield(creature);

  const confirmOverlay = document.createElement('div');
  confirmOverlay.id = 'release-confirm-overlay';
  confirmOverlay.innerHTML = `
    <div id="release-confirm-dialog">
      <div class="confirm-title">Release ${creature.name}?</div>
      <div class="confirm-text">It will return to the ocean forever.</div>
      <div class="confirm-nacre">⚬ ${nacreYield} Nacre</div>
      <div class="confirm-actions">
        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
        <button class="btn btn-danger" id="confirm-release">Release ⚬${nacreYield}</button>
      </div>
    </div>
  `;

  document.body.appendChild(confirmOverlay);

  document.getElementById('confirm-cancel')!.addEventListener('click', () => {
    confirmOverlay.remove();
  });
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) confirmOverlay.remove();
  });

  document.getElementById('confirm-release')!.addEventListener('click', () => {
    confirmOverlay.remove();
    hideCreaturePanel();
    onRelease(creature);
  });
}

export function hideCreaturePanel(): void {
  if (!panelOpen) return;

  cleanupPreview();

  if (overlayEl) overlayEl.classList.remove('open');
  if (panelEl) panelEl.classList.remove('open');
  panelOpen = false;
}
