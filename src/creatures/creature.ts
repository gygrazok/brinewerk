import { CreatureType } from './types';
import { mulberry32 } from '../util/prng';
import { randomGenotype } from '../genetics/genes';
import { generateName } from '../genetics/taxonomy';

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
  | 'starry'
  | 'toxic'
  | 'phantom';

export interface RareInfo {
  id: string;
  label: string;
  icon: string;
  chance: number;
  color: string;
}

export const RARE_EFFECTS: RareInfo[] = [
  { id: 'none', label: '', icon: '', chance: 0.60, color: '#8ba0a8' },
  { id: 'metallic', label: 'Metallic', icon: '\u2699', chance: 0.08, color: '#c0c8d0' },
  { id: 'glitch', label: 'Glitch', icon: '\u25A6', chance: 0.05, color: '#00ff88' },
  { id: 'fire', label: 'On Fire', icon: '\uD83D\uDD25', chance: 0.05, color: '#ff6020' },
  { id: 'frost', label: 'Frost', icon: '\u2744', chance: 0.05, color: '#80d0ff' },
  { id: 'shiny', label: 'Shiny', icon: '\u2728', chance: 0.05, color: '#ffe040' },
  { id: 'starry', label: 'Starry', icon: '\u2605', chance: 0.04, color: '#c0a0ff' },
  { id: 'toxic', label: 'Toxic', icon: '\u2623', chance: 0.04, color: '#80ff40' },
  { id: 'phantom', label: 'Phantom', icon: '\uD83D\uDC7B', chance: 0.04, color: '#a080c0' },
];

export function rollRare(rng: () => number): RareEffect | null {
  let r = rng(), cum = 0;
  for (const e of RARE_EFFECTS) {
    cum += e.chance;
    if (r < cum) return e.id === 'none' ? null : (e.id as RareEffect);
  }
  return null;
}

export function getRareInfo(rare: RareEffect | null): RareInfo {
  if (!rare) return RARE_EFFECTS[0];
  return RARE_EFFECTS.find((e) => e.id === rare) ?? RARE_EFFECTS[0];
}

export interface Creature {
  id: string;
  name: string;
  type: CreatureType;
  genes: Genotype;
  seed: number;
  rare: RareEffect | null;
}

let _nextId = 0;

export function createCreature(
  type?: CreatureType,
  seed?: number,
  forceRare?: RareEffect | null,
): Creature {
  seed = seed ?? Math.floor(Math.random() * 2147483647);
  const types = Object.values(CreatureType);
  type = type ?? types[Math.floor(Math.random() * types.length)];

  const rng = mulberry32(seed);
  const genes = randomGenotype(rng);
  const rare = forceRare !== undefined ? forceRare : rollRare(rng);
  const nameRng = mulberry32(seed + 999);
  const name = generateName(type, nameRng);
  const id = `c_${Date.now()}_${_nextId++}`;

  return { id, name, type, genes, seed, rare };
}
