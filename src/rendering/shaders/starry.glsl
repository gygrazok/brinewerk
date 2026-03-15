varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);
  if (base.a < 0.01) { gl_FragColor = base; return; }
  vec3 cosmic = base.rgb * vec3(0.5, 0.4, 0.5) + vec3(0.08, 0.04, 0.22);
  float starField = hash(floor(vTextureCoord * 50.0) + floor(uTime * 0.5));
  if (starField > 0.92) {
    float twinkle = sin(uTime * 5.0 + vTextureCoord.x * 30.0 + vTextureCoord.y * 20.0) * 0.4 + 0.6;
    cosmic = mix(cosmic, vec3(0.85 + twinkle * 0.15, 0.85 + twinkle * 0.15, 1.0), 0.8);
  }
  gl_FragColor = vec4(cosmic, base.a);
}
