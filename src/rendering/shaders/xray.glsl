varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec2 uv = vTextureCoord;
  vec4 col = texture2D(uTexture, uv);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  // Grayscale via luminance
  float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));

  // Invert: dark becomes bone-white
  float inv = 1.0 - lum;

  // Blue tint: shift toward cold medical display
  vec3 xray = vec3(inv * 0.7, inv * 0.85, inv * 1.0);

  // Horizontal scan band sweeping top-to-bottom
  float period = 3.0;
  float scanY = mod(uTime / period, 1.0);
  float scanDist = abs(uv.y - scanY);
  float scanBand = exp(-scanDist * scanDist * 800.0) * 0.5;
  xray += vec3(scanBand * 0.4, scanBand * 0.6, scanBand);

  // Subtle static noise for film grain feel
  float noise = fract(sin(dot(uv * 400.0 + uTime * 10.0, vec2(12.9898, 78.233))) * 43758.5453);
  xray += (noise - 0.5) * 0.06;

  gl_FragColor = vec4(xray, col.a);
}
