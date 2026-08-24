"""
train.py
--------
Notebook'ta (notebooks/airline.ipynb) adim adim gelistirilen, ham
sutunlardan baslayan uctan uca Pipeline'in ve final modelin (ayarlanmis
LightGBM), tekrar kullanilabilir bir script'e tasinmis hali.

Bu dosya calistirildiginda (python src/train.py):
    1. data/raw/train.csv ve data/raw/test.csv okunur
    2. Ham sutunlardan baslayan Pipeline (ozellik muhendisligi + on isleme +
       LightGBM) egitim setinin %80'i uzerinde egitilir
    3. Kalan %20'lik dogrulama setinde, F1-score'u maksimize eden karar
       esigi bulunur (bkz. notebook, "Esik (Threshold) Ayari" bolumu)
    4. Hic dokunulmamis test.csv uzerinde final metrikler raporlanir
    5. Pipeline + esik + beklenen ham sutun listesi, models/model_pipeline.pkl
       olarak tek bir paket halinde kaydedilir

Kullanilan hiperparametreler, notebook'taki RandomizedSearchCV aramasinin
(30 kombinasyon, 5 katli stratified CV, ROC-AUC skorlamasi) sonucudur --
bkz. notebooks/airline.ipynb, "Hiperparametre Ayari - LightGBM" bolumu.
Aramayi burada tekrar calistirmiyoruz (150 fit gerektirdigi icin yavas
olurdu); bulunan en iyi parametreleri dogrudan kullaniyoruz.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

try:
    from lightgbm import LGBMClassifier
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "lightgbm kurulu degil. requirements.txt uzerinden kurulum yapin: "
        "pip install -r requirements.txt"
    ) from exc

# OzellikMuhendisligi AYRI bir modulden import ediliyor (feature_engineering.py)
# -- boylece models/model_pipeline.pkl, hem bu script hem predict.py tarafindan
# sorunsuz yuklenebiliyor. Sinif dogrudan bu dosyada tanimlanirsa, joblib modeli
# baska bir script'ten yuklerken "Can't get attribute ... on <module '__main__'>"
# hatasi verir (bkz. feature_engineering.py'nin docstring'i).
from feature_engineering import GECIKME_COLS, SERVICE_COLS, OzellikMuhendisligi

# ------------------------------------------------------------------
# Sabitler -- notebook'taki degisken isimleriyle birebir ayni
# ------------------------------------------------------------------
IKILI_KATEGORIK_COLS = ["Gender", "Customer Type", "Type of Travel"]

# Pipeline'a girecek ham sutunlar -- geri kalanini Pipeline kendisi turetir
HAM_OZELLIK_COLS = (
    ["Gender", "Customer Type", "Type of Travel", "Class", "Age", "Flight Distance"]
    + GECIKME_COLS + SERVICE_COLS
)

# notebook'taki RandomizedSearchCV aramasinin sonucu (best_params_)
EN_IYI_HIPERPARAMETRELER = {
    "colsample_bytree": 0.9329770563201687,
    "learning_rate": 0.05034443102887247,
    "max_depth": 14,
    "min_child_samples": 25,
    "n_estimators": 260,
    "num_leaves": 77,
    "subsample": 0.8099025726528951,
}


def build_pipeline() -> Pipeline:
    """Ham sutunlardan baslayip tahmine kadar giden uctan uca Pipeline'i kurar."""
    sayisal_olcek_cols = (
        ["Age", "Flight Distance", "Departure Delay in Minutes (log)", "Arrival Delay in Minutes (log)"]
        + SERVICE_COLS + ["Ortalama Hizmet Puani", "Toplam Gecikme", "Gecikme Farki"]
    )

    on_isleyici = ColumnTransformer(transformers=[
        ("sayisal", StandardScaler(), sayisal_olcek_cols),
        ("ikili", OrdinalEncoder(), IKILI_KATEGORIK_COLS),
        ("class", OrdinalEncoder(categories=[["Eco", "Eco Plus", "Business"]]), ["Class"]),
        ("yas_grubu", OneHotEncoder(handle_unknown="ignore"), ["Yas Grubu"]),
    ])

    model = LGBMClassifier(random_state=42, verbose=-1, **EN_IYI_HIPERPARAMETRELER)

    return Pipeline([
        ("ozellik_muhendisligi", OzellikMuhendisligi()),
        ("on_isleme", on_isleyici),
        ("model", model),
    ])


def en_iyi_esigi_bul(pipeline: Pipeline, X_val: pd.DataFrame, y_val: pd.Series) -> float:
    """F1-score'u maksimize eden karar esigini validation setinde bulur."""
    olasilik = pipeline.predict_proba(X_val)[:, 1]
    precision, recall, esikler = precision_recall_curve(y_val, olasilik)
    f1_skorlari = (2 * precision[:-1] * recall[:-1]) / (precision[:-1] + recall[:-1] + 1e-9)
    return float(esikler[f1_skorlari.argmax()])


def metrikleri_hesapla(pipeline: Pipeline, X: pd.DataFrame, y: pd.Series, esik: float) -> dict:
    olasilik = pipeline.predict_proba(X)[:, 1]
    tahmin = (olasilik >= esik).astype(int)
    return {
        "Accuracy": accuracy_score(y, tahmin),
        "Precision": precision_score(y, tahmin),
        "Recall": recall_score(y, tahmin),
        "F1-Score": f1_score(y, tahmin),
        "ROC-AUC": roc_auc_score(y, olasilik),
    }


def train() -> dict:
    """Pipeline'i egitir, esigi bulur, test setinde degerlendirir. Paketi doner."""
    PROJE_KOK = Path(__file__).resolve().parent.parent
    RAW_DIR = PROJE_KOK / "data" / "raw"

    df_train = pd.read_csv(RAW_DIR / "train.csv", index_col=0)
    df_test = pd.read_csv(RAW_DIR / "test.csv", index_col=0)

    y_train_tum = (df_train["satisfaction"] == "satisfied").astype(int)
    y_test = (df_test["satisfaction"] == "satisfied").astype(int)

    df_train_split, df_val, y_train, y_val = train_test_split(
        df_train, y_train_tum, test_size=0.2, stratify=y_train_tum, random_state=42
    )

    X_train = df_train_split[HAM_OZELLIK_COLS]
    X_val = df_val[HAM_OZELLIK_COLS]
    X_test = df_test[HAM_OZELLIK_COLS]

    pipeline = build_pipeline()
    print("Final Pipeline egitiliyor (LightGBM, ayarlanmis hiperparametrelerle)...")
    pipeline.fit(X_train, y_train)

    esik = en_iyi_esigi_bul(pipeline, X_val, y_val)
    print(f"Secilen karar esigi: {esik:.4f}")

    test_metrikleri = metrikleri_hesapla(pipeline, X_test, y_test, esik)
    print("\nTest seti metrikleri:")
    for isim, deger in test_metrikleri.items():
        print(f"  {isim:10s}: {deger:.4f}")

    return {
        "pipeline": pipeline,
        "esik": esik,
        "ham_ozellik_sutunlari": HAM_OZELLIK_COLS,
    }


if __name__ == "__main__":
    PROJE_KOK = Path(__file__).resolve().parent.parent
    MODELS_DIR = PROJE_KOK / "models"
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    final_model_paketi = train()

    KAYIT_YOLU = MODELS_DIR / "model_pipeline.pkl"
    joblib.dump(final_model_paketi, KAYIT_YOLU)
    print(f"\nFinal model paketi kaydedildi -> {KAYIT_YOLU}")
