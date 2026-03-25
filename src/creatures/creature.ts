import { CreatureType } from './types';
import { mulberry32 } from '../util/prng';
import { randomGenotype } from '../genetics/genes';
import { generateName } from '../genetics/taxonomy';
import { getDisplayTraits } from '../genetics/traits';
import { DEFAULT_RARE_CHANCE, DEFAULT_UNLOCKED_RARE_IDS } from '../core/balance';

const DEFAULT_UNLOCKED_RARES: ReadonlySet<string> = new Set(DEFAULT_UNLOCKED_RARE_IDS);

export interface Genotype {
  arms: number;
  size: number;
  fatness: number;
  spikes: number;
  pattern: number;
  glow: number;
  eyes: number;
  wobble: number;
  tentacles: number;
  branches: number;
  density: number;
  facets: number;
  rings: number;
  palette1: number;
  palette2: number;
}

export type RareEffect =
  | 'metallic'
  | 'glitch'
  | 'fire'
  | 'frost'
  | 'shiny'
  | 'nebula'
  | 'toxic'
  | 'phantom'
  | 'rotating'
  | 'upside-down'
  | 'wave'
  | 'rainbow'
  | 'hologram'
  | 'negative'
  | 'electric'
  | 'shadow'
  | 'pulse'
  | 'tiny'
  | 'holy'
  | 'xray'
  | 'thermal'
  | 'crt'
  | 'caustic'
  | 'stained'
  | 'liquify';

export interface RareInfo {
  id: string;
  label: string;
  icon: string;
  /** Relative spawn weight within the pool (higher = more common among rares) */
  weight: number;
  color: string;
  /** Rarity tier: 1 = common rare, 2 = uncommon rare, 3 = legendary */
  tier: 1 | 2 | 3;
  /** If set, this effect can only appear on these creature types */
  types?: CreatureType[];
}

export const RARE_EFFECTS: RareInfo[] = [
  // --- Tier 1: starter rares (unlocked by default) ---
  { id: 'metallic', label: 'Metallic', icon: '\u2699', weight: 10, tier: 1, color: '#c0c8d0' },
  { id: 'shiny', label: 'Shiny', icon: '\u2728', weight: 10, tier: 1, color: '#ffe040' },

  // --- Tier 2: uncommon rares (unlocked via upgrades) ---
  { id: 'glitch', label: 'Glitch', icon: '\u25A6', weight: 8, tier: 2, color: '#00ff88' },
  { id: 'fire', label: 'On Fire', icon: '\uD83D\uDD25', weight: 8, tier: 2, color: '#ff6020' },
  { id: 'frost', label: 'Frost', icon: '\u2744', weight: 8, tier: 2, color: '#80d0ff' },
  { id: 'nebula', label: 'Nebula', icon: '\u2605', weight: 6, tier: 2, color: '#c0a0ff' },
  { id: 'toxic', label: 'Toxic', icon: '\u2623', weight: 6, tier: 2, color: '#80ff40' },
  { id: 'phantom', label: 'Phantom', icon: '\uD83D\uDC7B', weight: 6, tier: 2, color: '#a080c0' },
  { id: 'rotating', label: 'Rotating', icon: '\uD83C\uDF00', weight: 8, tier: 2, color: '#60c0e0', types: [CreatureType.Stellarid, CreatureType.Nucleid] },
  { id: 'upside-down', label: 'Upside Down', icon: '\uD83D\uDD03', weight: 8, tier: 2, color: '#e0a060', types: [CreatureType.Blobid, CreatureType.Corallid] },
  { id: 'wave', label: 'Wave', icon: '\u223F', weight: 8, tier: 2, color: '#40c0ff' },
  { id: 'rainbow', label: 'Rainbow', icon: '\uD83C\uDF08', weight: 6, tier: 2, color: '#ff80c0' },
  { id: 'electric', label: 'Electric', icon: '\u26A1', weight: 6, tier: 2, color: '#80d0ff' },
  { id: 'pulse', label: 'Pulse', icon: '\u2665', weight: 6, tier: 2, color: '#ff6080' },

  // --- Tier 3: legendary rares (late-game unlocks) ---
  { id: 'hologram', label: 'Hologram', icon: '\u25C7', weight: 5, tier: 3, color: '#60a0ff' },
  { id: 'negative', label: 'Negative', icon: '\u25D1', weight: 5, tier: 3, color: '#e0e0e0' },
  { id: 'shadow', label: 'Shadow', icon: '\u2592', weight: 5, tier: 3, color: '#404060' },
  { id: 'tiny', label: 'Tiny', icon: '\u2022', weight: 5, tier: 3, color: '#a0e060' },
  { id: 'holy', label: 'Holy', icon: '\u2742', weight: 4, tier: 3, color: '#fff8e0' },
  { id: 'xray', label: 'X-Ray', icon: '\u2622', weight: 4, tier: 3, color: '#a0c0e0' },
  { id: 'thermal', label: 'Thermal', icon: '\uD83C\uDF21', weight: 4, tier: 3, color: '#ff6040' },
  { id: 'crt', label: 'CRT', icon: '\u25AA', weight: 3, tier: 3, color: '#90a060' },
  { id: 'caustic', label: 'Caustic', icon: '\u224B', weight: 3, tier: 3, color: '#70c8e0' },
  { id: 'stained', label: 'Stained Glass', icon: '\u2B21', weight: 3, tier: 3, color: '#c06080' },
  { id: 'liquify', label: 'Liquify', icon: '\uD83D\uDCA7', weight: 3, tier: 3, color: '#80b0d0' },
];

/**
 * Roll for a rare effect.
 * @param rng           Seeded random function [0, 1)
 * @param rareChance    Probability of getting any rare at all (e.g. 0.01 = 1%)
 * @param unlockedRares Set of rare effect IDs currently in the pool
 * @param creatureType  Optional creature type for type-restricted effects
 */
export function rollRare(
  rng: () => number,
  rareChance: number,
  unlockedRares: ReadonlySet<string>,
  creatureType?: CreatureType,
): RareEffect | null {
  // First roll: is this creature rare at all?
  if (rng() >= rareChance) return null;

  // Build eligible pool: unlocked + type-compatible
  const eligible = RARE_EFFECTS.filter(
    (e) => unlockedRares.has(e.id) && (!e.types || !creatureType || e.types.includes(creatureType)),
  );

  if (eligible.length === 0) return null;

  // Weighted random pick from eligible effects
  const totalWeight = eligible.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * totalWeight;
  for (const e of eligible) {
    roll -= e.weight;
    if (roll <= 0) return e.id as RareEffect;
  }
  return eligible[eligible.length - 1].id as RareEffect;
}

const NONE_RARE: RareInfo = { id: 'none', label: '', icon: '', weight: 0, tier: 1, color: '#8ba0a8' };

export function getRareInfo(rare: RareEffect | null): RareInfo {
  if (!rare) return NONE_RARE;
  return RARE_EFFECTS.find((e) => e.id === rare) ?? NONE_RARE;
}

/**
 * Calculate how "exceptional" a creature's traits are.
 * Returns a value in [0, 1] representing average deviation from the bell curve mean (0.5).
 * A perfectly average creature scores 0; a creature with all traits at 0 or 1 scores 1.
 * Only considers gameplay-relevant traits for the creature's type (not palette genes).
 */
export function calculateTraitDeviation(creature: { type: CreatureType; genes: Genotype }): number {
  const traits = getDisplayTraits(creature.type);
  if (traits.length === 0) return 0;
  let totalDeviation = 0;
  for (const trait of traits) {
    const value = creature.genes[trait as keyof Genotype] ?? 0.5;
    totalDeviation += Math.abs(value - 0.5);
  }
  // Max possible deviation per trait is 0.5, normalize to [0, 1]
  return totalDeviation / (traits.length * 0.5);
}

export interface Creature {
  id: string;
  name: string;
  type: CreatureType;
  genes: Genotype;
  seed: number;
  rare: RareEffect | null;
  /** Cumulative plankton produced by this creature (for nacre yield on release) */
  lifetimePlankton: number;
}

let _nextId = 0;

export interface CreateCreatureOpts {
  type?: CreatureType;
  seed?: number;
  forceRare?: RareEffect | null;
  /** Chance of any rare (default: DEFAULT_RARE_CHANCE from balance) */
  rareChance?: number;
  /** Set of unlocked rare IDs (default: DEFAULT_UNLOCKED_RARES from balance) */
  unlockedRares?: ReadonlySet<string>;
}

export function createCreature(
  typeOrOpts?: CreatureType | CreateCreatureOpts,
  seed?: number,
  forceRare?: RareEffect | null,
): Creature {
  // Support both old positional API and new opts object
  let opts: CreateCreatureOpts;
  if (typeOrOpts !== undefined && typeof typeOrOpts === 'object') {
    opts = typeOrOpts;
  } else {
    opts = { type: typeOrOpts, seed, forceRare };
  }

  const finalSeed = opts.seed ?? ((Date.now() + _nextId * 7919) & 0x7fffffff);
  const types = Object.values(CreatureType);
  const typeRng = mulberry32(finalSeed ^ 0xbeef);
  const finalType = opts.type ?? types[Math.floor(typeRng() * types.length)];

  const rng = mulberry32(finalSeed);
  const genes = randomGenotype(rng);
  const rare =
    opts.forceRare !== undefined
      ? opts.forceRare
      : rollRare(
          rng,
          opts.rareChance ?? DEFAULT_RARE_CHANCE,
          opts.unlockedRares ?? DEFAULT_UNLOCKED_RARES,
          finalType,
        );
  const nameRng = mulberry32(finalSeed + 999);
  const name = generateName(finalType, nameRng);
  const id = `c_${Date.now()}_${_nextId++}`;

  return { id, name, type: finalType, genes, seed: finalSeed, rare, lifetimePlankton: 0 };
}

/**
 * Canonical way to spawn a creature using the player's current game state.
 * All gameplay systems (tides, breeding, expeditions, etc.) should use this
 * so that rareChance and unlockedRares are always pulled from the live state.
 *
 * Use `createCreature` directly only for debug/tests or when you need to
 * bypass the state (e.g. force a specific rare).
 */
export function spawnCreature(
  state: { rareChance: number; unlockedRares: string[] },
  opts?: { type?: CreatureType; seed?: number; forceRare?: RareEffect | null },
): Creature {
  return createCreature({
    type: opts?.type,
    seed: opts?.seed,
    forceRare: opts?.forceRare,
    rareChance: state.rareChance,
    unlockedRares: new Set(state.unlockedRares),
  });
}
