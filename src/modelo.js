import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Visual presentation model: independent, simplified exterior surfaces.
const host = document.querySelector('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (error) {
  document.querySelector('#fallback').style.display = 'flex';
  document.querySelector('#loading').hidden = true;
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .92;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#0b1319', .028);
const camera = new THREE.PerspectiveCamera(37, 1, .05, 70);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .055;
controls.enablePan = false;
controls.minPolarAngle = .26;
controls.maxPolarAngle = Math.PI * .485;
controls.autoRotateSpeed = .48;
controls.rotateSpeed = .65;
controls.zoomSpeed = .8;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .04).texture;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight('#d7e6ea', '#29343b', .85));
const keyLight = new THREE.DirectionalLight('#ffedd5', 3.2);
keyLight.position.set(-3.5, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
Object.assign(keyLight.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 20 });
keyLight.shadow.bias = -.0004;
keyLight.shadow.normalBias = .025;
keyLight.shadow.radius = 4;
scene.add(keyLight);
const fill = new THREE.DirectionalLight('#cee8ff', .8);
fill.position.set(5, 3, -4);
scene.add(fill);
const rim = new THREE.DirectionalLight('#9ce2e8', 1.25);
rim.position.set(-4, 2.5, -5);
scene.add(rim);
const glow = new THREE.PointLight('#68e6e3', 1.3, 8, 1.6);
glow.position.set(0, .35, 0);
scene.add(glow);
const interiorGlow = new THREE.PointLight('#8be9e1', .8, 4, 1.3);
interiorGlow.position.set(0, 1.05, 0);
scene.add(interiorGlow);

function material(color, roughness = .5, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
const palette = {
  shell: material('#e6ddc8', .39, .075),
  edge: material('#d8d1bd', .27, .48),
  inside: material('#1c2930', .8, .08),
  glass: new THREE.MeshPhysicalMaterial({ color: '#0e1b20', roughness: .08, metalness: .12, transparent: true, opacity: .56, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: .6 }),
  cyan: new THREE.MeshStandardMaterial({ color: '#85f0e9', emissive: '#3ccdc6', emissiveIntensity: 2, roughness: .28 }),
  trim: material('#6b4933', .31, .65),
  leather: material('#6c3f27', .72, 0),
  leatherSoft: material('#946345', .82, 0),
  base: material('#141c22', .38, .22),
};
palette.shell.side = THREE.DoubleSide;
palette.shell.envMapIntensity = .8;
const product = new THREE.Group();
scene.add(product);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material('#080f14', .6, .2));
floor.material.envMapIntensity = .25;
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.01;
floor.receiveShadow = true;
scene.add(floor);
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.12, 3.2, .07, 96), material('#0d1920', .48, .2));
plinth.material.envMapIntensity = .3;
plinth.position.y = -.03;
plinth.receiveShadow = true;
scene.add(plinth);

function mesh(geometry, mat, parent = product) {
  const object = new THREE.Mesh(geometry, mat);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function rounded(size, position, mat, radius = .04, parent = product) {
  const object = mesh(new RoundedBoxGeometry(...size, 3, radius), mat, parent);
  object.position.set(...position);
  return object;
}
function lineBetween(a, b, radius, mat, parent = product) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const object = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 10), mat, parent);
  object.position.copy(start.add(end).multiplyScalar(.5));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return object;
}
// Broad silhouette only; no fabrication or component geometry.
rounded([3.48, .07, 3.48], [0, .065, 0], palette.edge, .018);
rounded([3.37, .045, 3.37], [0, .095, 0], palette.inside, .015);
for (let i = 0; i < 4; i++) {
  const border = new THREE.Group();
  border.rotation.y = i * Math.PI / 2;
  product.add(border);
  lineBetween([-1.72, .085, 1.72], [1.72, .085, 1.72], .012, palette.cyan, border);
}

function faceTexture(black) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const c = canvas.getContext('2d');
  c.fillStyle = black ? '#25282b' : '#e6ddc8';
  c.fillRect(0, 0, 1024, 1024);
  const wash = c.createLinearGradient(0, 0, 1024, 1024);
  wash.addColorStop(0, black ? '#ffffff04' : '#ffffff0c');
  wash.addColorStop(1, '#00000009');
  c.fillStyle = wash; c.fillRect(0, 0, 1024, 1024);
  c.strokeStyle = black ? '#adb9ba38' : '#6b6a5442';
  c.lineWidth = 1.35;
  const cx = 512, cy = 570;
  for (const r of [84, 104, 129]) {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
  }
  c.beginPath(); c.ellipse(cx, cy, 58, 123, -.5, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.ellipse(cx, cy, 123, 48, -.5, 0, Math.PI * 2); c.stroke();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + .25;
    c.beginPath(); c.arc(cx + Math.cos(a) * 129, cy + Math.sin(a) * 129, 3, 0, Math.PI * 2); c.stroke();
  }
  c.lineWidth = 1;
  for (const y of [825, 911]) { c.beginPath(); c.moveTo(125, y); c.lineTo(899, y); c.stroke(); }
  for (let i = 0; i < 9; i++) {
    const x = 224 + i * 72;
    c.beginPath(); c.arc(x, 868, 12, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(x - 8, 860); c.lineTo(x + 8, 876); c.moveTo(x + 8, 860); c.lineTo(x - 8, 876); c.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
const textures = { ivory: faceTexture(false), black: faceTexture(true) };
palette.shell.color.set('#ffffff');
palette.shell.map = textures.ivory;

const doors = [];
const HINGE_Y = 1.66;
function createFace(rotation, canOpen) {
  const pivot = new THREE.Group();
  const orientation = new THREE.Group();
  orientation.rotation.y = rotation;
  product.add(orientation);
  pivot.position.set(0, HINGE_Y, .43);
  orientation.add(pivot);
  const vertices = [-1.7, -1.55, 1.27, 1.7, -1.55, 1.27, .43, 0, 0, -.43, 0, 0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, .6265, 1, .3735, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  mesh(geometry, palette.shell, pivot);
  const corners = [[-1.7,-1.55,1.27],[1.7,-1.55,1.27],[.43,0,0],[-.43,0,0]];
  for(let i=0;i<4;i++) lineBetween(corners[i], corners[(i+1)%4], .016, palette.edge, pivot);
  // Decorative light lines follow the exterior, without revealing construction.
  lineBetween(corners[1], corners[2], .006, palette.cyan, pivot);
  const band = .29;
  const halfWidth = .43 + 1.27 * band;
  lineBetween([-halfWidth,-1.55*band-.002,1.27*band+.007],[halfWidth,-1.55*band-.002,1.27*band+.007], .004, palette.cyan, pivot);
  if (canOpen) {
    doors.push(pivot);
    const handle = lineBetween([-.18,-1.07,.895],[.18,-1.07,.895], .014, palette.trim, pivot);
    handle.castShadow = true;
  }
}
createFace(0, true);
createFace(Math.PI / 2, true);
createFace(Math.PI, false);
createFace(-Math.PI / 2, false);

const top = new THREE.Vector3(0, 2.23, 0);
const crownCorners = [[-.43,1.66,.43],[.43,1.66,.43],[.43,1.66,-.43],[-.43,1.66,-.43]];
for(let i=0;i<4;i++) {
  const a = crownCorners[i], b = crownCorners[(i+1)%4];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a,...b,...top.toArray()],3));
  g.computeVertexNormals();
  const glass = mesh(g,palette.glass);
  glass.castShadow = false;
  lineBetween(a,b,.011,palette.edge);
  lineBetween(a,top.toArray(),.011,palette.edge);
}
const cap = mesh(new THREE.ConeGeometry(.065,.085,4),palette.edge);
cap.position.y = 2.23;
cap.rotation.y = Math.PI / 4;

// A sculptural lounge seat suggests the experience when the doors open.
const chair = new THREE.Group();
chair.rotation.y = -.12;
chair.position.set(-.12, 0, -.12);
product.add(chair);
rounded([.74,.19,1.07],[0,.235,0],palette.base,.075,chair);
const seat = rounded([.68,.18,.67],[0,.6,.14],palette.leatherSoft,.08,chair);
seat.rotation.x = .12;
const back = rounded([.69,.19,.94],[0,.94,-.48],palette.leather,.095,chair);
back.rotation.x = -.88;
const headrest = rounded([.57,.18,.24],[0,1.27,-.77],palette.leatherSoft,.075,chair);
headrest.rotation.x = -.88;
const calves = rounded([.64,.15,.55],[0,.47,.65],palette.leather,.065,chair);
calves.rotation.x = .35;
const foot = rounded([.62,.14,.29],[0,.34,.99],palette.leatherSoft,.055,chair);
foot.rotation.x = .45;
for (const x of [-.42,.42]) {
  const arm = rounded([.13,.14,.62],[x,.81,.05],palette.leather,.055,chair);
  arm.rotation.x = .06;
}

function radialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  const grad = c.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'#ffffff55'); grad.addColorStop(.35,'#ffffff22'); grad.addColorStop(1,'#ffffff00');
  c.fillStyle = grad;c.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}
const haloMat = new THREE.MeshBasicMaterial({ map:radialTexture(), color:'#47d7db', transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:.55 });
const halo = new THREE.Mesh(new THREE.PlaneGeometry(6.5,6.5),haloMat);
halo.rotation.x = -Math.PI/2;
halo.position.y = .015;
scene.add(halo);

let doorTarget = 0;
let doorAmount = 0;
let firstFrame = true;
function resetView() {
  const aspect = Math.max(host.clientWidth / Math.max(host.clientHeight, 1), .25);
  const portrait = aspect < .9;
  const distance = Math.max(8.9, 8.9 / aspect);
  const direction = new THREE.Vector3(.89, .4, 1.13).normalize();
  controls.target.set(0, portrait ? .94 : .79, 0);
  camera.position.copy(controls.target).addScaledVector(direction, distance);
  controls.minDistance = portrait ? distance * .55 : 4.2;
  controls.maxDistance = distance * 1.85;
  controls.update();
}
function resize() {
  const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
  renderer.setSize(width,height,false);
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(host);
resize();
resetView();
document.querySelectorAll('[data-finish]').forEach(button => button.addEventListener('click', () => {
  const finish = button.dataset.finish;
  document.querySelectorAll('[data-finish]').forEach(b => b.setAttribute('aria-pressed',String(b===button)));
  palette.shell.map = textures[finish];
  palette.shell.needsUpdate = true;
  const ivory = finish === 'ivory';
  palette.edge.color.set(ivory ? '#d8d1bd' : '#555d61');
  palette.trim.color.set(ivory ? '#6b4933' : '#ada086');
  document.querySelector('#status').textContent = `Acabamento ${ivory ? 'marfim' : 'preto'}`;
}));
document.querySelector('#doors').addEventListener('click', event => {
  doorTarget = doorTarget ? 0 : 1;
  const button = event.currentTarget;
  button.setAttribute('aria-pressed',String(Boolean(doorTarget)));
  button.querySelector('span').textContent = doorTarget ? 'Fechar portas' : 'Abrir portas';
});
const sceneColors = { cyan: '#68e6df', amber: '#f2bd79', coral: '#f28e89' };
document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed',String(b===button)));
  const color = sceneColors[button.dataset.scene];
  palette.cyan.color.set(color);
  palette.cyan.emissive.set(color);
  haloMat.color.set(color);
  glow.color.set(color);
  interiorGlow.color.set(color);
  rim.color.set(color);
}));
document.querySelector('#rotate').addEventListener('click', event => {
  controls.autoRotate = !controls.autoRotate;
  event.currentTarget.setAttribute('aria-pressed',String(controls.autoRotate));
});
document.querySelector('#reset').addEventListener('click', () => {
  controls.autoRotate=false;
  document.querySelector('#rotate').setAttribute('aria-pressed','false');
  resetView();
});

let visible = true;
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(host);
let lastTime = 0;
renderer.setAnimationLoop(time => {
  if (!visible || document.hidden) { lastTime=time;return; }
  const dt = Math.min((time-lastTime)/1000,.05);
  lastTime=time;
  const factor = reducedMotion ? 1 : 1-Math.exp(-dt*3.7);
  doorAmount += (doorTarget-doorAmount)*factor;
  doors.forEach(door=>{door.rotation.x=-doorAmount*1.52;});
  controls.update();
  renderer.render(scene,camera);
  if(firstFrame) { document.querySelector('#loading').classList.add('ready');firstFrame=false; }
});
window.addEventListener('webglcontextlost', () => { document.querySelector('#loading').textContent='Restaure a página para retomar o 3D';document.querySelector('#loading').classList.remove('ready'); });
