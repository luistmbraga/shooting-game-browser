import { VIEW_H, VIEW_W, WEAPONS } from "./game.js";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), Math.max(0, h), r);
}

function drawText(ctx, text, x, y, size, fill, outline = "rgba(0,0,0,.8)") {
  ctx.font = `800 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawBossBar(ctx, state) {
  const boss = state.entities.find((e) => e.type === "boss" && e.hp > 0);
  if (!boss || state.phase !== "playing" || !state.bossAnchor) return;
  const x = Math.max(64, Math.min(VIEW_W - 64, state.bossAnchor.x));
  const y = Math.max(58, Math.min(VIEW_H - 88, state.bossAnchor.y));
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.max));
  roundRect(ctx, x - 50, y - 9, 100, 18, 6);
  ctx.fillStyle = "#1a1c22";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.stroke();
  roundRect(ctx, x - 47, y - 6, 94 * ratio, 12, 4);
  ctx.fillStyle = "#ff4d4d";
  ctx.fill();
  drawText(ctx, String(Math.ceil(boss.hp)), x, y, 12, "#ffffff");
}

function drawFx(ctx, state) {
  for (const s of state.sparks) {
    const t = 1 - s.age / s.life;
    ctx.fillStyle = `rgba(255,255,255,${t})`;
    ctx.fillRect(s.x - 4, s.y, 8 * t, 2);
  }
  for (const f of state.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
    drawText(ctx, f.text, f.x, f.y, f.text === "BOSS" ? 28 : 26, f.color || "#fff");
    ctx.restore();
  }
}

function drawHud(ctx, state) {
  if (state.phase !== "menu") {
    ctx.fillStyle = "rgba(20,24,32,.78)";
    ctx.fillRect(0, 0, VIEW_W, 46);
    drawText(ctx, `WAVE ${state.wave}`, 78, 23, 15, "#ffffff");
    drawText(ctx, `${Math.floor(state.travel)}m`, VIEW_W - 58, 23, 15, "#ffe14a");
    const weapon = WEAPONS[state.weapon] || WEAPONS[0];
    drawText(ctx, weapon.name, VIEW_W / 2, VIEW_H - 68, 14, weapon.color);
    const scale = 1 + state.crowdPunch * 0.15;
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H - 34);
    ctx.scale(scale, scale);
    roundRect(ctx, -34, -16, 68, 32, 8);
    ctx.fillStyle = "#2f7bff";
    ctx.fill();
    drawText(ctx, String(state.crowd), 0, 1, 20, "#ffffff");
    ctx.restore();
  }

  if (state.phase === "playing") {
    const alpha = Math.max(0, 1 - Math.max(0, state.hintT - 1.6) / 0.6);
    if (alpha > 0) {
      ctx.save();
      ctx.globalAlpha = alpha;
      roundRect(ctx, 48, 78, VIEW_W - 96, 32, 8);
      ctx.fillStyle = "rgba(20,24,32,.8)";
      ctx.fill();
      drawText(ctx, "Pistol first. Take the next gun.", VIEW_W / 2, 94, 14, "#ffffff");
      ctx.restore();
    }
    drawBossBar(ctx, state);
  }

  if (state.redFlash > 0) {
    ctx.fillStyle = `rgba(255,40,60,${state.redFlash * 0.28})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawOverlay(ctx, state) {
  if (state.phase === "playing") return;
  ctx.fillStyle = "rgba(12,16,24,.45)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cardY = 250;
  roundRect(ctx, 32, cardY, VIEW_W - 64, 200, 16);
  ctx.fillStyle = "rgba(16,20,28,.94)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#49b7ff";
  ctx.stroke();

  if (state.phase === "menu") {
    drawText(ctx, "CROWD FIRE", VIEW_W / 2, cardY + 48, 38, "#7ee7ff");
    drawText(
      ctx,
      state.bestMeters > 0 ? `Best ${state.bestMeters}m` : "One lane. It never ends.",
      VIEW_W / 2,
      cardY + 98,
      16,
      "#ffffff",
    );
    drawText(ctx, "Tap to start", VIEW_W / 2, cardY + 148, 20, "#ffffff");
    return;
  }
  if (state.phase === "gameover") {
    drawText(ctx, "WIPED OUT", VIEW_W / 2, cardY + 48, 34, "#ff5b6a");
    drawText(ctx, `Wave ${state.lastWave} · ${state.lastMeters}m`, VIEW_W / 2, cardY + 98, 16, "#ffffff");
    drawText(
      ctx,
      state.isBest ? "New best. Tap to retry" : `Best ${state.bestMeters}m · tap to retry`,
      VIEW_W / 2,
      cardY + 146,
      16,
      "#ffe14a",
    );
  }
}

export function renderHud(ctx, state) {
  drawFx(ctx, state);
  drawHud(ctx, state);
  drawOverlay(ctx, state);
}
