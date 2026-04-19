import type { GameState } from '../core/game-state';
import { unlockedSlots } from './coords';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AchievementReward {
  type: 'feature-unlock' | 'bonus';
  label: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (state: GameState) => boolean;
  reward: AchievementReward;
  /** Called once when the achievement is newly completed */
  onComplete?: (state: GameState) => void;
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

/** Achievement whose completion unlocks creature release + nacre visibility. */
export const RELEASE_UNLOCK_ACHIEVEMENT_ID = 'tide_pool_keeper';

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: RELEASE_UNLOCK_ACHIEVEMENT_ID,
    name: 'Tide Pool Keeper',
    description: 'Place 4 creatures in the tide pool',
    icon: '🐚',
    condition: (state) => {
      const placed = unlockedSlots(state.pool).filter(s => s.creatureId !== null).length;
      return placed >= 4;
    },
    reward: { type: 'feature-unlock', label: 'Unlocks Nacre & Creature Release' },
  },
];

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

/** Check all achievements, return newly completed ones */
export function checkAchievements(state: GameState): AchievementDefinition[] {
  const newlyCompleted: AchievementDefinition[] = [];
  for (const def of ACHIEVEMENTS) {
    if (state.achievements[def.id]) continue;
    if (def.condition(state)) {
      state.achievements[def.id] = true;
      def.onComplete?.(state);
      newlyCompleted.push(def);
    }
  }
  return newlyCompleted;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getCompletedCount(state: GameState): number {
  return Object.values(state.achievements).filter(Boolean).length;
}

export function getTotalCount(): number {
  return ACHIEVEMENTS.length;
}

/** True when the tide_pool_keeper achievement is complete — gates release/nacre. */
export function isReleaseUnlocked(state: GameState): boolean {
  return state.achievements[RELEASE_UNLOCK_ACHIEVEMENT_ID] === true;
}
