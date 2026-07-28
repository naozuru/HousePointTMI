let pointsChart = null;

function showToast(msg, type = '') {
    let t = document.getElementById('toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'toast';
        t.className = 'toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.classList.remove('show'), 2800);
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

async function fetchLeaderboard() {
    const level = document.getElementById("levelFilter").value;
    const grade = document.getElementById("gradeFilter").value;

    document.getElementById("allStudentsList").innerHTML =
        '<p class="loading-text">Memuat data...</p>';

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getLeaderboard", level, grade }),
        });
        const data = await res.json();

        if (data.status === "success") {
            renderHighlight(data.highest, data.lowest);
            renderAllStudents(data.all || []);
        } else {
            showToast("Gagal memuat leaderboard", "error");
        }
    } catch (err) {
        showToast("Gagal terhubung ke server", "error");
    }
}

function getInitials(name) {
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function createAvatar(s, sizeClass = "") {
    const avatar = document.createElement("div");
    avatar.className = `student-avatar avatar-fallback ${sizeClass}`;
    avatar.textContent = getInitials(s.name);
    if (s.photo_url && typeof s.photo_url === "string" && s.photo_url.startsWith("http")) {
        const img = new Image();
        img.className = `student-avatar-img ${sizeClass}`;
        img.src = s.photo_url;
        img.onload = () => {
            avatar.innerHTML = "";
            avatar.appendChild(img);
            avatar.classList.remove("avatar-fallback");
        };
    }
    return avatar;
}

function renderHighlight(highest, lowest) {
    const hAvatarDiv = document.getElementById("highestAvatar");
    const hName = document.getElementById("highestName");
    const hClass = document.getElementById("highestClass");
    const hPoints = document.getElementById("highestPoints");

    hAvatarDiv.innerHTML = "";
    if (highest) {
        hAvatarDiv.appendChild(createAvatar(highest));
        hName.textContent = highest.name;
        hClass.textContent = `Kelas ${highest.class}`;
        hPoints.textContent = `+${highest.points} Poin`;
    } else {
        hName.textContent = "Tidak ada data";
        hClass.textContent = "-";
        hPoints.textContent = "0 Poin";
    }

    const lAvatarDiv = document.getElementById("lowestAvatar");
    const lName = document.getElementById("lowestName");
    const lClass = document.getElementById("lowestClass");
    const lPoints = document.getElementById("lowestPoints");

    lAvatarDiv.innerHTML = "";
    if (lowest) {
        const lowAvatar = createAvatar(lowest);
        lowAvatar.style.background = "linear-gradient(135deg, var(--danger), #b91c1c)";
        lAvatarDiv.appendChild(lowAvatar);
        lName.textContent = lowest.name;
        lClass.textContent = `Kelas ${lowest.class}`;
        const sign = lowest.points > 0 ? "+" : "";
        lPoints.textContent = `${sign}${lowest.points} Poin`;
    } else {
        lName.textContent = "Tidak ada data";
        lClass.textContent = "-";
        lPoints.textContent = "0 Poin";
    }
}

function renderAllStudents(students) {
    const list = document.getElementById("allStudentsList");
    list.innerHTML = "";

    if (students.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <iconify-icon icon="mdi:trophy-outline"></iconify-icon>
                <div class="title">Tidak ada data siswa</div>
                <div class="subtitle">Coba ubah filter</div>
            </div>
        `;
        return;
    }

    students.forEach((s, index) => {
        const div = document.createElement("div");
        div.className = "list-item rank-item";

        let rankBadge = `<span class="rank-num">${index + 1}</span>`;
        if (index === 0)
            rankBadge = `<span class="rank-num gold"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;
        else if (index === 1)
            rankBadge = `<span class="rank-num silver"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;
        else if (index === 2)
            rankBadge = `<span class="rank-num bronze"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;

        const pointClass = s.points >= 0 ? "points-positive" : "points-negative";
        const sign = s.points > 0 ? "+" : "";

        div.innerHTML = `
            <div class="student-item-left">
                ${rankBadge}
                <div class="student-info-text">
                    <div class="name">${escapeHtml(s.name)}</div>
                    <div class="meta">Kelas ${escapeHtml(s.class)}</div>
                </div>
            </div>
            <div class="points-badge ${pointClass}">${sign}${s.points}</div>
        `;

        // Append avatar separately (safer)
        const leftDiv = div.querySelector('.student-item-left');
        leftDiv.insertBefore(createAvatar(s, "small"), leftDiv.children[1]);

        list.appendChild(div);
    });
}

async function fetchHistory() {
    const month = document.getElementById("monthFilter").value;
    const viewType = document.getElementById("viewTypeFilter").value;

    document.getElementById("historyList").innerHTML =
        '<p class="loading-text">Memuat riwayat...</p>';

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "getHistory", month, viewType }),
        });
        const data = await res.json();

        if (data.status === "success") {
            renderHistoryList(data.transactions || []);
            renderChart(data.chartData || [], month);
        } else {
            showToast("Gagal memuat riwayat", "error");
        }
    } catch (err) {
        showToast("Gagal terhubung ke server", "error");
    }
}

function renderHistoryList(transactions) {
    const list = document.getElementById("historyList");
    list.innerHTML = "";

    if (transactions.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <iconify-icon icon="mdi:history"></iconify-icon>
                <div class="title">Tidak ada transaksi</div>
                <div class="subtitle">Pada periode ini belum ada aktivitas</div>
            </div>
        `;
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
                    <div class="name">${escapeHtml(t.student_name)}</div>
                    <div class="meta">Kelas ${escapeHtml(t.student_class)} • ${formattedDate} WIB</div>
                </div>
            </div>
            <div class="points-badge ${pointClass}">${sign}${t.points}</div>
        `;
        list.appendChild(div);
    });
}

function renderChart(chartData, monthName) {
    const ctx = document.getElementById("pointsChart").getContext("2d");

    if (pointsChart) {
        pointsChart.destroy();
    }

    const labels = Array.from({ length: 31 }, (_, i) => i + 1);

    pointsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Aktivitas Poin ${monthName}`,
                    data: chartData,
                    backgroundColor: (context) => {
                        const chart = context.chart;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return "#004632";
                        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                        gradient.addColorStop(0, "#004632");
                        gradient.addColorStop(1, "#2ea876");
                        return gradient;
                    },
                    borderRadius: 6,
                    maxBarThickness: 20,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1e293b",
                    titleColor: "#fff",
                    bodyColor: "#cbd5e1",
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont: { weight: "700", size: 13 },
                    bodyFont: { size: 12 },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#64748b", font: { size: 11 } },
                    grid: { color: "rgba(148, 163, 184, 0.15)" }
                },
                x: {
                    ticks: { color: "#64748b", autoSkip: true, maxTicksLimit: 10, font: { size: 11 } },
                    grid: { display: false }
                },
            },
        },
    });
}

async function exportData(type) {
    const btn = event.target.closest('button');
    if (btn) {
        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<iconify-icon icon="mdi:loading"></iconify-icon> Mengekspor...';
        setTimeout(() => { btn.disabled = false; btn.innerHTML = orig; }, 3000);
    }

    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'exportData' })
        });
        const data = await res.json();

        if (data.status === 'success') {
            if (type === 'excel') {
                const ws = XLSX.utils.json_to_sheet(data.data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
                XLSX.writeFile(wb, "Laporan_Poin_TMI.xlsx");
                showToast("File Excel berhasil diunduh", "success");
            } else if (type === 'pdf') {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                // Header
                doc.setFontSize(14);
                doc.setTextColor(0, 70, 50);
                doc.text("Laporan Poin Tunas Mekar Indonesia", 14, 15);
                doc.setFontSize(10);
                doc.setTextColor(100, 116, 139);
                doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 21);

                doc.autoTable({
                    startY: 28,
                    head: [['Tanggal', 'NIS', 'Nama', 'Kelas', 'Poin', 'Catatan']],
                    body: data.data.map(d => [d.Tanggal, d.NIS, d.Nama, d.Kelas, d.Poin, d.Catatan]),
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [0, 70, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                });
                doc.save("Laporan_Poin_TMI.pdf");
                showToast("File PDF berhasil diunduh", "success");
            }
        } else {
            showToast("Gagal mengekspor data", "error");
        }
    } catch (err) {
        showToast("Gagal terhubung ke server", "error");
    }
}