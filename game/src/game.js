import { createEndless, speedForWave } from "./levels.js";

export const VIEW_W = 400;
export const VIEW_H = 720;

const RANGE = 430;
const SHOT_SPEED = 920;
const VISUAL_CAP = 110;
const MAX_CROWD = 999;
const ENEMY_HP = 2;

export const WEAPONS = [
  { id: "pistol", name: "PISTOL", damage: 1, rate: 2, color: "#d7dde8" },
  { id: "machinegun", name: "MACHINE GUN", damage: 1, rate: 4, color: "#3dce4a" },
  { id: "rocket", name: "ROCKET", damage: 4, rate: 2, color: "#ff9a1f" },
  { id: "tank", name: "TANK", damage: 5, rate: 2, color: "#7ec8ff" },
];

export function crowdRadius(n) {
  if (n <= 1) return 10;
  return 12 + Math.sqrt(n) * 5.4;
}

export function formation(n, radius) {
  if (n <= 0) return [];
  if (n === 1) return [[0, 0]];
  const rings = Math.max(1, Math.ceil((Math.sqrt(12 * n - 3) + 3) / 6));
  const gap = radius / rings;
  const pts = [[0, 0]];
  for (let ring = 1; ring <= rings && pts.length < n; ring++) {
    const count = ring * 6;
    for (let i = 0; i < count && pts.length < n; i++) {
      const side = Math.floor(i / ring);
      const t = (i % ring) / ring;
      const a0 = (side * Math.PI) / 3 - Math.PI / 2;
      const a1 = (((side + 1) % 6) * Math.PI) / 3 - Math.PI / 2;
      const x = Math.cos(a0) * (1 - t) + Math.cos(a1) * t;
      const y = Math.sin(a0) * (1 - t) + Math.sin(a1) * t;
      pts.push([x * ring * gap, y * ring * gap * 0.86]);
    }
  }
  return pts;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function laneWidth(state) {
  return state.lane.right - state.lane.left;
}

export function lanePixel(state) {
  return state.lane.left + state.crowdX * laneWidth(state);
}

function normalizeX(state, pixel) {
  return clamp((pixel - state.lane.left) / laneWidth(state), 0, 1);
}

function marginFor(state) {
  const visual = Math.min(Math.max(state.crowd, 1), VISUAL_CAP);
  return Math.min(0.28, crowdRadius(visual) / laneWidth(state));
}

function crowdSpan(state) {
  const radius = crowdRadius(Math.min(Math.max(state.crowd, 1), VISUAL_CAP)) / laneWidth(state);
  return [state.crowdX - radius, state.crowdX + radius];
}

function overlaps(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1;
}

function homeThreats(state, dt) {
  const threats = state.entities.filter((e) => {
    if (e.type !== "pack" && e.type !== "boss") return false;
    if (!living(e)) return false;
    return e.x1 - e.x0 < 0.98;
  });
  const bands = [];
  for (const entity of threats) {
    let band = bands.find((group) => Math.abs(group.z - entity.z) < 70);
    if (!band) {
      band = { z: entity.z, members: [] };
      bands.push(band);
    }
    band.members.push(entity);
  }
  for (const band of bands) {
    const members = band.members.slice().sort((a, b) => a.x0 - b.x0);
    const widths = members.map((entity) => entity.x1 - entity.x0);
    const body = widths.reduce((sum, width) => sum + width, 0);
    let gap = 0.08;
    if (members.length > 1 && body + gap * (members.length - 1) > 1) {
      gap = Math.max(0, (1 - body) / (members.length - 1));
    }
    const total = body + gap * Math.max(0, members.length - 1);
    let cursor = clamp(state.crowdX - total * 0.5, 0, Math.max(0, 1 - total));
    for (let i = 0; i < members.length; i++) {
      const entity = members[i];
      const width = widths[i];
      const target = cursor + width * 0.5;
      const mid = (entity.x0 + entity.x1) * 0.5;
      const approach = clamp(1 - entity.z / RANGE, 0, 1);
      const rate = 1.1 + approach * 2.4;
      const next = mid + (target - mid) * (1 - Math.exp(-rate * dt));
      entity.x0 = clamp(next - width * 0.5, 0, 1 - width);
      entity.x1 = entity.x0 + width;
      cursor += width + gap;
    }
  }
}

function living(e) {
  if (e.type === "gate") return false;
  if (e.type === "pack") return e.count > 0;
  return e.hp > 0;
}

function readBest() {
  try {
    return Number(localStorage.getItem("crowd-fire-best") || 0) || 0;
  } catch {
    return 0;
  }
}

function writeBest(meters) {
  try {
    localStorage.setItem("crowd-fire-best", String(meters));
  } catch {
    /* private mode */
  }
}

export function createGame() {
  const state = {
    phase: "menu",
    levelName: "ENDLESS",
    wave: 1,
    speed: 144,
    travel: 0,
    bestMeters: readBest(),
    lastMeters: 0,
    lastWave: 1,
    isBest: false,
    crowd: 1,
    crowdX: 0.35,
    aimX: 0.35,
    seenPointer: 0,
    entities: [],
    shots: [],
    muzzles: [],
    shotTimer: 0,
    floaters: [],
    sparks: [],
    shake: 0,
    redFlash: 0,
    crowdPunch: 0,
    weapon: 0,
    vehicle: null,
    hintT: 0,
    lockTimer: 0,
    time: 0,
    width: VIEW_W,
    height: VIEW_H,
    lane: { left: 22, right: 378, playerY: 600 },
    bossAnchor: null,
  };

  function floater(text, x, y, color) {
    state.floaters.push({ text, x, y, color, age: 0, life: 0.85 });
    if (state.floaters.length > 20) state.floaters.shift();
  }

  function dropPickupTanks() {
    for (const entity of state.entities) {
      if (entity.type === "obstacle" && entity.kind === "tank") entity.remove = true;
    }
  }

  function weaponSpec() {
    return WEAPONS[state.weapon];
  }

  function grantWeapon(id) {
    const next = WEAPONS.findIndex((weapon) => weapon.id === id);
    if (next < 0 || next <= state.weapon) return;
    state.weapon = next;
    state.crowdPunch = 1;
    const weapon = WEAPONS[next];
    if (weapon.id === "tank") {
      state.vehicle = "tank";
      dropPickupTanks();
    }
    floater(weapon.name, lanePixel(state), state.lane.playerY - 120, weapon.color);
  }

  function stamp(event) {
    return {
      ...event,
      hp: event.hp ?? 0,
      count: event.count ?? 0,
      max: event.hp ?? event.count ?? 0,
      used: false,
      announced: false,
      remove: false,
    };
  }

  function activeWave() {
    let wave = 0;
    for (const entity of state.entities) {
      if (!wave || entity.wave < wave) wave = entity.wave;
    }
    return wave || 1;
  }

  function extendLane() {
    const mounted = state.vehicle === "tank";
    for (const chunk of state.run.pull()) {
      for (const event of chunk.events) {
        if (mounted && event.kind === "tank") continue;
        state.entities.push(stamp(event));
      }
    }
  }

  function begin() {
    const run = createEndless();
    state.phase = "playing";
    state.run = run;
    state.levelName = run.name;
    state.wave = 1;
    state.speed = speedForWave(1);
    state.crowd = run.startCrowd;
    state.crowdX = 0.32;
    state.aimX = 0.32;
    state.entities = [];
    extendLane();
    state.shots = [];
    state.muzzles = [];
    state.shotTimer = 0;
    state.floaters = [];
    state.sparks = [];
    state.shake = 0;
    state.redFlash = 0;
    state.crowdPunch = 0;
    state.weapon = 0;
    state.vehicle = null;
    state.hintT = 0;
    state.lockTimer = 0.2;
    state.travel = 0;
    state.isBest = false;
  }

  function adoptPointer(input) {
    if (!input.pointerSerial) return;
    state.seenPointer = input.pointerSerial;
    state.aimX = normalizeX(state, input.pointerX);
    const m = marginFor(state);
    state.crowdX = clamp(state.aimX, m, 1 - m);
  }

  function pixelSpan(entity) {
    const width = laneWidth(state);
    return [state.lane.left + entity.x0 * width, state.lane.left + entity.x1 * width];
  }

  function shotTarget(x, z) {
    let best = null;
    for (const e of state.entities) {
      if (!living(e) || e.z <= 0 || z < e.z - 12) continue;
      const [x0, x1] = pixelSpan(e);
      if (x < x0 || x > x1) continue;
      if (!best || e.z < best.z) best = e;
    }
    return best;
  }

  function fireVolley() {
    const weapon = weaponSpec();
    const heavy = weapon.id === "rocket" || weapon.id === "tank";
    const n = Math.min(Math.max(state.crowd, 1), VISUAL_CAP);
    const radius = crowdRadius(n);
    const pts = formation(n, radius);
    const origin = lanePixel(state);
    const mounted = state.vehicle === "tank";
    const baseWidth = ((radius * 2) / 178) * 4;
    const baseDepth = ((radius * 0.86 * 2) / 44) * 0.85;
    const spreadX = mounted ? Math.min(3.4, 6.4 / Math.max(baseWidth, 0.35)) : 1;
    const spreadZ = mounted ? Math.min(4.6, 4.2 / Math.max(baseDepth, 0.25)) : 1;
    // Each visible soldier fires from their own gun.
    for (let i = 0; i < pts.length; i++) {
      const x = origin + pts[i][0] * spreadX;
      const y = state.lane.playerY + pts[i][1] * spreadZ;
      state.shots.push({
        x,
        z: 18 - pts[i][1] * spreadZ * 0.85,
        damage: weapon.damage,
        len: heavy ? 36 : 42,
        kind: weapon.id,
      });
      state.muzzles.push({
        x,
        y,
        age: 0,
        life: heavy ? 0.12 : 0.08,
        kind: weapon.id,
      });
    }
    if (state.muzzles.length > 120) state.muzzles.splice(0, state.muzzles.length - 120);
  }

  function finish(phase) {
    state.phase = phase;
    state.lockTimer = 0.45;
    state.shots = [];
  }

  function steer(dt, input) {
    if (input.pointerActive || input.pointerSerial !== state.seenPointer) {
      if (input.pointerSerial) state.aimX = normalizeX(state, input.pointerX);
      state.seenPointer = input.pointerSerial || state.seenPointer;
    }
    if (input.left) state.aimX -= dt * 1.15;
    if (input.right) state.aimX += dt * 1.15;
    state.aimX = clamp(state.aimX, 0, 1);
    const k = 1 - Math.exp(-14 * dt);
    state.crowdX += (state.aimX - state.crowdX) * k;
    const m = marginFor(state);
    state.crowdX = clamp(state.crowdX, m, 1 - m);
  }

  function decayFx(dt) {
    state.shake = Math.max(0, state.shake - dt * 1.4);
    state.redFlash = Math.max(0, state.redFlash - dt * 1.8);
    state.crowdPunch = Math.max(0, state.crowdPunch - dt * 2.2);
    for (const f of state.floaters) {
      f.age += dt;
      f.y -= 36 * dt;
    }
    state.floaters = state.floaters.filter((f) => f.age < f.life);
    for (const s of state.sparks) s.age += dt;
    state.sparks = state.sparks.filter((s) => s.age < s.life);
    for (const m of state.muzzles) m.age += dt;
    state.muzzles = state.muzzles.filter((m) => m.age < m.life);
  }

  function update(dt, input) {
    state.time += dt;
    decayFx(dt);
    const locked = state.lockTimer > 0;
    if (locked) state.lockTimer -= dt;
    const pressed = !locked && input.pressed;

    if (state.phase === "menu") {
      if (pressed) {
        begin();
        adoptPointer(input);
      }
      return;
    }
    if (state.phase === "gameover") {
      if (pressed) {
        begin();
        adoptPointer(input);
      }
      return;
    }

    steer(dt, locked ? { ...input, left: false, right: false } : input);
    state.hintT += dt;
    state.wave = activeWave();
    state.speed = speedForWave(state.wave);
    extendLane();
    state.travel += state.speed * dt;
    state.run.advance(state.speed * dt);

    for (const e of state.entities) {
      e.z -= state.speed * dt;
      if (e.type === "boss" && !e.announced && e.z < RANGE + 40) {
        e.announced = true;
        state.shake = 1;
      }
    }
    homeThreats(state, dt);

    if (state.crowd > 0) {
      state.shotTimer -= dt;
      if (state.shotTimer <= 0) {
        fireVolley();
        state.shotTimer += 1 / weaponSpec().rate;
        if (state.shotTimer < 0) state.shotTimer = 0;
      }
    }

    for (const shot of state.shots) {
      shot.z += SHOT_SPEED * dt;
      const hit = shotTarget(shot.x, shot.z);
      if (hit) {
        hit.hp = Math.max(0, hit.hp - shot.damage);
        if (hit.type === "pack") hit.count = hit.hp > 0 ? Math.ceil(hit.hp / ENEMY_HP) : 0;
        shot.dead = true;
        state.sparks.push({
          x: shot.x,
          y: state.lane.playerY - hit.z,
          age: 0,
          life: 0.16,
        });
        if (state.sparks.length > 30) state.sparks.shift();
      } else if (shot.z > state.lane.playerY + 40) {
        shot.dead = true;
      }
    }
    state.shots = state.shots.filter((shot) => !shot.dead);

    const [span0, span1] = crowdSpan(state);
    for (const e of state.entities) {
      if (e.type === "gate" && !e.used && e.z <= 18 && overlaps(span0, span1, e.x0, e.x1)) {
        e.used = true;
        state.crowd = clamp(state.crowd + e.value, 1, MAX_CROWD);
        state.crowdPunch = 1;
        floater(e.label, lanePixel(state), state.lane.playerY - 78, e.color);
      }
      if (e.type === "upgrade" && !e.used && e.z <= 18 && overlaps(span0, span1, e.x0, e.x1)) {
        e.used = true;
        grantWeapon(e.weapon);
      }
      if (e.type === "obstacle" && e.kind === "tank" && e.hp > 0 && e.z <= 36 && overlaps(span0, span1, e.x0, e.x1)) {
        grantWeapon("tank");
        e.hp = 0;
        e.remove = true;
      }
      if (e.type === "obstacle" && e.hp <= 0) {
        if (e.kind === "tank") grantWeapon("tank");
        if (e.bonus) {
          state.crowd = clamp(state.crowd + e.bonus, 1, MAX_CROWD);
          state.crowdPunch = 1;
          floater(e.bonusLabel, lanePixel(state), state.lane.playerY - 100, e.bonusColor);
        }
        e.remove = true;
      }
      if (
        e.kind !== "tank" &&
        (e.type === "pack" || e.type === "boss" || e.type === "obstacle") &&
        e.z <= 0 &&
        living(e) &&
        overlaps(span0, span1, e.x0, e.x1)
      ) {
        const left = Math.ceil(e.hp);
        const traded = Math.min(state.crowd, left);
        state.crowd -= traded;
        e.hp = 0;
        if (e.type === "pack") e.count = 0;
        state.redFlash = 1;
        state.shake = Math.max(state.shake, 0.85);
        floater(`-${traded}`, lanePixel(state), state.lane.playerY - 70, "#ff5b6a");
      }
      if (
        (e.type === "pack" || e.type === "boss" || e.type === "obstacle") &&
        e.z <= 0 &&
        !overlaps(span0, span1, e.x0, e.x1)
      ) {
        e.remove = true;
      }
      if ((e.type === "gate" || e.type === "upgrade") && (e.used || e.z < -70)) e.remove = true;
      if (e.type === "pack" && e.count <= 0) e.remove = true;
      if ((e.type === "boss" || e.type === "obstacle") && e.hp <= 0) e.remove = true;
    }
    state.entities = state.entities.filter((e) => !e.remove);

    if (state.crowd <= 0) {
      state.crowd = 0;
      const meters = Math.floor(state.travel);
      state.lastMeters = meters;
      state.lastWave = state.wave;
      state.isBest = meters > state.bestMeters;
      if (state.isBest) {
        state.bestMeters = meters;
        writeBest(meters);
      }
      finish("gameover");
    }
  }

  return {
    state,
    update,
    nudge(dir) {
      if (state.phase !== "playing") return;
      state.aimX = clamp(state.aimX + dir * 0.16, 0, 1);
    },
  };
}
