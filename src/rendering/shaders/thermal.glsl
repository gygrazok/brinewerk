varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

// Infrared heat-map gradient: blue → cyan → green → yellow → orange → red → white
vec3 heatmap(float t) {
  vec3 c0 = vec3(0.0, 0.0, 0.4);   // deep blue
  vec3 c1 = vec3(0.0, 0.5, 0.7);   // cyan
  vec3 c2 = vec3(0.0, 0.7, 0.2);   // green
  vec3 c3 = vec3(0.8, 0.8, 0.0);   // yellow
  vec3 c4 = vec3(1.0, 0.5, 0.0);   // orange
  vec3 c5 = vec3(0.9, 0.1, 0.0);   // red
  vec3 c6 = vec3(1.0, 1.0, 1.0);   // white hot

  float s = t * 6.0;
  if (s < 1.0) return mix(c0, c1, s);
  if (s < 2.0) return mix(c1, c2, s - 1.0);
  if (s < 3.0) return mix(c2, c3, s - 2.0);
  if (s < 4.0) return mix(c3, c4, s - 3.0);
  if (s < 5.0) return mix(c4, c5, s - 4.0);
  return mix(c5, c6, s - 5.0);
}

// Simple hash for hotspot placement
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 col = texture2D(uTexture, uv);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  // Base luminance
  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));

  // Rising heat convection: luminance drifts upward over time
  float rise = sin(uv.x * 15.0 + uTime * 0.3) * 0.02;
  vec4 above = texture2D(uTexture, uv + vec2(rise, -0.02));
  float lumAbove = dot(above.rgb, vec3(0.299, 0.587, 0.114));
  // Blend with pixel above for heat-rising feel (only where above is also opaque)
  lum = mix(lum, lumAbove, above.a > 0.01 ? 0.2 : 0.0);

  // Pulsing hotspots: a few bright warm zones that wander slowly
  float hotspot = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 center = vec2(
      0.3 + 0.4 * sin(uTime * 0.3 + fi * 2.1),
      0.3 + 0.4 * sin(uTime * 0.25 + fi * 1.7)
    );
    float d = length(uv - center);
    float pulse = 0.7 + 0.3 * sin(uTime * 1.5 + fi * 3.0);
    hotspot += exp(-d * d * 60.0) * 0.15 * pulse;
  }
  lum = clamp(lum + hotspot, 0.0, 1.0);

  // Sensor noise/drift
  float drift = sin(uTime * 0.7 + uv.y * 12.0) * 0.04
              + sin(uTime * 1.3 + uv.x * 9.0) * 0.03;
  // Scanline interference (horizontal bands)
  float scanline = sin(uv.y * 120.0 + uTime * 4.0) * 0.03;
  lum = clamp(lum + drift + scanline, 0.0, 1.0);

  vec3 thermal = heatmap(lum);

  // Occasional full-frame recalibration flash
  float flash = pow(max(sin(uTime * 0.4), 0.0), 30.0);
  thermal = mix(thermal, vec3(1.0), flash * 0.15);

  gl_FragColor = vec4(thermal, col.a);
}
