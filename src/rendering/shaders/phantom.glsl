varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  float phase = sin(uTime * 1.5) * 0.25 + 0.75; // 0.5–1.0
  float drift = sin(uTime * 0.8 + vTextureCoord.y * 3.0) * 0.02;
  vec2 uv = vec2(vTextureCoord.x + drift, vTextureCoord.y);
  vec4 base = texture2D(uTexture, uv);
  if (base.a < 0.01) { gl_FragColor = vec4(0.0); return; }
  float lum = dot(base.rgb, vec3(0.299, 0.587, 0.114));
  vec3 ghost = mix(vec3(lum), base.rgb, 0.3) + vec3(0.15, 0.08, 0.25);
  float alpha = phase * base.a;
  gl_FragColor = vec4(ghost * alpha, alpha);
}
