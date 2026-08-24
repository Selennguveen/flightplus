"""
feature_engineering.py
-----------------------
Notebook'taki (notebooks/airline.ipynb) Pipeline'da kullanilan ozellik
muhendisligi adimlarinin, ayri ve paylasilan bir modul olarak tutulan hali.

Bu dosyanin AYRI bir modulde olmasi onemli: hem train.py (modeli egitip
kaydeden) hem predict.py (modeli yukleyip tahmin yapan) BU MODULDEN
import etmeli. Aksi halde -- ornegin sinif dogrudan train.py veya bir
notebook'un __main__ alaninda tanimlanirsa -- joblib/pickle modeli farkli
bir script'ten yuklerken "Can't get attribute 'OzellikMuhendisligi' on
<module '__main__'>" hatasi verir, cunku pickle sinifi kaydedildigi
modul yolundan tekrar bulmaya calisir.
"""

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin

SERVICE_COLS = [
    "Inflight wifi service", "Departure/Arrival time convenient", "Ease of Online booking",
    "Gate location", "Food and drink", "Online boarding", "Seat comfort",
    "Inflight entertainment", "On-board service", "Leg room service",
    "Baggage handling", "Checkin service", "Inflight service", "Cleanliness",
]
GECIKME_COLS = ["Departure Delay in Minutes", "Arrival Delay in Minutes"]


class OzellikMuhendisligi(BaseEstimator, TransformerMixin):
    """
    Notebook'ta manuel olarak yaptigimiz turetilmis ozellik adimlarinin
    Pipeline'a tasinmis hali: eksik deger doldurma, log donusumu,
    Ortalama Hizmet Puani / Toplam Gecikme / Gecikme Farki / Yas Grubu.
    """

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()
        X["Arrival Delay in Minutes"] = X["Arrival Delay in Minutes"].fillna(
            X["Departure Delay in Minutes"]
        )
        X["Ortalama Hizmet Puani"] = X[SERVICE_COLS].mean(axis=1)
        X["Toplam Gecikme"] = X["Departure Delay in Minutes"] + X["Arrival Delay in Minutes"]
        X["Gecikme Farki"] = X["Arrival Delay in Minutes"] - X["Departure Delay in Minutes"]
        for col in GECIKME_COLS:
            X[f"{col} (log)"] = np.log1p(X[col])
        X["Yas Grubu"] = pd.cut(
            X["Age"], bins=[0, 25, 40, 60, 100], labels=["18-25", "26-40", "41-60", "60+"]
        ).astype(str)
        return X
