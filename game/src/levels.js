const blue = "#2f8cff";
const purple = "#b44bff";
const green = "#3dce4a";
const orange = "#ff9a1f";

const HORIZON = 2100;
const FIRST_Z = 200;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gate(z, x0, x1, value, color) {
  return { type: "gate", z, x0, x1, value, color, label: `+${value}` };
}

function upgrade(z, weapon, label, color) {
  return { type: "upgrade", z, x0: 0.12, x1: 0.88, weapon, label, color };
}

function cannon(z, x0, x1, hp, bonus, color) {
  return {
    type: "obstacle",
    kind: "cannon",
    z,
    x0,
    x1,
    hp,
    bonus,
    bonusColor: color,
    bonusLabel: `+${bonus}`,
  };
}

function tank(z, x0, x1, hp) {
  return { type: "obstacle", kind: "tank", z, x0, x1, hp, bonus: 0 };
}

function pack(z, x0, x1, count, tint) {
  return { type: "pack", z, x0, x1, count, hp: count * 2, tint };
}

function boss(z, hp) {
  return { type: "boss", z, x0: 0.1, x1: 0.9, hp };
}

export function speedForWave(wave) {
  return Math.min(206, 144 + (wave - 1) * 3.2);
}

function gateValue(wave) {
  return 3 + Math.floor((wave - 1) * 1.35);
}

function cannonHp() {
  return 2;
}

function tankHp() {
  return 2;
}

function packCount(wave) {
  return 4 + wave;
}

function bossHp(wave) {
  return 40 + (wave / 4 - 1) * 16;
}

function bonusFor(wave) {
  return Math.round(8 + wave * 4);
}

function tag(events, wave) {
  for (const event of events) event.wave = wave;
  return events;
}

function ribbon(z, wave) {
  const events = [];
  const value = gateValue(wave);
  const count = 6;
  const gap = 76;
  for (let i = 0; i < count; i++) {
    events.push(gate(z + i * gap, 0.62, 1, value, i % 2 ? purple : blue));
  }
  let cursor = z + count * gap + 120;
  events.push(cannon(cursor, 0.28, 0.82, cannonHp(), bonusFor(wave), purple));
  cursor += 320;
  return { events, cursor };
}

function fork(z, wave, rand) {
  const events = [];
  const small = Math.max(2, Math.round(gateValue(wave) * 0.6));
  const big = gateValue(wave) * 3;
  const gap = 84;
  for (let i = 0; i < 4; i++) {
    const at = z + i * gap;
    events.push(gate(at, 0, 0.4, small, blue));
    events.push(gate(at, 0.6, 1, big, orange));
  }
  let cursor = z + 4 * gap + 90;
  const tankOnRight = rand() > 0.5;
  events.push(tank(cursor, tankOnRight ? 0.55 : 0.02, tankOnRight ? 0.98 : 0.42, tankHp()));
  events.push(cannon(cursor, tankOnRight ? 0.02 : 0.55, tankOnRight ? 0.42 : 0.98, cannonHp(), bonusFor(wave), green));
  cursor += 300;
  return { events, cursor };
}

function weave(z, wave) {
  const events = [];
  const value = gateValue(wave) + 1;
  const gap = 88;
  for (let i = 0; i < 6; i++) {
    const right = i % 2 === 0;
    events.push(gate(z + i * gap, right ? 0.55 : 0, right ? 1 : 0.45, value, right ? purple : blue));
  }
  let cursor = z + 6 * gap + 100;
  events.push(cannon(cursor, 0.22, 0.78, cannonHp(), bonusFor(wave), orange));
  cursor += 300;
  return { events, cursor };
}

function siege(z, wave) {
  const events = [];
  events.push(tank(z, 0.02, 0.36, tankHp()));
  events.push(cannon(z, 0.64, 0.98, cannonHp(), bonusFor(wave), orange));
  let cursor = z + 280;
  const value = gateValue(wave) + 2;
  for (let i = 0; i < 4; i++) {
    events.push(gate(cursor + i * 80, 0.34, 0.7, value, green));
  }
  cursor += 4 * 80 + 160;
  return { events, cursor };
}

function jackpot(z, wave, rand) {
  const events = [];
  const lean = rand() > 0.5 ? 0.08 : -0.08;
  const mid = Math.min(0.78, Math.max(0.22, 0.5 + lean));
  events.push(gate(z, mid - 0.12, mid + 0.12, gateValue(wave) * 4, green));
  events.push(gate(z + 70, 0, 0.34, Math.max(2, gateValue(wave) - 1), blue));
  events.push(gate(z + 70, 0.66, 1, Math.max(2, gateValue(wave) - 1), blue));
  let cursor = z + 260;
  events.push(cannon(cursor, 0.18, 0.82, cannonHp(), bonusFor(wave) + 6, purple));
  cursor += 280;
  return { events, cursor };
}

function closeStretch(events, cursor, wave) {
  if (wave % 4 === 0) {
    events.push(boss(cursor, bossHp(wave)));
    cursor += 480;
    const value = gateValue(wave) + 4;
    for (let i = 0; i < 3; i++) {
      events.push(gate(cursor + i * 78, 0.6, 1, value, green));
    }
    cursor += 3 * 78 + 220;
    return cursor;
  }
  const wide = wave % 3 === 0;
  events.push(pack(cursor, 0, wide ? 1 : 0.4, packCount(wave), wide ? "#e23b3b" : "#f0c400"));
  if (!wide) {
    events.push(pack(cursor, 0.6, 1, Math.round(packCount(wave) * 0.7), "#e23b3b"));
  }
  return cursor + 420;
}

const MOTIFS = [ribbon, fork, weave, siege, jackpot];

function buildWave(wave, z, rand) {
  const motif = wave === 1 ? ribbon : MOTIFS[Math.floor(rand() * MOTIFS.length)];
  const built = motif.length === 3 ? motif(z, wave, rand) : motif(z, wave);
  if (wave < 3) {
    built.events = built.events.filter((event) => event.kind !== "tank");
  }
  if (wave === 1) {
    built.events.push(upgrade(built.cursor, "machinegun", "MACHINE GUN", green));
    built.cursor += 200;
  } else if (wave === 2) {
    built.events.push(upgrade(built.cursor, "rocket", "ROCKET", orange));
    built.cursor += 200;
  } else if (wave === 3 && !built.events.some((event) => event.kind === "tank")) {
    built.events.push(tank(built.cursor, 0.28, 0.72, tankHp()));
    built.cursor += 220;
  }
  const endZ = closeStretch(built.events, built.cursor, wave);
  return { events: tag(built.events, wave), endZ };
}

export function createEndless(seed = (Date.now() ^ (Math.random() * 0x100000000)) >>> 0) {
  const rand = mulberry32(seed);
  let wave = 0;
  let cursor = FIRST_Z;

  return {
    name: "ENDLESS",
    startCrowd: 1,
    get cursor() {
      return cursor;
    },
    advance(distance) {
      cursor -= distance;
    },
    pull() {
      const chunks = [];
      while (cursor < HORIZON) {
        wave += 1;
        const built = buildWave(wave, cursor, rand);
        cursor = built.endZ;
        chunks.push({ wave, events: built.events });
      }
      return chunks;
    },
  };
}
