varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);

  // Transparent pixels: pass through (twinkles are rendered at pixel grid level)
  if (base.a < 0.01) {
    gl_FragColor = base;
    return;
  }

  // Body: cool blue tint
  vec3 frost = base.rgb + vec3(-0.15, 0.03, 0.22);
  gl_FragColor = vec4(frost, base.a);
}
