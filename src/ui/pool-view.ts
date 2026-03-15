import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { GameState } from '../core/game-state';
import { getCreatureAt } from '../systems/pool';
import {
  createCreatureVisual,
  updateCreatureVisual,
  destroyCreatureVisual,
  type CreatureVisual,
} from '../rendering/creature-renderer';


const SLOT_SIZE = 80; // px per slot
const SLOT_PAD = 6;
const CREATURE_DISPLAY = 64; // creature sprite scaled to this size within the slot
const SLOT_BG = 0x0d2228;
const SLOT_BORDER = 0x1a3a3f;
const SLOT_HOVER = 0x3aada8;

export interface PoolView {
  viewport: Container;
  gridContainer: Container;
  visuals: Map<string, CreatureVisual>;
  structureVisuals: Map<string, Container>;
  selectedSlot: [number, number] | null;
  onSlotClick: ((row: number, col: number) => void) | null;
}

export function createPoolView(app: Application, state: GameState): PoolView {
  const viewport = new Container(); // future zoom/pan container
  const gridContainer = new Container();
  viewport.addChild(gridContainer);
  app.stage.addChild(viewport);

  const rows = state.pool.length;
  const cols = state.pool[0].length;
  const gridW = cols * (SLOT_SIZE + SLOT_PAD) + SLOT_PAD;
  const gridH = rows * (SLOT_SIZE + SLOT_PAD) + SLOT_PAD;

  // Center the grid
  const centerGrid = () => {
    viewport.x = Math.round((app.screen.width - gridW) / 2);
    viewport.y = Math.round((app.screen.height - gridH) / 2);
  };
  centerGrid();
  app.renderer.on('resize', centerGrid);

  const poolView: PoolView = {
    viewport,
    gridContainer,
    visuals: new Map(),
    structureVisuals: new Map(),
    selectedSlot: null,
    onSlotClick: null,
  };

  // Draw slot backgrounds
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = SLOT_PAD + c * (SLOT_SIZE + SLOT_PAD);
      const y = SLOT_PAD + r * (SLOT_SIZE + SLOT_PAD);

      const slot = new Graphics();
      slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
      slot.fill(SLOT_BG);
      slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
      slot.stroke({ color: SLOT_BORDER, width: 1 });

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
        slot.clear();
        slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
        slot.fill(SLOT_BG);
        slot.roundRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
        slot.stroke({ color: SLOT_BORDER, width: 1 });
      });

      slot.on('pointertap', () => {
        poolView.selectedSlot = [r, c];
        poolView.onSlotClick?.(r, c);
      });

      gridContainer.addChild(slot);
    }
  }

  return poolView;
}

/** Sync creature visuals with game state */
export function syncPoolVisuals(poolView: PoolView, state: GameState): void {
  const currentIds = new Set<string>();

  for (let r = 0; r < state.pool.length; r++) {
    for (let c = 0; c < state.pool[r].length; c++) {
      const creature = getCreatureAt(state, r, c);
      if (!creature) continue;

      currentIds.add(creature.id);

      if (!poolView.visuals.has(creature.id)) {
        // Create new visual
        const visual = createCreatureVisual(creature);
        const x = SLOT_PAD + c * (SLOT_SIZE + SLOT_PAD) + (SLOT_SIZE - CREATURE_DISPLAY) / 2;
        const y = SLOT_PAD + r * (SLOT_SIZE + SLOT_PAD) + (SLOT_SIZE - CREATURE_DISPLAY) / 2;
        visual.sprite.x = x;
        visual.sprite.y = y;
        visual.sprite.width = CREATURE_DISPLAY;
        visual.sprite.height = CREATURE_DISPLAY;
        poolView.gridContainer.addChild(visual.sprite);
        poolView.visuals.set(creature.id, visual);
      }
    }
  }

  // Remove visuals for creatures no longer in pool
  for (const [id, visual] of poolView.visuals) {
    if (!currentIds.has(id)) {
      destroyCreatureVisual(visual);
      poolView.visuals.delete(id);
    }
  }

  // Sync structure visuals
  const currentStructIds = new Set<string>();
  if (state.structures) {
    for (const struct of state.structures) {
      currentStructIds.add(struct.id);

      if (!poolView.structureVisuals.has(struct.id)) {
        const x = SLOT_PAD + struct.col * (SLOT_SIZE + SLOT_PAD);
        const y = SLOT_PAD + struct.row * (SLOT_SIZE + SLOT_PAD);

        const cont = new Container();
        const bg = new Graphics();
        bg.roundRect(0, 0, SLOT_SIZE, SLOT_SIZE, 4);
        bg.fill(0x1a4a2a);
        bg.roundRect(0, 0, SLOT_SIZE, SLOT_SIZE, 4);
        bg.stroke({ color: 0x4aad4a, width: 2 });
        cont.addChild(bg);

        const label = new Text({
          text: 'ALGAE\nCOLONY',
          style: new TextStyle({
            fontFamily: 'Press Start 2P',
            fontSize: 8,
            fill: '#8aee8a',
            align: 'center',
          }),
        });
        label.anchor.set(0.5);
        label.x = SLOT_SIZE / 2;
        label.y = SLOT_SIZE / 2;
        cont.addChild(label);

        cont.x = x;
        cont.y = y;
        poolView.gridContainer.addChild(cont);
        poolView.structureVisuals.set(struct.id, cont);
      }
    }
  }

  // Remove structure visuals no longer present
  for (const [id, cont] of poolView.structureVisuals) {
    if (!currentStructIds.has(id)) {
      cont.destroy({ children: true });
      poolView.structureVisuals.delete(id);
    }
  }
}

/** Update all creature animations */
export function updatePoolVisuals(poolView: PoolView, deltaSec: number, totalTime: number): void {
  for (const visual of poolView.visuals.values()) {
    updateCreatureVisual(visual, deltaSec, totalTime);
  }
}
