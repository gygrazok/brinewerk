varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform vec4 uOutlineColor;
uniform float uOutlineWidth;
uniform vec2 uTexelSize;

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);

  if (base.a > 0.1) {
    gl_FragColor = base;
    return;
  }

  // Sample neighbors to detect edges
  float maxAlpha = 0.0;
  for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
    for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
      if (dx == 0.0 && dy == 0.0) continue;
      vec2 offset = vec2(dx, dy) * uTexelSize * uOutlineWidth;
      float neighborAlpha = texture2D(uTexture, vTextureCoord + offset).a;
      maxAlpha = max(maxAlpha, neighborAlpha);
    }
  }

  if (maxAlpha > 0.1) {
    gl_FragColor = uOutlineColor;
  } else {
    gl_FragColor = base;
  }
}
