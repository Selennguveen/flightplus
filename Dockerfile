# FlightPlus -- Flask web sitesi icin uretim imaji.
# Sadece calisma zamani icin gereken minimal bagimliliklari kurar
# (bkz. requirements-prod.txt); notebook/gorsellestirme/SHAP gibi
# gelistirme bagimliliklari bu imaja dahil edilmez.

FROM python:3.11-slim

WORKDIR /app

# LightGBM'in calisma zamaninda ihtiyac duydugu sistem kutuphanesi
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

# Sadece calisma zamaninda gereken klasorler: model kodu, Flask sitesi,
# kaydedilmis model paketi. notebooks/, data/, figures/, tests/ dahil
# EDILMEZ (bkz. .dockerignore).
COPY src/ src/
COPY app/ app/
COPY models/ models/

ENV PORT=8000
EXPOSE 8000

# app.py, "src" klasorunu proje kokune gore (__file__ uzerinden) kendi
# sys.path'ine ekliyor -- bu yuzden ayrica PYTHONPATH ayarlamaya gerek yok.
# $PORT, Render/Railway gibi servislerin dısarıdan verdigi portu kullanabilmek
# icin okunuyor (yoksa 8000'e duser) -- bu yuzden CMD shell formunda.
CMD gunicorn --chdir app --bind 0.0.0.0:${PORT:-8000} --workers 2 app:app
