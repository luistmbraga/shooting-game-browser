import * as THREE from "three";
import { VIEW_H, VIEW_W, WEAPONS, crowdRadius, formation, lanePixel } from "./game.js";
import {
  formationOffsetWorld,
  fracToWorldX,
  gameZToWorld,
  pxToWorldX,
  ROAD_HALF,
} from "./coords.js";
import {
  createCannonGeometry,
  createSoldierGeometry,
  createTankGeometry,
  createWeaponGeometry,
  makeLabelSprite,
  makeToonMaterial,
} from "./models.js";

const VISUAL_CAP = 110;
const PACK_VISUAL_CAP = 72;
const ZERO_SCALE = 0.0001;

const tempObj = new THREE.Object3D();
const colorTmp = new THREE.Color();
const bossNdc = new THREE.Vector3();

const sharedResources = new Set();

function disposeObject(obj) {
  obj.traverse((ch) => {
    if (ch.geometry && !sharedResources.has(ch.geometry)) ch.geometry.dispose();
    if (ch.material) {
      const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
      for (const m of mats) {
        if (sharedResources.has(m)) continue;
        if (m.map && !sharedResources.has(m.map)) m.map.dispose();
        m.dispose();
      }
    }
    if (ch.userData.dispose) ch.userData.dispose();
  });
}

export function createView3d(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0xc5cad4, 1);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc5cad4);
  scene.fog = new THREE.Fog(0xc5cad4, 35, 130);

  const camera = new THREE.PerspectiveCamera(68, VIEW_W / VIEW_H, 0.2, 220);
  const camBase = new THREE.Vector3(0, 13, -7);
  const camLook = new THREE.Vector3(0, 0, 8);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9098, 0.72));
  const sun = new THREE.DirectionalLight(0xfff4e8, 1.15);
  sun.position.set(6, 18, 4);
  scene.add(sun);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0xe4e7ee });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF * 2 + 1.2, 280), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, 95);
  scene.add(road);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x9aa1b0 });
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 280), wallMat);
  wallL.position.set(-ROAD_HALF - 0.85, 0.15, 95);
  const wallR = wallL.clone();
  wallR.position.x = ROAD_HALF + 0.85;
  scene.add(wallL, wallR);

  const grid = new THREE.GridHelper(ROAD_HALF * 2, 8, 0xffffff, 0xffffff);
  grid.material.opacity = 0.22;
  grid.material.transparent = true;
  grid.position.set(0, 0.02, 95);
  grid.scale.z = 14;
  scene.add(grid);

  const soldierGeo = createSoldierGeometry();
  const tankGeo = createTankGeometry();
  const cannonGeo = createCannonGeometry();
  const pistolGeo = createWeaponGeometry("pistol");
  const machinegunGeo = createWeaponGeometry("machinegun");
  const rocketGeo = createWeaponGeometry("rocket");
  sharedResources.add(soldierGeo);
  sharedResources.add(tankGeo);
  sharedResources.add(cannonGeo);
  sharedResources.add(pistolGeo);
  sharedResources.add(machinegunGeo);
  sharedResources.add(rocketGeo);

  const playerMat = makeToonMaterial(0x2f7bff);
  sharedResources.add(playerMat);
  const playerMesh = new THREE.InstancedMesh(soldierGeo, playerMat, VISUAL_CAP);
  playerMesh.frustumCulled = false;
  scene.add(playerMesh);

  const playerTankMat = makeToonMaterial(0x163a5f);
  sharedResources.add(playerTankMat);
  const playerTanks = new THREE.InstancedMesh(tankGeo, playerTankMat, VISUAL_CAP);
  playerTanks.frustumCulled = false;
  playerTanks.visible = false;
  scene.add(playerTanks);

  const weaponMats = {
    pistol: makeToonMaterial(0xd7dde8),
    machinegun: makeToonMaterial(0x3dce4a),
    rocket: makeToonMaterial(0xff9a1f),
  };
  for (const mat of Object.values(weaponMats)) sharedResources.add(mat);
  const playerWeapons = {
    pistol: new THREE.InstancedMesh(pistolGeo, weaponMats.pistol, VISUAL_CAP),
    machinegun: new THREE.InstancedMesh(machinegunGeo, weaponMats.machinegun, VISUAL_CAP),
    rocket: new THREE.InstancedMesh(rocketGeo, weaponMats.rocket, VISUAL_CAP),
  };
  for (const mesh of Object.values(playerWeapons)) {
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
  }

  const propsRoot = new THREE.Group();
  scene.add(propsRoot);

  const shotsRoot = new THREE.Group();
  scene.add(shotsRoot);

  const shotGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
  shotGeo.rotateX(Math.PI / 2);
  const shotMat = new THREE.MeshBasicMaterial({
    color: 0x5adcf5,
    transparent: true,
    opacity: 0.92,
  });
  const rocketMat = new THREE.MeshBasicMaterial({ color: 0xff9a1f });
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });
  const shotCoreMat = new THREE.MeshBasicMaterial({ color: 0xf4fdff });
  sharedResources.add(shotGeo);
  sharedResources.add(shotMat);
  sharedResources.add(rocketMat);
  sharedResources.add(shellMat);
  sharedResources.add(shotCoreMat);

  const packMeshes = new Map();
  const enemyGunMat = makeToonMaterial(0x4a5160);
  sharedResources.add(enemyGunMat);
  let menuGroup = null;

  function hideInstance(mesh, i) {
    tempObj.position.set(0, -50, 0);
    tempObj.scale.setScalar(ZERO_SCALE);
    tempObj.updateMatrix();
    mesh.setMatrixAt(i, tempObj.matrix);
  }

  function placeInstance(mesh, i, x, y, z, scale, rotY = 0) {
    tempObj.position.set(x, y, z);
    tempObj.rotation.set(0, rotY, 0);
    if (typeof scale === "number") tempObj.scale.setScalar(scale);
    else tempObj.scale.set(scale.x, scale.y, scale.z);
    tempObj.updateMatrix();
    mesh.setMatrixAt(i, tempObj.matrix);
  }

  function clearFrameProps() {
    while (propsRoot.children.length) {
      const ch = propsRoot.children.pop();
      disposeObject(ch);
    }
    while (shotsRoot.children.length) {
      const ch = shotsRoot.children.pop();
      disposeObject(ch);
    }
    if (menuGroup) {
      scene.remove(menuGroup);
      disposeObject(menuGroup);
      menuGroup = null;
    }
  }

  function prunePacks(state) {
    const active = new Set(state.entities.filter((e) => e.type === "pack"));
    for (const [pack, entry] of packMeshes) {
      if (!active.has(pack)) {
        scene.remove(entry.body);
        scene.remove(entry.guns);
        disposeObject(entry.body);
        disposeObject(entry.guns);
        packMeshes.delete(pack);
      }
    }
  }

  function addGate(state, e) {
    const z = gameZToWorld(e.z);
    if (z < -8 || z > 115) return;
    const x0 = fracToWorldX(e.x0, state);
    const x1 = fracToWorldX(e.x1, state);
    const cx = (x0 + x1) * 0.5;
    const w = Math.max(0.5, x1 - x0);
    colorTmp.set(e.color);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(w, 1.1, 0.35),
      makeToonMaterial(colorTmp.getHex())
    );
    post.position.set(cx, 0.55, z);
    propsRoot.add(post);
    const long = e.label.length > 8;
    const label = makeLabelSprite(e.label, {
      width: long ? 420 : 200,
      height: 100,
      fontSize: long ? 40 : 64,
      bg: e.color,
    });
    if (long) label.scale.set(4.4, 1.15, 1);
    label.position.set(cx, 1.35, z);
    propsRoot.add(label);
  }

  function addObstacle(state, e) {
    const z = gameZToWorld(e.z);
    if (z < -8 || z > 115) return;
    const x0 = fracToWorldX(e.x0, state);
    const x1 = fracToWorldX(e.x1, state);
    const cx = (x0 + x1) * 0.5;
    const w = Math.max(0.6, x1 - x0);
    const geo = e.kind === "tank" ? tankGeo : cannonGeo;
    const tint = e.kind === "tank" ? 0x7fd4ff : 0x49b7ff;
    const body = new THREE.Mesh(geo, makeToonMaterial(tint));
    const visualW = Math.min(w, 2.3);
    body.scale.set(visualW / 1.6, 1.15, 1.15);
    body.position.set(cx, 0, z);
    propsRoot.add(body);
    const hp = makeLabelSprite(String(Math.ceil(e.hp)), { width: 180, height: 90, fontSize: 56 });
    hp.position.set(cx, 1.5, z);
    propsRoot.add(hp);
    if (e.bonus) {
      const bonus = makeLabelSprite(e.bonusLabel, {
        width: 200,
        height: 100,
        fontSize: 52,
        bg: e.bonusColor,
      });
      bonus.position.set(cx, 2.35, z);
      propsRoot.add(bonus);
    }
  }

  function addBoss(state, boss) {
    const z = gameZToWorld(boss.z);
    if (z < -10 || z > 115) return;
    const cx = fracToWorldX((boss.x0 + boss.x1) * 0.5, state);
    const scale = 2.4;
    const body = new THREE.Mesh(soldierGeo, makeToonMaterial(0xe23b3b));
    body.scale.setScalar(scale);
    body.position.set(cx, 0, z);
    propsRoot.add(body);
    const gun = new THREE.Mesh(rocketGeo, makeToonMaterial(0xff9a1f));
    gun.scale.setScalar(scale * 0.95);
    gun.position.set(cx + 0.28 * scale, 0.48 * scale, z + 0.05 * scale);
    propsRoot.add(gun);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.45, 6),
      makeToonMaterial(0xf6d34a)
    );
    crown.position.set(cx, 2.1, z - 0.2);
    propsRoot.add(crown);
  }

  function syncPack(state, pack) {
    const z = gameZToWorld(pack.z);
    if (z < -12 || z > 115) return;
    let entry = packMeshes.get(pack);
    const visual = Math.min(Math.ceil(pack.count), PACK_VISUAL_CAP);
    if (!entry || entry.body.count !== visual) {
      if (entry) {
        scene.remove(entry.body);
        scene.remove(entry.guns);
        disposeObject(entry.body);
        disposeObject(entry.guns);
      }
      colorTmp.set(pack.tint);
      const body = new THREE.InstancedMesh(soldierGeo, makeToonMaterial(colorTmp.getHex()), visual);
      const guns = new THREE.InstancedMesh(pistolGeo, enemyGunMat, visual);
      body.frustumCulled = false;
      guns.frustumCulled = false;
      scene.add(body, guns);
      entry = { body, guns };
      packMeshes.set(pack, entry);
    }
    const x0 = fracToWorldX(pack.x0, state);
    const x1 = fracToWorldX(pack.x1, state);
    const laneW = Math.abs(x1 - x0);
    const scale = 1.7;
    // Capsule diameter is 0.44; keep a gap so bodies don't occupy the same spot.
    const step = 0.44 * scale * 1.35;
    const maxCols = Math.max(1, Math.floor((laneW + step * 0.2) / step));
    const cols = Math.min(visual, maxCols);
    const span = (cols - 1) * step;
    const left = Math.min(x0, x1);
    const originX = left + (laneW - span) * 0.5;
    for (let i = 0; i < entry.body.count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = originX + c * step;
      const pz = z - r * step;
      placeInstance(entry.body, i, x, 0, pz, scale);
      placeInstance(entry.guns, i, x + 0.28 * scale, 0.48 * scale, pz + 0.05 * scale, scale * 0.95);
    }
    entry.body.instanceMatrix.needsUpdate = true;
    entry.guns.instanceMatrix.needsUpdate = true;
    const mid = (x0 + x1) * 0.5;
    const plate = makeLabelSprite(String(Math.ceil(pack.count)), {
      width: 160,
      height: 80,
      fontSize: 44,
      bg: "#2f6dff",
    });
    plate.position.set(mid, 1.2, z + 0.3);
    propsRoot.add(plate);
  }

  function activeWeaponId(state) {
    const spec = WEAPONS[state.weapon] || WEAPONS[0];
    if (spec.id === "tank") return "rocket";
    return spec.id;
  }

  function syncPlayer(state) {
    const n = Math.min(state.crowd, VISUAL_CAP);
    const radius = crowdRadius(Math.max(n, 1));
    const pts = formation(n, radius);
    const originX = pxToWorldX(lanePixel(state), state);
    const mounted = state.vehicle === "tank" && state.crowd > 0 && state.phase === "playing";
    // Short personal tanks: wide enough to read, short enough to sit under one soldier.
    const tankScale = { x: 0.46, y: 0.5, z: 0.3 };
    const deckY = 0.46 * tankScale.y;
    const baseWidth = ((radius * 2) / 178) * 4;
    const baseDepth = ((radius * 0.86 * 2) / 44) * 0.85;
    const spreadX = mounted ? Math.min(3.4, 6.4 / Math.max(baseWidth, 0.35)) : 1;
    const spreadZ = mounted ? Math.min(4.6, 4.2 / Math.max(baseDepth, 0.25)) : 1;
    const weaponId = activeWeaponId(state);
    const showGuns = !mounted && state.phase === "playing" && state.crowd > 0;

    for (let i = 0; i < VISUAL_CAP; i++) {
      if (i >= pts.length || state.crowd <= 0 || state.phase !== "playing") {
        hideInstance(playerMesh, i);
        hideInstance(playerTanks, i);
        for (const mesh of Object.values(playerWeapons)) hideInstance(mesh, i);
        continue;
      }
      const bob = Math.sin(state.time * 8 + i) * 0.02;
      const off = formationOffsetWorld(pts[i][0] * spreadX, pts[i][1] * spreadZ, state);
      const x = originX + off.x;
      const z = off.z;
      const scale = mounted ? (n === 1 ? 1.55 : 1.2) : n === 1 ? 2.5 : 1.7;
      if (mounted) {
        placeInstance(playerTanks, i, x, 0, z, tankScale, Math.PI);
        placeInstance(playerMesh, i, x, deckY + bob, z - 0.22, scale);
        for (const mesh of Object.values(playerWeapons)) hideInstance(mesh, i);
      } else {
        hideInstance(playerTanks, i);
        placeInstance(playerMesh, i, x, bob, z, scale);
        // Grip sits at the soldier's right side; scale with the body.
        const gunScale = scale * 0.95;
        const gunX = x + 0.28 * scale;
        const gunY = bob + 0.48 * scale;
        const gunZ = z - 0.05 * scale;
        for (const [id, mesh] of Object.entries(playerWeapons)) {
          if (id === weaponId) placeInstance(mesh, i, gunX, gunY, gunZ, gunScale, Math.PI);
          else hideInstance(mesh, i);
        }
      }
    }
    playerMesh.instanceMatrix.needsUpdate = true;
    playerTanks.instanceMatrix.needsUpdate = true;
    for (const mesh of Object.values(playerWeapons)) mesh.instanceMatrix.needsUpdate = true;
    playerMesh.visible = state.phase === "playing" && state.crowd > 0;
    playerTanks.visible = mounted;
    for (const [id, mesh] of Object.entries(playerWeapons)) {
      mesh.visible = showGuns && id === weaponId;
    }
  }

  function syncShots(state) {
    if (state.phase !== "playing") return;
    const py = state.lane.playerY;
    for (const shot of state.shots) {
      const tipZ = gameZToWorld(shot.z);
      const tailZ = gameZToWorld(shot.z - shot.len);
      const x = pxToWorldX(shot.x, state);
      const len = Math.max(0.15, tipZ - tailZ);
      const midZ = (tipZ + tailZ) * 0.5;
      const heavy = shot.kind === "rocket" || shot.kind === "tank";
      const mat = shot.kind === "rocket" ? rocketMat : shot.kind === "tank" ? shellMat : shotMat;
      const girth = heavy ? 2.6 : 1;
      const bolt = new THREE.Mesh(shotGeo, mat);
      bolt.scale.set(girth, len, girth);
      bolt.position.set(x, heavy ? 0.85 : 0.65, midZ);
      shotsRoot.add(bolt);
      const core = new THREE.Mesh(shotGeo, shotCoreMat);
      core.scale.set(girth * 0.45, len, girth * 0.45);
      core.position.set(x, heavy ? 0.85 : 0.65, midZ);
      shotsRoot.add(core);
    }
    for (const muzzle of state.muzzles) {
      const x = pxToWorldX(muzzle.x, state);
      const z = gameZToWorld(py - muzzle.y);
      const t = 1 - muzzle.age / muzzle.life;
      const heavy = muzzle.kind === "rocket" || muzzle.kind === "tank";
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry((heavy ? 0.28 : 0.12) * t, 8, 8),
        new THREE.MeshBasicMaterial({
          color: muzzle.kind === "rocket" ? 0xff9a1f : muzzle.kind === "tank" ? 0xffe14a : 0xbef5ff,
          transparent: true,
          opacity: t,
        })
      );
      sph.position.set(x, 0.5, z);
      shotsRoot.add(sph);
    }
  }

  function syncMenuSample(state) {
    menuGroup = new THREE.Group();
    const redMat = makeToonMaterial(0xe23b3b);
    const demo = new THREE.InstancedMesh(soldierGeo, redMat, 36);
    const demoGuns = new THREE.InstancedMesh(pistolGeo, enemyGunMat, 36);
    demo.frustumCulled = false;
    demoGuns.frustumCulled = false;
    for (let i = 0; i < 36; i++) {
      const c = i % 6;
      const r = Math.floor(i / 6);
      const x = -1.65 + c * 0.66;
      const z = 9 - r * 0.66;
      const scale = 0.75;
      placeInstance(demo, i, x, 0, z, scale);
      placeInstance(demoGuns, i, x + 0.28 * scale, 0.48 * scale, z + 0.05 * scale, scale * 0.95);
    }
    demo.instanceMatrix.needsUpdate = true;
    demoGuns.instanceMatrix.needsUpdate = true;
    menuGroup.add(demo, demoGuns);
    const gate = makeLabelSprite("+3", { width: 200, height: 100, fontSize: 64, bg: "#2f8cff" });
    gate.position.set(fracToWorldX(0.78, state), 1.2, 6.2);
    menuGroup.add(gate);
    const solo = new THREE.Mesh(soldierGeo, playerMat);
    solo.position.set(0, 0, 1.2);
    solo.scale.setScalar(1.1);
    const soloGun = new THREE.Mesh(pistolGeo, weaponMats.pistol);
    soloGun.position.set(0.28 * 1.1, 0.48 * 1.1, 1.2 - 0.05 * 1.1);
    soloGun.scale.setScalar(1.1 * 0.95);
    soloGun.rotation.y = Math.PI;
    menuGroup.add(solo, soloGun);
    scene.add(menuGroup);
  }

  function syncBossAnchor(state) {
    state.bossAnchor = null;
    if (state.phase !== "playing") return;
    const boss = state.entities.find((e) => e.type === "boss" && e.hp > 0);
    if (!boss) return;
    const z = gameZToWorld(boss.z);
    if (z < -4 || z > 120) return;
    camera.updateMatrixWorld();
    bossNdc.set(fracToWorldX((boss.x0 + boss.x1) * 0.5, state), 2.7, z);
    bossNdc.project(camera);
    if (bossNdc.z < -1 || bossNdc.z > 1) return;
    state.bossAnchor = {
      x: (bossNdc.x * 0.5 + 0.5) * VIEW_W,
      y: (-bossNdc.y * 0.5 + 0.5) * VIEW_H,
    };
  }

  function sync(state) {
    clearFrameProps();
    prunePacks(state);

    const shake = state.shake * 0.35;
    camera.position.set(
      camBase.x + Math.sin(state.time * 50) * shake,
      camBase.y + Math.cos(state.time * 42) * shake * 0.5,
      camBase.z
    );
    camera.lookAt(
      camLook.x + Math.sin(state.time * 37) * shake * 0.3,
      camLook.y,
      camLook.z
    );
    syncBossAnchor(state);

    playerMesh.visible = false;
    playerTanks.visible = false;
    for (const mesh of Object.values(playerWeapons)) mesh.visible = false;

    if (state.phase === "menu") {
      syncMenuSample(state);
      renderer.render(scene, camera);
      return;
    }

    const gates = state.entities
      .filter((e) => e.type === "gate" || e.type === "upgrade")
      .sort((a, b) => b.z - a.z);
    for (const g of gates) addGate(state, g);
    const packs = state.entities.filter((e) => e.type === "pack").sort((a, b) => b.z - a.z);
    for (const p of packs) syncPack(state, p);
    for (const b of state.entities.filter((e) => e.type === "boss")) addBoss(state, b);
    for (const o of state.entities.filter((e) => e.type === "obstacle")) addObstacle(state, o);

    syncShots(state);
    syncPlayer(state);

    renderer.render(scene, camera);
  }

  function resize(width, height, dpr) {
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return { sync, resize };
}
