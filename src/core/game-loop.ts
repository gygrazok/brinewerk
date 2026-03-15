import { Ticker } from 'pixi.js';
import { type Clock, createClock, tickClock, calculateOfflineElapsed } from './clock';
import { type GameState, createDefaultState, loadState, saveState } from './game-state';
import { tickProduction } from '../economy/production-engine';
import { checkTide } from '../systems/tides';

const AUTO_SAVE_INTERVAL = 30; // seconds

let state: GameState;
let clock: Clock;
let saveTimer = 0;
const onTideCallbacks: (() => void)[] = [];

export function onTide(cb: () => void): void {
  onTideCallbacks.push(cb);
}

export function getState(): GameState {
  return state;
}

export function getClock(): Clock {
  return clock;
}

export function initGameLoop(ticker: Ticker): void {
  clock = createClock();

  const saved = loadState();
  if (saved) {
    state = saved;
    const offlineSec = calculateOfflineElapsed(saved.lastSaveTimestamp);
    if (offlineSec > 1) {
      tickProduction(state, offlineSec);
      console.log(`Offline for ${Math.floor(offlineSec)}s — applied production`);
    }
  } else {
    state = createDefaultState();
  }

  ticker.add((tick) => {
    const deltaSec = tick.deltaTime / 60; // PixiJS deltaTime is in frames (60fps = 1.0)
    tickClock(clock, deltaSec);
    state.totalPlaytime += deltaSec;

    tickProduction(state, deltaSec);
    if (checkTide(state, Date.now())) {
      onTideCallbacks.forEach((cb) => cb());
    }

    // Auto-save
    saveTimer += deltaSec;
    if (saveTimer >= AUTO_SAVE_INTERVAL) {
      saveTimer = 0;
      saveState(state);
    }
  });

  // Save on page unload
  window.addEventListener('beforeunload', () => saveState(state));
}
