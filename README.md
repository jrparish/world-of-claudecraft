# Eastbrook Vale — a WoW-Classic-style MMO + RL training environment

A vanilla-WoW-flavored micro-MMO built for three purposes:

1. **Play it online** — a real client/server game with accounts, persistent
   characters in Postgres, and other players in the world with you.
2. **Play it offline** in your browser to test things instantly.
3. **Train neural networks on it** through a fast headless environment with a
   Python `gymnasium` API — thousands of steps per second on a single machine,
   instead of the ~4 decisions/second a real WoW client allows.

All three run the **same deterministic simulation core** (`src/sim/`), so an
agent trained headless behaves identically to what you see in the browser, and
the multiplayer server is the same rules engine running authoritatively.

---

## Host it (one command)

```bash
docker compose up -d --build     # postgres + game server, fully built
# open http://localhost:8787 — accounts, characters, the whole world
```

For **remote hosting**: put the compose stack on any VPS, set a real
`POSTGRES_PASSWORD` in the environment, and front port 8787 with a TLS
reverse proxy (Caddy makes this two lines — `your.domain { reverse_proxy
localhost:8787 }`); WebSockets are proxied automatically and the client
auto-selects `wss://` on https pages. Auth endpoints are rate-limited per IP;
passwords are scrypt-hashed; tokens expire after 7 days. Never set
`ALLOW_DEV_COMMANDS=1` in production (it enables level/teleport cheats used
by the test bots).

## Develop online (hot reload)

```bash
npm install
npm run db:up        # postgres 16 in docker (port 5433, volume-persisted)
npm run server       # authoritative game server on :8787 (REST + WebSocket)
npm run dev          # client dev server on :5173 (proxies /api and /ws)
```

Open http://localhost:5173 → **Play Online** → create an account → create a
character → Enter World. Open a second browser/tab and log in again — you'll
see each other in town. `Enter` opens chat.

- **Accounts**: scrypt-hashed passwords, 7-day bearer tokens (`auth_tokens`).
- **Characters**: up to 10 per account; level/gear/bags/quests/position/money
  persist as JSONB in Postgres — saved every 30 s, on logout, and on server
  shutdown. Names are globally unique, letters only, classic style.
- **The server is authoritative**: clients stream movement intent + commands
  at 20 Hz; the server runs the world (one shared `Sim`) and sends
  interest-scoped snapshots (~120 yd) plus per-player-routed events. All
  combat math, loot rolls, quest credit and vendor transactions happen
  server-side; the client is a renderer.
- **Parties** (up to 5): right-click a player → *Invite to Party*. Party
  frames on the left, members share tap rights, kill quest credit and split
  XP with the real vanilla group bonuses (1.166/1.3/1.43 for 3/4/5). Party
  chat with `/p message`. Blue member blips on the minimap.
- **Trading**: right-click a player → *Trade*. Both sides stage items + money,
  both must accept, and the swap is atomic and server-validated (quest items
  are untradeable). Walking apart cancels.
- **Duels**: right-click → *Challenge to a Duel*. 3-second countdown, fight
  until one side hits 1 hp — nobody dies, the winner is announced zone-wide.
  Running 60 yards away forfeits.
- **Multiplayer rules**: classic tap rights (first player to damage a mob owns
  its loot/XP/quest credit — others get "You don't have permission to loot
  that."), mobs retarget the next attacker when their victim dies (no free
  resets), join/leave announcements, `/say`-style chat.

## The Hollow Crypt — 5-player elite instance

Brother Aldric's storyline continues past *The Restless Dead*: **Whispers
Below** (find the Gravecaller's sigil at the ruined chapel) → **The Binding
Rite** (gather Blessed Tallow from the kobold dig and Ghostly Essence from
the restless dead) → **Into the Hollow** (*suggested players: 5*) — kill
Morthen the Gravecaaller at the bottom of the crypt beneath the chapel.

- The crypt door at the Fallen Chapel teleports your **party into its own
  private instance copy** (6 slots; instances reset after 5 minutes empty).
- Inside: torch-lit halls, paired **elite** trash packs (vanilla elite
  scaling: ~2.3× health, ~1.5× damage, double XP), the miniboss Sexton
  Marrow, and Morthen — a level-10 elite boss with a **Shadow Pulse** AoE
  every 10 seconds. Dungeon trash does not respawn until the instance resets.
- Rewards: rare (blue) weapons per class archetype, 1 gold, 1500 XP.
- It is genuinely tuned for 5: our automated 5-bot raid (warrior, paladin,
  priest, mage, hunter with focus-fire + healer AI) clears it in ~5 minutes
  with ~10 deaths (`node scripts/crypt_raid.mjs`, needs ALLOW_DEV_COMMANDS=1).

```
docker compose ps          # eastbrook-db (postgres:16-alpine, healthcheck)
node scripts/mp_integration.mjs   # 26-check API/WS/persistence suite
node scripts/mp_browser.mjs       # two real browser clients see each other
```

## Play offline

```bash
npm run dev        # open http://localhost:5173 -> Play Offline
```

Name your character, pick **Warrior**, **Mage**, or **Rogue**, and you're in
Eastbrook Vale: a market town ringed by six hubs — wolf runs and a rare wolf
to the north, boar meadows east, the Webwood west, Mirror Lake and its murloc
camps northwest, a kobold-infested copper dig southwest, a ruined chapel with
restless dead northeast, and a bandit camp (with its boss, Gorrak the
Ruthless) southeast. Ten quests across six NPCs, a vendor, and gear upgrades
for all three classes.

### Controls (classic layout)

| Input | Action |
|---|---|
| `W`/`S` | run / backpedal — `A`/`D` turn (strafe while right mouse held), `Q`/`E` strafe |
| right-drag / left-drag | mouselook / orbit camera &nbsp;·&nbsp; wheel zooms · `Space` jumps |
| `Tab` | cycle nearest enemies · left-click target · right-click attack/loot/talk |
| `1`–`9`, `0`, `-`, `=` | action bar |
| `F` | interact (loot corpse / pick up object / talk) |
| `C` `P` `L` `M` `B` | character · spellbook · quest log · world map · bags |
| `V` / `R` / `Esc` | nameplates · autorun · close windows / clear target |

### Classic-fidelity checklist

**Formulas (the real vanilla ones)**
- Rage conversion `c = 0.0091L² + 3.23L + 4.27`; gains `7.5·d/c` dealing, `2.5·d/c` taking
- Spell-hit table with the +3-level cliff (96/95/94/83%); melee miss/dodge vs level
- Armor DR `armor/(armor + 85·AttackerLevel + 400)`
- HP/mana stat rules: first 20 stamina → 1 hp each, rest → 10; first 20 int → 1 mana, rest → 15
- XP curve 400/900/1400/…; mob XP `45 + 5·L` with real zero-difference gray bands
- 1.5 s GCD (1.0 s for rogues), weapon swing timers, 5-second mana rule

**All nine vanilla classes (learn levels and rank values from vanilla, 1–10)**
- *Warrior*: rage, Heroic Strike (on-next-swing, off-GCD), Battle Shout,
  Charge, Rend, Thunder Clap, Hamstring, Bloodrage, Overpower (dodge proc)
- *Paladin*: Seal of Righteousness (weapon imbue) unleashed by **Judgement**,
  Holy Light, Devotion Aura, Blessing of Might, Divine Protection (absorb),
  Hammer of Justice (stun), Lay on Hands
- *Hunter*: **ranged Auto Shot** (8–35 yd with the classic dead zone),
  Raptor Strike, Aspect of the Hawk, Serpent Sting, Arcane Shot, Concussive
  Shot, Mongoose Bite (dodge proc), Wing Clip
- *Rogue*: energy + **combo points**, Sinister Strike, Eviscerate, Backstab
  (behind + dagger), Gouge, Evasion, Slice and Dice, Sprint
- *Priest*: Smite, Lesser Heal, Power Word: Fortitude, Shadow Word: Pain,
  **Power Word: Shield** (absorb), **Renew** (HoT), Mind Blast
- *Shaman*: Lightning Bolt, **Rockbiter Weapon** (imbue), Healing Wave,
  Earth Shock, **Lightning Shield** (thorns), Flame Shock
- *Mage*: Fireball, Frost Armor, Arcane Intellect, Frostbolt, Conjure Water,
  Fire Blast, Arcane Missiles (channeled), **Polymorph**, Frost Nova
- *Warlock*: Shadow Bolt, Demon Skin, Immolate, Corruption, **Life Tap**,
  Curse of Agony, **Drain Life** (channeled health steal)
- *Druid*: Wrath, Healing Touch, Mark of the Wild, Moonfire, Rejuvenation,
  Thorns, Entangling Roots, **Bear Form** (toggle shapeshift at 10)
- Heals can target party members (click a party frame, then heal); buffs are
  castable on friendly players; healing crits; absorb shields soak damage
  before health.

**World & systems**
- Eating/drinking: sit down, restore over 18 s, breaks on damage or standing
- Vendor: buy food/water, sell your grays; coin display in g/s/c
- Ground quest objects with sparkles (steal the bandits' supply crates back)
- Mob AI: wander, proximity aggro by level difference, social pulls (murlocs
  pull from farther — bring friends), chase, leash-evade-reset, corpse loot,
  respawns; a rare spawn (Old Greyjaw) on a long timer
- Death → release spirit → graveyard; falling damage; swimming slows you
- Quest log with abandon, gossip dialogs with greetings, per-class rewards

**Presentation**
- Procedural everything: timber-framed houses, shingled roofs, chapel, market
  stall, tents, campfires with flickering light, mine portal, ruined columns,
  fishing dock, murloc mud-huts, roads painted into the terrain, grass tufts,
  pine + oak trees, lake with animated water, drifting clouds, real-time shadows
- Eight rigged creature models (wolf/boar/spider/murloc/kobold/skeleton/
  humanoid/sheep) with walk/attack/cast/sit/death animations
- Classic UI: portrait unit frames, buff/debuff bars with durations, action
  bar with cooldown sweeps + range/resource coloring, cast/channel bar,
  spellbook, character paperdoll, quest log, world map, vendor + loot windows,
  gold-bordered tooltips, floating combat text, combat log, segmented XP bar,
  minimap with blips and a full zone map
- Procedural WebAudio sound: melee/spell impacts, level-up fanfare, quest
  chimes, coin clinks, the death sting — no audio files

## Train on it

```bash
npm run build:env                      # bundles dist-env/env_server.cjs
pip install gymnasium numpy
python python/example_random_agent.py  # smoke test + throughput
```

```python
from wow_env import WoWClassicEnv

env = WoWClassicEnv(player_class="rogue", frame_skip=5, max_steps=3000)
obs, info = env.reset(seed=42)
obs, reward, terminated, truncated, info = env.step(action)
```

Each env owns a Node subprocess (NDJSON over stdio). For parallel rollouts use
`gymnasium.vector.AsyncVectorEnv([make_env(...)] * N)`.

### Spaces

- **Observation** — `Box(100,)` float32: self (hp/resource/level/xp/position/
  facing/GCD/cast/combat/combo points/sitting/dodge-proc), 10 ability slots
  (ready + cooldown fraction), current target (hp, level diff, distance,
  relative angle, aggro), 5 nearest mobs, nearest interactable (corpse /
  ground object / NPC), and per-quest state/progress for all 10 quests.
- **Action** — `Discrete(23)`: noop, movement (6), jump, target-nearest,
  attack, ability slots 1–10, interact, stop, eat/drink.

### Reward (configurable via `rewards={...}`)

XP gained (+0.01/xp), kills (+0.2), quest progress (+0.5), quest complete (+5),
level up (+2), damage dealt (+0.002/hp), damage taken (−0.001/hp), death (−5).
Episodes truncate at `max_steps`; optionally terminate on death or at level 10.

### Throughput (measured on this machine)

- Sim core: **~10,800 env-steps/sec per core** (`npm run bench`) — ~2,700×
  faster than real-time play, before adding parallel envs
- Through Python incl. subprocess IPC: **~4,000 steps/sec** per env, scaling
  roughly linearly with parallel envs/cores

Determinism: same seed + same action sequence ⇒ bit-identical trajectories
(covered by tests).

## Development

```bash
npm test                        # 52 vitest tests: formulas, combat, AI, quests, all 9 classes,
                                #   parties, duels, trades, elites, the crypt, RL iface
npm run build                   # production web build
node scripts/smoke_browser.mjs  # warrior E2E (needs `npm run dev` running)
node scripts/smoke_mage.mjs     # mage: casting, polymorph, conjure+drink, death/release
node scripts/smoke_rogue.mjs    # rogue: combo points, eviscerate, vendor, eating
node scripts/visual_tour.mjs    # screenshot tour of the zone + UI into tmp/
node scripts/mp_integration.mjs # 26-check API/WS/persistence suite (server running)
node scripts/social_e2e.mjs     # trade + duel over the wire (ALLOW_DEV_COMMANDS=1)
node scripts/crypt_raid.mjs     # five bots clear the Hollow Crypt (ALLOW_DEV_COMMANDS=1)
```

Layout:

```
src/sim/      deterministic N-player game core (no DOM imports) — shared by all targets
src/render/   Three.js renderer: models.ts (rigs), props.ts, textures.ts (procedural)
src/game/     input + camera + WebAudio synth
src/ui/       classic HUD: frames, windows, tooltips, map, FCT
src/net/      online client: REST auth + WebSocket world mirror (ClientWorld)
src/world_api.ts  the IWorld interface both Sim and ClientWorld satisfy
server/       game server: main.ts (HTTP+WS), game.ts (world loop), db.ts, auth.ts
docker-compose.yml  postgres:16-alpine (eastbrook-db)
headless/     NDJSON env server for RL
python/       gymnasium wrapper + example agent
tests/        vitest suite
scripts/      browser E2E + screenshot tour + multiplayer integration tests
```

All art and audio are procedural — no copyrighted assets. Names, quests and
the zone are original; formulas and mechanics follow vanilla. World seed is
fixed in `src/main.ts` so the vale is the same place every visit; the RL env
takes a seed per episode.
