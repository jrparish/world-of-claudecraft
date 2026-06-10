import type { WebSocket } from 'ws';
import { Sim } from '../src/sim/sim';
import { DT, Entity, SimEvent, dist2d } from '../src/sim/types';
import { saveCharacterState } from './db';

const WORLD_SEED = 20061;
const INTEREST_RADIUS = 120;
const EVENT_RADIUS = 90;
const AUTOSAVE_SECONDS = 30;

export interface ClientSession {
  ws: WebSocket;
  accountId: number;
  characterId: number;
  pid: number; // player entity id in the sim
  name: string;
  lastSave: number;
  alive: boolean;
}

interface WireAura {
  id: string;
  name: string;
  kind: string;
  rem: number;
  dur: number;
}

function wireEntity(e: Entity): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: e.id, k: e.kind, tid: e.templateId, nm: e.name, lv: e.level,
    x: round2(e.pos.x), y: round2(e.pos.y), z: round2(e.pos.z), f: round2(e.facing),
    hp: e.hp, mhp: e.maxHp,
  };
  if (e.dead) out.dead = 1;
  if (e.lootable) out.loot = 1;
  if (e.hostile) out.h = 1;
  if (e.scale !== 1) out.sc = e.scale;
  if (e.color !== 0xffffff) out.c = e.color;
  if (e.castingAbility) {
    out.cast = e.castingAbility;
    out.castRem = round2(e.castRemaining);
    out.castTot = round2(e.castTotal);
    if (e.channeling) out.chan = 1;
  }
  if (e.sitting || e.consuming) out.sit = 1;
  if (e.aggroTargetId !== null) out.aggro = e.aggroTargetId;
  if (e.tappedById !== null) out.tap = e.tappedById;
  if (e.auras.length > 0) {
    out.auras = e.auras.map((a): WireAura => ({ id: a.id, name: a.name, kind: a.kind, rem: round2(a.remaining), dur: a.duration }));
  }
  if (e.kind === 'mob' && e.lootable && e.loot) {
    out.lootList = { copper: e.loot.copper, items: e.loot.items };
  }
  return out;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export class GameServer {
  sim: Sim;
  clients = new Map<number, ClientSession>(); // by pid
  private interval: NodeJS.Timeout | null = null;
  private saveTimer = 0;

  constructor() {
    this.sim = new Sim({ seed: WORLD_SEED, playerClass: 'warrior', noPlayer: true });
  }

  start(): void {
    let last = process.hrtime.bigint();
    let acc = 0;
    this.interval = setInterval(() => {
      const now = process.hrtime.bigint();
      let dt = Number(now - last) / 1e9;
      last = now;
      if (dt > 0.5) dt = 0.5;
      acc += dt;
      while (acc >= DT) {
        const events = this.sim.tick();
        this.routeEvents(events);
        acc -= DT;
      }
      this.broadcastSnapshots();
      this.saveTimer += dt;
      if (this.saveTimer >= AUTOSAVE_SECONDS) {
        this.saveTimer = 0;
        void this.saveAll('autosave');
      }
    }, 50);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
  }

  // -------------------------------------------------------------------------

  join(ws: WebSocket, accountId: number, characterId: number, name: string, cls: import('../src/sim/types').PlayerClass, state: import('../src/sim/sim').CharacterState | null): ClientSession | { error: string } {
    for (const c of this.clients.values()) {
      if (c.characterId === characterId) return { error: 'character already in world' };
    }
    const pid = this.sim.addPlayer(cls, name, { state: state ?? undefined });
    const session: ClientSession = { ws, accountId, characterId, pid, name, lastSave: Date.now(), alive: true };
    this.clients.set(pid, session);

    this.send(session, {
      t: 'hello',
      pid,
      seed: this.sim.cfg.seed,
      name,
      cls,
    });
    this.broadcastSystem(`${name} has entered Eastbrook Vale.`);
    return session;
  }

  async leave(session: ClientSession, reason: string): Promise<void> {
    if (!this.clients.has(session.pid)) return;
    this.clients.delete(session.pid);
    await this.saveCharacter(session).catch((err) => console.error('save on leave failed:', err));
    this.sim.removePlayer(session.pid);
    this.broadcastSystem(`${session.name} has left the world. (${reason})`);
  }

  async saveCharacter(session: ClientSession): Promise<void> {
    const state = this.sim.serializeCharacter(session.pid);
    const e = this.sim.entities.get(session.pid);
    if (state && e) {
      await saveCharacterState(session.characterId, e.level, state);
      session.lastSave = Date.now();
    }
  }

  async saveAll(reason: string): Promise<void> {
    for (const session of this.clients.values()) {
      await this.saveCharacter(session).catch((err) => console.error(`${reason} failed for ${session.name}:`, err));
    }
  }

  // -------------------------------------------------------------------------
  // Input & commands
  // -------------------------------------------------------------------------

  handleMessage(session: ClientSession, raw: string): void {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const sim = this.sim;
    const pid = session.pid;
    if (msg.t === 'input') {
      const meta = sim.meta(pid);
      const e = sim.entities.get(pid);
      if (!meta || !e) return;
      const mi = msg.mi ?? {};
      meta.moveInput.forward = !!mi.f;
      meta.moveInput.back = !!mi.b;
      meta.moveInput.turnLeft = !!mi.tl;
      meta.moveInput.turnRight = !!mi.tr;
      meta.moveInput.strafeLeft = !!mi.sl;
      meta.moveInput.strafeRight = !!mi.sr;
      meta.moveInput.jump = !!mi.j;
      if (typeof msg.facing === 'number' && isFinite(msg.facing) && !e.dead) {
        e.facing = msg.facing;
      }
      return;
    }
    if (msg.t !== 'cmd') return;
    switch (msg.cmd) {
      case 'castSlot': sim.castAbilityBySlot(msg.slot | 0, pid); break;
      case 'cast': if (typeof msg.ability === 'string') sim.castAbility(msg.ability, pid); break;
      case 'target': sim.targetEntity(typeof msg.id === 'number' ? msg.id : null, pid); break;
      case 'tab': sim.tabTarget(pid); break;
      case 'targetNearest': sim.targetNearestEnemy(pid); break;
      case 'attack': sim.startAutoAttack(pid); break;
      case 'stopattack': sim.stopAutoAttack(pid); break;
      case 'interact': sim.interact(pid); break;
      case 'loot': if (typeof msg.id === 'number') sim.lootCorpse(msg.id, pid); break;
      case 'pickup': if (typeof msg.id === 'number') sim.pickUpObject(msg.id, pid); break;
      case 'accept': if (typeof msg.quest === 'string') sim.acceptQuest(msg.quest, pid); break;
      case 'turnin': if (typeof msg.quest === 'string') sim.turnInQuest(msg.quest, pid); break;
      case 'abandon': if (typeof msg.quest === 'string') sim.abandonQuest(msg.quest, pid); break;
      case 'equip': if (typeof msg.item === 'string') sim.equipItem(msg.item, pid); break;
      case 'use': if (typeof msg.item === 'string') sim.useItem(msg.item, pid); break;
      case 'buy': if (typeof msg.npc === 'number' && typeof msg.item === 'string') sim.buyItem(msg.npc, msg.item, pid); break;
      case 'sell': if (typeof msg.item === 'string') sim.sellItem(msg.item, pid); break;
      case 'release': sim.releaseSpirit(pid); break;
      case 'chat': if (typeof msg.text === 'string') sim.chat(msg.text, pid); break;
      // party
      case 'pinvite': if (typeof msg.id === 'number') sim.partyInvite(msg.id, pid); break;
      case 'paccept': sim.partyAccept(pid); break;
      case 'pdecline': sim.partyDecline(pid); break;
      case 'pleave': sim.partyLeave(pid); break;
      case 'pkick': if (typeof msg.id === 'number') sim.partyKick(msg.id, pid); break;
      // trade
      case 'trade_req': if (typeof msg.id === 'number') sim.tradeRequest(msg.id, pid); break;
      case 'trade_accept': sim.tradeAccept(pid); break;
      case 'trade_offer':
        if (Array.isArray(msg.items)) sim.tradeSetOffer(msg.items, Number(msg.copper) || 0, pid);
        break;
      case 'trade_confirm': sim.tradeConfirm(pid); break;
      case 'trade_cancel': sim.tradeCancel(pid); break;
      // duels
      case 'duel_req': if (typeof msg.id === 'number') sim.duelRequest(msg.id, pid); break;
      case 'duel_accept': sim.duelAccept(pid); break;
      case 'duel_decline': sim.duelDecline(pid); break;
      // dev/ops commands, only when ALLOW_DEV_COMMANDS=1 (never in production)
      case 'dev_level': {
        if (process.env.ALLOW_DEV_COMMANDS === '1' && typeof msg.level === 'number') {
          sim.setPlayerLevel(msg.level, pid);
        }
        break;
      }
      case 'dev_teleport': {
        if (process.env.ALLOW_DEV_COMMANDS === '1' && typeof msg.x === 'number' && typeof msg.z === 'number') {
          const e = sim.entities.get(pid);
          if (e) {
            const p = sim.groundPos(msg.x, msg.z);
            e.pos = p;
            e.prevPos = { ...p };
          }
        }
        break;
      }
      case 'dev_give': {
        if (process.env.ALLOW_DEV_COMMANDS === '1' && typeof msg.item === 'string') {
          sim.addItem(msg.item, Math.max(1, Math.min(20, msg.count | 0)), pid);
        }
        break;
      }
      // the Hollow Crypt
      case 'enter_crypt': {
        // must actually be near the door
        const e = sim.entities.get(pid);
        const door = [...sim.entities.values()].find((x) => x.templateId === 'crypt_door');
        if (e && door && Math.hypot(e.pos.x - door.pos.x, e.pos.z - door.pos.z) < 8) sim.enterCrypt(pid);
        break;
      }
      case 'leave_crypt': {
        const e = sim.entities.get(pid);
        const exit = e ? [...sim.entities.values()].find((x) => x.templateId === 'crypt_exit' && Math.hypot(e.pos.x - x.pos.x, e.pos.z - x.pos.z) < 8) : null;
        if (exit) sim.leaveCrypt(pid);
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Snapshots & events
  // -------------------------------------------------------------------------

  private broadcastSnapshots(): void {
    for (const session of this.clients.values()) {
      const p = this.sim.entities.get(session.pid);
      const meta = this.sim.meta(session.pid);
      if (!p || !meta) continue;
      const ents: Record<string, unknown>[] = [];
      for (const e of this.sim.entities.values()) {
        if (e.id === session.pid) continue;
        if (dist2d(p.pos, e.pos) > INTEREST_RADIUS) continue;
        ents.push(wireEntity(e));
      }
      const selfWire = wireEntity(p);
      Object.assign(selfWire, {
        res: Math.round(p.resource * 10) / 10,
        mres: p.maxResource,
        rtype: p.resourceType,
        xp: meta.xp,
        copper: meta.copper,
        inv: meta.inventory,
        equip: meta.equipment,
        qlog: [...meta.questLog.values()],
        qdone: [...meta.questsDone],
        cds: Object.fromEntries([...p.cooldowns.entries()].map(([k, v]) => [k, round2(v)])),
        gcd: round2(p.gcdRemaining),
        combo: p.comboPoints,
        comboTgt: p.comboTargetId,
        target: p.targetId,
        auto: p.autoAttack,
        queued: p.queuedOnSwing,
        stats: p.stats,
        ap: p.attackPower,
        crit: p.critChance,
        dodge: p.dodgeChance,
        weapon: p.weapon,
        consuming: p.consuming ? { kind: p.consuming.kind, remaining: round2(p.consuming.remaining) } : null,
        opUntil: p.overpowerUntil > this.sim.time ? 1 : 0,
        party: this.partyWire(session.pid),
        trade: this.tradeWire(session.pid),
        duel: this.duelWire(session.pid),
      });
      this.send(session, { t: 'snap', tick: this.sim.tickCount, time: round2(this.sim.time), self: selfWire, ents });
    }
  }

  private partyWire(pid: number): unknown {
    const party = this.sim.partyOf(pid);
    if (!party) return null;
    return {
      leader: party.leader,
      members: party.members.map((mPid) => {
        const meta = this.sim.meta(mPid);
        const e = this.sim.entities.get(mPid);
        return meta && e ? {
          pid: mPid, name: meta.name, cls: meta.cls, level: e.level,
          hp: e.hp, mhp: e.maxHp, res: Math.round(e.resource), mres: e.maxResource, rtype: e.resourceType,
          x: round2(e.pos.x), z: round2(e.pos.z), dead: e.dead ? 1 : 0,
        } : null;
      }).filter(Boolean),
    };
  }

  private tradeWire(pid: number): unknown {
    const t = this.sim.tradeFor(pid);
    if (!t) return null;
    const mine = t.a === pid;
    const otherPid = mine ? t.b : t.a;
    const other = this.sim.meta(otherPid);
    return {
      otherPid,
      otherName: other?.name ?? '?',
      myOffer: mine ? t.offerA : t.offerB,
      theirOffer: mine ? t.offerB : t.offerA,
      myAccepted: mine ? t.acceptedA : t.acceptedB,
      theirAccepted: mine ? t.acceptedB : t.acceptedA,
    };
  }

  private duelWire(pid: number): unknown {
    const d = this.sim.duelFor(pid);
    if (!d) return null;
    const otherPid = d.a === pid ? d.b : d.a;
    return { otherPid, otherName: this.sim.meta(otherPid)?.name ?? '?', state: d.state };
  }

  private routeEvents(events: SimEvent[]): void {
    if (events.length === 0 || this.clients.size === 0) return;
    for (const session of this.clients.values()) {
      const p = this.sim.entities.get(session.pid);
      if (!p) continue;
      const mine: SimEvent[] = [];
      for (const ev of events) {
        if (ev.pid !== undefined) {
          if (ev.pid === session.pid) mine.push(ev);
          continue;
        }
        // world events: only those near this player
        const anchor = this.eventAnchor(ev);
        if (anchor === null || dist2d(p.pos, anchor) <= EVENT_RADIUS) mine.push(ev);
      }
      if (mine.length > 0) this.send(session, { t: 'events', list: mine });
    }
  }

  private eventAnchor(ev: SimEvent): { x: number; y: number; z: number } | null {
    let id: number | undefined;
    if ('targetId' in ev && typeof ev.targetId === 'number') id = ev.targetId;
    else if ('entityId' in ev && typeof ev.entityId === 'number') id = ev.entityId;
    if (id === undefined) return null; // chat/log etc: broadcast
    return this.sim.entities.get(id)?.pos ?? null;
  }

  private broadcastSystem(text: string): void {
    for (const session of this.clients.values()) {
      this.send(session, { t: 'events', list: [{ type: 'log', text, color: '#ffd100' }] });
    }
  }

  private send(session: ClientSession, obj: unknown): void {
    if (session.ws.readyState === 1) {
      session.ws.send(JSON.stringify(obj));
    }
  }
}
