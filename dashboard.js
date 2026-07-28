let currentTeacher = checkAuth();
if (currentTeacher) {
  document.getElementById(
    "teacherName"
  ).textContent = `Halo, ${currentTeacher.name}`;
}

let studentsData = [];
let violationsData = [];
let selectedStudent = null;

window.onload = async () => {
  await fetchStudents();
  initStudentNFC();
  fetchHousePoints(); // TAMBAHKAN INI
};

// Helper: Ambil inisial dari nama
function getInitials(name) {
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

// Helper: Buat elemen Avatar (Foto atau Inisial)
function createAvatarElement(student, sizeClass = "") {
  // 1. Buat elemen div berisi inisial sebagai default
  const avatar = document.createElement("div");
  avatar.className = `student-avatar avatar-fallback ${sizeClass}`;
  avatar.textContent = getInitials(student.name);

  // 2. Cek apakah ada URL gambar yang valid (diawali http)
  if (
    student.photo_url &&
    typeof student.photo_url === "string" &&
    student.photo_url.startsWith("http")
  ) {
    const img = new Image();
    img.className = `student-avatar-img ${sizeClass}`;
    img.src = student.photo_url;

    // 3. Jika gambar BERHASIL dimuat, baru tampilkan
    img.onload = () => {
      avatar.innerHTML = "";
      avatar.appendChild(img);
      avatar.classList.remove("avatar-fallback");
    };
    // Jika gagal, biarkan saja, avatar inisial akan tetap tampil tanpa error.
  }

  return avatar;
}
async function fetchStudents() {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "getStudents" }),
    headers: { "Content-Type": "text/plain;charset=utf-8" },
  });
  const data = await res.json();
  studentsData = data.students;
  renderStudents();
}

function renderStudents() {
  const searchVal = document
    .getElementById("searchStudent")
    .value.toLowerCase();
  const classVal = document.getElementById("classFilter").value;
  const list = document.getElementById("studentList");
  list.innerHTML = "";

  const filtered = studentsData.filter((s) => {
    let classMatch = false;
    const studentGrade = parseInt(s.class) || 0;

    if (classVal === "all") classMatch = true;
    else if (classVal === "JHS") classMatch = [7, 8, 9].includes(studentGrade);
    else if (classVal === "SHS")
      classMatch = [10, 11, 12].includes(studentGrade);
    else classMatch = studentGrade === parseInt(classVal);

    const nameMatch =
      s.name.toLowerCase().includes(searchVal) ||
      String(s.nis).includes(searchVal);
    return nameMatch && classMatch;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<p class="loading-text">Siswa tidak ditemukan.</p>';
    return;
  }

  filtered.forEach((s) => {
    const div = document.createElement("div");
    div.className = "list-item";
    div.onclick = () => selectStudent(s);

    const pointClass = s.points >= 0 ? "points-positive" : "points-negative";
    const sign = s.points > 0 ? "+" : "";

    const leftDiv = document.createElement("div");
    leftDiv.className = "student-item-left";

    // Masukkan info teks terlebih dahulu
    leftDiv.innerHTML = `
            <div class="student-info-text">
                <div class="name">${s.name}</div>
                <div class="meta">${s.class} • NIS: ${s.nis}</div>
            </div>
        `;

    // Sisipkan avatar di urutan paling depan (sebelum teks)
    leftDiv.insertBefore(createAvatarElement(s), leftDiv.firstChild);

    const pointsDiv = document.createElement("div");
    pointsDiv.className = `points-badge ${pointClass}`;
    pointsDiv.textContent = `${sign}${s.points}`;

    div.appendChild(leftDiv);
    div.appendChild(pointsDiv);
    list.appendChild(div);
  });
}

function selectStudent(student) {
  selectedStudent = student;
  document.getElementById("studentSelectionCard").classList.add("hidden");
  document.getElementById("actionCard").classList.remove("hidden");

  // Render Detail Header
  const headerDiv = document.getElementById("studentDetailHeader");
  headerDiv.innerHTML = ""; // Kosongkan dulu

  const pointClass =
    student.points >= 0 ? "points-positive" : "points-negative";
  const sign = student.points > 0 ? "+" : "";

  // Buat div pembungkus untuk teks
  const infoDiv = document.createElement("div");
  infoDiv.innerHTML = `
        <h3>${student.name}</h3>
        <p>${student.class} • NIS: ${student.nis}</p>
        <div class="current-points points-badge ${pointClass}" style="margin-top:8px;">Poin Saat Ini: ${sign}${student.points}</div>
    `;

  // Masukkan Avatar dan Teks secara aman
  headerDiv.appendChild(createAvatarElement(student, "large"));
  headerDiv.appendChild(infoDiv);

  document.getElementById("violationsSection").classList.add("hidden");
}

function backToSelection() {
  document.getElementById("studentSelectionCard").classList.remove("hidden");
  document.getElementById("actionCard").classList.add("hidden");
}

function initStudentNFC() {
  const nfcArea = document.getElementById("studentNfcArea");

  if (!("NDEFReader" in window)) {
    nfcArea.innerHTML = `
      <iconify-icon icon="mdi:alert-circle-outline" width="28"></iconify-icon>
      <span><small>NFC tidak didukung. Cari manual di bawah.</small></span>
    `;
    return;
  }

  nfcArea.onclick = async () => {
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      nfcArea.innerHTML = `
        <iconify-icon icon="mdi:contactless-payment-circle" width="28"></iconify-icon>
        <span>Dekatkan kartu siswa...</span>
      `;

      ndef.addEventListener("reading", ({ serialNumber }) => {
        const nfc_id = serialNumber.replace(/:/g, "").toUpperCase();
        const found = studentsData.find((s) => s.nfc_id === nfc_id);

        if (found) {
          selectStudent(found);
        } else {
          nfcArea.innerHTML = `
            <iconify-icon icon="mdi:card-off-outline" width="28"></iconify-icon>
            <span>Kartu ${nfc_id} tidak terdaftar!</span>
          `;

          // Kembali ke teks default setelah 2 detik
          setTimeout(() => {
            nfcArea.innerHTML = `
              <iconify-icon icon="mdi:nfc-variant" width="28"></iconify-icon>
              <span>Tap Kartu Siswa di sini</span>
            `;
          }, 2000);
        }
      });
    } catch (e) {
      alert("Gagal scan: " + e);
    }
  };
}

// Ganti fungsi showViolations dan renderViolations di dashboard.js dengan ini:

async function showViolations(type) {
  const section = document.getElementById("violationsSection");
  section.classList.remove("hidden");

  // Tampilkan loading text sementara
  document.getElementById("violationList").innerHTML =
    '<p style="text-align:center; color:#999; padding:20px;">Memuat data...</p>';

  if (violationsData.length === 0) {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getViolations" }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const data = await res.json();

    if (data.status === "success") {
      violationsData = data.violations;
    } else {
      console.error("Gagal memuat data pelanggaran");
    }
  }

  window.currentType = type;
  renderViolations();
}

function renderViolations() {
  const searchVal = document
    .getElementById("searchViolation")
    .value.toLowerCase();
  const list = document.getElementById("violationList");
  list.innerHTML = "";

  const filtered = violationsData.filter((v) => {
    // Trim spasi dan ubah jadi lowercase agar pasti cocok dengan 'plus' atau 'minus'
    const vType = v.type ? v.type.trim().toLowerCase() : "";
    const vName = v.name ? v.name.toLowerCase() : "";

    return vType === window.currentType && vName.includes(searchVal);
  });

  if (filtered.length === 0) {
    list.innerHTML = `<p style="text-align:center; color:#999; padding:20px;">Tidak ada item untuk tipe "${window.currentType}".<br><small>Pastikan kolom type di Spreadsheet berisi huruf kecil "plus" atau "minus"</small></p>`;
    return;
  }

  filtered.forEach((v) => {
    const div = document.createElement("div");
    div.className = "violation-item";
    div.onclick = () => submitTransaction(v);

    const pointColor =
      v.type === "plus" ? "points-positive" : "points-negative";
    const sign = v.type === "plus" ? "+" : "-";
    div.innerHTML = `
            <div class="violation-name">${v.name}</div>
            <div class="points-badge ${pointColor}">${sign}${v.point}</div>
        `;
    list.appendChild(div);
  });
}

let lastTransaction = null; // Simpan untuk Undo

// --- MODAL LOGIC ---
function showModal(title, bodyHtml, buttons) {
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  const footer = document.getElementById("modalFooter");
  footer.innerHTML = "";
  buttons.forEach((btn) => {
    const b = document.createElement("button");
    b.className = `btn ${btn.class || "btn-primary"}`;
    b.innerHTML = btn.text;
    b.onclick = () => {
      if (btn.keepOpen) {
        if (btn.onClick) btn.onClick(); // Jalankan fungsi tapi jangan tutup modal
      } else {
        closeModal();
        if (btn.onClick) btn.onClick();
      }
    };
    footer.appendChild(b);
  });
  document.getElementById("modalOverlay").classList.remove("hidden");
}
function closeModal() {
  document.getElementById("modalOverlay").classList.add("hidden");
}

// --- HOUSE POINTS ---
async function fetchHousePoints() {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "getHousePoints" }),
  });
  const data = await res.json();
  if (data.status === "success") {
    document.getElementById("houseJJT").innerText = data.houses.JJT;
    document.getElementById("houseJensud").innerText = data.houses.Jensud;
    document.getElementById("houseMunir").innerText = data.houses.Munir;
  }
}
// Panggil di window.onload: fetchHousePoints();

// --- FUNGSI REFRESH DASHBOARD ---
async function refreshDashboard() {
  const list = document.getElementById("studentList");
  if (list) list.innerHTML = '<p class="loading-text">Memuat ulang data...</p>';

  await fetchStudents();
  await fetchHousePoints();
  renderStudents();
}

// --- SUBMIT WITH NOTES & UNDO ---
function submitTransaction(violation) {
  const pointChange =
    violation.type === "plus" ? violation.point : -violation.point;
  const sign = violation.type === "plus" ? "+" : "-";

  showModal(
    "Konfirmasi Poin",
    `<p style="text-align:center; margin-bottom:10px;">${
      selectedStudent.name
    }<br><b style="font-size:18px; color:${
      violation.type === "plus" ? "var(--green-success)" : "var(--red-danger)"
    }">${sign}${violation.point} Poin</b><br><small>${
      violation.name
    }</small></p>
         <textarea id="noteInput" class="modal-textarea" placeholder="Catatan (opsional)..."></textarea>`,
    [
      { text: "Batal", class: "btn-outline", onClick: closeModal },
      {
        text: "Ya, Berikan",
        class: "btn-primary",
        keepOpen: true,
        onClick: async () => {
          // Ganti tombol jadi loading state
          document.getElementById("modalFooter").innerHTML =
            '<p style="color:#999; font-size:14px; align-self:center; width:100%;">Memproses...</p>';

          const note = document.getElementById("noteInput").value;
          const res = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              action: "addTransaction",
              teacher_id: currentTeacher.id,
              student_nis: selectedStudent.nis,
              violation_id: violation.id,
              point_change: pointChange,
              note: note,
            }),
          });
          const data = await res.json();

          if (data.status === "success") {
            // Update poin siswa di lokal
            const sIndex = studentsData.findIndex(
              (s) => s.nis === selectedStudent.nis
            );
            studentsData[sIndex].points = data.newPoints;
            selectedStudent.points = data.newPoints;

            // Simpan info untuk undo
            lastTransaction = {
              tr_id: data.tr_id,
              student_nis: selectedStudent.nis,
              point_change: pointChange,
            };

            fetchHousePoints(); // Update skor rumah

            // Tampilkan modal sukses dengan tombol undo & selesai
            showModal(
              "Berhasil!",
              `<p>Poin berhasil diberikan kepada ${selectedStudent.name}.</p>`,
              [
                {
                  text: "Undo",
                  class: "btn-minus",
                  onClick: undoLastTransaction,
                },
                {
                  text: "Selesai",
                  class: "btn-primary",
                  onClick: () => {
                    backToSelection();
                    renderStudents(); // <-- REFRESH LIST DASHBOARD
                    closeModal();
                  },
                },
              ]
            );
          } else {
            alert("Gagal: " + data.message);
            closeModal();
          }
        },
      },
    ]
  );
}

async function undoLastTransaction() {
  if (!lastTransaction) return;

  // Tampilkan loading di modal
  document.getElementById("modalTitle").innerText = "Memproses...";
  document.getElementById("modalBody").innerHTML =
    "<p>Membatalkan transaksi...</p>";
  document.getElementById("modalFooter").innerHTML = "";

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "undoTransaction",
      tr_id: lastTransaction.tr_id,
    }),
  });
  const data = await res.json();

  if (data.status === "success") {
    // Kembalikan poin siswa ke kondisi semula secara lokal
    const sIndex = studentsData.findIndex(
      (s) => s.nis === lastTransaction.student_nis
    );
    const revertedPoints =
      parseInt(studentsData[sIndex].points) -
      parseInt(lastTransaction.point_change);
    studentsData[sIndex].points = revertedPoints;
    selectedStudent.points = revertedPoints; // Update juga selectedStudent

    fetchHousePoints(); // Update skor rumah
    lastTransaction = null; // Hapus riwayat undo

    showModal("Dibatalkan", "<p>Transaksi terakhir telah dibatalkan.</p>", [
      {
        text: "OK",
        class: "btn-primary",
        onClick: () => {
          backToSelection();
          renderStudents(); // <-- REFRESH LIST DASHBOARD
          closeModal();
        },
      },
    ]);
  } else {
    alert("Gagal undo: " + data.message);
    closeModal();
  }
}
