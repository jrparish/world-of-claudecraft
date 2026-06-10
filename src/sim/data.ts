import type { AbilityDef, ItemDef, MobTemplate, PlayerClass, QuestDef, Stats, WeaponInfo } from './types';

// ---------------------------------------------------------------------------
// Player classes — per-level base stats follow vanilla growth curves.
// HP/mana rules are the real ones: first 20 stamina gives 1 hp each, the rest
// 10 hp each; first 20 intellect gives 1 mana each, the rest 15 mana each.
// ---------------------------------------------------------------------------

export interface ClassDef {
  id: PlayerClass;
  name: string;
  baseStats: Stats;
  statsPerLevel: Stats;
  baseHp: number; // class hp before stamina at level 1
  hpPerLevel: number;
  baseMana: number;
  manaPerLevel: number;
  resourceType: 'rage' | 'mana' | 'energy';
  startWeapon: string;
  startChest: string;
  ranged?: WeaponInfo & { maxRange: number; minRange: number }; // hunters: auto shot
  abilities: string[]; // full kit, in learn order
  color: number;
  crest: string; // portrait glyph
}

export const CLASSES: Record<PlayerClass, ClassDef> = {
  warrior: {
    id: 'warrior',
    name: 'Warrior',
    baseStats: { str: 23, agi: 20, sta: 22, int: 10, spi: 11, armor: 50 },
    statsPerLevel: { str: 2, agi: 1, sta: 2, int: 0, spi: 0, armor: 12 },
    baseHp: 50,
    hpPerLevel: 18,
    baseMana: 100, // rage cap
    manaPerLevel: 0,
    resourceType: 'rage',
    startWeapon: 'worn_sword',
    startChest: 'recruit_tunic',
    abilities: ['heroic_strike', 'battle_shout', 'charge', 'rend', 'thunder_clap', 'hamstring', 'bloodrage', 'overpower'],
    color: 0xc79c6e,
    crest: '⚔',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    baseStats: { str: 10, agi: 12, sta: 14, int: 24, spi: 22, armor: 25 },
    statsPerLevel: { str: 0, agi: 0, sta: 1, int: 3, spi: 2, armor: 4 },
    baseHp: 40,
    hpPerLevel: 12,
    baseMana: 100,
    manaPerLevel: 24,
    resourceType: 'mana',
    startWeapon: 'gnarled_staff',
    startChest: 'apprentice_robe',
    abilities: ['fireball', 'frost_armor', 'arcane_intellect', 'frostbolt', 'conjure_water', 'fire_blast', 'arcane_missiles', 'polymorph', 'frost_nova'],
    color: 0x69ccf0,
    crest: '✦',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    baseStats: { str: 17, agi: 25, sta: 17, int: 11, spi: 12, armor: 40 },
    statsPerLevel: { str: 1, agi: 3, sta: 1, int: 0, spi: 0, armor: 8 },
    baseHp: 45,
    hpPerLevel: 15,
    baseMana: 100, // energy cap
    manaPerLevel: 0,
    resourceType: 'energy',
    startWeapon: 'rusty_dagger',
    startChest: 'footpad_jerkin',
    abilities: ['sinister_strike', 'eviscerate', 'backstab', 'gouge', 'evasion', 'slice_and_dice', 'sprint'],
    color: 0xfff569,
    crest: '⚷',
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    baseStats: { str: 22, agi: 17, sta: 22, int: 13, spi: 14, armor: 45 },
    statsPerLevel: { str: 2, agi: 1, sta: 2, int: 1, spi: 1, armor: 12 },
    baseHp: 55,
    hpPerLevel: 17,
    baseMana: 80,
    manaPerLevel: 20,
    resourceType: 'mana',
    startWeapon: 'training_mace',
    startChest: 'recruit_tunic',
    abilities: ['seal_of_righteousness', 'holy_light', 'devotion_aura', 'judgement', 'blessing_of_might', 'divine_protection', 'hammer_of_justice', 'lay_on_hands'],
    color: 0xf58cba,
    crest: '🔨',
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter',
    baseStats: { str: 14, agi: 25, sta: 19, int: 13, spi: 14, armor: 45 },
    statsPerLevel: { str: 1, agi: 3, sta: 2, int: 1, spi: 1, armor: 8 },
    baseHp: 50,
    hpPerLevel: 15,
    baseMana: 80,
    manaPerLevel: 18,
    resourceType: 'mana',
    startWeapon: 'rusty_hatchet',
    startChest: 'footpad_jerkin',
    ranged: { min: 5, max: 9, speed: 2.3, maxRange: 35, minRange: 8 },
    abilities: ['raptor_strike', 'aspect_of_the_hawk', 'serpent_sting', 'arcane_shot', 'concussive_shot', 'mongoose_bite', 'wing_clip'],
    color: 0xabd473,
    crest: '🏹',
  },
  priest: {
    id: 'priest',
    name: 'Priest',
    baseStats: { str: 10, agi: 11, sta: 13, int: 22, spi: 24, armor: 20 },
    statsPerLevel: { str: 0, agi: 0, sta: 1, int: 2, spi: 3, armor: 4 },
    baseHp: 38,
    hpPerLevel: 11,
    baseMana: 110,
    manaPerLevel: 26,
    resourceType: 'mana',
    startWeapon: 'gnarled_staff',
    startChest: 'apprentice_robe',
    abilities: ['smite', 'lesser_heal', 'power_word_fortitude', 'shadow_word_pain', 'power_word_shield', 'renew', 'mind_blast'],
    color: 0xfffff0,
    crest: '✝',
  },
  shaman: {
    id: 'shaman',
    name: 'Shaman',
    baseStats: { str: 18, agi: 16, sta: 20, int: 18, spi: 18, armor: 40 },
    statsPerLevel: { str: 1, agi: 1, sta: 2, int: 2, spi: 2, armor: 10 },
    baseHp: 48,
    hpPerLevel: 15,
    baseMana: 90,
    manaPerLevel: 22,
    resourceType: 'mana',
    startWeapon: 'training_mace',
    startChest: 'footpad_jerkin',
    abilities: ['lightning_bolt', 'rockbiter_weapon', 'healing_wave', 'earth_shock', 'lightning_shield', 'flame_shock'],
    color: 0x0070de,
    crest: '🌩',
  },
  warlock: {
    id: 'warlock',
    name: 'Warlock',
    baseStats: { str: 11, agi: 12, sta: 15, int: 21, spi: 21, armor: 22 },
    statsPerLevel: { str: 0, agi: 0, sta: 1, int: 3, spi: 2, armor: 4 },
    baseHp: 42,
    hpPerLevel: 12,
    baseMana: 105,
    manaPerLevel: 25,
    resourceType: 'mana',
    startWeapon: 'gnarled_staff',
    startChest: 'apprentice_robe',
    abilities: ['shadow_bolt', 'demon_skin', 'immolate', 'corruption', 'life_tap', 'curse_of_agony', 'drain_life'],
    color: 0x9482c9,
    crest: '🕯',
  },
  druid: {
    id: 'druid',
    name: 'Druid',
    baseStats: { str: 15, agi: 15, sta: 17, int: 19, spi: 20, armor: 30 },
    statsPerLevel: { str: 1, agi: 1, sta: 2, int: 2, spi: 2, armor: 6 },
    baseHp: 45,
    hpPerLevel: 13,
    baseMana: 95,
    manaPerLevel: 22,
    resourceType: 'mana',
    startWeapon: 'gnarled_staff',
    startChest: 'footpad_jerkin',
    abilities: ['wrath', 'healing_touch', 'mark_of_the_wild', 'moonfire', 'rejuvenation', 'thorns', 'entangling_roots', 'bear_form'],
    color: 0xff7d0a,
    crest: '🐻',
  },
};

// ---------------------------------------------------------------------------
// Abilities — rank values and learn levels from vanilla (levels 1-10)
// ---------------------------------------------------------------------------

export const ABILITIES: Record<string, AbilityDef> = {
  // ====================== WARRIOR ======================
  heroic_strike: {
    id: 'heroic_strike', name: 'Heroic Strike', class: 'warrior', learnLevel: 1,
    cost: 15, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true, onNextSwing: true, offGcd: true,
    effects: [{ type: 'weaponDamage', bonus: 11 }],
    ranks: [{ rank: 2, level: 8, cost: 15, effects: [{ type: 'weaponDamage', bonus: 21 }] }],
    icon: 'HS', iconColor: '#c0392b',
    description: 'A strong attack that increases melee damage by $d. Activates on your next swing.',
  },
  battle_shout: {
    id: 'battle_shout', name: 'Battle Shout', class: 'warrior', learnLevel: 1,
    cost: 10, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_ap', value: 20, duration: 120 }],
    icon: 'BS', iconColor: '#e67e22',
    description: 'Increases your attack power by 20 for 2 min.',
  },
  charge: {
    id: 'charge', name: 'Charge', class: 'warrior', learnLevel: 4,
    cost: 0, castTime: 0, cooldown: 15, range: 25, minRange: 8, school: 'physical',
    requiresTarget: true, offGcd: true,
    effects: [{ type: 'charge' }, { type: 'stun', duration: 1 }],
    icon: 'CH', iconColor: '#d35400',
    description: 'Charges an enemy, generating 9 rage and stunning it for 1 sec. 8-25 yd range.',
  },
  rend: {
    id: 'rend', name: 'Rend', class: 'warrior', learnLevel: 4,
    cost: 10, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true,
    effects: [{ type: 'dot', total: 15, duration: 9, interval: 3 }],
    ranks: [{ rank: 2, level: 10, cost: 10, effects: [{ type: 'dot', total: 21, duration: 9, interval: 3 }] }],
    icon: 'RE', iconColor: '#922b21',
    description: 'Wounds the target, causing them to bleed for $d damage over 9 sec.',
  },
  thunder_clap: {
    id: 'thunder_clap', name: 'Thunder Clap', class: 'warrior', learnLevel: 6,
    cost: 20, castTime: 0, cooldown: 4, range: 0, school: 'physical',
    requiresTarget: false,
    effects: [
      { type: 'aoeDamage', min: 12, max: 14, radius: 8 },
      { type: 'aoeAttackSpeed', mult: 1.1, duration: 10, radius: 8 },
    ],
    icon: 'TC', iconColor: '#2980b9',
    description: 'Blasts nearby enemies for $d damage and slows their attacks by 10% for 10 sec.',
  },
  hamstring: {
    id: 'hamstring', name: 'Hamstring', class: 'warrior', learnLevel: 8,
    cost: 10, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 5, max: 5 }, { type: 'slow', mult: 0.5, duration: 15 }],
    icon: 'HA', iconColor: '#a93226',
    description: 'Maims the enemy for 5 damage, slowing its movement by 50% for 15 sec.',
  },
  bloodrage: {
    id: 'bloodrage', name: 'Bloodrage', class: 'warrior', learnLevel: 10,
    cost: 0, castTime: 0, cooldown: 60, range: 0, school: 'physical',
    requiresTarget: false, offGcd: true,
    effects: [{ type: 'selfDamagePctMax', pct: 0.08 }, { type: 'gainResource', amount: 10 }],
    icon: 'BR', iconColor: '#e74c3c',
    description: 'Generates 10 rage at the cost of health.',
  },
  overpower: {
    id: 'overpower', name: 'Overpower', class: 'warrior', learnLevel: 10,
    cost: 5, castTime: 0, cooldown: 5, range: 0, school: 'physical',
    requiresTarget: true, requiresDodgeProc: true,
    effects: [{ type: 'weaponStrike', bonus: 5, cannotBeDodged: true }],
    icon: 'OP', iconColor: '#f39c12',
    description: 'Instant attack for weapon damage +5. Only usable after the target dodges. Cannot be dodged.',
  },

  // ====================== MAGE ======================
  fireball: {
    id: 'fireball', name: 'Fireball', class: 'mage', learnLevel: 1,
    cost: 30, castTime: 1.5, cooldown: 0, range: 30, school: 'fire',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 16, max: 25 }, { type: 'dot', total: 2, duration: 4, interval: 2 }],
    ranks: [{
      rank: 2, level: 6, cost: 45, castTime: 2.0,
      effects: [{ type: 'directDamage', min: 22, max: 31 }, { type: 'dot', total: 3, duration: 6, interval: 2 }],
    }],
    icon: 'FB', iconColor: '#e74c3c',
    description: 'Hurls a fiery ball that causes $d Fire damage plus additional damage over time.',
  },
  frost_armor: {
    id: 'frost_armor', name: 'Frost Armor', class: 'mage', learnLevel: 1,
    cost: 20, castTime: 0, cooldown: 0, range: 0, school: 'frost',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_armor', value: 30, duration: 1800 }],
    icon: 'FA', iconColor: '#aed6f1',
    description: 'Encases you in frost, increasing armor by 30 for 30 min.',
  },
  arcane_intellect: {
    id: 'arcane_intellect', name: 'Arcane Intellect', class: 'mage', learnLevel: 1,
    cost: 25, castTime: 0, cooldown: 0, range: 0, school: 'arcane',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_int', value: 2, duration: 1800 }],
    icon: 'AI', iconColor: '#bb8fce',
    description: 'Increases Intellect by 2 for 30 min.',
  },
  frostbolt: {
    id: 'frostbolt', name: 'Frostbolt', class: 'mage', learnLevel: 4,
    cost: 25, castTime: 1.5, cooldown: 0, range: 30, school: 'frost',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 18, max: 20 }, { type: 'slow', mult: 0.6, duration: 5 }],
    ranks: [{
      rank: 2, level: 8, cost: 35, castTime: 2.0,
      effects: [{ type: 'directDamage', min: 31, max: 35 }, { type: 'slow', mult: 0.6, duration: 6 }],
    }],
    icon: 'FR', iconColor: '#3498db',
    description: 'Launches a bolt of frost, causing $d Frost damage and slowing movement by 40%.',
  },
  conjure_water: {
    id: 'conjure_water', name: 'Conjure Water', class: 'mage', learnLevel: 4,
    cost: 40, castTime: 3, cooldown: 0, range: 0, school: 'arcane',
    requiresTarget: false,
    effects: [], // special-cased: creates conjured_water in bags
    icon: 'CW', iconColor: '#5dade2',
    description: 'Conjures 2 bottles of spring water, restoring mana when drunk.',
  },
  fire_blast: {
    id: 'fire_blast', name: 'Fire Blast', class: 'mage', learnLevel: 6,
    cost: 40, castTime: 0, cooldown: 8, range: 20, school: 'fire',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 27, max: 35 }],
    icon: 'BL', iconColor: '#e67e22',
    description: 'Blasts the enemy for $d Fire damage. Instant.',
  },
  arcane_missiles: {
    id: 'arcane_missiles', name: 'Arcane Missiles', class: 'mage', learnLevel: 8,
    cost: 50, castTime: 0, channel: { duration: 3, ticks: 3 }, cooldown: 0, range: 30, school: 'arcane',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 8, max: 8 }], // per missile
    icon: 'AM', iconColor: '#c39bd3',
    description: 'Launches Arcane Missiles at the enemy, causing 8 Arcane damage each second for 3 sec.',
  },
  polymorph: {
    id: 'polymorph', name: 'Polymorph', class: 'mage', learnLevel: 8,
    cost: 50, castTime: 1.5, cooldown: 0, range: 30, school: 'arcane',
    requiresTarget: true,
    effects: [{ type: 'polymorph', duration: 15 }],
    icon: 'PM', iconColor: '#f5b7b1',
    description: 'Transforms the enemy into a sheep for up to 15 sec. The sheep wanders and heals rapidly. Any damage breaks the effect. Beasts and humanoids only.',
  },
  frost_nova: {
    id: 'frost_nova', name: 'Frost Nova', class: 'mage', learnLevel: 10,
    cost: 35, castTime: 0, cooldown: 22, range: 0, school: 'frost',
    requiresTarget: false,
    effects: [{ type: 'aoeRoot', duration: 8, radius: 10, min: 6, max: 7 }],
    icon: 'NV', iconColor: '#85c1e9',
    description: 'Freezes all nearby enemies in place for up to 8 sec, dealing $d Frost damage.',
  },

  // ====================== ROGUE ======================
  sinister_strike: {
    id: 'sinister_strike', name: 'Sinister Strike', class: 'rogue', learnLevel: 1,
    cost: 45, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true, awardsCombo: 1,
    effects: [{ type: 'weaponStrike', bonus: 3 }],
    ranks: [{ rank: 2, level: 8, cost: 45, effects: [{ type: 'weaponStrike', bonus: 6 }] }],
    icon: 'SS', iconColor: '#f4d03f',
    description: 'An instant strike for weapon damage plus $d. Awards 1 combo point.',
  },
  eviscerate: {
    id: 'eviscerate', name: 'Eviscerate', class: 'rogue', learnLevel: 1,
    cost: 35, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true, spendsCombo: true,
    effects: [{ type: 'finisherDamage', base: 4, perCombo: 7, variance: 4 }],
    icon: 'EV', iconColor: '#cb4335',
    description: 'Finishing move that causes damage per combo point.',
  },
  backstab: {
    id: 'backstab', name: 'Backstab', class: 'rogue', learnLevel: 4,
    cost: 60, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true, awardsCombo: 1,
    effects: [{ type: 'weaponStrike', bonus: 11, requiresBehind: true, weaponMult: 1.5 }],
    icon: 'BK', iconColor: '#ec7063',
    description: 'Backstab the target for 150% weapon damage plus $d. Must be behind the target. Requires a dagger. Awards 1 combo point.',
  },
  gouge: {
    id: 'gouge', name: 'Gouge', class: 'rogue', learnLevel: 6,
    cost: 45, castTime: 0, cooldown: 10, range: 0, school: 'physical',
    requiresTarget: true, awardsCombo: 1,
    effects: [{ type: 'directDamage', min: 8, max: 9 }, { type: 'incapacitate', duration: 4 }],
    icon: 'GO', iconColor: '#d98880',
    description: 'Strikes the target, incapacitating it for 4 sec. Any damage breaks the effect. Awards 1 combo point.',
  },
  evasion: {
    id: 'evasion', name: 'Evasion', class: 'rogue', learnLevel: 8,
    cost: 0, castTime: 0, cooldown: 300, range: 0, school: 'physical',
    requiresTarget: false, offGcd: true,
    effects: [{ type: 'selfBuff', kind: 'buff_dodge', value: 0.5, duration: 15 }],
    icon: 'EA', iconColor: '#82e0aa',
    description: 'Increases your dodge chance by 50% for 15 sec.',
  },
  slice_and_dice: {
    id: 'slice_and_dice', name: 'Slice and Dice', class: 'rogue', learnLevel: 10,
    cost: 25, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true, spendsCombo: true,
    effects: [{ type: 'finisherHaste', mult: 1.3, basedur: 9, perCombo: 3 }],
    icon: 'SD', iconColor: '#f7dc6f',
    description: 'Finishing move that increases melee attack speed by 30%. Lasts longer per combo point.',
  },
  sprint: {
    id: 'sprint', name: 'Sprint', class: 'rogue', learnLevel: 10,
    cost: 0, castTime: 0, cooldown: 300, range: 0, school: 'physical',
    requiresTarget: false, offGcd: true,
    effects: [{ type: 'selfBuff', kind: 'buff_speed', value: 1.7, duration: 15 }],
    icon: 'SP', iconColor: '#aab7b8',
    description: 'Increases your movement speed by 70% for 15 sec.',
  },

  // ====================== PALADIN ======================
  seal_of_righteousness: {
    id: 'seal_of_righteousness', name: 'Seal of Righteousness', class: 'paladin', learnLevel: 1,
    cost: 25, castTime: 0, cooldown: 0, range: 0, school: 'holy',
    requiresTarget: false,
    effects: [{ type: 'imbue', bonus: 4, duration: 30, judgeMin: 10, judgeMax: 18 }],
    icon: 'SR', iconColor: '#f9e79f',
    description: 'Fills you with Holy power for 30 sec, causing each of your melee swings to deal 4 additional Holy damage. Unleash with Judgement.',
  },
  holy_light: {
    id: 'holy_light', name: 'Holy Light', class: 'paladin', learnLevel: 1,
    cost: 35, castTime: 2.5, cooldown: 0, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'heal', min: 42, max: 51 }],
    icon: 'HL', iconColor: '#fdf2c7',
    description: 'Heals a friendly target for $d.',
  },
  devotion_aura: {
    id: 'devotion_aura', name: 'Devotion Aura', class: 'paladin', learnLevel: 1,
    cost: 0, castTime: 0, cooldown: 0, range: 0, school: 'holy',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_armor', value: 40, duration: 1800 }],
    icon: 'DA', iconColor: '#f4d03f',
    description: 'Increases your armor by 40 for 30 min.',
  },
  judgement: {
    id: 'judgement', name: 'Judgement', class: 'paladin', learnLevel: 4,
    cost: 30, castTime: 0, cooldown: 10, range: 10, school: 'holy',
    requiresTarget: true,
    effects: [{ type: 'judgement' }],
    icon: 'JD', iconColor: '#f5b041',
    description: 'Unleashes your active Seal upon the enemy, consuming it to deal its judgement damage.',
  },
  blessing_of_might: {
    id: 'blessing_of_might', name: 'Blessing of Might', class: 'paladin', learnLevel: 4,
    cost: 25, castTime: 0, cooldown: 0, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'buffTarget', kind: 'buff_ap', value: 15, duration: 300 }],
    icon: 'BM', iconColor: '#f8c471',
    description: 'Places a Blessing on a friendly target, increasing attack power by 15 for 5 min.',
  },
  divine_protection: {
    id: 'divine_protection', name: 'Divine Protection', class: 'paladin', learnLevel: 6,
    cost: 15, castTime: 0, cooldown: 180, range: 0, school: 'holy',
    requiresTarget: false, offGcd: true,
    effects: [{ type: 'absorb', amount: 50, duration: 10 }],
    icon: 'DP', iconColor: '#fcf3cf',
    description: 'A holy shield absorbs 50 damage for 10 sec.',
  },
  hammer_of_justice: {
    id: 'hammer_of_justice', name: 'Hammer of Justice', class: 'paladin', learnLevel: 8,
    cost: 30, castTime: 0, cooldown: 60, range: 10, school: 'holy',
    requiresTarget: true,
    effects: [{ type: 'stun', duration: 3 }],
    icon: 'HJ', iconColor: '#d4ac0d',
    description: 'Stuns the target for 3 sec.',
  },
  lay_on_hands: {
    id: 'lay_on_hands', name: 'Lay on Hands', class: 'paladin', learnLevel: 10,
    cost: 0, castTime: 0, cooldown: 600, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'heal', min: 250, max: 250 }],
    icon: 'LH', iconColor: '#fef9e7',
    description: 'A massive surge of healing: restores 250 health. 10 min cooldown.',
  },

  // ====================== HUNTER ======================
  raptor_strike: {
    id: 'raptor_strike', name: 'Raptor Strike', class: 'hunter', learnLevel: 1,
    cost: 15, castTime: 0, cooldown: 6, range: 0, school: 'physical',
    requiresTarget: true, onNextSwing: true, offGcd: true,
    effects: [{ type: 'weaponDamage', bonus: 5 }],
    icon: 'RS', iconColor: '#a9dfbf',
    description: 'A strong melee attack that increases damage by 5. Activates on your next swing.',
  },
  aspect_of_the_hawk: {
    id: 'aspect_of_the_hawk', name: 'Aspect of the Hawk', class: 'hunter', learnLevel: 4,
    cost: 20, castTime: 0, cooldown: 0, range: 0, school: 'nature',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_ap', value: 20, duration: 1800 }],
    icon: 'AH', iconColor: '#7dcea0',
    description: 'Take on the aspect of the hawk, increasing attack power by 20 for 30 min.',
  },
  serpent_sting: {
    id: 'serpent_sting', name: 'Serpent Sting', class: 'hunter', learnLevel: 4,
    cost: 15, castTime: 0, cooldown: 0, range: 35, minRange: 8, school: 'nature',
    requiresTarget: true,
    effects: [{ type: 'dot', total: 20, duration: 15, interval: 3 }],
    icon: 'SS', iconColor: '#58d68d',
    description: 'Stings the target, dealing $d Nature damage over 15 sec.',
  },
  arcane_shot: {
    id: 'arcane_shot', name: 'Arcane Shot', class: 'hunter', learnLevel: 6,
    cost: 25, castTime: 0, cooldown: 6, range: 35, minRange: 8, school: 'arcane',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 13, max: 17 }],
    icon: 'AS', iconColor: '#bb8fce',
    description: 'An instant shot that deals $d Arcane damage.',
  },
  concussive_shot: {
    id: 'concussive_shot', name: 'Concussive Shot', class: 'hunter', learnLevel: 8,
    cost: 20, castTime: 0, cooldown: 12, range: 35, minRange: 8, school: 'physical',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 4, max: 6 }, { type: 'slow', mult: 0.5, duration: 4 }],
    icon: 'CS', iconColor: '#85c1e9',
    description: 'Dazes the target, slowing movement by 50% for 4 sec.',
  },
  mongoose_bite: {
    id: 'mongoose_bite', name: 'Mongoose Bite', class: 'hunter', learnLevel: 10,
    cost: 10, castTime: 0, cooldown: 5, range: 0, school: 'physical',
    requiresTarget: true, requiresDodgeProc: true,
    effects: [{ type: 'weaponStrike', bonus: 12, cannotBeDodged: true }],
    icon: 'MB', iconColor: '#52be80',
    description: 'Counterattack after the target dodges for weapon damage plus 12. Cannot be dodged.',
  },
  wing_clip: {
    id: 'wing_clip', name: 'Wing Clip', class: 'hunter', learnLevel: 10,
    cost: 20, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 3, max: 5 }, { type: 'slow', mult: 0.6, duration: 10 }],
    icon: 'WC', iconColor: '#a3e4d7',
    description: 'Inflicts a wound that slows the enemy by 40% for 10 sec.',
  },

  // ====================== PRIEST ======================
  smite: {
    id: 'smite', name: 'Smite', class: 'priest', learnLevel: 1,
    cost: 20, castTime: 2.0, cooldown: 0, range: 30, school: 'holy',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 15, max: 20 }],
    icon: 'SM', iconColor: '#fdf2c7',
    description: 'Smites the enemy for $d Holy damage.',
  },
  lesser_heal: {
    id: 'lesser_heal', name: 'Lesser Heal', class: 'priest', learnLevel: 1,
    cost: 30, castTime: 2.0, cooldown: 0, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'heal', min: 47, max: 58 }],
    icon: 'LH', iconColor: '#fef9e7',
    description: 'Heals a friendly target for $d.',
  },
  power_word_fortitude: {
    id: 'power_word_fortitude', name: 'Power Word: Fortitude', class: 'priest', learnLevel: 1,
    cost: 30, castTime: 0, cooldown: 0, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'buffTarget', kind: 'buff_sta', value: 3, duration: 1800 }],
    icon: 'PF', iconColor: '#fff',
    description: 'Increases the target\'s Stamina by 3 for 30 min.',
  },
  shadow_word_pain: {
    id: 'shadow_word_pain', name: 'Shadow Word: Pain', class: 'priest', learnLevel: 4,
    cost: 25, castTime: 0, cooldown: 0, range: 30, school: 'shadow',
    requiresTarget: true,
    effects: [{ type: 'dot', total: 30, duration: 18, interval: 3 }],
    icon: 'SW', iconColor: '#9b59b6',
    description: 'A word of darkness causes $d Shadow damage over 18 sec.',
  },
  power_word_shield: {
    id: 'power_word_shield', name: 'Power Word: Shield', class: 'priest', learnLevel: 6,
    cost: 45, castTime: 0, cooldown: 6, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'absorb', amount: 48, duration: 30 }],
    icon: 'PS', iconColor: '#fcf3cf',
    description: 'Shields the target, absorbing 48 damage for 30 sec.',
  },
  renew: {
    id: 'renew', name: 'Renew', class: 'priest', learnLevel: 8,
    cost: 30, castTime: 0, cooldown: 0, range: 30, school: 'holy',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'hot', total: 45, duration: 15, interval: 3 }],
    icon: 'RN', iconColor: '#abebc6',
    description: 'Heals the target for $d over 15 sec.',
  },
  mind_blast: {
    id: 'mind_blast', name: 'Mind Blast', class: 'priest', learnLevel: 10,
    cost: 50, castTime: 1.5, cooldown: 8, range: 30, school: 'shadow',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 42, max: 46 }],
    icon: 'MB', iconColor: '#bb8fce',
    description: 'Blasts the target\'s mind for $d Shadow damage.',
  },

  // ====================== SHAMAN ======================
  lightning_bolt: {
    id: 'lightning_bolt', name: 'Lightning Bolt', class: 'shaman', learnLevel: 1,
    cost: 15, castTime: 1.5, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 15, max: 17 }],
    icon: 'LB', iconColor: '#85c1e9',
    description: 'Hurls a bolt of lightning for $d Nature damage.',
  },
  rockbiter_weapon: {
    id: 'rockbiter_weapon', name: 'Rockbiter Weapon', class: 'shaman', learnLevel: 1,
    cost: 20, castTime: 0, cooldown: 0, range: 0, school: 'nature',
    requiresTarget: false,
    effects: [{ type: 'imbue', bonus: 5, duration: 300 }],
    icon: 'RB', iconColor: '#b9770e',
    description: 'Imbues your weapon with the fury of stone: each swing deals 5 additional damage for 5 min.',
  },
  healing_wave: {
    id: 'healing_wave', name: 'Healing Wave', class: 'shaman', learnLevel: 1,
    cost: 25, castTime: 1.5, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'heal', min: 36, max: 44 }],
    icon: 'HW', iconColor: '#aed6f1',
    description: 'Heals a friendly target for $d.',
  },
  earth_shock: {
    id: 'earth_shock', name: 'Earth Shock', class: 'shaman', learnLevel: 4,
    cost: 30, castTime: 0, cooldown: 6, range: 20, school: 'nature',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 19, max: 22 }],
    icon: 'ES', iconColor: '#b9770e',
    description: 'Instantly shocks the target with concussive force for $d Nature damage.',
  },
  lightning_shield: {
    id: 'lightning_shield', name: 'Lightning Shield', class: 'shaman', learnLevel: 8,
    cost: 25, castTime: 0, cooldown: 0, range: 0, school: 'nature',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'thorns', value: 13, duration: 600 }],
    icon: 'LS', iconColor: '#5dade2',
    description: 'Surrounds you with crackling lightning: melee attackers take 13 Nature damage.',
  },
  flame_shock: {
    id: 'flame_shock', name: 'Flame Shock', class: 'shaman', learnLevel: 10,
    cost: 35, castTime: 0, cooldown: 6, range: 20, school: 'fire',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 25, max: 25 }, { type: 'dot', total: 28, duration: 12, interval: 3 }],
    icon: 'FS', iconColor: '#e74c3c',
    description: 'Sears the target with fire for 25 damage plus $d over 12 sec.',
  },

  // ====================== WARLOCK ======================
  shadow_bolt: {
    id: 'shadow_bolt', name: 'Shadow Bolt', class: 'warlock', learnLevel: 1,
    cost: 25, castTime: 1.7, cooldown: 0, range: 30, school: 'shadow',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 13, max: 18 }],
    icon: 'SB', iconColor: '#9b59b6',
    description: 'Sends a shadowy bolt at the enemy for $d Shadow damage.',
  },
  demon_skin: {
    id: 'demon_skin', name: 'Demon Skin', class: 'warlock', learnLevel: 1,
    cost: 20, castTime: 0, cooldown: 0, range: 0, school: 'shadow',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_armor', value: 30, duration: 1800 }],
    icon: 'DS', iconColor: '#7d6608',
    description: 'Demonic skin increases your armor by 30 for 30 min.',
  },
  immolate: {
    id: 'immolate', name: 'Immolate', class: 'warlock', learnLevel: 1,
    cost: 25, castTime: 2.0, cooldown: 0, range: 30, school: 'fire',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 11, max: 11 }, { type: 'dot', total: 20, duration: 15, interval: 3 }],
    icon: 'IM', iconColor: '#e67e22',
    description: 'Burns the enemy for 11 Fire damage and an additional $d over 15 sec.',
  },
  corruption: {
    id: 'corruption', name: 'Corruption', class: 'warlock', learnLevel: 4,
    cost: 35, castTime: 2.0, cooldown: 0, range: 30, school: 'shadow',
    requiresTarget: true,
    effects: [{ type: 'dot', total: 40, duration: 18, interval: 3 }],
    icon: 'CO', iconColor: '#6c3483',
    description: 'Corrupts the target, causing $d Shadow damage over 18 sec.',
  },
  life_tap: {
    id: 'life_tap', name: 'Life Tap', class: 'warlock', learnLevel: 6,
    cost: 0, castTime: 0, cooldown: 0, range: 0, school: 'shadow',
    requiresTarget: false,
    effects: [{ type: 'lifeTap', hp: 30, mana: 30 }],
    icon: 'LT', iconColor: '#76448a',
    description: 'Converts 30 health into 30 mana.',
  },
  curse_of_agony: {
    id: 'curse_of_agony', name: 'Curse of Agony', class: 'warlock', learnLevel: 8,
    cost: 25, castTime: 0, cooldown: 0, range: 30, school: 'shadow',
    requiresTarget: true,
    effects: [{ type: 'dot', total: 36, duration: 24, interval: 3 }],
    icon: 'CA', iconColor: '#512e5f',
    description: 'Curses the target with agony: $d Shadow damage over 24 sec.',
  },
  drain_life: {
    id: 'drain_life', name: 'Drain Life', class: 'warlock', learnLevel: 10,
    cost: 35, castTime: 0, channel: { duration: 5, ticks: 5 }, cooldown: 0, range: 20, school: 'shadow',
    requiresTarget: true,
    effects: [{ type: 'drainTick', min: 7, max: 7, healFrac: 1 }],
    icon: 'DL', iconColor: '#a569bd',
    description: 'Drains the target\'s life, transferring 7 health to you each second for 5 sec.',
  },

  // ====================== DRUID ======================
  wrath: {
    id: 'wrath', name: 'Wrath', class: 'druid', learnLevel: 1,
    cost: 20, castTime: 1.5, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 13, max: 16 }],
    icon: 'WR', iconColor: '#58d68d',
    description: 'Hurls a bolt of nature energy for $d Nature damage.',
  },
  healing_touch: {
    id: 'healing_touch', name: 'Healing Touch', class: 'druid', learnLevel: 1,
    cost: 25, castTime: 2.5, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'heal', min: 37, max: 51 }],
    icon: 'HT', iconColor: '#a9dfbf',
    description: 'Heals a friendly target for $d.',
  },
  mark_of_the_wild: {
    id: 'mark_of_the_wild', name: 'Mark of the Wild', class: 'druid', learnLevel: 1,
    cost: 20, castTime: 0, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'buffTarget', kind: 'buff_armor', value: 25, duration: 1800 }],
    icon: 'MW', iconColor: '#f5cba7',
    description: 'Places the Mark of the Wild on a friendly target, increasing armor by 25 for 30 min.',
  },
  moonfire: {
    id: 'moonfire', name: 'Moonfire', class: 'druid', learnLevel: 4,
    cost: 25, castTime: 0, cooldown: 0, range: 30, school: 'arcane',
    requiresTarget: true,
    effects: [{ type: 'directDamage', min: 9, max: 12 }, { type: 'dot', total: 12, duration: 9, interval: 3 }],
    icon: 'MF', iconColor: '#d2b4de',
    description: 'Burns the enemy with moonfire for $d Arcane damage plus damage over time.',
  },
  rejuvenation: {
    id: 'rejuvenation', name: 'Rejuvenation', class: 'druid', learnLevel: 4,
    cost: 25, castTime: 0, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'hot', total: 32, duration: 12, interval: 3 }],
    icon: 'RJ', iconColor: '#82e0aa',
    description: 'Heals the target for $d over 12 sec.',
  },
  thorns: {
    id: 'thorns', name: 'Thorns', class: 'druid', learnLevel: 6,
    cost: 20, castTime: 0, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true, targetType: 'friendly',
    effects: [{ type: 'buffTarget', kind: 'thorns', value: 3, duration: 600 }],
    icon: 'TH', iconColor: '#7dcea0',
    description: 'Thorns sprout from the target: melee attackers take 3 Nature damage.',
  },
  entangling_roots: {
    id: 'entangling_roots', name: 'Entangling Roots', class: 'druid', learnLevel: 8,
    cost: 35, castTime: 1.5, cooldown: 0, range: 30, school: 'nature',
    requiresTarget: true,
    effects: [{ type: 'root', duration: 12 }],
    icon: 'ER', iconColor: '#229954',
    description: 'Roots the target in place for up to 12 sec.',
  },
  bear_form: {
    id: 'bear_form', name: 'Bear Form', class: 'druid', learnLevel: 10,
    cost: 30, castTime: 0, cooldown: 0, range: 0, school: 'physical',
    requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'form_bear', value: 0.65, duration: 3600 }],
    icon: 'BF', iconColor: '#b9770e',
    description: 'Shapeshift into a bear, increasing armor by 65% and attack power by 15. Cast again to return to caster form.',
  },
};

// Abilities a class knows at a given level, with active rank values resolved.
export function abilitiesKnownAt(cls: PlayerClass, level: number): { def: AbilityDef; rank: number; cost: number; castTime: number; effects: AbilityDef['effects'] }[] {
  const out = [];
  for (const id of CLASSES[cls].abilities) {
    const def = ABILITIES[id];
    if (def.learnLevel > level) continue;
    let rank = 1, cost = def.cost, castTime = def.castTime, effects = def.effects;
    for (const r of def.ranks ?? []) {
      if (r.level <= level) {
        rank = r.rank;
        cost = r.cost;
        effects = r.effects;
        if (r.castTime !== undefined) castTime = r.castTime;
      }
    }
    out.push({ def, rank, cost, castTime, effects });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const ITEMS: Record<string, ItemDef> = {
  // --- starting gear ---
  worn_sword: {
    id: 'worn_sword', name: 'Worn Shortsword', kind: 'weapon', slot: 'mainhand', quality: 'common',
    weapon: { min: 2, max: 5, speed: 2.0 }, sellValue: 10,
  },
  gnarled_staff: {
    id: 'gnarled_staff', name: 'Gnarled Staff', kind: 'weapon', slot: 'mainhand', quality: 'common',
    weapon: { min: 3, max: 6, speed: 2.9 }, stats: { int: 1 }, sellValue: 12,
  },
  rusty_dagger: {
    id: 'rusty_dagger', name: 'Rusty Dagger', kind: 'weapon', slot: 'mainhand', quality: 'common',
    weapon: { min: 2, max: 4, speed: 1.8, dagger: true }, sellValue: 10,
  },
  training_mace: {
    id: 'training_mace', name: 'Training Mace', kind: 'weapon', slot: 'mainhand', quality: 'common',
    weapon: { min: 2, max: 5, speed: 2.6 }, sellValue: 10,
  },
  rusty_hatchet: {
    id: 'rusty_hatchet', name: 'Rusty Hatchet', kind: 'weapon', slot: 'mainhand', quality: 'common',
    weapon: { min: 2, max: 5, speed: 2.2 }, sellValue: 10,
  },
  recruit_tunic: {
    id: 'recruit_tunic', name: "Recruit's Tunic", kind: 'armor', slot: 'chest', quality: 'common',
    stats: { armor: 20 }, sellValue: 5,
  },
  apprentice_robe: {
    id: 'apprentice_robe', name: "Apprentice's Robe", kind: 'armor', slot: 'chest', quality: 'common',
    stats: { armor: 8 }, sellValue: 5,
  },
  footpad_jerkin: {
    id: 'footpad_jerkin', name: "Footpad's Jerkin", kind: 'armor', slot: 'chest', quality: 'common',
    stats: { armor: 14 }, sellValue: 5,
  },
  // --- quest reward gear ---
  redbrook_blade: {
    id: 'redbrook_blade', name: 'Redbrook Militia Blade', kind: 'weapon', slot: 'mainhand', quality: 'uncommon',
    weapon: { min: 6, max: 11, speed: 2.2 }, stats: { str: 2 }, sellValue: 120, requiredClass: ['warrior'],
  },
  apprentice_staff: {
    id: 'apprentice_staff', name: 'Vale Apprentice Staff', kind: 'weapon', slot: 'mainhand', quality: 'uncommon',
    weapon: { min: 7, max: 12, speed: 3.0 }, stats: { int: 3, sta: 1 }, sellValue: 120, requiredClass: ['mage'],
  },
  keen_dirk: {
    id: 'keen_dirk', name: 'Keen Dirk', kind: 'weapon', slot: 'mainhand', quality: 'uncommon',
    weapon: { min: 4, max: 8, speed: 1.7, dagger: true }, stats: { agi: 2 }, sellValue: 120, requiredClass: ['rogue'],
  },
  militia_vest: {
    id: 'militia_vest', name: 'Militia Chainvest', kind: 'armor', slot: 'chest', quality: 'uncommon',
    stats: { armor: 90, sta: 2 }, sellValue: 150, requiredClass: ['warrior'],
  },
  woven_robe: {
    id: 'woven_robe', name: 'Valewoven Robe', kind: 'armor', slot: 'chest', quality: 'uncommon',
    stats: { armor: 30, int: 3, spi: 2 }, sellValue: 150, requiredClass: ['mage'],
  },
  shadow_jerkin: {
    id: 'shadow_jerkin', name: 'Shadowstitch Jerkin', kind: 'armor', slot: 'chest', quality: 'uncommon',
    stats: { armor: 55, agi: 3 }, sellValue: 150, requiredClass: ['rogue'],
  },
  oiled_boots: {
    id: 'oiled_boots', name: 'Oiled Leather Boots', kind: 'armor', slot: 'feet', quality: 'uncommon',
    stats: { armor: 25, agi: 1 }, sellValue: 80,
  },
  quilted_trousers: {
    id: 'quilted_trousers', name: 'Quilted Trousers', kind: 'armor', slot: 'legs', quality: 'uncommon',
    stats: { armor: 30, sta: 2 }, sellValue: 90,
  },
  greyjaw_pelt_cloak: {
    id: 'greyjaw_pelt_cloak', name: "Greyjaw's Pelt Leggings", kind: 'armor', slot: 'legs', quality: 'uncommon',
    stats: { armor: 35, sta: 1, agi: 1 }, sellValue: 110,
  },
  // --- food & drink (vendor) ---
  baked_bread: {
    id: 'baked_bread', name: 'Freshly Baked Bread', kind: 'food', quality: 'common',
    foodHp: 61, sellValue: 6, buyValue: 25,
  },
  spring_water: {
    id: 'spring_water', name: 'Refreshing Spring Water', kind: 'drink', quality: 'common',
    drinkMana: 76, sellValue: 6, buyValue: 25,
  },
  roasted_boar: {
    id: 'roasted_boar', name: 'Roasted Boar Meat', kind: 'food', quality: 'common',
    foodHp: 117, sellValue: 12, buyValue: 100,
  },
  conjured_water: {
    id: 'conjured_water', name: 'Conjured Spring Water', kind: 'drink', quality: 'common',
    drinkMana: 76, sellValue: 0,
  },
  // --- Hollow Crypt rewards (rare/blue) ---
  gravecaller_blade: {
    id: 'gravecaller_blade', name: "Gravecaller's Broadblade", kind: 'weapon', slot: 'mainhand', quality: 'rare',
    weapon: { min: 9, max: 16, speed: 2.4 }, stats: { str: 3, sta: 2 }, sellValue: 800,
  },
  widowfang_dirk: {
    id: 'widowfang_dirk', name: 'Widowfang Dirk', kind: 'weapon', slot: 'mainhand', quality: 'rare',
    weapon: { min: 6, max: 10, speed: 1.7, dagger: true }, stats: { agi: 3, sta: 2 }, sellValue: 800,
  },
  gravecaller_staff: {
    id: 'gravecaller_staff', name: 'Staff of the Hollow', kind: 'weapon', slot: 'mainhand', quality: 'rare',
    weapon: { min: 10, max: 17, speed: 3.0 }, stats: { int: 4, spi: 2 }, sellValue: 800,
  },
  // --- quest items ---
  boar_hide: { id: 'boar_hide', name: 'Bristly Boar Hide', kind: 'quest', sellValue: 0, questId: 'q_boars' },
  gravecaller_sigil: { id: 'gravecaller_sigil', name: "Gravecaller's Sigil", kind: 'quest', sellValue: 0, questId: 'q_whispers' },
  blessed_wax: { id: 'blessed_wax', name: 'Blessed Tallow', kind: 'quest', sellValue: 0, questId: 'q_rite' },
  ghostly_essence: { id: 'ghostly_essence', name: 'Ghostly Essence', kind: 'quest', sellValue: 0, questId: 'q_rite' },
  webwood_silk: { id: 'webwood_silk', name: 'Webwood Silk Gland', kind: 'quest', sellValue: 0, questId: 'q_spiders' },
  supply_crate: { id: 'supply_crate', name: 'Stolen Supply Crate', kind: 'quest', sellValue: 0, questId: 'q_supplies' },
  greyjaw_fang: { id: 'greyjaw_fang', name: "Old Greyjaw's Fang", kind: 'quest', sellValue: 0, questId: 'q_greyjaw' },
  // --- junk (gray) ---
  wolf_fang: { id: 'wolf_fang', name: 'Cracked Wolf Fang', kind: 'junk', quality: 'poor', sellValue: 4 },
  bandit_bandana: { id: 'bandit_bandana', name: 'Red Bandana', kind: 'junk', quality: 'poor', sellValue: 6 },
  tough_jerky: { id: 'tough_jerky', name: 'Tough Jerky', kind: 'food', quality: 'common', foodHp: 61, sellValue: 2, buyValue: 25 },
  mudfin_scale: { id: 'mudfin_scale', name: 'Slimy Murloc Scale', kind: 'junk', quality: 'poor', sellValue: 5 },
  tallow_candle: { id: 'tallow_candle', name: 'Tallow Candle', kind: 'junk', quality: 'poor', sellValue: 5 },
  spider_leg: { id: 'spider_leg', name: 'Twitching Spider Leg', kind: 'junk', quality: 'poor', sellValue: 4 },
  bone_fragments: { id: 'bone_fragments', name: 'Bone Fragments', kind: 'junk', quality: 'poor', sellValue: 7 },
  linen_scrap: { id: 'linen_scrap', name: 'Linen Scrap', kind: 'junk', quality: 'poor', sellValue: 3 },
};

// ---------------------------------------------------------------------------
// Mobs
// ---------------------------------------------------------------------------

export const MOBS: Record<string, MobTemplate> = {
  forest_wolf: {
    id: 'forest_wolf', name: 'Forest Wolf', minLevel: 1, maxLevel: 2, family: 'beast',
    hpBase: 28, hpPerLevel: 14, dmgBase: 3, dmgPerLevel: 1.6, attackSpeed: 2.0,
    armorPerLevel: 10, moveSpeed: 8, aggroRadius: 10,
    loot: [
      { copper: 8, chance: 1 },
      { itemId: 'wolf_fang', chance: 0.45 },
    ],
    scale: 0.9, color: 0x7f8c8d,
  },
  old_greyjaw: {
    id: 'old_greyjaw', name: 'Old Greyjaw', minLevel: 4, maxLevel: 4, family: 'beast', rare: true,
    hpBase: 110, hpPerLevel: 20, dmgBase: 5, dmgPerLevel: 2.0, attackSpeed: 1.8,
    armorPerLevel: 16, moveSpeed: 8.5, aggroRadius: 12,
    loot: [
      { copper: 60, chance: 1 },
      { itemId: 'greyjaw_fang', chance: 1, questId: 'q_greyjaw' },
      { itemId: 'wolf_fang', chance: 1 },
    ],
    scale: 1.25, color: 0x566061,
  },
  wild_boar: {
    id: 'wild_boar', name: 'Wild Boar', minLevel: 2, maxLevel: 3, family: 'beast',
    hpBase: 34, hpPerLevel: 16, dmgBase: 4, dmgPerLevel: 1.8, attackSpeed: 2.2,
    armorPerLevel: 14, moveSpeed: 7.5, aggroRadius: 9,
    loot: [
      { copper: 12, chance: 1 },
      { itemId: 'boar_hide', chance: 0.6, questId: 'q_boars' },
      { itemId: 'tough_jerky', chance: 0.3 },
    ],
    scale: 0.85, color: 0x935116,
  },
  webwood_spider: {
    id: 'webwood_spider', name: 'Webwood Lurker', minLevel: 2, maxLevel: 4, family: 'spider',
    hpBase: 30, hpPerLevel: 15, dmgBase: 4, dmgPerLevel: 1.7, attackSpeed: 1.8,
    armorPerLevel: 8, moveSpeed: 8, aggroRadius: 10,
    loot: [
      { copper: 14, chance: 1 },
      { itemId: 'webwood_silk', chance: 0.55, questId: 'q_spiders' },
      { itemId: 'spider_leg', chance: 0.4 },
    ],
    scale: 0.9, color: 0x4a235a,
  },
  mudfin_murloc: {
    id: 'mudfin_murloc', name: 'Mudfin Skulker', minLevel: 3, maxLevel: 5, family: 'murloc',
    hpBase: 36, hpPerLevel: 17, dmgBase: 5, dmgPerLevel: 1.9, attackSpeed: 1.9,
    armorPerLevel: 12, moveSpeed: 8, aggroRadius: 13, // murlocs aggro from far and bring friends
    loot: [
      { copper: 18, chance: 1 },
      { itemId: 'mudfin_scale', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.2 },
    ],
    scale: 0.8, color: 0x52be80,
  },
  tunnel_rat: {
    id: 'tunnel_rat', name: 'Tunnel Rat Digger', minLevel: 4, maxLevel: 6, family: 'kobold',
    hpBase: 42, hpPerLevel: 18, dmgBase: 6, dmgPerLevel: 2.0, attackSpeed: 2.1,
    armorPerLevel: 16, moveSpeed: 7, aggroRadius: 10,
    loot: [
      { copper: 22, chance: 1 },
      { itemId: 'tallow_candle', chance: 0.6 },
      { itemId: 'blessed_wax', chance: 0.45, questId: 'q_rite' },
      { itemId: 'linen_scrap', chance: 0.25 },
    ],
    scale: 0.85, color: 0x9c640c,
  },
  vale_bandit: {
    id: 'vale_bandit', name: 'Vale Bandit', minLevel: 3, maxLevel: 5, family: 'humanoid',
    hpBase: 40, hpPerLevel: 18, dmgBase: 5, dmgPerLevel: 2.0, attackSpeed: 2.0,
    armorPerLevel: 20, moveSpeed: 7, aggroRadius: 11,
    loot: [
      { copper: 25, chance: 1 },
      { itemId: 'bandit_bandana', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.3 },
    ],
    scale: 1.0, color: 0x943126,
  },
  restless_bones: {
    id: 'restless_bones', name: 'Restless Bones', minLevel: 5, maxLevel: 7, family: 'undead',
    hpBase: 46, hpPerLevel: 19, dmgBase: 7, dmgPerLevel: 2.1, attackSpeed: 2.3,
    armorPerLevel: 14, moveSpeed: 6.5, aggroRadius: 11,
    loot: [
      { copper: 30, chance: 1 },
      { itemId: 'bone_fragments', chance: 0.6 },
      { itemId: 'ghostly_essence', chance: 0.55, questId: 'q_rite' },
    ],
    scale: 1.0, color: 0xd5dbdb,
  },
  // ---- The Hollow Crypt (5-player elite instance) ----
  crypt_shambler: {
    id: 'crypt_shambler', name: 'Crypt Shambler', minLevel: 7, maxLevel: 8, family: 'undead', elite: true,
    hpBase: 50, hpPerLevel: 20, dmgBase: 7, dmgPerLevel: 2.2, attackSpeed: 2.4,
    armorPerLevel: 18, moveSpeed: 6.5, aggroRadius: 12,
    loot: [{ copper: 90, chance: 1 }, { itemId: 'bone_fragments', chance: 0.8 }],
    scale: 1.1, color: 0xb8c4c4,
  },
  hollow_acolyte: {
    id: 'hollow_acolyte', name: 'Hollow Acolyte', minLevel: 8, maxLevel: 8, family: 'undead', elite: true,
    hpBase: 44, hpPerLevel: 18, dmgBase: 8, dmgPerLevel: 2.3, attackSpeed: 2.0,
    armorPerLevel: 14, moveSpeed: 7, aggroRadius: 12,
    loot: [{ copper: 110, chance: 1 }, { itemId: 'linen_scrap', chance: 0.6 }],
    scale: 1.0, color: 0x5b2c6f,
  },
  bonechill_widow: {
    id: 'bonechill_widow', name: 'Bonechill Widow', minLevel: 8, maxLevel: 9, family: 'spider', elite: true,
    hpBase: 48, hpPerLevel: 19, dmgBase: 8, dmgPerLevel: 2.4, attackSpeed: 1.8,
    armorPerLevel: 12, moveSpeed: 8, aggroRadius: 13,
    loot: [{ copper: 120, chance: 1 }, { itemId: 'spider_leg', chance: 0.7 }],
    scale: 1.25, color: 0xd6eaf8,
  },
  sexton_marrow: {
    id: 'sexton_marrow', name: 'Sexton Marrow', minLevel: 9, maxLevel: 9, family: 'undead', elite: true,
    hpBase: 110, hpPerLevel: 24, dmgBase: 9, dmgPerLevel: 2.5, attackSpeed: 2.2,
    armorPerLevel: 22, moveSpeed: 7, aggroRadius: 14,
    loot: [{ copper: 400, chance: 1 }, { itemId: 'quilted_trousers', chance: 0.4 }, { itemId: 'oiled_boots', chance: 0.4 }],
    scale: 1.2, color: 0x839192,
  },
  morthen: {
    id: 'morthen', name: 'Morthen the Gravecaller', minLevel: 10, maxLevel: 10, family: 'undead',
    elite: true, boss: true,
    hpBase: 230, hpPerLevel: 32, dmgBase: 11, dmgPerLevel: 2.6, attackSpeed: 2.6,
    armorPerLevel: 26, moveSpeed: 7, aggroRadius: 16,
    aoePulse: { min: 12, max: 18, radius: 12, every: 10, name: 'Shadow Pulse' },
    loot: [{ copper: 2500, chance: 1 }, { itemId: 'greyjaw_pelt_cloak', chance: 0.5 }],
    scale: 1.35, color: 0x4a235a,
  },
  gorrak: {
    id: 'gorrak', name: 'Gorrak the Ruthless', minLevel: 6, maxLevel: 6, family: 'humanoid',
    hpBase: 160, hpPerLevel: 30, dmgBase: 8, dmgPerLevel: 2.4, attackSpeed: 2.4,
    armorPerLevel: 30, moveSpeed: 7, aggroRadius: 13, boss: true,
    loot: [
      { copper: 250, chance: 1 },
      { itemId: 'bandit_bandana', chance: 1 },
      { itemId: 'oiled_boots', chance: 0.5 },
      { itemId: 'quilted_trousers', chance: 0.5 },
    ],
    scale: 1.25, color: 0x6c3483,
  },
};

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  pos: { x: number; z: number };
  facing: number;
  color: number;
  questIds: string[];
  vendorItems?: string[];
  greeting: string;
}

export const NPCS: Record<string, NpcDef> = {
  marshal_redbrook: {
    id: 'marshal_redbrook', name: 'Marshal Redbrook', title: 'Town Marshal',
    pos: { x: 4, z: 6 }, facing: Math.PI, color: 0xb7950b,
    questIds: ['q_wolves', 'q_greyjaw', 'q_bandits', 'q_ringleader'],
    greeting: 'Keep your blade close, $C. The Vale is not what it was.',
  },
  trader_wilkes: {
    id: 'trader_wilkes', name: 'Trader Wilkes', title: 'Provisioner',
    pos: { x: -7, z: 3 }, facing: Math.PI / 2, color: 0x1e8449,
    questIds: ['q_boars', 'q_supplies'],
    vendorItems: ['baked_bread', 'spring_water', 'roasted_boar', 'tough_jerky'],
    greeting: 'Fresh bread, clean water, fair prices. What can I get you?',
  },
  apothecary_lin: {
    id: 'apothecary_lin', name: 'Apothecary Lin', title: 'Herbalist',
    pos: { x: 11, z: -3 }, facing: -Math.PI / 2, color: 0x7d3c98,
    questIds: ['q_spiders'],
    greeting: 'Careful where you step in the western woods, friend.',
  },
  brother_aldric: {
    id: 'brother_aldric', name: 'Brother Aldric', title: 'Priest of the Vale',
    pos: { x: -14, z: -10 }, facing: 0.8, color: 0xf7f9f9,
    questIds: ['q_bones'],
    greeting: 'The Light keep you. Even the dead find no rest here of late.',
  },
  fisherman_brandt: {
    id: 'fisherman_brandt', name: 'Fisherman Brandt', title: 'Old Salt',
    pos: { x: -62, z: 58 }, facing: 2.4, color: 0x2471a3,
    questIds: ['q_murlocs'],
    greeting: 'Grlmurlgrl— sorry, been listening to those fish-men too long.',
  },
  foreman_odell: {
    id: 'foreman_odell', name: 'Foreman Odell', title: 'Mine Foreman',
    pos: { x: -68, z: -52 }, facing: 1.2, color: 0xa04000,
    questIds: ['q_mine'],
    greeting: "Whole dig's crawling with those candle-headed vermin!",
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export const QUESTS: Record<string, QuestDef> = {
  q_wolves: {
    id: 'q_wolves', name: 'Wolves at the Door',
    giverNpcId: 'marshal_redbrook', turnInNpcId: 'marshal_redbrook',
    text: 'The forest wolves grow bold, snapping at travelers on the north road. Thin their numbers, $N. Slay 8 Forest Wolves and Eastbrook will breathe easier.',
    completionText: 'Fine work. The road feels safer already.',
    objectives: [{ type: 'kill', targetMobId: 'forest_wolf', count: 8, label: 'Forest Wolf slain' }],
    xpReward: 250, copperReward: 75, itemRewards: {},
  },
  q_greyjaw: {
    id: 'q_greyjaw', name: 'The Old Wolf',
    giverNpcId: 'marshal_redbrook', turnInNpcId: 'marshal_redbrook',
    text: 'There is one wolf no trap has held: Old Greyjaw. He has taken three hounds and a stable boy\'s arm. He prowls the deep woods north of the wolf runs. Bring me his fang.',
    completionText: 'So the old devil is dead at last. The stable boy will sleep easier — and so will I.',
    objectives: [{ type: 'collect', itemId: 'greyjaw_fang', count: 1, label: "Old Greyjaw's Fang" }],
    xpReward: 450, copperReward: 150,
    itemRewards: { warrior: 'greyjaw_pelt_cloak', mage: 'greyjaw_pelt_cloak', rogue: 'greyjaw_pelt_cloak' },
    requiresQuest: 'q_wolves',
  },
  q_boars: {
    id: 'q_boars', name: 'Bristleback Hides',
    giverNpcId: 'trader_wilkes', turnInNpcId: 'trader_wilkes',
    text: 'Boar hide makes the finest travel packs, and the meadows east of town are crawling with the beasts. Bring me 5 Bristly Boar Hides and I will make it worth your time.',
    completionText: 'Ah, fine bristly hides! These will fetch a good price.',
    objectives: [{ type: 'collect', itemId: 'boar_hide', count: 5, label: 'Bristly Boar Hide' }],
    xpReward: 350, copperReward: 120, itemRewards: {},
  },
  q_spiders: {
    id: 'q_spiders', name: 'Webwood Menace',
    giverNpcId: 'apothecary_lin', turnInNpcId: 'apothecary_lin',
    text: 'The lurkers in the western woods spin a silk I need for my poultices — and they have grown far too numerous besides. Cull 6 Webwood Lurkers and cut 4 silk glands from their bellies.',
    completionText: 'Ugh, still twitching. Perfect. Here, you\'ve earned this.',
    objectives: [
      { type: 'kill', targetMobId: 'webwood_spider', count: 6, label: 'Webwood Lurker slain' },
      { type: 'collect', itemId: 'webwood_silk', count: 4, label: 'Webwood Silk Gland' },
    ],
    xpReward: 420, copperReward: 140, itemRewards: {},
    minLevel: 2,
  },
  q_murlocs: {
    id: 'q_murlocs', name: 'Trouble at the Lake',
    giverNpcId: 'fisherman_brandt', turnInNpcId: 'fisherman_brandt',
    text: 'Twenty years I have fished Mirror Lake, and never lost a net until those gurgling fish-men crawled out of the shallows. Drive the Mudfin back — slay 8 of them. And watch yourself: where there is one murloc, there are five.',
    completionText: 'Hah! That will teach them to mind their own mudholes.',
    objectives: [{ type: 'kill', targetMobId: 'mudfin_murloc', count: 8, label: 'Mudfin Skulker slain' }],
    xpReward: 520, copperReward: 180, itemRewards: {},
    minLevel: 3,
  },
  q_mine: {
    id: 'q_mine', name: 'Rats in the Mine',
    giverNpcId: 'foreman_odell', turnInNpcId: 'foreman_odell',
    text: 'We struck a fine copper vein and then those kobold vermin came boiling out of the hillside. My crew will not set foot in the dig until it is cleared. Put down 10 Tunnel Rat Diggers.',
    completionText: 'Ha! Back to work, lads! You have my thanks — and my coin.',
    objectives: [{ type: 'kill', targetMobId: 'tunnel_rat', count: 10, label: 'Tunnel Rat Digger slain' }],
    xpReward: 620, copperReward: 220, itemRewards: {},
    minLevel: 4,
  },
  q_bones: {
    id: 'q_bones', name: 'The Restless Dead',
    giverNpcId: 'brother_aldric', turnInNpcId: 'brother_aldric',
    text: 'The old ruin on the northeast hill was a chapel once, and its yard a resting place. Something has stirred the dead from their sleep. Grant them peace, $N — return 8 Restless Bones to the earth.',
    completionText: 'May they rest now, and may the Light forgive whatever woke them.',
    objectives: [{ type: 'kill', targetMobId: 'restless_bones', count: 8, label: 'Restless Bones laid to rest' }],
    xpReward: 700, copperReward: 260, itemRewards: {},
    minLevel: 5,
  },
  q_supplies: {
    id: 'q_supplies', name: 'Stolen Supplies',
    giverNpcId: 'trader_wilkes', turnInNpcId: 'trader_wilkes',
    text: 'Those bandits hit my last wagon and made off with four crates of goods — tools, salt, good Eastbrook linen. The crates are stacked around their camp in the southeast hills. Steal them back for me, would you?',
    completionText: 'My crates! Barely a scratch on them. You are a wonder.',
    objectives: [{ type: 'collect', itemId: 'supply_crate', count: 4, label: 'Stolen Supply Crate' }],
    xpReward: 550, copperReward: 250, itemRewards: {},
    minLevel: 3,
  },
  q_whispers: {
    id: 'q_whispers', name: 'Whispers Below',
    giverNpcId: 'brother_aldric', turnInNpcId: 'brother_aldric',
    text: 'You have laid the dead to rest, but they will not stay resting — something calls them back. Search the chapel ruin for any trace of the one doing the calling. If you find a sigil or seal, bring it to me untouched.',
    completionText: 'This sigil... it bears the mark of the Gravecallers, a sect I had prayed was extinct. This is worse than I feared, $N.',
    objectives: [{ type: 'collect', itemId: 'gravecaller_sigil', count: 1, label: "Gravecaller's Sigil" }],
    xpReward: 400, copperReward: 150, itemRewards: {},
    requiresQuest: 'q_bones',
  },
  q_rite: {
    id: 'q_rite', name: 'The Binding Rite',
    giverNpcId: 'brother_aldric', turnInNpcId: 'brother_aldric',
    text: 'The crypt beneath the chapel must be unsealed if we are to stop the Gravecaller — but only a binding rite will let the living pass. I need 4 lumps of Blessed Tallow — the kobold diggers hoard candles by the crate — and 6 Ghostly Essences from the restless dead.',
    completionText: 'It is done. The way below stands open... and may the Light forgive me for opening it. Gather your strongest companions before you descend, $N. No one should face the Hollow alone.',
    objectives: [
      { type: 'collect', itemId: 'blessed_wax', count: 4, label: 'Blessed Tallow' },
      { type: 'collect', itemId: 'ghostly_essence', count: 6, label: 'Ghostly Essence' },
    ],
    xpReward: 700, copperReward: 500, itemRewards: {},
    requiresQuest: 'q_whispers',
  },
  q_hollow: {
    id: 'q_hollow', name: 'Into the Hollow',
    giverNpcId: 'brother_aldric', turnInNpcId: 'brother_aldric',
    text: 'Morthen the Gravecaller waits at the bottom of the Hollow Crypt, ringed by the elite dead he has raised. He is far beyond any one hero — take four companions, no fewer. End him, and the Vale\'s dead will finally sleep.',
    completionText: 'The whispering has stopped. You have done what the whole Vale could not, $N — the dead sleep, and Eastbrook owes you everything it has.',
    objectives: [{ type: 'kill', targetMobId: 'morthen', count: 1, label: 'Morthen the Gravecaller slain' }],
    xpReward: 1500, copperReward: 10000,
    itemRewards: { warrior: 'gravecaller_blade', rogue: 'widowfang_dirk', mage: 'gravecaller_staff' },
    requiresQuest: 'q_rite',
    suggestedPlayers: 5,
  },
  q_bandits: {
    id: 'q_bandits', name: 'Bandits of the Vale',
    giverNpcId: 'marshal_redbrook', turnInNpcId: 'marshal_redbrook',
    text: 'A pack of cutthroats has made camp in the southeast hills. They have robbed three wagons this week. Drive them out — slay 10 Vale Bandits.',
    completionText: 'Ten fewer knives in the dark. Take this — you have earned it.',
    objectives: [{ type: 'kill', targetMobId: 'vale_bandit', count: 10, label: 'Vale Bandit slain' }],
    xpReward: 550, copperReward: 200,
    itemRewards: { warrior: 'redbrook_blade', mage: 'apprentice_staff', rogue: 'keen_dirk' },
    requiresQuest: 'q_wolves',
  },
  q_ringleader: {
    id: 'q_ringleader', name: 'The Ringleader',
    giverNpcId: 'marshal_redbrook', turnInNpcId: 'marshal_redbrook',
    text: 'The bandits answer to one man: Gorrak the Ruthless. Cut off the head and the body will scatter. He skulks at the heart of their camp. End him, $N.',
    completionText: 'Gorrak is dead? Then the Vale is free of his shadow. You have done Eastbrook a great service.',
    objectives: [{ type: 'kill', targetMobId: 'gorrak', count: 1, label: 'Gorrak the Ruthless slain' }],
    xpReward: 800, copperReward: 500,
    itemRewards: { warrior: 'militia_vest', mage: 'woven_robe', rogue: 'shadow_jerkin' },
    requiresQuest: 'q_bandits',
  },
};

export const QUEST_ORDER = [
  'q_wolves', 'q_boars', 'q_spiders', 'q_greyjaw', 'q_murlocs',
  'q_supplies', 'q_bandits', 'q_mine', 'q_bones', 'q_ringleader',
  'q_whispers', 'q_rite', 'q_hollow',
];

// Quest reward fallback by archetype: classes without an explicit entry use these.
export const REWARD_ARCHETYPE: Record<PlayerClass, PlayerClass> = {
  warrior: 'warrior', paladin: 'warrior', shaman: 'warrior',
  rogue: 'rogue', hunter: 'rogue',
  mage: 'mage', priest: 'mage', warlock: 'mage', druid: 'mage',
};

// ---------------------------------------------------------------------------
// World layout. Town sits at origin. +x east, +z north.
// ---------------------------------------------------------------------------

export interface CampDef {
  mobId: string;
  center: { x: number; z: number };
  radius: number;
  count: number;
}

export const CAMPS: CampDef[] = [
  // Wolves: north woods
  { mobId: 'forest_wolf', center: { x: -15, z: 55 }, radius: 22, count: 7 },
  { mobId: 'forest_wolf', center: { x: 20, z: 70 }, radius: 20, count: 6 },
  { mobId: 'old_greyjaw', center: { x: 0, z: 95 }, radius: 8, count: 1 },
  // Boars: east meadow
  { mobId: 'wild_boar', center: { x: 55, z: 12 }, radius: 22, count: 6 },
  { mobId: 'wild_boar', center: { x: 80, z: -15 }, radius: 18, count: 5 },
  // Spiders: western woods
  { mobId: 'webwood_spider', center: { x: -60, z: 5 }, radius: 22, count: 7 },
  // Murlocs: lake shore northwest
  { mobId: 'mudfin_murloc', center: { x: -78, z: 68 }, radius: 18, count: 8 },
  // Kobolds: mine southwest
  { mobId: 'tunnel_rat', center: { x: -82, z: -62 }, radius: 20, count: 9 },
  // Bandits: southeast camp
  { mobId: 'vale_bandit', center: { x: 65, z: -65 }, radius: 24, count: 7 },
  { mobId: 'vale_bandit', center: { x: 90, z: -90 }, radius: 16, count: 5 },
  { mobId: 'gorrak', center: { x: 92, z: -92 }, radius: 2, count: 1 },
  // Undead: ruins northeast
  { mobId: 'restless_bones', center: { x: 80, z: 78 }, radius: 18, count: 8 },
];

// Ground interactables (sparkle objects)
export interface GroundObjectDef {
  itemId: string;
  name: string;
  positions: { x: number; z: number }[];
}

export const GROUND_OBJECTS: GroundObjectDef[] = [
  {
    itemId: 'supply_crate',
    name: 'Stolen Supply Crate',
    positions: [
      { x: 58, z: -58 }, { x: 73, z: -70 }, { x: 86, z: -82 }, { x: 95, z: -97 },
      { x: 64, z: -76 }, { x: 81, z: -94 },
    ],
  },
  {
    itemId: 'gravecaller_sigil',
    name: "Gravecaller's Sigil",
    positions: [{ x: 84, z: 88 }, { x: 76, z: 92 }],
  },
];

// ---------------------------------------------------------------------------
// The Hollow Crypt — 5-player elite instance beneath the Fallen Chapel.
// Each instance copy lives at a far-off origin; the floor there is flat
// (see world.groundHeight). Coordinates below are relative to the origin.
// ---------------------------------------------------------------------------

export const CRYPT_DOOR_POS = { x: 80, z: 90 }; // entrance portal at the chapel ruin
export const INSTANCE_SLOT_COUNT = 6;
export function instanceOrigin(slot: number): { x: number; z: number } {
  return { x: 900, z: -1250 + slot * 500 };
}
export const DUNGEON_X_THRESHOLD = 600; // x beyond this = inside an instance
export const DUNGEON_FLOOR_Y = 0;
export const CRYPT_ENTRY = { x: 0, z: 0 }; // player arrival point (relative)
export const CRYPT_EXIT_OFFSET = { x: 0, z: -6 }; // exit portal (relative)

export interface CryptSpawn {
  mobId: string;
  x: number; // relative to instance origin
  z: number;
}

// Trash packs of 2 elites (spaced beyond social-aggro range so groups can
// pull them one pack at a time), a miniboss pair, then Morthen with guards.
export const CRYPT_SPAWNS: CryptSpawn[] = [
  { mobId: 'crypt_shambler', x: -3, z: 18 },
  { mobId: 'crypt_shambler', x: 3, z: 19 },
  { mobId: 'crypt_shambler', x: -9, z: 38 },
  { mobId: 'hollow_acolyte', x: -5, z: 39 },
  { mobId: 'crypt_shambler', x: 9, z: 54 },
  { mobId: 'hollow_acolyte', x: 5, z: 55 },
  { mobId: 'bonechill_widow', x: -5, z: 68 },
  { mobId: 'bonechill_widow', x: -1, z: 70 },
  { mobId: 'sexton_marrow', x: -4, z: 82 },
  { mobId: 'hollow_acolyte', x: 1, z: 83 },
  { mobId: 'morthen', x: 0, z: 98 },
  { mobId: 'crypt_shambler', x: -4, z: 96 },
  { mobId: 'crypt_shambler', x: 4, z: 96 },
];

// Vanilla group XP multipliers by party size (1-5).
export const GROUP_XP_BONUS = [1, 1, 1.166, 1.3, 1.43];

// Roads from town toward each hub — used for terrain painting and the map.
export const ROADS: { x: number; z: number }[][] = [
  [{ x: 0, z: 8 }, { x: -8, z: 30 }, { x: -15, z: 55 }, { x: -2, z: 78 }],          // north to wolves
  [{ x: 8, z: 2 }, { x: 30, z: 8 }, { x: 55, z: 12 }],                              // east to boars
  [{ x: 6, z: -6 }, { x: 30, z: -30 }, { x: 50, z: -50 }, { x: 65, z: -65 }],       // southeast to bandits
  [{ x: -8, z: 6 }, { x: -35, z: 25 }, { x: -58, z: 48 }, { x: -68, z: 60 }],       // northwest to lake
  [{ x: -6, z: -6 }, { x: -30, z: -28 }, { x: -55, z: -45 }, { x: -70, z: -55 }],   // southwest to mine
  [{ x: 6, z: 8 }, { x: 35, z: 35 }, { x: 60, z: 60 }, { x: 78, z: 74 }],           // northeast to ruins
];

export const WORLD_SIZE = 360; // world spans [-180, 180] in x and z
export const TOWN_RADIUS = 26;
export const GRAVEYARD_POS = { x: -12, z: -14 };
export const PLAYER_START = { x: 2, z: -2 };
export const LAKE = { x: -85, z: 80, radius: 38 }; // basin carved into the heightfield
export const ZONE_NAME = 'Eastbrook Vale';
