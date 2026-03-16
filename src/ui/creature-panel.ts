import { Application } from 'pixi.js';
import type { Creature } from '../creatures/creature';
import { getRareInfo } from '../creatures/creature';
import { CREATURE_NAMES, CREATURE_ICONS } from '../creatures/types';
import { calculateProduction } from '../creatures/production';
import { getDisplayTraits, TRAIT_COLORS } from '../genetics/traits';
import {
  createCreatureVisual,
  updateCreatureVisual,
  destroyCreatureVisual,
  type CreatureVisual,
} from '../rendering/creature-renderer';


let overlayEl: HTMLDivElement | null = null;
let panelEl: HTMLDivElement | null = null;
let previewApp: Application | null = null;
let previewVisual: CreatureVisual | null = null;
let currentCreature: Creature | null = null;
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
      background: #0a1a20;
      border: 1px solid #1a3a3f;
      font-family: 'Press Start 2P', monospace;
      color: #b8d4d8;
      display: flex; flex-direction: column;
      overflow-y: auto;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Desktop: right sidebar */
    @media (min-width: 641px) {
      #creature-detail {
        top: 0; right: 0; bottom: 0;
        width: 320px;
        border-radius: 8px 0 0 8px;
        border-right: none;
        transform: translateX(100%);
      }
      #creature-detail.open {
        transform: translateX(0);
      }
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
      #creature-detail.open {
        transform: translateY(0);
      }
    }

    #creature-detail .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid #1a3a3f;
      flex-shrink: 0;
    }
    #creature-detail .panel-close {
      background: none; border: none; color: #5a8a8f;
      font-family: 'Press Start 2P', monospace; font-size: 12px;
      cursor: pointer; padding: 4px 8px;
      transition: color 0.15s;
    }
    #creature-detail .panel-close:hover { color: #7eeee4; }

    #creature-detail .panel-body {
      padding: 16px;
      display: flex; flex-direction: column; gap: 16px;
      flex: 1; overflow-y: auto;
    }

    #creature-detail .preview-wrap {
      display: flex; justify-content: center; align-items: center;
      background: #060e12;
      border: 1px solid #1a3a3f;
      border-radius: 6px;
      padding: 12px;
    }
    #creature-detail .preview-wrap canvas {
      image-rendering: pixelated;
    }
    @media (min-width: 641px) {
      #creature-detail .preview-wrap canvas {
        width: 180px !important; height: 180px !important;
      }
    }
    @media (max-width: 640px) {
      #creature-detail .preview-wrap canvas {
        width: 140px !important; height: 140px !important;
      }
    }

    #creature-detail .type-badge {
      display: inline-block;
      font-size: 7px; padding: 3px 8px;
      background: #1a3a3f; border-radius: 3px;
      color: #7eeee4;
    }
    #creature-detail .rare-badge {
      display: inline-block;
      font-size: 7px; padding: 3px 8px;
      border-radius: 3px;
    }
    #creature-detail .production {
      font-size: 10px; color: #3aada8;
    }

    #creature-detail .traits { display: flex; flex-direction: column; gap: 5px; }
    #creature-detail .trait-row {
      display: flex; align-items: center; gap: 6px;
    }
    #creature-detail .trait-label {
      width: 50px; text-align: right;
      font-size: 7px; color: #5a8a8f; flex-shrink: 0;
    }
    #creature-detail .trait-bar-bg {
      flex: 1; height: 8px;
      background: #0d2228; border-radius: 2px;
      overflow: hidden;
    }
    #creature-detail .trait-bar-fill {
      height: 100%; border-radius: 2px;
      transition: width 0.3s ease;
    }
    #creature-detail .trait-val {
      width: 30px; text-align: right;
      font-size: 7px; color: #5a8a8f; flex-shrink: 0;
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

async function createPreviewApp(container: HTMLElement): Promise<Application> {
  const app = new Application();
  await app.init({
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    background: '#060e12',
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });
  container.appendChild(app.canvas as HTMLCanvasElement);
  previewApp = app;
  return app;
}

function cleanupPreview(): void {
  if (previewVisual) {
    destroyCreatureVisual(previewVisual);
    previewVisual = null;
  }
  if (previewApp) {
    previewApp.stage.removeChildren();
    previewApp.destroy(false);
    previewApp = null;
  }
}

export async function showCreaturePanel(creature: Creature, adjacencyBonus: number = 0): Promise<void> {
  const { overlay, panel } = ensurePanel();

  // Clean previous preview
  cleanupPreview();
  currentCreature = creature;

  const rareInfo = getRareInfo(creature.rare);
  const production = calculateProduction(creature, adjacencyBonus);
  const traits = getDisplayTraits(creature.type);

  // Build HTML
  let html = `
    <div class="panel-header">
      <span style="color:#dadaff; font-size:11px;">${creature.name}</span>
      <button class="panel-close" id="panel-close-btn">\u2715</button>
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
    </div>
  `;

  panel.innerHTML = html;

  // Close button
  document.getElementById('panel-close-btn')!.addEventListener('click', () => hideCreaturePanel());

  // Setup PixiJS preview with creature visual (sprite + shader filters)
  const container = document.getElementById('preview-container')!;
  const app = await createPreviewApp(container);

  previewVisual = createCreatureVisual(creature, true /* own filters — not shared with game view */);
  // Scale children to fill the preview area
  previewVisual.mainSprite.width = PREVIEW_SIZE;
  previewVisual.mainSprite.height = PREVIEW_SIZE;
  if (previewVisual.glowSprite) {
    previewVisual.glowSprite.width = PREVIEW_SIZE;
    previewVisual.glowSprite.height = PREVIEW_SIZE;
  }
  // Rotating creatures: pivot at center so rotation looks natural in preview
  if (creature.rare === 'rotating') {
    const half = PREVIEW_SIZE / 2;
    previewVisual.sprite.pivot.set(half, half);
    previewVisual.sprite.x = half;
    previewVisual.sprite.y = half;
  } else {
    previewVisual.sprite.x = 0;
    previewVisual.sprite.y = 0;
  }
  app.stage.addChild(previewVisual.sprite);

  // Animate the preview creature via the preview app's ticker
  const tickerFn = (tick: { deltaTime: number }) => {
    if (!previewVisual || !currentCreature) {
      app.ticker.remove(tickerFn);
      return;
    }
    const deltaSec = tick.deltaTime / 60;
    const elapsed = performance.now() / 1000;
    updateCreatureVisual(previewVisual, deltaSec, elapsed);
  };
  app.ticker.add(tickerFn);

  // Open with animation
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    panel.classList.add('open');
  });
  panelOpen = true;
}

export function hideCreaturePanel(): void {
  if (!panelOpen) return;

  cleanupPreview();
  currentCreature = null;

  if (overlayEl) overlayEl.classList.remove('open');
  if (panelEl) panelEl.classList.remove('open');
  panelOpen = false;
}
