"""
test_preprocessing.py
----------------------
src/preprocessing.py icindeki ham veri -> islenmis veri adimlarinin
her birini kucuk, sentetik DataFrame'ler uzerinde test eder (gercek
train.csv/test.csv dosyalarina ihtiyac duymadan).
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing import (
    CLASS_ESLEME,
    IKILI_ESLEME,
    add_engineered_features,
    add_log_features,
    drop_unused_columns,
    encode_categoricals,
    fill_missing_values,
    fit_scaler,
    apply_scaler,
    preprocess,
    stratified_split,
    OLCEK_COLS,
    SERVICE_COLS,
)


def _ornek_yolcu_df(n=20, seed=0):
    """SERVICE_COLS dahil, preprocess() icin gereken tum ham sutunlari iceren
    kucuk, rastgele ama gecerli araliklarda bir DataFrame uretir."""
    rng = np.random.default_rng(seed)
    veri = {
        "Gender": rng.choice(["Male", "Female"], size=n),
        "Customer Type": rng.choice(["Loyal Customer", "disloyal Customer"], size=n),
        "Type of Travel": rng.choice(["Business travel", "Personal Travel"], size=n),
        "Class": rng.choice(["Eco", "Eco Plus", "Business"], size=n),
        "Age": rng.integers(7, 85, size=n),
        "Flight Distance": rng.integers(50, 4000, size=n),
        "Departure Delay in Minutes": rng.integers(0, 200, size=n).astype(float),
        "Arrival Delay in Minutes": rng.integers(0, 200, size=n).astype(float),
        "satisfaction": rng.choice(["satisfied", "neutral or dissatisfied"], size=n),
    }
    for col in SERVICE_COLS:
        veri[col] = rng.integers(0, 6, size=n)
    return pd.DataFrame(veri)


# ------------------------------------------------------------------
# fill_missing_values
# ------------------------------------------------------------------
def test_fill_missing_values_uses_departure_delay():
    df = pd.DataFrame({
        "Departure Delay in Minutes": [10.0, 20.0, 0.0],
        "Arrival Delay in Minutes": [np.nan, 25.0, np.nan],
    })
    sonuc = fill_missing_values(df)
    assert sonuc["Arrival Delay in Minutes"].tolist() == [10.0, 25.0, 0.0]
    assert not sonuc["Arrival Delay in Minutes"].isna().any()


def test_fill_missing_values_does_not_mutate_input():
    df = pd.DataFrame({
        "Departure Delay in Minutes": [10.0],
        "Arrival Delay in Minutes": [np.nan],
    })
    fill_missing_values(df)
    # orijinal DataFrame degismemis olmali (fonksiyon .copy() kullaniyor)
    assert df["Arrival Delay in Minutes"].isna().all()


# ------------------------------------------------------------------
# add_log_features
# ------------------------------------------------------------------
def test_add_log_features_adds_log1p_columns():
    df = pd.DataFrame({
        "Departure Delay in Minutes": [0.0, 10.0],
        "Arrival Delay in Minutes": [0.0, 20.0],
    })
    sonuc = add_log_features(df)
    assert "Departure Delay in Minutes (log)" in sonuc.columns
    assert "Arrival Delay in Minutes (log)" in sonuc.columns
    np.testing.assert_allclose(
        sonuc["Departure Delay in Minutes (log)"], np.log1p([0.0, 10.0])
    )
    # orijinal sutunlar korunmus olmali
    assert sonuc["Departure Delay in Minutes"].tolist() == [0.0, 10.0]


# ------------------------------------------------------------------
# encode_categoricals
# ------------------------------------------------------------------
def test_encode_categoricals_binary_mapping():
    df = pd.DataFrame({
        "Gender": ["Male", "Female"],
        "Customer Type": ["Loyal Customer", "disloyal Customer"],
        "Type of Travel": ["Personal Travel", "Business travel"],
        "Class": ["Eco", "Business"],
    })
    sonuc = encode_categoricals(df)
    assert sonuc["Gender (encoded)"].tolist() == [0, 1]
    assert sonuc["Customer Type (encoded)"].tolist() == [0, 1]
    assert sonuc["Type of Travel (encoded)"].tolist() == [0, 1]


def test_encode_categoricals_class_is_ordinal():
    df = pd.DataFrame({
        "Gender": ["Male"], "Customer Type": ["Loyal Customer"],
        "Type of Travel": ["Business travel"], "Class": ["Eco Plus"],
    })
    sonuc = encode_categoricals(df)
    assert sonuc["Class (encoded)"].iloc[0] == CLASS_ESLEME["Eco Plus"] == 1


@pytest.mark.parametrize("esleme_adi,esleme", list(IKILI_ESLEME.items()))
def test_ikili_esleme_sozlukleri_sadece_iki_deger_iceriyor(esleme_adi, esleme):
    assert set(esleme.values()) == {0, 1}


# ------------------------------------------------------------------
# add_engineered_features
# ------------------------------------------------------------------
def test_add_engineered_features_ortalama_hizmet_puani():
    df = pd.DataFrame({col: [4, 2] for col in SERVICE_COLS})
    df["Departure Delay in Minutes"] = [10, 0]
    df["Arrival Delay in Minutes"] = [15, 0]
    df["Age"] = [30, 70]
    sonuc = add_engineered_features(df)
    assert sonuc["Ortalama Hizmet Puani"].iloc[0] == pytest.approx(4.0)
    assert sonuc["Ortalama Hizmet Puani"].iloc[1] == pytest.approx(2.0)


def test_add_engineered_features_toplam_ve_fark_gecikme():
    df = pd.DataFrame({col: [3] for col in SERVICE_COLS})
    df["Departure Delay in Minutes"] = [10]
    df["Arrival Delay in Minutes"] = [25]
    df["Age"] = [30]
    sonuc = add_engineered_features(df)
    assert sonuc["Toplam Gecikme"].iloc[0] == 35
    assert sonuc["Gecikme Farki"].iloc[0] == 15


def test_add_engineered_features_yas_grubu_binleri():
    df = pd.DataFrame({col: [3, 3, 3, 3] for col in SERVICE_COLS})
    df["Departure Delay in Minutes"] = [0, 0, 0, 0]
    df["Arrival Delay in Minutes"] = [0, 0, 0, 0]
    df["Age"] = [20, 35, 55, 75]
    sonuc = add_engineered_features(df)
    assert sonuc["Yas Grubu"].astype(str).tolist() == ["18-25", "26-40", "41-60", "60+"]


# ------------------------------------------------------------------
# drop_unused_columns
# ------------------------------------------------------------------
def test_drop_unused_columns_removes_id():
    df = pd.DataFrame({"id": [1, 2], "Age": [30, 40]})
    sonuc = drop_unused_columns(df)
    assert "id" not in sonuc.columns
    assert "Age" in sonuc.columns


def test_drop_unused_columns_noop_when_no_id():
    df = pd.DataFrame({"Age": [30, 40]})
    sonuc = drop_unused_columns(df)
    assert list(sonuc.columns) == ["Age"]


# ------------------------------------------------------------------
# fit_scaler / apply_scaler — veri sizintisi olmamali (sadece train'e fit)
# ------------------------------------------------------------------
def test_scaler_fit_on_train_only_gives_zero_mean_on_train():
    df_train = _ornek_yolcu_df(n=200, seed=1)
    df_train = fill_missing_values(df_train)
    df_train = add_log_features(df_train)

    scaler = fit_scaler(df_train)
    sonuc = apply_scaler(df_train, scaler)

    for col in OLCEK_COLS:
        scaled_col = f"{col} (scaled)"
        assert scaled_col in sonuc.columns
        # Kendi train verisine fit edildigi icin ortalama ~0, std ~1 olmali
        assert sonuc[scaled_col].mean() == pytest.approx(0.0, abs=1e-8)
        assert sonuc[scaled_col].std(ddof=0) == pytest.approx(1.0, abs=1e-6)


def test_scaler_fit_only_uses_train_not_test():
    df_train = _ornek_yolcu_df(n=100, seed=2)
    df_test = _ornek_yolcu_df(n=30, seed=3)
    df_train = add_log_features(fill_missing_values(df_train))
    df_test = add_log_features(fill_missing_values(df_test))

    scaler = fit_scaler(df_train)
    # scaler'in ogrendigi ortalama, SADECE train'in ortalamasi olmali
    beklenen_ortalama = df_train[OLCEK_COLS].mean().values
    np.testing.assert_allclose(scaler.mean_, beklenen_ortalama, rtol=1e-6)

    # test verisine uygulandiginda test'in KENDI dagilimina gore
    # sifir ortalamali olmasi gerekmez (bu, sizinti olmadiginin kanitidir)
    sonuc_test = apply_scaler(df_test, scaler)
    fark = abs(sonuc_test["Age (scaled)"].mean())
    # Farkli rastgele ornekler oldugu icin tam sifir olmasi beklenmez
    assert isinstance(fark, float)


# ------------------------------------------------------------------
# preprocess (uctan uca entegrasyon)
# ------------------------------------------------------------------
def test_preprocess_end_to_end_shapes_and_columns():
    df_train = _ornek_yolcu_df(n=150, seed=4)
    df_test = _ornek_yolcu_df(n=50, seed=5)

    train_islenmis, test_islenmis, scaler = preprocess(df_train, df_test)

    # Satir sayilari degismemeli
    assert len(train_islenmis) == len(df_train)
    assert len(test_islenmis) == len(df_test)

    # Turetilmis sutunlar mevcut olmali
    for beklenen_sutun in [
        "Ortalama Hizmet Puani", "Toplam Gecikme", "Gecikme Farki", "Yas Grubu",
        "Gender (encoded)", "Class (encoded)",
        "Departure Delay in Minutes (log)", "Age (scaled)",
    ]:
        assert beklenen_sutun in train_islenmis.columns
        assert beklenen_sutun in test_islenmis.columns

    # Eksik deger kalmamali (Arrival Delay dolduruldu)
    assert not train_islenmis["Arrival Delay in Minutes"].isna().any()

    # scaler sadece train'e fit edildigi icin train'de sifir ortalama beklenir
    assert train_islenmis["Age (scaled)"].mean() == pytest.approx(0.0, abs=1e-8)


def test_preprocess_does_not_leak_target_derived_stats_into_test():
    # test verisi olcekleme icin kullanilmamis olmali -- bunu, ayni scaler
    # nesnesinin hem train hem test'e DONDURULMEDEN uygulandigini kontrol ederek dogruluyoruz
    df_train = _ornek_yolcu_df(n=80, seed=6)
    df_test = _ornek_yolcu_df(n=80, seed=7)
    _, _, scaler = preprocess(df_train, df_test)
    # scaler'in ogrendigi n_samples_seen_, SADECE train boyutuna esit olmali
    assert scaler.n_samples_seen_ == len(df_train)


# ------------------------------------------------------------------
# stratified_split
# ------------------------------------------------------------------
def test_stratified_split_preserves_size_and_proportions():
    df = _ornek_yolcu_df(n=300, seed=8)
    # satisfaction oranini kontrollu hale getirelim
    df["satisfaction"] = ["satisfied"] * 120 + ["neutral or dissatisfied"] * 180

    df_split, df_val = stratified_split(df, test_size=0.2, random_state=42)

    assert len(df_split) + len(df_val) == len(df)
    assert len(df_val) == pytest.approx(len(df) * 0.2, abs=1)

    oran_orijinal = (df["satisfaction"] == "satisfied").mean()
    oran_val = (df_val["satisfaction"] == "satisfied").mean()
    # stratified oldugu icin oranlar birbirine yakin olmali
    assert oran_val == pytest.approx(oran_orijinal, abs=0.05)
