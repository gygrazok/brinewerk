varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.2;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uTexture, uv);

  // Transparent pixels: pass through (fire strands are rendered at pixel grid level)
  if (base.a < 0.01) {
    gl_FragColor = base;
    return;
  }

  // Body: warm tint + shifting inner glow
  float innerNoise = fbm(vec2(uv.x * 10.0 + uTime * 0.8, uv.y * 10.0 - uTime * 1.2));
  float hotspot = innerNoise * 0.3;
  vec3 tinted = base.rgb + vec3(0.2 + hotspot, hotspot * 0.4 - 0.02, -0.1);

  // Pulsing ember glow
  float ember = sin(uTime * 5.0 + uv.x * 20.0 + uv.y * 15.0) * 0.15 + 0.15;
  tinted += vec3(ember, ember * 0.25, 0.0);

  gl_FragColor = vec4(clamp(tinted, 0.0, 1.0), base.a);
}
