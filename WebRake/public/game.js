import * as THREE from 'three';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b120d);
scene.fog = new THREE.FogExp2(0x0b120d, 0.009);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 700);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x9bb8a0, 0x152015, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(-60, 100, 30); sun.castShadow = true; scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshStandardMaterial({color:0x263525,roughness:1}));
ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
const treeMat=new THREE.MeshStandardMaterial({color:0x172318});
for(let i=0;i<130;i++){const h=5+Math.random()*6;const t=new THREE.Mesh(new THREE.CylinderGeometry(.35,.55,h,7),treeMat);t.position.set((Math.random()-.5)*360,h/2,(Math.random()-.5)*360);t.castShadow=true;scene.add(t);}

const playerMeshes=new Map(), clock=new THREE.Clock(), keys=new Set();
const local=new THREE.Vector3(0,1,0), rakeTarget=new THREE.Vector3();
let myId=null,myHealth=100,yaw=0,pitch=0,pointerLocked=false,gameMode='multiplayer';
let rakeRoot=null,rakeMixer=null,currentRakeAction=null,lastRakeWalking=null,lastRakeAttacking=null;
const rakeActions={}; const PLAYER_SPEED=7; let lastAttack=0;
function setStatus(t){const e=document.getElementById('status');if(e)e.textContent=t;}
function makePlayerMesh(){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.45,1,6,12),new THREE.MeshStandardMaterial({color:0xd5d5d5}));body.position.y=1;body.castShadow=true;g.add(body);return g;}
function playRakeAnimation(name){
 if(!rakeMixer)return; const n=name.toLowerCase().replace(/[^a-z0-9]/g,'');
 let a=rakeActions[n]; if(!a){const k=Object.keys(rakeActions).find(x=>x.includes(n)||n.includes(x));if(k)a=rakeActions[k];}
 if(!a||a===currentRakeAction)return;if(currentRakeAction)currentRakeAction.fadeOut(.15);a.reset().fadeIn(.15).play();currentRakeAction=a;
}
function fitModel(gltf,filename='Rake'){
 if(rakeRoot)scene.remove(rakeRoot);
 rakeRoot=new THREE.Group();rakeRoot.name='RakeRoot';scene.add(rakeRoot);
 const model=gltf.scene;model.name='RakeModel';
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scale=3.2/(Math.max(size.x,size.y,size.z)||1);model.scale.setScalar(scale);
 model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
 model.rotation.y=Math.PI;rakeRoot.add(model);
 rakeMixer=null;for(const k of Object.keys(rakeActions))delete rakeActions[k];currentRakeAction=null;
 if(gltf.animations?.length){rakeMixer=new THREE.AnimationMixer(model);for(const clip of gltf.animations){const key=clip.name.toLowerCase().replace(/[^a-z0-9]/g,'');rakeActions[key]=rakeMixer.clipAction(clip);}playRakeAnimation('idle');}
 setStatus('Loaded '+filename+(gltf.animations?.length?' · '+gltf.animations.length+' animations':''));
}
function loadRake(){new GLTFLoader().load('/assets/rake.glb',fitModel,undefined,err=>{console.warn('Bundled Rake model unavailable:',err);setStatus('Rake model missing · choose a .glb below');});}
function loadCustomRake(file){
 const url=URL.createObjectURL(file);
 new GLTFLoader().load(url,g=>fitModel(g,file.name),undefined,err=>{console.error(err);setStatus('Could not load model. For .gltf, keep its texture files beside it.');});
 // Keep the blob URL alive because external buffers/textures can be resolved after the main GLTF load.
}
const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
ws.onopen=()=>setStatus('Connected · click game to capture mouse');
ws.onclose=()=>setStatus('Disconnected · restart the game');
ws.onerror=()=>setStatus('Connection error');
ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='welcome'){myId=m.id;setStatus('Player '+myId+' · WASD to move');}if(m.type==='state')applyState(m);if(m.type==='full')setStatus(m.message||'Server full');};
function applyState(s){
 const alive=new Set();
 for(const p of s.players){
  alive.add(p.id);
  if(p.id===myId){local.lerp(new THREE.Vector3(p.x,p.y,p.z),.4);myHealth=p.health;continue;}
  let m=playerMeshes.get(p.id);if(!m){m=makePlayerMesh();playerMeshes.set(p.id,m);scene.add(m);}
  m.position.set(p.x,p.y,p.z);m.rotation.y=p.rot||0;
  if(p.isBot)m.children[0].material.color.setHex(0x39c8a0);
  else m.children[0].material.color.setHex(0xd5d5d5);
 }
 for(const [id,m] of playerMeshes)if(!alive.has(id)){scene.remove(m);playerMeshes.delete(id);}
 rakeTarget.set(s.rake.x,s.rake.y,s.rake.z);if(rakeRoot){rakeRoot.position.lerp(rakeTarget,.75);rakeRoot.rotation.y=s.rake.rot||0;}
 const walking=!!s.rake.walking,attacking=!!s.rake.attacking,stunned=!!s.rake.stunned;
 const anim=stunned?'idle':attacking?'attack':walking?'walk':'idle';
 const prev=[lastRakeWalking,lastRakeAttacking,lastRakeStunned].join(',');
 if(prev!==[walking,attacking,stunned].join(','))playRakeAnimation(anim);
 lastRakeWalking=walking;lastRakeAttacking=attacking;lastRakeStunned=stunned;
 const cycle=document.getElementById('cycle'),health=document.getElementById('health'),rh=document.getElementById('rake-health'),be=document.getElementById('bots-status');
 if(cycle)cycle.textContent=(s.cycle.night?'NIGHT ':'DAY ')+Math.ceil(s.cycle.timer);
 if(health)health.textContent='HP '+Math.ceil(myHealth);
 if(rh)rh.textContent='RAKE '+Math.ceil(s.rake.health??1000);
 if(be)be.textContent='ALLIES '+s.players.filter(p=>p.isBot).length;
}
let lastRakeStunned=null;
function send(obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function sendInput(){
 const f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),r=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 // Server rotates movement using the same yaw as the local first-person camera.
 send({type:'input',f,b:0,l:0,r:0,wx:(r*Math.cos(yaw)+f*Math.sin(yaw)),wz:(-r*Math.sin(yaw)+f*Math.cos(yaw)),rot:yaw});
}
addEventListener('keydown',e=>{
 if(['KeyW','KeyA','KeyS','KeyD','Space','KeyF'].includes(e.code))e.preventDefault();
 if(!keys.has(e.code)){
  if(e.code==='Space'){send({type:'charge',rot:yaw});setStatus('CHARGING · close in on the Rake');}
  if(e.code==='KeyF'&&Date.now()-lastAttack>250){send({type:'attack'});lastAttack=Date.now();}
 }
 keys.add(e.code);
});
addEventListener('keyup',e=>keys.delete(e.code));
renderer.domElement.addEventListener('click',()=>{if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock();});
document.addEventListener('pointerlockchange',()=>{pointerLocked=document.pointerLockElement===renderer.domElement;if(!pointerLocked)setStatus('Click game to capture mouse');});
document.addEventListener('mousemove',e=>{if(!pointerLocked)return;yaw-=e.movementX*.0025;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0025,-1.45,1.45);});
const modeSelect=document.getElementById('mode');
if(modeSelect)modeSelect.addEventListener('change',()=>{gameMode=modeSelect.value;send({type:'mode',mode:gameMode,bots:document.getElementById('bot-count')?.value||3});setStatus(gameMode==='solo'?'SOLO · survive the hunt':gameMode==='ai'?'AI SQUAD · fight alongside rangers':'MULTIPLAYER · connected to server');});
const botCount=document.getElementById('bot-count');
if(botCount)botCount.addEventListener('change',()=>{if(gameMode==='ai')send({type:'mode',mode:'ai',bots:botCount.value});});
const picker=document.getElementById('model-picker');if(picker)picker.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadCustomRake(f);});
function updateLocal(dt){
 const f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),r=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),len=Math.hypot(f,r);
 if(len){const F=f/len,R=r/len;local.x+=(R*Math.cos(yaw)+F*Math.sin(yaw))*PLAYER_SPEED*dt;local.z+=(-R*Math.sin(yaw)+F*Math.cos(yaw))*PLAYER_SPEED*dt;}
 local.x=THREE.MathUtils.clamp(local.x,-180,180);local.z=THREE.MathUtils.clamp(local.z,-180,180);
}
function render(){
 requestAnimationFrame(render);const dt=Math.min(clock.getDelta(),.05);updateLocal(dt);sendInput();if(rakeMixer)rakeMixer.update(dt);
 camera.position.set(local.x,local.y+1.65,local.z);camera.rotation.order='YXZ';camera.rotation.y=yaw;camera.rotation.x=pitch;renderer.render(scene,camera);
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
loadRake();render();
