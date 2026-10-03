import * as THREE from 'three';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b120d);
scene.fog = new THREE.FogExp2(0x0b120d, 0.012);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 700);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9bb8a0, 0x152015, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(-60, 100, 30);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.MeshStandardMaterial({ color: 0x263525, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const treeMat = new THREE.MeshStandardMaterial({ color: 0x172318 });
for (let i = 0; i < 130; i++) {
  const h = 5 + Math.random() * 6;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.35, .55, h, 7), treeMat);
  trunk.position.set((Math.random() - .5) * 360, h / 2, (Math.random() - .5) * 360);
  scene.add(trunk);
}

const playerMeshes = new Map();
const clock = new THREE.Clock();
const keys = new Set();
const local = new THREE.Vector3(0, 1, 0);
let myId = null;
let myHealth = 100;
let yaw = 0;
let pitch = 0;
let pointerLocked = false;
const PLAYER_SPEED = 7;

let rakeRoot = null;
let rakeMixer = null;
const rakeActions = {};
let currentRakeAction = null;
let lastRakeWalking = null;
let lastRakeAttacking = null;
const rakeTarget = new THREE.Vector3();

function makePlayerMesh(isLocal = false) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(.45, 1, 6, 12),
    new THREE.MeshStandardMaterial({ color: isLocal ? 0x4c77ff : 0xd5d5d5 })
  );
  body.position.y = 1;
  body.castShadow = true;
  group.add(body);
  return group;
}

function loadRake() {
  new GLTFLoader().load('/assets/rake.glb', gltf => {
    rakeRoot = new THREE.Group();
    rakeRoot.name = 'RakeRoot';
    scene.add(rakeRoot);

    const model = gltf.scene;
    model.name = 'RakeModel';
    model.position.set(0, 0, 0);
    model.rotation.set(0, THREE.MathUtils.degToRad(180), 0);
    model.scale.setScalar(1);

    model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    rakeRoot.add(model);

    if (gltf.animations?.length) {
      rakeMixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        const key = clip.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        rakeActions[key] = rakeMixer.clipAction(clip);
        console.log('Rake animation:', clip.name);
      }
      playRakeAnimation('idle');
    }
  }, undefined, err => {
    console.error('Failed to load Rake GLB:', err);
    setStatus('Rake model failed to load');
  });
}

function playRakeAnimation(name) {
  if (!rakeMixer) return;
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  let action = rakeActions[normalized];
  if (!action) {
    const found = Object.keys(rakeActions).find(k => k.includes(normalized) || normalized.includes(k));
    if (found) action = rakeActions[found];
  }
  if (!action || currentRakeAction === action) return;
  if (currentRakeAction) currentRakeAction.fadeOut(.12);
  action.reset().fadeIn(.12).play();
  currentRakeAction = action;
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
ws.onopen = () => setStatus('Connected · click to look around');
ws.onclose = () => setStatus('Disconnected');
ws.onerror = () => setStatus('Connection error');

ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'welcome') {
    myId = msg.id;
    setStatus(`Player ${myId} · WASD + mouse`);
    local.set(0, 1, 0);
  }
  if (msg.type === 'state') applyState(msg);
};

function applyState(state) {
  const aliveIds = new Set();

  for (const p of state.players) {
    aliveIds.add(p.id);
    if (p.id === myId) {
      const serverPos = new THREE.Vector3(p.x, p.y, p.z);
      if (local.distanceTo(serverPos) > 5) local.lerp(serverPos, 0.35);
      myHealth = p.health;
      continue;
    }

    let mesh = playerMeshes.get(p.id);
    if (!mesh) {
      mesh = makePlayerMesh(false);
      playerMeshes.set(p.id, mesh);
      scene.add(mesh);
    }
    mesh.position.set(p.x, p.y, p.z);
    mesh.rotation.y = p.rot;
  }

  for (const [id, mesh] of playerMeshes) {
    if (!aliveIds.has(id)) {
      scene.remove(mesh);
      playerMeshes.delete(id);
    }
  }

  rakeTarget.set(state.rake.x, state.rake.y, state.rake.z);
  if (rakeRoot) {
    rakeRoot.position.lerp(rakeTarget, 0.75);
    if (Number.isFinite(state.rake.rot)) rakeRoot.rotation.y = state.rake.rot;
  }

  const walking = !!state.rake.walking;
  const attacking = !!state.rake.attacking;
  if (walking !== lastRakeWalking || attacking !== lastRakeAttacking) {
    playRakeAnimation(attacking ? 'attack' : walking ? 'walk' : 'idle');
    lastRakeWalking = walking;
    lastRakeAttacking = attacking;
  }

  const progress = state.cycle.night
    ? 1 - Math.min(1, state.cycle.timer / 450)
    : 1 - Math.min(1, state.cycle.timer / 150);
  const lightX = state.cycle.night
    ? THREE.MathUtils.lerp(270, 390, progress)
    : THREE.MathUtils.lerp(150, 270, progress);
  sun.rotation.x = THREE.MathUtils.degToRad(lightX);

  const cycle = document.getElementById('cycle');
  const health = document.getElementById('health');
  if (cycle) cycle.textContent = `${state.cycle.night ? 'NIGHT' : 'DAY'} ${Math.ceil(state.cycle.timer)}`;
  if (health) health.textContent = `HP ${myHealth}`;
}

function sendInput() {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'input',
    f: keys.has('KeyW') ? 1 : 0,
    b: keys.has('KeyS') ? 1 : 0,
    l: keys.has('KeyA') ? 1 : 0,
    r: keys.has('KeyD') ? 1 : 0,
    rot: yaw
  }));
}

addEventListener('keydown', e => {
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));

renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  setStatus(pointerLocked ? 'WASD to move · mouse to look · ESC releases mouse' : 'Click to capture mouse');
});
document.addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  yaw -= e.movementX * 0.0025;
  pitch -= e.movementY * 0.0025;
  pitch = THREE.MathUtils.clamp(pitch, -1.45, 1.45);
});

function updateLocalMovement(dt) {
  let forward = 0;
  let strafe = 0;
  if (keys.has('KeyW')) forward += 1;
  if (keys.has('KeyS')) forward -= 1;
  if (keys.has('KeyD')) strafe += 1;
  if (keys.has('KeyA')) strafe -= 1;
  if (forward === 0 && strafe === 0) return;

  const length = Math.hypot(forward, strafe);
  forward /= length;
  strafe /= length;

  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const dx = strafe * cos + forward * sin;
  const dz = -strafe * sin + forward * cos;

  local.x += dx * PLAYER_SPEED * dt;
  local.z += dz * PLAYER_SPEED * dt;
  local.x = THREE.MathUtils.clamp(local.x, -180, 180);
  local.z = THREE.MathUtils.clamp(local.z, -180, 180);
}

function render() {
  requestAnimationFrame(render);
  const dt = Math.min(clock.getDelta(), 0.05);

  updateLocalMovement(dt);
  sendInput();
  if (rakeMixer) rakeMixer.update(dt);

  camera.position.set(local.x, local.y + 1.65, local.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

loadRake();
render();
