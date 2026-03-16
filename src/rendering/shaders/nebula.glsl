varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise for nebula
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

void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uTexture, uv);
  if (base.a < 0.01) { gl_FragColor = base; return; }

  // Dark cosmic base — desaturate and darken
  float luma = dot(base.rgb, vec3(0.3, 0.5, 0.2));
  vec3 cosmic = vec3(luma * 0.35) + vec3(0.04, 0.02, 0.12);

  // Slow drifting nebula layers (purple/blue/magenta)
  float t = uTime * 0.3;
  float n1 = noise(uv * 6.0 + vec2(t, t * 0.7));
  float n2 = noise(uv * 10.0 - vec2(t * 0.5, t * 0.9));
  vec3 nebula1 = vec3(0.25, 0.05, 0.35) * smoothstep(0.35, 0.7, n1);
  vec3 nebula2 = vec3(0.05, 0.08, 0.30) * smoothstep(0.4, 0.75, n2);
  cosmic += nebula1 + nebula2;

  gl_FragColor = vec4(cosmic, base.a);
}
