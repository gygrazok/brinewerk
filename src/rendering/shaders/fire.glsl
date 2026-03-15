varying vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform float uTime;

// Simple pseudo-noise for flame turbulence
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.2;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 base = texture2D(uTexture, uv);

  // Sample nearby alpha to detect edges — search upward from transparent pixels
  if (base.a < 0.01) {
    float flame = 0.0;

    // Check multiple distances below (looking for the creature body)
    for (float i = 1.0; i < 8.0; i++) {
      float dist = i * 0.012;
      // Wobble X position for organic look
      float wobbleX = sin(uTime * 6.0 + uv.y * 25.0 + i * 1.7) * 0.015;
      vec2 samplePos = vec2(uv.x + wobbleX, uv.y + dist);
      vec4 s = texture2D(uTexture, samplePos);

      if (s.a > 0.1) {
        // Distance-based falloff: closer = stronger flame
        float strength = 1.0 - (dist / 0.096);
        strength = strength * strength;

        // Turbulent noise for organic flame shapes
        vec2 noiseCoord = vec2(uv.x * 12.0, uv.y * 8.0 - uTime * 3.5);
        float turb = fbm(noiseCoord + i * 0.5);

        // Flicker at different speeds per layer
        float flicker = sin(uTime * 10.0 + uv.x * 40.0 + i * 2.1) * 0.4 + 0.6;
        float flicker2 = sin(uTime * 7.3 + uv.x * 25.0 - i * 1.4) * 0.3 + 0.7;

        flame += strength * turb * flicker * flicker2 * 0.5;
      }
    }

    flame = clamp(flame, 0.0, 1.0);

    if (flame > 0.02) {
      // Fire color gradient: white core → yellow → orange → red tips
      vec3 col;
      if (flame > 0.8) {
        col = mix(vec3(1.0, 0.9, 0.4), vec3(1.0, 1.0, 0.85), (flame - 0.8) / 0.2);
      } else if (flame > 0.45) {
        col = mix(vec3(1.0, 0.45, 0.05), vec3(1.0, 0.9, 0.4), (flame - 0.45) / 0.35);
      } else {
        col = mix(vec3(0.6, 0.1, 0.0), vec3(1.0, 0.45, 0.05), flame / 0.45);
      }

      // Pulsing intensity
      float pulse = sin(uTime * 4.0) * 0.1 + 1.0;
      gl_FragColor = vec4(col * pulse, flame * 0.9);
    } else {
      gl_FragColor = base;
    }
    return;
  }

  // Body: warm tint + shifting inner glow
  float innerNoise = fbm(vec2(uv.x * 10.0 + uTime * 0.8, uv.y * 10.0 - uTime * 1.2));
  float hotspot = innerNoise * 0.3;
  vec3 tinted = base.rgb + vec3(0.2 + hotspot, hotspot * 0.4 - 0.02, -0.1);

  // Pulsing ember glow
  float ember = sin(uTime * 5.0 + uv.x * 20.0 + uv.y * 15.0) * 0.15 + 0.15;
  tinted += vec3(ember, ember * 0.25, 0.0);

  gl_FragColor = vec4(clamp(tinted, 0.0, 1.0), base.a);
}
