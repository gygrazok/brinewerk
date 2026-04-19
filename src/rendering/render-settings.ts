const STORAGE_KEY = 'brinewerk_render';

export interface RenderSettings {
  sandBackground: boolean;
  decorations: boolean;
  ambientParticles: boolean;
  lightRays: boolean;
  creatureGlow: boolean;
  rareShaders: boolean;
  rarePixelFx: boolean;
  slotGlow: boolean;
}

const DEFAULTS: RenderSettings = {
  sandBackground: true,
  decorations: true,
  ambientParticles: true,
  lightRays: true,
  creatureGlow: true,
  rareShaders: true,
  rarePixelFx: true,
  slotGlow: true,
};

let settings: RenderSettings = { ...DEFAULTS };

export function getRenderSettings(): Readonly<RenderSettings> {
  return settings;
}

export function loadRenderSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RenderSettings>;
      settings = { ...DEFAULTS, ...parsed };
    }
  } catch {
    // corrupt data — use defaults
  }
}
