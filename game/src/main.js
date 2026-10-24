import { VIEW_H, VIEW_W, createGame } from "./game.js";
import { renderHud } from "./hud.js";
import { createView3d } from "./view3d.js";

const stage = document.querySelector("#stage");
const canvas = document.querySelector("#game");
const hudCanvas = document.querySelector("#hud");
const hudCtx = hudCanvas.getContext("2d");
const api = createGame();
const view = createView3d(canvas);

const input = {
  pointerActive: false,
  pointerX: VIEW_W / 2,
  pointerSerial: 0,
  left: false,
  right: false,
  pressed: false,
};

let serial = 0;
let dpr = 1;
let lastPointAt = 0;

function toGameX(clientX) {
  const rect = stage.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * VIEW_W;
}

function pointAt(clientX) {
  input.pointerX = toGameX(clientX);
  input.pointerSerial = ++serial;
  input.pointerActive = true;
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const cssW = Math.floor(VIEW_W * scale);
  const cssH = Math.floor(VIEW_H * scale);
  stage.style.width = `${cssW}px`;
  stage.style.height = `${cssH}px`;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  hudCanvas.style.width = `${cssW}px`;
  hudCanvas.style.height = `${cssH}px`;
  hudCanvas.width = Math.round(VIEW_W * dpr);
  hudCanvas.height = Math.round(VIEW_H * dpr);
  view.resize(VIEW_W, VIEW_H, dpr);
}

window.addEventListener("resize", resize);
resize();

function arm(clientX) {
  lastPointAt = performance.now();
  pointAt(clientX);
  input.pressed = true;
}

stage.addEventListener("contextmenu", (e) => e.preventDefault());
stage.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  canvas.setPointerCapture?.(e.pointerId);
  arm(e.clientX);
});
stage.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  if (performance.now() - lastPointAt < 40) return;
  arm(e.clientX);
});
stage.addEventListener("pointermove", (e) => {
  if (!input.pointerActive) return;
  pointAt(e.clientX);
});
window.addEventListener("mousemove", (e) => {
  if (!input.pointerActive) return;
  if (performance.now() - lastPointAt < 40) return;
  pointAt(e.clientX);
});
window.addEventListener("pointerup", () => {
  input.pointerActive = false;
});
window.addEventListener("mouseup", () => {
  input.pointerActive = false;
});
window.addEventListener("pointercancel", () => {
  input.pointerActive = false;
});

window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "a" || e.key === "ArrowLeft") {
    input.left = true;
    api.nudge(-1);
  }
  if (e.key === "d" || e.key === "ArrowRight") {
    input.right = true;
    api.nudge(1);
  }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    input.pressed = true;
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "a" || e.key === "ArrowLeft") input.left = false;
  if (e.key === "d" || e.key === "ArrowRight") input.right = false;
});
window.addEventListener("blur", () => {
  input.left = false;
  input.right = false;
  input.pointerActive = false;
});

let last = performance.now();
function tick() {
  const now = performance.now();
  let dt = (now - last) / 1000;
  if (dt < 0.001) return;
  last = now;
  dt = Math.min(0.034, dt);
  api.update(dt, input);
  input.pressed = false;
  view.sync(api.state);
  hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hudCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  renderHud(hudCtx, api.state);
}
function frame() {
  tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
setInterval(tick, 16);
