"""
predict.py
----------
Kaydedilmis final model paketini (models/model_pipeline.pkl) yukleyip
tekil bir yolcu icin memnuniyet tahmini doner. app/app.py bu fonksiyonu
cagiracak.

Paket uc seyi birlikte tutuyor (bkz. notebooks/airline.ipynb, "Final
Modeli Kaydetme" bolumu ve src/train.py):
    - pipeline: ham sutunlardan baslayip tahmine kadar giden sklearn Pipeline
    - esik: F1-score'u maksimize eden karar esigi (varsayilan 0.5 degil)
    - ham_ozellik_sutunlari: Pipeline'in bekledigi ham sutun listesi/sirasi
"""

from pathlib import Path

import joblib
import pandas as pd

# OzellikMuhendisligi'yi burada kullanmiyoruz ama import etmemiz sart:
# joblib.load, pickle edilmis Pipeline icindeki OzellikMuhendisligi adimini
# yeniden olustururken bu sinifi feature_engineering modulunden bulabilmeli
# (train.py de modeli kaydederken ayni moduldan import ediyor).
from feature_engineering import OzellikMuhendisligi  # noqa: F401

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "model_pipeline.pkl"


def load_model(path: Path = MODEL_PATH) -> dict:
    """Final model paketini (pipeline + esik + sutun listesi) yukler."""
    return joblib.load(path)


def predict_satisfaction(model_paketi: dict, passenger: dict) -> dict:
    """
    model_paketi: load_model() ile yuklenen paket.
    passenger: Flask formundan gelen tek bir yolcunun ham ozellikleri (dict) --
        model_paketi["ham_ozellik_sutunlari"] listesindeki tum sutunlari icermeli
        (Gender, Customer Type, Type of Travel, Class, Age, Flight Distance,
        Departure/Arrival Delay in Minutes, 14 hizmet puani sutunu).

    Donen deger: {"label": "satisfied" | "neutral or dissatisfied", "probability": float}
    """
    pipeline = model_paketi["pipeline"]
    esik = model_paketi["esik"]
    ham_ozellik_sutunlari = model_paketi["ham_ozellik_sutunlari"]

    X = pd.DataFrame([passenger])[ham_ozellik_sutunlari]
    olasilik = float(pipeline.predict_proba(X)[0, 1])
    etiket = "satisfied" if olasilik >= esik else "neutral or dissatisfied"

    return {"label": etiket, "probability": olasilik}


if __name__ == "__main__":
    # Hizli bir saglik kontrolu: modeli yukleyip ornek bir yolcuyla test et
    model_paketi = load_model()
    print(f"Model yuklendi. Kullanilan esik: {model_paketi['esik']:.4f}")

    ornek_yolcu = {
        "Gender": "Female",
        "Customer Type": "Loyal Customer",
        "Type of Travel": "Business travel",
        "Class": "Business",
        "Age": 45,
        "Flight Distance": 1500,
        "Departure Delay in Minutes": 5,
        "Arrival Delay in Minutes": 3,
        "Inflight wifi service": 4,
        "Departure/Arrival time convenient": 4,
        "Ease of Online booking": 4,
        "Gate location": 3,
        "Food and drink": 4,
        "Online boarding": 5,
        "Seat comfort": 5,
        "Inflight entertainment": 4,
        "On-board service": 4,
        "Leg room service": 4,
        "Baggage handling": 4,
        "Checkin service": 4,
        "Inflight service": 4,
        "Cleanliness": 4,
    }
    sonuc = predict_satisfaction(model_paketi, ornek_yolcu)
    print(f"Ornek tahmin: {sonuc}")
