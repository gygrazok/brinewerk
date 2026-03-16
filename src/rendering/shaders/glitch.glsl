varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uTexture, uv);
  if (base.a < 0.01) { gl_FragColor = base; return; }

  // Glitch bursts: 1-2 per 1-3 seconds, short and snappy
  float a = sin(uTime * 2.5);
  float b2 = sin(uTime * 3.7 + 1.0);
  float c = sin(uTime * 5.3 + 2.5);
  float burst = max(max(
    smoothstep(0.82, 0.92, a),       // ~0.4s burst every ~2.5s
    smoothstep(0.85, 0.95, b2)),     // ~0.3s burst every ~1.7s
    smoothstep(0.88, 0.96, c) * 0.6  // lighter micro-glitch every ~1.2s
  );

  // Pixel grid size (40x40 grid)
  float gridSize = 40.0;
  float pixelSize = 1.0 / gridSize;

  // Scanline bands — whole pixel rows, only during burst
  float row = floor(uv.y * gridSize);
  float scanline = 1.0 - burst * 0.15 * step(0.5, fract(row * 0.5));

  // Horizontal shift — whole pixel offsets, only during burst on random bands
  float bandNoise = hash(vec2(row, floor(uTime * 4.0)));
  float hShift = burst * step(0.7, bandNoise) * floor((bandNoise - 0.5) * 4.0) * pixelSize;
  vec2 shiftedUv = vec2(uv.x + hShift, uv.y);

  // Chromatic aberration — 1 pixel offset during burst only
  float abr = burst > 0.3 ? pixelSize : 0.0;
  float r = texture2D(uTexture, shiftedUv + vec2(-abr, 0.0)).r;
  float g = texture2D(uTexture, shiftedUv).g;
  float b = texture2D(uTexture, shiftedUv + vec2(abr, 0.0)).b;

  vec3 col = vec3(r, g, b) * scanline;

  // Rare green pixel noise — only during burst, snapped to grid
  float px = hash(vec2(floor(uv.x * gridSize), row) + floor(uTime * 6.0));
  if (burst > 0.5 && px > 0.96) col = vec3(0.0, 1.0, 0.5);

  gl_FragColor = vec4(col, base.a);
}
