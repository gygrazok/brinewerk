import { Container, Graphics, Sprite } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameState, SeabedSlot } from '../core/game-state';
import { getCreatureAt } from '../systems/pool';
import { getExpansionCost } from '../core/balance';
import { allSlots, slotCount, worldToSlot } from '../systems/coords';
import {
  createCreatureVisual,
  updateCreatureVisual,
  destroyCreatureVisual,
  type CreatureVisual,
} from '../rendering/creature-renderer';
import {
  createSeabedBackground,
  updateSeabedBackground,
  type SeabedBackground,
} from '../rendering/seabed-bg';
import { getRenderSettings } from '../rendering/render-settings';
import { UPGRADE_ANCHORS } from '../systems/seabed-layout';

const SLOT_SIZE = 80;
const CREATURE_DISPLAY = 64;
const SLOT_BG = 0x0d2228;
const SLOT_BORDER = 0x1a3a3f;
const SLOT_HOVER = 0x3aada8;
const SLOT_LOCKED_ALPHA = 0.3;
const HIT_RADIUS = 50;
const ANCHOR_RADIUS = 16;


let ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
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
  onUpgradeNodeClick: ((anchorId: string) => void) | null;
  onCreatureDrop: ((fromSlotId: string, toSlotId: string) => void) | null;
  zoom: number;
  _dragged: boolean;
  _stateRef: GameState | null;
  _canvas: HTMLCanvasElement | null;
  _dragState: DragState | null;
  _slotLayer: Container;
  _creatureLayer: Container;
  _seabedBg: SeabedBackground | null;
  _anchorLayer: Container;
  _anchorGraphics: Map<string, Graphics>;
  _slotGlowLayer: Container;
  _slotGlowGraphics: Map<string, Graphics>;
  _app: Application;
  _worldW: number;
  _worldH: number;
}

// --- Cost tooltip ---
let tooltip: HTMLDivElement | null = null;

function ensureTooltip(): HTMLDivElement {
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.style.cssText =
      'position:fixed;pointer-events:none;opacity:0;transition:opacity .15s;' +
      'background:#0a1a20;border:1px solid #1a3a3f;border-radius:4px;padding:4px 8px;' +
      'font-family:"Press Start 2P",monospace;font-size:9px;color:#3aada8;white-space:nowrap;z-index:100;';
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function showTooltip(screenX: number, screenY: number, state: GameState) {
  const tip = ensureTooltip();
  const cost = getExpansionCost(slotCount(state.pool));
  const parts: string[] = [];
  if (cost.plankton > 0) parts.push(`${cost.plankton}\u{1F7E2}`);
  if (cost.minerite > 0) parts.push(`${cost.minerite}\u{1F535}`);
  if (cost.lux > 0) parts.push(`${cost.lux}\u2728`);
  tip.textContent = parts.join(' + ');
  tip.style.left = `${screenX + 12}px`;
  tip.style.top = `${screenY - 8}px`;
  tip.style.opacity = '1';
}

function hideTooltip() {
  if (tooltip) tooltip.style.opacity = '0';
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

  // Create seabed background as the bottom-most layer
  const pool = _state.pool;
  const seabedBg = createSeabedBackground(pool.worldWidth, pool.worldHeight, _state.seabedSeed);
  gridContainer.addChild(seabedBg.container);

  // Slot glow layer (behind slots)
  const slotGlowLayer = new Container();
  gridContainer.addChild(slotGlowLayer);

  const slotLayer = new Container();
  const anchorLayer = new Container();
  const creatureLayer = new Container();
  gridContainer.addChild(slotLayer);
  gridContainer.addChild(anchorLayer);
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
    onUpgradeNodeClick: null,
    onCreatureDrop: null,
    zoom: 1.0,
    _dragged: false,
    _stateRef: null,
    _canvas: null,
    _dragState: null,
    _slotLayer: slotLayer,
    _creatureLayer: creatureLayer,
    _seabedBg: seabedBg,
    _anchorLayer: anchorLayer,
    _anchorGraphics: new Map(),
    _slotGlowLayer: slotGlowLayer,
    _slotGlowGraphics: new Map(),
    _app: app,
    _worldW: pool.worldWidth,
    _worldH: pool.worldHeight,
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
    ZOOM_MIN = Math.max(screenW / pool.worldWidth, screenH / pool.worldHeight);
    if (poolView.zoom < ZOOM_MIN) {
      poolView.zoom = ZOOM_MIN;
      viewport.scale.set(poolView.zoom);
      clampViewport(poolView);
    }
  };
  updateMinZoom();
  app.renderer.on('resize', updateMinZoom);

  // --- Zoom ---
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    hideTooltip();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldZoom = poolView.zoom;
    poolView.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, poolView.zoom + delta));

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const scale = poolView.zoom / oldZoom;
    viewport.x = mx - (mx - viewport.x) * scale;
    viewport.y = my - (my - viewport.y) * scale;
    viewport.scale.set(poolView.zoom);
    clampViewport(poolView);
  }, { passive: false });

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

    isPanning = false;
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Create upgrade anchor graphics
  syncUpgradeAnchors(poolView);

  centerViewport(poolView, app);
  app.renderer.on('resize', () => centerViewport(poolView, app));

  return poolView;
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

/** Create/update upgrade anchor point graphics */
function syncUpgradeAnchors(poolView: PoolView): void {
  for (const anchorDef of UPGRADE_ANCHORS) {
    if (poolView._anchorGraphics.has(anchorDef.id)) continue;

    const gfx = new Graphics();
    drawAnchor(gfx, anchorDef.x, anchorDef.y, false);

    gfx.eventMode = 'static';
    gfx.cursor = 'pointer';

    gfx.on('pointerenter', () => {
      gfx.clear();
      drawAnchor(gfx, anchorDef.x, anchorDef.y, true);
    });
    gfx.on('pointerleave', () => {
      const installed = poolView._stateRef?.upgradeAnchors.find(a => a.id === anchorDef.id);
      gfx.clear();
      drawAnchor(gfx, anchorDef.x, anchorDef.y, false, !!installed?.upgradeType);
    });
    gfx.on('pointertap', () => {
      if (poolView._dragged) return;
      poolView.onUpgradeNodeClick?.(anchorDef.id);
    });

    poolView._anchorLayer.addChild(gfx);
    poolView._anchorGraphics.set(anchorDef.id, gfx);
  }
}

function drawAnchor(gfx: Graphics, x: number, y: number, hover: boolean, installed = false): void {
  if (installed) {
    // Filled diamond for installed upgrade
    gfx.star(x, y, 4, ANCHOR_RADIUS, ANCHOR_RADIUS * 0.5);
    gfx.fill({ color: 0x3aada8, alpha: 0.6 });
    gfx.star(x, y, 4, ANCHOR_RADIUS, ANCHOR_RADIUS * 0.5);
    gfx.stroke({ color: 0x7eeee4, width: 1 });
  } else {
    // Empty diamond for available anchor
    gfx.star(x, y, 4, ANCHOR_RADIUS * 0.8, ANCHOR_RADIUS * 0.4);
    gfx.fill({ color: 0x0d2228, alpha: 0.5 });
    gfx.star(x, y, 4, ANCHOR_RADIUS * 0.8, ANCHOR_RADIUS * 0.4);
    gfx.stroke({ color: hover ? 0x7eeee4 : 0x1a3a3f, width: hover ? 2 : 1 });
    // Small "+" inside
    gfx.rect(x - 3, y - 0.5, 6, 1);
    gfx.fill({ color: hover ? 0x7eeee4 : 0x3a5a60, alpha: 0.7 });
    gfx.rect(x - 0.5, y - 3, 1, 6);
    gfx.fill({ color: hover ? 0x7eeee4 : 0x3a5a60, alpha: 0.7 });
  }
}

/** Sync creature visuals and slot graphics with game state */
export function syncPoolVisuals(poolView: PoolView, state: GameState): void {
  poolView._stateRef = state;

  // --- Sync slot backgrounds ---
  const allSlotsList = allSlots(state.pool);
  const currentSlotIds = new Set<string>();

  for (const slot of allSlotsList) {
    currentSlotIds.add(slot.id);

    if (!poolView.slotGraphics.has(slot.id)) {
      const gfx = new Graphics();
      drawSlot(gfx, slot);

      gfx.eventMode = 'static';
      gfx.cursor = 'pointer';

      gfx.on('pointerenter', (e: any) => {
        gfx.clear();
        drawSlotHighlight(gfx, slot);
        if (!slot.unlocked && poolView._stateRef && poolView._canvas) {
          const gx = e.global?.x ?? 0;
          const gy = e.global?.y ?? 0;
          const rect = poolView._canvas.getBoundingClientRect();
          showTooltip(rect.left + gx, rect.top + gy, poolView._stateRef);
        }
      });

      gfx.on('pointerleave', () => {
        gfx.clear();
        drawSlot(gfx, slot);
        hideTooltip();
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
      drawSlot(gfx, slot);
    }
  }

  // Remove obsolete slot graphics
  for (const [id, gfx] of poolView.slotGraphics) {
    if (!currentSlotIds.has(id)) {
      gfx.destroy();
      poolView.slotGraphics.delete(id);
    }
  }

  // --- Sync upgrade anchor visuals ---
  for (const anchorDef of UPGRADE_ANCHORS) {
    const gfx = poolView._anchorGraphics.get(anchorDef.id);
    if (!gfx) continue;
    const installed = state.upgradeAnchors.find(a => a.id === anchorDef.id);
    gfx.clear();
    drawAnchor(gfx, anchorDef.x, anchorDef.y, false, !!installed?.upgradeType);
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
      visual.sprite.x = cx;
      visual.sprite.y = cy;
      visual.sprite.eventMode = 'none';
      visual.mainSprite.width = CREATURE_DISPLAY;
      visual.mainSprite.height = CREATURE_DISPLAY;
      if (visual.glowSprite) {
        visual.glowSprite.width = CREATURE_DISPLAY;
        visual.glowSprite.height = CREATURE_DISPLAY;
      }
      poolView._creatureLayer.addChild(visual.sprite);
      poolView.visuals.set(creature.id, visual);
    } else {
      const visual = poolView.visuals.get(creature.id)!;
      visual.sprite.x = cx;
      visual.sprite.y = cy;
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

  // Update creature animations
  for (const visual of poolView.visuals.values()) {
    updateCreatureVisual(visual, deltaSec, totalTime);
  }
}

// --- Drawing helpers ---

function drawSlot(gfx: Graphics, slot: SeabedSlot): void {
  const x = slot.x - SLOT_SIZE / 2;
  const y = slot.y - SLOT_SIZE / 2;
  const themeColor = THEME_COLORS[slot.theme] ?? SLOT_BORDER;

  if (slot.unlocked) {
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: 0.7 });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: themeColor, width: 1, alpha: 0.6 });
  } else {
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.fill({ color: SLOT_BG, alpha: SLOT_LOCKED_ALPHA });
    gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
    gfx.stroke({ color: SLOT_BORDER, width: 1, alpha: SLOT_LOCKED_ALPHA });
    // Lock icon "+"
    const cx = slot.x;
    const cy = slot.y;
    gfx.rect(cx - 6, cy - 1, 12, 2);
    gfx.fill({ color: SLOT_BORDER, alpha: 0.5 });
    gfx.rect(cx - 1, cy - 6, 2, 12);
    gfx.fill({ color: SLOT_BORDER, alpha: 0.5 });
  }
}

function drawSlotHighlight(gfx: Graphics, slot: SeabedSlot): void {
  const x = slot.x - SLOT_SIZE / 2;
  const y = slot.y - SLOT_SIZE / 2;

  gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
  gfx.fill(slot.unlocked ? { color: SLOT_BG, alpha: 0.8 } : { color: SLOT_BG, alpha: 0.5 });
  gfx.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 6);
  gfx.stroke({ color: SLOT_HOVER, width: 2 });
}
