import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { ALL_CLASSES, dist2d } from '../src/sim/types';
import { CLASSES, MOBS, abilitiesKnownAt, instanceOrigin, CRYPT_SPAWNS } from '../src/sim/data';
import { groundHeight } from '../src/sim/world';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x; e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function face(sim: Sim, pid: number, targetId: number) {
  const e = sim.entities.get(pid)!;
  const t = sim.entities.get(targetId)!;
  e.facing = Math.atan2(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
}

function nearestMob(sim: Sim, templateId: string, from: { x: number; z: number } = { x: 0, z: 0 }) {
  let best: any = null, bestD = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'mob' || e.dead || e.templateId !== templateId) continue;
    const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

describe('nine classes', () => {
  it('every class spawns with a working kit and stats', () => {
    for (const cls of ALL_CLASSES) {
      const sim = new Sim({ seed: 42, playerClass: cls });
      const p = sim.player;
      expect(p.maxHp).toBeGreaterThan(30);
      expect(sim.known.length).toBeGreaterThan(0);
      expect(CLASSES[cls].abilities.length).toBeLessThanOrEqual(10);
      // all kit abilities resolve at level 10
      const kit = abilitiesKnownAt(cls, 10);
      expect(kit.length).toBe(CLASSES[cls].abilities.length);
      // resource type sane
      if (cls === 'warrior') expect(p.resourceType).toBe('rage');
      else if (cls === 'rogue') expect(p.resourceType).toBe('energy');
      else expect(p.resourceType).toBe('mana');
    }
  });

  it('priest heals and shields', () => {
    const sim = new Sim({ seed: 42, playerClass: 'priest' });
    const p = sim.player;
    sim.setPlayerLevel(6);
    p.hp = 30;
    sim.castAbility('lesser_heal');
    for (let i = 0; i < 20 * 3; i++) sim.tick();
    expect(p.hp).toBeGreaterThan(30);
    // PW:S absorbs damage
    sim.castAbility('power_word_shield');
    sim.tick();
    expect(p.auras.some((a) => a.kind === 'absorb')).toBe(true);
    const hpBefore = p.hp;
    (sim as any).dealDamage(null, p, 20, false, 'physical', 'test', 'hit');
    expect(p.hp).toBe(hpBefore); // fully soaked
  });

  it('renew ticks healing over time', () => {
    const sim = new Sim({ seed: 42, playerClass: 'priest' });
    sim.setPlayerLevel(8);
    const p = sim.player;
    p.hp = 20;
    sim.castAbility('renew');
    for (let i = 0; i < 20 * 7; i++) sim.tick();
    expect(p.hp).toBeGreaterThan(30);
  });

  it('paladin seal empowers swings and judgement consumes it', () => {
    const sim = new Sim({ seed: 42, playerClass: 'paladin' });
    sim.setPlayerLevel(4);
    const p = sim.player;
    sim.castAbility('seal_of_righteousness');
    sim.tick();
    expect(p.auras.some((a) => a.kind === 'imbue')).toBe(true);
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, p.id, wolf.pos.x + 3, wolf.pos.z);
    sim.targetEntity(wolf.id);
    face(sim, p.id, wolf.id);
    p.resource = p.maxResource;
    // wait out gcd then judge
    for (let i = 0; i < 35; i++) sim.tick();
    face(sim, p.id, wolf.id);
    const dealtBefore = sim.counters.damageDealt;
    sim.castAbility('judgement');
    sim.tick();
    expect(sim.counters.damageDealt).toBeGreaterThan(dealtBefore);
    expect(p.auras.some((a) => a.kind === 'imbue')).toBe(false); // consumed
  });

  it('warlock life taps and drains life', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warlock' });
    sim.setPlayerLevel(10);
    const p = sim.player;
    p.resource = 10;
    const hpBefore = p.hp;
    sim.castAbility('life_tap');
    sim.tick();
    expect(p.hp).toBe(hpBefore - 30);
    expect(p.resource).toBe(40);
    // drain life channel heals
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, p.id, wolf.pos.x + 10, wolf.pos.z);
    sim.targetEntity(wolf.id);
    face(sim, p.id, wolf.id);
    p.hp = 30;
    p.resource = p.maxResource;
    for (let i = 0; i < 35; i++) sim.tick();
    face(sim, p.id, wolf.id);
    sim.castAbility('drain_life');
    for (let i = 0; i < 20 * 6 && p.castingAbility; i++) sim.tick();
    expect(p.hp).toBeGreaterThan(30);
  });

  it('hunter kills with ranged auto shot from distance', () => {
    const sim = new Sim({ seed: 42, playerClass: 'hunter' });
    const p = sim.player;
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.hp = 30;
    teleport(sim, p.id, wolf.pos.x + 20, wolf.pos.z);
    sim.targetEntity(wolf.id);
    face(sim, p.id, wolf.id);
    sim.startAutoAttack();
    let killed = false;
    let autoShots = 0;
    for (let i = 0; i < 20 * 60 && !killed; i++) {
      face(sim, p.id, wolf.id);
      const events = sim.tick();
      for (const ev of events) {
        if (ev.type === 'damage' && ev.ability === 'Auto Shot' && ev.kind === 'hit') autoShots++;
        if (ev.type === 'death' && ev.entityId === wolf.id) killed = true;
      }
    }
    expect(killed).toBe(true);
    expect(autoShots).toBeGreaterThan(0); // ranged shots landed before melee
  });

  it('lightning shield zaps attackers (thorns)', () => {
    const sim = new Sim({ seed: 42, playerClass: 'shaman' });
    sim.setPlayerLevel(8);
    const p = sim.player;
    sim.castAbility('lightning_shield');
    sim.tick();
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, p.id, wolf.pos.x + 2, wolf.pos.z);
    const wolfHpBefore = wolf.hp;
    let zapped = false;
    for (let i = 0; i < 20 * 15 && !zapped; i++) {
      sim.tick();
      if (wolf.hp < wolfHpBefore) zapped = true;
    }
    expect(zapped).toBe(true);
  });

  it('druid bear form toggles and raises armor', () => {
    const sim = new Sim({ seed: 42, playerClass: 'druid' });
    sim.setPlayerLevel(10);
    const p = sim.player;
    const armorBefore = p.stats.armor;
    sim.castAbility('bear_form');
    sim.tick();
    expect(p.auras.some((a) => a.kind === 'form_bear')).toBe(true);
    expect(p.stats.armor).toBeGreaterThan(armorBefore * 1.4);
    for (let i = 0; i < 35; i++) sim.tick();
    sim.castAbility('bear_form');
    sim.tick();
    expect(p.auras.some((a) => a.kind === 'form_bear')).toBe(false);
    expect(p.stats.armor).toBe(armorBefore);
  });
});

describe('elite mobs', () => {
  it('elites scale like vanilla elites (~2.3x hp, 1.5x damage, 2x xp)', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Tank');
    sim.enterCrypt(pid);
    const origin = instanceOrigin(0);
    const shambler = nearestMob(sim, 'crypt_shambler', origin);
    expect(shambler).toBeTruthy();
    const t = MOBS.crypt_shambler;
    const normalHp = t.hpBase + t.hpPerLevel * (shambler.level - 1);
    expect(shambler.maxHp).toBe(Math.round(normalHp * 2.3));
    const normalDmg = t.dmgBase + t.dmgPerLevel * (shambler.level - 1);
    expect(shambler.weapon.max).toBe(Math.round(normalDmg * 1.5 * 1.25));
  });
});

describe('parties', () => {
  function makeDuo(): { sim: Sim; a: number; b: number } {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('priest', 'Bet');
    sim.partyInvite(b, a);
    sim.partyAccept(b);
    return { sim, a, b };
  }

  it('invite/accept forms a party; leave disbands at 1', () => {
    const { sim, a, b } = makeDuo();
    expect(sim.partyOf(a)?.members).toEqual([a, b]);
    expect(sim.partyOf(a)?.leader).toBe(a);
    sim.partyLeave(b);
    expect(sim.partyOf(a)).toBe(null);
    expect(sim.partyOf(b)).toBe(null);
  });

  it('party members share kill xp with the group bonus and quest credit', () => {
    const { sim, a, b } = makeDuo();
    // both accept the wolf quest
    teleport(sim, a, 4, 4);
    teleport(sim, b, 4, 5);
    sim.acceptQuest('q_wolves', a);
    sim.acceptQuest('q_wolves', b);
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.hp = 1;
    teleport(sim, a, wolf.pos.x + 2, wolf.pos.z);
    teleport(sim, b, wolf.pos.x - 2, wolf.pos.z);
    sim.targetEntity(wolf.id, a);
    face(sim, a, wolf.id);
    sim.startAutoAttack(a);
    for (let i = 0; i < 20 * 20 && !wolf.dead; i++) {
      face(sim, a, wolf.id);
      sim.tick();
    }
    expect(wolf.dead).toBe(true);
    const metaA = sim.meta(a)!;
    const metaB = sim.meta(b)!;
    // both got xp (half of solo, with 1.166 duo bonus applied)
    expect(metaA.xp).toBeGreaterThan(0);
    expect(metaB.xp).toBeGreaterThan(0);
    expect(metaA.xp).toBe(Math.round((50 * 1.166) / 2));
    // both got quest credit
    expect(metaA.questLog.get('q_wolves')!.counts[0]).toBe(1);
    expect(metaB.questLog.get('q_wolves')!.counts[0]).toBe(1);
  });

  it('party members may loot each other\'s tapped kills', () => {
    const { sim, a, b } = makeDuo();
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.hp = 1;
    teleport(sim, a, wolf.pos.x + 2, wolf.pos.z);
    teleport(sim, b, wolf.pos.x - 2, wolf.pos.z);
    sim.targetEntity(wolf.id, a);
    face(sim, a, wolf.id);
    sim.startAutoAttack(a);
    for (let i = 0; i < 20 * 20 && !wolf.dead; i++) { face(sim, a, wolf.id); sim.tick(); }
    expect(wolf.lootable).toBe(true);
    const copperBefore = sim.meta(b)!.copper;
    sim.lootCorpse(wolf.id, b);
    expect(sim.meta(b)!.copper).toBeGreaterThan(copperBefore);
  });

  it('non-party members cannot loot tapped kills', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const c = sim.addPlayer('rogue', 'Gimel');
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.hp = 1;
    teleport(sim, a, wolf.pos.x + 2, wolf.pos.z);
    teleport(sim, c, wolf.pos.x - 2, wolf.pos.z);
    sim.targetEntity(wolf.id, a);
    face(sim, a, wolf.id);
    sim.startAutoAttack(a);
    for (let i = 0; i < 20 * 20 && !wolf.dead; i++) { face(sim, a, wolf.id); sim.tick(); }
    sim.lootCorpse(wolf.id, c);
    expect(sim.meta(c)!.copper).toBe(0);
    expect(wolf.lootable).toBe(true);
  });
});

describe('duels', () => {
  it('full duel flow: challenge, countdown, fight to 1hp, winner declared', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    teleport(sim, a, 0, -40);
    teleport(sim, b, 3, -40);
    sim.duelRequest(b, a);
    sim.duelAccept(b);
    expect(sim.duelFor(a)?.state).toBe('countdown');
    // players can't hit each other during countdown
    sim.targetEntity(b, a);
    face(sim, a, b);
    sim.startAutoAttack(a);
    expect(sim.entities.get(a)!.autoAttack).toBe(false); // rejected: not hostile yet
    for (let i = 0; i < 20 * 4; i++) sim.tick();
    expect(sim.duelFor(a)?.state).toBe('active');
    // now combat works
    const eb = sim.entities.get(b)!;
    eb.hp = 10; // hasten the end
    sim.startAutoAttack(a);
    expect(sim.entities.get(a)!.autoAttack).toBe(true);
    let ended = false;
    let winnerEvent: any = null;
    for (let i = 0; i < 20 * 30 && !ended; i++) {
      face(sim, a, b);
      const events = sim.tick();
      const end = events.find((e) => e.type === 'duelEnd');
      if (end) { ended = true; winnerEvent = end; }
    }
    expect(ended).toBe(true);
    expect(winnerEvent.winnerName).toBe('Aleph');
    expect(eb.hp).toBeGreaterThanOrEqual(1); // nobody dies in a duel
    expect(eb.dead).toBe(false);
    expect(sim.duelFor(a)).toBe(null);
  });
});

describe('trading', () => {
  it('atomic trade of items and copper', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    teleport(sim, a, 0, -40);
    teleport(sim, b, 3, -40);
    sim.addItem('wolf_fang', 3, a);
    sim.meta(a)!.copper = 100;
    sim.meta(b)!.copper = 50;
    sim.addItem('baked_bread', 1, b);

    sim.tradeRequest(b, a);
    sim.tradeAccept(b);
    expect(sim.tradeFor(a)).toBeTruthy();
    sim.tradeSetOffer([{ itemId: 'wolf_fang', count: 2 }], 30, a);
    sim.tradeSetOffer([{ itemId: 'baked_bread', count: 1 }], 10, b);
    sim.tradeConfirm(a);
    expect(sim.tradeFor(a)).toBeTruthy(); // not done until both confirm
    sim.tradeConfirm(b);
    expect(sim.tradeFor(a)).toBe(null);
    expect(sim.countItem('wolf_fang', a)).toBe(1);
    expect(sim.countItem('wolf_fang', b)).toBe(2);
    expect(sim.countItem('baked_bread', a)).toBe(1);
    expect(sim.countItem('baked_bread', b)).toBe(0);
    expect(sim.meta(a)!.copper).toBe(100 - 30 + 10);
    expect(sim.meta(b)!.copper).toBe(50 - 10 + 30);
  });

  it('trade cancels when players walk apart', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    teleport(sim, a, 0, -40);
    teleport(sim, b, 3, -40);
    sim.tradeRequest(b, a);
    sim.tradeAccept(b);
    expect(sim.tradeFor(a)).toBeTruthy();
    teleport(sim, b, 40, -40);
    sim.tick();
    expect(sim.tradeFor(a)).toBe(null);
  });

  it('quest items cannot be traded', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('mage', 'Bet');
    teleport(sim, a, 0, -40);
    teleport(sim, b, 3, -40);
    sim.addItem('boar_hide', 2, a);
    sim.tradeRequest(b, a);
    sim.tradeAccept(b);
    sim.tradeSetOffer([{ itemId: 'boar_hide', count: 2 }], 0, a);
    expect(sim.tradeFor(a)!.offerA.items.length).toBe(0);
  });
});

describe('the Hollow Crypt', () => {
  it('party members enter the same instance; strangers get their own', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    const b = sim.addPlayer('priest', 'Bet');
    const c = sim.addPlayer('rogue', 'Gimel');
    sim.partyInvite(b, a);
    sim.partyAccept(b);
    for (const pid of [a, b, c]) teleport(sim, pid, 80, 88);
    sim.enterCrypt(a);
    sim.enterCrypt(b);
    sim.enterCrypt(c);
    const ea = sim.entities.get(a)!;
    const eb = sim.entities.get(b)!;
    const ec = sim.entities.get(c)!;
    expect(sim.instanceSlotAt(ea.pos)).toBe(sim.instanceSlotAt(eb.pos));
    expect(sim.instanceSlotAt(ec.pos)).not.toBe(sim.instanceSlotAt(ea.pos));
    // elites spawned in each claimed instance
    const slotA = sim.instanceSlotAt(ea.pos)!;
    const originA = instanceOrigin(slotA);
    const bossA = nearestMob(sim, 'morthen', originA);
    expect(bossA).toBeTruthy();
    expect(Math.abs(bossA.pos.x - originA.x)).toBeLessThan(50);
    expect(sim.instances.filter((i) => i.partyKey !== null).length).toBe(2);
    // exit returns to the chapel door
    sim.leaveCrypt(a);
    expect(ea.pos.x).toBeLessThan(200);
  });

  it('crypt has the full spawn set and Morthen pulses in combat', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('warrior', 'Aleph');
    teleport(sim, a, 80, 88);
    sim.enterCrypt(a);
    const slot = sim.instanceSlotAt(sim.entities.get(a)!.pos)!;
    const origin = instanceOrigin(slot);
    const cryptMobs = [...sim.entities.values()].filter(
      (e) => e.kind === 'mob' && Math.abs(e.pos.x - origin.x) < 120 && Math.abs(e.pos.z - origin.z) < 250,
    );
    expect(cryptMobs.length).toBe(CRYPT_SPAWNS.length);
    // walk the player onto the boss: pulse should hit within ~12s
    const boss = nearestMob(sim, 'morthen', origin);
    const ea = sim.entities.get(a)!;
    sim.setPlayerLevel(10, a);
    ea.hp = ea.maxHp;
    teleport(sim, a, boss.pos.x + 2, boss.pos.z);
    sim.targetEntity(boss.id, a);
    face(sim, a, boss.id);
    sim.startAutoAttack(a);
    let pulsed = false;
    for (let i = 0; i < 20 * 25 && !pulsed; i++) {
      face(sim, a, boss.id);
      const events = sim.tick();
      if (events.some((e) => e.type === 'damage' && e.ability === 'Shadow Pulse' && e.targetId === a)) pulsed = true;
      if (ea.dead) break;
    }
    expect(pulsed).toBe(true);
  });

  it('the storyline chain gates the dungeon quest', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior' });
    expect(sim.questState('q_whispers')).toBe('unavailable'); // needs q_bones
    expect(sim.questState('q_rite')).toBe('unavailable');
    expect(sim.questState('q_hollow')).toBe('unavailable');
    sim.questsDone.add('q_bones');
    expect(sim.questState('q_whispers')).toBe('available');
    sim.questsDone.add('q_whispers');
    expect(sim.questState('q_rite')).toBe('available');
    sim.questsDone.add('q_rite');
    expect(sim.questState('q_hollow')).toBe('available');
  });
});
