import { Filter, GlProgram } from 'pixi.js';
import type { RareEffect } from '../creatures/creature';

// Import GLSL fragment shaders
import metallicFrag from './shaders/metallic.glsl';
import glitchFrag from './shaders/glitch.glsl';
import fireFrag from './shaders/fire.glsl';
import frostFrag from './shaders/frost.glsl';
import shinyFrag from './shaders/shiny.glsl';
import nebulaFrag from './shaders/nebula.glsl';
import toxicFrag from './shaders/toxic.glsl';
import phantomFrag from './shaders/phantom.glsl';
import outlineFrag from './shaders/outline.glsl';
import glowFrag from './shaders/glow.glsl';

const RARE_FRAG: Partial<Record<RareEffect, string>> = {
  metallic: metallicFrag,
  glitch: glitchFrag,
  fire: fireFrag,
  frost: frostFrag,
  shiny: shinyFrag,
  nebula: nebulaFrag,
  toxic: toxicFrag,
  phantom: phantomFrag,
};

// Default vertex shader for PixiJS v8 filters
const defaultVertex = `
attribute vec2 aPosition;
varying vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`;

// Shared filter cache — one Filter per rare effect type
const rareFilterCache = new Map<RareEffect, Filter>();

/** Create a new Filter instance for a rare effect (not cached — caller owns lifecycle) */
export function createRareFilter(rare: RareEffect): Filter | null {
  const fragment = RARE_FRAG[rare as keyof typeof RARE_FRAG];
  if (!fragment) return null;

  try {
    return new Filter({
      glProgram: new GlProgram({ vertex: defaultVertex, fragment }),
      padding: 12,
      resources: {
        rareUniforms: {
          uTime: { value: 0, type: 'f32' },
        },
      },
    });
  } catch (e) {
    console.warn(`[shader] failed to compile filter for rare="${rare}":`, e);
    return null;
  }
}

/**
 * Get a shared/cached Filter for a rare effect (singleton per effect type).
 * Do NOT use for ephemeral views (panels, previews) — use createRareFilter instead.
 */
export function getRareFilter(rare: RareEffect): Filter | null {
  const cached = rareFilterCache.get(rare);
  if (cached) return cached;

  const filter = createRareFilter(rare);
  if (filter) rareFilterCache.set(rare, filter);
  return filter;
}

export function createOutlineFilter(
  color: [number, number, number, number] = [1, 1, 1, 1],
  width: number = 1,
  texelSize: [number, number] = [1 / 120, 1 / 120],
): Filter {
  return new Filter({
    glProgram: new GlProgram({ vertex: defaultVertex, fragment: outlineFrag }),
    padding: 2,
    resources: {
      outlineUniforms: {
        uOutlineColor: { value: new Float32Array(color), type: 'vec4<f32>' },
        uOutlineWidth: { value: width, type: 'f32' },
        uTexelSize: { value: new Float32Array(texelSize), type: 'vec2<f32>' },
      },
    },
  });
}

export function createGlowFilter(
  color: [number, number, number, number] = [0.5, 0.9, 0.9, 0.8],
  strength: number = 1.0,
  texelSize: [number, number] = [1 / 120, 1 / 120],
): Filter {
  return new Filter({
    glProgram: new GlProgram({ vertex: defaultVertex, fragment: glowFrag }),
    padding: 16,
    resources: {
      glowUniforms: {
        uGlowColor: { value: new Float32Array(color), type: 'vec4<f32>' },
        uGlowStrength: { value: strength, type: 'f32' },
        uTime: { value: 0, type: 'f32' },
        uTexelSize: { value: new Float32Array(texelSize), type: 'vec2<f32>' },
      },
    },
  });
}

/** Update uTime on all shared rare filters */
export function updateShaderTime(time: number): void {
  for (const filter of rareFilterCache.values()) {
    filter.resources.rareUniforms.uniforms.uTime = time;
  }
}

/** Destroy all cached filters and free GPU resources */
export function destroyRareFilterCache(): void {
  for (const filter of rareFilterCache.values()) {
    filter.destroy();
  }
  rareFilterCache.clear();
}
