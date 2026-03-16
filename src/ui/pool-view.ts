import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameState } from '../core/game-state';
import { getCreatureAt } from '../systems/pool';
import { getExpansionCost } from '../core/balance';
import {
  allSlots,
  slotCount,
  getGridBounds,
  getExpansionCandidates,
  getUpgradeNodePositions,
  toKey,
  type CoordKey,
} from '../systems/coords';
import {
  createCreatureVisual,
  updateCreatureVisual,
  destroyCreatureVisual,
  type CreatureVisual,
} from '../rendering/creature-renderer';

const SLOT_SIZE = 80; // px per slot
const SLOT_PAD = 6;
const CREATURE_DISPLAY = 64;
const SLOT_BG = 0x0d2228;
const SLOT_BORDER = 0x1a3a3f;
const SLOT_HOVER = 0x3aada8;

const EXPAND_BTN_SIZE = 40;
const EXPAND_BG = 0x0a1a20;
const EXPAND_BORDER = 0x1a3a3f;
const EXPAND_HOVER_BORDER = 0x3aada8;

const NODE_SIZE = 24;
const NODE_EMPTY_COLOR = 0x1a3a3f;
const NODE_ACTIVE_COLOR = 0x4aad4a;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const DRAG_THRESHOLD = 4;

export interface PoolView {
  viewport: Container;
  gridContainer: Container;
  visuals: Map<string, CreatureVisual>;
  slotGraphics: Map<CoordKey, Graphics>;
  expandBtns: Map<CoordKey, Container>;
  upgradeNodeGraphics: Map<CoordKey, Container>;
  selectedSlot: [number, number] | null;
  onSlotClick: ((row: number, col: number) => void) | null;
  onExpansionClick: ((row: number, col: number) => void) | null;
  onUpgradeNodeClick: ((row: number, col: number) => void) | null;
  zoom: number;
  /** Internal: true if user dragged (to suppress click after pan) */
  _dragged: boolean;
  /** Internal: latest state ref for tooltip cost display */
  _stateRef: GameState | null;
  /** Internal: canvas ref for tooltip positioning */
  _canvas: HTMLCanvasElement | null;
}

// --- Cost tooltip (HTML overlay, module-level singleton) ---
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

/** Convert grid row/col to pixel position relative to grid origin */
function slotPixelX(col: number, minC: number): number {
  return (col - minC) * (SLOT_SIZE + SLOT_PAD);
}

function slotPixelY(row: number, minR: number): number {
  return (row - minR) * (SLOT_SIZE + SLOT_PAD);
}

export function createPoolView(app: Application, _state: GameState): PoolView {
  const viewport = new Container();
  const gridContainer = new Container();
  viewport.addChild(gridContainer);
  app.stage.addChild(viewport);

  const poolView: PoolView = {
    viewport,
    gridContainer,
    visuals: new Map(),
    slotGraphics: new Map(),
    expandBtns: new Map(),
    upgradeNodeGraphics: new Map(),
    selectedSlot: null,
    onSlotClick: null,
    onExpansionClick: null,
    onUpgradeNodeClick: null,
    zoom: 1.0,
    _dragged: false,
    _stateRef: null,
    _canvas: null,
  };

  // --- Zoom & Pan ---
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let viewStartX = 0;
  let viewStartY = 0;

  const canvas = app.canvas as HTMLCanvasElement;
  poolView._canvas = canvas;

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    hideTooltip();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const oldZoom = poolView.zoom;
    poolView.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, poolView.zoom + delta));

    // Zoom toward mouse pointer
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const scale = poolView.zoom / oldZoom;
    viewport.x = mx - (mx - viewport.x) * scale;
    viewport.y = my - (my - viewport.y) * scale;
    viewport.scale.set(poolView.zoom);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    poolView._dragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    viewStartX = viewport.x;
    viewStartY = viewport.y;
  });

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      poolView._dragged = true;
    }
    viewport.x = viewStartX + dx;
    viewport.y = viewStartY + dy;
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  // Center viewport initially
  centerViewport(poolView, app);

  // Re-center on resize
  app.renderer.on('resize', () => centerViewport(poolView, app));

  return poolView;
}

function centerViewport(poolView: PoolView, app: Application): void {
  const gridW = poolView.gridContainer.width * poolView.zoom;
  const gridH = poolView.gridContainer.height * poolView.zoom;
  poolView.viewport.x = Math.round((app.screen.width - gridW) / 2);
  poolView.viewport.y = Math.round((app.screen.height - gridH) / 2);
  poolView.viewport.scale.set(poolView.zoom);
}

/** Sync creature visuals, slot backgrounds, expansion buttons, and upgrade nodes with game state */
export function syncPoolVisuals(poolView: PoolView, state: GameState): void {
  poolView._stateRef = state;
  const bounds = getGridBounds(state.pool);
  const { minR, minC } = bounds;

  // --- Sync slot backgrounds ---
  const currentSlotKeys = new Set<CoordKey>();
  for (const [r, c] of allSlots(state.pool)) {
    const key = toKey(r, c);
    currentSlotKeys.add(key);

    if (!poolView.slotGraphics.has(key)) {
      const x = slotPixelX(c, minC);
      const y = slotPixelY(r, minR);

      const slot = new Graphics();
      drawSlotNormal(slot, x, y);

      slot.eventMode = 'static';
      slot.cursor = 'pointer';

      slot.on('pointerenter', () => {
        slot.clear();
        slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
        slot.fill(SLOT_BG);
        slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
        slot.stroke({ color: SLOT_HOVER, width: 2 });
      });

      slot.on('pointerleave', () => {
        drawSlotNormal(slot, x, y);
      });

      slot.on('pointertap', () => {
        if (poolView._dragged) return;
        poolView.selectedSlot = [r, c];
        poolView.onSlotClick?.(r, c);
      });

      poolView.gridContainer.addChild(slot);
      poolView.slotGraphics.set(key, slot);
    }
  }

  // Remove slots no longer in pool
  for (const [key, gfx] of poolView.slotGraphics) {
    if (!currentSlotKeys.has(key)) {
      gfx.destroy();
      poolView.slotGraphics.delete(key);
    }
  }

  // --- Sync creature visuals ---
  const currentIds = new Set<string>();

  for (const [r, c] of allSlots(state.pool)) {
    const creature = getCreatureAt(state, r, c);
    if (!creature) continue;

    currentIds.add(creature.id);

    if (!poolView.visuals.has(creature.id)) {
      const visual = createCreatureVisual(creature);
      const x = slotPixelX(c, minC) + (SLOT_SIZE - CREATURE_DISPLAY) / 2;
      const y = slotPixelY(r, minR) + (SLOT_SIZE - CREATURE_DISPLAY) / 2;
      visual.sprite.x = x;
      visual.sprite.y = y;
      visual.mainSprite.width = CREATURE_DISPLAY;
      visual.mainSprite.height = CREATURE_DISPLAY;
      if (visual.glowSprite) {
        visual.glowSprite.width = CREATURE_DISPLAY;
        visual.glowSprite.height = CREATURE_DISPLAY;
      }
      poolView.gridContainer.addChild(visual.sprite);
      poolView.visuals.set(creature.id, visual);
    } else {
      // Update position (in case grid origin shifted)
      const visual = poolView.visuals.get(creature.id)!;
      const x = slotPixelX(c, minC) + (SLOT_SIZE - CREATURE_DISPLAY) / 2;
      const y = slotPixelY(r, minR) + (SLOT_SIZE - CREATURE_DISPLAY) / 2;
      visual.sprite.x = x;
      visual.sprite.y = y;
    }
  }

  // Remove visuals for creatures no longer in pool
  for (const [id, visual] of poolView.visuals) {
    if (!currentIds.has(id)) {
      destroyCreatureVisual(visual);
      poolView.visuals.delete(id);
    }
  }

  // --- Sync expansion buttons ---
  const candidates = getExpansionCandidates(state.pool);
  const currentExpandKeys = new Set<CoordKey>();

  for (const [r, c] of candidates) {
    const key = toKey(r, c);
    currentExpandKeys.add(key);

    if (!poolView.expandBtns.has(key)) {
      const x = slotPixelX(c, minC) + (SLOT_SIZE - EXPAND_BTN_SIZE) / 2;
      const y = slotPixelY(r, minR) + (SLOT_SIZE - EXPAND_BTN_SIZE) / 2;

      const cont = new Container();
      cont.x = x;
      cont.y = y;

      const bg = new Graphics();
      drawExpandNormal(bg);
      cont.addChild(bg);

      const plus = new Graphics();
      drawPlusCross(plus, EXPAND_CROSS_COLOR);
      cont.addChild(plus);

      cont.eventMode = 'static';
      cont.cursor = 'pointer';

      cont.on('pointerenter', (e: any) => {
        bg.clear();
        bg.roundRect(0, 0, EXPAND_BTN_SIZE, EXPAND_BTN_SIZE, 4);
        bg.fill(0x0d2228);
        bg.roundRect(0, 0, EXPAND_BTN_SIZE, EXPAND_BTN_SIZE, 4);
        bg.stroke({ color: EXPAND_HOVER_BORDER, width: 2 });
        plus.clear();
        drawPlusCross(plus, EXPAND_HOVER_BORDER);
        if (poolView._stateRef && poolView._canvas) {
          const gx = e.global?.x ?? 0;
          const gy = e.global?.y ?? 0;
          const rect = poolView._canvas.getBoundingClientRect();
          showTooltip(rect.left + gx, rect.top + gy, poolView._stateRef);
        }
      });

      cont.on('pointerleave', () => {
        drawExpandNormal(bg);
        plus.clear();
        drawPlusCross(plus, EXPAND_CROSS_COLOR);
        hideTooltip();
      });

      cont.on('pointertap', () => {
        if (poolView._dragged) return;
        poolView.onExpansionClick?.(r, c);
      });

      poolView.gridContainer.addChild(cont);
      poolView.expandBtns.set(key, cont);
    } else {
      // Update position
      const cont = poolView.expandBtns.get(key)!;
      cont.x = slotPixelX(c, minC) + (SLOT_SIZE - EXPAND_BTN_SIZE) / 2;
      cont.y = slotPixelY(r, minR) + (SLOT_SIZE - EXPAND_BTN_SIZE) / 2;
    }
  }

  // Remove expand buttons no longer needed
  for (const [key, cont] of poolView.expandBtns) {
    if (!currentExpandKeys.has(key)) {
      cont.destroy({ children: true });
      poolView.expandBtns.delete(key);
    }
  }

  // --- Sync upgrade node graphics ---
  const nodePositions = getUpgradeNodePositions(state.pool);
  const currentNodeKeys = new Set<CoordKey>();

  for (const [r, c] of nodePositions) {
    const key = toKey(r, c);
    currentNodeKeys.add(key);

    // Position: center of the 2x2 block
    const cx = slotPixelX(c, minC) + SLOT_SIZE + SLOT_PAD / 2;
    const cy = slotPixelY(r, minR) + SLOT_SIZE + SLOT_PAD / 2;

    const existingNode = state.upgradeNodes.find((n) => n.row === r && n.col === c);
    const hasUpgrade = !!existingNode?.upgradeType;

    if (!poolView.upgradeNodeGraphics.has(key)) {
      const cont = new Container();
      cont.x = cx - NODE_SIZE / 2;
      cont.y = cy - NODE_SIZE / 2;

      const diamond = new Graphics();
      drawUpgradeNode(diamond, hasUpgrade);
      cont.addChild(diamond);

      if (hasUpgrade) {
        const icon = new Text({
          text: '\u{1F33F}', // herb emoji for algae
          style: new TextStyle({ fontSize: 10, align: 'center' }),
        });
        icon.anchor.set(0.5);
        icon.x = NODE_SIZE / 2;
        icon.y = NODE_SIZE / 2;
        cont.addChild(icon);
      }

      cont.eventMode = 'static';
      cont.cursor = 'pointer';

      cont.on('pointertap', () => {
        if (poolView._dragged) return;
        poolView.onUpgradeNodeClick?.(r, c);
      });

      poolView.gridContainer.addChild(cont);
      poolView.upgradeNodeGraphics.set(key, cont);
    } else {
      // Update position and state
      const cont = poolView.upgradeNodeGraphics.get(key)!;
      cont.x = cx - NODE_SIZE / 2;
      cont.y = cy - NODE_SIZE / 2;

      // Redraw if upgrade state changed
      const diamond = cont.children[0] as Graphics;
      diamond.clear();
      drawUpgradeNode(diamond, hasUpgrade);
    }
  }

  // Remove upgrade nodes no longer valid
  for (const [key, cont] of poolView.upgradeNodeGraphics) {
    if (!currentNodeKeys.has(key)) {
      cont.destroy({ children: true });
      poolView.upgradeNodeGraphics.delete(key);
    }
  }
}

/** Update all creature animations */
export function updatePoolVisuals(poolView: PoolView, deltaSec: number, totalTime: number): void {
  for (const visual of poolView.visuals.values()) {
    updateCreatureVisual(visual, deltaSec, totalTime);
  }
}

// --- Drawing helpers ---

function drawSlotNormal(slot: Graphics, x: number, y: number): void {
  slot.clear();
  slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
  slot.fill(SLOT_BG);
  slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
  slot.stroke({ color: SLOT_BORDER, width: 1 });
}

const EXPAND_CROSS_COLOR = 0x1a3a3f;

function drawPlusCross(g: Graphics, color: number): void {
  const cx = EXPAND_BTN_SIZE / 2;
  const cy = EXPAND_BTN_SIZE / 2;
  const arm = 7; // half-length of each arm
  const thick = 2;
  // Horizontal bar
  g.rect(cx - arm, cy - thick / 2, arm * 2, thick);
  g.fill(color);
  // Vertical bar
  g.rect(cx - thick / 2, cy - arm, thick, arm * 2);
  g.fill(color);
}

function drawExpandNormal(bg: Graphics): void {
  bg.clear();
  bg.roundRect(0, 0, EXPAND_BTN_SIZE, EXPAND_BTN_SIZE, 4);
  bg.fill(EXPAND_BG);
  bg.roundRect(0, 0, EXPAND_BTN_SIZE, EXPAND_BTN_SIZE, 4);
  bg.stroke({ color: EXPAND_BORDER, width: 1 });
}

function drawUpgradeNode(diamond: Graphics, active: boolean): void {
  const half = NODE_SIZE / 2;
  // Draw diamond shape
  diamond.moveTo(half, 0);
  diamond.lineTo(NODE_SIZE, half);
  diamond.lineTo(half, NODE_SIZE);
  diamond.lineTo(0, half);
  diamond.closePath();

  if (active) {
    diamond.fill({ color: NODE_ACTIVE_COLOR, alpha: 0.3 });
    diamond.stroke({ color: NODE_ACTIVE_COLOR, width: 2 });
  } else {
    diamond.fill({ color: NODE_EMPTY_COLOR, alpha: 0.15 });
    diamond.stroke({ color: NODE_EMPTY_COLOR, width: 1 });
  }
}
