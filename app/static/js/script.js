/* ============================================================
   FlightPlus — Frontend Engine
   Modal Pop-up, Flying Airplane Animation & Analytics History
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "satisfaction_ai_prediction_history";

  // 1. Video Oynatıcı
  function initVideo() {
    var video = document.querySelector(".window-video");
    if (!video) return;
    video.muted = true;
    video.loop = true;
    var p = video.play();
    if (p !== undefined) {
      p.catch(function () {
        var onFirstTouch = function () {
          video.play();
        };
        window.addEventListener("click", onFirstTouch, { once: true });
        window.addEventListener("touchstart", onFirstTouch, { once: true });
      });
    }
  }

  // 2. Form Verisini Topla
  function getFormData() {
    var form = document.getElementById("satisfaction-form");
    if (!form) return null;
    var data = {};
    var formData = new FormData(form);
    for (var pair of formData.entries()) {
      data[pair[0]] = pair[1];
    }
    return data;
  }

  // 3. Özet Kartını Güncelle (Sadece Seçilen Metrikler)
  function updateSummary(data) {
    if (!data) return;

    var sumClass = document.getElementById("sum-class");
    if (sumClass) sumClass.textContent = data["Class"] || "Eco";

    var sumTravel = document.getElementById("sum-travel");
    if (sumTravel) {
      sumTravel.textContent = data["Type of Travel"] === "Business travel" ? "İş seyahati" : "Kişisel seyahat";
    }

    var sumPassenger = document.getElementById("sum-passenger");
    if (sumPassenger) {
      var genderTr = data["Gender"] === "Female" ? "Kadın" : "Erkek";
      sumPassenger.textContent = genderTr + ", " + (data["Age"] || 35) + " Yaş";
    }

    var sumLoyalty = document.getElementById("sum-loyalty");
    if (sumLoyalty) {
      sumLoyalty.textContent = data["Customer Type"] === "Loyal Customer" ? "Sadık müşteri" : "Sadık olmayan müşteri";
    }

    var sumDist = document.getElementById("sum-dist");
    if (sumDist) {
      var dist = parseInt(data["Flight Distance"] || 0, 10);
      sumDist.textContent = dist.toLocaleString("tr-TR") + " mil";
    }

    var sumDelay = document.getElementById("sum-delay");
    if (sumDelay) {
      var depDelay = parseInt(data["Departure Delay in Minutes"] || 0, 10);
      var arrDelay = parseInt(data["Arrival Delay in Minutes"] || 0, 10);
      var total = depDelay + arrDelay;
      sumDelay.textContent = total > 0 ? total + " dakika" : "0 dakika (Zamanında)";
    }

    // Ortalama hizmet puanı
    var serviceCols = [
      "Inflight wifi service", "Departure/Arrival time convenient", "Ease of Online booking",
      "Gate location", "Food and drink", "Online boarding", "Seat comfort",
      "Inflight entertainment", "On-board service", "Leg room service",
      "Baggage handling", "Checkin service", "Inflight service", "Cleanliness"
    ];
    var sum = 0;
    serviceCols.forEach(function (col) {
      sum += parseInt(data[col] || 3, 10);
    });
    var avg = (sum / serviceCols.length).toFixed(1);
    var sumAvg = document.getElementById("sum-avg-service");
    if (sumAvg) sumAvg.textContent = avg + " / 5.0";

    return avg;
  }

  // 4. Pop-up Modalını Doldur ve Aç
  function openPredictionModal(result, data, avgScore) {
    var modal = document.getElementById("prediction-modal");
    if (!modal || !result) return;

    var isSatisfied = result.label === "satisfied";
    var probPct = (result.probability * 100).toFixed(1);

    var titleEl = document.getElementById("modal-verdict-title");
    var descEl = document.getElementById("modal-verdict-desc");
    var scorePctEl = document.getElementById("modal-score-pct");
    var statusTextEl = document.getElementById("modal-status-text");

    if (titleEl) {
      titleEl.textContent = isSatisfied ? "Yolcu Memnun Kalır (Satisfied)" : "Yolcu Memnun Kalmaz (Dissatisfied)";
      titleEl.style.color = isSatisfied ? "#34D399" : "#F87171";
    }

    if (descEl) {
      descEl.textContent = isSatisfied
        ? "LightGBM modeli uçuş deneyimi parametrelerine göre yüksek memnuniyet tespit etti."
        : "Model hizmet puanları veya gecikme faktörleri nedeniyle memnuniyetsizlik tespit etti.";
    }

    if (scorePctEl) {
      scorePctEl.textContent = "%" + probPct;
      scorePctEl.style.color = isSatisfied ? "#34D399" : "#F87171";
    }

    if (statusTextEl) {
      statusTextEl.textContent = isSatisfied ? "POZİTİF DENEYİM" : "RİSKLİ UÇUŞ DENEYİMİ";
    }

    // Modal özet alanları
    var modalPass = document.getElementById("modal-val-passenger");
    if (modalPass) {
      var g = data["Gender"] === "Female" ? "Kadın" : "Erkek";
      modalPass.textContent = g + ", " + (data["Age"] || 35) + " Yaş";
    }

    var modalClass = document.getElementById("modal-val-class");
    if (modalClass) modalClass.textContent = data["Class"] || "Eco";

    var modalTravel = document.getElementById("modal-val-travel");
    if (modalTravel) {
      modalTravel.textContent = data["Type of Travel"] === "Business travel" ? "İş Seyahati" : "Kişisel Seyahat";
    }

    var modalService = document.getElementById("modal-val-service");
    if (modalService) modalService.textContent = avgScore + " / 5.0";

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePredictionModal() {
    var modal = document.getElementById("prediction-modal");
    if (modal) {
      modal.classList.remove("active");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  // 5. Analiz Geçmişini Kaydetme & Okuma (LocalStorage)
  function getHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function savePredictionToHistory(data, result, avgScore) {
    var history = getHistory();
    var now = new Date();
    var timeStr = now.toLocaleDateString("tr-TR") + " " + now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    var item = {
      id: Date.now(),
      time: timeStr,
      passenger: (data["Gender"] === "Female" ? "Kadın" : "Erkek") + ", " + (data["Age"] || 35) + " Yaş",
      class: data["Class"] || "Eco",
      travel: data["Type of Travel"] === "Business travel" ? "İş Seyahati" : "Kişisel Seyahat",
      delay: (parseInt(data["Departure Delay in Minutes"] || 0, 10) + parseInt(data["Arrival Delay in Minutes"] || 0, 10)) + " dk",
      avgService: avgScore + " / 5",
      isSatisfied: result.label === "satisfied",
      probability: (result.probability * 100).toFixed(1)
    };

    history.unshift(item); // En yeni en başa
    if (history.length > 50) history.pop(); // Maks 50 kayıt
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.log("Geçmiş kaydedilemedi:", e);
    }

    renderAnalytics();
  }

  function renderAnalytics() {
    var history = getHistory();
    var tbody = document.getElementById("history-table-body");
    var totalCountEl = document.getElementById("stat-total-count");
    var satisfiedPctEl = document.getElementById("stat-satisfied-pct");
    var dissatisfiedPctEl = document.getElementById("stat-dissatisfied-pct");
    var avgProbEl = document.getElementById("stat-avg-prob");

    if (!tbody) return;

    var total = history.length;
    if (totalCountEl) totalCountEl.textContent = total;

    if (total === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">Henüz kayıtlı bir tahmin analizi bulunmuyor. Bir tahmin yaparak başlayın.</td></tr>';
      if (satisfiedPctEl) satisfiedPctEl.textContent = "%0";
      if (dissatisfiedPctEl) dissatisfiedPctEl.textContent = "%0";
      if (avgProbEl) avgProbEl.textContent = "%0";
      return;
    }

    var satisfiedCount = 0;
    var probSum = 0;

    var rowsHtml = "";
    history.forEach(function (item) {
      if (item.isSatisfied) satisfiedCount++;
      probSum += parseFloat(item.probability);

      var verdictTag = item.isSatisfied
        ? '<span class="tag-verdict tag-satisfied">✅ Memnun</span>'
        : '<span class="tag-verdict tag-dissatisfied">⚠️ Memnun Değil</span>';

      rowsHtml += "<tr>" +
        "<td>" + item.time + "</td>" +
        "<td>" + item.passenger + "</td>" +
        "<td>" + item.class + "</td>" +
        "<td>" + item.travel + "</td>" +
        "<td>" + item.delay + "</td>" +
        "<td>" + item.avgService + "</td>" +
        "<td>" + verdictTag + "</td>" +
        '<td style="font-family: monospace; font-weight: bold;">%' + item.probability + "</td>" +
        "</tr>";
    });

    tbody.innerHTML = rowsHtml;

    var satPct = Math.round((satisfiedCount / total) * 100);
    var dissatPct = 100 - satPct;
    var avgProb = (probSum / total).toFixed(1);

    if (satisfiedPctEl) satisfiedPctEl.textContent = "%" + satPct;
    if (dissatisfiedPctEl) dissatisfiedPctEl.textContent = "%" + dissatPct;
    if (avgProbEl) avgProbEl.textContent = "%" + avgProb;
  }

  // 6. Sayfa Sekmeleri (Tahmin <-> Analizler)
  function switchTab(tabKey) {
    var viewPredict = document.getElementById("view-predict");
    var viewAnalytics = document.getElementById("view-analytics");
    var viewModel = document.getElementById("view-model");
    var navPredict = document.getElementById("nav-tab-predict");
    var navAnalytics = document.getElementById("nav-tab-analytics");
    var navModel = document.getElementById("nav-tab-model");

    // Hepsini kapat
    [viewPredict, viewAnalytics, viewModel].forEach(function(v) { if (v) v.classList.remove("active"); });
    [navPredict, navAnalytics, navModel].forEach(function(n) { if (n) n.classList.remove("active"); });

    if (tabKey === "analytics") {
      if (viewAnalytics) viewAnalytics.classList.add("active");
      if (navAnalytics) navAnalytics.classList.add("active");
      renderAnalytics();
    } else if (tabKey === "model") {
      if (viewModel) viewModel.classList.add("active");
      if (navModel) navModel.classList.add("active");
    } else {
      if (viewPredict) viewPredict.classList.add("active");
      if (navPredict) navPredict.classList.add("active");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 7. Tahmin İstegi ve Buton Tetiklemesi
  function performPrediction() {
    var data = getFormData();
    if (!data) return;

    var avgScore = updateSummary(data);

    var btn = document.getElementById("btn-predict");
    var btnText = document.getElementById("btn-predict-text");
    if (btnText) btnText.textContent = "Hesaplanıyor...";

    fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (resp) {
        if (resp && resp.success && resp.result) {
          // 1. Pop-up Modalını aç
          openPredictionModal(resp.result, data, avgScore);
          // 2. Analiz geçmişine kaydet
          savePredictionToHistory(data, resp.result, avgScore);
        }
        if (btnText) btnText.textContent = "Memnuniyet Tahmini Yap";
      })
      .catch(function (err) {
        console.log("Tahmin API hatası:", err);
        if (btnText) btnText.textContent = "Memnuniyet Tahmini Yap";
      });
  }

  // 8. Olay Dinleyicileri (Event Listeners)
  function bindEvents() {
    var form = document.getElementById("satisfaction-form");
    if (form) {
      // Range slider değişimi -> anlık sayı ve özet kartı güncellemesi
      form.addEventListener("input", function (e) {
        var target = e.target;
        if (target.type === "range") {
          var id = target.id;
          var scoreEl = document.getElementById("val_" + id);
          if (scoreEl) scoreEl.textContent = target.value;
        }
        updateSummary(getFormData());
      });

      form.addEventListener("change", function () {
        updateSummary(getFormData());
      });

      // Form submit & Buton tıklaması -> Pop-up açar
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        performPrediction();
      });
    }

    var btnPredict = document.getElementById("btn-predict");
    if (btnPredict) {
      btnPredict.addEventListener("click", function (e) {
        e.preventDefault();
        performPrediction();
      });
    }

    // Modal Kapatma Butonları
    var closeX = document.getElementById("modal-close-x");
    var closeOk = document.getElementById("btn-modal-close");
    var modalBackdrop = document.getElementById("prediction-modal");

    if (closeX) closeX.addEventListener("click", closePredictionModal);
    if (closeOk) closeOk.addEventListener("click", closePredictionModal);
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", function (e) {
        if (e.target === modalBackdrop) closePredictionModal();
      });
    }

    // Escape tuşuyla kapatma
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalBackdrop && modalBackdrop.classList.contains("active")) {
        closePredictionModal();
      }
    });

    // Modal içinden Analiz Geçmişine Git Butonu
    var btnModalAnalytics = document.getElementById("btn-modal-to-analytics");
    if (btnModalAnalytics) {
      btnModalAnalytics.addEventListener("click", function () {
        closePredictionModal();
        switchTab("analytics");
      });
    }

    // Navigasyon Menü Tıklamaları
    var navPredict = document.getElementById("nav-tab-predict");
    var navAnalytics = document.getElementById("nav-tab-analytics");
    var brandLink = document.getElementById("brand-link");
    var btnDashboard = document.getElementById("btn-nav-dashboard");
    var btnBackToPredict = document.getElementById("btn-back-to-predict");

    if (navPredict) navPredict.addEventListener("click", function (e) { e.preventDefault(); switchTab("predict"); });
    if (brandLink) brandLink.addEventListener("click", function () { switchTab("predict"); });
    if (btnBackToPredict) btnBackToPredict.addEventListener("click", function () { switchTab("predict"); });
    if (navAnalytics) navAnalytics.addEventListener("click", function (e) { e.preventDefault(); switchTab("analytics"); });
    if (btnDashboard) btnDashboard.addEventListener("click", function () { switchTab("analytics"); });

    var navModel = document.getElementById("nav-tab-model");
    var btnModelBack = document.getElementById("btn-model-back");
    if (navModel) navModel.addEventListener("click", function (e) { e.preventDefault(); switchTab("model"); });
    if (btnModelBack) btnModelBack.addEventListener("click", function () { switchTab("predict"); });

    // Geçmişi Temizle Butonu
    var btnClear = document.getElementById("btn-clear-history");
    if (btnClear) {
      btnClear.addEventListener("click", function () {
        if (confirm("Tüm tahmin geçmişini silmek istediğinize emin misiniz?")) {
          localStorage.removeItem(STORAGE_KEY);
          renderAnalytics();
        }
      });
    }
  }

  // 9. Tema Yönetimi (Dark ↔ Light)
  var THEME_KEY = "satisfaction_ai_theme";

  function applyTheme(theme) {
    var body = document.body;
    var icon = document.querySelector(".theme-icon");
    var btnText = document.querySelector(".btn-theme-toggle span:last-child");

    if (theme === "light") {
      body.classList.add("light-theme");
      if (icon) icon.textContent = "🌙";
      if (btnText) btnText.textContent = "Koyu";
    } else {
      body.classList.remove("light-theme");
      if (icon) icon.textContent = "☀️";
      if (btnText) btnText.textContent = "Açık";
    }
  }

  function initTheme() {
    var saved = localStorage.getItem(THEME_KEY) || "dark";
    applyTheme(saved);

    var btn = document.querySelector(".btn-theme-toggle");
    if (btn) {
      btn.addEventListener("click", function () {
        var current = document.body.classList.contains("light-theme") ? "light" : "dark";
        var next = current === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    }
  }

  // 10. Başlangıç
  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initVideo();
    bindEvents();
    updateSummary(getFormData());
    renderAnalytics();
  });

})();
