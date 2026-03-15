varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec4 c = texture2D(uTexture, vTextureCoord);
  if (c.a < 0.01) { gl_FragColor = c; return; }
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 desat = mix(vec3(lum), c.rgb, 0.3);
  float highlight = sin((vTextureCoord.x + vTextureCoord.y) * 15.0 + uTime * 2.0) * 0.3 + 0.5;
  vec3 metal = desat + vec3(highlight * 0.35, highlight * 0.35, highlight * 0.4);
  gl_FragColor = vec4(metal, c.a);
}
