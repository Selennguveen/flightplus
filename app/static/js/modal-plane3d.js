/* ============================================================
   modal-plane3d.js
   Three.js 3D .GLB Airplane — Full modal diagonal flight
   Sol Alt (Analiz butonu) → Sağ Üst (X kapat butonu)
   ============================================================ */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

(function () {
  "use strict";

  const container = document.getElementById("modal-airplane-3d");
  if (!container) return;

  function isWebGLSupported() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  if (!isWebGLSupported()) return;

  const scene = new THREE.Scene();

  // Kamera — tüm modal alanını kapsayacak geniş FOV
  const getAspect = () => (container.clientWidth || 480) / (container.clientHeight || 560);
  const camera = new THREE.PerspectiveCamera(52, getAspect(), 0.1, 200);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth || 480, container.clientHeight || 560);
  container.appendChild(renderer.domElement);

  // Işıklar
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(4, 6, 5);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6ab0f5, 0.8);
  fill.position.set(-4, -3, 2);
  scene.add(fill);

  let plane = null;

  new GLTFLoader().load(
    "/static/models/airplane.glb",
    (gltf) => {
      const model = gltf.scene;

      // Boyutlandır
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.8 / maxDim;
      model.scale.setScalar(scale);

      // Merkeze hizala
      const center = new THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center.multiplyScalar(scale));

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
          child.material.metalness = 0.4;
          child.material.roughness = 0.2;
        }
      });

      // DÜZELTME: Bu .glb'nin (A350) ham vertex verisi analiz edilerek
      // burnun yerel +X ekseninde olduğu doğrulandı (hero'daki plane3d.js
      // için yapılan aynı ölçüm, bkz. o dosyanın yorumları). Önceki kod
      // burnun -Z'de olduğunu varsayıyordu -- bu yanlıştı ve modal'da uçak
      // çapraz uçarken burnu gerçek hareket yönüne değil ekrana doğru
      // bakıyordu. Burnu wrapper'ın "ileri" kabul ettiği +Z eksenine
      // hizalamak için -90° (Y ekseni etrafında) düzeltme uyguluyoruz.
      model.rotation.y = -Math.PI / 2;

      const wrapper = new THREE.Group();
      wrapper.add(model);
      scene.add(wrapper);
      plane = wrapper;
    },
    undefined,
    (err) => console.warn("GLB yükleme:", err)
  );

  // ============================================================
  // UÇUŞ ROTASI: Sol Alt → Sağ Üst (tam modal köşegeni, 12 saniye)
  // Sol alt = "Analiz Geçmişini Gör" butonu köşesi
  // Sağ üst = "X" kapat butonu köşesi
  // ============================================================
  const DURATION = 12.0; // yavaş, uzun yolculuk
  const clock = new THREE.Clock();
  const DUNYA_YUKARI = new THREE.Vector3(0, 1, 0);
  const HAFIF_YATIS = 0.12; // sadece stil için, hero'daki ile aynı mantık

  // Sol-alt -> Sağ-üst tam modal diyagonali. Doğrusal bir yol olduğu için
  // uçuş yönü sabit, ama diğer rota (hero) ile aynı, genel "hesapla + yöne
  // bak" desenini kullanıyoruz -- ileride bu rota eğrileştirilirse otomatik
  // doğru çalışmaya devam eder.
  function konumHesapla(t) {
    const x = THREE.MathUtils.lerp(-4.5, 4.5, t);
    const y = THREE.MathUtils.lerp(-4.0, 4.0, t);
    return new THREE.Vector3(x, y, 0);
  }

  // Burnu (yerel +Z, model.rotation.y düzeltmesinden sonra) gerçek uçuş
  // yönüne çeviren "look rotation" -- hero'daki uceBak() ile birebir aynı
  // yöntem (bkz. plane3d.js).
  function uceBak(obj, yon) {
    let sag = new THREE.Vector3().crossVectors(DUNYA_YUKARI, yon);
    if (sag.lengthSq() < 1e-6) sag.set(1, 0, 0);
    sag.normalize();
    const yukari = new THREE.Vector3().crossVectors(yon, sag).normalize();
    const eksen = new THREE.Matrix4().makeBasis(sag, yukari, yon);
    obj.quaternion.setFromRotationMatrix(eksen);
    obj.rotateZ(HAFIF_YATIS);
  }

  function animate() {
    requestAnimationFrame(animate);

    if (plane) {
      const elapsed = clock.getElapsedTime();
      const t = (elapsed % DURATION) / DURATION;

      const konum = konumHesapla(t);
      plane.position.copy(konum);

      const ileriT = Math.min(t + 0.004, 1);
      const yon = konumHesapla(ileriT).sub(konum).normalize();
      uceBak(plane, yon);

      // Fade: giriş %0→12, çıkış %88→100
      const fadeIn  = THREE.MathUtils.smoothstep(t, 0.00, 0.12);
      const fadeOut = 1 - THREE.MathUtils.smoothstep(t, 0.88, 1.00);
      const opacity = Math.min(fadeIn, fadeOut);

      plane.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacity;
        }
      });
    }

    renderer.render(scene, camera);
  }

  animate();

  function onResize() {
    const w = container.clientWidth || 480;
    const h = container.clientHeight || 560;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", onResize);

  const modal = document.getElementById("prediction-modal");
  if (modal) {
    new MutationObserver(() => {
      if (modal.classList.contains("active")) {
        setTimeout(onResize, 60);
      }
    }).observe(modal, { attributes: true, attributeFilter: ["class"] });
  }
})();
