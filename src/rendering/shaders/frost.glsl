varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);
  if (base.a < 0.01) {
    vec4 nearby = texture2D(uTexture, vTextureCoord + vec2(0.02, 0.0))
                + texture2D(uTexture, vTextureCoord - vec2(0.02, 0.0))
                + texture2D(uTexture, vTextureCoord + vec2(0.0, 0.02))
                + texture2D(uTexture, vTextureCoord - vec2(0.0, 0.02));
    if (nearby.a > 0.1) {
      float sparkle = hash(floor(vTextureCoord * 60.0) + floor(uTime * 2.0));
      if (sparkle > 0.7) {
        float bright = sin(uTime * 6.0 + vTextureCoord.x * 30.0 + vTextureCoord.y * 20.0) * 0.3 + 0.7;
        gl_FragColor = vec4(0.6 * bright, 0.85 * bright, 1.0 * bright, (sparkle - 0.7) * 3.0 * bright);
        return;
      }
    }
    gl_FragColor = base;
    return;
  }
  vec3 frost = base.rgb + vec3(-0.15, 0.03, 0.22);
  gl_FragColor = vec4(frost, base.a);
}
