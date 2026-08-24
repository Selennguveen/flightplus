"""
conftest.py
-----------
pytest'in src/ klasorunu import edebilmesi icin proje kokunu ve src/'yi
sys.path'e ekler (app.py ve predict.py'nin yaptigi ile ayni yontem).
"""

import sys
from pathlib import Path

PROJE_KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJE_KOK / "src"))
