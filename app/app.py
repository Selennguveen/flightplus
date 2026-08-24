"""
app.py
------
Faz 7: Flask web sitesi.

Calistirmak icin (proje kok dizininden):
    python app/app.py
(varsayilan olarak http://127.0.0.1:5000 adresinde acilir)

"/" route'u GET'te bos formu, POST'ta form verisinden turetilen
tahmin sonucunu (etiket + olasilik) gosterir. Tahmin, src/predict.py
icindeki load_model() / predict_satisfaction() fonksiyonlariyla yapilir
-- ML mantigi tamamen orada, bu dosya sadece form <-> model koprusu.
"""

import sys
from pathlib import Path

from flask import Flask, jsonify, render_template, request

# src/ klasorunu import edilebilir yapmak icin proje kokunu sys.path'e ekle
PROJE_KOK = Path(__file__).resolve().parent.parent
sys.path.append(str(PROJE_KOK / "src"))

from predict import load_model, predict_satisfaction  # noqa: E402

app = Flask(__name__)

# Model, uygulama baslatilirken bir kez yuklenir (her istekte yeniden
# yuklemek gereksiz yavaslik yaratir).
MODEL_PAKETI = load_model()

# Hizmet puani alanlari: (form/predict.py'nin bekledigi ham sutun adi, Turkce etiket)
# Siralama, src/feature_engineering.py -> SERVICE_COLS ile birebir ayni.
HIZMET_ALANLARI = [
    ("Inflight wifi service", "Uçuş içi Wi-Fi hizmeti"),
    ("Departure/Arrival time convenient", "Kalkış/Varış saati uygunluğu"),
    ("Ease of Online booking", "Online rezervasyon kolaylığı"),
    ("Gate location", "Kapı konumu"),
    ("Food and drink", "Yiyecek ve içecek"),
    ("Online boarding", "Online biniş"),
    ("Seat comfort", "Koltuk konforu"),
    ("Inflight entertainment", "Uçuş içi eğlence"),
    ("On-board service", "Kabin hizmeti"),
    ("Leg room service", "Diz mesafesi"),
    ("Baggage handling", "Bagaj işlemleri"),
    ("Checkin service", "Check-in hizmeti"),
    ("Inflight service", "Uçuş içi hizmet"),
    ("Cleanliness", "Temizlik"),
]


# Sunucu tarafi dogrulama sinirlari. HTML'deki min/max sadece tarayicida
# calisir -- /api/predict'e dogrudan istek atan biri bunlari atlayabilir,
# bu yuzden ayni sinirlari burada da uyguluyoruz.
GECERLI_KATEGORILER = {
    "Gender": {"Male", "Female"},
    "Customer Type": {"Loyal Customer", "disloyal Customer"},
    "Type of Travel": {"Business travel", "Personal Travel"},
    "Class": {"Eco", "Eco Plus", "Business"},
}
SAYISAL_SINIRLAR = {
    "Age": (0, 120),
    "Flight Distance": (0, 10000),
    "Departure Delay in Minutes": (0, 2000),
    "Arrival Delay in Minutes": (0, 2000),
}


def _dogrula(yolcu: dict) -> None:
    """Yolcu dict'indeki degerlerin gecerli araliklarda oldugunu kontrol eder.
    Bir sorun varsa aciklayici bir ValueError firlatir (cagiran taraf yakalar)."""
    for alan, gecerli_degerler in GECERLI_KATEGORILER.items():
        if yolcu[alan] not in gecerli_degerler:
            raise ValueError(f"Gecersiz '{alan}' degeri: {yolcu[alan]!r}")

    for alan, (alt_sinir, ust_sinir) in SAYISAL_SINIRLAR.items():
        deger = yolcu[alan]
        if deger is None:
            continue  # Arrival Delay bos birakilabilir, Pipeline kendi dolduruyor
        if not (alt_sinir <= deger <= ust_sinir):
            raise ValueError(f"'{alan}' {alt_sinir}-{ust_sinir} araliginda olmali, alinan: {deger}")

    for alan_adi, _ in HIZMET_ALANLARI:
        deger = yolcu[alan_adi]
        if not (0 <= deger <= 5):
            raise ValueError(f"'{alan_adi}' 0-5 araliginda olmali, alinan: {deger}")


def _forma_gore_yolcu_olustur(form) -> dict:
    """Flask form veya JSON verisinden, predict_satisfaction'ın beklediği ham yolcu dict'ini kurar."""
    varis_gecikmesi = str(form.get("Arrival Delay in Minutes", "")).strip()

    yolcu = {
        "Gender": form["Gender"],
        "Customer Type": form["Customer Type"],
        "Type of Travel": form["Type of Travel"],
        "Class": form["Class"],
        "Age": int(form["Age"]),
        "Flight Distance": int(form["Flight Distance"]),
        "Departure Delay in Minutes": int(form["Departure Delay in Minutes"]),
        # Bos birakilirsa None -> Pipeline'daki OzellikMuhendisligi bunu
        # Departure Delay ile dolduruyor (bkz. feature_engineering.py)
        "Arrival Delay in Minutes": int(varis_gecikmesi) if varis_gecikmesi and varis_gecikmesi != "None" else None,
    }

    for alan_adi, _ in HIZMET_ALANLARI:
        yolcu[alan_adi] = int(form[alan_adi])

    _dogrula(yolcu)
    return yolcu


@app.route("/", methods=["GET", "POST"])
def index():
    # NOT: Normalde form gonderimi JS tarafindan (fetch ile /api/predict'e)
    # yapiliyor ve bu POST dali hic tetiklenmiyor -- bu sadece JS'in
    # calismadigi durumlar icin bir yedek (graceful fallback). Gecersiz veri
    # gelirse 500 hatasi vermek yerine formu bos donuyoruz.
    tahmin_sonucu = None

    if request.method == "POST":
        try:
            yolcu = _forma_gore_yolcu_olustur(request.form)
            tahmin_sonucu = predict_satisfaction(MODEL_PAKETI, yolcu)
        except (KeyError, ValueError):
            tahmin_sonucu = None

    return render_template(
        "index.html",
        tahmin_sonucu=tahmin_sonucu,
        hizmet_alanlari=HIZMET_ALANLARI,
    )


@app.route("/api/predict", methods=["POST"])
def api_predict():
    try:
        veri = request.get_json(silent=True) or request.form
        yolcu = _forma_gore_yolcu_olustur(veri)
        sonuc = predict_satisfaction(MODEL_PAKETI, yolcu)
        return jsonify({"success": True, "result": sonuc})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
