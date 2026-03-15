import { Application } from 'pixi.js';
import { initGameLoop, getState, getClock, onTide } from './core/game-loop';
import { initRenderer } from './rendering/renderer';
import { createPoolView, syncPoolVisuals, updatePoolVisuals } from './ui/pool-view';
import { showCreaturePanel, hideCreaturePanel } from './ui/creature-panel';
import { getCreatureAt, calculateAdjacencyBonus, placeCreature, findEmptySlot } from './systems/pool';
import { forceInitialTide } from './systems/tides';
import { renderShore, setOnPickUp } from './ui/tide-shore';
import { updateHud } from './ui/hud';
import { buildAlgaeColony, canBuildAlgaeColony } from './economy/structures';
import { ALGAE_COLONY_COST } from './core/balance';

const app = new Application();

let buildMode = false;

async function init() {
  await app.init({
    background: '#060e12',
    resizeTo: window,
    antialias: false,
    resolution: 1,
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
    // Build mode — place Algae Colony
    if (buildMode) {
      if (buildAlgaeColony(state, row, col)) {
        buildMode = false;
        syncPoolVisuals(poolView, state);
        updateHud(state);
        updateBuildButton(state);
      }
      return;
    }

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

  // Build button
  createBuildButton(state);

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
      updateBuildButton(state);
    }
  });

  console.log('Brinewerk initialized');
}

let buildBtn: HTMLButtonElement | null = null;

function createBuildButton(state: import('./core/game-state').GameState): void {
  buildBtn = document.createElement('button');
  buildBtn.id = 'build-btn';
  buildBtn.style.cssText = `
    position: absolute; top: 12px; right: 16px;
    font-family: 'Press Start 2P', monospace; font-size: 8px;
    background: #1a3a3f; color: #7eeee4;
    border: 2px solid #3aada8; padding: 8px 14px;
    cursor: pointer; pointer-events: auto;
    transition: background 0.15s, opacity 0.15s;
  `;
  buildBtn.addEventListener('click', () => {
    if (canBuildAlgaeColony(state)) {
      buildMode = !buildMode;
      buildBtn!.style.background = buildMode ? '#3aada8' : '#1a3a3f';
      buildBtn!.style.color = buildMode ? '#060e12' : '#7eeee4';
    }
  });
  document.getElementById('ui')!.appendChild(buildBtn);
  updateBuildButton(state);
}

function updateBuildButton(state: import('./core/game-state').GameState): void {
  if (!buildBtn) return;
  const canBuild = canBuildAlgaeColony(state);
  buildBtn.textContent = `BUILD ALGAE (${ALGAE_COLONY_COST}🟢)`;
  buildBtn.style.opacity = canBuild ? '1' : '0.4';
}

init();

export { app };
