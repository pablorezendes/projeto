import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironment } from './ambiente.js';
import { createProduct } from './produto.js';
import { createPerson } from './pessoa.js';

const host = document.querySelector('#stage');
const loading = document.querySelector('#loading');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
} catch (error) {
  document.querySelector('#fallback').style.display = 'flex';
  loading.hidden = true;
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .88;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, .05, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .065;
controls.enablePan = false;
controls.minPolarAngle = .22;
controls.maxPolarAngle = Math.PI * .485;
controls.autoRotateSpeed = .35;
controls.rotateSpeed = .55;
controls.zoomSpeed = .65;
const environment = createEnvironment(THREE, renderer, scene);
const assetBase = new URL('./', location.href).href;
const product = createProduct(THREE, { anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()), assetBase });
scene.add(product.group);
const person = createPerson(THREE, { assetBase, anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
product.personAnchor.add(person.group || person);

const target = new THREE.WebGLRenderTarget(1, 1, {
  type: renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType,
  samples: renderer.capabilities.isWebGL2 ? 4 : 0,
});
const composer = new EffectComposer(renderer, target);
composer.addPass(new RenderPass(scene, camera));
let ambientOcclusion;
if (renderer.capabilities.isWebGL2 && host.clientWidth >= 680) {
  ambientOcclusion = new SSAOPass(scene, camera, 1, 1, 16);
  ambientOcclusion.kernelRadius = .18;
  ambientOcclusion.minDistance = .0006;
  ambientOcclusion.maxDistance = .025;
  composer.addPass(ambientOcclusion);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .14, .28, 1.65);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const doorOpenAngle = THREE.MathUtils.degToRad(77);
let doorTarget = 1;
let doorAmount = 1;
product.setDoors(doorOpenAngle);
const doorsButton = document.querySelector('#doors');
function updateDoorsButton() {
  doorsButton.setAttribute('aria-pressed', String(Boolean(doorTarget)));
  doorsButton.querySelector('span').textContent = doorTarget ? 'Fechar portas' : 'Abrir portas';
}
updateDoorsButton();

const views = {
  product: { direction: [.95, .30, 1.05], distance: 7.2, target: [0, .85, 0], fov: 35 },
  interior: { direction: [.92, .10, 1.05], distance: 4.4, target: [0, .90, 0], fov: 39, open: true },
  person: { direction: [.90, .32, 1.10], distance: 2.0, target: [0, 1.02, -.15], fov: 45, open: true },
};
let activeView = 'product';
let cameraMove = null;
function fittedDistance(direction, look, fov, aspect) {
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tangent = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  let distance = 4;
  product.group.updateWorldMatrix(true, true);
  product.group.traverse(object => {
    if (!object.isMesh || !object.visible) return;
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const point = new THREE.Vector3(x, y, z).applyMatrix4(object.matrixWorld).sub(look);
      const depth = point.dot(direction);
      distance = Math.max(distance, depth + Math.abs(point.dot(right)) / (tangent * aspect * .87), depth + Math.abs(point.dot(up)) / (tangent * .74));
    }
  });
  return distance;
}
function setView(name, immediate = false) {
  const view = views[name] || views.product;
  activeView = views[name] ? name : 'product';
  const portrait = Math.max(host.clientWidth / Math.max(host.clientHeight, 1), .25);
  const look = new THREE.Vector3(...view.target);
  const direction = new THREE.Vector3(...(activeView === 'product' && !doorTarget ? [-.95, .42, 1.05] : view.direction)).normalize();
  const distance = activeView === 'product' ? fittedDistance(direction, look, view.fov, portrait) : view.distance * (portrait < 1 ? 1 / portrait : 1);
  const position = look.clone().addScaledVector(direction, distance);
  if (activeView !== 'product') position.y = look.y + direction.y * view.distance;
  controls.minDistance = activeView === 'person' ? 1.4 : 3.0;
  controls.maxDistance = Math.max(13, distance * 1.7);
  controls.autoRotate = false;
  document.querySelector('#rotate').setAttribute('aria-pressed', 'false');
  if (view.open) { doorTarget = 1; updateDoorsButton(); }
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === activeView)));
  if (immediate || reducedMotion) {
    camera.position.copy(position);
    controls.target.copy(look);
    camera.fov = view.fov;
    camera.updateProjectionMatrix();
    controls.update();
    cameraMove = null;
  } else {
    cameraMove = { from: camera.position.clone(), to: position, lookFrom: controls.target.clone(), lookTo: look, fovFrom: camera.fov, fovTo: view.fov, progress: 0 };
  }
}
function resize() {
  const width = Math.max(host.clientWidth, 1), height = Math.max(host.clientHeight, 1);
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (activeView === 'product') setView('product', true);
}
new ResizeObserver(resize).observe(host);
resize();
setView('product', true);

document.querySelectorAll('[data-finish]').forEach(button => button.addEventListener('click', () => {
  const ivory = button.dataset.finish === 'ivory';
  product.setFinish(ivory ? 'marfim' : 'preto');
  document.querySelectorAll('[data-finish]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  document.querySelector('#status').textContent = `Acabamento ${ivory ? 'marfim' : 'preto'}`;
  host.setAttribute('aria-label', `Modelo 3D do ÁPICE em ${ivory ? 'marfim' : 'preto'}, com símbolos ciano neon, portas articuladas e uma pessoa reclinada na poltrona. Arraste para girar e use os controles para explorar.`);
}));
doorsButton.addEventListener('click', () => {
  doorTarget = doorTarget ? 0 : 1;
  updateDoorsButton();
  setView('product');
});
const sceneColors = { cyan: '#5fdce9', amber: '#efb776', coral: '#ef9a8a' };
document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-scene]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  const color = sceneColors[button.dataset.scene];
  product.setScene(color);
  environment.setAccent(color);
}));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelector('#rotate').addEventListener('click', event => {
  cameraMove = null;
  controls.autoRotate = !controls.autoRotate;
  event.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
});
document.querySelector('#reset').addEventListener('click', () => setView('product'));
renderer.domElement.addEventListener('pointerdown', () => { cameraMove = null; });
renderer.domElement.addEventListener('webglcontextlost', () => {
  loading.textContent = 'Restaure a página para retomar a visualização';
  loading.classList.remove('ready');
});

let visible = true;
new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(host);
let assetsReady = false;
Promise.all([product.ready, person.ready]).then(() => { assetsReady = true; }).catch(error => {
  loading.textContent = 'Não foi possível carregar o modelo. Recarregue a página.';
  console.error('Falha ao carregar a visualização do produto.', error);
});
let lastTime = 0;
renderer.setAnimationLoop(time => {
  if (!visible || document.hidden) { lastTime = time; return; }
  const dt = Math.min((time - lastTime) / 1000, .05);
  lastTime = time;
  doorAmount += (doorTarget - doorAmount) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 3.5));
  product.setDoors(doorAmount * doorOpenAngle);
  if (cameraMove) {
    cameraMove.progress = Math.min(1, cameraMove.progress + dt / 1.05);
    const t = cameraMove.progress ** 2 * (3 - 2 * cameraMove.progress);
    camera.position.lerpVectors(cameraMove.from, cameraMove.to, t);
    controls.target.lerpVectors(cameraMove.lookFrom, cameraMove.lookTo, t);
    camera.fov = THREE.MathUtils.lerp(cameraMove.fovFrom, cameraMove.fovTo, t);
    camera.updateProjectionMatrix();
    if (cameraMove.progress === 1) cameraMove = null;
  }
  controls.update();
  product.update?.(dt);
  person.update?.(dt);
  composer.render(dt);
  if (assetsReady && !loading.classList.contains('ready')) loading.classList.add('ready');
});
