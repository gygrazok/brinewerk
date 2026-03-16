varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);

  // Transparent pixels: pass through (bubbles are rendered at pixel grid level)
  if (base.a < 0.01) {
    gl_FragColor = base;
    return;
  }

  // Body: green toxic tint with pulsing
  float pulse = sin(uTime * 2.0 + length(vTextureCoord - 0.5) * 8.0) * 0.3 + 0.7;
  vec3 toxic = vec3(base.r * 0.4, min(1.0, base.g * 0.6 + 0.45 * pulse), base.b * 0.3);
  gl_FragColor = vec4(toxic, base.a);
}
