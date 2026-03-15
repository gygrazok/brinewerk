varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vTextureCoord;
  float band = step(0.7, sin(uv.y * 25.0 + uTime * 8.0));
  float offset = band * sin(uTime * 15.0 + uv.y * 10.0) * 0.08;
  uv.x += offset;
  float split = step(0.85, abs(sin(uTime * 6.0 + uv.y * 15.0))) * 0.015;
  float r = texture2D(uTexture, uv + vec2(-split, 0.0)).r;
  float g = texture2D(uTexture, uv).g;
  float b = texture2D(uTexture, uv + vec2(split, 0.0)).b;
  float a = texture2D(uTexture, uv).a;
  vec3 col = vec3(r, g, b);
  float noise = hash(uv * 100.0 + uTime * 5.0);
  if (noise > 0.97 && a > 0.1) col = vec3(0.0, 1.0, 0.53);
  col *= 0.9 + 0.1 * sin(uv.y * 80.0);
  gl_FragColor = vec4(col, a);
}
