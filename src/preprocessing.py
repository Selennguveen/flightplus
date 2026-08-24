"""
preprocessing.py
-----------------
Notebook'ta (notebooks/airline.ipynb) adım adım geliştirilen veri ön işleme
mantığının, tekrar kullanılabilir fonksiyonlar hâlinde script'e taşınmış hâli.

Bu dosya çalıştırıldığında (python src/preprocessing.py):
    1. data/raw/train.csv ve data/raw/test.csv okunur
    2. Eksik değer doldurma, log dönüşümü, encoding, ölçekleme ve
       özellik türetme adımları uygulanır
    3. İşlenmiş veriler data/processed/ klasörüne kaydedilir
    4. Ölçekleme için fit edilen StandardScaler, models/scaler.pkl olarak
       kaydedilir (ileride tahmin yaparken aynı ölçeği kullanmak için)

Notebook'taki kararların gerekçeleri (neden log dönüşümü, neden ordinal
encoding vb.) için bkz. notebooks/airline.ipynb — "Veri Ön İşleme ve
Feature Engineering" bölümü.
"""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ------------------------------------------------------------------
# Sabitler — notebook'taki değişken isimleriyle birebir aynı
# ------------------------------------------------------------------
SERVICE_COLS = [
    "Inflight wifi service", "Departure/Arrival time convenient", "Ease of Online booking",
    "Gate location", "Food and drink", "Online boarding", "Seat comfort",
    "Inflight entertainment", "On-board service", "Leg room service",
    "Baggage handling", "Checkin service", "Inflight service", "Cleanliness",
]
SUREKLI_SAYISAL_COLS = ["Age", "Flight Distance", "Departure Delay in Minutes", "Arrival Delay in Minutes"]
GECIKME_COLS = ["Departure Delay in Minutes", "Arrival Delay in Minutes"]

IKILI_ESLEME = {
    "Gender": {"Male": 0, "Female": 1},
    "Customer Type": {"Loyal Customer": 0, "disloyal Customer": 1},
    "Type of Travel": {"Personal Travel": 0, "Business travel": 1},
}
CLASS_ESLEME = {"Eco": 0, "Eco Plus": 1, "Business": 2}

OLCEK_COLS = (
    ["Age", "Flight Distance", "Departure Delay in Minutes (log)", "Arrival Delay in Minutes (log)"]
    + SERVICE_COLS
)


# ------------------------------------------------------------------
# Adım adım ön işleme fonksiyonları
# ------------------------------------------------------------------
def load_raw_data(raw_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """data/raw/train.csv ve test.csv dosyalarını okur."""
    df_train = pd.read_csv(raw_dir / "train.csv", index_col=0)
    df_test = pd.read_csv(raw_dir / "test.csv", index_col=0)
    return df_train, df_test


def fill_missing_values(df: pd.DataFrame) -> pd.DataFrame:
    """
    Arrival Delay in Minutes'taki eksik değerleri, aynı satırın
    Departure Delay in Minutes değeriyle doldurur (%96,5 korelasyona dayanarak
    — bkz. notebook, cell 70).
    """
    df = df.copy()
    df["Arrival Delay in Minutes"] = df["Arrival Delay in Minutes"].fillna(df["Departure Delay in Minutes"])
    return df


def add_log_features(df: pd.DataFrame) -> pd.DataFrame:
    """Departure/Arrival Delay için log1p ile türetilmiş sütunlar ekler (orijinaller korunur)."""
    df = df.copy()
    for col in GECIKME_COLS:
        df[f"{col} (log)"] = np.log1p(df[col])
    return df


def encode_categoricals(df: pd.DataFrame) -> pd.DataFrame:
    """
    İkili değişkenleri (Gender, Customer Type, Type of Travel) 0/1 olarak,
    Class'ı ise sırayı koruyan ordinal (Eco=0, Eco Plus=1, Business=2)
    olarak kodlar.
    """
    df = df.copy()
    for col, esleme in IKILI_ESLEME.items():
        df[f"{col} (encoded)"] = df[col].map(esleme)
    df["Class (encoded)"] = df["Class"].map(CLASS_ESLEME)
    return df


def fit_scaler(df_train: pd.DataFrame) -> StandardScaler:
    """StandardScaler'ı SADECE train verisine fit eder (veri sızıntısını önlemek için)."""
    scaler = StandardScaler()
    scaler.fit(df_train[OLCEK_COLS])
    return scaler


def apply_scaler(df: pd.DataFrame, scaler: StandardScaler) -> pd.DataFrame:
    """Fit edilmiş scaler'ı bir veri setine uygular, sonuçları (scaled) sütunları olarak ekler."""
    df = df.copy()
    olceklenmis = scaler.transform(df[OLCEK_COLS])
    olceklenmis_df = pd.DataFrame(
        olceklenmis,
        columns=[f"{c} (scaled)" for c in OLCEK_COLS],
        index=df.index,
    )
    df[olceklenmis_df.columns] = olceklenmis_df
    return df


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """Ortalama Hizmet Puani, Toplam Gecikme, Gecikme Farki, Yas Grubu özelliklerini türetir."""
    df = df.copy()
    df["Ortalama Hizmet Puani"] = df[SERVICE_COLS].mean(axis=1)
    df["Toplam Gecikme"] = df["Departure Delay in Minutes"] + df["Arrival Delay in Minutes"]
    df["Gecikme Farki"] = df["Arrival Delay in Minutes"] - df["Departure Delay in Minutes"]
    df["Yas Grubu"] = pd.cut(
        df["Age"],
        bins=[0, 25, 40, 60, 100],
        labels=["18-25", "26-40", "41-60", "60+"],
    )
    return df


def drop_unused_columns(df: pd.DataFrame) -> pd.DataFrame:
    """id sütununu çıkarır — benzersiz bir kayıt numarası, tahmine katkısı yok."""
    df = df.copy()
    if "id" in df.columns:
        df = df.drop(columns=["id"])
    return df


def preprocess(
    df_train: pd.DataFrame, df_test: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame, StandardScaler]:
    """
    Notebook'taki "Veri Ön İşleme ve Feature Engineering" bölümündeki tüm
    adımları sırasıyla uygular: eksik değer doldurma -> log dönüşümü ->
    encoding -> ölçekleme -> özellik türetme -> id çıkarma.

    Scaler SADECE df_train'e fit edilir, sonra her iki sete de uygulanır.
    """
    df_train = fill_missing_values(df_train)
    df_test = fill_missing_values(df_test)

    df_train = add_log_features(df_train)
    df_test = add_log_features(df_test)

    df_train = encode_categoricals(df_train)
    df_test = encode_categoricals(df_test)

    scaler = fit_scaler(df_train)
    df_train = apply_scaler(df_train, scaler)
    df_test = apply_scaler(df_test, scaler)

    df_train = add_engineered_features(df_train)
    df_test = add_engineered_features(df_test)

    df_train = drop_unused_columns(df_train)
    df_test = drop_unused_columns(df_test)

    return df_train, df_test, scaler


def stratified_split(df_train: pd.DataFrame, test_size: float = 0.2, random_state: int = 42):
    """satisfaction oranını koruyan stratified train/validation ayrımı."""
    return train_test_split(
        df_train, test_size=test_size, stratify=df_train["satisfaction"], random_state=random_state
    )


# ------------------------------------------------------------------
# Script olarak çalıştırıldığında: işlenmiş veriyi diske kaydet
# ------------------------------------------------------------------
if __name__ == "__main__":
    PROJE_KOK = Path(__file__).resolve().parent.parent
    RAW_DIR = PROJE_KOK / "data" / "raw"
    PROCESSED_DIR = PROJE_KOK / "data" / "processed"
    MODELS_DIR = PROJE_KOK / "models"

    df_train_raw, df_test_raw = load_raw_data(RAW_DIR)
    df_train_islenmis, df_test_islenmis, scaler = preprocess(df_train_raw, df_test_raw)
    df_train_split, df_val = stratified_split(df_train_islenmis)

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    df_train_islenmis.to_csv(PROCESSED_DIR / "train_processed.csv")
    df_train_split.to_csv(PROCESSED_DIR / "train_split.csv")
    df_val.to_csv(PROCESSED_DIR / "val_split.csv")
    df_test_islenmis.to_csv(PROCESSED_DIR / "test_processed.csv")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(scaler, MODELS_DIR / "scaler.pkl")

    print(f"İşlenmiş train: {df_train_islenmis.shape}")
    print(f"Eğitim seti (split): {df_train_split.shape}")
    print(f"Doğrulama seti (split): {df_val.shape}")
    print(f"İşlenmiş test: {df_test_islenmis.shape}")
    print(f"Kaydedildi -> {PROCESSED_DIR}")
    print(f"Scaler kaydedildi -> {MODELS_DIR / 'scaler.pkl'}")
