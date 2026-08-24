<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0B3D66,50:1E6FB0,100:59A8DE&height=220&section=header&text=FlightPlus&fontSize=64&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Havayolu%20Yolcu%20Memnuniyeti%20Tahmini&descAlignY=56&descSize=20&descAlign=50" width="100%" alt="FlightPlus banner" />

<a href="https://github.com"><img src="https://readme-typing-svg.demolab.com/?font=Fira+Code&size=20&pause=1200&color=1E6FB0&center=true&vCenter=true&width=650&lines=Uctan%20uca%20bir%20makine%20ogrenmesi%20portfoy%20projesi;LightGBM%20%2B%20SHAP%20%2B%20Flask%20%2B%20Three.js;%2596%2C53%20test%20dogrulugu%2C%20%2599%2C55%20ROC-AUC" alt="Typing SVG" /></a>

<br/>

<img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/Flask-black?style=for-the-badge&logo=flask&logoColor=white" />
<img src="https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white" />
<img src="https://img.shields.io/badge/LightGBM-02569B?style=for-the-badge" />
<img src="https://img.shields.io/badge/SHAP-8A2BE2?style=for-the-badge" />
<img src="https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
<img src="https://img.shields.io/badge/pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white" />

</div>

<br/>

Kaggle **"Airline Passenger Satisfaction"** veri seti üzerine kurulmuş, uçtan
uca bir makine öğrenmesi projesi: bir yolcunun uçuş deneyimi ve demografik
özelliklerinden yola çıkarak memnun kalıp kalmayacağını tahmin eden bir
sınıflandırma modeli, canlı tahmin yapılabilen bir web sitesi ve tüm karar
sürecini şeffaflaştıran bir açıklanabilirlik (SHAP) katmanıyla birlikte.

Detaylı adım adım plan için bkz. `Havayolu_Yolcu_Memnuniyeti_Yol_Haritasi.docx`.

<br/>

## 📋 İçindekiler

- [✨ Öne Çıkan Özellikler](#-öne-çıkan-özellikler)
- [📊 Model Performansı](#-model-performansı)
- [🗂️ Klasör Yapısı](#️-klasör-yapısı)
- [🚀 Kurulum](#-kurulum)
- [▶️ Çalıştırma](#️-çalıştırma)
- [🧪 Testler](#-testler)
- [🐳 Docker ile Çalıştırma](#-docker-ile-çalıştırma)
- [☁️ Yayınlama](#️-yayınlama)
- [✅ Durum](#-durum)

<br/>

## ✨ Öne Çıkan Özellikler

- **Canlı tahmin motoru** — yolcu profili ve uçuş deneyimi bilgilerini
  giren kullanıcıya, LightGBM tabanlı modelin anlık memnuniyet tahminini
  ve güven skorunu gösteren, üç sekmeli (Tahmin / Analizler / Model
  Bilgisi) tek sayfalık bir web arayüzü.
- **3D uçak animasyonu** — Three.js ile render edilen, geometrik olarak
  kalibre edilmiş bir `.glb` uçak modeli; hem ana sayfada hem tahmin
  sonucu modalında akıcı bir uçuş animasyonu olarak kullanılıyor.
- **Açıklanabilir yapay zeka** — SHAP değerleriyle modelin kararlarını en
  çok neyin etkilediği (ör. seyahat türü, wifi hizmeti, online biniş
  deneyimi) şeffaf şekilde gösteriliyor.
- **Koyu / açık tema** — "airline sky" renk paletiyle tasarlanmış,
  tamamen tutarlı iki tema arasında anlık geçiş.
- **Tahmin geçmişi** — yapılan tüm simülasyonlar tarayıcıda saklanıp bir
  analiz tablosunda özetleniyor.
- **REST API** — `POST /api/predict` ile JSON üzerinden programatik
  tahmin alınabiliyor, web arayüzünden bağımsız.
- **Üretime hazır** — Docker imajı, pytest test paketi ve Render/Railway
  için hazır deploy yapılandırmasıyla birlikte geliyor.

<br/>

## 📊 Model Performansı

Test setinde (25.976 kayıt, hiç dokunulmamış) elde edilen sonuçlar:

| Metrik | Değer |
|---|---|
| Accuracy | **%96,53** |
| Precision | %97,93 |
| Recall | %94,08 |
| F1-Score | %95,97 |
| ROC-AUC | %99,55 |
| Karar eşiği (F1-optimize) | 0.5529 |

Model: **LightGBM** (10 farklı algoritma karşılaştırıldıktan ve
hiperparametre + eşik ayarı yapıldıktan sonra seçildi). Eğitim seti
103.904 kayıt, 22 ham özellik + türetilmiş özellikler (Ortalama Hizmet
Puanı, Toplam/Fark Gecikme, Yaş Grubu, log dönüşümleri).

SHAP'e göre modelin kararında en etkili 5 özellik: **Type of Travel →
Inflight wifi service → Online boarding → Customer Type → Class.**

<br/>

## 🗂️ Klasör Yapısı

```
data/
  raw/          # train.csv, test.csv (orijinal, dokunulmaz)
  processed/    # işlenmiş veri (opsiyonel ara çıktılar)
notebooks/      # EDA ve modelleme not defterleri
figures/        # notebook'ta üretilen grafiklerin .html/.png kayıtları
src/
  preprocessing.py       # manuel ön işleme adımlarının script hali
  feature_engineering.py # Pipeline'ın paylaşılan özellik mühendisliği adımı
  train.py                # uçtan uca Pipeline eğitimi + değerlendirme
  predict.py              # tekil tahmin fonksiyonu
tests/
  test_preprocessing.py  # src/preprocessing.py için pytest testleri
  test_predict.py         # src/predict.py için pytest testleri
models/
  scaler.pkl           # (opsiyonel, manuel ön işleme için)
  model_pipeline.pkl   # final model paketi (Pipeline + eşik + sütun listesi)
app/
  app.py             # Flask web sitesi -- "/" (form + tahmin) ve "/api/predict" (JSON) route'ları
  templates/
    index.html       # üç sekmeli SPA: Tahmin / Analizler / Model Bilgisi + sonuç modalı
  static/
    css/style.css        # airline sky tema (koyu/açık mod, notebook ile aynı renk paleti)
    js/script.js          # form, sekme geçişleri, geçmiş (localStorage), tema anahtarı
    js/modal-plane3d.js    # tahmin sonucu modalında 3D uçak animasyonu (Three.js)
    models/airplane.glb   # 3D uçak modeli
    videos/airplane-window.mp4  # hero bölümündeki uçak penceresi videosu
Dockerfile             # üretim imajı (requirements-prod.txt + gunicorn)
docker-compose.yml      # lokal `docker compose up` için kısayol
render.yaml              # Render.com Blueprint tanımı
requirements-prod.txt   # sadece çalışma zamanı için gereken paketler
```

<br/>

## 🚀 Kurulum

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## ▶️ Çalıştırma

```bash
python app/app.py
```

Varsayılan olarak http://127.0.0.1:5000 adresinde açılır.

## 🧪 Testler

```bash
pytest
```

`tests/` klasöründeki testler `src/preprocessing.py` ve `src/predict.py`
içindeki fonksiyonları kapsar. `models/model_pipeline.pkl` henüz
oluşturulmadıysa (yani `python src/train.py` hiç çalıştırılmadıysa),
gerçek modele ihtiyaç duyan birkaç test otomatik olarak atlanır (skip).

## 🐳 Docker ile Çalıştırma

```bash
docker compose up --build
```

veya doğrudan Docker ile:

```bash
docker build -t flightplus .
docker run -p 8000:8000 flightplus
```

Her iki durumda da site http://127.0.0.1:8000 adresinde açılır. İmaj,
sadece çalışma zamanı için gereken minimal bağımlılıkları kurar
(`requirements-prod.txt` — notebook/SHAP/görselleştirme paketleri hariç),
üretimde `gunicorn` ile servis eder.

## ☁️ Yayınlama

**Render:**

1. Bu projeyi bir GitHub reposuna it (push).
2. [render.com](https://render.com)'da hesap aç, "New +" → "Blueprint" seç.
3. GitHub reposunu bağla — Render, repodaki `render.yaml`'ı otomatik bulup
   `Dockerfile`'dan imajı build edip deploy eder.
4. Build bitince Render sana `https://flightplus-xxxx.onrender.com` gibi bir
   canlı link verir.

**Railway:** [railway.app](https://railway.app)'te "New Project" →
"Deploy from GitHub repo" — Railway `Dockerfile`'ı otomatik algılar, ayrı
bir config dosyasına gerek yoktur.

<br/>

## ✅ Durum

- [x] Veri seti incelendi, klasör yapısı kuruldu
- [x] EDA (notebooks/airline.ipynb — univariate, bivariate, çoklu değişken analizi, istatistiksel testler)
- [x] Ön işleme (src/preprocessing.py)
- [x] Modelleme (src/train.py — 10 model karşılaştırması, LightGBM seçimi, hiperparametre + eşik ayarı, final test değerlendirmesi, SHAP ile açıklanabilirlik)
- [x] Flask web sitesi (app/app.py + templates/ + static/)
- [x] REST API endpoint'i (POST /api/predict)
- [x] pytest unit testleri (preprocessing.py / predict.py)
- [x] Dockerize etme (Dockerfile + docker-compose.yml, requirements-prod.txt ile minimal imaj)
- [x] Yayınlama için hazırlık (render.yaml eklendi) — fiili deploy, GitHub/hesap bağlantısı gerektirdiği için elle tamamlanmalı

<br/>

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:59A8DE,50:1E6FB0,100:0B3D66&height=120&section=footer" width="100%" alt="footer" />
</div>
