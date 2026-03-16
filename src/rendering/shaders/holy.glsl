varying vec2 vTextureCoord;
varying vec2 vUvExtent;
uniform sampler2D uTexture;
uniform float uTime;

void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uTexture, uv);

  // Normalize UV to 0-1 using extent from vertex shader
  vec2 nUv = uv / vUvExtent;
  vec2 center = vec2(0.5, 0.5);
  vec2 dir = nUv - center;
  float dist = length(dir) * 2.0; // 0 at center, ~1 at edges
  float angle = atan(dir.y, dir.x);

  // --- Light rays behind the creature (only on transparent pixels) ---
  float rayAngle = angle + uTime * 0.4;
  float rays = pow(abs(sin(rayAngle * 4.0)), 8.0); // 8 sharp rays
  float rayFade = smoothstep(0.0, 0.3, dist) * smoothstep(1.1, 0.5, dist);
  float rayIntensity = rays * rayFade * 0.6;

  // Gentle pulse on ray brightness
  rayIntensity *= 0.7 + 0.3 * sin(uTime * 1.5);

  // Ray color: warm white/gold
  vec3 rayColor = vec3(1.0, 0.95, 0.8) * rayIntensity;

  // --- White aura glow around creature edges ---
  // Texel size: 1 pixel in UV space
  vec2 texel = vUvExtent / 50.0;
  float neighborAlpha = 0.0;
  neighborAlpha += texture2D(uTexture, uv + vec2(texel.x, 0.0)).a;
  neighborAlpha += texture2D(uTexture, uv - vec2(texel.x, 0.0)).a;
  neighborAlpha += texture2D(uTexture, uv + vec2(0.0, texel.y)).a;
  neighborAlpha += texture2D(uTexture, uv - vec2(0.0, texel.y)).a;
  neighborAlpha += texture2D(uTexture, uv + texel).a;
  neighborAlpha += texture2D(uTexture, uv - texel).a;
  neighborAlpha += texture2D(uTexture, uv + vec2(texel.x, -texel.y)).a;
  neighborAlpha += texture2D(uTexture, uv - vec2(texel.x, -texel.y)).a;

  // Second ring for wider glow
  vec2 t2 = texel * 2.0;
  float outerAlpha = 0.0;
  outerAlpha += texture2D(uTexture, uv + vec2(t2.x, 0.0)).a;
  outerAlpha += texture2D(uTexture, uv - vec2(t2.x, 0.0)).a;
  outerAlpha += texture2D(uTexture, uv + vec2(0.0, t2.y)).a;
  outerAlpha += texture2D(uTexture, uv - vec2(0.0, t2.y)).a;

  // Aura: visible on transparent pixels near opaque ones
  float nearEdge = step(0.01, neighborAlpha / 8.0) * (1.0 - base.a);
  float outerEdge = step(0.01, outerAlpha / 4.0) * (1.0 - base.a) * 0.4;
  float aura = max(nearEdge, outerEdge);

  // Pulsing aura brightness
  float auraPulse = 0.6 + 0.4 * sin(uTime * 2.0 + dist * 4.0);
  vec3 auraColor = vec3(1.0, 0.98, 0.9) * aura * auraPulse;

  // --- Compose ---
  if (base.a > 0.01) {
    float halo = 0.08 + 0.04 * sin(uTime * 2.0);
    gl_FragColor = vec4(base.rgb + vec3(halo, halo * 0.9, halo * 0.6), base.a);
  } else {
    float totalAlpha = min(1.0, rayIntensity + aura * 0.7);
    vec3 combined = rayColor + auraColor;
    gl_FragColor = vec4(combined, totalAlpha);
  }
}
