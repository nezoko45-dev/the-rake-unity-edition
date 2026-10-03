const express=require('express');
const http=require('http');
const path=require('path');
const fs=require('fs');
const {WebSocketServer}=require('ws');
const app=express(),server=http.createServer(app),wss=new WebSocketServer({server,path:'/ws'});
const PORT=Number(process.env.PORT||3000),DAY=150,NIGHT=450,SPEED=19,ATTACK_RANGE=8,DAMAGE=45,COOLDOWN=8;
let night=true,timer=NIGHT,last=Date.now(),attack=0;
const players=new Map(),sockets=new Map();let id=1;
const rake={x:0,y:1,z:0,rot:0,walking:false,attacking:false};
app.use(express.static(path.join(__dirname,'public')));app.use('/three',express.static(path.join(__dirname,'node_modules/three')));
const glb=path.join(__dirname,'..','Assets','rake 45 more improvements!.glb');
app.get('/assets/rake.glb',(q,r)=>fs.existsSync(glb)?r.sendFile(glb):r.status(404).send('GLB missing'));
function send(w,m){if(w.readyState===w.OPEN)w.send(JSON.stringify(m));}
function state(){return{type:'state',cycle:{timer,night},rake:{...rake},players:[...players.values()].map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,rot:p.rot,health:p.health}))};}
function spawn(){const a=Math.random()*Math.PI*2,r=20+Math.random()*15;return{x:Math.cos(a)*r,y:1,z:Math.sin(a)*r};}
wss.on('connection',ws=>{const i=String(id++),s=spawn();const p={id:i,x:s.x,y:s.y,z:s.z,rot:0,health:100,input:{f:0,b:0,l:0,r:0}};players.set(i,p);sockets.set(i,ws);send(ws,{type:'welcome',id:i});send(ws,state());ws.on('message',raw=>{try{const m=JSON.parse(raw);if(m.type==='input'){p.input={f:+m.f||0,b:+m.b||0,l:+m.l||0,r:+m.r||0};p.rot=Number.isFinite(m.rot)?m.rot:p.rot;}}catch{}});ws.on('close',()=>{players.delete(i);sockets.delete(i);});});
function move(tx,tz,dt){const dx=tx-rake.x,dz=tz-rake.z,d=Math.hypot(dx,dz);if(d<=.01)return false;const step=Math.min(d,SPEED*dt);rake.x+=dx/d*step;rake.z+=dz/d*step;rake.rot=Math.atan2(dx,dz);return true;}
function tick(dt){timer-=dt;if(timer<=0){night=!night;timer=night?NIGHT:DAY;console.log(night?'NIGHT: Rake hunting':'DAY: Rake returning');}for(const p of players.values()){const x=p.input.r-p.input.l,z=p.input.b-p.input.f,d=Math.hypot(x,z);if(d){p.x+=x/d*7*dt;p.z+=z/d*7*dt;}}
rake.walking=false;rake.attacking=false;let target=null,best=Infinity;
if(night){for(const p of players.values()){if(p.health<=0)continue;const d=Math.hypot(p.x-rake.x,p.z-rake.z);if(d<best){best=d;target=p;}}if(target){if(best>ATTACK_RANGE)rake.walking=move(target.x,target.z,dt);else{rake.attacking=true;rake.rot=Math.atan2(target.x-rake.x,target.z-rake.z);}if(best<=ATTACK_RANGE&&attack<=0){target.health-=DAMAGE;attack=COOLDOWN;if(target.health<=0){const s=spawn();target.x=s.x;target.y=s.y;target.z=s.z;target.health=100;}}}}
attack=Math.max(0,attack-dt);}
setInterval(()=>{const now=Date.now(),dt=Math.min(.1,Math.max(.001,(now-last)/1000));last=now;tick(dt);const data=JSON.stringify(state());for(const w of sockets.values())if(w.readyState===w.OPEN)w.send(data);},50);
server.listen(PORT,()=>console.log(`DIRECT Rake AI server: http://localhost:${PORT} | starts NIGHT`));
