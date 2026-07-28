let pointsChart = null;

// Inisialisasi default bulan & tahun saat ini
document.addEventListener("DOMContentLoaded", () => {
  const currentMonth = new Date().toLocaleString("id-ID", { month: "long" });
  document.getElementById("monthFilter").value = currentMonth;

  fetchLeaderboard();
  fetchHistory();
});

function switchTab(tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document.getElementById("rankingTab").classList.add("hidden");
  document.getElementById("historyTab").classList.add("hidden");

  if (tab === "ranking") {
    document.querySelector(".tab-btn:nth-child(1)").classList.add("active");
    document.getElementById("rankingTab").classList.remove("hidden");
  } else {
    document.querySelector(".tab-btn:nth-child(2)").classList.add("active");
    document.getElementById("historyTab").classList.remove("hidden");
  }
}

// ================= LOGIC LEADERBOARD =================
// ================= LOGIC LEADERBOARD =================
async function fetchLeaderboard() {
  const level = document.getElementById("levelFilter").value;
  const grade = document.getElementById("gradeFilter").value;

  document.getElementById("allStudentsList").innerHTML =
    '<p class="loading-text">Memuat data...</p>';

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "getLeaderboard", level, grade }),
  });
  const data = await res.json();

  if (data.status === "success") {
    renderHighlight(data.highest, data.lowest);
    renderAllStudents(data.all);
  }
}

function getInitials(name) {
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function renderHighlight(highest, lowest) {
  // KARTU TERTINGGI
  const hAvatarDiv = document.getElementById("highestAvatar");
  const hName = document.getElementById("highestName");
  const hClass = document.getElementById("highestClass");
  const hPoints = document.getElementById("highestPoints");

  if (highest) {
    hAvatarDiv.innerHTML = highest.photo_url
      ? `<img src="${highest.photo_url}" class="student-avatar">`
      : `<div class="student-avatar">${getInitials(highest.name)}</div>`;
    hName.textContent = highest.name;
    hClass.textContent = `Kelas ${highest.class}`;
    hPoints.textContent = `+${highest.points} Poin`;
  } else {
    hName.textContent = "Tidak ada data";
  }

  // KARTU TERENDAH
  const lAvatarDiv = document.getElementById("lowestAvatar");
  const lName = document.getElementById("lowestName");
  const lClass = document.getElementById("lowestClass");
  const lPoints = document.getElementById("lowestPoints");

  if (lowest) {
    lAvatarDiv.innerHTML = lowest.photo_url
      ? `<img src="${lowest.photo_url}" class="student-avatar">`
      : `<div class="student-avatar" style="background:#D32F2F;">${getInitials(
          lowest.name
        )}</div>`;
    lName.textContent = lowest.name;
    lClass.textContent = `Kelas ${lowest.class}`;
    const sign = lowest.points > 0 ? "+" : "";
    lPoints.textContent = `${sign}${lowest.points} Poin`;
  } else {
    lName.textContent = "Tidak ada data";
  }
}

function renderAllStudents(students) {
  const list = document.getElementById("allStudentsList");
  list.innerHTML = "";

  if (students.length === 0) {
    list.innerHTML = '<p class="loading-text">Tidak ada data siswa.</p>';
    return;
  }

  students.forEach((s, index) => {
    const div = document.createElement("div");
    div.className = "list-item rank-item";

    let rankBadge = `<span class="rank-num">${index + 1}</span>`;
    if (index === 0)
      rankBadge = `<span class="rank-num gold"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;
    if (index === 1)
      rankBadge = `<span class="rank-num silver"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;
    if (index === 2)
      rankBadge = `<span class="rank-num bronze"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;

    const avatarHtml = s.photo_url
      ? `<img src="${s.photo_url}" class="student-avatar small" alt="${s.name}">`
      : `<div class="student-avatar small">${getInitials(s.name)}</div>`;

    const pointClass = s.points >= 0 ? "points-positive" : "points-negative";
    const sign = s.points > 0 ? "+" : "";

    div.innerHTML = `
            <div class="student-item-left">
                ${rankBadge}
                ${avatarHtml}
                <div class="student-info-text">
                    <div class="name">${s.name}</div>
                    <div class="meta">Kelas ${s.class}</div>
                </div>
            </div>
            <div class="points-badge ${pointClass}">${sign}${s.points}</div>
        `;
    list.appendChild(div);
  });
}

// ================= LOGIC HISTORY & CHART =================
async function fetchHistory() {
  const month = document.getElementById("monthFilter").value;
  const viewType = document.getElementById("viewTypeFilter").value;

  document.getElementById("historyList").innerHTML =
    '<p class="loading-text">Memuat riwayat...</p>';

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "getHistory", month, viewType }),
  });
  const data = await res.json();

  if (data.status === "success") {
    renderHistoryList(data.transactions);
    renderChart(data.chartData, month);
  }
}

function renderHistoryList(transactions) {
  const list = document.getElementById("historyList");
  list.innerHTML = "";

  if (transactions.length === 0) {
    list.innerHTML =
      '<p class="loading-text">Tidak ada transaksi pada periode ini.</p>';
    return;
  }

  transactions.forEach((t) => {
    const div = document.createElement("div");
    div.className = "list-item";

    const pointClass = t.points >= 0 ? "points-positive" : "points-negative";
    const sign = t.points > 0 ? "+" : "";
    const formattedDate = new Date(t.date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    div.innerHTML = `
            <div class="student-item-left">
                <div class="student-info-text">
                    <div class="name">${t.student_name}</div>
                    <div class="meta">${t.student_class} • ${formattedDate} WIB</div>
                </div>
            </div>
            <div class="points-badge ${pointClass}">${sign}${t.points}</div>
        `;
    list.appendChild(div);
  });
}

function renderChart(chartData, monthName) {
  const ctx = document.getElementById("pointsChart").getContext("2d");

  // Hancurkan chart sebelumnya agar tidak menumpuk
  if (pointsChart) {
    pointsChart.destroy();
  }

  // Buat label hari 1-31
  const labels = Array.from({ length: 31 }, (_, i) => i + 1);

  pointsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: `Aktivitas Poin ${monthName}`,
          data: chartData,
          backgroundColor: "#004632",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#777" } },
        x: { ticks: { color: "#777", autoSkip: true, maxTicksLimit: 10 } },
      },
    },
  });
}

async function exportData(type) {
    const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'exportData' })
    });
    const data = await res.json();
    
    if(data.status === 'success') {
        if(type === 'excel') {
            const ws = XLSX.utils.json_to_sheet(data.data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
            XLSX.writeFile(wb, "Laporan_Poin_TMI.xlsx");
        } else if(type === 'pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("Laporan Poin Tunas Mekar Indonesia", 14, 15);
            doc.autoTable({
                startY: 20,
                head: [['Tanggal', 'NIS', 'Nama', 'Kelas', 'Poin', 'Catatan']],
                body: data.data.map(d => [d.Tanggal, d.NIS, d.Nama, d.Kelas, d.Poin, d.Catatan]),
                styles: { fontSize: 8 }
            });
            doc.save("Laporan_Poin_TMI.pdf");
        }
    }
}