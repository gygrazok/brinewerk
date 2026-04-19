import type { CreatureType } from '../creatures/types';

const SYLLABLES: Record<string, { pre: string[]; mid: string[]; suf: string[] }> = {
  stellarid: {
    pre: ['Zar', 'Thor', 'Krix', 'Stel', 'Axi', 'Rax', 'Vex', 'Nok', 'Spir', 'Thar'],
    mid: ["'", '-', 'a', 'i', 'o'],
    suf: ['xil', 'ak', 'on', 'us', 'yx', 'ar', 'ix', 'el', 'um', 'is'],
  },
  blobid: {
    pre: ['Lum', 'Oob', 'Glu', 'Plu', 'Bub', 'Moo', 'Noo', 'Wob', 'Flo', 'Soo'],
    mid: ['a', 'u', 'o', 'i', 'ee'],
    suf: ['va', 'li', 'ba', 'na', 'ri', 'la', 'mi', 'pa', 'shi', 'zu'],
  },
  corallid: {
    pre: ['Den', 'Fron', 'Bra', 'Cor', 'Rhi', 'Arb', 'Phy', 'Ram', 'Lig', 'Pol'],
    mid: ['a', 'i', 'o', 'e', 'u'],
    suf: ['drik', 'dal', 'lix', 'ris', 'zon', 'nid', 'tex', 'ral', 'fex', 'kin'],
  },
  nucleid: {
    pre: ['Hex', 'Pol', 'Cry', 'Geo', 'Tes', 'Pyr', 'Oct', 'Fac', 'Pri', 'Sym'],
    mid: ['a', 'i', 'o', 'y', 'e'],
    suf: ['ion', 'trix', 'gon', 'dex', 'ron', 'lis', 'nar', 'zen', 'plex', 'tor'],
  },
  craboid: {
    pre: ['Car', 'Che', 'Scu', 'Pag', 'Gra', 'Cal', 'Pin', 'Uca', 'Bra', 'Mac'],
    mid: ['a', 'i', 'o', 'e', 'u'],
    suf: ['pus', 'dax', 'cer', 'ton', 'ops', 'rix', 'vus', 'nax', 'tes', 'ger'],
  },
};

export function generateName(type: CreatureType, rng: () => number): string {
  const s = SYLLABLES[type];
  const pre = s.pre[Math.floor(rng() * s.pre.length)];
  const mid = s.mid[Math.floor(rng() * s.mid.length)];
  const suf = s.suf[Math.floor(rng() * s.suf.length)];
  return pre + mid + suf;
}
