varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec4 col = texture2D(uTexture, vTextureCoord);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  // Smooth pulse between normal and inverted: mostly inverted with periodic flashes back
  float pulse = smoothstep(0.4, 0.6, sin(uTime * 1.5) * 0.5 + 0.5);
  vec3 inverted = vec3(1.0) - col.rgb;

  gl_FragColor = vec4(mix(col.rgb, inverted, pulse), col.a);
}
