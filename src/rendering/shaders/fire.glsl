varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec4 base = texture2D(uTexture, vTextureCoord);
  if (base.a < 0.01) {
    vec2 p = vTextureCoord;
    float fireY = 0.0;
    for (float i = 0.0; i < 5.0; i++) {
      vec2 fp = vec2(p.x + sin(uTime * 4.0 + i * 2.3) * 0.05, p.y);
      float checkDist = 0.02 + i * 0.01;
      vec4 below = texture2D(uTexture, vec2(fp.x, fp.y + checkDist));
      if (below.a > 0.1) {
        float flame = smoothstep(checkDist, 0.0, fp.y + checkDist - vTextureCoord.y);
        float flicker = sin(uTime * 8.0 + vTextureCoord.x * 30.0 + i) * 0.5 + 0.5;
        fireY += flame * flicker * 0.3;
      }
    }
    if (fireY > 0.05) {
      gl_FragColor = vec4(1.0, 0.3 + fireY * 0.7, fireY * 0.1, fireY);
    } else {
      gl_FragColor = base;
    }
    return;
  }
  vec3 tinted = base.rgb + vec3(0.15, -0.02, -0.1);
  float edgeGlow = sin(uTime * 5.0 + vTextureCoord.x * 20.0) * 0.15 + 0.1;
  tinted += vec3(edgeGlow, edgeGlow * 0.3, 0.0);
  gl_FragColor = vec4(tinted, base.a);
}
