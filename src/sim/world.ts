import { fbm2, hash2 } from './rng';
import { CAMPS, DUNGEON_FLOOR_Y, DUNGEON_X_THRESHOLD, LAKE, ROADS, TOWN_RADIUS, WORLD_SIZE } from './data';

// Terrain is a pure function of (x, z, seed): both the sim (ground clamping)
// and the renderer (mesh) sample the same heightfield, so they always agree.

const HILL_SCALE = 0.013;
const DETAIL_SCALE = 0.05;

export const WATER_LEVEL = -4.5;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function baseHeight(x: number, z: number, seed: number): number {
  let h = (fbm2(x * HILL_SCALE + 100, z * HILL_SCALE + 100, seed, 4) - 0.5) * 26;
  h += (fbm2(x * DETAIL_SCALE, z * DETAIL_SCALE, seed + 7, 2) - 0.5) * 2.2;
  // Flatten the town plateau
  const dTown = Math.sqrt(x * x + z * z);
  const townBlend = smoothstep(TOWN_RADIUS * 0.7, TOWN_RADIUS * 1.6, dTown);
  h = h * townBlend + 1.5 * (1 - townBlend);
  // Keep dry land everywhere: soft-floor low dips above the water level...
  const minLand = WATER_LEVEL + 1.4;
  if (h < minLand) h = minLand - (minLand - h) * 0.12;
  // ...except the carved lake basin
  const dLake = Math.sqrt((x - LAKE.x) ** 2 + (z - LAKE.z) ** 2);
  if (dLake < LAKE.radius * 1.6) {
    const lakeBlend = smoothstep(LAKE.radius * 0.55, LAKE.radius * 1.6, dLake);
    h = h * lakeBlend + (WATER_LEVEL - 4) * (1 - lakeBlend);
  }
  return h;
}

// Ground height including instanced dungeon floors (flat, far off-world).
export function groundHeight(x: number, z: number, seed: number): number {
  if (x > DUNGEON_X_THRESHOLD) return DUNGEON_FLOOR_Y;
  return terrainHeight(x, z, seed);
}

export function terrainHeight(x: number, z: number, seed: number): number {
  let h = baseHeight(x, z, seed);

  // Flatten each camp a little so mobs don't stand on cliffs
  for (const camp of CAMPS) {
    const dx = x - camp.center.x, dz = z - camp.center.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < camp.radius * 1.8) {
      const ch = baseHeight(camp.center.x, camp.center.z, seed);
      const blend = smoothstep(camp.radius * 0.8, camp.radius * 1.8, d);
      h = h * blend + ch * (1 - blend);
    }
  }

  // Raise the world rim so the player naturally stays in bounds
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const rim = smoothstep(WORLD_SIZE / 2 - 30, WORLD_SIZE / 2, edge);
  h += rim * 40;
  return h;
}

// Distance from (x,z) to the nearest road polyline segment.
export function roadDistance(x: number, z: number): number {
  let best = Infinity;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i], b = road[i + 1];
      const abx = b.x - a.x, abz = b.z - a.z;
      const apx = x - a.x, apz = z - a.z;
      const len2 = abx * abx + abz * abz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2)) : 0;
      const dx = apx - abx * t, dz = apz - abz * t;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
  }
  return best;
}

// Deterministic decoration placement (trees, rocks) — used by the renderer,
// kept here so it shares the seed and stays out of mob camps / town / roads / lake.
export interface Decoration {
  kind: 'tree' | 'tree2' | 'rock';
  x: number;
  z: number;
  scale: number;
  variant: number;
}

export function generateDecorations(seed: number): Decoration[] {
  const out: Decoration[] = [];
  const step = 10;
  const half = WORLD_SIZE / 2 - 14;
  for (let gx = -half; gx < half; gx += step) {
    for (let gz = -half; gz < half; gz += step) {
      const r = hash2(Math.round(gx), Math.round(gz), seed + 31);
      if (r > 0.48) continue;
      const ox = (hash2(Math.round(gx), Math.round(gz), seed + 57) - 0.5) * step;
      const oz = (hash2(Math.round(gx), Math.round(gz), seed + 91) - 0.5) * step;
      const x = gx + ox, z = gz + oz;
      if (Math.sqrt(x * x + z * z) < TOWN_RADIUS + 4) continue;
      if (terrainHeight(x, z, seed) < WATER_LEVEL + 1) continue;
      if (roadDistance(x, z) < 5) continue;
      let inCamp = false;
      for (const c of CAMPS) {
        const dx = x - c.center.x, dz = z - c.center.z;
        if (Math.sqrt(dx * dx + dz * dz) < c.radius + 3) { inCamp = true; break; }
      }
      if (inCamp) continue;
      const kind = r < 0.30 ? 'tree' : r < 0.40 ? 'tree2' : 'rock';
      out.push({
        kind,
        x, z,
        scale: 0.7 + hash2(Math.round(gx), Math.round(gz), seed + 13) * 0.9,
        variant: Math.floor(hash2(Math.round(gx), Math.round(gz), seed + 77) * 3),
      });
    }
  }
  return out;
}
