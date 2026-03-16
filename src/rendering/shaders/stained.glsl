varying vec2 vTextureCoord;
varying vec2 vUvExtent;
uniform sampler2D uTexture;
uniform float uTime;

// Hash functions for Worley noise
float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 cellPoint(vec2 cell) {
  float n = dot(cell, vec2(127.1, 311.7));
  return vec2(fract(sin(n) * 43758.5453), fract(sin(n + 1.0) * 22578.1459));
}

// Worley noise returning F1, F2 distances and nearest cell ID
void worley(vec2 uv, float scale, out float f1, out float f2, out vec2 nearestCell) {
  vec2 p = uv * scale;
  vec2 cell = floor(p);
  vec2 frac = fract(p);

  f1 = 10.0;
  f2 = 10.0;
  nearestCell = cell;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 nc = cell + neighbor;
      vec2 point = cellPoint(nc);
      float d = length(neighbor + point - frac);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        nearestCell = nc;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
}

// Bold stained glass palette — 8 saturated colors
vec3 stainedColor(float id) {
  float i = mod(id * 6.0, 8.0);
  if (i < 1.0) return vec3(0.85, 0.15, 0.15); // ruby
  if (i < 2.0) return vec3(0.15, 0.20, 0.80); // sapphire
  if (i < 3.0) return vec3(0.90, 0.75, 0.10); // amber
  if (i < 4.0) return vec3(0.15, 0.70, 0.30); // emerald
  if (i < 5.0) return vec3(0.70, 0.15, 0.65); // amethyst
  if (i < 6.0) return vec3(0.10, 0.65, 0.75); // teal
  if (i < 7.0) return vec3(0.85, 0.45, 0.10); // tangerine
  return vec3(0.80, 0.80, 0.85);               // clear
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 col = texture2D(uTexture, uv);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  // Normalize UV to 0-1 using extent from vertex shader (zoom-stable)
  vec2 nUv = uv / vUvExtent;

  float f1, f2;
  vec2 nearestCell;
  worley(nUv, 14.0, f1, f2, nearestCell);

  // Lead lines: dark border where F2 - F1 is small
  float edge = f2 - f1;
  float border = 1.0 - smoothstep(0.02, 0.12, edge);

  // Cell color from hash of nearest cell
  float cellId = hash1(nearestCell);
  vec3 glass = stainedColor(cellId);

  // Slow radial warm light sweep
  float sweep = sin(uTime * 0.8 + cellId * 6.28) * 0.5 + 0.5;
  float lightMod = 0.7 + 0.3 * sweep;

  // Mix: flat glass color (modulated by light) with dark lead border
  vec3 result = glass * lightMod;
  // Blend with original color slightly so creature shape reads through
  result = mix(col.rgb * 0.3, result, 0.7);
  // Darken borders
  result *= (1.0 - border * 0.8);

  gl_FragColor = vec4(result, col.a);
}
