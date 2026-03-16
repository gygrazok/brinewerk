varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

// 4x4 Bayer threshold matrix (normalized 0–1)
float bayer4(vec2 pos) {
  int x = int(mod(pos.x, 4.0));
  int y = int(mod(pos.y, 4.0));
  int idx = x + y * 4;
  if (idx ==  0) return  0.0 / 16.0;
  if (idx ==  1) return  8.0 / 16.0;
  if (idx ==  2) return  2.0 / 16.0;
  if (idx ==  3) return 10.0 / 16.0;
  if (idx ==  4) return 12.0 / 16.0;
  if (idx ==  5) return  4.0 / 16.0;
  if (idx ==  6) return 14.0 / 16.0;
  if (idx ==  7) return  6.0 / 16.0;
  if (idx ==  8) return  3.0 / 16.0;
  if (idx ==  9) return 11.0 / 16.0;
  if (idx == 10) return  1.0 / 16.0;
  if (idx == 11) return  9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return  7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 col = texture2D(uTexture, uv);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  // Game Boy palette (classic green)
  vec3 gb0 = vec3(0.06, 0.09, 0.06);  // darkest
  vec3 gb1 = vec3(0.19, 0.38, 0.19);  // dark
  vec3 gb2 = vec3(0.55, 0.67, 0.06);  // light
  vec3 gb3 = vec3(0.61, 0.74, 0.06);  // lightest

  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));

  // Bayer dithering on pixel grid
  vec2 pixelPos = floor(uv * 50.0);
  float bayer = bayer4(pixelPos);
  float dithered = lum + (bayer - 0.5) * 0.3;

  // Quantize to 4 levels
  vec3 result;
  if (dithered < 0.25) result = gb0;
  else if (dithered < 0.5) result = gb1;
  else if (dithered < 0.75) result = gb2;
  else result = gb3;

  // Subpixel scanlines
  float scanline = 0.6 + 0.4 * abs(sin(uv.y * 500.0));

  // CRT flicker
  float base = 0.92 + 0.08 * sin(uTime * 6.0);
  float glitch = pow(max(sin(uTime * 2.3), 0.0), 20.0) * 0.2;
  float flicker = base - glitch;

  gl_FragColor = vec4(result * scanline * flicker, col.a);
}
