import { Application } from 'pixi.js';
import { initGameLoop, getState, getClock, onTide, onReleaseUnlock } from './core/game-loop';
import { initRenderer } from './rendering/renderer';
import { createPoolView, destroyPoolView, syncPoolVisuals, updatePoolVisuals } from './ui/pool-view';
import { destroyCreatureVisual } from './rendering/creature-renderer';
import { showCreaturePanel, hideCreaturePanel, type CreaturePanelOptions } from './ui/creature-panel';
import { getCreatureAt, placeCreature, removeCreature, findEmptySlot, expandPool } from './systems/pool';
import { releaseCreature } from './systems/release';
import { forceInitialTide } from './systems/tides';
import { renderShore, setOnPickUp } from './ui/tide-shore';
import { updateHud } from './ui/hud';
import { initDebugMenu } from './ui/debug-menu';
import { injectTheme } from './ui/theme';
import { loadRenderSettings } from './rendering/render-settings';
import { destroyRareFilterCache } from './rendering/shader-loader';

const app = new Application();
let currentPoolView: import('./ui/pool-view').PoolView | null = null;
let contextLostOverlay: HTMLDivElement | null = null;
let cleanupContextHandlers: (() => void) | null = null;

/** Show a non-interactive overlay while WebGL context is lost */
function showContextLostOverlay(): void {
  if (contextLostOverlay) return;
  contextLostOverlay = document.createElement('div');
  contextLostOverlay.id = 'webgl-context-lost';
  contextLostOverlay.style.cssText =
    'position:fixed;inset:0;z-index:999;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(6,14,18,0.85);color:#5a8a8f;font-family:"Press Start 2P",monospace;font-size:10px;' +
    'text-align:center;line-height:2;white-space:pre-line;pointer-events:none;';
  contextLostOverlay.textContent = 'Rendering paused\u2026\nSwitch back to restore';
  document.body.appendChild(contextLostOverlay);
}

function hideContextLostOverlay(): void {
  contextLostOverlay?.remove();
  contextLostOverlay = null;
}

async function init() {
  // Load render settings before anything renders
  loadRenderSettings();
  injectTheme();

  const gameContainer = document.getElementById('game')!;

  await app.init({
    background: '#060e12',
    resizeTo: gameContainer,
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });

  gameContainer.appendChild(app.canvas as HTMLCanvasElement);

  // --- WebGL context loss / restore handling ---
  const canvas = app.canvas as HTMLCanvasElement;
  const onContextLost = (e: Event) => {
    e.preventDefault(); // Allow context to be restored
    console.warn('[webgl] context lost — pausing rendering');
    app.ticker.stop();
    showContextLostOverlay();
  };
  const onContextRestored = () => {
    console.log('[webgl] context restored — rebuilding GPU resources');
    // Invalidate all cached GPU resources (compiled shaders)
    destroyRareFilterCache();

    // Force full rebuild: destroy stale visuals so syncPoolVisuals recreates them
    if (currentPoolView) {
      for (const visual of currentPoolView.visuals.values()) {
        destroyCreatureVisual(visual);
      }
      currentPoolView.visuals.clear();

      const state = getState();
      syncPoolVisuals(currentPoolView, state);
    }

    hideContextLostOverlay();
    app.ticker.start();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  cleanupContextHandlers = () => {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
  };

  initGameLoop(app.ticker);
  initRenderer(app);

  const state = getState();

  // Force initial tide for new games
  forceInitialTide(state);

  const poolView = createPoolView(app, state);
  currentPoolView = poolView;

  // Handle slot clicks
  let heldCreature: import('./creatures/creature').Creature | null = null;

  poolView.onSlotClick = (slotId: string) => {
    // Place held creature
    if (heldCreature) {
      if (placeCreature(state, heldCreature, slotId)) {
        heldCreature = null;
        syncPoolVisuals(poolView, state);
        renderShore(state);
        updateHud(state);
      }
      return;
    }

    const creature = getCreatureAt(state, slotId);
    if (creature) {
      const panelOpts: CreaturePanelOptions = {
        releaseUnlocked: state.releaseUnlocked,
        onRelease: (c) => {
          releaseCreature(state, c.id);
          syncPoolVisuals(poolView, state);
          updateHud(state);
          renderShore(state);
        },
      };
      showCreaturePanel(creature, panelOpts);
    } else {
      hideCreaturePanel();
    }
  };

  // Handle creature drag & drop between slots
  poolView.onCreatureDrop = (fromSlotId: string, toSlotId: string) => {
    const creature = removeCreature(state, fromSlotId);
    if (creature && placeCreature(state, creature, toSlotId)) {
      syncPoolVisuals(poolView, state);
      updateHud(state);
    } else if (creature) {
      // Rollback: put creature back
      placeCreature(state, creature, fromSlotId);
    }
  };

  // Handle expansion clicks (unlock locked slots)
  poolView.onExpansionClick = (slotId: string) => {
    if (expandPool(state, slotId)) {
      syncPoolVisuals(poolView, state);
      updateHud(state);
      renderShore(state);
    }
  };

  // Shore: pick up creature → auto-place or hold
  setOnPickUp((creature) => {
    const emptySlotId = findEmptySlot(state);
    if (emptySlotId) {
      placeCreature(state, creature, emptySlotId);
      syncPoolVisuals(poolView, state);
      updateHud(state);
    } else {
      heldCreature = creature;
    }
  });

  // Tide callback
  onTide(() => {
    renderShore(state);
  });

  // Release unlock notification
  onReleaseUnlock(() => {
    updateHud(state);
    console.log('Creature release unlocked — pool is full');
  });

  // Initial render
  syncPoolVisuals(poolView, state);
  renderShore(state);
  updateHud(state);

  // Per-frame updates
  let hudTimer = 0;
  app.ticker.add((tick) => {
    const clock = getClock();
    const deltaSec = tick.deltaTime / 60;
    updatePoolVisuals(poolView, deltaSec, clock.elapsed);

    hudTimer += deltaSec;
    if (hudTimer >= 1) {
      hudTimer = 0;
      updateHud(state);
      renderShore(state);
    }
  });

  // Debug menu (dev only)
  if (import.meta.env.DEV) {
    initDebugMenu(
      state,
      () => {
        syncPoolVisuals(poolView, state);
        renderShore(state);
        updateHud(state);
      },
      () => window.location.reload(),
    );
  }

  console.log('Brinewerk initialized');
}

/** Tear down all game resources (for HMR or full app destroy) */
function cleanup(): void {
  cleanupContextHandlers?.();
  cleanupContextHandlers = null;
  hideContextLostOverlay();
  if (currentPoolView) {
    destroyPoolView(currentPoolView);
    currentPoolView = null;
  }
  destroyRareFilterCache();
  hideCreaturePanel();
}

init();

// Vite HMR: clean up before hot-reloading to prevent listener leaks
if (import.meta.hot) {
  import.meta.hot.dispose(() => cleanup());
}

export { app };
