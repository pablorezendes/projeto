import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Detailed adult visual figure, based on MakeHuman CC0 asset data.
 * Local coordinates in metres: +Z feet, -Z head, +Y up, X shoulder width.
 * Hip approximately (0,.67,.05); head approximately (0,1.30,-.72),
 * ankles (+/-.15,.405,1.02). Attach to the chair's orientation group.
 * Returns { group, ready }; ready rejects if the local GLB fails to load.
 */
export function createPerson(THREE, {assetBase='./', anisotropy=4}={}) {
  const group=new THREE.Group();
  group.name='Pessoa adulta reclinada';
  const ready=new Promise((resolve,reject)=>{
    new GLTFLoader().load(`${assetBase.replace(/\/?$/, '/')}assets/pessoa-reclinada.glb`, gltf=>{
      const model=gltf.scene;
      const weave=document.createElement('canvas');weave.width=128;weave.height=128;
      const c=weave.getContext('2d');const pixels=c.createImageData(128,128);
      for(let y=0;y<128;y++)for(let x=0;x<128;x++){
        const i=(y*128+x)*4;
        const grain=(Math.sin(x*117.1+y*39.7)*43758.54)%1;
        const value=Math.max(0,Math.min(255,143+(x%4===0?25:0)+(y%4===0?14:0)+grain*9));
        pixels.data.set([value,value,value,255],i);
      }
      c.putImageData(pixels,0,0);
      const bump=new THREE.CanvasTexture(weave);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(5,5);bump.anisotropy=anisotropy;
      const hairCanvas=document.createElement('canvas');hairCanvas.width=128;hairCanvas.height=256;
      const hc=hairCanvas.getContext('2d');hc.fillStyle='#7a7a7a';hc.fillRect(0,0,128,256);
      for(let i=0;i<340;i++){
        const x=((Math.sin(i*172.1)*43758.54)%1+1)%1*128;
        hc.strokeStyle=i%3?'#999999':'#414141';hc.lineWidth=i%4===0?.8:.45;hc.beginPath();hc.moveTo(x,-5);hc.bezierCurveTo(x+5,75,x-6,175,x+2,262);hc.stroke();
      }
      const hairBump=new THREE.CanvasTexture(hairCanvas);hairBump.wrapS=hairBump.wrapT=THREE.RepeatWrapping;hairBump.repeat.set(7,3);hairBump.anisotropy=anisotropy;
      model.traverse(mesh=>{
        if(!mesh.isMesh)return;
        mesh.castShadow=true;mesh.receiveShadow=true;
        let mat=mesh.material;mat.envMapIntensity=.65;
        if(mat.name==='Skin'){
          // Official CC0 photographic diffuse and pore normal maps, retaining
          // the original anatomical UV layout rather than flat vertex colour.
          mat=new THREE.MeshPhysicalMaterial({name:'Skin',map:mat.map,normalMap:mat.normalMap,normalScale:mat.normalScale.clone(),color:'#ffffff',roughness:.62,metalness:0,ior:1.4,specularIntensity:.32,clearcoat:.025,clearcoatRoughness:.65,envMapIntensity:.5});
          if(mat.map)mat.map.anisotropy=anisotropy;
          if(mat.normalMap)mat.normalMap.anisotropy=anisotropy;
          mesh.material=mat;
        }
        if(mat.name==='Dark short hair'){mat.bumpMap=hairBump;mat.bumpScale=.0012;mat.roughness=.78;mat.envMapIntensity=.4;}
        if(mat.name==='Warm linen'||mat.name==='Charcoal cotton'){
          const p=mesh.geometry.attributes.position,uv=[];
          for(let i=0;i<p.count;i++)uv.push(p.getX(i)*4,p.getZ(i)*4+p.getY(i)*2);
          mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
          mat.bumpMap=bump;mat.bumpScale=.0008;mat.roughness=.94;
        }
      });
      group.add(model);
      const extras=gltf.parser.json.extras||{};
      const eyeWhite=new THREE.MeshPhysicalMaterial({color:'#dfd7c8',roughness:.32,clearcoat:.3});
      const irisMat=new THREE.MeshStandardMaterial({color:'#534535',roughness:.5});
      const pupilMat=new THREE.MeshStandardMaterial({color:'#0c0c0c',roughness:.3});
      for(const eye of extras.eyesClosed?[]:extras.eyes||[]){
        const center=new THREE.Vector3(...eye.center),front=new THREE.Vector3(...eye.front);
        const ball=new THREE.Mesh(new THREE.SphereGeometry(.018,24,16),eyeWhite);ball.position.copy(center);ball.castShadow=true;group.add(ball);
        const iris=new THREE.Mesh(new THREE.CircleGeometry(.0065,24),irisMat);iris.position.copy(center).addScaledVector(front,.0177);iris.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),front);group.add(iris);
        const pupil=new THREE.Mesh(new THREE.CircleGeometry(.0028,20),pupilMat);pupil.position.copy(center).addScaledVector(front,.01785);pupil.quaternion.copy(iris.quaternion);group.add(pupil);
      }
      group.userData.assetLoaded=true;
      resolve(group);
    },undefined,reject);
  });
  group.userData.ready=ready;
  return {group,ready};
}
