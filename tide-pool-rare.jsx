import { useState, useRef, useEffect } from "react";

// === GENETICS ===
const TYPES = ["stellarid", "blobid", "corallid", "nucleid"];
const TYPE_LABELS = { stellarid: "Stellarid", blobid: "Blobid", corallid: "Corallid", nucleid: "Nucleid" };
const TYPE_ICONS = { stellarid: "✦", blobid: "◎", corallid: "❋", nucleid: "◇" };

const RARE_EFFECTS = [
  { id: "none", label: "None", icon: "", chance: 0.60, color: "#8ba0a8" },
  { id: "metallic", label: "Metallic", icon: "⚙", chance: 0.08, color: "#c0c8d0" },
  { id: "glitch", label: "Glitch", icon: "▦", chance: 0.05, color: "#00ff88" },
  { id: "fire", label: "On Fire", icon: "🔥", chance: 0.05, color: "#ff6020" },
  { id: "frost", label: "Frost", icon: "❄", chance: 0.05, color: "#80d0ff" },
  { id: "shiny", label: "Shiny", icon: "✨", chance: 0.05, color: "#ffe040" },
  { id: "starry", label: "Starry", icon: "★", chance: 0.04, color: "#c0a0ff" },
  { id: "toxic", label: "Toxic", icon: "☣", chance: 0.04, color: "#80ff40" },
  { id: "phantom", label: "Phantom", icon: "👻", chance: 0.04, color: "#a080c0" },
];

const TRAIT_DEFS = {
  arms: { min: 3, max: 8 }, size: { min: 8, max: 18 }, fatness: { min: 0.3, max: 1.0 },
  spikes: { min: 0, max: 3 }, pattern: { min: 0, max: 4 }, glow: { min: 0, max: 1 },
  eyes: { min: 0, max: 3 }, wobble: { min: 0, max: 3 }, tentacles: { min: 2, max: 8 },
  branches: { min: 2, max: 5 }, density: { min: 0.3, max: 1.0 }, facets: { min: 4, max: 10 },
  rings: { min: 1, max: 4 },
};

const PALETTES = [
  { body: "#e04040", accent: "#ff8080", outline: "#801818", eye: "#fff", name: "Crimson" },
  { body: "#e08020", accent: "#ffc060", outline: "#804010", eye: "#fff", name: "Amber" },
  { body: "#40a040", accent: "#80e080", outline: "#185018", eye: "#fff", name: "Moss" },
  { body: "#3060c0", accent: "#60a0ff", outline: "#182860", eye: "#fff", name: "Deep Blue" },
  { body: "#9040b0", accent: "#d080ff", outline: "#481860", eye: "#fff", name: "Violet" },
  { body: "#c04080", accent: "#ff80b0", outline: "#601838", eye: "#fff", name: "Coral" },
  { body: "#30a0a0", accent: "#60e0e0", outline: "#184848", eye: "#fff", name: "Teal" },
  { body: "#a0a040", accent: "#e0e080", outline: "#484818", eye: "#fff", name: "Kelp" },
  { body: "#e06860", accent: "#ffb0a0", outline: "#803028", eye: "#fff", name: "Salmon" },
  { body: "#5070d0", accent: "#90b0ff", outline: "#283868", eye: "#fff", name: "Cobalt" },
];

function rollRareEffect() {
  let r = Math.random(), cum = 0;
  for (const e of RARE_EFFECTS) { cum += e.chance; if (r < cum) return e.id; }
  return "none";
}

function randomGene() {
  const g = {};
  for (const k of Object.keys(TRAIT_DEFS)) g[k] = Math.random();
  g.palette1 = Math.floor(Math.random() * PALETTES.length);
  g.palette2 = Math.floor(Math.random() * PALETTES.length);
  g.type = TYPES[Math.floor(Math.random() * TYPES.length)];
  g.seed = Math.random() * 10000;
  g.rare = rollRareEffect();
  return g;
}

function randomOfType(type) { const g = randomGene(); g.type = type; return g; }

function breedGenes(a, b) {
  const c = {};
  for (const k of Object.keys(TRAIT_DEFS)) {
    const p = Math.random();
    if (p < 0.4) c[k] = a[k]; else if (p < 0.8) c[k] = b[k];
    else c[k] = (a[k] + b[k]) / 2 + (Math.random() - 0.5) * 0.2;
    if (Math.random() < 0.08) c[k] = Math.random();
    c[k] = Math.max(0, Math.min(1, c[k]));
  }
  c.palette1 = Math.random() < 0.5 ? a.palette1 : b.palette1;
  c.palette2 = Math.random() < 0.5 ? a.palette2 : b.palette2;
  if (Math.random() < 0.1) c.palette1 = Math.floor(Math.random() * PALETTES.length);
  if (Math.random() < 0.1) c.palette2 = Math.floor(Math.random() * PALETTES.length);
  c.type = a.type === b.type ? a.type : (Math.random() < 0.15 ? TYPES[Math.floor(Math.random() * TYPES.length)] : (Math.random() < 0.5 ? a.type : b.type));
  c.seed = Math.random() * 10000;
  // rare inheritance: parents boost rare chance
  const parentRare = [a.rare, b.rare].filter(r => r !== "none");
  if (parentRare.length > 0 && Math.random() < 0.25) {
    c.rare = parentRare[Math.floor(Math.random() * parentRare.length)];
  } else if (parentRare.length === 2 && Math.random() < 0.10) {
    // two rare parents can produce a new rare
    c.rare = rollRareEffect();
    if (c.rare === "none") c.rare = parentRare[0]; // guarantee rare from rare parents more often
  } else {
    c.rare = rollRareEffect();
  }
  return c;
}

function tv(gene, trait) { const d = TRAIT_DEFS[trait]; return d.min + gene * (d.max - d.min); }

// === BASE RENDERERS ===
function _sr(x, y, seed) { const n = Math.sin(x * 127.1 + y * 311.7 + seed) * 43758.5453; return n - Math.floor(n); }
function _sp(grid, x, y, color) { grid[`${Math.round(x)},${Math.round(y)}`] = color; }
function _dc(grid, cx, cy, r, fill, outline) {
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= r) _sp(grid, cx + dx, cy + dy, d > r - 1.2 ? outline : fill);
  }
}
function _eyes(grid, genes, pal, cx, cy) {
  const eyes = Math.round(tv(genes.eyes, "eyes"));
  const pos = [];
  if (eyes >= 1) pos.push([cx - 2, cy - 1]);
  if (eyes >= 2) pos.push([cx + 2, cy - 1]);
  if (eyes >= 3) pos.push([cx, cy + 1]);
  for (const [ex, ey] of pos) { _sp(grid, ex, ey, pal.eye); _sp(grid, ex, ey - 1, pal.outline); }
}

function renderStellaris(grid, genes, time) {
  const pal = PALETTES[genes.palette1], pal2 = PALETTES[genes.palette2];
  const arms = Math.round(tv(genes.arms, "arms")), size = Math.round(tv(genes.size, "size"));
  const fatness = tv(genes.fatness, "fatness"), spikes = Math.round(tv(genes.spikes, "spikes"));
  const pattern = Math.round(tv(genes.pattern, "pattern")), wobble = tv(genes.wobble, "wobble");
  const bodyR = Math.round(size * 0.35 * fatness + 2);
  for (let dy = -bodyR - 1; dy <= bodyR + 1; dy++) for (let dx = -bodyR - 1; dx <= bodyR + 1; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= bodyR) { const o = d > bodyR - 1.2; let c = o ? pal.outline : pal.body;
      if (!o && pattern >= 1 && (dx + dy) % 3 === 0) c = pal.accent;
      if (!o && pattern >= 2 && _sr(dx, dy, genes.seed) > 0.75) c = pal2.body;
      if (!o && pattern >= 3 && Math.abs(dx) < 2) c = pal2.accent;
      _sp(grid, dx, dy, c); }
  }
  for (let i = 0; i < arms; i++) {
    const angle = (i / arms) * Math.PI * 2 - Math.PI / 2 + Math.sin(time * 2 + i * 1.5) * wobble * 0.06;
    const armLen = size, armW = Math.max(2, Math.round(size * 0.22 * fatness));
    for (let t = 0; t <= armLen; t++) {
      const taper = 1 - (t / armLen) * 0.7, w = Math.max(1, Math.round(armW * taper));
      const ax = Math.cos(angle) * (bodyR - 1 + t), ay = Math.sin(angle) * (bodyR - 1 + t);
      const px = -Math.sin(angle), py = Math.cos(angle);
      for (let s = -w; s <= w; s++) { const fx = Math.round(ax + px * s), fy = Math.round(ay + py * s);
        const edge = Math.abs(s) >= w || t === armLen; let c = edge ? pal.outline : pal.body;
        if (!edge && pattern >= 2 && t % 4 < 2) c = pal.accent; _sp(grid, fx, fy, c); }
      if (spikes >= 1 && t % Math.max(3, 7 - spikes) === 0 && t > 2 && t < armLen - 1)
        for (let s2 = 1; s2 <= Math.min(spikes + 1, 4); s2++) {
          const side = t % 2 === 0 ? 1 : -1;
          _sp(grid, Math.round(ax + px * (w + s2) * side), Math.round(ay + py * (w + s2) * side), s2 === Math.min(spikes + 1, 4) ? pal.outline : pal.accent);
        }
    }
  }
  _eyes(grid, genes, pal, 0, 0);
}

function renderBlobid(grid, genes, time) {
  const pal = PALETTES[genes.palette1], pal2 = PALETTES[genes.palette2];
  const size = Math.round(tv(genes.size, "size")), fatness = tv(genes.fatness, "fatness");
  const pattern = Math.round(tv(genes.pattern, "pattern")), tentacles = Math.round(tv(genes.tentacles, "tentacles"));
  const wobble = tv(genes.wobble, "wobble"), bodyR = Math.round(size * 0.45 * fatness + 3);
  const hw = bodyR, hh = Math.round(bodyR * 1.3);
  for (let dy = -hh - 1; dy <= 1; dy++) for (let dx = -hw - 1; dx <= hw + 1; dx++) {
    const nx = dx / hw, ny = dy / hh, d = Math.sqrt(nx * nx + ny * ny);
    if (d <= 1.0) { const o = d > 0.85; let c = o ? pal.outline : pal.body;
      if (!o && pattern >= 1 && Math.abs(dy) % 3 === 0) c = pal.accent;
      if (!o && pattern >= 2 && _sr(dx, dy, genes.seed) > 0.8) c = pal2.body;
      if (!o && pattern >= 3 && dy < -hh * 0.5 && Math.abs(dx) < hw * 0.3) c = pal2.accent;
      _sp(grid, dx, dy, c); }
  }
  for (let dx = -hw + 1; dx <= hw - 1; dx++) { _sp(grid, dx, 1, pal.accent); _sp(grid, dx, 2, pal.outline); }
  for (let i = 0; i < tentacles; i++) {
    const tx = Math.round(-hw + 2 + (i / (tentacles - 1 || 1)) * (hw * 2 - 4));
    const tLen = Math.round(size * 0.8 + _sr(i, 0, genes.seed) * size * 0.5);
    const sway = Math.sin(time * 1.8 + i * 2.1) * wobble * 1.2;
    for (let t = 0; t < tLen; t++) {
      const ox = Math.round(tx + Math.sin(t * 0.3 + time + i) * sway), py = 3 + t;
      _sp(grid, ox, py, t % 3 === 0 ? pal.accent : (t === tLen - 1 ? pal.outline : pal.body));
      if (t % 2 === 0) _sp(grid, ox + 1, py, pal.outline);
    }
  }
  _eyes(grid, genes, pal, 0, -Math.round(hh * 0.3));
}

function renderCorallid(grid, genes, time) {
  const pal = PALETTES[genes.palette1], pal2 = PALETTES[genes.palette2];
  const branches = Math.round(tv(genes.branches, "branches")), density = tv(genes.density, "density");
  const size = Math.round(tv(genes.size, "size")), pattern = Math.round(tv(genes.pattern, "pattern"));
  const wobble = tv(genes.wobble, "wobble");
  const baseW = Math.max(2, Math.round(size * 0.2)), baseH = Math.round(size * 0.3);
  for (let dy = 0; dy < baseH; dy++) for (let dx = -baseW; dx <= baseW; dx++)
    _sp(grid, dx, size * 0.5 - dy, (Math.abs(dx) >= baseW || dy === 0) ? pal.outline : pal.body);
  const drawB = (sx, sy, angle, len, depth) => {
    const sway = Math.sin(time * 1.2 + depth * 3 + sx * 0.5) * wobble * 0.08;
    for (let t = 0; t < len; t++) {
      const bx = Math.round(sx + Math.cos(angle + sway) * t), by = Math.round(sy + Math.sin(angle + sway) * t);
      const w = Math.max(1, Math.round((1 - t / len) * (depth === 0 ? 3 : 2) * density));
      for (let s = -w; s <= w; s++) { const ppx = bx + Math.round(-Math.sin(angle) * s), ppy = by + Math.round(Math.cos(angle) * s);
        const edge = Math.abs(s) >= w || t === len - 1; let c = edge ? pal.outline : pal.body;
        if (!edge && pattern >= 1 && t % 3 === 0) c = pal.accent;
        if (!edge && pattern >= 2 && _sr(bx, by, genes.seed) > 0.7) c = pal2.body;
        _sp(grid, ppx, ppy, c); }
      if (t === len - 1 && depth > 0) _dc(grid, bx, by, 2, pattern >= 3 ? pal2.accent : pal.accent, pal.outline);
    }
  };
  for (let i = 0; i < branches; i++) {
    const angle = -Math.PI / 2 + (i - (branches - 1) / 2) * (1.2 / branches);
    const len = Math.round(size * (0.6 + _sr(i, 1, genes.seed) * 0.4));
    drawB(0, size * 0.5 - baseH, angle, len, 0);
    for (let j = 0; j < Math.round(density * 3); j++) {
      const t = Math.round(len * (0.4 + j * 0.2));
      drawB(Math.round(Math.cos(angle) * t), Math.round(size * 0.5 - baseH + Math.sin(angle) * t), angle + (j % 2 === 0 ? 0.5 : -0.5), Math.round(len * 0.4), 1);
    }
  }
  const ec = Math.round(tv(genes.eyes, "eyes"));
  if (ec >= 1) { _sp(grid, -1, Math.round(size * 0.35), pal.eye); _sp(grid, -1, Math.round(size * 0.35) - 1, pal.outline); }
  if (ec >= 2) { _sp(grid, 1, Math.round(size * 0.35), pal.eye); _sp(grid, 1, Math.round(size * 0.35) - 1, pal.outline); }
}

function renderNucleid(grid, genes, time) {
  const pal = PALETTES[genes.palette1], pal2 = PALETTES[genes.palette2];
  const facets = Math.round(tv(genes.facets, "facets")), rings = Math.round(tv(genes.rings, "rings"));
  const size = Math.round(tv(genes.size, "size")), pattern = Math.round(tv(genes.pattern, "pattern"));
  const spikes = Math.round(tv(genes.spikes, "spikes")), wobble = tv(genes.wobble, "wobble");
  for (let r = rings; r >= 0; r--) {
    const radius = Math.round((size * 0.6) * ((r + 1) / (rings + 1))), isOuter = r === rings;
    const c1 = r % 2 === 0 ? pal.body : pal.accent, c2 = r % 2 === 0 ? pal2.body : pal.body;
    const rot = time * 0.3 * (r % 2 === 0 ? 1 : -1) * wobble * 0.2;
    for (let dy = -radius - 2; dy <= radius + 2; dy++) for (let dx = -radius - 2; dx <= radius + 2; dx++) {
      const ad = Math.sqrt(dx * dx + dy * dy); if (ad > radius + 1) continue;
      const a = Math.atan2(dy, dx) + rot, sect = (2 * Math.PI) / facets;
      const rem = ((a % sect) + sect) % sect, polyR = radius * Math.cos(Math.PI / facets) / Math.cos(rem - Math.PI / facets);
      if (ad <= Math.abs(polyR) + 0.5) { const edge = ad > Math.abs(polyR) - 1.2;
        let c = edge ? pal.outline : (pattern >= 2 && _sr(dx, dy, genes.seed) > 0.8 ? c2 : c1);
        if (!edge && pattern >= 1 && (Math.abs(dx) + Math.abs(dy)) % 4 === 0) c = pal.accent;
        _sp(grid, dx, dy, c); }
    }
    for (let i = 0; i < facets; i++) { const a = (i / facets) * Math.PI * 2 + rot;
      _sp(grid, Math.round(Math.cos(a) * radius), Math.round(Math.sin(a) * radius), pal.accent);
      if (spikes >= 1 && isOuter) for (let s2 = 1; s2 <= spikes + 1; s2++)
        _sp(grid, Math.round(Math.cos(a) * (radius + s2)), Math.round(Math.sin(a) * (radius + s2)), s2 === spikes + 1 ? pal.outline : pal.accent);
    }
    if (r < rings && pattern >= 3) { const outerR = Math.round((size * 0.6) * ((r + 2) / (rings + 1)));
      for (let i = 0; i < facets; i++) { const a = (i / facets) * Math.PI * 2 + rot;
        for (let t = radius; t < outerR; t += 2) _sp(grid, Math.round(Math.cos(a) * t), Math.round(Math.sin(a) * t), pal.outline); } }
  }
  _dc(grid, 0, 0, 2, pattern >= 4 ? pal2.accent : pal.accent, pal.outline);
  _eyes(grid, genes, pal, 0, 0);
}

// === COLOR UTILS ===
function hexToRgb(hex) { const m = hex.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i); return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : [0,0,0]; }
function rgbToHex(r,g,b) { return `#${[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}`; }
function lerp(a,b,t) { return a+(b-a)*t; }

// === RARE EFFECT SHADERS (pixel-level post-process) ===
function applyRareEffect(grid, genes, time) {
  if (genes.rare === "none") return grid;
  const entries = Object.entries(grid);
  const out = {};
  const W = 200, H = 200; // virtual canvas bounds for effects

  switch (genes.rare) {
    case "metallic": {
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        const lum = (r * 0.299 + g * 0.587 + b * 0.114);
        // metallic: desaturate + specular highlight bands
        const highlight = Math.sin((x + y) * 0.4 + time * 2) * 0.3 + 0.5;
        const metalR = lerp(lum, r, 0.3) + highlight * 80;
        const metalG = lerp(lum, g, 0.3) + highlight * 80;
        const metalB = lerp(lum, b, 0.3) + highlight * 90;
        out[key] = rgbToHex(metalR, metalG, metalB);
      }
      break;
    }
    case "glitch": {
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        // horizontal scanline displacement
        const glitchBand = Math.sin(y * 0.8 + time * 8) > 0.7;
        const offset = glitchBand ? Math.round(Math.sin(time * 15 + y) * 4) : 0;
        const newKey = `${x + offset},${y}`;
        // RGB channel split
        const split = Math.abs(Math.sin(time * 6 + y * 0.5)) > 0.85 ? 2 : 0;
        if (split > 0) {
          // chromatic aberration
          const kR = `${x + offset - split},${y}`;
          const kB = `${x + offset + split},${y}`;
          if (!out[kR]) out[kR] = rgbToHex(r, 0, 0);
          if (!out[kB]) out[kB] = rgbToHex(0, 0, b);
          out[newKey] = rgbToHex(0, g, 0);
        } else {
          out[newKey] = color;
        }
        // random pixel noise
        if (Math.random() < 0.02) out[key] = "#00ff88";
      }
      break;
    }
    case "fire": {
      // copy base
      for (const [key, color] of entries) out[key] = color;
      // add fire particles rising from top pixels
      const topPixels = {};
      for (const [key] of entries) {
        const [x, y] = key.split(",").map(Number);
        const above = `${x},${y - 1}`;
        if (!grid[above]) topPixels[key] = true;
      }
      for (const key of Object.keys(topPixels)) {
        const [x, y] = key.split(",").map(Number);
        const fireH = 3 + Math.round(Math.sin(x * 2.3 + time * 5) * 2 + Math.cos(x * 1.7 + time * 3) * 2);
        for (let f = 1; f <= fireH; f++) {
          const flicker = Math.sin(time * 8 + x * 3 + f * 2) * 0.5 + 0.5;
          const ox = Math.round(Math.sin(time * 4 + f + x) * 1.5);
          const intensity = 1 - f / fireH;
          const fr = 255, fg = Math.round(60 + intensity * 180 * flicker), fb = Math.round(intensity * 30);
          const fk = `${x + ox},${y - f}`;
          if (!grid[fk]) out[fk] = rgbToHex(fr, fg, fb);
        }
      }
      // tint base orange
      for (const [key, color] of entries) {
        const [r, g, b] = hexToRgb(color);
        out[key] = rgbToHex(Math.min(255, r + 40), g, Math.max(0, b - 30));
      }
      break;
    }
    case "frost": {
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        // cool tint
        const cr = Math.max(0, r - 40), cg = Math.min(255, g + 10), cb = Math.min(255, b + 60);
        out[key] = rgbToHex(cr, cg, cb);
      }
      // ice crystals around edges
      const edgePixels = {};
      for (const [key] of entries) {
        const [x, y] = key.split(",").map(Number);
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[1,-1],[-1,1]]) {
          const nk = `${x+dx},${y+dy}`;
          if (!grid[nk] && !edgePixels[nk]) edgePixels[nk] = [x+dx, y+dy];
        }
      }
      for (const [nk, [ex, ey]] of Object.entries(edgePixels)) {
        const sparkle = Math.sin(ex * 3.1 + ey * 2.7 + time * 4) > 0.3;
        if (sparkle) {
          const bright = Math.sin(time * 6 + ex + ey) * 0.3 + 0.7;
          out[nk] = rgbToHex(160 * bright, 220 * bright, 255 * bright);
        }
      }
      break;
    }
    case "shiny": {
      const sparklePhase = time * 3;
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        // traveling highlight wave
        const wave = Math.sin(x * 0.5 + y * 0.3 - sparklePhase) * 0.5 + 0.5;
        const boost = wave > 0.75 ? (wave - 0.75) * 4 * 120 : 0;
        out[key] = rgbToHex(r + boost, g + boost, b + boost * 0.5);
      }
      // sparkle particles
      for (let i = 0; i < 8; i++) {
        const sx = Math.round(Math.sin(time * 2 + i * 47.3) * 15);
        const sy = Math.round(Math.cos(time * 2.5 + i * 31.7) * 15);
        const sk = `${sx},${sy}`;
        if (grid[sk]) {
          out[sk] = "#ffffff";
          // cross sparkle
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const ck = `${sx+dx},${sy+dy}`;
            if (out[ck]) out[ck] = "#ffe080";
          }
        }
      }
      break;
    }
    case "starry": {
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        // darken base, add cosmic tint
        const dr = r * 0.5 + 20, dg = g * 0.4 + 10, db = b * 0.5 + 60;
        // internal stars
        const star = _sr(x * 7, y * 7, genes.seed + Math.floor(time * 0.5)) > 0.92;
        if (star) {
          const twinkle = Math.sin(time * 5 + x * 11 + y * 7) * 0.4 + 0.6;
          out[key] = rgbToHex(200 + twinkle * 55, 200 + twinkle * 55, 255);
        } else {
          out[key] = rgbToHex(dr, dg, db);
        }
      }
      // constellation lines (subtle)
      const edgePixels = [];
      for (const [key] of entries) {
        const [x, y] = key.split(",").map(Number);
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
          if (!grid[`${x+dx},${y+dy}`]) { edgePixels.push([x,y]); break; }
        }
      }
      break;
    }
    case "toxic": {
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        // green toxic shift
        const pulse = Math.sin(time * 2 + Math.sqrt(x*x+y*y) * 0.3) * 0.3 + 0.7;
        const tr = r * 0.4, tg = Math.min(255, g * 0.6 + 120 * pulse), tb = b * 0.3;
        out[key] = rgbToHex(tr, tg, tb);
      }
      // dripping particles below
      const bottomPixels = {};
      for (const [key] of entries) {
        const [x, y] = key.split(",").map(Number);
        if (!grid[`${x},${y + 1}`]) bottomPixels[key] = [x, y];
      }
      for (const [, [bx, by]] of Object.entries(bottomPixels)) {
        if (_sr(bx, by, genes.seed) > 0.7) {
          const dripLen = Math.round(2 + Math.sin(time * 3 + bx * 2) * 2);
          for (let d = 1; d <= dripLen; d++) {
            const alpha = 1 - d / (dripLen + 1);
            out[`${bx},${by + d}`] = rgbToHex(30 * alpha, 255 * alpha, 30 * alpha);
          }
        }
      }
      break;
    }
    case "phantom": {
      const phase = Math.sin(time * 1.5) * 0.3 + 0.5; // 0.2 to 0.8
      for (const [key, color] of entries) {
        const [x, y] = key.split(",").map(Number);
        const [r, g, b] = hexToRgb(color);
        // ghostly: desaturate + phase transparency simulation
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const wave = Math.sin(y * 0.3 + time * 2) * 0.15;
        const vis = phase + wave;
        // simulate transparency by darkening toward background
        const bgR = 6, bgG = 14, bgB = 18; // #060e12
        const pr = lerp(bgR, lerp(lum, r, 0.3) + 40, vis);
        const pg = lerp(bgG, lerp(lum, g, 0.3) + 20, vis);
        const pb = lerp(bgB, lerp(lum, b, 0.5) + 60, vis);
        // horizontal drift
        const drift = Math.round(Math.sin(time * 0.8 + y * 0.1) * 2);
        out[`${x + drift},${y}`] = rgbToHex(pr, pg, pb);
      }
      // ghostly wisps
      for (let i = 0; i < 5; i++) {
        const wx = Math.round(Math.sin(time + i * 13) * 10);
        const wy = Math.round(Math.cos(time * 0.7 + i * 7) * 10);
        if (out[`${wx},${wy}`]) out[`${wx},${wy}`] = rgbToHex(180, 160, 220);
      }
      break;
    }
  }
  return out;
}

// === MAIN RENDER ===
function renderCreature(ctx, genes, cx, cy, ps, time) {
  const grid = {};
  const render = { stellarid: renderStellaris, blobid: renderBlobid, corallid: renderCorallid, nucleid: renderNucleid };
  (render[genes.type] || renderStellaris)(grid, genes, time);

  // Apply rare shader
  const processed = applyRareEffect(grid, genes, time);

  // Glow (base + rare glow boost)
  const glow = tv(genes.glow, "glow");
  const rareGlow = genes.rare !== "none" ? 0.3 : 0;
  if (glow > 0.5 || rareGlow > 0) {
    const pal = PALETTES[genes.palette1];
    const rareInfo = RARE_EFFECTS.find(e => e.id === genes.rare);
    const glowColor = genes.rare !== "none" ? rareInfo.color : pal.accent;
    ctx.save();
    ctx.globalAlpha = Math.max(0.1, (glow > 0.5 ? 0.15 : 0) + rareGlow * 0.12 + Math.sin(time * 3) * 0.06);
    ctx.shadowBlur = 18;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(cx, cy, 22 * ps * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const [key, color] of Object.entries(processed)) {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = color;
    ctx.fillRect(cx + x * ps, cy + y * ps, ps, ps);
  }
}

// === NAME GENERATOR ===
function generateName(genes) {
  const pref = { stellarid: ["Stell", "Astr", "Radi", "Pent"], blobid: ["Blob", "Gel", "Medu", "Cnid"], corallid: ["Coral", "Frag", "Dend", "Rami"], nucleid: ["Nucl", "Radi", "Poly", "Xen"] };
  const mids = ["aria", "oxa", "ium", "ula", "yx", "ona", "ida", "ema"];
  const arms = Math.round(tv(genes.arms, "arms"));
  const suf = [arms <= 4 ? "minor" : arms >= 7 ? "magna" : "vulgaris", genes.glow > 0.5 ? "lux" : "", genes.spikes > 0.5 ? "spinosa" : ""].filter(Boolean);
  const p = pref[genes.type] || pref.stellarid;
  return `${p[Math.floor(genes.seed % p.length)]}${mids[Math.floor((genes.seed * 3) % mids.length)]} ${suf[0]}`;
}

// === UI ===
function TraitBar({ label, value, max, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 72, color: "#8ba0a8", textAlign: "right", fontSize: 8, fontFamily: "'Press Start 2P', monospace" }}>{label}</span>
      <div style={{ width: 80, height: 7, background: "#1a2a30", border: "1px solid #2a3a40" }}>
        <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function CreatureCard({ genes, selected, onClick, size = 130 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(Math.random() * 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ps = size < 100 ? 2 : 3;
    const draw = () => {
      timeRef.current += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderCreature(ctx, genes, canvas.width / 2, canvas.height / 2, ps, timeRef.current);
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [genes, size]);

  const pal = PALETTES[genes.palette1];
  const rareInfo = RARE_EFFECTS.find(e => e.id === genes.rare);
  const isRare = genes.rare !== "none";

  return (
    <div onClick={onClick} style={{
      background: selected ? "#1a2830" : "#0d1a20",
      border: `2px solid ${selected ? pal.accent : isRare ? rareInfo.color + "60" : "#1a2a30"}`,
      borderRadius: 2, padding: 8, cursor: "pointer",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      transition: "border-color 0.15s", minWidth: size + 16,
      boxShadow: isRare ? `0 0 12px ${rareInfo.color}30, inset 0 0 8px ${rareInfo.color}10` : "none",
    }}>
      <canvas ref={canvasRef} width={size} height={size} style={{ imageRendering: "pixelated", background: "#060e12" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 12 }}>{TYPE_ICONS[genes.type]}</span>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: pal.accent, textAlign: "center" }}>
          {generateName(genes)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: "#3a5a60" }}>{TYPE_LABELS[genes.type]}</span>
        {isRare && (
          <span style={{
            fontFamily: "'Press Start 2P', monospace", fontSize: 6,
            color: rareInfo.color, background: rareInfo.color + "20",
            padding: "1px 4px", borderRadius: 1,
          }}>
            {rareInfo.icon} {rareInfo.label.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, disabled, color = "#8ba0a8", bg = "#1a2a30", border = "#2a3a40" }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: "'Press Start 2P', monospace", fontSize: 9, padding: "8px 16px",
      background: disabled ? "#0d1418" : bg, color: disabled ? "#2a3a40" : color,
      border: `2px solid ${disabled ? "#1a2228" : border}`, cursor: disabled ? "default" : "pointer", borderRadius: 2,
    }}>{children}</button>
  );
}

export default function TidePoolBreeder() {
  const [creatures, setCreatures] = useState(() => [
    randomOfType("stellarid"), randomOfType("blobid"),
    randomOfType("corallid"), randomOfType("nucleid"),
    randomGene(), randomGene(), randomGene(), randomGene(),
  ]);
  const [selected, setSelected] = useState([]);
  const [filterType, setFilterType] = useState(null);

  const handleSelect = (idx) => setSelected(prev => {
    if (prev.includes(idx)) return prev.filter(i => i !== idx);
    if (prev.length >= 2) return [prev[1], idx];
    return [...prev, idx];
  });

  const handleBreed = () => {
    if (selected.length !== 2) return;
    const child = breedGenes(creatures[selected[0]], creatures[selected[1]]);
    setCreatures(prev => [...prev, child]);
    setSelected([]);
  };

  const filtered = filterType ? creatures.map((c, i) => c.type === filterType ? i : -1).filter(i => i >= 0) : creatures.map((_, i) => i);
  const selGenes = selected.length > 0 ? creatures[selected[selected.length - 1]] : null;
  const canBreed = selected.length === 2;
  const p1 = canBreed ? creatures[selected[0]] : null;
  const p2 = canBreed ? creatures[selected[1]] : null;
  const crossType = canBreed && p1.type !== p2.type;

  const rareCount = creatures.filter(c => c.rare !== "none").length;

  return (
    <div style={{
      minHeight: "100vh", background: "#060e12", color: "#c0d8e0",
      fontFamily: "'Press Start 2P', monospace", padding: 16,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />

      <div style={{ textAlign: "center", padding: "10px 0" }}>
        <h1 style={{ fontSize: 16, color: "#40c8c8", margin: 0, letterSpacing: 2 }}>TIDE POOL</h1>
        <div style={{ fontSize: 7, color: "#3a6068", marginTop: 4 }}>
          {creatures.length} SPECIMENS · {rareCount} RARE
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
        <Btn onClick={() => setFilterType(null)} color={!filterType ? "#40c8c8" : "#5a7078"} border={!filterType ? "#40c8c8" : "#2a3a40"}>ALL</Btn>
        {TYPES.map(t => (
          <Btn key={t} onClick={() => setFilterType(t)} color={filterType === t ? "#40c8c8" : "#5a7078"} border={filterType === t ? "#40c8c8" : "#2a3a40"}>
            {TYPE_ICONS[t]} {TYPE_LABELS[t].toUpperCase()}
          </Btn>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {filtered.map(idx => (
          <CreatureCard key={idx} genes={creatures[idx]} selected={selected.includes(idx)} onClick={() => handleSelect(idx)} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Btn onClick={handleBreed} disabled={!canBreed} color={canBreed ? "#060e12" : undefined} bg={canBreed ? "#40c8c8" : undefined} border={canBreed ? "#60e8e8" : undefined}>♥ BREED</Btn>
        <Btn onClick={() => setCreatures(p => [...p, randomGene()])}>+ RANDOM</Btn>
        <Btn onClick={() => { setCreatures([randomOfType("stellarid"), randomOfType("blobid"), randomOfType("corallid"), randomOfType("nucleid"), randomGene(), randomGene()]); setSelected([]); }} color="#804040">✕ RESET</Btn>
        {crossType && <span style={{ fontSize: 7, color: "#c8a040" }}>⚠ CROSS-TYPE: {TYPE_LABELS[p1.type]} × {TYPE_LABELS[p2.type]}</span>}
      </div>

      {selGenes && (() => {
        const rareInfo = RARE_EFFECTS.find(e => e.id === selGenes.rare);
        const isRare = selGenes.rare !== "none";
        return (
          <div style={{
            background: "#0a1418", border: `2px solid ${isRare ? rareInfo.color + "40" : "#1a2a30"}`, borderRadius: 2,
            padding: 14, maxWidth: 400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 5,
          }}>
            <div style={{ fontSize: 9, color: PALETTES[selGenes.palette1].accent }}>
              {TYPE_ICONS[selGenes.type]} {generateName(selGenes).toUpperCase()} — {TYPE_LABELS[selGenes.type]}
            </div>
            {isRare && (
              <div style={{ fontSize: 8, color: rareInfo.color, background: rareInfo.color + "15", padding: "3px 6px", borderRadius: 2, display: "inline-block", alignSelf: "flex-start" }}>
                {rareInfo.icon} RARE: {rareInfo.label.toUpperCase()}
              </div>
            )}
            <TraitBar label="ARMS" value={Math.round(tv(selGenes.arms, "arms"))} max={8} color="#40c8c8" />
            <TraitBar label="SIZE" value={Math.round(tv(selGenes.size, "size"))} max={18} color="#40c880" />
            <TraitBar label="FAT" value={(tv(selGenes.fatness, "fatness") * 10).toFixed(0)} max={10} color="#c8a040" />
            <TraitBar label="SPIKES" value={Math.round(tv(selGenes.spikes, "spikes"))} max={3} color="#c84040" />
            <TraitBar label="PATTERN" value={Math.round(tv(selGenes.pattern, "pattern"))} max={4} color="#a040c8" />
            <TraitBar label="GLOW" value={(tv(selGenes.glow, "glow") * 10).toFixed(0)} max={10} color="#c8c840" />
            <TraitBar label="EYES" value={Math.round(tv(selGenes.eyes, "eyes"))} max={3} color="#ffffff" />
            <TraitBar label="WOBBLE" value={Math.round(tv(selGenes.wobble, "wobble"))} max={3} color="#4080c8" />
            {selGenes.type === "blobid" && <TraitBar label="TENTACLES" value={Math.round(tv(selGenes.tentacles, "tentacles"))} max={8} color="#c06080" />}
            {selGenes.type === "corallid" && <TraitBar label="BRANCHES" value={Math.round(tv(selGenes.branches, "branches"))} max={5} color="#60c060" />}
            {selGenes.type === "corallid" && <TraitBar label="DENSITY" value={(tv(selGenes.density, "density") * 10).toFixed(0)} max={10} color="#80a040" />}
            {selGenes.type === "nucleid" && <TraitBar label="FACETS" value={Math.round(tv(selGenes.facets, "facets"))} max={10} color="#6080c0" />}
            {selGenes.type === "nucleid" && <TraitBar label="RINGS" value={Math.round(tv(selGenes.rings, "rings"))} max={4} color="#a060c0" />}
            <div style={{ fontSize: 7, color: "#3a5058", marginTop: 2 }}>
              PALETTE: {PALETTES[selGenes.palette1].name} / {PALETTES[selGenes.palette2].name}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
