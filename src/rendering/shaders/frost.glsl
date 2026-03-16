varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);

  // Transparent pixels: pass through (twinkles are rendered at pixel grid level)
  if (base.a < 0.01) {
    gl_FragColor = base;
    return;
  }

  // Cool blue tint — desaturate slightly then push toward ice-blue
  float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
  vec3 desat = mix(base.rgb, vec3(lum), 0.25);
  vec3 frost = desat + vec3(-0.12, 0.06, 0.24);

  // Slow pulsing icy shimmer across the body
  float shimmer = sin(vTextureCoord.x * 12.0 + vTextureCoord.y * 8.0 + uTime * 1.5) * 0.5 + 0.5;
  float iceGlow = smoothstep(0.6, 1.0, shimmer) * 0.2;
  frost += vec3(iceGlow * 0.5, iceGlow * 0.8, iceGlow);

  // Occasional frozen sparkle
  float sparkle = hash(floor(vTextureCoord * 30.0) + floor(uTime * 2.0));
  if (sparkle > 0.97) {
    frost = mix(frost, vec3(0.85, 0.95, 1.0), 0.6);
  }

  gl_FragColor = vec4(clamp(frost, 0.0, 1.0), base.a);
}
