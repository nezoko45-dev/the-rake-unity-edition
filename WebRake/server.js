const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 16;
const DAY_LENGTH = 150;
const NIGHT_LENGTH = 450;
const ATTACK_DISTANCE = 8;
const ATTACK_DAMAGE = 45;
const ATTACK_COOLDOWN = 8;
const PLAYER_SPEED = 7;
const RAKE_SPEED = 7;
const RAKE_CHASE_SPEED = 19;

// DEVELOPMENT BUILD: start directly in NIGHT so the Rake hunts immediately.
// Set START_IN_NIGHT to false before publishing the normal day-start build.
const START_IN_NIGHT = true;

const players = new Map();
const sockets = new Map();
let nextId = 1;
let cycleTimer = START_IN_NIGHT ? NIGHT_LENGTH : DAY_LENGTH;
let isNight = START_IN_NIGHT;
let lastTick = Date.now();
let attackCooldown = 0;

const rake = {
  x: 0,
  y: 0,
  z: 0,
  spawnX: 0,
  spawnY: 0,
  spawnZ: 0,
  rot: 0,
  attacking: false,
  walking: false
};

app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));

const rakeGlb = path.join(__dirname, '..', 'Assets', 'rake 45 more improvements!.glb');
app.get('/assets/rake.glb', (req, res) => {
  if (!fs.existsSync(rakeGlb)) {
    return res.status(404).send('Rake GLB not found at Assets/rake 45 more improvements!.glb');
  }
  res.sendFile(rakeGlb);
});

app.get('/health', (req, res) => res.json({
  ok: true,
  players: players.size,
  night: isNight,
  timer: cycleTimer,
  rake: { x: rake.x, y: rake.y, z: rake.z, walking: rake.walking, attacking: rake.attacking }
}));

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(message, exceptId = null) {
  const data = JSON.stringify(message);
  for (const [id, ws] of sockets) {
    if (id !== exceptId && ws.readyState === ws.OPEN) ws.send(data);
  }
}

function randomSpawn() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 18 + Math.random() * 18;
  return { x: Math.cos(angle) * radius, y: 1, z: Math.sin(angle) * radius };
}

function snapshot() {
  return {
    type: 'state',
    cycle: { timer: cycleTimer, night: isNight },
    rake: {
      x: rake.x,
      y: rake.y,
      z: rake.z,
      rot: rake.rot,
      attacking: rake.attacking,
      walking: rake.walking
    },
    players: [...players.values()].map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      rot: p.rot,
      health: p.health,
      name: p.name
    }))
  };
}

wss.on('connection', (ws) => {
  if (players.size >= MAX_PLAYERS) {
    send(ws, { type: 'full', message: 'The Rake server is full.' });
    ws.close();
    return;
  }

  const id = String(nextId++);
  const spawn = randomSpawn();
  const player = {
    id,
    name: `Player ${id}`,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    rot: 0,
    health: 100,
    input: { f: 0, b: 0, l: 0, r: 0 }
  };

  players.set(id, player);
  sockets.set(id, ws);

  send(ws, { type: 'welcome', id, maxPlayers: MAX_PLAYERS, playerSpeed: PLAYER_SPEED });
  send(ws, snapshot());
  broadcast({ type: 'join', player: { id, x: player.x, y: player.y, z: player.z, rot: 0, health: 100, name: player.name } }, id);

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const p = players.get(id);
    if (!p) return;

    if (msg.type === 'input') {
      p.input = {
        f: Math.max(-1, Math.min(1, Number(msg.f) || 0)),
        b: Math.max(-1, Math.min(1, Number(msg.b) || 0)),
        l: Math.max(-1, Math.min(1, Number(msg.l) || 0)),
        r: Math.max(-1, Math.min(1, Number(msg.r) || 0))
      };
      if (Number.isFinite(msg.rot)) p.rot = msg.rot;
    }
  });

  ws.on('close', () => {
    players.delete(id);
    sockets.delete(id);
    broadcast({ type: 'leave', id });
  });
});

function update(dt) {
  cycleTimer -= dt;

  if (cycleTimer <= 0) {
    if (isNight) {
      isNight = false;
      cycleTimer = DAY_LENGTH;
      console.log('RAKE: DAY - RETREATING');
    } else {
      isNight = true;
      cycleTimer = NIGHT_LENGTH;
      console.log('RAKE: NIGHT - HUNTING');
    }
  }

  for (const p of players.values()) {
    const x = p.input.r - p.input.l;
    const z = p.input.b - p.input.f;
    const len = Math.hypot(x, z);
    if (len > 0) {
      p.x += (x / len) * PLAYER_SPEED * dt;
      p.z += (z / len) * PLAYER_SPEED * dt;
    }
    p.x = Math.max(-180, Math.min(180, p.x));
    p.z = Math.max(-180, Math.min(180, p.z));
  }

  rake.attacking = false;
  rake.walking = false;

  if (!isNight) {
    rake.walking = moveRakeToward(
      rake.spawnX,
      rake.spawnY,
      rake.spawnZ,
      RAKE_SPEED,
      dt
    );
  } else {
    let closest = null;
    let best = Infinity;

    for (const p of players.values()) {
      if (p.health <= 0) continue;

      const d = Math.hypot(
        p.x - rake.x,
        p.z - rake.z
      );

      if (d < best) {
        best = d;
        closest = p;
      }
    }

    if (closest) {
      if (best > ATTACK_DISTANCE) {
        rake.walking = moveRakeToward(
          closest.x,
          closest.y,
          closest.z,
          RAKE_CHASE_SPEED,
          dt
        );
      } else {
        rake.attacking = true;
        rake.walking = false;
      }

      if (best <= ATTACK_DISTANCE && attackCooldown <= 0) {
        closest.health -= ATTACK_DAMAGE;
        attackCooldown = ATTACK_COOLDOWN;

        console.log(
          `RAKE: attacked Player ${closest.id} for ${ATTACK_DAMAGE}`
        );

        if (closest.health <= 0) {
          closest.health = 0;

          const s = randomSpawn();
          closest.x = s.x;
          closest.y = s.y;
          closest.z = s.z;
          closest.health = 100;

          console.log(`RAKE: Player ${closest.id} respawned`);
        }
      }
    }
  }

  attackCooldown = Math.max(0, attackCooldown - dt);
}

function moveRakeToward(tx, ty, tz, speed, dt) {
  const dx = tx - rake.x;
  const dz = tz - rake.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= 0.05) {
    return false;
  }

  rake.rot = Math.atan2(dx, dz);

  const step = Math.min(distance, speed * dt);

  rake.x += (dx / distance) * step;
  rake.z += (dz / distance) * step;
  rake.y = ty;

  return step > 0;
}

setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;

  update(dt);
  broadcast(snapshot());
}, 50);

server.listen(PORT, () => {
  console.log(`The Rake server running at http://localhost:${PORT}`);
  console.log(`LAN: http://<YOUR-PC-IP>:${PORT}`);
  console.log(`DEVELOPMENT MODE: starts in NIGHT (${NIGHT_LENGTH}s)`);
  console.log(`Normal cycle: Day ${DAY_LENGTH}s | Night ${NIGHT_LENGTH}s`);
  console.log(`Rake chase speed: ${RAKE_CHASE_SPEED}`);
});
