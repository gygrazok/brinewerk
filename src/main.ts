import { Application } from 'pixi.js';
import { initGameLoop, getState, getClock, onTide, onAchievement } from './core/game-loop';
import { initRenderer } from './rendering/renderer';
import { createPoolView, destroyPoolView, syncPoolVisuals, updatePoolVisuals, panToWorldPos } from './ui/pool-view';
import { destroyCreatureVisual } from './rendering/creature-renderer';
import { showCreaturePanel, hideCreaturePanel, type CreaturePanelOptions } from './ui/creature-panel';
import { getCreatureAt, placeCreature, removeCreature, findEmptySlot, expandPool } from './systems/pool';
import { releaseCreature } from './systems/release';
import { forceInitialTide } from './systems/tides';
import {
  setOnTakeCreature, renderShoreButton, updateShoreModal,
  isShoreModalOpen, destroyShoreModal, openShoreModal,
} from './ui/shore-modal';
import { updateHud } from './ui/hud';
import { initDebugMenu } from './ui/debug-menu';
import { injectTheme } from './ui/theme';
import { loadRenderSettings } from './rendering/render-settings';
import { destroyRareFilterCache } from './rendering/shader-loader';
import { getUpgradeLevel, getUpgradeEffect } from './systems/upgrades';
import { isUpgradeModalOpen, updateUpgradeModal, setOnUpgradePurchase, destroyUpgradeModal } from './ui/upgrade-modal';
import { isAchievementModalOpen, updateAchievementModal, destroyAchievementModal } from './ui/achievement-modal';
import { isReleaseUnlocked } from './systems/achievements';
import { showAchievementToast } from './ui/achievement-toast';
import { createCollectibleManager, updateCollectibles, clearCollectibles, clickCollect, forceSpawnCoral, type CollectibleManager } from './systems/collectibles';
import {
  createCollectibleLayer, syncCollectibleVisuals, destroyCollectibleLayer, type CollectibleLayer,
  createPopupLayer, spawnPickupPopups, updatePopups, destroyPopupLayer, type PopupLayer,
} from './rendering/collectible-renderer';
import { COLLECTIBLE_COLLECT_RADIUS } from './core/balance';

const app = new Application();
let currentPoolView: import('./ui/pool-view').PoolView | null = null;
let contextLostOverlay: HTMLDivElement | null = null;
let cleanupContextHandlers: (() => void) | null = null;
let collectibleMgr: CollectibleManager | null = null;
let collectibleLayer: CollectibleLayer | null = null;
let popupLayer: PopupLayer | null = null;

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
    // Automatic texture garbage collection — frees GPU memory for unused textures
    textureGCActive: true,
    textureGCMaxIdle: 3600,        // ~60s at 60fps before cleanup
    textureGCCheckCountMax: 600,   // check every ~10s
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

    // Clear collectible sprites (textures are invalid after context loss)
    if (collectibleLayer && collectibleMgr) {
      for (const s of collectibleLayer.sprites.values()) s.destroy();
      for (const t of collectibleLayer.textures.values()) t.destroy(true);
      collectibleLayer.sprites.clear();
      collectibleLayer.textures.clear();
      clearCollectibles(collectibleMgr);
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

  // Initialize floating collectibles
  collectibleMgr = createCollectibleManager(state.seabedSeed + 999);
  collectibleLayer = createCollectibleLayer();
  popupLayer = createPopupLayer();
  poolView._collectibleLayer.addChild(collectibleLayer.container);
  poolView._collectibleLayer.addChild(popupLayer.container);

  // Handle slot clicks
  let heldCreature: import('./creatures/creature').Creature | null = null;
  let targetSlotId: string | null = null;

  poolView.onSlotClick = (slotId: string) => {
    // Place held creature
    if (heldCreature) {
      if (placeCreature(state, heldCreature, slotId)) {
        heldCreature = null;
        syncPoolVisuals(poolView, state);
        renderShoreButton(state);
        updateHud(state);
      }
      return;
    }

    const creature = getCreatureAt(state, slotId);
    if (creature) {
      const panelOpts: CreaturePanelOptions = {
        releaseUnlocked: isReleaseUnlocked(state),
        state,
        onRelease: (c) => {
          releaseCreature(state, c.id);
          syncPoolVisuals(poolView, state);
          updateHud(state);
          renderShoreButton(state);
        },
      };
      showCreaturePanel(creature, panelOpts);
    } else {
      // Empty slot: open shore modal and target this slot for placement
      hideCreaturePanel();
      targetSlotId = slotId;
      openShoreModal(state);
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
      renderShoreButton(state);
    }
  };

  // Handle world taps for click-to-collect coral
  poolView.onWorldTap = (worldX: number, worldY: number) => {
    if (!collectibleMgr || !popupLayer) return;
    const event = clickCollect(collectibleMgr, worldX, worldY);
    if (event) {
      state.resources[event.resource] += event.amount;
      spawnPickupPopups(popupLayer, [event]);
      updateHud(state);
    }
  };

  // Shore: take creature → place in target slot (if set) or first empty, or hold for manual
  setOnTakeCreature((creature) => {
    // Use the targeted slot if one was set (clicked on empty slot to open modal)
    const slotId = targetSlotId ?? findEmptySlot(state);
    targetSlotId = null;

    if (slotId && placeCreature(state, creature, slotId)) {
      syncPoolVisuals(poolView, state);
      updateHud(state);
      renderShoreButton(state);
      const slot = state.pool.slots[slotId];
      if (slot) panToWorldPos(poolView, slot.x, slot.y);
    } else {
      // Target slot was occupied or no empty slots — hold for manual placement
      heldCreature = creature;
      renderShoreButton(state);
    }
  });

  // Tide callback
  onTide(() => {
    renderShoreButton(state);
    if (isShoreModalOpen()) updateShoreModal(state);
  });

  // Achievement completion
  onAchievement((defs) => {
    for (const def of defs) {
      showAchievementToast(def);
    }
    updateHud(state);
    syncPoolVisuals(poolView, state);
    renderShoreButton(state);
  });

  // Initial render
  syncPoolVisuals(poolView, state);
  renderShoreButton(state);
  updateHud(state);

  // Clear target slot when shore is opened via the bottom-bar button (not from a slot click)
  document.getElementById('shore-btn')?.addEventListener('click', () => {
    targetSlotId = null;
  });

  // Per-frame updates
  let hudTimer = 0;
  app.ticker.add((tick) => {
    const clock = getClock();
    const deltaSec = tick.deltaTime / 60;
    updatePoolVisuals(poolView, deltaSec, clock.elapsed);

    // Update floating collectibles
    if (collectibleMgr && collectibleLayer) {
      const magnetMul = getUpgradeEffect('magnetic_current', getUpgradeLevel(state, 'magnetic_current'));
      const coralMul = getUpgradeEffect('coral_growth', getUpgradeLevel(state, 'coral_growth'));
      const collected = updateCollectibles(
        collectibleMgr,
        deltaSec,
        state.pool.worldWidth,
        state.pool.worldHeight,
        poolView.mouseWorldX,
        poolView.mouseWorldY,
        COLLECTIBLE_COLLECT_RADIUS * magnetMul / poolView.zoom,
        state.pool,
        coralMul,
      );
      syncCollectibleVisuals(collectibleLayer, collectibleMgr, state.pool.worldWidth);

      // Apply plankton surge upgrade to collectible plankton
      const surgeMul = getUpgradeEffect('plankton_surge', getUpgradeLevel(state, 'plankton_surge'));
      if (collected.plankton > 0) {
        state.resources.plankton += collected.plankton * surgeMul;
        // Update event amounts for popups
        for (const ev of collected.events) {
          if (ev.resource === 'plankton') ev.amount = Math.round(ev.amount * surgeMul);
        }
      }
      if (collected.minerite > 0) state.resources.minerite += collected.minerite;
      if (collected.lux > 0) state.resources.lux += collected.lux;
      if (collected.nacre > 0) state.resources.nacre += collected.nacre;
      if (collected.coral > 0) state.resources.coral += collected.coral;

      // Spawn floating "+N 🟢" popups and animate existing ones
      if (popupLayer) {
        if (collected.events.length > 0) spawnPickupPopups(popupLayer, collected.events);
        updatePopups(popupLayer, deltaSec);
      }
    }

    hudTimer += deltaSec;
    if (hudTimer >= 1) {
      hudTimer = 0;
      updateHud(state);
      renderShoreButton(state);
      if (isShoreModalOpen()) updateShoreModal(state);
      if (isUpgradeModalOpen()) updateUpgradeModal(state);
      if (isAchievementModalOpen()) updateAchievementModal(state);
    }
  });

  // Upgrade purchase callback
  setOnUpgradePurchase(() => {
    updateHud(state);
    renderShoreButton(state);
  });

  // Debug menu (dev only)
  if (import.meta.env.DEV) {
    initDebugMenu(state, {
      onStateChange: () => {
        syncPoolVisuals(poolView, state);
        renderShoreButton(state);
        updateHud(state);
      },
      onReset: () => window.location.reload(),
      onSpawnCoral: () => {
        if (collectibleMgr) forceSpawnCoral(collectibleMgr, state.pool.worldWidth, state.pool.worldHeight, state.pool);
      },
    });
  }

  console.log('Brinewerk initialized');
}

/** Tear down all game resources (for HMR or full app destroy) */
function cleanup(): void {
  cleanupContextHandlers?.();
  cleanupContextHandlers = null;
  hideContextLostOverlay();
  if (popupLayer) {
    destroyPopupLayer(popupLayer);
    popupLayer = null;
  }
  if (collectibleLayer) {
    destroyCollectibleLayer(collectibleLayer);
    collectibleLayer = null;
  }
  if (collectibleMgr) {
    clearCollectibles(collectibleMgr);
    collectibleMgr = null;
  }
  if (currentPoolView) {
    destroyPoolView(currentPoolView);
    currentPoolView = null;
  }
  destroyRareFilterCache();
  destroyShoreModal();
  destroyUpgradeModal();
  destroyAchievementModal();
  hideCreaturePanel();
}

init();

// Vite HMR: clean up before hot-reloading to prevent listener leaks
if (import.meta.hot) {
  import.meta.hot.dispose(() => cleanup());
}

export { app };
