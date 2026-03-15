varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);
  if (base.a < 0.01) {
    vec4 above = texture2D(uTexture, vec2(vTextureCoord.x, vTextureCoord.y - 0.03));
    if (above.a > 0.1) {
      float drip = hash(floor(vec2(vTextureCoord.x * 30.0, uTime * 2.0)));
      if (drip > 0.6) {
        float dripLen = sin(uTime * 3.0 + vTextureCoord.x * 20.0) * 0.02 + 0.03;
        float d = smoothstep(dripLen, 0.0, vTextureCoord.y - (vTextureCoord.y - 0.03 + dripLen));
        if (d > 0.1) {
          float pulse = sin(uTime * 2.0 + vTextureCoord.x * 10.0) * 0.3 + 0.7;
          gl_FragColor = vec4(0.1, pulse * 0.8, 0.1, d * 0.7);
          return;
        }
      }
    }
    gl_FragColor = base;
    return;
  }
  float pulse = sin(uTime * 2.0 + length(vTextureCoord - 0.5) * 8.0) * 0.3 + 0.7;
  vec3 toxic = vec3(base.r * 0.4, min(1.0, base.g * 0.6 + 0.45 * pulse), base.b * 0.3);
  gl_FragColor = vec4(toxic, base.a);
}
