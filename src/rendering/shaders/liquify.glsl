varying vec2 vTextureCoord;
varying vec2 vUvExtent;
uniform sampler2D uTexture;
uniform float uTime;

// Smooth noise for grouping columns into blobs
float smoothNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f); // smoothstep
  float a = sin(i * 127.1 + 311.7) * 0.5 + 0.5;
  float b = sin((i + 1.0) * 127.1 + 311.7) * 0.5 + 0.5;
  return mix(a, b, f);
}

void main() {
  vec2 uv = vTextureCoord;
  // Normalize UV to 0-1 (zoom-stable)
  vec2 nUv = uv / vUvExtent;

  // Group columns into ~5-8 pixel wide blobs using smooth noise
  float colGroup = nUv.x * 8.0;
  float groupPhase = smoothNoise(colGroup) * 6.28;

  // Each group sags on its own cycle: slow drip down, pause, slow drip
  float cycle = uTime * 0.5 + groupPhase;
  float drip = sin(cycle);
  // Only sag downward, clamp upward motion
  drip = max(drip, 0.0);
  // Soften the sag curve
  drip = drip * drip;

  // Sag increases toward the bottom of the sprite (gravity)
  float gravity = smoothstep(0.2, 0.8, nUv.y);
  // Convert offset back to raw UV space
  float maxShift = 4.0 / 50.0 * vUvExtent.y;
  float offset = drip * gravity * maxShift;

  vec2 melted = vec2(uv.x, uv.y - offset);
  gl_FragColor = texture2D(uTexture, melted);
}
