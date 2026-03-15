varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform vec4 uGlowColor;
uniform float uGlowStrength;
uniform float uTime;
uniform vec2 uTexelSize;

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);

  if (base.a > 0.1) {
    gl_FragColor = base;
    return;
  }

  // Sample in a wider radius for glow
  float glowAlpha = 0.0;
  float samples = 0.0;
  for (float dx = -3.0; dx <= 3.0; dx += 1.0) {
    for (float dy = -3.0; dy <= 3.0; dy += 1.0) {
      float dist = length(vec2(dx, dy));
      if (dist > 3.5) continue;
      vec2 offset = vec2(dx, dy) * uTexelSize;
      float a = texture2D(uTexture, vTextureCoord + offset).a;
      float weight = 1.0 - dist / 3.5;
      glowAlpha += a * weight;
      samples += weight;
    }
  }
  glowAlpha /= samples;

  if (glowAlpha > 0.01) {
    float pulse = sin(uTime * 3.0) * 0.15 + 0.85;
    float alpha = glowAlpha * uGlowStrength * pulse;
    gl_FragColor = vec4(uGlowColor.rgb, alpha * uGlowColor.a);
  } else {
    gl_FragColor = base;
  }
}
