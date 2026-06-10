import * as THREE from 'three';
import type { Entity } from '../sim/types';

// Procedural character rigs. Every build function returns a group plus the
// animatable parts; the renderer drives walk/attack cycles.

export interface RigParts {
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  legs?: THREE.Object3D[]; // quadruped/spider legs (alternating phase by index)
  head?: THREE.Object3D;
  tail?: THREE.Object3D;
  flame?: THREE.Object3D; // kobold candle
}

export interface Rig {
  body: THREE.Group;
  parts: RigParts;
  kind: 'humanoid' | 'wolf' | 'boar' | 'spider' | 'murloc' | 'kobold' | 'skeleton' | 'sheep';
  height: number;
}

function box(w: number, h: number, d: number, color: number, opts?: { flat?: boolean }): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, flatShading: opts?.flat }),
  );
  m.castShadow = true;
  return m;
}

const SKIN = 0xd9a47f;
const SKIN_DARK = 0xb9846a;

export function buildHumanoid(e: Entity, opts: {
  shirt: number; pants: number; skin?: number; hair?: number;
  weapon?: 'sword' | 'staff' | 'dagger' | 'pick' | 'mace' | 'bow' | 'none';
  shoulders?: boolean; hood?: boolean; robe?: boolean;
}): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const skin = opts.skin ?? SKIN;
  const hair = opts.hair ?? 0x4a3320;

  const torso = box(0.82, 0.92, 0.46, opts.shirt);
  torso.position.y = 1.46;
  body.add(torso);
  // belt
  const belt = box(0.86, 0.12, 0.5, 0x3b2a16);
  belt.position.y = 1.02;
  body.add(belt);

  const head = new THREE.Group();
  const skull = box(0.46, 0.46, 0.46, skin);
  head.add(skull);
  if (opts.hood) {
    const hood = box(0.54, 0.5, 0.52, opts.shirt);
    hood.position.y = 0.06;
    hood.position.z = -0.04;
    head.add(hood);
  } else {
    const hairCap = box(0.5, 0.16, 0.5, hair);
    hairCap.position.y = 0.24;
    head.add(hairCap);
    const hairBack = box(0.5, 0.3, 0.12, hair);
    hairBack.position.set(0, 0.08, -0.22);
    head.add(hairBack);
  }
  head.position.y = 2.18;
  parts.head = head;
  body.add(head);

  if (opts.shoulders) {
    for (const sx of [-1, 1]) {
      const pad = box(0.32, 0.2, 0.4, 0x4d3a20);
      pad.position.set(sx * 0.56, 1.95, 0);
      body.add(pad);
    }
  }

  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    const upper = box(0.22, 0.5, 0.24, opts.shirt);
    upper.position.y = -0.22;
    const lower = box(0.2, 0.42, 0.22, skin);
    lower.position.y = -0.66;
    const hand = box(0.18, 0.14, 0.2, SKIN_DARK);
    hand.position.y = -0.94;
    arm.add(upper, lower, hand);
    arm.position.set(sx * 0.55, 1.88, 0);
    if (sx === -1) parts.leftArm = arm; else parts.rightArm = arm;
    body.add(arm);

    const leg = new THREE.Group();
    const thigh = box(0.28, 0.5, 0.3, opts.robe ? opts.shirt : opts.pants);
    thigh.position.y = -0.24;
    const shin = box(0.26, 0.42, 0.28, opts.robe ? opts.shirt : opts.pants);
    shin.position.y = -0.68;
    const boot = box(0.28, 0.16, 0.36, 0x2c2014);
    boot.position.set(0, -0.92, 0.03);
    leg.add(thigh, shin, boot);
    leg.position.set(sx * 0.2, 1.0, 0);
    if (sx === -1) parts.leftLeg = leg; else parts.rightLeg = leg;
    body.add(leg);
  }

  // weapon in right hand
  const weapon = opts.weapon ?? 'sword';
  if (weapon !== 'none' && parts.rightArm) {
    let w: THREE.Object3D;
    if (weapon === 'staff') {
      const g = new THREE.Group();
      const shaft = box(0.1, 1.7, 0.1, 0x7a5230);
      g.add(shaft);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshLambertMaterial({
        color: 0x69ccf0, emissive: 0x1b4f72, emissiveIntensity: 0.6,
      }));
      orb.position.y = 0.92;
      g.add(orb);
      g.position.set(0.05, -0.85, 0.05);
      w = g;
    } else if (weapon === 'dagger') {
      const g = new THREE.Group();
      const blade = box(0.06, 0.5, 0.12, 0xc8ccd2);
      blade.position.y = -0.3;
      const hilt = box(0.16, 0.06, 0.1, 0x6b5a2a);
      const grip = box(0.07, 0.16, 0.08, 0x3b2a16);
      grip.position.y = 0.1;
      g.add(blade, hilt, grip);
      g.position.set(0, -0.95, 0.12);
      w = g;
    } else if (weapon === 'pick') {
      const g = new THREE.Group();
      const handle = box(0.07, 0.9, 0.07, 0x7a5230);
      const headBar = box(0.5, 0.09, 0.09, 0x8d8d85);
      headBar.position.y = 0.42;
      g.add(handle, headBar);
      g.position.set(0, -0.75, 0.1);
      w = g;
    } else if (weapon === 'mace') {
      const g = new THREE.Group();
      const handle = box(0.08, 0.8, 0.08, 0x6b4a2b);
      const head = box(0.26, 0.26, 0.26, 0x8d8d85);
      head.position.y = 0.42;
      g.add(handle, head);
      g.position.set(0, -0.8, 0.1);
      w = g;
    } else if (weapon === 'bow') {
      const g = new THREE.Group();
      const upper = box(0.06, 0.55, 0.1, 0x7a5230);
      upper.position.y = 0.26;
      upper.rotation.x = 0.35;
      const lower = box(0.06, 0.55, 0.1, 0x7a5230);
      lower.position.y = -0.26;
      lower.rotation.x = -0.35;
      const stringGeo = box(0.015, 0.95, 0.015, 0xd8d8c8);
      stringGeo.position.z = -0.17;
      g.add(upper, lower, stringGeo);
      g.position.set(0, -0.7, 0.1);
      g.rotation.z = Math.PI / 2.6;
      w = g;
    } else {
      const g = new THREE.Group();
      const blade = box(0.09, 0.85, 0.16, 0xc8ccd2);
      blade.position.y = -0.5;
      const guard = box(0.3, 0.07, 0.12, 0x8a6d2c);
      const grip = box(0.08, 0.2, 0.09, 0x3b2a16);
      grip.position.y = 0.13;
      g.add(blade, guard, grip);
      g.position.set(0, -0.95, 0.14);
      w = g;
    }
    w.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    parts.rightArm.add(w);
  }

  return { body, parts, kind: 'humanoid', height: 2.6 };
}

export function buildWolf(e: Entity): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const fur = e.color;
  const furDark = 0x55595c;

  const torso = box(0.72, 0.68, 1.55, fur);
  torso.position.y = 0.88;
  body.add(torso);
  const chest = box(0.78, 0.6, 0.5, furDark);
  chest.position.set(0, 0.92, 0.55);
  body.add(chest);
  const head = new THREE.Group();
  const skull = box(0.48, 0.46, 0.5, fur);
  const snout = box(0.26, 0.24, 0.4, furDark);
  snout.position.set(0, -0.08, 0.4);
  const nose = box(0.12, 0.1, 0.06, 0x1a1a1a);
  nose.position.set(0, -0.04, 0.62);
  head.add(skull, snout, nose);
  for (const sx of [-0.15, 0.15]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 4), new THREE.MeshLambertMaterial({ color: furDark }));
    ear.position.set(sx, 0.32, 0);
    ear.castShadow = true;
    head.add(ear);
  }
  head.position.set(0, 1.18, 0.95);
  parts.head = head;
  body.add(head);
  const tail = box(0.14, 0.14, 0.65, furDark);
  tail.position.set(0, 1.05, -1.0);
  tail.rotation.x = 0.55;
  parts.tail = tail;
  body.add(tail);
  parts.legs = [];
  for (const [sx, sz] of [[-0.26, 0.55], [0.26, 0.55], [-0.26, -0.55], [0.26, -0.55]]) {
    const leg = box(0.18, 0.62, 0.18, furDark);
    leg.geometry.translate(0, -0.31, 0);
    leg.position.set(sx, 0.62, sz);
    parts.legs.push(leg);
    body.add(leg);
  }
  return { body, parts, kind: 'wolf', height: 1.6 };
}

export function buildBoar(e: Entity): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const hide = e.color;
  const torso = box(0.92, 0.8, 1.5, hide);
  torso.position.y = 0.74;
  body.add(torso);
  // bristle ridge
  const ridge = box(0.2, 0.18, 1.2, 0x5d3a10);
  ridge.position.y = 1.2;
  body.add(ridge);
  const head = new THREE.Group();
  const skull = box(0.6, 0.55, 0.55, hide);
  const snout = box(0.3, 0.26, 0.2, 0xc99b77);
  snout.position.set(0, -0.1, 0.36);
  head.add(skull, snout);
  for (const sx of [-0.18, 0.18]) {
    const tusk = box(0.07, 0.22, 0.07, 0xf0ead2);
    tusk.position.set(sx, -0.18, 0.34);
    tusk.rotation.x = -0.5;
    head.add(tusk);
    const ear = box(0.14, 0.16, 0.05, 0x7a4413);
    ear.position.set(sx * 1.6, 0.3, 0);
    head.add(ear);
  }
  head.position.set(0, 0.85, 0.92);
  parts.head = head;
  body.add(head);
  parts.legs = [];
  for (const [sx, sz] of [[-0.32, 0.5], [0.32, 0.5], [-0.32, -0.5], [0.32, -0.5]]) {
    const leg = box(0.2, 0.5, 0.2, 0x6e3d12);
    leg.geometry.translate(0, -0.25, 0);
    leg.position.set(sx, 0.5, sz);
    parts.legs.push(leg);
    body.add(leg);
  }
  return { body, parts, kind: 'boar', height: 1.45 };
}

export function buildSpider(e: Entity): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const chitin = e.color;
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), new THREE.MeshLambertMaterial({ color: chitin, flatShading: true }));
  abdomen.scale.set(1, 0.85, 1.25);
  abdomen.position.set(0, 0.92, -0.5);
  abdomen.castShadow = true;
  body.add(abdomen);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshLambertMaterial({ color: 0x2e1437, flatShading: true }));
  thorax.position.set(0, 0.82, 0.32);
  thorax.castShadow = true;
  body.add(thorax);
  // eyes
  for (const sx of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshLambertMaterial({
      color: 0xff3333, emissive: 0x661111,
    }));
    eye.position.set(sx, 0.92, 0.66);
    body.add(eye);
  }
  // fangs
  for (const sx of [-0.1, 0.1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), new THREE.MeshLambertMaterial({ color: 0xd5d8dc }));
    fang.position.set(sx, 0.66, 0.62);
    fang.rotation.x = Math.PI;
    body.add(fang);
  }
  parts.legs = [];
  for (let i = 0; i < 4; i++) {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      const upper = box(0.07, 0.07, 0.62, 0x1d0a26);
      upper.position.z = 0.31;
      upper.rotation.y = 0;
      const lower = box(0.06, 0.5, 0.06, 0x1d0a26);
      lower.position.set(0, -0.2, 0.6);
      leg.add(upper, lower);
      leg.position.set(sx * 0.3, 0.85, 0.3 - i * 0.26);
      leg.rotation.y = sx * (0.6 + i * 0.25);
      parts.legs.push(leg);
      body.add(leg);
    }
  }
  return { body, parts, kind: 'spider', height: 1.4 };
}

export function buildMurloc(e: Entity): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const skin = e.color;
  const belly = 0xd9e4aa;

  const torso = box(0.6, 0.62, 0.45, skin);
  torso.position.y = 0.78;
  torso.rotation.x = 0.25; // hunched
  body.add(torso);
  const bellyPlate = box(0.42, 0.5, 0.1, belly);
  bellyPlate.position.set(0, 0.72, 0.22);
  bellyPlate.rotation.x = 0.25;
  body.add(bellyPlate);

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), new THREE.MeshLambertMaterial({ color: skin, flatShading: true }));
  skull.scale.set(1.15, 0.9, 1);
  skull.castShadow = true;
  head.add(skull);
  for (const sx of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshLambertMaterial({ color: 0xfff2b0 }));
    eye.position.set(sx, 0.12, 0.26);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    pupil.position.set(sx, 0.12, 0.34);
    head.add(pupil);
  }
  const mouth = box(0.3, 0.06, 0.2, 0x7a3b2e);
  mouth.position.set(0, -0.12, 0.26);
  head.add(mouth);
  // head fin
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4), new THREE.MeshLambertMaterial({ color: 0xe67e22, side: THREE.DoubleSide }));
  fin.scale.z = 0.3;
  fin.position.set(0, 0.34, -0.05);
  head.add(fin);
  head.position.set(0, 1.28, 0.12);
  parts.head = head;
  body.add(head);

  for (const sx of [-1, 1]) {
    const arm = box(0.14, 0.5, 0.16, skin);
    arm.geometry.translate(0, -0.22, 0);
    arm.position.set(sx * 0.4, 1.0, 0.1);
    arm.rotation.x = -0.5;
    if (sx === -1) parts.leftArm = arm; else parts.rightArm = arm;
    body.add(arm);
    const leg = box(0.18, 0.5, 0.2, skin);
    leg.geometry.translate(0, -0.25, 0);
    leg.position.set(sx * 0.18, 0.5, 0);
    if (sx === -1) parts.leftLeg = leg; else parts.rightLeg = leg;
    body.add(leg);
  }
  return { body, parts, kind: 'murloc', height: 1.7 };
}

export function buildKobold(e: Entity): Rig {
  const rig = buildHumanoid(e, {
    shirt: 0x6b4f33, pants: 0x4a3623, skin: e.color, hair: 0x3a2a18, weapon: 'pick',
  });
  rig.body.scale.setScalar(0.8);
  // rat snout
  const snout = box(0.2, 0.18, 0.3, e.color);
  snout.position.set(0, -0.06, 0.34);
  rig.parts.head!.add(snout);
  // ears
  for (const sx of [-0.2, 0.2]) {
    const ear = box(0.14, 0.2, 0.05, e.color);
    ear.position.set(sx, 0.3, 0);
    rig.parts.head!.add(ear);
  }
  // the iconic head candle
  const candle = box(0.12, 0.22, 0.12, 0xf5eee0);
  candle.position.set(0, 0.4, 0);
  rig.parts.head!.add(candle);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 5), new THREE.MeshLambertMaterial({
    color: 0xffc04d, emissive: 0xff8800, emissiveIntensity: 1.2,
  }));
  flame.position.set(0, 0.6, 0);
  rig.parts.head!.add(flame);
  rig.parts.flame = flame;
  return { ...rig, kind: 'kobold', height: 2.1 };
}

export function buildSkeleton(e: Entity): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const bone = 0xe8e6da;
  const boneDark = 0xb9b5a3;

  // ribcage
  const rib = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const r = box(0.6 - i * 0.05, 0.07, 0.4 - i * 0.04, bone);
    r.position.y = 1.7 - i * 0.16;
    rib.add(r);
  }
  const spine = box(0.09, 0.85, 0.09, boneDark);
  spine.position.y = 1.42;
  rib.add(spine);
  const pelvis = box(0.42, 0.18, 0.3, bone);
  pelvis.position.y = 1.0;
  rib.add(pelvis);
  body.add(rib);

  const head = new THREE.Group();
  const skull = box(0.42, 0.4, 0.42, bone);
  head.add(skull);
  for (const sx of [-0.1, 0.1]) {
    const eye = box(0.1, 0.12, 0.05, 0x111111);
    eye.position.set(sx, 0.04, 0.2);
    head.add(eye);
  }
  const jaw = box(0.3, 0.1, 0.3, boneDark);
  jaw.position.set(0, -0.24, 0.02);
  head.add(jaw);
  head.position.y = 2.12;
  parts.head = head;
  body.add(head);

  for (const sx of [-1, 1]) {
    const arm = box(0.09, 0.85, 0.09, bone);
    arm.geometry.translate(0, -0.38, 0);
    arm.position.set(sx * 0.42, 1.85, 0);
    if (sx === -1) parts.leftArm = arm; else parts.rightArm = arm;
    body.add(arm);
    const leg = box(0.1, 0.92, 0.1, bone);
    leg.geometry.translate(0, -0.44, 0);
    leg.position.set(sx * 0.16, 0.95, 0);
    if (sx === -1) parts.leftLeg = leg; else parts.rightLeg = leg;
    body.add(leg);
  }
  // rusty sword
  const blade = box(0.07, 0.7, 0.12, 0x7d6b4e);
  blade.position.set(0, -0.85, 0.12);
  parts.rightArm!.add(blade);
  return { body, parts, kind: 'skeleton', height: 2.5 };
}

// Druid bear form: a stout brown quadruped on the wolf rig pattern.
export function buildBear(): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const fur = 0x6e4a2a;
  const furDark = 0x4f3115;
  const torso = box(1.0, 0.95, 1.8, fur);
  torso.position.y = 1.0;
  body.add(torso);
  const head = new THREE.Group();
  const skull = box(0.6, 0.55, 0.6, fur);
  const snout = box(0.3, 0.26, 0.32, furDark);
  snout.position.set(0, -0.1, 0.42);
  head.add(skull, snout);
  for (const sx of [-0.2, 0.2]) {
    const ear = box(0.16, 0.16, 0.08, furDark);
    ear.position.set(sx, 0.36, 0);
    head.add(ear);
  }
  head.position.set(0, 1.35, 1.05);
  parts.head = head;
  body.add(head);
  parts.legs = [];
  for (const [sx, sz] of [[-0.36, 0.62], [0.36, 0.62], [-0.36, -0.62], [0.36, -0.62]]) {
    const leg = box(0.26, 0.7, 0.26, furDark);
    leg.geometry.translate(0, -0.35, 0);
    leg.position.set(sx, 0.7, sz);
    parts.legs.push(leg);
    body.add(leg);
  }
  return { body, parts, kind: 'wolf', height: 1.9 };
}

// Polymorph form
export function buildSheep(): Rig {
  const body = new THREE.Group();
  const parts: RigParts = {};
  const wool = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf2f0e6, flatShading: true }));
  wool.scale.set(1, 0.85, 1.3);
  wool.position.y = 0.72;
  wool.castShadow = true;
  body.add(wool);
  const head = new THREE.Group();
  const skull = box(0.3, 0.3, 0.34, 0x2c2c2c);
  head.add(skull);
  for (const sx of [-0.12, 0.12]) {
    const ear = box(0.12, 0.07, 0.05, 0x2c2c2c);
    ear.position.set(sx * 1.5, 0.08, 0);
    head.add(ear);
  }
  head.position.set(0, 0.92, 0.62);
  parts.head = head;
  body.add(head);
  parts.legs = [];
  for (const [sx, sz] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]]) {
    const leg = box(0.1, 0.4, 0.1, 0x2c2c2c);
    leg.geometry.translate(0, -0.2, 0);
    leg.position.set(sx, 0.42, sz);
    parts.legs.push(leg);
    body.add(leg);
  }
  return { body, parts, kind: 'sheep', height: 1.2 };
}

export function buildRigFor(e: Entity): Rig {
  if (e.kind === 'mob') {
    switch (e.templateId) {
      case 'forest_wolf': case 'old_greyjaw': return buildWolf(e);
      case 'wild_boar': return buildBoar(e);
      case 'webwood_spider': return buildSpider(e);
      case 'mudfin_murloc': return buildMurloc(e);
      case 'tunnel_rat': return buildKobold(e);
      case 'restless_bones': return buildSkeleton(e);
      case 'gorrak': {
        const rig = buildHumanoid(e, { shirt: e.color, pants: 0x2c1a33, weapon: 'sword', shoulders: true });
        // boss spikes
        for (const sx of [-1, 1]) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 5), new THREE.MeshLambertMaterial({ color: 0x2c2c34 }));
          spike.position.set(sx * 0.56, 2.15, 0);
          rig.body.add(spike);
        }
        return rig;
      }
      default: return buildHumanoid(e, { shirt: e.color, pants: 0x33302b, weapon: 'sword', hood: e.templateId === 'vale_bandit' });
    }
  }
  if (e.kind === 'player') {
    const cls = e.templateId;
    const robed = cls === 'mage' || cls === 'priest' || cls === 'warlock';
    const weapon: 'sword' | 'staff' | 'dagger' | 'mace' | 'bow' =
      cls === 'rogue' ? 'dagger'
        : cls === 'hunter' ? 'bow'
          : cls === 'paladin' || cls === 'shaman' ? 'mace'
            : robed || cls === 'druid' ? 'staff'
              : 'sword';
    return buildHumanoid(e, {
      shirt: e.color,
      pants: robed ? e.color : 0x33302b,
      weapon,
      shoulders: cls === 'warrior' || cls === 'paladin' || cls === 'shaman',
      robe: robed,
      hair: 0x6b4423,
    });
  }
  // npcs
  const npcWeapons: Record<string, 'sword' | 'staff' | 'none' | 'pick'> = {
    marshal_redbrook: 'sword', brother_aldric: 'staff', foreman_odell: 'pick',
  };
  return buildHumanoid(e, {
    shirt: e.color,
    pants: 0x4a4138,
    weapon: npcWeapons[e.templateId] ?? 'none',
    robe: e.templateId === 'brother_aldric',
    hair: 0x7a6a50,
  });
}
