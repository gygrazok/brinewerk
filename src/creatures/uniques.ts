/**
 * Unique creatures: five one-off specimens with hand-drawn shapes. They have no genotype,
 * no level and no production; once found they sit in the Collection and wander the pool.
 */

export type UniqueId = 'nautilus' | 'leviathan' | 'angler' | 'seadragon' | 'mantis';

export interface UniqueInfo {
  id: UniqueId;
  name: string;
  /** Accent colour for borders and badges */
  color: string;
}

export const UNIQUES: readonly UniqueInfo[] = [
  { id: 'nautilus', name: 'Chambered Nautilus', color: '#e8a060' },
  { id: 'leviathan', name: 'Leviathan', color: '#40c0c0' },
  { id: 'angler', name: 'Lantern Angler', color: '#f0f080' },
  { id: 'seadragon', name: 'Leafy Sea Dragon', color: '#a0d050' },
  { id: 'mantis', name: 'Mantis Shrimp', color: '#f06080' },
];

export function getUniqueInfo(id: UniqueId): UniqueInfo {
  return UNIQUES.find((u) => u.id === id)!;
}
