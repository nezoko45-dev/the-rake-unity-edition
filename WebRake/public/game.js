import * as THREE from 'three';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b120d);
scene.fog = new THREE.FogExp2(0x0b120d, 0.012);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 700);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0x9bb8a0, 0x152015, 1.25);
scene.add(hemi);
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
let myId = null;
let myHealth = 100;
const clock = new THREE.Clock();
const keys = new Set();
let yaw = 0;
let pitch = 0;
let mouseLocked = false;
const local = { x: 0, y: 1, z: 0 };
const rakeTarget = new THREE.Vector3();
let rakeRoot = null;
let rakeMixer = null;
const rakeActions = {};
let currentRakeAction = null;
let lastRakeWalking = false;
let lastRakeAttacking = false;

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
  const loader = new GLTFLoader();
  loader.load('/assets/rake.glb', gltf => {
    rakeRoot = gltf.scene;
    rakeRoot.scale.setScalar(1);
    rakeRoot.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(rakeRoot);

    if (gltf.animations?.length) {
      rakeMixer = new THREE.AnimationMixer(rakeRoot);

      for (const clip of gltf.animations) {
        const key = clip.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        rakeActions[key] = rakeMixer.clipAction(clip);
        console.log('Rake animation:', clip.name);
      }

      playRakeAnimation('idle');
    } else {
      console.warn('Rake GLB contains no animations.');
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
    const found = Object.keys(rakeActions).find(
      k => k.includes(normalized) || normalized.includes(k)
    );
    if (found) action = rakeActions[found];
  }

  if (!action || currentRakeAction === action) return;

  if (currentRakeAction) {
    currentRakeAction.fadeOut(.15);
  }

  action.reset().fadeIn(.15).play();
  currentRakeAction = action;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

const ws = new WebSocket(
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
);

ws.onopen = () => setStatus('Connected · finding players...');
ws.onclose = () => setStatus('Disconnected');
ws.onerror = () => setStatus('Connection error');

ws.onmessage = event => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'welcome') {
    myId = msg.id;
    setStatus(`Connected · Player ${myId}`);
  }

  if (msg.type === 'state') {
    applyState(msg);
  }
};

function applyState(state) {
  const aliveIds = new Set();

  for (const p of state.players) {
    aliveIds.add(p.id);

    if (p.id === myId) {
      local.x = p.x;
      local.y = p.y;
      local.z = p.z;
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

  // ================================================
  // AUTHORITATIVE RAKE POSITION
  // ================================================

  rakeTarget.set(
    state.rake.x,
    state.rake.y,
    state.rake.z
  );

  if (rakeRoot) {
    // Smooth visual interpolation without stopping the server movement.
    rakeRoot.position.lerp(rakeTarget, 0.65);

    // Server calculates the actual facing direction.
    if (Number.isFinite(state.rake.rot)) {
      rakeRoot.rotation.y = state.rake.rot;
    }
  }

  const walking = !!state.rake.walking;
  const attacking = !!state.rake.attacking;

  if (walking !== lastRakeWalking || attacking !== lastRakeAttacking) {
    if (attacking) {
      playRakeAnimation('attack');
    } else if (walking) {
      playRakeAnimation('walk');
    } else {
      playRakeAnimation('idle');
    }

    lastRakeWalking = walking;
    lastRakeAttacking = attacking;
  }

  // ================================================
  // SHARED DAY/NIGHT
  // ================================================

  const progress = state.cycle.night
    ? 1 - Math.min(1, state.cycle.timer / 450)
    : 1 - Math.min(1, state.cycle.timer / 150);

  const lightX = state.cycle.night
    ? THREE.MathUtils.lerp(270, 390, progress)
    : THREE.MathUtils.lerp(150, 270, progress);

  sun.rotation.x = THREE.MathUtils.degToRad(lightX);

  document.getElementById('cycle').textContent =
    `${state.cycle.night ? 'NIGHT' : 'DAY'} ${Math.ceil(state.cycle.timer)}`;

  document.getElementById('health').textContent =
    `HP ${myHealth}`;
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
  keys.add(e.code);
  sendInput();
});

addEventListener('keyup', e => {
  keys.delete(e.code);
  sendInput();
});

renderer.domElement.addEventListener(
  'click',
  () => renderer.domElement.requestPointerLock()
);

document.addEventListener('pointerlockchange', () => {
  mouseLocked =
    document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', e => {
  if (!mouseLocked) return;

  yaw -= e.movementX * .0025;
  pitch -= e.movementY * .0025;
  pitch = Math.max(-1.45, Math.min(1.45, pitch));
});

function render() {
  requestAnimationFrame(render);

  const dt = clock.getDelta();

  if (rakeMixer) {
    rakeMixer.update(dt);
  }

  camera.position.set(
    local.x,
    local.y + 1,
    local.z
  );

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  sendInput();

  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

loadRake();
render();
