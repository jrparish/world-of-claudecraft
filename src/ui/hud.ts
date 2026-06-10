import { formatMoney, ResolvedAbility } from '../sim/sim';
import type { IWorld } from '../world_api';
import { Renderer } from '../render/renderer';
import { ABILITIES, CLASSES, ITEMS, MOBS, NPCS, QUESTS, ZONE_NAME } from '../sim/data';
import type { InvSlot } from '../sim/types';
import { AbilityEffect, Entity, GCD, ItemDef, SimEvent, dist2d, xpForLevel, MAX_LEVEL, MELEE_RANGE } from '../sim/types';
import { terrainHeight, WATER_LEVEL, roadDistance } from '../sim/world';
import { audio } from '../game/audio';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector(sel) as T;

const FAMILY_GLYPH: Record<string, string> = {
  beast: '🐾', humanoid: '🗡️', murloc: '🐟', spider: '🕷️', kobold: '⛏️', undead: '💀',
};
const CLASS_GLYPH: Record<string, string> = {
  warrior: '⚔️', paladin: '🔨', hunter: '🏹', rogue: '🗡️', priest: '✝️',
  shaman: '🌩️', mage: '🔮', warlock: '🕯️', druid: '🐻',
};

export class Hud {
  private abilityButtons: { btn: HTMLButtonElement; label: HTMLSpanElement; cdOverlay: HTMLDivElement; cdText: HTMLDivElement }[] = [];
  private logEl = $('#combatlog');
  private errorEl = $('#error-msg');
  private bannerEl = $('#banner');
  private tooltipEl = $('#tooltip');
  private errorTimer: number | undefined;
  private bannerTimer: number | undefined;
  private minimapCtx: CanvasRenderingContext2D;
  private minimapBg: HTMLCanvasElement;
  private mapBg: HTMLCanvasElement | null = null;
  private openLootMobId: number | null = null;
  private openVendorNpcId: number | null = null;
  private selectedQuestLogId: string | null = null;
  private lastPortraitTarget = -999;
  // trading: locally staged offer, pushed to the server on change
  private stagedTrade: { items: InvSlot[]; copper: number } = { items: [], copper: 0 };
  private tradeWasOpen = false;
  private lastTradeSig = '';
  private lastPartySig = '';

  constructor(private sim: IWorld, private renderer: Renderer) {
    this.buildActionBar();
    this.buildXpTicks();
    $('#pf-name').textContent = sim.player.name;
    this.drawPortrait($('#pf-portrait') as unknown as HTMLCanvasElement, CLASS_GLYPH[sim.cfg.playerClass], CLASSES[sim.cfg.playerClass].color);
    const mm = $('#minimap') as unknown as HTMLCanvasElement;
    this.minimapCtx = mm.getContext('2d')!;
    this.minimapBg = this.renderTerrainCanvas(140);
    $('#release-btn').addEventListener('click', () => { this.sim.releaseSpirit(); });
    $('#mm-char').addEventListener('click', () => this.toggleChar());
    $('#mm-spell').addEventListener('click', () => this.toggleSpellbook());
    $('#mm-quest').addEventListener('click', () => this.toggleQuestLog());
    $('#mm-map').addEventListener('click', () => this.toggleMap());
    $('#mm-bag').addEventListener('click', () => this.toggleBags());
    this.showBanner(ZONE_NAME);
    this.log('Welcome to Eastbrook Vale!', '#ffd100');
    this.log('Find Marshal Redbrook in town — he has work for you.', '#ffd100');
  }

  // -------------------------------------------------------------------------
  // Portraits, icons, tooltips, money
  // -------------------------------------------------------------------------

  private drawPortrait(canvas: HTMLCanvasElement, glyph: string, tint: number): void {
    const ctx = canvas.getContext('2d')!;
    const s = canvas.width;
    const g = ctx.createRadialGradient(s * 0.38, s * 0.32, 2, s / 2, s / 2, s * 0.62);
    const c = '#' + tint.toString(16).padStart(6, '0');
    g.addColorStop(0, shade(c, 0.45));
    g.addColorStop(1, shade(c, -0.65));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.font = `${Math.floor(s * 0.58)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, s / 2, s / 2 + 2);
  }

  private itemIcon(item: ItemDef): string {
    const q = item.quality ?? 'common';
    const initials = item.name.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2);
    return `<div class="item-icon q-${q}">${initials}</div>`;
  }

  moneyHtml(copper: number): string {
    const g = Math.floor(copper / 10000);
    const s = Math.floor((copper % 10000) / 100);
    const c = copper % 100;
    let html = '';
    if (g > 0) html += `${g}<span class="coin g"></span>`;
    if (s > 0 || g > 0) html += `${s}<span class="coin s"></span>`;
    html += `${c}<span class="coin c"></span>`;
    return html;
  }

  attachTooltip(el: HTMLElement, html: () => string): void {
    el.addEventListener('mouseenter', () => {
      this.tooltipEl.innerHTML = html();
      this.tooltipEl.style.display = 'block';
    });
    el.addEventListener('mousemove', (e) => {
      const tw = this.tooltipEl.offsetWidth, th = this.tooltipEl.offsetHeight;
      this.tooltipEl.style.left = `${Math.min(window.innerWidth - tw - 8, e.clientX + 14)}px`;
      this.tooltipEl.style.top = `${Math.max(8, e.clientY - th - 10)}px`;
    });
    el.addEventListener('mouseleave', () => { this.tooltipEl.style.display = 'none'; });
  }

  hideTooltip(): void {
    this.tooltipEl.style.display = 'none';
  }

  private itemTooltip(item: ItemDef): string {
    const qColor = item.quality === 'poor' ? '#9d9d9d' : item.quality === 'uncommon' ? '#1eff00' : '#fff';
    let html = `<div class="tt-title" style="color:${qColor}">${item.name}</div>`;
    if (item.slot) {
      const slotNames: Record<string, string> = { mainhand: 'Main Hand', chest: 'Chest', legs: 'Legs', feet: 'Feet' };
      html += `<div class="tt-sub">${slotNames[item.slot]}</div>`;
    }
    if (item.weapon) {
      const dps = ((item.weapon.min + item.weapon.max) / 2 / item.weapon.speed).toFixed(1);
      html += `<div class="tt-stat">${item.weapon.min} - ${item.weapon.max} Damage&nbsp;&nbsp;Speed ${item.weapon.speed.toFixed(1)}</div>`;
      html += `<div class="tt-stat">(${dps} damage per second)</div>`;
      if (item.weapon.dagger) html += `<div class="tt-sub">Dagger</div>`;
    }
    if (item.stats) {
      for (const [k, v] of Object.entries(item.stats)) {
        if (k === 'armor') html += `<div class="tt-stat">${v} Armor</div>`;
        else html += `<div class="tt-green">+${v} ${k[0].toUpperCase()}${k.slice(1)}</div>`;
      }
    }
    if (item.foodHp) html += `<div class="tt-desc">Use: Restores ${item.foodHp} health over 18 sec. Must remain seated while eating.</div>`;
    if (item.drinkMana) html += `<div class="tt-desc">Use: Restores ${item.drinkMana} mana over 18 sec. Must remain seated while drinking.</div>`;
    if (item.kind === 'quest') html += `<div class="tt-desc">Quest Item</div>`;
    if (item.requiredClass) html += `<div class="tt-sub">Classes: ${item.requiredClass.map((c) => CLASSES[c].name).join(', ')}</div>`;
    if (item.sellValue > 0) html += `<div class="tt-sub">Sell price: ${formatMoney(item.sellValue)}</div>`;
    return html;
  }

  private abilityTooltip(res: ResolvedAbility): string {
    const a = res.def;
    const resName = this.sim.player.resourceType === 'rage' ? 'Rage' : this.sim.player.resourceType === 'energy' ? 'Energy' : 'Mana';
    let dmgText = '';
    for (const eff of res.effects) {
      if (eff.type === 'directDamage') dmgText = eff.min === eff.max ? `${eff.min}` : `${eff.min} to ${eff.max}`;
      if (eff.type === 'weaponDamage' || eff.type === 'weaponStrike') dmgText = `${eff.bonus}`;
      if (eff.type === 'dot') dmgText = `${eff.total}`;
      if (eff.type === 'aoeDamage' || eff.type === 'aoeRoot') dmgText = `${eff.min} to ${eff.max}`;
    }
    let html = `<div class="tt-title">${a.name}</div>`;
    html += `<div class="tt-sub">Rank ${res.rank}</div>`;
    const costLine: string[] = [];
    if (res.cost > 0) costLine.push(`${res.cost} ${resName}`);
    if (a.range > 0) costLine.push(`${a.minRange ? a.minRange + '-' : ''}${a.range} yd range`);
    if (costLine.length) html += `<div class="tt-stat">${costLine.join(' &nbsp; ')}</div>`;
    const castLine: string[] = [];
    castLine.push(a.channel ? `Channeled (${a.channel.duration} sec)` : res.castTime > 0 ? `${res.castTime} sec cast` : 'Instant');
    if (a.cooldown > 0) castLine.push(`${a.cooldown} sec cooldown`);
    html += `<div class="tt-stat">${castLine.join(' &nbsp; ')}</div>`;
    html += `<div class="tt-desc">${a.description.replace('$d', dmgText)}</div>`;
    return html;
  }

  // -------------------------------------------------------------------------
  // Action bar
  // -------------------------------------------------------------------------

  private buildActionBar(): void {
    const bar = $('#actionbar');
    const keybinds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
    for (let i = 0; i < 12; i++) {
      const btn = document.createElement('button');
      btn.className = 'action-btn empty';
      const label = document.createElement('span');
      label.className = 'icon-label';
      const kb = document.createElement('span');
      kb.className = 'keybind';
      kb.textContent = keybinds[i];
      const cdOverlay = document.createElement('div');
      cdOverlay.className = 'cd-overlay';
      const cdText = document.createElement('div');
      cdText.className = 'cdtext';
      btn.append(label, kb, cdOverlay, cdText);
      const slot = i;
      btn.addEventListener('click', () => {
        audio.click();
        this.sim.castAbilityBySlot(slot);
      });
      this.attachTooltip(btn, () => {
        const known = this.sim.known[slot];
        return known ? this.abilityTooltip(known) : '<div class="tt-sub">Empty slot</div>';
      });
      bar.appendChild(btn);
      this.abilityButtons.push({ btn, label, cdOverlay, cdText });
    }
  }

  private buildXpTicks(): void {
    const ticks = $('#xpbar .ticks');
    for (let i = 0; i < 20; i++) ticks.appendChild(document.createElement('i'));
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------

  update(): void {
    const sim = this.sim;
    const p = sim.player;

    // player frame
    $('#pf-level').textContent = String(p.level);
    ($('#pf-hp') as HTMLElement).style.transform = `scaleX(${p.hp / Math.max(1, p.maxHp)})`;
    $('#pf-hp-text').textContent = `${p.hp} / ${p.maxHp}`;
    const resFrac = p.resource / Math.max(1, p.maxResource);
    ($('#pf-res') as HTMLElement).style.transform = `scaleX(${resFrac})`;
    $('#pf-res-text').textContent = `${Math.round(p.resource)} / ${p.maxResource}`;
    $('#pf-resource').className = 'bar ' + (p.resourceType === 'rage' ? 'rage' : p.resourceType === 'energy' ? 'energy' : 'mana');

    // buff bar (player buffs + debuffs)
    this.renderAuras($('#buff-bar'), p, 'all');

    // target frame
    const target = p.targetId !== null ? sim.entities.get(p.targetId) : null;
    const tf = $('#target-frame');
    if (target && target.kind !== 'object') {
      tf.style.display = 'flex';
      tf.classList.toggle('elite', !!MOBS[target.templateId]?.elite);
      $('#tf-elite-tag').textContent = MOBS[target.templateId]?.boss ? 'BOSS' : 'ELITE';
      $('#tf-name').textContent = target.name;
      $('#tf-level').textContent = MOBS[target.templateId]?.boss ? '☠' : String(target.level);
      ($('#tf-hp') as HTMLElement).style.transform = `scaleX(${target.hp / Math.max(1, target.maxHp)})`;
      $('#tf-hp-text').textContent = target.dead ? 'Dead' : `${target.hp} / ${target.maxHp}`;
      ($('#tf-name') as HTMLElement).style.color = target.hostile ? '#ff6b5e' : '#9fdc7f';
      if (this.lastPortraitTarget !== target.id) {
        this.lastPortraitTarget = target.id;
        const glyph = target.kind === 'npc' ? '💬' : FAMILY_GLYPH[MOBS[target.templateId]?.family ?? 'humanoid'] ?? '🗡️';
        this.drawPortrait($('#tf-portrait') as unknown as HTMLCanvasElement, glyph, target.color);
      }
      this.renderAuras($('#tf-debuffs'), target, 'debuffs');
      // combo points
      const comboRow = $('#combo-row');
      if (p.resourceType === 'energy') {
        comboRow.style.display = 'flex';
        if (comboRow.children.length !== 5) {
          comboRow.innerHTML = '';
          for (let i = 0; i < 5; i++) {
            const pip = document.createElement('div');
            pip.className = 'combo-pip';
            comboRow.appendChild(pip);
          }
        }
        const points = p.comboTargetId === target.id ? p.comboPoints : 0;
        [...comboRow.children].forEach((pip, i) => pip.classList.toggle('on', i < points));
      } else {
        comboRow.style.display = 'none';
      }
    } else {
      tf.style.display = 'none';
      this.lastPortraitTarget = -999;
    }

    // cast bar
    const cb = $('#castbar');
    if (p.castingAbility) {
      cb.style.display = 'block';
      cb.classList.toggle('channel', p.channeling);
      const frac = p.channeling
        ? p.castRemaining / Math.max(0.01, p.castTotal)
        : 1 - p.castRemaining / Math.max(0.01, p.castTotal);
      (cb.querySelector('.fill') as HTMLElement).style.width = `${(frac * 100).toFixed(1)}%`;
      (cb.querySelector('.label') as HTMLElement).textContent = ABILITIES[p.castingAbility].name;
    } else if (p.consuming) {
      cb.style.display = 'block';
      cb.classList.add('channel');
      (cb.querySelector('.fill') as HTMLElement).style.width = `${((p.consuming.remaining / 18) * 100).toFixed(1)}%`;
      (cb.querySelector('.label') as HTMLElement).textContent = p.consuming.kind === 'food' ? 'Eating…' : 'Drinking…';
    } else {
      cb.style.display = 'none';
    }

    // action bar
    const tgtDist = target && !target.dead ? dist2d(p.pos, target.pos) : null;
    for (let i = 0; i < this.abilityButtons.length; i++) {
      const ab = this.abilityButtons[i];
      const known = sim.known[i];
      if (!known) {
        ab.btn.classList.add('empty');
        ab.label.textContent = '';
        ab.cdOverlay.style.height = '0%';
        ab.cdText.textContent = '';
        continue;
      }
      const a = known.def;
      ab.btn.classList.remove('empty');
      ab.label.textContent = a.icon;
      ab.label.style.color = a.iconColor;
      const cd = p.cooldowns.get(a.id) ?? 0;
      const gcdActive = !a.offGcd && p.gcdRemaining > 0;
      const shown = Math.max(cd, gcdActive ? p.gcdRemaining : 0);
      const denom = cd > 0 ? a.cooldown : GCD;
      ab.cdOverlay.style.height = shown > 0 ? `${Math.min(100, (shown / Math.max(0.01, denom)) * 100)}%` : '0%';
      ab.cdText.textContent = cd > 1 ? Math.ceil(cd).toString() : '';
      ab.btn.classList.toggle('unusable', p.resource < known.cost);
      const oor = a.requiresTarget && tgtDist !== null && tgtDist > (a.range > 0 ? a.range : MELEE_RANGE);
      ab.btn.classList.toggle('oor', !!oor);
      ab.btn.classList.toggle('queued', p.queuedOnSwing === a.id);
    }

    // xp bar
    const xpNeed = xpForLevel(p.level);
    const xpFrac = p.level >= MAX_LEVEL ? 1 : sim.xp / xpNeed;
    ($('#xpbar .fill') as HTMLElement).style.width = `${(xpFrac * 100).toFixed(1)}%`;
    $('#xpbar .label').textContent = p.level >= MAX_LEVEL ? 'MAX LEVEL' : `${sim.xp} / ${xpNeed} XP (${Math.floor(xpFrac * 100)}%)`;

    $('#death-overlay').style.display = p.dead ? 'flex' : 'none';

    this.updateQuestTracker();
    this.updatePartyFrames();
    this.updateTradeWindow();
    this.updateMinimap();
    if ($('#map-window').style.display === 'block') this.updateMapWindow();
    if (this.openLootMobId !== null) {
      const mob = sim.entities.get(this.openLootMobId);
      if (!mob || !mob.lootable || dist2d(p.pos, mob.pos) > 7) this.closeLoot();
    }
    if (this.openVendorNpcId !== null) {
      const npc = sim.entities.get(this.openVendorNpcId);
      if (!npc || dist2d(p.pos, npc.pos) > 8) this.closeVendor();
    }
  }

  private renderAuras(el: HTMLElement, e: Entity, mode: 'all' | 'debuffs'): void {
    // cheap diff: rebuild only when the aura set changes
    const sig = e.auras.map((a) => a.id + Math.ceil(a.remaining)).join('|');
    if ((el as any).__sig === sig) return;
    (el as any).__sig = sig;
    el.innerHTML = '';
    for (const a of e.auras) {
      const isDebuff = ['dot', 'slow', 'root', 'stun', 'incapacitate', 'polymorph', 'attackspeed'].includes(a.kind);
      if (mode === 'debuffs' && !isDebuff) continue;
      const d = document.createElement('div');
      d.className = 'buff' + (isDebuff ? ' debuff' : '');
      d.textContent = a.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const dur = document.createElement('div');
      dur.className = 'dur';
      dur.textContent = a.remaining < 99 ? `${Math.ceil(a.remaining)}s` : '';
      d.appendChild(dur);
      this.attachTooltip(d, () => `<div class="tt-title">${a.name}</div><div class="tt-sub">${Math.ceil(a.remaining)} seconds remaining</div>`);
      el.appendChild(d);
    }
  }

  private updateQuestTracker(): void {
    const el = $('#quest-tracker');
    let html = this.sim.questLog.size > 0 ? '<div class="qt-header">Quests</div>' : '';
    for (const qp of this.sim.questLog.values()) {
      const quest = QUESTS[qp.questId];
      html += `<div class="qt-title">${quest.name}${qp.state === 'ready' ? ' <span style="color:#7fdc4f">(Complete)</span>' : ''}</div>`;
      quest.objectives.forEach((obj, i) => {
        const done = qp.counts[i] >= obj.count;
        html += `<div class="qt-obj${done ? ' done' : ''}">- ${obj.label}: ${qp.counts[i]}/${obj.count}</div>`;
      });
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  // -------------------------------------------------------------------------
  // Minimap & world map
  // -------------------------------------------------------------------------

  private renderTerrainCanvas(N: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    const span = 360;
    const seed = this.sim.cfg.seed;
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const x = (ix / N - 0.5) * span;
        const z = -(iy / N - 0.5) * span;
        const h = terrainHeight(x, z, seed);
        let r = 58, g = 105, b = 48;
        if (h < WATER_LEVEL) { r = 38; g = 84; b = 138; }
        else if (h > 11) { r = 112; g = 110; b = 102; }
        else if (h > 6) { r = 88; g = 102; b = 62; }
        if (Math.sqrt(x * x + z * z) < 14) { r = 125; g = 100; b = 66; }
        else if (h >= WATER_LEVEL && roadDistance(x, z) < 2.4) { r = 138; g = 111; b = 71; }
        const k = (iy * N + ix) * 4;
        img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  private updateMinimap(): void {
    const ctx = this.minimapCtx;
    const S = 162;
    const p = this.sim.player;
    const span = 360;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const pxPerYard = 1.7;
    const bg = this.minimapBg;
    const bgPxPerYard = bg.width / span;
    const sw = S / (pxPerYard / bgPxPerYard);
    const sx = (p.pos.x + span / 2) * bgPxPerYard - sw / 2;
    const sy = (span / 2 - p.pos.z) * bgPxPerYard - sw / 2;
    ctx.drawImage(bg, sx, sy, sw, sw, 0, 0, S, S);

    for (const e of this.sim.entities.values()) {
      if (e.id === p.id) continue;
      const dx = (e.pos.x - p.pos.x) * pxPerYard;
      const dz = -(e.pos.z - p.pos.z) * pxPerYard;
      const mx = S / 2 + dx, my = S / 2 + dz;
      if ((mx - S / 2) ** 2 + (my - S / 2) ** 2 > (S / 2 - 7) ** 2) continue;
      if (e.kind === 'npc') {
        const hasAvail = e.questIds.some((q) => this.sim.questState(q) === 'available');
        const hasReady = e.questIds.some((q) => this.sim.questState(q) === 'ready');
        ctx.fillStyle = '#ffd100';
        ctx.font = 'bold 11px Georgia';
        ctx.fillText(hasReady ? '?' : hasAvail ? '!' : '•', mx - 2, my + 3);
      } else if (e.kind === 'object' && e.lootable) {
        ctx.fillStyle = '#ffe97a';
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      } else if (e.kind === 'mob' && !e.dead) {
        ctx.fillStyle = e.aggroTargetId === p.id ? '#ff8800' : '#e74c3c';
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      } else if (e.kind === 'mob' && e.lootable) {
        ctx.fillStyle = '#ffd100';
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    }
    // party members as bright blue blips
    const party = this.sim.partyInfo;
    if (party) {
      ctx.fillStyle = '#5fa8ff';
      for (const m of party.members) {
        if (m.pid === p.id) continue;
        const mx = S / 2 + (m.x - p.pos.x) * pxPerYard;
        const my = S / 2 - (m.z - p.pos.z) * pxPerYard;
        if ((mx - S / 2) ** 2 + (my - S / 2) ** 2 > (S / 2 - 7) ** 2) continue;
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.translate(S / 2, S / 2);
    ctx.rotate(p.facing);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(4.5, 5.5); ctx.lineTo(-4.5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  toggleMap(): void {
    const el = $('#map-window');
    if (el.style.display === 'block') { el.style.display = 'none'; return; }
    el.style.display = 'block';
    this.updateMapWindow();
  }

  private updateMapWindow(): void {
    const canvas = $('#map-canvas') as unknown as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const S = canvas.width;
    if (!this.mapBg) this.mapBg = this.renderTerrainCanvas(280);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapBg, 0, 0, S, S);
    const span = 360;
    const toMap = (x: number, z: number) => ({ mx: ((x + span / 2) / span) * S, my: ((span / 2 - z) / span) * S });
    // labels
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9a0';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const label = (x: number, z: number, text: string) => {
      const { mx, my } = toMap(x, z);
      ctx.strokeText(text, mx, my);
      ctx.fillText(text, mx, my);
    };
    label(0, -3, 'Eastbrook');
    label(-2, 70, 'Wolf Run');
    label(65, 0, 'Boar Meadow');
    label(-85, 78, 'Mirror Lake');
    label(-60, 4, 'Webwood');
    label(-84, -64, 'Copper Dig');
    label(76, -76, 'Bandit Camp');
    label(80, 84, 'Fallen Chapel');
    // npcs
    for (const e of this.sim.entities.values()) {
      if (e.kind !== 'npc') continue;
      const { mx, my } = toMap(e.pos.x, e.pos.z);
      const hasAvail = e.questIds.some((q) => this.sim.questState(q) === 'available');
      const hasReady = e.questIds.some((q) => this.sim.questState(q) === 'ready');
      if (hasAvail || hasReady) {
        ctx.fillStyle = '#ffd100';
        ctx.font = 'bold 15px Georgia';
        ctx.strokeText(hasReady ? '?' : '!', mx, my);
        ctx.fillText(hasReady ? '?' : '!', mx, my);
      }
    }
    // player
    const p = this.sim.player;
    const { mx, my } = toMap(p.pos.x, p.pos.z);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(p.facing);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Events -> log, FCT, audio, banners
  // -------------------------------------------------------------------------

  handleEvents(events: SimEvent[]): void {
    const sim = this.sim;
    for (const ev of events) {
      switch (ev.type) {
        case 'damage': {
          const src = sim.entities.get(ev.sourceId);
          const tgt = sim.entities.get(ev.targetId);
          if (!tgt) break;
          const isPlayerSource = ev.sourceId === sim.playerId;
          const isPlayerTarget = ev.targetId === sim.playerId;
          if (ev.kind === 'miss' || ev.kind === 'dodge') {
            this.fct(tgt, ev.kind === 'miss' ? 'Miss' : 'Dodge', isPlayerTarget ? '#bbb' : '#fff', false);
            if (isPlayerSource) {
              this.log(`Your ${ev.ability ?? 'attack'} ${ev.kind === 'miss' ? 'misses' : 'is dodged by'} ${tgt.name}.`, '#ccc');
              audio.meleeMiss();
            }
            break;
          }
          if (isPlayerSource && !isPlayerTarget) {
            const color = ev.ability ? '#ffe97a' : '#fff';
            this.fct(tgt, `${ev.amount}${ev.crit ? '!' : ''}`, color, ev.crit);
            this.log(`Your ${ev.ability ?? 'attack'} hits ${tgt.name} for ${ev.amount}${ev.crit ? ' (Critical)' : ''}.`, ev.ability ? '#ffe97a' : '#eee');
            if (src) this.renderer.triggerAttack(src.id);
            if (ev.school === 'fire') audio.fire();
            else if (ev.school === 'frost') audio.frost();
            else if (ev.school === 'arcane') audio.arcane();
            else audio.meleeHit(ev.crit);
          } else if (isPlayerTarget) {
            this.fct(tgt, `-${ev.amount}`, '#ff5544', ev.crit);
            this.log(`${src?.name ?? 'Something'} hits you for ${ev.amount}${ev.crit ? ' (Critical)' : ''}.`, '#ff8877');
            if (src && src.id !== sim.playerId) this.renderer.triggerAttack(src.id);
            audio.hitTaken();
          }
          break;
        }
        case 'heal': {
          if (ev.targetId === sim.playerId && ev.amount > 0) {
            this.fct(sim.player, `+${ev.amount}`, '#3ce63c', false);
          }
          break;
        }
        case 'death': {
          const e = sim.entities.get(ev.entityId);
          if (e && ev.entityId !== sim.playerId) this.log(`${e.name} dies.`, '#aaa');
          break;
        }
        case 'xp': {
          this.fct(sim.player, `+${ev.amount} XP`, '#b974ff', false);
          this.log(`You gain ${ev.amount} experience.`, '#a980d8');
          break;
        }
        case 'levelup': {
          this.showBanner(`Level ${ev.level}!`);
          this.log(`You have reached level ${ev.level}!`, '#ffd100');
          audio.levelUp();
          break;
        }
        case 'learnAbility': break; // logged by sim
        case 'comboPoint': break;
        case 'loot': {
          this.log(ev.text, '#7fdc4f');
          if (ev.text.includes('loot') || ev.text.includes('Sold')) audio.coin();
          else audio.lootItem();
          if ($('#bags').style.display === 'block') this.renderBags();
          break;
        }
        case 'vendor': {
          if ($('#bags').style.display === 'block') this.renderBags();
          if (this.openVendorNpcId !== null) this.renderVendor();
          break;
        }
        case 'error': this.showError(ev.text); break;
        case 'questAccepted': audio.questAccept(); break;
        case 'questProgress': this.log(ev.text, '#dcd29f'); break;
        case 'questReady': {
          const q = QUESTS[ev.questId];
          this.showBanner(`${q.name} (Complete)`);
          audio.questDone();
          break;
        }
        case 'questDone': audio.questDone(); break;
        case 'chat':
          if (ev.channel === 'party') this.log(`[Party] ${ev.from}: ${ev.text}`, '#7fd4ff');
          else this.log(`[${ev.from}]: ${ev.text}`, '#9adcf0');
          break;
        case 'heal2': {
          const tgt = sim.entities.get(ev.targetId);
          if (tgt && ev.amount > 0) {
            this.fct(tgt, `+${ev.amount}${ev.crit ? '!' : ''}`, '#3ce63c', ev.crit);
            if (ev.sourceId === sim.playerId) {
              this.log(`Your ${ev.ability} heals ${ev.targetId === sim.playerId ? 'you' : tgt.name} for ${ev.amount}${ev.crit ? ' (Critical)' : ''}.`, '#7fdc4f');
            }
          }
          break;
        }
        case 'partyInvite':
          audio.questAccept();
          this.showPrompt(`<b>${ev.fromName}</b> invites you to join their party.`, 'Join Party',
            () => this.sim.partyAccept(), () => this.sim.partyDecline());
          break;
        case 'tradeRequest':
          audio.click();
          this.showPrompt(`<b>${ev.fromName}</b> wants to trade with you.`, 'Open Trade',
            () => this.sim.tradeAccept(), () => { /* let it expire */ });
          break;
        case 'duelRequest':
          audio.aggro();
          this.showPrompt(`<b>${ev.fromName}</b> has challenged you to a duel!`, 'Accept Duel',
            () => this.sim.duelAccept(), () => this.sim.duelDecline());
          break;
        case 'duelCountdown':
          this.showBanner(`Duel begins in ${ev.seconds}…`);
          break;
        case 'duelEnd':
          this.showBanner(`${ev.winnerName} has defeated ${ev.loserName} in a duel!`);
          this.log(`${ev.winnerName} has defeated ${ev.loserName} in a duel.`, '#fa6');
          audio.levelUp();
          break;
        case 'log': this.log(ev.text, ev.color ?? '#ccc'); break;
        case 'playerDeath': {
          this.log('You have died.', '#ff4444');
          audio.death();
          break;
        }
        case 'respawn': this.log('You feel rested and whole again.', '#7fdc4f'); break;
        case 'castStart': {
          const a = ABILITIES[ev.ability];
          if (a?.school === 'fire') audio.castStart();
          else if (a?.school === 'frost') audio.castStart();
          else audio.castStart();
          break;
        }
        case 'castStop': break;
        case 'aura': {
          const tgt = sim.entities.get(ev.targetId);
          if (ev.name === 'Polymorph' && ev.gained) audio.sheep();
          if (ev.targetId === sim.playerId) {
            this.log(ev.gained ? `You gain ${ev.name}.` : `${ev.name} fades from you.`, '#d8a0d8');
          } else if (tgt && ev.gained) {
            this.log(`${tgt.name} is afflicted by ${ev.name}.`, '#d8a0d8');
          }
          break;
        }
      }
    }
  }

  log(text: string, color = '#ccc'): void {
    const div = document.createElement('div');
    div.textContent = text;
    div.style.color = color;
    this.logEl.appendChild(div);
    while (this.logEl.children.length > 11) this.logEl.removeChild(this.logEl.firstChild!);
  }

  private fct(target: Entity, text: string, color: string, crit: boolean): void {
    const v = this.renderer.worldToScreen(target.pos.x, target.pos.y + 2.2 * target.scale, target.pos.z);
    if (v.behind) return;
    const el = document.createElement('div');
    el.className = 'fct' + (crit ? ' crit' : '');
    el.style.color = color;
    el.style.left = `${v.x + (Math.random() * 30 - 15)}px`;
    el.style.top = `${v.y}px`;
    el.textContent = text;
    document.getElementById('ui')!.appendChild(el);
    setTimeout(() => el.remove(), 1250);
  }

  showError(text: string): void {
    this.errorEl.textContent = text;
    this.errorEl.style.opacity = '1';
    clearTimeout(this.errorTimer);
    this.errorTimer = window.setTimeout(() => { this.errorEl.style.opacity = '0'; }, 1600);
    audio.error();
  }

  showBanner(text: string): void {
    this.bannerEl.textContent = text;
    this.bannerEl.style.opacity = '1';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => { this.bannerEl.style.opacity = '0'; }, 2600);
  }

  // -------------------------------------------------------------------------
  // Quest dialog (gossip)
  // -------------------------------------------------------------------------

  openQuestDialog(npcId: number): void {
    const npc = this.sim.entities.get(npcId);
    if (!npc || npc.kind !== 'npc') return;
    this.renderGossip(npc);
  }

  private renderGossip(npc: Entity): void {
    const el = $('#quest-dialog');
    const def = NPCS[npc.templateId];
    const interesting = npc.questIds.filter((q) => ['available', 'active', 'ready'].includes(this.sim.questState(q)));
    let html = `<div class="panel-title"><span>${npc.name}<span style="color:#998d6a;font-size:11px"> &lt;${def?.title ?? ''}&gt;</span></span><span class="x-btn" data-close>✕</span></div>`;
    html += `<div class="qd-text">"${(def?.greeting ?? 'Greetings.').replace('$C', CLASSES[this.sim.cfg.playerClass].name.toLowerCase())}"</div>`;
    if (interesting.length > 0) {
      for (const qid of interesting) {
        const st = this.sim.questState(qid);
        const icon = st === 'ready' ? '<span class="gold">?</span> ' : st === 'available' ? '<span class="gold">!</span> ' : '<span style="color:#999">…</span> ';
        html += `<div class="qd-list-item" data-quest="${qid}">${icon}${QUESTS[qid].name}</div>`;
      }
    }
    if (npc.vendorItems.length > 0) {
      html += `<div class="qd-list-item" data-vendor="1"><span style="color:#9fdc7f">$</span> Let me browse your goods.</div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-quest]').forEach((item) => {
      item.addEventListener('click', () => this.renderQuestDetail(npc, (item as HTMLElement).dataset.quest!));
    });
    el.querySelector('[data-vendor]')?.addEventListener('click', () => {
      this.closeQuestDialog();
      this.openVendor(npc.id);
    });
    el.querySelector('[data-close]')?.addEventListener('click', () => this.closeQuestDialog());
    el.style.display = 'block';
  }

  private renderQuestDetail(npc: Entity, questId: string): void {
    const el = $('#quest-dialog');
    const quest = QUESTS[questId];
    const state = this.sim.questState(questId);
    const text = (state === 'ready' ? quest.completionText : quest.text).replace(/\$N/g, this.sim.player.name);
    let html = `<div class="panel-title"><span>${quest.name}${quest.suggestedPlayers ? ` <span style="color:#f96;font-size:11px">(Suggested players: ${quest.suggestedPlayers})</span>` : ''}</span><span class="x-btn" data-close>✕</span></div>`;
    html += `<div class="qd-text">${text}</div>`;
    if (state !== 'ready') {
      const qp = this.sim.questLog.get(questId);
      html += `<div class="qd-sub">Objectives</div>`;
      html += quest.objectives.map((o, i) => `<div class="qd-obj">&bull; ${o.label}: ${qp ? Math.min(qp.counts[i], o.count) : 0}/${o.count}</div>`).join('');
    }
    html += `<div class="qd-sub">Rewards</div>`;
    html += `<div class="qd-obj">${quest.xpReward} experience &nbsp; ${this.moneyHtml(quest.copperReward)}</div>`;
    const rewardItem = quest.itemRewards[this.sim.cfg.playerClass];
    if (rewardItem) {
      const item = ITEMS[rewardItem];
      html += `<div class="qd-reward-row" data-reward>${this.itemIcon(item)}<span style="color:${item.quality === 'uncommon' ? '#1eff00' : '#fff'};font-size:12px">${item.name}</span></div>`;
    }
    el.innerHTML = html;
    const rewardRow = el.querySelector('[data-reward]') as HTMLElement | null;
    if (rewardRow && rewardItem) this.attachTooltip(rewardRow, () => this.itemTooltip(ITEMS[rewardItem]));

    if (state === 'available') {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Accept';
      btn.addEventListener('click', () => { this.sim.acceptQuest(questId); this.renderGossip(npc); });
      el.appendChild(btn);
    } else if (state === 'ready') {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Complete Quest';
      btn.addEventListener('click', () => { this.sim.turnInQuest(questId); this.renderGossip(npc); });
      el.appendChild(btn);
    }
    const back = document.createElement('button');
    back.className = 'btn';
    back.textContent = 'Back';
    back.addEventListener('click', () => this.renderGossip(npc));
    el.appendChild(back);
    el.querySelector('[data-close]')?.addEventListener('click', () => this.closeQuestDialog());
    el.style.display = 'block';
  }

  closeQuestDialog(): void {
    $('#quest-dialog').style.display = 'none';
    this.hideTooltip();
  }

  // -------------------------------------------------------------------------
  // Loot window
  // -------------------------------------------------------------------------

  openLoot(mobId: number, screenX: number, screenY: number): void {
    const mob = this.sim.entities.get(mobId);
    if (!mob?.loot) return;
    this.openLootMobId = mobId;
    const el = $('#loot-window');
    let html = `<div class="panel-title"><span>${mob.name}</span><span class="x-btn" data-close>✕</span></div>`;
    if (mob.loot.copper > 0) {
      html += `<div class="loot-item"><div class="item-icon q-common" style="color:#ffd100">$</div><span>${this.moneyHtml(mob.loot.copper)}</span></div>`;
    }
    for (const s of mob.loot.items) {
      const item = ITEMS[s.itemId];
      html += `<div class="loot-item" data-item="${s.itemId}">${this.itemIcon(item)}<span style="font-size:12px">${item.name}${s.count > 1 ? ' x' + s.count : ''}</span></div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-item]').forEach((row) => {
      const itemId = (row as HTMLElement).dataset.item!;
      this.attachTooltip(row as HTMLElement, () => this.itemTooltip(ITEMS[itemId]));
    });
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Take All';
    btn.addEventListener('click', () => { this.sim.lootCorpse(mobId); this.closeLoot(); });
    el.appendChild(btn);
    el.querySelector('[data-close]')?.addEventListener('click', () => this.closeLoot());
    el.style.left = `${Math.min(window.innerWidth - 260, Math.max(10, screenX - 115))}px`;
    el.style.top = `${Math.min(window.innerHeight - 280, Math.max(10, screenY - 30))}px`;
    el.style.display = 'block';
  }

  closeLoot(): void {
    $('#loot-window').style.display = 'none';
    this.openLootMobId = null;
    this.hideTooltip();
  }

  // -------------------------------------------------------------------------
  // Vendor
  // -------------------------------------------------------------------------

  openVendor(npcId: number): void {
    this.openVendorNpcId = npcId;
    this.renderVendor();
    this.renderBags();
    $('#bags').style.display = 'block';
  }

  private renderVendor(): void {
    if (this.openVendorNpcId === null) return;
    const npc = this.sim.entities.get(this.openVendorNpcId);
    if (!npc) return;
    const el = $('#vendor-window');
    let html = `<div class="panel-title"><span>${npc.name} — Goods</span><span class="x-btn" data-close>✕</span></div>`;
    el.innerHTML = html;
    for (const itemId of npc.vendorItems) {
      const item = ITEMS[itemId];
      if (!item?.buyValue) continue;
      const row = document.createElement('div');
      row.className = 'vendor-item';
      row.innerHTML = `${this.itemIcon(item)}<span class="vi-name">${item.name}</span><span class="vi-price">${this.moneyHtml(item.buyValue)}</span>`;
      row.addEventListener('click', () => {
        this.sim.buyItem(npc.id, itemId);
      });
      this.attachTooltip(row, () => this.itemTooltip(item) + '<div class="tt-sub">Click to buy</div>');
      el.appendChild(row);
    }
    const hint = document.createElement('div');
    hint.className = 'vendor-hint';
    hint.textContent = 'Click an item in your bags to sell it while this window is open.';
    el.appendChild(hint);
    el.querySelector('[data-close]')?.addEventListener('click', () => this.closeVendor());
    el.style.display = 'block';
  }

  closeVendor(): void {
    $('#vendor-window').style.display = 'none';
    this.openVendorNpcId = null;
    this.hideTooltip();
    if ($('#bags').style.display === 'block') this.renderBags();
  }

  get vendorOpen(): boolean {
    return this.openVendorNpcId !== null;
  }

  // -------------------------------------------------------------------------
  // Bags
  // -------------------------------------------------------------------------

  toggleBags(): void {
    const el = $('#bags');
    if (el.style.display === 'block') { el.style.display = 'none'; this.hideTooltip(); return; }
    this.renderBags();
    el.style.display = 'block';
  }

  renderBags(): void {
    const el = $('#bags');
    const sim = this.sim;
    el.innerHTML = `<div class="panel-title"><span>Bags</span><span class="x-btn" data-close>✕</span></div>`;
    const grid = document.createElement('div');
    grid.className = 'bag-grid';
    if (sim.inventory.length === 0) {
      grid.innerHTML = `<div style="font-size:12px;color:#887c5c;padding:6px">Your bags are empty.</div>`;
    }
    for (const s of [...sim.inventory]) {
      const item = ITEMS[s.itemId];
      if (!item) continue;
      const row = document.createElement('div');
      row.className = 'bag-item';
      const qColor = item.quality === 'poor' ? '#9d9d9d' : item.quality === 'uncommon' ? '#1eff00' : '#fff';
      row.innerHTML = `${this.itemIcon(item)}<span style="color:${qColor}">${item.name}</span><span class="bi-count">${s.count > 1 ? 'x' + s.count : ''}</span>`;
      row.addEventListener('click', () => {
        if (this.tradeOpen) {
          this.addItemToTrade(s.itemId);
        } else if (this.vendorOpen) {
          this.sim.sellItem(s.itemId);
        } else {
          this.sim.useItem(s.itemId);
          this.renderBags();
        }
      });
      this.attachTooltip(row, () => {
        let extra = '';
        if (this.tradeOpen) extra = '<div class="tt-sub">Click to offer in trade</div>';
        else if (this.vendorOpen) extra = '<div class="tt-sub">Click to sell</div>';
        else if (item.kind === 'weapon' || item.kind === 'armor') extra = '<div class="tt-sub">Click to equip</div>';
        else if (item.kind === 'food' || item.kind === 'drink') extra = '<div class="tt-sub">Click to consume</div>';
        return this.itemTooltip(item) + extra;
      });
      grid.appendChild(row);
    }
    el.appendChild(grid);
    const money = document.createElement('div');
    money.className = 'money';
    money.innerHTML = this.moneyHtml(sim.copper);
    el.appendChild(money);
    el.querySelector('[data-close]')?.addEventListener('click', () => { el.style.display = 'none'; this.hideTooltip(); });
  }

  // -------------------------------------------------------------------------
  // Character window
  // -------------------------------------------------------------------------

  toggleChar(): void {
    const el = $('#char-window');
    if (el.style.display === 'block') { el.style.display = 'none'; this.hideTooltip(); return; }
    this.renderChar();
    el.style.display = 'block';
  }

  renderChar(): void {
    const el = $('#char-window');
    const sim = this.sim;
    const p = sim.player;
    const cls = CLASSES[sim.cfg.playerClass];
    let html = `<div class="panel-title"><span>${p.name} <span style="color:#998d6a;font-size:11px">Level ${p.level} ${cls.name}</span></span><span class="x-btn" data-close>✕</span></div>`;
    html += `<div class="paperdoll"><div class="equip-col" id="equip-col"></div></div>`;
    const wpn = sim.equipment.mainhand ? ITEMS[sim.equipment.mainhand] : null;
    const dps = wpn?.weapon ? ((wpn.weapon.min + wpn.weapon.max) / 2 + (p.attackPower / 14) * wpn.weapon.speed) / wpn.weapon.speed : 0;
    html += `<div class="char-stats">
      <span>Strength: <b>${p.stats.str}</b></span><span>Armor: <b>${p.stats.armor}</b></span>
      <span>Agility: <b>${p.stats.agi}</b></span><span>Attack Power: <b>${p.attackPower}</b></span>
      <span>Stamina: <b>${p.stats.sta}</b></span><span>Damage/sec: <b>${dps.toFixed(1)}</b></span>
      <span>Intellect: <b>${p.stats.int}</b></span><span>Crit Chance: <b>${(p.critChance * 100).toFixed(1)}%</b></span>
      <span>Spirit: <b>${p.stats.spi}</b></span><span>Dodge: <b>${(p.dodgeChance * 100).toFixed(1)}%</b></span>
    </div>`;
    el.innerHTML = html;
    const col = el.querySelector('#equip-col')!;
    const slots: { key: 'mainhand' | 'chest' | 'legs' | 'feet'; name: string }[] = [
      { key: 'mainhand', name: 'Main Hand' },
      { key: 'chest', name: 'Chest' },
      { key: 'legs', name: 'Legs' },
      { key: 'feet', name: 'Feet' },
    ];
    for (const slot of slots) {
      const itemId = sim.equipment[slot.key];
      const item = itemId ? ITEMS[itemId] : null;
      const row = document.createElement('div');
      row.className = 'equip-slot';
      const qColor = !item ? '#666' : item.quality === 'uncommon' ? '#1eff00' : '#fff';
      row.innerHTML = `${item ? this.itemIcon(item) : '<div class="item-icon" style="border-color:#444;background:#0d0d13"></div>'}
        <div><div class="slot-name">${slot.name}</div><div class="slot-item" style="color:${qColor}">${item ? item.name : 'Empty'}</div></div>`;
      if (item) this.attachTooltip(row, () => this.itemTooltip(item));
      col.appendChild(row);
    }
    el.querySelector('[data-close]')?.addEventListener('click', () => { el.style.display = 'none'; this.hideTooltip(); });
  }

  // -------------------------------------------------------------------------
  // Spellbook
  // -------------------------------------------------------------------------

  toggleSpellbook(): void {
    const el = $('#spellbook');
    if (el.style.display === 'block') { el.style.display = 'none'; this.hideTooltip(); return; }
    this.renderSpellbook();
    el.style.display = 'block';
  }

  renderSpellbook(): void {
    const el = $('#spellbook');
    const sim = this.sim;
    el.innerHTML = `<div class="panel-title"><span>Spellbook</span><span class="x-btn" data-close>✕</span></div>`;
    const cls = CLASSES[sim.cfg.playerClass];
    for (const abilityId of cls.abilities) {
      const def = ABILITIES[abilityId];
      const known = sim.known.find((k) => k.def.id === abilityId) ?? null;
      const row = document.createElement('div');
      row.className = 'spell-row';
      const locked = !known;
      row.innerHTML = `<div class="spell-icon" style="color:${def.iconColor};${locked ? 'filter:grayscale(1) brightness(0.5)' : ''}">${def.icon}</div>
        <div><div class="spell-name" style="${locked ? 'color:#777' : ''}">${def.name}${known && known.rank > 1 ? ` <span style="color:#998d6a;font-size:11px">Rank ${known.rank}</span>` : ''}</div>
        <div class="spell-sub">${locked ? `Trainable at level ${def.learnLevel}` : describeCost(known!, sim)}</div></div>`;
      if (known) this.attachTooltip(row, () => this.abilityTooltip(known));
      else this.attachTooltip(row, () => `<div class="tt-title" style="color:#999">${def.name}</div><div class="tt-sub">You will learn this at level ${def.learnLevel}.</div>`);
      el.appendChild(row);
    }
    el.querySelector('[data-close]')?.addEventListener('click', () => { el.style.display = 'none'; this.hideTooltip(); });
  }

  // -------------------------------------------------------------------------
  // Quest log window
  // -------------------------------------------------------------------------

  toggleQuestLog(): void {
    const el = $('#quest-log-window');
    if (el.style.display === 'block') { el.style.display = 'none'; this.hideTooltip(); return; }
    this.renderQuestLog();
    el.style.display = 'block';
  }

  renderQuestLog(): void {
    const el = $('#quest-log-window');
    const sim = this.sim;
    el.innerHTML = `<div class="panel-title"><span>Quest Log <span style="color:#998d6a;font-size:11px">${sim.questLog.size} active &middot; ${sim.questsDone.size} completed</span></span><span class="x-btn" data-close>✕</span></div>`;
    const cols = document.createElement('div');
    cols.className = 'ql-cols';
    const list = document.createElement('div');
    list.className = 'ql-list';
    const detail = document.createElement('div');
    detail.className = 'ql-detail';
    cols.append(list, detail);
    el.appendChild(cols);

    const quests = [...sim.questLog.values()];
    if (quests.length === 0) {
      list.innerHTML = '<div style="color:#887c5c;font-size:12px;padding:4px">No active quests.</div>';
      detail.innerHTML = '<div class="qd-text">Seek out townsfolk marked with <span class="gold">!</span> to find work.</div>';
    }
    if (!this.selectedQuestLogId || !sim.questLog.has(this.selectedQuestLogId)) {
      this.selectedQuestLogId = quests[0]?.questId ?? null;
    }
    for (const qp of quests) {
      const quest = QUESTS[qp.questId];
      const item = document.createElement('div');
      item.className = 'ql-item' + (qp.questId === this.selectedQuestLogId ? ' sel' : '');
      item.textContent = `${quest.name}${qp.state === 'ready' ? ' ✓' : ''}`;
      item.addEventListener('click', () => { this.selectedQuestLogId = qp.questId; this.renderQuestLog(); });
      list.appendChild(item);
    }
    if (this.selectedQuestLogId) {
      const qp = sim.questLog.get(this.selectedQuestLogId)!;
      const quest = QUESTS[this.selectedQuestLogId];
      let html = `<div class="qd-sub" style="font-size:15px">${quest.name}${quest.suggestedPlayers ? ` <span style="color:#f96;font-size:11px">(Suggested players: ${quest.suggestedPlayers})</span>` : ''}</div>`;
      html += quest.objectives.map((o, i) => `<div class="qd-obj" style="color:${qp.counts[i] >= o.count ? '#7fdc4f' : '#cfc6a8'}">&bull; ${o.label}: ${qp.counts[i]}/${o.count}</div>`).join('');
      html += `<div class="qd-text" style="margin-top:8px">${quest.text.replace(/\$N/g, sim.player.name)}</div>`;
      html += `<div class="qd-sub">Rewards</div><div class="qd-obj">${quest.xpReward} experience &nbsp; ${this.moneyHtml(quest.copperReward)}</div>`;
      const giver = NPCS[quest.turnInNpcId];
      html += `<div class="qd-obj" style="margin-top:6px;color:#998d6a">Return to ${giver?.name ?? '?'}</div>`;
      detail.innerHTML = html;
      const abandon = document.createElement('button');
      abandon.className = 'btn';
      abandon.textContent = 'Abandon Quest';
      abandon.addEventListener('click', () => { sim.abandonQuest(this.selectedQuestLogId!); this.renderQuestLog(); });
      detail.appendChild(abandon);
    }
    el.querySelector('[data-close]')?.addEventListener('click', () => { el.style.display = 'none'; });
  }

  // -------------------------------------------------------------------------
  // Party frames
  // -------------------------------------------------------------------------

  private updatePartyFrames(): void {
    const el = $('#party-frames');
    const info = this.sim.partyInfo;
    if (!info) {
      if (el.innerHTML !== '') el.innerHTML = '';
      this.lastPartySig = '';
      return;
    }
    const others = info.members.filter((m) => m.pid !== this.sim.playerId);
    const sig = others.map((m) => `${m.pid}:${m.hp}/${m.mhp}:${m.res}:${m.dead}:${m.level}`).join('|') + `L${info.leader}`;
    if (sig === this.lastPartySig) return;
    this.lastPartySig = sig;
    el.innerHTML = '';
    for (const m of others) {
      const frame = document.createElement('div');
      frame.className = 'party-frame panel' + (m.dead ? ' dead' : '');
      const resClass = m.rtype === 'rage' ? 'rage' : m.rtype === 'energy' ? 'energy' : 'mana';
      frame.innerHTML = `
        <div class="pfm-name"><span>${CLASS_GLYPH[m.cls] ?? ''} ${m.name}</span><span class="lead">${info.leader === m.pid ? '★' : ''} ${m.level}</span></div>
        <div class="bar hp"><div class="bar-fill" style="transform:scaleX(${(m.hp / Math.max(1, m.mhp)).toFixed(3)})"></div></div>
        <div class="bar ${resClass}"><div class="bar-fill" style="transform:scaleX(${(m.res / Math.max(1, m.mres)).toFixed(3)})"></div></div>`;
      frame.addEventListener('click', () => this.sim.targetEntity(m.pid));
      frame.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        this.openContextMenu(m.pid, m.name, ev.clientX, ev.clientY);
      });
      el.appendChild(frame);
    }
    const leave = document.createElement('button');
    leave.className = 'btn';
    leave.id = 'party-leave';
    leave.textContent = 'Leave Party';
    leave.addEventListener('click', () => this.sim.partyLeave());
    el.appendChild(leave);
  }

  // -------------------------------------------------------------------------
  // Context menu on players
  // -------------------------------------------------------------------------

  openContextMenu(pid: number, name: string, x: number, y: number): void {
    const el = $('#ctx-menu');
    const party = this.sim.partyInfo;
    const isLeader = party?.leader === this.sim.playerId;
    const isMember = !!party?.members.some((m) => m.pid === pid);
    let html = `<div class="ctx-title">${name}</div>`;
    if (!isMember) html += `<div class="ctx-item" data-act="invite">Invite to Party</div>`;
    html += `<div class="ctx-item" data-act="trade">Trade</div>`;
    html += `<div class="ctx-item" data-act="duel">Challenge to a Duel</div>`;
    if (isLeader && isMember && pid !== this.sim.playerId) html += `<div class="ctx-item" data-act="kick">Remove from Party</div>`;
    html += `<div class="ctx-item" data-act="close">Cancel</div>`;
    el.innerHTML = html;
    el.style.left = `${Math.min(window.innerWidth - 170, x)}px`;
    el.style.top = `${Math.min(window.innerHeight - 200, y)}px`;
    el.style.display = 'block';
    el.querySelectorAll('.ctx-item').forEach((item) => {
      item.addEventListener('click', () => {
        const act = (item as HTMLElement).dataset.act;
        el.style.display = 'none';
        if (act === 'invite') this.sim.partyInvite(pid);
        else if (act === 'trade') this.sim.tradeRequest(pid);
        else if (act === 'duel') this.sim.duelRequest(pid);
        else if (act === 'kick') this.sim.partyKick(pid);
      });
    });
  }

  closeContextMenu(): void {
    $('#ctx-menu').style.display = 'none';
  }

  // -------------------------------------------------------------------------
  // Prompts (party invite / trade request / duel challenge)
  // -------------------------------------------------------------------------

  private showPrompt(text: string, acceptLabel: string, onAccept: () => void, onDecline: () => void): void {
    const stack = $('#prompt-stack');
    const prompt = document.createElement('div');
    prompt.className = 'prompt panel';
    prompt.innerHTML = `<div class="prompt-text">${text}</div>`;
    const accept = document.createElement('button');
    accept.className = 'btn';
    accept.textContent = acceptLabel;
    const decline = document.createElement('button');
    decline.className = 'btn';
    decline.textContent = 'Decline';
    accept.addEventListener('click', () => { prompt.remove(); onAccept(); });
    decline.addEventListener('click', () => { prompt.remove(); onDecline(); });
    prompt.append(accept, decline);
    stack.appendChild(prompt);
    window.setTimeout(() => { if (prompt.isConnected) { prompt.remove(); onDecline(); } }, 28000);
  }

  // -------------------------------------------------------------------------
  // Trade window
  // -------------------------------------------------------------------------

  get tradeOpen(): boolean {
    return this.sim.tradeInfo !== null;
  }

  addItemToTrade(itemId: string): void {
    if (!this.tradeOpen || this.stagedTrade.items.length >= 6) return;
    const existing = this.stagedTrade.items.find((s) => s.itemId === itemId);
    const have = this.sim.inventory.find((s) => s.itemId === itemId)?.count ?? 0;
    if (existing) {
      if (existing.count < have) existing.count++;
    } else {
      this.stagedTrade.items.push({ itemId, count: 1 });
    }
    this.pushTradeOffer();
  }

  private pushTradeOffer(): void {
    this.sim.tradeSetOffer(this.stagedTrade.items, this.stagedTrade.copper);
  }

  private updateTradeWindow(): void {
    const el = $('#trade-window');
    const info = this.sim.tradeInfo;
    if (!info) {
      if (this.tradeWasOpen) {
        el.style.display = 'none';
        this.tradeWasOpen = false;
        this.stagedTrade = { items: [], copper: 0 };
        this.lastTradeSig = '';
      }
      return;
    }
    if (!this.tradeWasOpen) {
      this.tradeWasOpen = true;
      this.stagedTrade = { items: [], copper: 0 };
      this.renderBags();
      $('#bags').style.display = 'block';
    }
    const sig = JSON.stringify([info.myOffer, info.theirOffer, info.myAccepted, info.theirAccepted, this.stagedTrade]);
    if (sig === this.lastTradeSig) return;
    this.lastTradeSig = sig;

    const itemRow = (s: InvSlot, mine: boolean) => {
      const item = ITEMS[s.itemId];
      return `<div class="trade-item${mine ? ' mine' : ''}" data-item="${mine ? s.itemId : ''}">${this.itemIcon(item)}<span>${item?.name ?? s.itemId}${s.count > 1 ? ' x' + s.count : ''}</span></div>`;
    };
    el.innerHTML = `
      <div class="panel-title"><span>Trade with ${info.otherName}</span><span class="x-btn" data-close>✕</span></div>
      <div class="trade-cols">
        <div class="trade-col ${info.myAccepted ? 'accepted' : ''}">
          <h4>Your offer</h4>
          <div class="trade-items">${info.myOffer.items.map((s) => itemRow(s, true)).join('') || '<div style="color:#665c40;font-size:11px;padding:4px">Click items in your bags to add them</div>'}</div>
          <div class="trade-money">Money: <input id="trade-copper" type="number" min="0" value="${this.stagedTrade.copper}" /> copper</div>
        </div>
        <div class="trade-col ${info.theirAccepted ? 'accepted' : ''}">
          <h4>${info.otherName}'s offer</h4>
          <div class="trade-items">${info.theirOffer.items.map((s) => itemRow(s, false)).join('') || '<div style="color:#665c40;font-size:11px;padding:4px">Nothing offered yet</div>'}</div>
          <div class="trade-money">Money: <span class="gold">${formatMoney(info.theirOffer.copper)}</span></div>
        </div>
      </div>
      <div class="trade-hint">Click an offered item to remove it. Both sides must press Accept Trade.</div>`;
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn';
    acceptBtn.textContent = info.myAccepted ? 'Waiting…' : 'Accept Trade';
    acceptBtn.disabled = info.myAccepted;
    acceptBtn.addEventListener('click', () => this.sim.tradeConfirm());
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.sim.tradeCancel());
    el.append(acceptBtn, cancelBtn);
    el.querySelector('[data-close]')?.addEventListener('click', () => this.sim.tradeCancel());
    el.querySelectorAll('.trade-item.mine').forEach((row) => {
      row.addEventListener('click', () => {
        const itemId = (row as HTMLElement).dataset.item!;
        const idx = this.stagedTrade.items.findIndex((s) => s.itemId === itemId);
        if (idx >= 0) {
          this.stagedTrade.items[idx].count--;
          if (this.stagedTrade.items[idx].count <= 0) this.stagedTrade.items.splice(idx, 1);
          this.pushTradeOffer();
        }
      });
    });
    const copperInput = el.querySelector('#trade-copper') as HTMLInputElement;
    copperInput?.addEventListener('change', () => {
      this.stagedTrade.copper = Math.max(0, Math.floor(Number(copperInput.value) || 0));
      this.pushTradeOffer();
    });
    el.style.display = 'block';
  }

  // -------------------------------------------------------------------------

  // Closes the topmost UI. Returns true if something was closed.
  closeAll(): boolean {
    let closed = false;
    this.closeContextMenu();
    if (this.tradeOpen) {
      this.sim.tradeCancel();
      closed = true;
    }
    for (const id of ['#quest-dialog', '#loot-window', '#vendor-window', '#bags', '#char-window', '#spellbook', '#quest-log-window', '#map-window']) {
      const el = $(id);
      if (el.style.display === 'block') {
        el.style.display = 'none';
        closed = true;
      }
    }
    if (closed) {
      this.openLootMobId = null;
      this.openVendorNpcId = null;
      this.hideTooltip();
    }
    return closed;
  }
}

function describeCost(known: ResolvedAbility, sim: IWorld): string {
  const resName = sim.player.resourceType === 'rage' ? 'Rage' : sim.player.resourceType === 'energy' ? 'Energy' : 'Mana';
  const parts: string[] = [];
  if (known.cost > 0) parts.push(`${known.cost} ${resName}`);
  parts.push(known.def.channel ? 'Channeled' : known.castTime > 0 ? `${known.castTime}s cast` : 'Instant');
  if (known.def.cooldown > 0) parts.push(`${known.def.cooldown}s cooldown`);
  return parts.join(' · ');
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `rgb(${r},${g},${b})`;
}
