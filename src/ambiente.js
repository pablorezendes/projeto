import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// A neutral photographic studio. It contains no product or construction data.
export function createEnvironment(THREE, renderer, scene) {
  const group = new THREE.Group();
  group.name = 'Estudio arquitetural';
  scene.add(group);
  const previous = { background: scene.background, fog: scene.fog, environment: scene.environment };
  scene.background = new THREE.Color('#dcd9d1');
  scene.fog = new THREE.Fog('#dcd9d1', 16, 48);

  // The large luminous rectangles are reflected by the lacquer, glass and leather.
  const room = new RoomEnvironment();
  room.traverse(object => {
    if (!object.isMesh) return;
    if (object.material.isMeshBasicMaterial) object.material.color.multiplyScalar(.62);
    else object.material.color.set(object.material.side === THREE.BackSide ? '#edeae3' : '#b7b4ad');
  });
  const softbox = (width, height, position, target, brightness, color = '#fff7ea') => {
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    material.color.multiplyScalar(brightness);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    panel.position.set(...position);
    panel.lookAt(...target);
    room.add(panel);
  };
  softbox(8, 5, [-7, 6.5, 7], [0, 1, 0], 5.2);
  softbox(3, 7, [7, 4, -4], [0, 1, 0], 3.5, '#edf5ff');
  softbox(7, 7, [0, 10, 0], [0, 0, 0], 2.6, '#ffffff');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(room, .035);
  scene.environment = environmentTarget.texture;
  room.dispose();
  pmrem.dispose();

  const hemisphere = new THREE.HemisphereLight('#fffaf1', '#77756d', .85);
  group.add(hemisphere);
  const key = new THREE.DirectionalLight('#fff2df', 2.55);
  key.position.set(-3.9, 7, 5.1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5.7, right: 5.7, top: 5.7, bottom: -5.7, near: .5, far: 24 });
  key.shadow.bias = -.00015;
  key.shadow.normalBias = .015;
  key.shadow.radius = 5;
  key.shadow.blurSamples = 8;
  key.target.position.set(0, .6, 0);
  group.add(key, key.target);
  const fill = new THREE.DirectionalLight('#eaf1ff', .9);
  fill.position.set(5, 3.8, 1.5);
  group.add(fill);
  const rim = new THREE.DirectionalLight('#fffaf0', 1.15);
  rim.position.set(1.2, 5.5, -5.6);
  group.add(rim);
  const bounce = new THREE.DirectionalLight('#fff5e7', .58);
  bounce.position.set(2.8, .35, 4.2);
  bounce.target.position.set(0, 1.6, 0);
  group.add(bounce, bounce.target);

  function concreteTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    const image = context.createImageData(256, 256);
    let state = 78231;
    const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const slow = Math.sin(x * .058 + Math.sin(y * .031)) * .7 + Math.sin(y * .071) * .5;
      const v = 226 + slow + (random() - .5) * 3;
      image.data[i] = v;
      image.data[i + 1] = v - 1;
      image.data[i + 2] = v - 4;
      image.data[i + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(14, 14);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  }
  const floorMap = concreteTexture();
  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: '#c5c1b6', map: floorMap, roughness: .5, metalness: .035,
    clearcoat: .16, clearcoatRoughness: .55, envMapIntensity: .32,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.028;
  floor.receiveShadow = true;
  group.add(floor);

  // Broad, low-opacity contact shadow removes the appearance of a floating model.
  // Actual directional shadows still describe the opened doors and occupant.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 256;
  const context = shadowCanvas.getContext('2d');
  const image = context.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const distance = Math.pow(Math.pow(Math.abs((x - 127.5) / 127.5), 4) + Math.pow(Math.abs((y - 127.5) / 127.5), 4), .25);
    const opacity = Math.pow(Math.max(0, 1 - distance), 1.8);
    const i = (y * 256 + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = 38;
    image.data[i + 3] = Math.round(opacity * 58);
  }
  context.putImageData(image, 0, 0);
  const shadowMap = new THREE.CanvasTexture(shadowCanvas);
  shadowMap.colorSpace = THREE.SRGBColorSpace;
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, toneMapped: false });
  const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 5.1), shadowMaterial);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -.025;
  contactShadow.renderOrder = 1;
  group.add(contactShadow);

  // Small physical spill, kept separate from the fixed cyan product symbols.
  const accent = new THREE.PointLight('#53dfea', .65, 3.8, 2);
  accent.position.set(0, .42, 0);
  group.add(accent);
  return {
    group,
    setAccent(color) { accent.color.set(color); },
    dispose() {
      scene.remove(group);
      group.traverse(object => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        object.material.dispose();
      });
      floorMap.dispose();
      shadowMap.dispose();
      key.shadow.dispose();
      environmentTarget.dispose();
      scene.background = previous.background;
      scene.fog = previous.fog;
      scene.environment = previous.environment;
    },
  };
}
