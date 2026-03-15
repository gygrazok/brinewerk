export interface Palette {
  name: string;
  outline: string;
  body: string;
  hi: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { name: 'Deep Teal', outline: '#0a2a2f', body: '#1a5c5e', hi: '#3aada8', accent: '#7eeee4' },
  { name: 'Coral Rose', outline: '#2a0f1a', body: '#8b3a5a', hi: '#d4627a', accent: '#ffaabf' },
  { name: 'Brine Gold', outline: '#1a1a05', body: '#6b6a20', hi: '#b8b44a', accent: '#f0ee8a' },
  { name: 'Abyss Blue', outline: '#050520', body: '#1a2a6b', hi: '#3a5acd', accent: '#7aaaff' },
  { name: 'Kelp Green', outline: '#0a1a0a', body: '#2a6b2a', hi: '#4aad4a', accent: '#8aee8a' },
  { name: 'Urchin Purple', outline: '#1a0a2a', body: '#5a2a8b', hi: '#8a4acd', accent: '#caaaff' },
  { name: 'Magma Orange', outline: '#2a0a00', body: '#8b3a0a', hi: '#cd6a2a', accent: '#ffaa5a' },
  { name: 'Ghost White', outline: '#1a1a2a', body: '#5a5a7b', hi: '#9a9abd', accent: '#dadaff' },
];

export function getPalette(gene: number): Palette {
  return PALETTES[Math.floor(gene * PALETTES.length) % PALETTES.length];
}
