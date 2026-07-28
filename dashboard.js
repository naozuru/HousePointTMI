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
  fetchHousePoints();
};

// === TOAST HELPER ===
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

// === HTML ESCAPE ===
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper: Ambil inisial dari nama
function getInitials(name) {
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

// Helper: Buat elemen Avatar (Foto atau Inisial)
function createAvatarElement(student, sizeClass = "") {
  const avatar = document.createElement("div");
  avatar.className = `student-avatar avatar-fallback ${sizeClass}`;
  avatar.textContent = getInitials(student.name);

  if (
    student.photo_url &&
    typeof student.photo_url === "string" &&
    student.photo_url.startsWith("http")
  ) {
    const img = new Image();
    img.className = `student-avatar-img ${sizeClass}`;
    img.src = student.photo_url;
    img.onload = () => {
      avatar.innerHTML = "";
      avatar.appendChild(img);
      avatar.classList.remove("avatar-fallback");
    };
  }

  return avatar;
}

async function fetchStudents() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "getStudents" }),
      headers: { "Content-Type": "text/plain;charset=utf-8" },
    });
    const data = await res.json();
    studentsData = data.students || [];
    renderStudents();
  } catch (err) {
    showToast("Gagal memuat data siswa", "error");
  }
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
    list.innerHTML = `
      <div class="empty-state">
        <iconify-icon icon="mdi:account-search-outline"></iconify-icon>
        <div class="title">Siswa tidak ditemukan</div>
        <div class="subtitle">Coba kata kunci lain atau ubah filter</div>
      </div>
    `;
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

    leftDiv.innerHTML = `
            <div class="student-info-text">
                <div class="name">${escapeHtml(s.name)}</div>
                <div class="meta">Kelas ${escapeHtml(s.class)} • NIS: ${escapeHtml(String(s.nis))}</div>
            </div>
        `;

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

  const headerDiv = document.getElementById("studentDetailHeader");
  headerDiv.innerHTML = "";

  const pointClass =
    student.points >= 0 ? "points-positive" : "points-negative";
  const sign = student.points > 0 ? "+" : "";

  const infoDiv = document.createElement("div");
  infoDiv.innerHTML = `
        <h3>${escapeHtml(student.name)}</h3>
        <p>Kelas ${escapeHtml(student.class)} • NIS: ${escapeHtml(String(student.nis))}</p>
        <div class="current-points points-badge ${pointClass}" style="margin-top:10px;">Poin Saat Ini: ${sign}${student.points}</div>
    `;

  headerDiv.appendChild(createAvatarElement(student, "large"));
  headerDiv.appendChild(infoDiv);

  document.getElementById("violationsSection").classList.add("hidden");
  document.getElementById("searchViolation").value = "";
}

function backToSelection() {
  document.getElementById("studentSelectionCard").classList.remove("hidden");
  document.getElementById("actionCard").classList.add("hidden");
  document.getElementById("violationsSection").classList.add("hidden");
  document.getElementById("searchViolation").value = "";
}

function initStudentNFC() {
  const nfcArea = document.getElementById("studentNfcArea");

  if (!("NDEFReader" in window)) {
    nfcArea.innerHTML = `
      <iconify-icon icon="mdi:alert-circle-outline" width="32"></iconify-icon>
      <span><small>NFC tidak didukung. Cari manual di bawah.</small></span>
    `;
    return;
  }

  nfcArea.onclick = async () => {
    try {
      const ndef = new NDEFReader();
      await ndef.scan();
      nfcArea.innerHTML = `
        <iconify-icon icon="mdi:contactless-payment-circle" width="32"></iconify-icon>
        <span>Dekatkan kartu siswa...</span>
      `;

      ndef.addEventListener("reading", ({ serialNumber }) => {
        const nfc_id = serialNumber.replace(/:/g, "").toUpperCase();
        const found = studentsData.find((s) => s.nfc_id === nfc_id);

        if (found) {
          showToast(`Siswa ditemukan: ${found.name}`, "success");
          selectStudent(found);
        } else {
          nfcArea.innerHTML = `
            <iconify-icon icon="mdi:card-off-outline" width="32"></iconify-icon>
            <span>Kartu ${nfc_id} tidak terdaftar!</span>
          `;

          setTimeout(() => {
            nfcArea.innerHTML = `
              <iconify-icon icon="mdi:nfc-variant" width="32"></iconify-icon>
              <span>Tap Kartu Siswa di sini</span>
            `;
          }, 2500);
        }
      });
    } catch (e) {
      showToast("Gagal scan: " + e, "error");
    }
  };
}

async function showViolations(type) {
  const section = document.getElementById("violationsSection");
  section.classList.remove("hidden");

  document.getElementById("violationList").innerHTML =
    '<p class="loading-text">Memuat data...</p>';

  if (violationsData.length === 0) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getViolations" }),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
      });
      const data = await res.json();

      if (data.status === "success") {
        violationsData = data.violations || [];
      } else {
        showToast("Gagal memuat data pelanggaran", "error");
        document.getElementById("violationList").innerHTML =
          '<p class="loading-text">Gagal memuat data.</p>';
        return;
      }
    } catch (err) {
      showToast("Gagal terhubung ke server", "error");
      return;
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
    const vType = v.type ? v.type.trim().toLowerCase() : "";
    const vName = v.name ? v.name.toLowerCase() : "";

    return vType === window.currentType && vName.includes(searchVal);
  });

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <iconify-icon icon="mdi:format-list-bulleted"></iconify-icon>
        <div class="title">Tidak ada item</div>
        <div class="subtitle">Coba kata kunci lain</div>
      </div>
    `;
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
            <div class="violation-name">${escapeHtml(v.name)}</div>
            <div class="points-badge ${pointColor}">${sign}${v.point}</div>
        `;
    list.appendChild(div);
  });
}

let lastTransaction = null;

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
        if (btn.onClick) btn.onClick();
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
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getHousePoints" }),
    });
    const data = await res.json();
    if (data.status === "success") {
      document.getElementById("houseJJT").innerText = data.houses.JJT ?? 0;
      document.getElementById("houseJensud").innerText = data.houses.Jensud ?? 0;
      document.getElementById("houseMunir").innerText = data.houses.Munir ?? 0;
    }
  } catch (e) {
    console.error("Fetch house points error:", e);
  }
}

async function refreshDashboard() {
  const list = document.getElementById("studentList");
  if (list) list.innerHTML = '<p class="loading-text">Memuat ulang data...</p>';

  await fetchStudents();
  await fetchHousePoints();
  renderStudents();
  showToast("Data diperbarui", "success");
}

// --- SUBMIT WITH NOTES & UNDO ---
function submitTransaction(violation) {
  const pointChange =
    violation.type === "plus" ? violation.point : -violation.point;
  const sign = violation.type === "plus" ? "+" : "-";
  const color = violation.type === "plus" ? "var(--success)" : "var(--danger)";

  showModal(
    "Konfirmasi Poin",
    `<div style="text-align:center; margin-bottom:6px;">
        <strong style="font-size:15px;">${escapeHtml(selectedStudent.name)}</strong>
     </div>
     <div style="text-align:center; margin-bottom:14px;">
        <strong style="font-size:22px; color:${color}; font-weight: 800;">${sign}${violation.point}</strong>
        <span style="color: var(--gray-500); font-size: 13px;"> Poin</span>
     </div>
     <div style="text-align:center; color: var(--gray-500); font-size: 13px; margin-bottom: 8px;">${escapeHtml(violation.name)}</div>
     <textarea id="noteInput" class="modal-textarea" placeholder="Catatan (opsional)..." rows="3"></textarea>`,
    [
      { text: "Batal", class: "btn-outline", onClick: closeModal },
      {
        text: "Ya, Berikan",
        class: violation.type === "plus" ? "btn-plus" : "btn-minus",
        keepOpen: true,
        onClick: async () => {
          document.getElementById("modalFooter").innerHTML =
            '<p style="color: var(--gray-500); font-size:13px; align-self:center; width:100%; margin: 8px 0;">Memproses...</p>';

          const note = document.getElementById("noteInput").value;
          try {
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
              const sIndex = studentsData.findIndex(
                (s) => s.nis === selectedStudent.nis
              );
              if (sIndex >= 0) studentsData[sIndex].points = data.newPoints;
              selectedStudent.points = data.newPoints;

              lastTransaction = {
                tr_id: data.tr_id,
                student_nis: selectedStudent.nis,
                point_change: pointChange,
              };

              fetchHousePoints();
              showToast(`Poin berhasil ${violation.type === "plus" ? "ditambahkan" : "dikurangi"}`, "success");

              showModal(
                "Berhasil!",
                `<p>Poin telah ${violation.type === "plus" ? "ditambahkan ke" : "dikurangi dari"} <strong>${escapeHtml(selectedStudent.name)}</strong>.</p>`,
                [
                  {
                    text: "<iconify-icon icon='mdi:undo'></iconify-icon> Undo",
                    class: "btn-outline",
                    onClick: undoLastTransaction,
                  },
                  {
                    text: "Selesai",
                    class: "btn-primary",
                    onClick: () => {
                      backToSelection();
                      renderStudents();
                      closeModal();
                    },
                  },
                ]
              );
            } else {
              showToast("Gagal: " + (data.message || "Unknown error"), "error");
              closeModal();
            }
          } catch (err) {
            showToast("Gagal terhubung ke server", "error");
            closeModal();
          }
        },
      },
    ]
  );
}

async function undoLastTransaction() {
  if (!lastTransaction) return;

  document.getElementById("modalTitle").innerText = "Memproses...";
  document.getElementById("modalBody").innerHTML =
    "<p>Membatalkan transaksi...</p>";
  document.getElementById("modalFooter").innerHTML = "";

  try {
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
      const sIndex = studentsData.findIndex(
        (s) => s.nis === lastTransaction.student_nis
      );
      if (sIndex >= 0) {
        const revertedPoints =
          parseInt(studentsData[sIndex].points) -
          parseInt(lastTransaction.point_change);
        studentsData[sIndex].points = revertedPoints;
        if (selectedStudent) selectedStudent.points = revertedPoints;
      }

      fetchHousePoints();
      lastTransaction = null;
      showToast("Transaksi dibatalkan", "success");

      showModal("Dibatalkan", "<p>Transaksi terakhir telah dibatalkan.</p>", [
        {
          text: "OK",
          class: "btn-primary",
          onClick: () => {
            backToSelection();
            renderStudents();
            closeModal();
          },
        },
      ]);
    } else {
      showToast("Gagal undo: " + (data.message || ""), "error");
      closeModal();
    }
  } catch (err) {
    showToast("Gagal terhubung ke server", "error");
    closeModal();
  }
}