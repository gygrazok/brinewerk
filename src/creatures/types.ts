export enum CreatureType {
  Stellarid = 'stellarid',
  Blobid = 'blobid',
  Corallid = 'corallid',
  Nucleid = 'nucleid',
  Craboid = 'craboid',
}

export const CREATURE_ICONS: Record<CreatureType, string> = {
  [CreatureType.Stellarid]: '✦',
  [CreatureType.Blobid]: '◎',
  [CreatureType.Corallid]: '❋',
  [CreatureType.Nucleid]: '◇',
  [CreatureType.Craboid]: '⬣',
};

export const CREATURE_NAMES: Record<CreatureType, string> = {
  [CreatureType.Stellarid]: 'Stellarid',
  [CreatureType.Blobid]: 'Blobid',
  [CreatureType.Corallid]: 'Corallid',
  [CreatureType.Nucleid]: 'Nucleid',
  [CreatureType.Craboid]: 'Craboid',
};

/** Base plankton multiplier per type */
export const TYPE_MULTIPLIERS: Record<CreatureType, number> = {
  [CreatureType.Stellarid]: 1.0,
  [CreatureType.Blobid]: 0.6,
  [CreatureType.Corallid]: 0.8,
  [CreatureType.Nucleid]: 0.5,
  [CreatureType.Craboid]: 0.9,
};
