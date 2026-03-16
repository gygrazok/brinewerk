import { Application } from 'pixi.js';
import { initGameLoop, getState, getClock, onTide } from './core/game-loop';
import { initRenderer } from './rendering/renderer';
import { createPoolView, syncPoolVisuals, updatePoolVisuals } from './ui/pool-view';
import { showCreaturePanel, hideCreaturePanel } from './ui/creature-panel';
import { getCreatureAt, calculateAdjacencyBonus, placeCreature, removeCreature, findEmptySlot, expandPool } from './systems/pool';
import { forceInitialTide } from './systems/tides';
import { renderShore, setOnPickUp } from './ui/tide-shore';
import { updateHud } from './ui/hud';
import { installUpgrade } from './economy/upgrades';
import { showUpgradeModal } from './ui/upgrade-modal';
import { initDebugMenu } from './ui/debug-menu';

const app = new Application();

async function init() {
  await app.init({
    background: '#060e12',
    resizeTo: window,
    antialias: false,
    roundPixels: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    preference: 'webgl',
  });

  const container = document.getElementById('game')!;
  container.appendChild(app.canvas as HTMLCanvasElement);

  initGameLoop(app.ticker);
  initRenderer(app);

  const state = getState();

  // Force initial tide for new games
  forceInitialTide(state);

  const poolView = createPoolView(app, state);

  // Handle slot clicks
  let heldCreature: import('./creatures/creature').Creature | null = null;

  poolView.onSlotClick = (row, col) => {
    // Place held creature
    if (heldCreature) {
      if (placeCreature(state, heldCreature, row, col)) {
        heldCreature = null;
        syncPoolVisuals(poolView, state);
        renderShore(state);
        updateHud(state);
      }
      return;
    }

    const creature = getCreatureAt(state, row, col);
    if (creature) {
      const bonus = calculateAdjacencyBonus(state, row, col);
      showCreaturePanel(creature, bonus);
    } else {
      hideCreaturePanel();
    }
  };

  // Handle creature drag & drop between slots
  poolView.onCreatureDrop = (fromR, fromC, toR, toC) => {
    const creature = removeCreature(state, fromR, fromC);
    if (creature && placeCreature(state, creature, toR, toC)) {
      syncPoolVisuals(poolView, state);
      updateHud(state);
    } else if (creature) {
      // Rollback: put creature back
      placeCreature(state, creature, fromR, fromC);
    }
  };

  // Handle expansion clicks
  poolView.onExpansionClick = (row, col) => {
    if (expandPool(state, row, col)) {
      syncPoolVisuals(poolView, state);
      updateHud(state);
    }
  };

  // Handle upgrade node clicks
  poolView.onUpgradeNodeClick = (row, col) => {
    // Check if node already has an upgrade
    const existing = state.upgradeNodes.find((n) => n.row === row && n.col === col);
    if (existing?.upgradeType) return; // already upgraded

    showUpgradeModal(state, row, col, (type) => {
      if (installUpgrade(state, row, col, type)) {
        syncPoolVisuals(poolView, state);
        updateHud(state);
      }
    });
  };

  // Shore: pick up creature → auto-place or hold
  setOnPickUp((creature) => {
    const emptySlot = findEmptySlot(state);
    if (emptySlot) {
      placeCreature(state, creature, emptySlot[0], emptySlot[1]);
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

init();

export { app };
