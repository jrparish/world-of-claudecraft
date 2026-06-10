import * as THREE from 'three';
import { Entity } from '../sim/types';
import type { IWorld } from '../world_api';
import { terrainHeight, groundHeight, generateDecorations, roadDistance, WATER_LEVEL } from '../sim/world';
import { WORLD_SIZE, TOWN_RADIUS, MOBS, DUNGEON_X_THRESHOLD, instanceOrigin, INSTANCE_SLOT_COUNT } from '../sim/data';
import { buildBear, buildRigFor, buildSheep, Rig } from './models';
import { buildProps } from './props';
import {
  barkTexture, cloudTexture, foliageTexture, grassTuftTexture, groundDetailTexture,
  skyTexture, sparkleTexture, waterNormalish,
} from './textures';

const NAMEPLATE_RANGE = 55;

interface EntityView {
  group: THREE.Group;
  rig: Rig;
  sheepRig: Rig | null; // polymorph form, built lazily
  bearRig: Rig | null; // druid bear form, built lazily
  walkPhase: number;
  attackAnim: number;
  nameplate: HTMLDivElement;
  nameEl: HTMLDivElement;
  hpBar: HTMLDivElement;
  hpFill: HTMLDivElement;
  markerEl: HTMLDivElement;
  sparkle?: THREE.Sprite; // ground objects
  objectMesh?: THREE.Object3D;
}

export class Renderer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  webgl: THREE.WebGLRenderer;
  views = new Map<number, EntityView>();
  nameplateLayer: HTMLDivElement;
  selectionRing: THREE.Mesh;
  raycaster = new THREE.Raycaster();
  clickTargets: THREE.Object3D[] = [];
  camYaw = Math.PI;
  camPitch = 0.32;
  camDist = 12;
  showNameplates = true;
  private tmpV = new THREE.Vector3();
  private sun: THREE.DirectionalLight;
  private clouds: THREE.Sprite[] = [];
  private water: THREE.Mesh;
  private waterTex: THREE.Texture;
  private flames: THREE.Mesh[];
  private fireLights: THREE.PointLight[];
  private time = 0;

  constructor(private sim: IWorld, canvas: HTMLCanvasElement, nameplateLayer: HTMLDivElement) {
    this.nameplateLayer = nameplateLayer;
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.webgl.setSize(window.innerWidth, window.innerHeight);
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 700);

    this.scene.fog = new THREE.Fog(0xa6c6e0, 110, 360);

    // sky dome
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(520, 16, 12),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    sky.renderOrder = -10;
    this.scene.add(sky);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x46603a, 0.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0cd, 1.6);
    sun.position.set(90, 140, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 30;
    sun.shadow.camera.far = 400;
    const S = 55;
    sun.shadow.camera.left = -S;
    sun.shadow.camera.right = S;
    sun.shadow.camera.top = S;
    sun.shadow.camera.bottom = -S;
    sun.shadow.bias = -0.0008;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    // clouds
    const cloudTex = cloudTexture();
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
      const cl = new THREE.Sprite(mat);
      const sc = 60 + Math.random() * 90;
      cl.scale.set(sc, sc * 0.45, 1);
      cl.position.set((Math.random() - 0.5) * 600, 95 + Math.random() * 55, (Math.random() - 0.5) * 600);
      this.clouds.push(cl);
      this.scene.add(cl);
    }

    this.buildTerrain();
    // water
    this.waterTex = waterNormalish();
    this.waterTex.repeat.set(30, 30);
    const waterMat = new THREE.MeshPhongMaterial({
      color: 0x2a6a96, transparent: true, opacity: 0.78, shininess: 90,
      specular: 0xbbddff, map: this.waterTex,
    });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE).rotateX(-Math.PI / 2), waterMat);
    this.water.position.y = WATER_LEVEL;
    this.scene.add(this.water);

    this.buildDecorations();
    this.buildGrass();
    const props = buildProps(this.sim.cfg.seed);
    this.scene.add(props.group);
    this.flames = props.flames;
    this.fireLights = props.fireLights;

    // selection ring
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.selectionRing = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    this.selectionRing.visible = false;
    this.scene.add(this.selectionRing);

    for (const e of sim.entities.values()) this.createView(e);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.webgl.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // -------------------------------------------------------------------------
  // World building
  // -------------------------------------------------------------------------

  private buildTerrain(): void {
    const seg = 240;
    const size = WORLD_SIZE;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x55913f);
    const grassDark = new THREE.Color(0x3f7230);
    const grassYellow = new THREE.Color(0x7a9a3d);
    const dirt = new THREE.Color(0x8a6f47);
    const dirtDark = new THREE.Color(0x73592f);
    const rock = new THREE.Color(0x7a7a72);
    const sand = new THREE.Color(0xc2b283);
    const c = new THREE.Color();
    const seed = this.sim.cfg.seed;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z, seed);
      pos.setY(i, h);
      const eps = 1.5;
      const hx = terrainHeight(x + eps, z, seed) - terrainHeight(x - eps, z, seed);
      const hz = terrainHeight(x, z + eps, seed) - terrainHeight(x, z - eps, seed);
      const slope = Math.sqrt(hx * hx + hz * hz) / (2 * eps);
      const dTown = Math.sqrt(x * x + z * z);
      // base grass with patchy variation
      const v = (Math.sin(x * 0.21) * Math.cos(z * 0.17) + 1) / 2;
      c.copy(grass).lerp(grassDark, v);
      const v2 = (Math.sin(x * 0.043 + 5) * Math.cos(z * 0.05 + 2) + 1) / 2;
      c.lerp(grassYellow, v2 * 0.35);
      if (h < WATER_LEVEL + 1.6) c.copy(sand);
      if (dTown < 14) c.lerp(dirtDark, 0.7);
      const rd = roadDistance(x, z);
      if (rd < 2.0) c.lerp(dirt, 0.85);
      else if (rd < 3.4) c.lerp(dirt, 0.85 * (1 - (rd - 2.0) / 1.4));
      if (slope > 0.55) c.lerp(rock, Math.min(1, (slope - 0.55) * 2));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const detail = groundDetailTexture();
    detail.repeat.set(160, 160);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: detail });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private buildDecorations(): void {
    const decos = generateDecorations(this.sim.cfg.seed);
    const pines = decos.filter((d) => d.kind === 'tree');
    const oaks = decos.filter((d) => d.kind === 'tree2');
    const rocks = decos.filter((d) => d.kind === 'rock');
    const seed = this.sim.cfg.seed;

    const bark = barkTexture();
    const foliage = foliageTexture();
    const trunkMat = new THREE.MeshLambertMaterial({ map: bark });
    const pineMat = new THREE.MeshLambertMaterial({ map: foliage, color: 0xa8c898 });
    const pineMat2 = new THREE.MeshLambertMaterial({ map: foliage, color: 0xc2d8a8 });
    const oakMat = new THREE.MeshLambertMaterial({ map: foliage, color: 0xb8cc8e });

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    // pines: trunk + 3 stacked cones
    const pTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.42, 2.6, 6), trunkMat, pines.length);
    const pC1 = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 3.2, 7), pineMat, pines.length);
    const pC2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.85, 2.7, 7), pineMat2, pines.length);
    const pC3 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.25, 2.2, 7), pineMat, pines.length);
    pines.forEach((t, i) => {
      const y = terrainHeight(t.x, t.z, seed);
      const s = t.scale * 1.5;
      q.setFromAxisAngle(up, t.variant * 2.1);
      const sv = new THREE.Vector3(s, s, s);
      m.compose(new THREE.Vector3(t.x, y + 1.3 * s, t.z), q, sv);
      pTrunk.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, y + 3.6 * s, t.z), q, sv);
      pC1.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, y + 5.3 * s, t.z), q, sv);
      pC2.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, y + 6.8 * s, t.z), q, sv);
      pC3.setMatrixAt(i, m);
    });
    for (const im of [pTrunk, pC1, pC2, pC3]) {
      im.castShadow = true;
      this.scene.add(im);
    }

    // oaks: trunk + blobby foliage
    const oTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.5, 2.8, 6), trunkMat, oaks.length);
    const oFol = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 7, 5), oakMat, oaks.length);
    const oFol2 = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 6, 5), oakMat, oaks.length);
    oaks.forEach((t, i) => {
      const y = terrainHeight(t.x, t.z, seed);
      const s = t.scale * 1.3;
      q.setFromAxisAngle(up, t.variant * 2.1);
      m.compose(new THREE.Vector3(t.x, y + 1.4 * s, t.z), q, new THREE.Vector3(s, s, s));
      oTrunk.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x, y + 3.6 * s, t.z), q, new THREE.Vector3(s, s * 0.8, s));
      oFol.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(t.x + 1.1 * s, y + 2.9 * s, t.z + 0.4 * s), q, new THREE.Vector3(s, s * 0.7, s));
      oFol2.setMatrixAt(i, m);
    });
    for (const im of [oTrunk, oFol, oFol2]) {
      im.castShadow = true;
      this.scene.add(im);
    }

    const rockMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.9, 0),
      new THREE.MeshLambertMaterial({ color: 0x8d8d85, flatShading: true }),
      rocks.length,
    );
    rocks.forEach((r, i) => {
      const y = terrainHeight(r.x, r.z, seed);
      q.setFromAxisAngle(up, r.variant * 1.7);
      m.compose(new THREE.Vector3(r.x, y + 0.3 * r.scale, r.z), q, new THREE.Vector3(r.scale, r.scale * 0.7, r.scale));
      rockMesh.setMatrixAt(i, m);
    });
    rockMesh.castShadow = true;
    this.scene.add(rockMesh);
  }

  private buildGrass(): void {
    const seed = this.sim.cfg.seed;
    const positions: { x: number; z: number; s: number; r: number }[] = [];
    const step = 4.5;
    const half = WORLD_SIZE / 2 - 16;
    let h1 = 0;
    for (let gx = -half; gx < half; gx += step) {
      for (let gz = -half; gz < half; gz += step) {
        h1 = (Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453) % 1;
        const r = Math.abs(h1);
        if (r > 0.5) continue;
        const x = gx + (r - 0.25) * 8;
        const z = gz + ((r * 7) % 1 - 0.5) * 8;
        const h = terrainHeight(x, z, seed);
        if (h < WATER_LEVEL + 1.6) continue;
        if (Math.sqrt(x * x + z * z) < 15) continue;
        if (roadDistance(x, z) < 3.2) continue;
        positions.push({ x, z, s: 0.45 + r * 0.5, r: r * 6 });
      }
    }
    // crossed-quad geometry
    const quad = new THREE.PlaneGeometry(1.1, 0.7);
    quad.translate(0, 0.35, 0);
    const quad2 = quad.clone().rotateY(Math.PI / 2);
    const merged = mergeGeoms([quad, quad2]);
    const mat = new THREE.MeshLambertMaterial({
      map: grassTuftTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    });
    const im = new THREE.InstancedMesh(merged, mat, positions.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    positions.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r);
      m.compose(new THREE.Vector3(p.x, terrainHeight(p.x, p.z, seed), p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      im.setMatrixAt(i, m);
    });
    this.scene.add(im);
  }

  // -------------------------------------------------------------------------
  // Entity views
  // -------------------------------------------------------------------------

  private createView(e: Entity): void {
    const group = new THREE.Group();
    let rig: Rig;
    let sparkle: THREE.Sprite | undefined;
    let objectMesh: THREE.Object3D | undefined;

    if (e.kind === 'object') {
      rig = { body: new THREE.Group(), parts: {}, kind: 'humanoid', height: 1.2 };
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.9, 0.9),
        new THREE.MeshLambertMaterial({ color: 0x8a6537 }),
      );
      crate.position.y = 0.45;
      crate.castShadow = true;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.96), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }));
      lid.position.y = 0.92;
      rig.body.add(crate, lid);
      objectMesh = rig.body;
      const sMat = new THREE.SpriteMaterial({ map: sparkleTexture(), transparent: true, depthWrite: false });
      sparkle = new THREE.Sprite(sMat);
      sparkle.scale.set(0.9, 0.9, 1);
      sparkle.position.y = 1.35;
      group.add(sparkle);
    } else {
      rig = buildRigFor(e);
    }
    rig.body.scale.multiplyScalar(e.scale);
    group.add(rig.body);

    group.position.set(e.pos.x, e.pos.y, e.pos.z);
    group.userData.entityId = e.id;
    rig.body.traverse((o) => { o.userData.entityId = e.id; });
    this.scene.add(group);
    this.clickTargets.push(rig.body);

    // nameplate
    const np = document.createElement('div');
    np.className = 'nameplate';
    const marker = document.createElement('div');
    marker.className = 'np-marker';
    const nameEl = document.createElement('div');
    nameEl.className = 'np-name';
    nameEl.textContent = e.name;
    const hpBar = document.createElement('div');
    hpBar.className = 'np-hpbar';
    const hpFill = document.createElement('div');
    hpFill.className = 'np-hpfill';
    hpBar.appendChild(hpFill);
    np.append(marker, nameEl, hpBar);
    this.nameplateLayer.appendChild(np);

    this.views.set(e.id, {
      group, rig, sheepRig: null, bearRig: null, walkPhase: 0, attackAnim: 0,
      nameplate: np, nameEl, hpBar, hpFill, markerEl: marker, sparkle, objectMesh,
    });
  }

  triggerAttack(entityId: number): void {
    const v = this.views.get(entityId);
    if (v) v.attackAnim = 0.35;
  }

  // -------------------------------------------------------------------------
  // Per-frame sync
  // -------------------------------------------------------------------------

  // ---------------------------------------------------------------------
  // The Hollow Crypt interior, built lazily per instance origin.
  // ---------------------------------------------------------------------

  private builtCrypts = new Set<number>();
  private outdoorFog = { color: 0xa6c6e0, near: 110, far: 360 };
  private inDungeonFog = false;

  private buildCrypt(ox: number, oz: number): void {
    const g = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0x6a6a72 });
    const stoneDark = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
    const bone = new THREE.MeshLambertMaterial({ color: 0xd8d4c0, flatShading: true });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 122), stoneDark);
    floor.position.set(0, -0.25, 52);
    floor.receiveShadow = true;
    g.add(floor);
    // walls
    for (const sx of [-23, 23]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 122), stone);
      wall.position.set(sx, 4.5, 52);
      g.add(wall);
    }
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(48, 9, 2), stone);
    backWall.position.set(0, 4.5, 112);
    g.add(backWall);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(48, 9, 2), stone);
    frontWall.position.set(0, 4.5, -9);
    g.add(frontWall);
    // pillars + torches
    for (let z = 10; z <= 100; z += 15) {
      for (const sx of [-14, 14]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 8, 7), stone);
        pillar.position.set(sx, 4, z);
        pillar.castShadow = true;
        g.add(pillar);
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), new THREE.MeshLambertMaterial({
          color: 0x7fd4ff, emissive: 0x2288cc, emissiveIntensity: 1.6, transparent: true, opacity: 0.92,
        }));
        flame.position.set(sx, 8.4, z);
        g.add(flame);
        this.flames.push(flame);
        const light = new THREE.PointLight(0x66bbff, 10, 22, 2);
        light.position.set(sx, 8.2, z);
        g.add(light);
        this.fireLights.push(light);
      }
    }
    // sarcophagi along the walls
    for (let z = 16; z <= 92; z += 19) {
      for (const sx of [-19, 19]) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), stoneDark);
        s.position.set(sx, 0.7, z);
        s.castShadow = true;
        g.add(s);
      }
    }
    // bone piles
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), bone);
      b.position.set(Math.sin(i * 2.4) * 14, 0.3, 12 + i * 9.5);
      b.scale.set(1.2, 0.5, 1);
      g.add(b);
    }
    // boss dais
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1, 12), stone);
    dais.position.set(0, 0.5, 96);
    dais.receiveShadow = true;
    g.add(dais);

    g.position.set(ox, 0, oz);
    this.scene.add(g);
  }

  private updateDungeonAmbience(px: number): void {
    const inside = px > DUNGEON_X_THRESHOLD;
    if (inside) {
      // build the crypt copy the player is standing in
      for (let i = 0; i < INSTANCE_SLOT_COUNT; i++) {
        const o = instanceOrigin(i);
        if (Math.abs(px - o.x) < 200 && !this.builtCrypts.has(i)) {
          const p = this.sim.player;
          if (Math.abs(p.pos.z - o.z) < 250) {
            this.builtCrypts.add(i);
            this.buildCrypt(o.x, o.z);
          }
        }
      }
    }
    if (inside && !this.inDungeonFog) {
      this.inDungeonFog = true;
      (this.scene.fog as THREE.Fog).color.setHex(0x05060a);
      (this.scene.fog as THREE.Fog).near = 18;
      (this.scene.fog as THREE.Fog).far = 90;
    } else if (!inside && this.inDungeonFog) {
      this.inDungeonFog = false;
      (this.scene.fog as THREE.Fog).color.setHex(this.outdoorFog.color);
      (this.scene.fog as THREE.Fog).near = this.outdoorFog.near;
      (this.scene.fog as THREE.Fog).far = this.outdoorFog.far;
    }
  }

  // Drop the view of an entity that left the world / our interest area.
  private removeView(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    this.scene.remove(v.group);
    v.nameplate.remove();
    const idx = this.clickTargets.indexOf(v.rig.body);
    if (idx >= 0) this.clickTargets.splice(idx, 1);
    this.views.delete(id);
  }

  sync(alpha: number, dt: number, renderFacingOverride: number | null): void {
    this.time += dt;
    const sim = this.sim;
    const p = sim.player;

    // dynamic worlds: create views for newcomers, drop views for leavers
    for (const e of sim.entities.values()) {
      if (!this.views.has(e.id)) this.createView(e);
    }
    for (const id of [...this.views.keys()]) {
      if (!sim.entities.has(id)) this.removeView(id);
    }

    for (const e of sim.entities.values()) {
      const v = this.views.get(e.id);
      if (!v) continue;
      const x = e.prevPos.x + (e.pos.x - e.prevPos.x) * alpha;
      const y = e.prevPos.y + (e.pos.y - e.prevPos.y) * alpha;
      const z = e.prevPos.z + (e.pos.z - e.prevPos.z) * alpha;
      v.group.position.set(x, y, z);
      let facing = e.prevFacing + shortestAngle(e.prevFacing, e.facing) * alpha;
      if (e.id === p.id && renderFacingOverride !== null) facing = renderFacingOverride;
      v.group.rotation.y = facing;

      if (e.kind === 'object') {
        const vis = e.lootable;
        v.group.visible = vis;
        if (v.sparkle && vis) {
          const pulse = 0.75 + Math.sin(this.time * 3 + e.id) * 0.25;
          v.sparkle.scale.set(pulse, pulse, 1);
          v.sparkle.material.rotation = this.time * 0.8;
        }
        continue;
      }

      // form swaps: polymorph sheep, druid bear
      const polyed = e.auras.some((a) => a.kind === 'polymorph');
      const bear = !polyed && e.auras.some((a) => a.kind === 'form_bear');
      if (polyed && !v.sheepRig) {
        v.sheepRig = buildSheep();
        v.sheepRig.body.scale.multiplyScalar(e.scale);
        v.group.add(v.sheepRig.body);
      }
      if (bear && !v.bearRig) {
        v.bearRig = buildBear();
        v.bearRig.body.scale.multiplyScalar(e.scale);
        v.group.add(v.bearRig.body);
      }
      if (v.sheepRig) v.sheepRig.body.visible = polyed;
      if (v.bearRig) v.bearRig.body.visible = bear;
      v.rig.body.visible = !polyed && !bear;
      const activeRig = polyed && v.sheepRig ? v.sheepRig : bear && v.bearRig ? v.bearRig : v.rig;
      const parts = activeRig.parts;

      // animation
      const speed = Math.hypot(e.pos.x - e.prevPos.x, e.pos.z - e.prevPos.z) / Math.max(dt, 1e-4) * 0.05;
      const moving = speed > 0.02;
      if (moving) v.walkPhase += dt * 9 * Math.min(2, speed * 6);
      const swing = moving ? Math.sin(v.walkPhase) * 0.55 : 0;

      if (parts.leftLeg || parts.rightLeg) {
        // biped
        if (parts.leftLeg) parts.leftLeg.rotation.x = swing;
        if (parts.rightLeg) parts.rightLeg.rotation.x = -swing;
        if (parts.leftArm) parts.leftArm.rotation.x = -swing * 0.65;
        if (parts.rightArm && v.attackAnim <= 0) parts.rightArm.rotation.x = swing * 0.65;
        if (v.attackAnim > 0) {
          v.attackAnim -= dt;
          const t = 1 - Math.max(0, v.attackAnim) / 0.35;
          if (parts.rightArm) parts.rightArm.rotation.x = -Math.sin(t * Math.PI) * 1.9;
        }
        // idle breathing
        if (!moving && parts.head) parts.head.position.y = (activeRig.kind === 'humanoid' ? 2.18 : parts.head.position.y) + Math.sin(this.time * 1.8 + e.id) * 0.012;
      } else if (parts.legs) {
        if (activeRig.kind === 'spider') {
          parts.legs.forEach((leg, i) => {
            const base = (i % 2 === 0 ? 1 : -1) * 0.18;
            leg.rotation.x = moving ? Math.sin(v.walkPhase * 1.6 + i * 0.9) * 0.35 : Math.sin(this.time * 2 + i) * 0.05;
            leg.rotation.z = base;
          });
        } else {
          parts.legs.forEach((leg, i) => {
            leg.rotation.x = moving ? Math.sin(v.walkPhase + (i % 2) * Math.PI) * 0.7 : 0;
          });
        }
        if (v.attackAnim > 0) {
          v.attackAnim -= dt;
          const t = 1 - Math.max(0, v.attackAnim) / 0.35;
          if (parts.head) parts.head.rotation.x = Math.sin(t * Math.PI) * 0.6;
        } else if (parts.head) {
          parts.head.rotation.x = 0;
        }
        if (parts.tail) parts.tail.rotation.x = 0.55 + Math.sin(this.time * 4 + e.id) * 0.15;
      }

      // death pose
      if (e.dead) {
        activeRig.body.rotation.z = Math.PI / 2;
        activeRig.body.position.y = 0.4;
      } else {
        activeRig.body.rotation.z = 0;
        activeRig.body.position.y = 0;
        if (e.castingAbility && parts.leftArm && parts.rightArm) {
          parts.leftArm.rotation.x = -2.4;
          parts.rightArm.rotation.x = -2.4;
        }
        // sitting pose
        if (e.kind === 'player' && (e.sitting || e.consuming)) {
          activeRig.body.position.y = -0.8;
          if (parts.leftLeg) parts.leftLeg.rotation.x = -1.4;
          if (parts.rightLeg) parts.rightLeg.rotation.x = -1.4;
        }
      }
    }

    // selection ring
    const target = p.targetId !== null ? sim.entities.get(p.targetId) : null;
    if (target) {
      const tv = this.views.get(target.id)!;
      this.selectionRing.position.copy(tv.group.position);
      this.selectionRing.position.y += 0.08;
      this.selectionRing.scale.setScalar(target.scale);
      (this.selectionRing.material as THREE.MeshBasicMaterial).color.setHex(
        target.hostile ? 0xcc2222 : 0xd4af37,
      );
      this.selectionRing.visible = true;
    } else {
      this.selectionRing.visible = false;
    }

    // fire flicker
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      const fl = 0.85 + Math.sin(this.time * 9 + i * 2.4) * 0.12 + Math.sin(this.time * 23 + i) * 0.06;
      f.scale.set(fl, fl * (1 + Math.sin(this.time * 13 + i) * 0.12), fl);
    }
    for (let i = 0; i < this.fireLights.length; i++) {
      this.fireLights[i].intensity = 11 + Math.sin(this.time * 11 + i * 1.7) * 2.5;
    }

    // clouds drift
    for (const cl of this.clouds) {
      cl.position.x += dt * 1.6;
      if (cl.position.x > 320) cl.position.x = -320;
    }

    // water shimmer
    this.waterTex.offset.x = this.time * 0.008;
    this.waterTex.offset.y = this.time * 0.011;

    this.updateDungeonAmbience(p.pos.x);

    this.updateCamera(alpha);
    // shadow frustum follows the player
    const pv = this.views.get(p.id);
    if (pv) {
      const pp = pv.group.position;
      this.sun.position.set(pp.x + 90, pp.y + 140, pp.z + 50);
      this.sun.target.position.set(pp.x, pp.y, pp.z);
    }

    this.updateNameplates();
    this.webgl.render(this.scene, this.camera);
  }

  private updateCamera(alpha: number): void {
    const p = this.sim.player;
    const px = p.prevPos.x + (p.pos.x - p.prevPos.x) * alpha;
    const py = p.prevPos.y + (p.pos.y - p.prevPos.y) * alpha;
    const pz = p.prevPos.z + (p.pos.z - p.prevPos.z) * alpha;
    const eyeY = py + 2.0;
    const cx = px - Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const cy = eyeY + Math.sin(this.camPitch) * this.camDist;
    const cz = pz - Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const groundY = groundHeight(cx, cz, this.sim.cfg.seed) + 0.6;
    this.camera.position.set(cx, Math.max(cy, groundY), cz);
    this.camera.lookAt(px, eyeY, pz);
  }

  private updateNameplates(): void {
    const sim = this.sim;
    const p = sim.player;
    const w = window.innerWidth, h = window.innerHeight;
    for (const e of sim.entities.values()) {
      const v = this.views.get(e.id);
      if (!v) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const isSelf = e.id === p.id;
      const hidden = isSelf || dist > NAMEPLATE_RANGE
        || (e.dead && !e.lootable && e.kind === 'mob')
        || (e.kind === 'object')
        || (!this.showNameplates && e.kind === 'mob' && !e.dead);
      if (hidden) {
        v.nameplate.style.display = 'none';
        continue;
      }
      this.tmpV.copy(v.group.position);
      this.tmpV.y += v.rig.height * e.scale + 0.5;
      this.tmpV.project(this.camera);
      if (this.tmpV.z > 1) { v.nameplate.style.display = 'none'; continue; }
      const sx = (this.tmpV.x * 0.5 + 0.5) * w;
      const sy = (-this.tmpV.y * 0.5 + 0.5) * h;
      v.nameplate.style.display = '';
      v.nameplate.style.transform = `translate(${sx.toFixed(0)}px, ${sy.toFixed(0)}px) translate(-50%, -100%)`;

      if (e.kind === 'player') {
        // other players: friendly blue with an hp bar
        v.nameEl.style.color = '#7fb8ff';
        v.nameEl.textContent = `${e.name}`;
        v.hpBar.style.display = e.dead ? 'none' : '';
        v.hpFill.style.width = `${(100 * e.hp / Math.max(1, e.maxHp)).toFixed(1)}%`;
        v.markerEl.textContent = '';
      } else if (e.kind === 'npc') {
        v.nameEl.style.color = '#9fdc7f';
        v.nameEl.textContent = e.name;
        v.hpBar.style.display = 'none';
        let marker = '';
        let cls = '';
        for (const qid of e.questIds) {
          const st = sim.questState(qid);
          if (st === 'ready') { marker = '?'; cls = 'ready'; break; }
          if (st === 'available') { marker = '!'; cls = 'avail'; }
          else if (st === 'active' && !marker) { marker = '?'; cls = 'active'; }
        }
        v.markerEl.textContent = marker;
        v.markerEl.className = 'np-marker ' + cls;
      } else {
        const diff = e.level - p.level;
        const template = MOBS[e.templateId];
        const elite = !!template?.elite;
        v.nameEl.style.color = e.dead ? '#999' : diff >= 3 ? '#ff4444' : diff >= 1 ? '#ffaa33' : diff >= -2 ? '#ffe97a' : diff >= -5 ? '#7fdc4f' : '#9d9d9d';
        v.nameEl.textContent = e.dead ? `${e.name} (corpse)` : `[${e.level}${elite ? '+' : ''}] ${e.name}`;
        v.hpBar.style.display = e.dead ? 'none' : '';
        v.hpFill.style.width = `${(100 * e.hp / Math.max(1, e.maxHp)).toFixed(1)}%`;
        v.markerEl.textContent = e.lootable ? '$' : elite && !e.dead ? '◆' : '';
        v.markerEl.className = 'np-marker loot';
      }
    }
  }

  pick(clientX: number, clientY: number): number | null {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickTargets, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        if (o.userData.entityId !== undefined && o.userData.entityId !== this.sim.playerId) {
          const e = this.sim.entities.get(o.userData.entityId as number);
          if (e?.kind === 'object' && !e.lootable) return null;
          return o.userData.entityId as number;
        }
        o = o.parent;
      }
    }
    return null;
  }

  worldToScreen(x: number, y: number, z: number): { x: number; y: number; behind: boolean } {
    this.tmpV.set(x, y, z).project(this.camera);
    return {
      x: (this.tmpV.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this.tmpV.y * 0.5 + 0.5) * window.innerHeight,
      behind: this.tmpV.z > 1,
    };
  }
}

function shortestAngle(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// minimal geometry merge (positions/normals/uvs) to avoid pulling in examples/
function mergeGeoms(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0, totalIdx = 0;
  for (const g of geoms) {
    totalVerts += g.attributes.position.count;
    totalIdx += g.index ? g.index.count : 0;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const idx = new Uint16Array(totalIdx);
  let vOff = 0, iOff = 0;
  for (const g of geoms) {
    pos.set(g.attributes.position.array as Float32Array, vOff * 3);
    norm.set(g.attributes.normal.array as Float32Array, vOff * 3);
    uv.set(g.attributes.uv.array as Float32Array, vOff * 2);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) idx[iOff + i] = g.index.array[i] + vOff;
      iOff += g.index.count;
    }
    vOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
