// plane3d.js
// -----------------------------------------------------------------
// Hero bölümündeki 3D uçak animasyonu (Three.js + kullanıcının yüklediği
// .glb uçak modeli). Uçak, hero'nun ALT kısmında, sol kenardan girip bir
// YARIM DAİRE (rainbow/kavis) çizerek sağ kenardan çıkan bir rota izliyor;
// bu sırada hafifçe kameraya yaklaşıp uzaklaşarak derinlik/gerçekçilik
// hissi veriyor, ve döngü halinde (kenarlarda görünmezken sıfırlanarak)
// tekrarlıyor.
//
// Rota, ekran-uzayı (screen-space) koordinatlarından 3D dünya koordinatına
// çevrilerek hesaplanıyor (bkz. ekranKoordUzaya) -- bu sayede kavisin
// taban çizgisi/yüksekliği her ekran boyutunda/açı oranında (aspect ratio)
// gerçekten hero'nun alt kısmına denk geliyor, elle ayarlanmış birimlerle
// tahmin yürütmüyoruz.
//
// Sahnenin konteyneri (.af-plane3d) z-index:2 -- .af-content'in (başlık
// metni) z-index'i 3 olduğu için uçak, önceki 2D animasyonda olduğu gibi,
// yazının ARKASINDAN geçiyor. Bulutlar (z-index: auto) uçağın gerisinde
// kalıyor.
//
// NOT: Modelin burun ekseni tahmin edilmedi -- .glb'nin ham vertex
// verisi analiz edilip burnun yerel +Z, yukarının yerel +Y olduğu
// doğrulandı (bkz. uceBak() fonksiyonu), bu yüzden burun her zaman
// gerçek uçuş yönünü gösteriyor.
// -----------------------------------------------------------------

// NOT: "three" ve "three/addons/" adresleri index.html'deki <script type="importmap">
// bloğunda tanımlı -- bu dosya tek başına açılırsa (import map olmadan) çalışmaz.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const container = document.getElementById("af-plane3d");

function destekleniyorMu() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
  } catch (e) {
    return false;
  }
}

if (container && destekleniyorMu()) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    35,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sunIsigi = new THREE.DirectionalLight(0xffffff, 1.4);
  sunIsigi.position.set(5, 6, 8);
  scene.add(sunIsigi);
  const dolduruIsigi = new THREE.DirectionalLight(0xbfe3ff, 0.6);
  dolduruIsigi.position.set(-6, -2, -4);
  scene.add(dolduruIsigi);

  // Animasyonun her karede döndürüp konumlandırdığı nesne bu -- modelin
  // KENDİSİ değil, onu saran bir Group (bkz. aşağısı). Böylece modelin
  // kendi burun-düzeltme dönüşü hep sabit kalır, uceBak() onu ezmez.
  let plane = null;

  new GLTFLoader().load(
    "/static/models/airplane.glb",
    (gltf) => {
      const model = gltf.scene;

      // Modelin burnu hangi yerel eksende, .glb'nin ham vertex verisi
      // analiz edilerek ölçüldü. BU MODEL İÇİN (A350.glb) burun yerel
      // +X ekseninde -- sarmalayıcının "ileri" kabul ettiği +Z eksenine
      // hizalamak için -90° (Y ekseni etrafında) düzeltme gerekiyor.
      // Modeli değiştirirsen bu açı yeniden ölçülüp güncellenmeli
      // (0 = burun zaten +Z'de, +90° = burun -X'te, vb.)
      const BURUN_DUZELTME_Y = -Math.PI / 2;
      model.rotation.y = BURUN_DUZELTME_Y;

      // Modelin orijinal boyutu/merkezi bilinmediği için otomatik normalize
      // ediyoruz: bounding box'ı (düzeltme dönüşü uygulandıktan SONRA)
      // ölçüp sahnede ~8.6 birime getiriyoruz ve merkezini orijine çekiyoruz.
      // (Büyütmek istersen hedefBoyut'u artır.)
      // Model boyutunu büyütüyoruz (kullanıcı isteğiyle dev 3D uçak)
      const box = new THREE.Box3().setFromObject(model);
      const boyut = new THREE.Vector3();
      box.getSize(boyut);
      const enBuyukBoyut = Math.max(boyut.x, boyut.y, boyut.z) || 1;
      const hedefBoyut = 28.0; // Büyütülmüş 3D uçak boyu
      const olcek = hedefBoyut / enBuyukBoyut;
      model.scale.setScalar(olcek);

      const merkez = new THREE.Vector3();
      box.getCenter(merkez);
      model.position.sub(merkez.multiplyScalar(olcek));

      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.transparent = true;
        }
      });

      const sarmalayici = new THREE.Group();
      sarmalayici.add(model);
      scene.add(sarmalayici);
      plane = sarmalayici;
    },
    undefined,
    (hata) => console.error("Uçak modeli yüklenemedi:", hata)
  );

  const DONGU_SURESI = 16; // saniye -- tek bir döngünün süresi
  const saat = new THREE.Clock();

  // Modelin geometrisini (.glb'nin ham vertex verisini) analiz ederek
  // burnun yerel +Z ekseninde, "yukarı"nın yerel +Y ekseninde olduğunu
  // doğruladık.
  const DUNYA_YUKARI = new THREE.Vector3(0, 1, 0);
  const HAFIF_YATIS = 0.14; // viraj alırken gerçekçi kanat yatışı

  function uceBak(obj, yon) {
    let sag = new THREE.Vector3().crossVectors(DUNYA_YUKARI, yon);
    if (sag.lengthSq() < 1e-6) sag.set(1, 0, 0);
    sag.normalize();
    const yukari = new THREE.Vector3().crossVectors(yon, sag).normalize();
    const eksen = new THREE.Matrix4().makeBasis(sag, yukari, yon);
    obj.quaternion.setFromRotationMatrix(eksen);
    obj.rotateZ(HAFIF_YATIS);
  }

  // Rota: Tam ekran arka planda sol kenardan girip kavisle süzülen rota
  const ARK_MERKEZ_U = 0.5;     // kavisin yatay merkezi
  const ARK_YARICAP_U = 0.70;   // yatay yarıçap
  const ARK_TABAN_V = 0.65;     // taban çizgisi
  const ARK_YUKSEKLIK_V = 0.35; // yukarı kavis yüksekliği
  const Z_YAKIN = -2.5;         // kameraya en yakın olduğu derinlik (büyük ve net)
  const Z_UZAK = -8.0;          // uçlardaki derinlik

  // Verilen ekran kesri ve dünya Z derinliği için kamera konumunu hesaplar
  function ekranKoordUzaya(u, v, worldZ) {
    const ndcX = u * 2 - 1;
    const ndcY = -(v * 2 - 1);
    const uzakNokta = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
    const yon = uzakNokta.sub(camera.position).normalize();
    const mesafe = (worldZ - camera.position.z) / yon.z;
    return camera.position.clone().add(yon.multiplyScalar(mesafe));
  }

  function konumHesapla(t) {
    const aci = THREE.MathUtils.lerp(Math.PI, 0, t);
    const u = ARK_MERKEZ_U + ARK_YARICAP_U * Math.cos(aci);
    const v = ARK_TABAN_V - ARK_YUKSEKLIK_V * Math.sin(aci);
    const derinlikT = Math.sin(t * Math.PI);
    const z = THREE.MathUtils.lerp(Z_UZAK, Z_YAKIN, derinlikT);
    return ekranKoordUzaya(u, v, z);
  }

  function animasyonDongusu() {
    requestAnimationFrame(animasyonDongusu);

    if (plane) {
      const t = (saat.getElapsedTime() % DONGU_SURESI) / DONGU_SURESI; // 0 -> 1

      const konum = konumHesapla(t);
      plane.position.copy(konum);

      // Uçuş yönünü (bir sonraki anki konumla farkını alarak) hesapla ve
      // uçağın burnunu doğrudan o yöne çevir -- çapraz iniş rotası
      // boyunca burun eğimi otomatik, doğru oranda geliyor.
      const ileriT = Math.min(t + 0.004, 1);
      const ileriKonum = konumHesapla(ileriT);
      const yon = ileriKonum.sub(konum).normalize();

      uceBak(plane, yon);

      // Kenarlarda görünmez, ortada tam opak -- eski 2D animasyondaki
      // fade-in/out mantığının aynısı (döngü sıfırlanması ekranda görünmüyor)
      const girisOpaklik = THREE.MathUtils.smoothstep(t, 0.0, 0.08);
      const cikisOpaklik = 1 - THREE.MathUtils.smoothstep(t, 0.92, 1.0);
      const opaklik = Math.min(girisOpaklik, cikisOpaklik);
      plane.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opaklik;
        }
      });
    }

    renderer.render(scene, camera);
  }
  animasyonDongusu();

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}
