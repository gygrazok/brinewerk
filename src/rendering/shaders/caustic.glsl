varying vec2 vTextureCoord;
varying vec2 vUvExtent;
uniform sampler2D uTexture;
uniform float uTime;

// Hash for Worley noise cell points
vec2 cellPoint(vec2 cell, float offset) {
  float n = dot(cell, vec2(127.1 + offset, 311.7 + offset));
  vec2 h = vec2(sin(n) * 43758.5453, sin(n + 1.0) * 22578.1459);
  return fract(h);
}

// Single Worley layer: returns distance to nearest cell boundary (F2-F1)
float worleyEdge(vec2 uv, float scale, float timeOff) {
  vec2 p = uv * scale;
  vec2 cell = floor(p);
  vec2 frac = fract(p);

  float d1 = 10.0; // closest
  float d2 = 10.0; // second closest

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = cellPoint(cell + neighbor, timeOff);
      // Animate the points slowly
      point = 0.5 + 0.5 * sin(uTime * 0.4 + point * 6.2831 + timeOff);
      float d = length(neighbor + point - frac);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
  }
  return d2 - d1;
}

void main() {
  vec2 uv = vTextureCoord;
  vec4 col = texture2D(uTexture, uv);
  if (col.a < 0.01) { gl_FragColor = col; return; }

  // Normalize UV to 0-1 (zoom-stable)
  vec2 nUv = uv / vUvExtent;

  // Two overlapping caustic layers at different scales and time offsets
  float c1 = worleyEdge(nUv, 6.0, 0.0);
  float c2 = worleyEdge(nUv, 8.0, 3.14);

  // Sharp bright caustic lines where cell edges overlap
  float caustic = pow(c1, 0.5) * pow(c2, 0.5);
  // Narrow bright ridges: sharp threshold for visible lines
  float lines = 1.0 - smoothstep(0.0, 0.08, caustic);

  // Base: shift creature color toward aqua/teal
  vec3 underwater = mix(col.rgb, col.rgb * vec3(0.7, 0.95, 1.0), 0.4);

  // Caustic light: bright cyan-white lines overlaid
  vec3 causticColor = vec3(0.7, 1.0, 1.0) * lines * 0.8;

  // Darkened pools between caustic lines
  float shadow = smoothstep(0.05, 0.3, caustic) * 0.3 + 0.7;

  gl_FragColor = vec4(underwater * shadow + causticColor, col.a);
}
