varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform vec4 uGlowColor;
uniform float uGlowStrength;
uniform float uTime;
uniform vec2 uTexelSize;

// Angular ray-cast glow (based on @pixi/filter-glow approach)
// Casts rays outward at many angles, samples alpha along each ray,
// weights by inverse distance for smooth radial falloff.

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);

  if (base.a > 0.1) {
    gl_FragColor = base;
    return;
  }

  float maxDist = 12.0;       // max ray distance in texels
  float angleSteps = 20.0;    // number of rays
  vec2 px = uTexelSize;

  float totalAlpha = 0.0;
  float totalWeight = 0.0;

  for (float angle = 0.0; angle < 6.283185; angle += 0.31416) { // ~20 steps
    vec2 dir = vec2(cos(angle), sin(angle)) * px;
    for (float d = 1.0; d <= 12.0; d += 1.0) {
      vec2 samplePos = vTextureCoord + dir * d;
      float a = texture2D(uTexture, samplePos).a;
      // Quadratic falloff — smooth and natural
      float w = (maxDist - d) / maxDist;
      w = w * w;
      totalAlpha += a * w;
      totalWeight += w;
    }
  }

  totalAlpha /= max(totalWeight, 1.0);

  if (totalAlpha > 0.001) {
    // Smooth power curve for feathered edge
    float glow = pow(totalAlpha, 0.8);

    // Subtle pulse
    float pulse = sin(uTime * 2.0) * 0.05 + 0.95;

    float alpha = glow * uGlowStrength * 0.5 * pulse;
    gl_FragColor = vec4(uGlowColor.rgb, clamp(alpha * uGlowColor.a, 0.0, 0.4));
  } else {
    gl_FragColor = base;
  }
}
