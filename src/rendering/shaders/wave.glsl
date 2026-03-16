varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec2 uv = vTextureCoord;

  // Classic demoscene sine wave: each row is offset horizontally by a sine function
  float gridSize = 50.0;
  float row = floor(uv.y * gridSize);

  // Two layered waves at different speeds/frequencies for organic feel
  float wave1 = sin(row * 0.25 + uTime * 2.5) * 0.025;
  float wave2 = sin(row * 0.15 - uTime * 1.8 + 1.5) * 0.015;
  float offset = wave1 + wave2;

  vec2 waveUv = vec2(uv.x + offset, uv.y);
  vec4 col = texture2D(uTexture, waveUv);

  // Only tint actual creature pixels, not transparent background
  if (col.a > 0.01) {
    float peak = abs(offset) * 6.0;
    col.rgb += peak * vec3(0.02, 0.04, 0.06);
  }

  gl_FragColor = col;
}
