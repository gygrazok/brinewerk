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
  chance: number;
  color: string;
  /** If set, this effect can only appear on these creature types */
  types?: CreatureType[];
}

export const RARE_EFFECTS: RareInfo[] = [
  { id: 'none', label: '', icon: '', chance: 0.0, color: '#8ba0a8' },
  { id: 'metallic', label: 'Metallic', icon: '\u2699', chance: 0.08, color: '#c0c8d0' },
  { id: 'glitch', label: 'Glitch', icon: '\u25A6', chance: 0.05, color: '#00ff88' },
  { id: 'fire', label: 'On Fire', icon: '\uD83D\uDD25', chance: 0.05, color: '#ff6020' },
  { id: 'frost', label: 'Frost', icon: '\u2744', chance: 0.05, color: '#80d0ff' },
  { id: 'shiny', label: 'Shiny', icon: '\u2728', chance: 0.05, color: '#ffe040' },
  { id: 'nebula', label: 'Nebula', icon: '\u2605', chance: 0.04, color: '#c0a0ff' },
  { id: 'toxic', label: 'Toxic', icon: '\u2623', chance: 0.04, color: '#80ff40' },
  { id: 'phantom', label: 'Phantom', icon: '\uD83D\uDC7B', chance: 0.04, color: '#a080c0' },
  { id: 'rotating', label: 'Rotating', icon: '\uD83C\uDF00', chance: 0.05, color: '#60c0e0', types: [CreatureType.Stellarid, CreatureType.Nucleid] },
  { id: 'upside-down', label: 'Upside Down', icon: '\uD83D\uDD03', chance: 0.05, color: '#e0a060', types: [CreatureType.Blobid, CreatureType.Corallid] },
  { id: 'wave', label: 'Wave', icon: '\u223F', chance: 0.05, color: '#40c0ff' },
  { id: 'rainbow', label: 'Rainbow', icon: '\uD83C\uDF08', chance: 0.04, color: '#ff80c0' },
  { id: 'hologram', label: 'Hologram', icon: '\u25C7', chance: 0.04, color: '#60a0ff' },
  { id: 'negative', label: 'Negative', icon: '\u25D1', chance: 0.04, color: '#e0e0e0' },
  { id: 'electric', label: 'Electric', icon: '\u26A1', chance: 0.04, color: '#80d0ff' },
  { id: 'shadow', label: 'Shadow', icon: '\u2592', chance: 0.04, color: '#404060' },
  { id: 'pulse', label: 'Pulse', icon: '\u2665', chance: 0.04, color: '#ff6080' },
  { id: 'tiny', label: 'Tiny', icon: '\u2022', chance: 0.04, color: '#a0e060' },
  { id: 'holy', label: 'Holy', icon: '\u2742', chance: 0.04, color: '#fff8e0' },
  { id: 'xray', label: 'X-Ray', icon: '\u2622', chance: 0.04, color: '#a0c0e0' },
  { id: 'thermal', label: 'Thermal', icon: '\uD83C\uDF21', chance: 0.04, color: '#ff6040' },
  { id: 'crt', label: 'CRT', icon: '\u25AA', chance: 0.03, color: '#90a060' },
  { id: 'caustic', label: 'Caustic', icon: '\u224B', chance: 0.03, color: '#70c8e0' },
  { id: 'stained', label: 'Stained Glass', icon: '\u2B21', chance: 0.03, color: '#c06080' },
  { id: 'liquify', label: 'Liquify', icon: '\uD83D\uDCA7', chance: 0.03, color: '#80b0d0' },
];

export function rollRare(rng: () => number, creatureType?: CreatureType): RareEffect | null {
  // Build filtered list: keep effects that have no type restriction or match the creature type
  const eligible = RARE_EFFECTS.filter((e) => !e.types || !creatureType || e.types.includes(creatureType));
  // Redistribute excluded chances to 'none'
  const excluded = RARE_EFFECTS.filter((e) => e.types && creatureType && !e.types.includes(creatureType));
  const extraNone = excluded.reduce((s, e) => s + e.chance, 0);

  let r = rng(), cum = 0;
  for (const e of eligible) {
    const ch = e.id === 'none' ? e.chance + extraNone : e.chance;
    cum += ch;
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
  /** Cumulative plankton produced by this creature (for nacre yield on release) */
  lifetimePlankton: number;
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
  const rare = forceRare !== undefined ? forceRare : rollRare(rng, type);
  const nameRng = mulberry32(seed + 999);
  const name = generateName(type, nameRng);
  const id = `c_${Date.now()}_${_nextId++}`;

  return { id, name, type, genes, seed, rare, lifetimePlankton: 0 };
}
