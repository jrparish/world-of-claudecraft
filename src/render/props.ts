import * as THREE from 'three';
import { terrainHeight } from '../sim/world';
import { roofTexture, wallTexture, stoneTexture } from './textures';

// Static world props: buildings, tents, campfires, mine, ruins, dock, fences.

export interface PropsResult {
  group: THREE.Group;
  flames: THREE.Mesh[]; // animated campfire flames
  fireLights: THREE.PointLight[];
}

export function buildProps(seed: number): PropsResult {
  const group = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  const fireLights: THREE.PointLight[] = [];

  const roofTex = roofTexture();
  const wallTex = wallTexture();
  const stoneTex = stoneTexture();
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex });
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const woodDarkMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  const canvasMat = new THREE.MeshLambertMaterial({ color: 0xc9b48a, side: THREE.DoubleSide });

  const ground = (x: number, z: number) => terrainHeight(x, z, seed);

  function shadowed<T extends THREE.Object3D>(o: T): T {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        (c as THREE.Mesh).castShadow = true;
        (c as THREE.Mesh).receiveShadow = true;
      }
    });
    return o;
  }

  // ---- houses ----
  function house(x: number, z: number, w: number, d: number, rot: number, tall = false): void {
    const g = new THREE.Group();
    const hWall = tall ? 4.2 : 3.2;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, hWall, d), wallMat);
    walls.position.y = hWall / 2;
    g.add(walls);
    // gabled roof: stretched cone with 4 sides looks tent-like; use prism via cylinder 3-sided? Use box rotated 45° trick:
    const roofH = 2.2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.8, roofH, 4), roofMat);
    roof.position.y = hWall + roofH / 2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.16), woodDarkMat);
    door.position.set(0, 1, d / 2 + 0.06);
    g.add(door);
    // windows
    for (const sx of [-w / 3, w / 3]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), new THREE.MeshLambertMaterial({
        color: 0x35506b, emissive: 0x1a2c40, emissiveIntensity: 0.7,
      }));
      win.position.set(sx, 1.9, d / 2 + 0.06);
      g.add(win);
    }
    // chimney
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.6, hWall + roofH + 0.6, 0.6), stoneMat);
    chim.position.set(w / 3, (hWall + roofH + 0.6) / 2, -d / 4);
    g.add(chim);
    g.position.set(x, ground(x, z), z);
    g.rotation.y = rot;
    group.add(shadowed(g));
  }

  house(10, 12, 7, 6, -0.4);
  house(-10, 10, 6, 5, 0.5);
  house(12, -6, 6, 7, 2.4, true); // inn
  // chapel near graveyard
  (function chapel() {
    const g = new THREE.Group();
    const nave = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 7), wallMat);
    nave.position.y = 2;
    g.add(nave);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.6, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.3;
    g.add(roof);
    const steeple = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3, 1.4), wallMat);
    steeple.position.set(0, 5.5, 2.2);
    g.add(steeple);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 4), roofMat);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(0, 7.9, 2.2);
    g.add(spire);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.16), woodDarkMat);
    door.position.set(0, 1.1, 3.55);
    g.add(door);
    g.position.set(-16, ground(-16, -8), -8);
    g.rotation.y = 0.9;
    group.add(shadowed(g));
  })();

  // ---- market stall for Wilkes ----
  (function stall() {
    const g = new THREE.Group();
    for (const [sx, sz] of [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 0.14), woodMat);
      post.position.set(sx, 1.2, sz);
      g.add(post);
    }
    const counter = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 1.4), woodMat);
    counter.position.y = 0.45;
    g.add(counter);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 2.2), new THREE.MeshLambertMaterial({ color: 0x1e8449 }));
    awning.position.y = 2.45;
    awning.rotation.x = 0.12;
    g.add(awning);
    // goods
    const bread = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshLambertMaterial({ color: 0xc8954a }));
    bread.scale.set(1.4, 0.8, 0.9);
    bread.position.set(-0.6, 1.0, 0);
    g.add(bread);
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.4, 8), new THREE.MeshLambertMaterial({ color: 0x7a9cc6 }));
    jug.position.set(0.5, 1.1, 0.2);
    g.add(jug);
    g.position.set(-8.5, ground(-8.5, 3), 3);
    g.rotation.y = Math.PI / 2;
    group.add(shadowed(g));
  })();

  // ---- well ----
  (function well() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1, 10), stoneMat);
    ring.position.y = 0.5;
    g.add(ring);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), woodMat);
      post.position.set(sx * 1.0, 1.6, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12), woodMat);
    beam.position.y = 2.4;
    g.add(beam);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.95;
    g.add(roof);
    g.position.set(0, ground(0, 2), 2);
    group.add(shadowed(g));
  })();

  // ---- graveyard ----
  for (let i = 0; i < 6; i++) {
    const gx = -12 + (i % 3) * 2.2 - 2, gz = -14 + Math.floor(i / 3) * 2.6;
    const stone = new THREE.Mesh(
      i % 2 === 0 ? new THREE.BoxGeometry(0.8, 1.2, 0.22) : new THREE.CylinderGeometry(0.45, 0.45, 1.1, 8, 1, false, 0, Math.PI),
      stoneMat,
    );
    stone.position.set(gx, ground(gx, gz) + 0.55, gz);
    stone.rotation.y = i * 0.4;
    group.add(shadowed(stone));
  }

  // ---- town fences & lamp posts ----
  function fenceRun(x1: number, z1: number, x2: number, z2: number): void {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.floor(len / 2.4);
    for (let i = 0; i <= n; i++) {
      const t = i / Math.max(1, n);
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.15), woodMat);
      post.position.set(x, ground(x, z) + 0.55, z);
      group.add(shadowed(post));
      if (i < n) {
        const nx = x1 + (x2 - x1) * ((i + 0.5) / n), nz = z1 + (z2 - z1) * ((i + 0.5) / n);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.4), woodMat);
        rail.position.set(nx, ground(nx, nz) + 0.85, nz);
        rail.lookAt(x2, rail.position.y, z2);
        group.add(shadowed(rail));
        const rail2 = rail.clone();
        rail2.position.y -= 0.4;
        group.add(rail2);
      }
    }
  }
  fenceRun(16, 16, 22, 4);
  fenceRun(-16, 14, -20, 2);

  // ---- campfires (town + bandit camp + mine camp + lake hut) ----
  function campfire(x: number, z: number): void {
    const g = new THREE.Group();
    const y = ground(x, z);
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 5), woodDarkMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 5) * Math.PI;
      log.position.y = 0.1;
      g.add(log);
    }
    const stoneRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 5, 9), stoneMat);
    stoneRing.rotation.x = Math.PI / 2;
    stoneRing.position.y = 0.08;
    g.add(stoneRing);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 6), new THREE.MeshLambertMaterial({
      color: 0xffaa33, emissive: 0xff6600, emissiveIntensity: 1.4, transparent: true, opacity: 0.92,
    }));
    flame.position.y = 0.55;
    g.add(flame);
    flames.push(flame);
    const light = new THREE.PointLight(0xff8830, 12, 16, 2);
    light.position.y = 1.2;
    g.add(light);
    fireLights.push(light);
    g.position.set(x, y, z);
    group.add(g);
  }
  campfire(3, -4); // town square
  campfire(65, -65);
  campfire(90, -90);
  campfire(-80, -60);
  campfire(-61, 56);

  // ---- bandit tents ----
  function tent(x: number, z: number, rot: number, scale = 1): void {
    const g = new THREE.Group();
    const tentGeo = new THREE.ConeGeometry(1.8 * scale, 2.2 * scale, 4);
    const t = new THREE.Mesh(tentGeo, canvasMat);
    t.rotation.y = Math.PI / 4;
    t.position.y = 1.1 * scale;
    g.add(t);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6 * scale, 0.08), woodMat);
    pole.position.y = 1.3 * scale;
    g.add(pole);
    g.position.set(x, ground(x, z), z);
    g.rotation.y = rot;
    group.add(shadowed(g));
  }
  tent(62, -61, 0.4);
  tent(69, -69, 2.1);
  tent(88, -86, 1.2, 1.3);
  tent(95, -94, -0.6);

  // crates & barrels at the bandit camp
  for (const [x, z] of [[60, -63], [66, -67], [87, -88], [93, -90], [70, -72]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), woodMat);
    crate.position.set(x, ground(x, z) + 0.45, z);
    crate.rotation.y = (x * 13 + z * 7) % 1;
    group.add(shadowed(crate));
  }

  // ---- mine entrance ----
  (function mine() {
    const g = new THREE.Group();
    const x = -88, z = -68;
    // timber portal
    for (const sx of [-1.4, 1.4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), woodMat);
      post.position.set(sx, 1.7, 0);
      g.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.55, 0.6), woodMat);
    lintel.position.y = 3.3;
    g.add(lintel);
    // dark hole
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3), new THREE.MeshBasicMaterial({ color: 0x050505 }));
    hole.position.set(0, 1.5, -0.2);
    g.add(hole);
    // mound above
    const mound = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 6), stoneMat);
    mound.scale.set(1.4, 0.7, 1);
    mound.position.set(0, 1.6, -3.4);
    g.add(mound);
    // cart and ore pile
    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), woodDarkMat);
    cart.position.set(2.8, 0.55, 1.6);
    g.add(cart);
    const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xb87333 }));
    ore.position.set(2.8, 1.05, 1.6);
    g.add(ore);
    g.position.set(x, ground(x, z), z);
    g.rotation.y = 0.8;
    group.add(shadowed(g));
  })();

  // ---- ruins (northeast) ----
  (function ruins() {
    const cx = 80, cz = 78;
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const x = cx + Math.sin(ang) * 7, z = cz + Math.cos(ang) * 7;
      const h = i % 3 === 0 ? 1.2 : 2.6 + (i % 2) * 1.2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, h, 7), stoneMat);
      col.position.set(x, ground(x, z) + h / 2, z);
      col.rotation.z = (i % 3 === 0 ? 0.5 : 0.04) * (i % 2 ? 1 : -1);
      group.add(shadowed(col));
    }
    // fallen column
    const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.4, 7), stoneMat);
    fallen.rotation.z = Math.PI / 2;
    fallen.rotation.y = 0.6;
    fallen.position.set(cx - 2, ground(cx - 2, cz - 3) + 0.5, cz - 3);
    group.add(shadowed(fallen));
    // broken arch
    const arch1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.6, 0.8), stoneMat);
    arch1.position.set(cx, ground(cx, cz + 8) + 1.8, cz + 8);
    group.add(shadowed(arch1));
    const arch2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 0.8), stoneMat);
    arch2.position.set(cx + 1, ground(cx, cz + 8) + 3.6, cz + 8);
    arch2.rotation.z = -0.18;
    group.add(shadowed(arch2));
  })();

  // ---- fishing dock + hut at the lake ----
  (function dock() {
    const x = -64, z = 60;
    const y = ground(x, z);
    const g = new THREE.Group();
    const planks = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 7), woodMat);
    planks.position.set(0, 0.4, -3);
    g.add(planks);
    for (const [px, pz] of [[-0.7, -1], [0.7, -1], [-0.7, -4.5], [0.7, -4.5]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.16), woodDarkMat);
      post.position.set(px, -0.2, pz);
      g.add(post);
    }
    // hut
    const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3), wallMat);
    hut.position.set(2.8, 1.2, 2.4);
    g.add(hut);
    const hutRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), roofMat);
    hutRoof.rotation.y = Math.PI / 4;
    hutRoof.position.set(2.8, 3.2, 2.4);
    g.add(hutRoof);
    // barrels
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 8), woodDarkMat);
    barrel.position.set(1, 0.4, 0.5);
    g.add(barrel);
    g.position.set(x, y, z);
    g.rotation.y = -2.2;
    group.add(shadowed(g));
  })();

  // ---- murloc mud huts ----
  for (const [x, z] of [[-76, 72], [-82, 64], [-72, 64]]) {
    const hut = new THREE.Mesh(new THREE.SphereGeometry(1.2, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x6e7f4e, flatShading: true }));
    hut.position.set(x, ground(x, z), z);
    group.add(shadowed(hut));
  }

  return { group, flames, fireLights };
}
