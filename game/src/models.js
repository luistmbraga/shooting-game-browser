import * as THREE from "three";

/** Primitive low-poly silhouettes (CC0-style); replace with glTF from Quaternius/Kenney if added under public/models/. */

export function createSoldierGeometry() {
  const body = new THREE.CapsuleGeometry(0.22, 0.32, 4, 8);
  body.translate(0, 0.42, 0);
  const head = new THREE.SphereGeometry(0.18, 8, 8);
  head.translate(0, 0.78, 0);
  return mergeGeometries([body, head]);
}

/** Handheld gun for one soldier. Origin at the grip; barrel aims down +Z (road ahead). */
export function createWeaponGeometry(kind = "pistol") {
  if (kind === "rocket") {
    const tube = new THREE.CylinderGeometry(0.07, 0.09, 0.55, 8);
    tube.rotateX(Math.PI / 2);
    tube.translate(0, 0, -0.18);
    const tip = new THREE.CylinderGeometry(0.04, 0.07, 0.16, 8);
    tip.rotateX(Math.PI / 2);
    tip.translate(0, 0, -0.52);
    const grip = new THREE.BoxGeometry(0.08, 0.14, 0.1);
    grip.translate(0, -0.1, 0.02);
    return mergeGeometries([tube, tip, grip]);
  }
  if (kind === "machinegun") {
    const receiver = new THREE.BoxGeometry(0.1, 0.1, 0.32);
    receiver.translate(0, 0, -0.06);
    const barrel = new THREE.CylinderGeometry(0.028, 0.032, 0.48, 6);
    barrel.rotateX(Math.PI / 2);
    barrel.translate(0, 0.02, -0.42);
    const mag = new THREE.BoxGeometry(0.06, 0.16, 0.08);
    mag.translate(0, -0.1, -0.02);
    const stock = new THREE.BoxGeometry(0.07, 0.08, 0.18);
    stock.translate(0, 0, 0.18);
    return mergeGeometries([receiver, barrel, mag, stock]);
  }
  // pistol
  const slide = new THREE.BoxGeometry(0.08, 0.1, 0.22);
  slide.translate(0, 0.02, -0.06);
  const barrel = new THREE.CylinderGeometry(0.022, 0.025, 0.16, 6);
  barrel.rotateX(Math.PI / 2);
  barrel.translate(0, 0.03, -0.24);
  const grip = new THREE.BoxGeometry(0.07, 0.14, 0.09);
  grip.translate(0, -0.08, 0.04);
  return mergeGeometries([slide, barrel, grip]);
}

export function createTankGeometry() {
  const hull = new THREE.BoxGeometry(1.6, 0.35, 2.2);
  hull.translate(0, 0.28, 0);
  const trackL = new THREE.BoxGeometry(0.22, 0.28, 2.35);
  trackL.translate(-0.82, 0.18, 0);
  const trackR = trackL.clone();
  trackR.translate(1.64, 0, 0);
  const turret = new THREE.BoxGeometry(0.55, 0.28, 0.55);
  turret.translate(0, 0.58, -0.15);
  const barrel = new THREE.CylinderGeometry(0.08, 0.08, 0.85, 8);
  barrel.rotateX(Math.PI / 2);
  barrel.translate(0, 0.62, -0.72);
  return mergeGeometries([hull, trackL, trackR, turret, barrel]);
}

export function createCannonGeometry() {
  const base = new THREE.BoxGeometry(1.4, 0.45, 1.4);
  base.translate(0, 0.32, 0);
  const barrel = new THREE.CylinderGeometry(0.2, 0.22, 1.1, 10);
  barrel.rotateX(Math.PI / 2);
  barrel.translate(0, 0.55, -0.75);
  return mergeGeometries([base, barrel]);
}

function mergeGeometries(parts) {
  const geos = parts.map((g) => {
    const c = g.clone();
    c.computeVertexNormals();
    return c;
  });
  const merged = mergeBufferGeometries(geos);
  for (const g of geos) g.dispose();
  merged.computeVertexNormals();
  return merged;
}

function mergeBufferGeometries(geometries) {
  let totalVerts = 0;
  let totalIdx = 0;
  let hasIndex = true;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    if (g.index) totalIdx += g.index.count;
    else hasIndex = false;
  }
  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indices = hasIndex ? new Uint32Array(totalIdx) : null;
  let vOff = 0;
  let iOff = 0;
  let vertBase = 0;
  for (const g of geometries) {
    const pos = g.attributes.position.array;
    const nor = g.attributes.normal?.array;
    positions.set(pos, vOff * 3);
    if (nor) normals.set(nor, vOff * 3);
    else g.computeVertexNormals();
    if (nor) normals.set(g.attributes.normal.array, vOff * 3);
    if (g.index && indices) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i++) indices[iOff + i] = idx[i] + vertBase;
      iOff += idx.length;
    }
    vertBase += g.attributes.position.count;
    vOff += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  if (indices) out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

export function makeToonMaterial(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function makeLabelSprite(text, { width = 256, height = 128, fontSize = 72, bg = null } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d");
  if (bg) {
    c.fillStyle = bg;
    roundRect(c, 8, 8, width - 16, height - 16, 16);
    c.fill();
  }
  c.font = `800 ${fontSize}px Impact, "Arial Black", sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = Math.max(4, fontSize * 0.12);
  c.strokeStyle = "rgba(0,0,0,.85)";
  c.strokeText(text, width / 2, height / 2);
  c.fillStyle = "#ffffff";
  c.fillText(text, width / 2, height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sprite = new THREE.Sprite(mat);
  const aspect = width / height;
  sprite.scale.set(1.8 * aspect, 1.8, 1);
  sprite.userData.dispose = () => tex.dispose();
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
