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
const DAY_LENGTH = 150, NIGHT_LENGTH = 450;
const ATTACK_DISTANCE = 8, ATTACK_DAMAGE = 25, ATTACK_COOLDOWN = 1.35;
const PLAYER_SPEED = 7, RAKE_SPEED = 7, RAKE_CHASE_SPEED = 12;
const ARENA = 180, CELL = 6;
const players = new Map(), sockets = new Map(), bots = new Map();
let nextId = 1, isNight = true, cycleTimer = NIGHT_LENGTH, lastTick = Date.now();
let attackCooldown = 0, rakeStun = 0, rakeHealth = 1000, rakeCharge = 0, rakeParryUntil = 0;
const rake = { x: 0, y: 0, z: 0, rot: 0, attacking: false, walking: false, stunned: false, health: rakeHealth };
app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));
const rakeCandidates = [
 path.join(__dirname, '..', 'Assets', 'rake 45 more improvements!.glb'),
 path.join(process.resourcesPath || '', 'Assets', 'rake 45 more improvements!.glb'),
 path.join(process.resourcesPath || '', 'Assets', 'rake.glb')
];
app.get('/assets/rake.glb', (req, res) => {
 const file = rakeCandidates.find(candidate => candidate && fs.existsSync(candidate));
 return file ? res.sendFile(file) : res.status(404).send('No bundled Rake GLB. Use the in-game GLB picker.');
});
app.get('/health', (req, res) => res.json({ ok:true, players:players.size, bots:bots.size, night:isNight, timer:cycleTimer, rake }));

function send(ws, msg) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); }
function broadcast(msg, exceptId=null) { const d=JSON.stringify(msg); for (const [id,ws] of sockets) if (id!==exceptId && ws.readyState===ws.OPEN) ws.send(d); }
function randomSpawn() { const a=Math.random()*Math.PI*2, r=18+Math.random()*32; return {x:Math.cos(a)*r,y:1,z:Math.sin(a)*r}; }
function newPlayer(id,name,isBot=false) { const s=randomSpawn(); return {id,name,x:s.x,y:1,z:s.z,rot:0,health:100,input:{f:0,b:0,l:0,r:0},chargeUntil:0,stunUntil:0,isBot}; }
function snapshot() {
  return {type:'state',cycle:{timer:cycleTimer,night:isNight},rake:{...rake},players:[...players.values(),...bots.values()].map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,rot:p.rot,health:p.health,name:p.name,isBot:p.isBot,charging:Date.now()<p.chargeUntil}))};
}
function dist(a,b) { return Math.hypot(a.x-b.x,a.z-b.z); }

// Grid A* used by the Rake and allied bots. Trees are decorative, so the grid is open,
// but search still routes around arena bounds and gives agents waypoint-based steering.
function astar(start,target) {
 const toCell=v=>Math.round(v/CELL), key=(x,z)=>x+','+z;
 const sx=toCell(start.x), sz=toCell(start.z), tx=toCell(target.x), tz=toCell(target.z);
 const open=[{x:sx,z:sz,g:0,f:Math.abs(tx-sx)+Math.abs(tz-sz)}], came=new Map(), scores=new Map([[key(sx,sz),0]]), closed=new Set();
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 let found=null, iterations=0;
 while(open.length && iterations++<1200) {
   open.sort((a,b)=>a.f-b.f); const cur=open.shift(), ck=key(cur.x,cur.z);
   if(closed.has(ck)) continue; closed.add(ck);
   if(Math.abs(cur.x-tx)+Math.abs(cur.z-tz)<=1){found=cur;break;}
   for(const [dx,dz] of dirs) {
     const x=cur.x+dx,z=cur.z+dz;if(Math.abs(x*CELL)>ARENA||Math.abs(z*CELL)>ARENA)continue;
     const k=key(x,z), ng=cur.g+(dx&&dz?1.414:1);
     if(closed.has(k)||ng>=(scores.get(k)??Infinity))continue;
     scores.set(k,ng);came.set(k,ck);open.push({x,z,g:ng,f:ng+Math.abs(tx-x)+Math.abs(tz-z)});
   }
 }
 if(!found)return [target];
 const route=[];let k=key(found.x,found.z);
 while(k){const [x,z]=k.split(',').map(Number);route.push({x:x*CELL,z:z*CELL});if(k===key(sx,sz))break;k=came.get(k);}
 route.reverse();route.push({x:target.x,z:target.z});return route;
}
function moveToward(actor,target,speed,dt) {
 let dx=target.x-actor.x,dz=target.z-actor.z,d=Math.hypot(dx,dz);
 if(d<.1)return false;
 actor.rot=Math.atan2(dx,dz);
 const route=actor.route;
 if(!route||!actor.routeAt||Date.now()>actor.routeAt||actor.routeTargetDist>8||Math.random()<.015){
   actor.route=astar(actor,target);actor.routeAt=Date.now()+900;actor.routeTargetDist=d;
 }
 let waypoint=actor.route?.[Math.min(1,actor.route.length-1)]||target;
 dx=waypoint.x-actor.x;dz=waypoint.z-actor.z;d=Math.hypot(dx,dz);
 if(d<1.5){actor.route?.shift();waypoint=actor.route?.[0]||target;dx=waypoint.x-actor.x;dz=waypoint.z-actor.z;d=Math.hypot(dx,dz);}
 const step=Math.min(d,speed*dt);actor.x+=dx/(d||1)*step;actor.z+=dz/(d||1)*step;
 actor.x=Math.max(-ARENA,Math.min(ARENA,actor.x));actor.z=Math.max(-ARENA,Math.min(ARENA,actor.z));
 return step>.001;
}
function resetActor(p){const s=randomSpawn();p.x=s.x;p.z=s.z;p.health=100;p.chargeUntil=0;}
function targetList(){return [...players.values(),...bots.values()].filter(p=>p.health>0);}
function hitRake(actor, charging) {
 const d=dist(actor,rake);if(d>ATTACK_DISTANCE||Date.now()<rakeStun)return false;
 if(charging) {
   if(Date.now()<rakeParryUntil) { actor.health=Math.max(0,actor.health-15); actor.stunUntil=Date.now()+800; return true; }
   rakeHealth=Math.max(0,rakeHealth-110);rakeStun=Date.now()+2200;rakeParryUntil=0;
 } else { rakeHealth=Math.max(0,rakeHealth-18); }
 rake.health=rakeHealth;return true;
}
wss.on('connection',ws=>{
 if(players.size>=MAX_PLAYERS){send(ws,{type:'full',message:'Server is full'});ws.close();return;}
 const id=String(nextId++),p=newPlayer(id,'Player '+id);
 players.set(id,p);sockets.set(id,ws);
 send(ws,{type:'welcome',id,maxPlayers:MAX_PLAYERS,playerSpeed:PLAYER_SPEED});send(ws,snapshot());broadcast({type:'join',player:{id,x:p.x,y:p.y,z:p.z,rot:0,health:100,name:p.name}},id);
 ws.on('message',raw=>{
  let msg;try{msg=JSON.parse(raw.toString());}catch{return;}const actor=players.get(id);if(!actor)return;
  if(msg.type==='input'){actor.input={f:clamp(msg.f),b:clamp(msg.b),l:clamp(msg.l),r:clamp(msg.r),wx:clamp(msg.wx),wz:clamp(msg.wz)};if(Number.isFinite(msg.rot))actor.rot=msg.rot;}
  if(msg.type==='charge'){actor.chargeUntil=Date.now()+1100;actor.rot=Number.isFinite(msg.rot)?msg.rot:actor.rot;}
  if(msg.type==='attack')hitRake(actor,Date.now()<actor.chargeUntil);
  if(msg.type==='mode'&&msg.mode==='ai'){const count=Math.max(1,Math.min(6,Number(msg.bots)||3));while(bots.size<count){const bid='AI-'+(bots.size+1);bots.set(bid,newPlayer(bid,'Ranger '+(bots.size+1),true));}while(bots.size>count)bots.delete([...bots.keys()].pop());}
  if(msg.type==='mode'&&msg.mode!=='ai')bots.clear();
 });
 ws.on('close',()=>{players.delete(id);sockets.delete(id);broadcast({type:'leave',id});});
});
function clamp(v){return Math.max(-1,Math.min(1,Number(v)||0));}
function update(dt){
 cycleTimer-=dt;if(cycleTimer<=0){isNight=!isNight;cycleTimer=isNight?NIGHT_LENGTH:DAY_LENGTH;}
 const now=Date.now();
 for(const p of [...players.values(),...bots.values()]){
  if(p.health<=0){resetActor(p);continue;}
  if(p.isBot){
   const d=dist(p,rake);
   if(d>ATTACK_DISTANCE){p.chargeUntil=now+1300;moveToward(p,rake,9,dt);}
   else hitRake(p,now<p.chargeUntil);
   // If the Rake is close, AI fighters hold their ground instead of orbiting.
  }else{
   const x=Number.isFinite(p.input.wx)?p.input.wx:(p.input.r-p.input.l),z=Number.isFinite(p.input.wz)?p.input.wz:(p.input.b-p.input.f),len=Math.hypot(x,z);
   if(len>0){p.x+=x/(len||1)*PLAYER_SPEED*dt;p.z+=z/(len||1)*PLAYER_SPEED*dt;}
   p.x=Math.max(-ARENA,Math.min(ARENA,p.x));p.z=Math.max(-ARENA,Math.min(ARENA,p.z));
  }
 }
 rake.walking=false;rake.attacking=false;rake.stunned=now<rakeStun;
 const targets=targetList();
 if(rake.stunned){rake.walking=false;}
 else if(isNight&&targets.length){
  let target=targets.reduce((best,p)=>dist(rake,p)<dist(rake,best)?p:best,targets[0]);
  const d=dist(rake,target);
  if(d>ATTACK_DISTANCE)rake.walking=moveToward(rake,target,RAKE_CHASE_SPEED,dt);
  else{
   rake.attacking=true;
   if(attackCooldown<=0){
    if(now<target.chargeUntil){rakeParryUntil=now+800;target.health=Math.max(0,target.health-35);target.stunUntil=now+900;}
    else target.health-=ATTACK_DAMAGE;
    attackCooldown=ATTACK_COOLDOWN;
    if(target.health<=0)resetActor(target);
   }
  }
 }else if(!isNight){rake.walking=moveToward(rake,{x:0,z:0},RAKE_SPEED,dt);}
 attackCooldown=Math.max(0,attackCooldown-dt);
 if(rakeHealth<=0){rakeHealth=1000;rake.health=rakeHealth;rakeStun=now+5000;}
}
setInterval(()=>{const now=Date.now(),dt=Math.min(.1,(now-lastTick)/1000);lastTick=now;update(dt);broadcast(snapshot());},50);
function startServer(port = PORT) {
 return new Promise((resolve, reject) => {
  const onError = error => { server.off('listening', onListening); reject(error); };
  const onListening = () => { server.off('error', onError); const actualPort = server.address().port; console.log('The Rake server running at http://127.0.0.1:' + actualPort); resolve(actualPort); };
  server.once('error', onError); server.once('listening', onListening); server.listen(port, '127.0.0.1');
 });
}
if (require.main === module) startServer().catch(err => { console.error(err); process.exitCode = 1; });
module.exports = { startServer };
