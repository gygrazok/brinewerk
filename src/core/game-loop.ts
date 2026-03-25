import { Ticker } from 'pixi.js';
import { type Clock, createClock, tickClock, calculateOfflineElapsed } from './clock';
import { type GameState, createDefaultState, loadState, saveState } from './game-state';
import { tickProduction } from '../economy/production-engine';
import { checkTide } from '../systems/tides';
import { checkAchievements, type AchievementDefinition } from '../systems/achievements';

const AUTO_SAVE_INTERVAL = 30; // seconds

const PRODUCTION_TICK_INTERVAL = 0.25; // seconds — throttle heavy production calc

let state: GameState;
let clock: Clock;
let saveTimer = 0;
let productionTimer = 0;
let achievementTimer = 0;
let savingEnabled = true;
const onTideCallbacks: (() => void)[] = [];
const onAchievementCallbacks: ((defs: AchievementDefinition[]) => void)[] = [];

export function onTide(cb: () => void): void {
  onTideCallbacks.push(cb);
}

export function onAchievement(cb: (defs: AchievementDefinition[]) => void): void {
  onAchievementCallbacks.push(cb);
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

    productionTimer += deltaSec;
    if (productionTimer >= PRODUCTION_TICK_INTERVAL) {
      tickProduction(state, productionTimer);
      productionTimer = 0;
    }
    if (checkTide(state, Date.now())) {
      onTideCallbacks.forEach((cb) => cb());
    }
    achievementTimer += deltaSec;
    if (achievementTimer >= 1) {
      achievementTimer = 0;
      const newAchievements = checkAchievements(state);
      if (newAchievements.length > 0) {
        onAchievementCallbacks.forEach((cb) => cb(newAchievements));
      }
    }

    // Auto-save
    saveTimer += deltaSec;
    if (saveTimer >= AUTO_SAVE_INTERVAL) {
      saveTimer = 0;
      saveState(state);
    }
  });

  // Save on page unload
  window.addEventListener('beforeunload', () => {
    if (savingEnabled) saveState(state);
  });
}

/** Disable auto-save (call before clearSave + reload to prevent beforeunload from re-saving) */
export function disableSaving(): void {
  savingEnabled = false;
}
