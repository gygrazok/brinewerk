varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);
  if (base.a < 0.01) { gl_FragColor = base; return; }
  float wave = sin(vTextureCoord.x * 8.0 + vTextureCoord.y * 5.0 - uTime * 3.0) * 0.5 + 0.5;
  float boost = smoothstep(0.75, 1.0, wave) * 0.5;
  vec3 shiny = base.rgb + vec3(boost);
  float sparkle = hash(floor(vTextureCoord * 40.0) + floor(uTime * 3.0));
  if (sparkle > 0.96) {
    vec2 fv = fract(vTextureCoord * 40.0) - 0.5;
    float cross_shape = min(abs(fv.x), abs(fv.y));
    if (cross_shape < 0.15) {
      shiny = vec3(1.0, 0.95, 0.7);
    }
  }
  gl_FragColor = vec4(shiny, base.a);
}
