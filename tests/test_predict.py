"""
test_predict.py
----------------
src/predict.py icindeki predict_satisfaction() fonksiyonunun karar mantigini
(esik/threshold kiyaslamasi) sahte (fake) bir pipeline ile, ve load_model() +
gercek kayitli modeli (models/model_pipeline.pkl varsa) uctan uca test eder.
"""

from pathlib import Path

import numpy as np
import pytest

from predict import MODEL_PATH, load_model, predict_satisfaction


class _SahtePipeline:
    """predict_proba'yi sabit bir olasilikla doner -- esik kiyaslama mantigini
    gercek bir modele ihtiyac duymadan test etmemizi saglar."""

    def __init__(self, olasilik):
        self._olasilik = olasilik

    def predict_proba(self, X):
        n = len(X)
        return np.array([[1 - self._olasilik, self._olasilik]] * n)


def _sahte_paket(olasilik, esik):
    return {
        "pipeline": _SahtePipeline(olasilik),
        "esik": esik,
        "ham_ozellik_sutunlari": ["Age"],
    }


ORNEK_YOLCU = {"Age": 30}


# ------------------------------------------------------------------
# Esik (threshold) karar mantigi
# ------------------------------------------------------------------
def test_predict_satisfaction_above_threshold_is_satisfied():
    paket = _sahte_paket(olasilik=0.80, esik=0.5529)
    sonuc = predict_satisfaction(paket, ORNEK_YOLCU)
    assert sonuc["label"] == "satisfied"
    assert sonuc["probability"] == pytest.approx(0.80)


def test_predict_satisfaction_below_threshold_is_not_satisfied():
    paket = _sahte_paket(olasilik=0.30, esik=0.5529)
    sonuc = predict_satisfaction(paket, ORNEK_YOLCU)
    assert sonuc["label"] == "neutral or dissatisfied"


def test_predict_satisfaction_exactly_at_threshold_is_satisfied():
    # kod ">=" kullaniyor, esige esit oldugunda "satisfied" beklenir
    paket = _sahte_paket(olasilik=0.5529, esik=0.5529)
    sonuc = predict_satisfaction(paket, ORNEK_YOLCU)
    assert sonuc["label"] == "satisfied"


def test_predict_satisfaction_just_below_threshold_is_not_satisfied():
    paket = _sahte_paket(olasilik=0.5528, esik=0.5529)
    sonuc = predict_satisfaction(paket, ORNEK_YOLCU)
    assert sonuc["label"] == "neutral or dissatisfied"


def test_predict_satisfaction_returns_expected_keys_and_types():
    paket = _sahte_paket(olasilik=0.42, esik=0.5)
    sonuc = predict_satisfaction(paket, ORNEK_YOLCU)
    assert set(sonuc.keys()) == {"label", "probability"}
    assert isinstance(sonuc["label"], str)
    assert isinstance(sonuc["probability"], float)
    assert 0.0 <= sonuc["probability"] <= 1.0


def test_predict_satisfaction_uses_default_05_threshold_correctly():
    # varsayilan (F1-optimize edilmemis) 0.5 esigiyle de dogru calismali
    paket = _sahte_paket(olasilik=0.51, esik=0.5)
    assert predict_satisfaction(paket, ORNEK_YOLCU)["label"] == "satisfied"


# ------------------------------------------------------------------
# load_model() + gercek kayitli model (varsa) ile uctan uca test
# ------------------------------------------------------------------
GERCEK_MODEL_VAR_MI = MODEL_PATH.exists()

ORNEK_GERCEK_YOLCU = {
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


@pytest.mark.skipif(not GERCEK_MODEL_VAR_MI, reason="models/model_pipeline.pkl bulunamadi (once train.py calistirilmali)")
def test_load_model_returns_expected_package_structure():
    paket = load_model()
    assert set(paket.keys()) == {"pipeline", "esik", "ham_ozellik_sutunlari"}
    assert 0.0 < paket["esik"] < 1.0
    assert isinstance(paket["ham_ozellik_sutunlari"], list)
    assert len(paket["ham_ozellik_sutunlari"]) == 22  # 6 temel + 2 gecikme + 14 hizmet


@pytest.mark.skipif(not GERCEK_MODEL_VAR_MI, reason="models/model_pipeline.pkl bulunamadi (once train.py calistirilmali)")
def test_predict_satisfaction_with_real_model_returns_valid_result():
    paket = load_model()
    sonuc = predict_satisfaction(paket, ORNEK_GERCEK_YOLCU)
    assert sonuc["label"] in {"satisfied", "neutral or dissatisfied"}
    assert 0.0 <= sonuc["probability"] <= 1.0


@pytest.mark.skipif(not GERCEK_MODEL_VAR_MI, reason="models/model_pipeline.pkl bulunamadi (once train.py calistirilmali)")
def test_predict_satisfaction_missing_column_raises():
    paket = load_model()
    eksik_yolcu = dict(ORNEK_GERCEK_YOLCU)
    del eksik_yolcu["Age"]
    with pytest.raises(KeyError):
        predict_satisfaction(paket, eksik_yolcu)


@pytest.mark.skipif(not GERCEK_MODEL_VAR_MI, reason="models/model_pipeline.pkl bulunamadi (once train.py calistirilmali)")
def test_predict_satisfaction_handles_missing_arrival_delay():
    # Arrival Delay in Minutes bos (None) birakilirsa Pipeline'daki
    # OzellikMuhendisligi bunu Departure Delay ile doldurmali, hata vermemeli
    yolcu = dict(ORNEK_GERCEK_YOLCU)
    yolcu["Arrival Delay in Minutes"] = None
    paket = load_model()
    sonuc = predict_satisfaction(paket, yolcu)
    assert sonuc["label"] in {"satisfied", "neutral or dissatisfied"}
