varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 col = texture2D(uTexture, uv);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  float gridSize = 50.0;
  float row = floor(uv.y * gridSize);

  // Scanlines: alternating rows are dimmed
  float scanline = 0.85 + 0.15 * step(0.5, fract(row * 0.5));

  // Blue/cyan tint
  vec3 tinted = col.rgb * vec3(0.5, 0.8, 1.0);

  // Intermittent flicker: brief dips in opacity
  float flicker = 1.0;
  float f1 = sin(uTime * 7.3);
  float f2 = sin(uTime * 11.1 + 2.0);
  if (f1 > 0.92) flicker = 0.3;
  else if (f2 > 0.95) flicker = 0.5;

  // Horizontal jitter on rare flicker frames
  float jitter = 0.0;
  if (flicker < 0.5) {
    jitter = (hash(row + floor(uTime * 20.0)) - 0.5) * 0.03;
  }
  vec4 jitCol = texture2D(uTexture, vec2(uv.x + jitter, uv.y));
  vec3 final = mix(tinted, jitCol.rgb * vec3(0.5, 0.8, 1.0), step(0.01, abs(jitter)));

  gl_FragColor = vec4(final * scanline, col.a * flicker);
}
