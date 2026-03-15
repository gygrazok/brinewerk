/** All gene keys on a creature's genotype */
export const UNIVERSAL_TRAITS = [
  'arms', 'size', 'fatness', 'spikes', 'pattern', 'glow', 'eyes', 'wobble',
] as const;

export const TYPE_SPECIFIC_TRAITS = {
  stellarid: [] as const,
  blobid: ['tentacles'] as const,
  corallid: ['branches', 'density'] as const,
  nucleid: ['facets', 'rings'] as const,
} as const;

export const PALETTE_TRAITS = ['palette1', 'palette2'] as const;

/** Display-friendly traits for a given type (universal + type-specific) */
export function getDisplayTraits(type: string): string[] {
  const specific = TYPE_SPECIFIC_TRAITS[type as keyof typeof TYPE_SPECIFIC_TRAITS] ?? [];
  return [...UNIVERSAL_TRAITS, ...specific];
}

export const TRAIT_COLORS: Record<string, string> = {
  arms: '#3aada8',
  size: '#7aaaff',
  fatness: '#d4627a',
  spikes: '#cd6a2a',
  pattern: '#b8b44a',
  glow: '#f0ee8a',
  tentacles: '#caaaff',
  branches: '#4aad4a',
  density: '#8aee8a',
  facets: '#7aaaff',
  rings: '#9a9abd',
};
