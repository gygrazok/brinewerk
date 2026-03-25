import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameState, SeabedSlot } from '../core/game-state';
import type { ResourceBundle } from '../core/game-state';
import { getCreatureAt } from '../systems/pool';
import { getSlotUnlockCost } from '../core/balance';
import { allSlots, worldToSlot } from '../systems/coords';
import {
  createCreatureVisual,
  updateCreatureVisual,
  destroyCreatureVisual,
  type CreatureVisual,
} from '../rendering/creature-renderer';
import {
  createSeabedBackground,
  updateSeabedBackground,
  destroySeabedBackground,
  type SeabedBackground,
} from '../rendering/seabed-bg';
import { cleanupEffectState } from '../rendering/effects/index';
import { getRenderSettings } from '../rendering/render-settings';
const SLOT_SIZE = 80;
const CREATURE_DISPLAY = 64;
const SLOT_BG = 0x0d2228;
const SLOT_BORDER = 0x1a3a3f;
const SLOT_HOVER = 0x3aada8;
const HIT_RADIUS = 50;

const ZOOM_MAX = 4.0;
const DRAG_THRESHOLD = 4;

// Theme-specific slot border colors
const THEME_COLORS: Record<string, number> = {
  rock:    0x3a5a60,
  coral:   0x8b3366,
  shell:   0xaa9060,
  anemone: 0x5a8a3a,
  vent:    0x8a5a2a,
};

interface DragState {
  creatureId: string;
  sourceSlotId: string;
  ghost: Sprite;
  startX: number;
  startY: number;
  active: boolean;
}

export interface PoolView {
  viewport: Container;
  gridContainer: Container;
  visuals: Map<string, CreatureVisual>;
  slotGraphics: Map<string, Graphics>;
  onSlotClick: ((slotId: string) => void) | null;
  onExpansionClick: ((slotId: string) => void) | null;
  onCreatureDrop: ((fromSlotId: string, toSlotId: string) => void) | null;
  /** Fires when user taps on empty world space (no slot hit). worldX/worldY in world coords. */
  onWorldTap: ((worldX: number, worldY: number) => void) | null;
  zoom: number;
  _dragged: boolean;
  _stateRef: GameState | null;
  _canvas: HTMLCanvasElement | null;
  _dragState: DragState | null;
  _slotLayer: Container;
  _creatureLayer: Container;
  _collectibleLayer: Container;
  _seabedBg: SeabedBackground | null;
  _slotGlowLayer: Container;
  _slotGlowGraphics: Map<string, Graphics>;
  _app: Application;
  _worldW: number;
  _worldH: number;
  _zoomMin: number;
  /** Mouse position in world space (NaN when outside canvas) */
  mouseWorldX: number;
  mouseWorldY: number;
  /** Cleanup function — removes all event listeners and destroys resources */
  _cleanup: (() => void) | null;
}


/** Convert screen coordinates to world space via viewport transform */
function screenToWorld(pv: PoolView, sx: number, sy: number): [number, number] {
  const wx = (sx - pv.viewport.x) / pv.zoom;
  const wy = (sy - pv.viewport.y) / pv.zoom;
  return [wx, wy];
}

/** Clamp viewport so the world bounds stay within the screen */
function clampViewport(pv: PoolView): void {
  const screenW = pv._app.screen.width;
  const screenH = pv._app.screen.height;
  const worldW = pv._worldW * pv.zoom;
  const worldH = pv._worldH * pv.zoom;

  // If the world is smaller than the screen at this zoom, center it
  if (worldW <= screenW) {
    pv.viewport.x = (screenW - worldW) / 2;
  } else {
    // Don't let left edge go past screen left, or right edge past screen right
    const minX = screenW - worldW;
    const maxX = 0;
    pv.viewport.x = Math.max(minX, Math.min(maxX, pv.viewport.x));
  }

  if (worldH <= screenH) {
    pv.viewport.y = (screenH - worldH) / 2;
  } else {
    const minY = screenH - worldH;
    const maxY = 0;
    pv.viewport.y = Math.max(minY, Math.min(maxY, pv.viewport.y));
  }
}

export function createPoolView(app: Application, _state: GameState): PoolView {
  const viewport = new Container();
  const gridContainer = new Container();

  // Create seabed background as the bottom-most layer (own render group — mostly static)
  const pool = _state.pool;
  const seabedBg = createSeabedBackground(pool.worldWidth, pool.worldHeight, _state.seabedSeed);
  seabedBg.container.isRenderGroup = true;
  gridContainer.addChild(seabedBg.container);

  // Slot glow layer (behind slots)
  const slotGlowLayer = new Container();
  gridContainer.addChild(slotGlowLayer);

  const slotLayer = new Container();
  const collectibleLayer = new Container();
  // Creature layer gets its own render group — many per-frame transforms
  const creatureLayer = new Container();
  creatureLayer.isRenderGroup = true;
  gridContainer.addChild(slotLayer);
  gridContainer.addChild(collectibleLayer);
  gridContainer.addChild(creatureLayer);
  viewport.addChild(gridContainer);
  app.stage.addChild(viewport);

  const poolView: PoolView = {
    viewport,
    gridContainer,
    visuals: new Map(),
    slotGraphics: new Map(),
    onSlotClick: null,
    onExpansionClick: null,
    onCreatureDrop: null,
    onWorldTap: null,
    zoom: 1.0,
    _dragged: false,
    _stateRef: null,
    _canvas: null,
    _dragState: null,
    _slotLayer: slotLayer,
    _creatureLayer: creatureLayer,
    _collectibleLayer: collectibleLayer,
    _seabedBg: seabedBg,
    _slotGlowLayer: slotGlowLayer,
    _slotGlowGraphics: new Map(),
    _app: app,
    _worldW: pool.worldWidth,
    _worldH: pool.worldHeight,
    _zoomMin: 0.5,
    mouseWorldX: NaN,
    mouseWorldY: NaN,
    _cleanup: null,
  };

  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let viewStartX = 0;
  let viewStartY = 0;

  const canvas = app.canvas as HTMLCanvasElement;
  poolView._canvas = canvas;

  // Compute minimum zoom so world always covers the screen
  const updateMinZoom = () => {
    const screenW = app.screen.width;
    const screenH = app.screen.height;
    poolView._zoomMin = Math.max(screenW / pool.worldWidth, screenH / pool.worldHeight);
    if (poolView.zoom < poolView._zoomMin) {
      poolView.zoom = poolView._zoomMin;
      viewport.scale.set(poolView.zoom);
      clampViewport(poolView);
    }
  };
  updateMinZoom();

  // --- Zoom (wheel) ---
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldZoom = poolView.zoom;
    poolView.zoom = Math.max(poolView._zoomMin, Math.min(ZOOM_MAX, poolView.zoom + delta));

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const scale = poolView.zoom / oldZoom;
    viewport.x = mx - (mx - viewport.x) * scale;
    viewport.y = my - (my - viewport.y) * scale;
    viewport.scale.set(poolView.zoom);
    clampViewport(poolView);
  }, { passive: false });

  // --- Pinch-to-zoom (touch) ---
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let pinchMidX = 0;
  let pinchMidY = 0;
  let isPinching = false;

  function touchDist(t1: Touch, t2: Touch): number {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinching = true;
      isPanning = false;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartZoom = poolView.zoom;
      const rect = canvas.getBoundingClientRect();
      pinchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      pinchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isPinching || e.touches.length < 2) return;
    e.preventDefault();
    const dist = touchDist(e.touches[0], e.touches[1]);
    const ratio = dist / pinchStartDist;
    const oldZoom = poolView.zoom;
    poolView.zoom = Math.max(poolView._zoomMin, Math.min(ZOOM_MAX, pinchStartZoom * ratio));
    const scale = poolView.zoom / oldZoom;
    viewport.x = pinchMidX - (pinchMidX - viewport.x) * scale;
    viewport.y = pinchMidY - (pinchMidY - viewport.y) * scale;
    viewport.scale.set(poolView.zoom);
    clampViewport(poolView);
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      isPinching = false;
    }
  };

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd);

  // --- Pointerdown: start creature drag or pan ---
  canvas.addEventListener('pointerdown', (e) => {
    poolView._dragged = false;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (poolView._stateRef) {
      const [wx, wy] = screenToWorld(poolView, sx, sy);
      const slot = worldToSlot(poolView._stateRef.pool, wx, wy, HIT_RADIUS);
      if (slot?.unlocked && slot.creatureId) {
        poolView._dragState = {
          creatureId: slot.creatureId,
          sourceSlotId: slot.id,
          ghost: new Sprite(),
          startX: e.clientX,
          startY: e.clientY,
          active: false,
        };
        return;
      }
    }

    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    viewStartX = viewport.x;
    viewStartY = viewport.y;
  });

  const onPointerMove = (e: PointerEvent) => {
    // Track mouse world position for collectible system
    const mRect = canvas.getBoundingClientRect();
    const msx = e.clientX - mRect.left;
    const msy = e.clientY - mRect.top;
    const [mwx, mwy] = screenToWorld(poolView, msx, msy);
    poolView.mouseWorldX = mwx;
    poolView.mouseWorldY = mwy;

    const ds = poolView._dragState;

    if (ds) {
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;

      if (!ds.active) {
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
          ds.active = true;
          poolView._dragged = true;

          const visual = poolView.visuals.get(ds.creatureId);
          if (visual) {
            const ghost = new Sprite(visual.texture);
            ghost.width = CREATURE_DISPLAY;
            ghost.height = CREATURE_DISPLAY;
            ghost.alpha = 0.6;
            ghost.anchor.set(0.5);
            app.stage.addChild(ghost);
            ds.ghost = ghost;
            visual.sprite.alpha = 0.3;
          }
        }
      }

      if (ds.active && ds.ghost.texture) {
        const rect = canvas.getBoundingClientRect();
        ds.ghost.x = e.clientX - rect.left;
        ds.ghost.y = e.clientY - rect.top;
      }
      return;
    }

    if (!isPanning) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      poolView._dragged = true;
    }
    viewport.x = viewStartX + dx;
    viewport.y = viewStartY + dy;
    clampViewport(poolView);
  };

  const onPointerUp = (e: PointerEvent) => {
    const ds = poolView._dragState;

    if (ds) {
      if (ds.active) {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const [wx, wy] = screenToWorld(poolView, sx, sy);

        if (poolView._stateRef) {
          const target = worldToSlot(poolView._stateRef.pool, wx, wy, HIT_RADIUS);
          if (target && target.unlocked && target.creatureId === null && target.id !== ds.sourceSlotId) {
            poolView.onCreatureDrop?.(ds.sourceSlotId, target.id);
          }
        }

        if (ds.ghost.parent) ds.ghost.destroy();
        const visual = poolView.visuals.get(ds.creatureId);
        if (visual) visual.sprite.alpha = 1;
      } else {
        // Click on slot
        poolView.onSlotClick?.(ds.sourceSlotId);
      }

      poolView._dragState = null;
      return;
    }

    if (!poolView._dragged) {
      // Tap on empty space — fire world tap for collectible click detection
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [wx, wy] = screenToWorld(poolView, sx, sy);
      poolView.onWorldTap?.(wx, wy);
    }
    isPanning = false;
  };

  const onPointerLeave = () => {
    poolView.mouseWorldX = NaN;
    poolView.mouseWorldY = NaN;
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  centerViewport(poolView, app);
  const onResize = () => centerViewport(poolView, app);
  app.renderer.on('resize', updateMinZoom);
  app.renderer.on('resize', onResize);

  // Store cleanup function to remove all external listeners
  poolView._cleanup = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    canvas.removeEventListener('touchend', onTouchEnd);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    app.renderer.off('resize', updateMinZoom);
    app.renderer.off('resize', onResize);
  };

  return poolView;
}

/** Destroy a pool view, removing all event listeners and freeing resources */
export function destroyPoolView(poolView: PoolView): void {
  // Remove external event listeners
  poolView._cleanup?.();
  poolView._cleanup = null;

  // Destroy creature visuals (and clean up effect state)
  for (const [id, visual] of poolView.visuals) {
    cleanupEffectState(id);
    destroyCreatureVisual(visual);
  }
  poolView.visuals.clear();

  // Destroy slot graphics
  for (const gfx of poolView.slotGraphics.values()) gfx.destroy();
  poolView.slotGraphics.clear();

  // Destroy glow graphics
  for (const gfx of poolView._slotGlowGraphics.values()) gfx.destroy();
  poolView._slotGlowGraphics.clear();

  // Destroy seabed background (textures + containers)
  if (poolView._seabedBg) {
    destroySeabedBackground(poolView._seabedBg);
    poolView._seabedBg = null;
  }

  // Destroy viewport and all remaining children
  poolView.viewport.destroy({ children: true });
}

function centerViewport(poolView: PoolView, _app: Application): void {
  const screenW = poolView._app.screen.width;
  const screenH = poolView._app.screen.height;
  const slots = allSlots(poolView._stateRef?.pool ?? { slots: {}, worldWidth: 1920, worldHeight: 1080 });
  const unlocked = slots.filter(s => s.unlocked);
  if (unlocked.length === 0) {
    poolView.viewport.x = screenW / 2 - (poolView._worldW * poolView.zoom) / 2;
    poolView.viewport.y = screenH / 2 - (poolView._worldH * poolView.zoom) / 2;
  } else {
    const avgX = unlocked.reduce((s, sl) => s + sl.x, 0) / unlocked.length;
    const avgY = unlocked.reduce((s, sl) => s + sl.y, 0) / unlocked.length;
    poolView.viewport.x = Math.round(screenW / 2 - avgX * poolView.zoom);
    poolView.viewport.y = Math.round(screenH / 2 - avgY * poolView.zoom);
  }
  poolView.viewport.scale.set(poolView.zoom);
  clampViewport(poolView);
}

// --- Camera pan animation ---

let panAnimId: number | null = null;

/** Smoothly pan the camera to center on a world position over `durationMs` (default 500ms). */
export function panToWorldPos(poolView: PoolView, worldX: number, worldY: number, durationMs = 500): void {
  // Cancel any in-progress pan
  if (panAnimId !== null) cancelAnimationFrame(panAnimId);

  const screenW = poolView._app.screen.width;
  const screenH = poolView._app.screen.height;
  const targetX = Math.round(screenW / 2 - worldX * poolView.zoom);
  const targetY = Math.round(screenH / 2 - worldY * poolView.zoom);
  const startX = poolView.viewport.x;
  const startY = poolView.viewport.y;
  const startTime = performance.now();

  function step() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    // Ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3);

    poolView.viewport.x = startX + (targetX - startX) * ease;
    poolView.viewport.y = startY + (targetY - startY) * ease;
    clampViewport(poolView);

    if (t < 1) {
      panAnimId = requestAnimationFrame(step);
    } else {
      panAnimId = null;
    }
  }

  panAnimId = requestAnimationFrame(step);
}

/** Sync creature visuals and slot graphics with game state */
export function syncPoolVisuals(poolView: PoolView, state: GameState): void {
  poolView._stateRef = state;

  // --- Sync slot backgrounds ---
  const allSlotsList = allSlots(state.pool);
  const currentSlotIds = new Set<string>();

  for (const slot of allSlotsList) {
    currentSlotIds.add(slot.id);

    const aff = !slot.unlocked && canAffordSlot(state.resources, slot.tier);

    if (!poolView.slotGraphics.has(slot.id)) {
      const gfx = new Graphics();
      drawSlot(gfx, slot, aff);
      ensureSlotCostText(gfx, slot, aff);

      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';

      gfx.on('pointerenter', () => {
        const res = poolView._stateRef?.resources ?? { plankton: 0, minerite: 0, lux: 0, nacre: 0, coral: 0 };
        const canBuy = !slot.unlocked && canAffordSlot(res, slot.tier);
        gfx.clear();
        drawSlotHighlight(gfx, slot, canBuy);
      });

      gfx.on('pointerleave', () => {
        const res = poolView._stateRef?.resources ?? { plankton: 0, minerite: 0, lux: 0, nacre: 0, coral: 0 };
        const canBuy = !slot.unlocked && canAffordSlot(res, slot.tier);
        gfx.clear();
        drawSlot(gfx, slot, canBuy);
      });

      gfx.on('pointertap', () => {
        if (poolView._dragged) return;
        if (slot.unlocked) {
          poolView.onSlotClick?.(slot.id);
        } else {
          poolView.onExpansionClick?.(slot.id);
        }
      });

      poolView._slotLayer.addChild(gfx);
      poolView.slotGraphics.set(slot.id, gfx);
    } else {
      const gfx = poolView.slotGraphics.get(slot.id)!;
      gfx.clear();
      drawSlot(gfx, slot, aff);
      ensureSlotCostText(gfx, slot, aff);
    }
  }

  // Remove obsolete slot graphics
  for (const [id, gfx] of poolView.slotGraphics) {
    if (!currentSlotIds.has(id)) {
      gfx.destroy();
      poolView.slotGraphics.delete(id);
    }
  }

  // --- Sync slot glow (for occupied slots) ---
  syncSlotGlow(poolView, state);

  // --- Sync creature visuals ---
  const currentCreatureIds = new Set<string>();

  for (const slot of allSlotsList) {
    if (!slot.unlocked || !slot.creatureId) continue;
    const creature = getCreatureAt(state, slot.id);
    if (!creature) continue;

    currentCreatureIds.add(creature.id);

    const cx = slot.x - CREATURE_DISPLAY / 2;
    const cy = slot.y - CREATURE_DISPLAY / 2;

    if (!poolView.visuals.has(creature.id)) {
      const visual = createCreatureVisual(creature);
      visual.sprite.eventMode = 'none';
      visual.mainSprite.width = CREATURE_DISPLAY;
      visual.mainSprite.height = CREATURE_DISPLAY;
      if (visual.glowSprite) {
        visual.glowSprite.width = CREATURE_DISPLAY;
        visual.glowSprite.height = CREATURE_DISPLAY;
      }
      // Special pivot setup for movement-based rare effects
      const needsCenterPivot = creature.rare === 'rotating' || creature.rare === 'pulse' || creature.rare === 'tiny';
      if (needsCenterPivot) {
        const half = CREATURE_DISPLAY / 2;
        visual.sprite.pivot.set(half, half);
        visual.sprite.x = cx + half;
        visual.sprite.y = cy + half;
      } else if (creature.rare === 'upside-down') {
        const half = CREATURE_DISPLAY / 2;
        visual.sprite.pivot.set(half, 0);
        visual.sprite.scale.y = -1;
        visual.sprite.x = cx + half;
        visual.sprite.y = cy + CREATURE_DISPLAY;
      } else {
        visual.sprite.x = cx;
        visual.sprite.y = cy;
      }
      poolView._creatureLayer.addChild(visual.sprite);
      poolView.visuals.set(creature.id, visual);
    } else {
      const visual = poolView.visuals.get(creature.id)!;
      const needsCenterPivot = creature.rare === 'rotating' || creature.rare === 'pulse' || creature.rare === 'tiny';
      if (needsCenterPivot) {
        const half = CREATURE_DISPLAY / 2;
        visual.sprite.x = cx + half;
        visual.sprite.y = cy + half;
      } else if (creature.rare === 'upside-down') {
        const half = CREATURE_DISPLAY / 2;
        visual.sprite.x = cx + half;
        visual.sprite.y = cy + CREATURE_DISPLAY;
      } else {
        visual.sprite.x = cx;
        visual.sprite.y = cy;
      }
    }
  }

  // Remove visuals for creatures no longer in pool
  for (const [id, visual] of poolView.visuals) {
    if (!currentCreatureIds.has(id)) {
      destroyCreatureVisual(visual);
      poolView.visuals.delete(id);
    }
  }
}

/** Sync glow graphics behind occupied slots */
function syncSlotGlow(poolView: PoolView, state: GameState): void {
  const settings = getRenderSettings();
  poolView._slotGlowLayer.visible = settings.slotGlow;

  const allSlotsList = allSlots(state.pool);
  const occupiedIds = new Set<string>();

  for (const slot of allSlotsList) {
    if (!slot.unlocked || !slot.creatureId) continue;
    occupiedIds.add(slot.id);

    if (!poolView._slotGlowGraphics.has(slot.id)) {
      const gfx = new Graphics();
      drawSlotGlow(gfx, slot);
      poolView._slotGlowLayer.addChild(gfx);
      poolView._slotGlowGraphics.set(slot.id, gfx);
    }
  }

  // Remove glow for empty slots
  for (const [id, gfx] of poolView._slotGlowGraphics) {
    if (!occupiedIds.has(id)) {
      gfx.destroy();
      poolView._slotGlowGraphics.delete(id);
    }
  }
}

function drawSlotGlow(gfx: Graphics, slot: SeabedSlot): void {
  const themeColor = THEME_COLORS[slot.theme] ?? SLOT_BORDER;
  const r = SLOT_SIZE * 0.8;
  gfx.circle(slot.x, slot.y, r);
  gfx.fill({ color: themeColor, alpha: 0.12 });
  gfx.circle(slot.x, slot.y, r * 0.6);
  gfx.fill({ color: themeColor, alpha: 0.08 });
  gfx.circle(slot.x, slot.y, r * 0.35);
  gfx.fill({ color: themeColor, alpha: 0.06 });
}

/** Check if a world-space point is within the visible viewport (with margin) */
function isInViewport(pv: PoolView, worldX: number, worldY: number, margin: number): boolean {
  const screenX = worldX * pv.zoom + pv.viewport.x;
  const screenY = worldY * pv.zoom + pv.viewport.y;
  const sw = pv._app.screen.width;
  const sh = pv._app.screen.height;
  return screenX > -margin && screenX < sw + margin && screenY > -margin && screenY < sh + margin;
}

/** Update all creature animations + seabed background */
export function updatePoolVisuals(poolView: PoolView, deltaSec: number, totalTime: number): void {
  // Update seabed background (particles, light rays)
  if (poolView._seabedBg) {
    updateSeabedBackground(poolView._seabedBg, deltaSec);
  }

  // Update slot glow pulsing
  const settings = getRenderSettings();
  if (settings.slotGlow) {
    let i = 0;
    for (const gfx of poolView._slotGlowGraphics.values()) {
      // Each slot pulses with a slight phase offset for variety
      gfx.alpha = 0.5 + Math.sin(totalTime * 1.2 + i * 0.8) * 0.35;
      i++;
    }
  }

  // Update creature animations (skip off-screen creatures)
  const cullMargin = CREATURE_DISPLAY * poolView.zoom + 20;
  for (const visual of poolView.visuals.values()) {
    const wx = visual.sprite.x;
    const wy = visual.sprite.y;
    if (isInViewport(poolView, wx, wy, cullMargin)) {
      updateCreatureVisual(visual, deltaSec, totalTime);
    }
  }
}

// --- Drawing helpers ---

/** Shared text styles for cost labels on locked slots */
const COST_STYLE_AFFORDABLE = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: '#7eeee4',
  align: 'center',
});
const COST_STYLE_LOCKED = new TextStyle({
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 7,
  fill: '#2a4a4f',
  align: 'center',
});

/** Check if the player can afford a slot's unlock cost */
function canAffordSlot(res: ResourceBundle, tier: number): boolean {
  const cost = getSlotUnlockCost(tier);
  return res.nacre >= cost.nacre;
}

/** Format slot cost as a display string */
function formatSlotCost(cost: ResourceBundle): string {
  if (cost.nacre > 0) return `${cost.nacre} \u26AC`;
  return '';
}

/** Draw a pixel-art padlock icon centred at (cx, cy) */
function drawLockIcon(gfx: Graphics, cx: number, cy: number, affordable = false): void {
  const c = affordable ? 0x7eeee4 : 0x2a4a4f;
  const a = affordable ? 0.9 : 0.6;
  const px = 2; // pixel size

  // Shackle (arch)
  gfx.rect(cx - 1 * px, cy - 7 * px, 2 * px, px); // top bar
  gfx.fill({ color: c, alpha: a });
  gfx.rect(cx - 3 * px, cy - 6 * px, px, 3 * px); // left arm
  gfx.fill({ color: c, alpha: a });
  gfx.rect(cx + 2 * px, cy - 6 * px, px, 3 * px); // right arm
  gfx.fill({ color: c, alpha: a });

  // Lock body
  const bx = cx - 4 * px;
  const by = cy - 3 * px;
  const bw = 8 * px;
  const bh = 6 * px;
  gfx.roundRect(bx, by, bw, bh, 2);
  gfx.fill({ color: c, alpha: a });

  // Keyhole
  gfx.rect(cx - 0.5 * px, cy - 1 * px, px, 2 * px);
  gfx.fill({ color: SLOT_BG, alpha: 0.9 });
}

function drawSlot(gfx: Graphics, slot: SeabedSlot, affordable = false): void {
  const x = slot.x - SLOT_SIZE / 2;
  const y = slot.y - SLOT_SIZE / 2;
  const themeColor = THEME_COLORS[slot.theme] ?? SLOT_BORDER;

  if (slot.unlocked) {
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.7 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: themeColor, width: 2, alpha: 0.6 });
  } else if (affordable) {
    // Affordable: bright border, inviting appearance
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.6 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: 0x3aada8, width: 2, alpha: 0.8 });
    drawLockIcon(gfx, slot.x, slot.y - 14, true);
  } else {
    // Too expensive: dim, ghostly
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.25 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: SLOT_BORDER, width: 1, alpha: 0.3 });
    drawLockIcon(gfx, slot.x, slot.y - 14, false);
  }
}

/** Create (or update) the cost Text child on a locked slot Graphics */
function ensureSlotCostText(gfx: Graphics, slot: SeabedSlot, affordable = false): void {
  // Remove any previous cost text children
  for (let i = gfx.children.length - 1; i >= 0; i--) {
    const child = gfx.children[i];
    if (child instanceof Text) {
      child.destroy();
    }
  }

  if (slot.unlocked) return;

  const cost = getSlotUnlockCost(slot.tier);
  const label = formatSlotCost(cost);
  if (!label) return;

  const style = affordable ? COST_STYLE_AFFORDABLE : COST_STYLE_LOCKED;
  const text = new Text({ text: label, style });
  text.resolution = ZOOM_MAX;
  text.anchor.set(0.5, 0);
  text.x = slot.x;
  text.y = slot.y + 6; // below padlock
  gfx.addChild(text);
}

function drawSlotHighlight(gfx: Graphics, slot: SeabedSlot, affordable = false): void {
  const x = slot.x - SLOT_SIZE / 2;
  const y = slot.y - SLOT_SIZE / 2;

  if (slot.unlocked) {
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.8 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: SLOT_HOVER, width: 2 });
  } else if (affordable) {
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.65 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: 0x7eeee4, width: 2 });
    drawLockIcon(gfx, slot.x, slot.y - 14, true);
  } else {
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.35 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: 0x1a3a3f, width: 1, alpha: 0.5 });
    drawLockIcon(gfx, slot.x, slot.y - 14, false);
  }
}
