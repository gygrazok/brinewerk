import { Application } from 'pixi.js';
import { initGameLoop, getState, getClock, onTide } from './core/game-loop';
import { initRenderer } from './rendering/renderer';
import { createPoolView, destroyPoolView, syncPoolVisuals, updatePoolVisuals } from './ui/pool-view';
import { showCreaturePanel, hideCreaturePanel } from './ui/creature-panel';
import { getCreatureAt, calculateAdjacencyBonus, placeCreature, removeCreature, findEmptySlot, expandPool } from './systems/pool';
import { forceInitialTide } from './systems/tides';
import { renderShore, setOnPickUp } from './ui/tide-shore';
import { updateHud } from './ui/hud';
import { initDebugMenu } from './ui/debug-menu';
import { injectTheme } from './ui/theme';
import { loadRenderSettings } from './rendering/render-settings';
import { destroyRareFilterCache } from './rendering/shader-loader';

const app = new Application();
let currentPoolView: import('./ui/pool-view').PoolView | null = null;

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
      const bonus = calculateAdjacencyBonus(state, slotId);
      showCreaturePanel(creature, bonus);
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
