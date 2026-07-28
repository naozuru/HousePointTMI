function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function createStudentAvatar(student, sizeClass = '') {
    const avatar = document.createElement('div');
    avatar.className = `student-avatar ${sizeClass}`;
    const initials = (student.name || '?').split(' ').map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();
    avatar.textContent = initials;
    if (student.photo_url && typeof student.photo_url === 'string' && student.photo_url.startsWith('http')) {
        const img = new Image();
        img.className = `student-avatar-img ${sizeClass}`;
        img.src = student.photo_url;
        img.onload = () => {
            avatar.innerHTML = '';
            avatar.appendChild(img);
        };
    }
    return avatar;
}

function getHouseColor(house) {
    if (!house) return 'var(--primary)';
    const h = String(house).toLowerCase();
    if (h.includes('jjt')) return '#004632';
    if (h.includes('jensud')) return '#00835c';
    if (h.includes('munir')) return '#2ea876';
    return 'var(--primary)';
}

async function loginParent() {
    const nis = document.getElementById('nisInput').value.trim();
    if (!nis) {
        showToast('Masukkan NIS siswa', 'error');
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<iconify-icon icon="mdi:loading"></iconify-icon> Memuat...';

    try {
        const res = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'parentLogin', nis: nis })
        });
        const data = await res.json();

        if (data.status === 'success') {
            document.getElementById('loginPage').classList.add('hidden');
            document.getElementById('parentDashboard').classList.remove('hidden');

            const s = data.student;
            const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
            const sign = s.points > 0 ? '+' : '';
            const houseColor = getHouseColor(s.house);

            // Hitung statistik
            const positiveCount = data.history.filter(t => t.points > 0).length;
            const negativeCount = data.history.filter(t => t.points < 0).length;
            const totalTransactions = data.history.length;

            // Render header
            const headerDiv = document.getElementById('parentStudentHeader');
            headerDiv.innerHTML = '';

            const avatar = createStudentAvatar(s);
            const infoDiv = document.createElement('div');
            infoDiv.innerHTML = `
                <h3 style="margin-top: 14px;">${escapeHtml(s.name)}</h3>
                <p>Kelas ${escapeHtml(s.class)} • <span style="color:${houseColor}; font-weight: 700;">Rumah ${escapeHtml(s.house || '-')}</span></p>
                <div class="current-points points-badge ${pointClass}">Total Poin: ${sign}${s.points}</div>
                <div class="parent-summary">
                    <div class="summary-card primary">
                        <div class="label">Total Transaksi</div>
                        <div class="value">${totalTransactions}</div>
                    </div>
                    <div class="summary-card">
                        <div class="label" style="color: var(--success);">Penghargaan</div>
                        <div class="value" style="color: var(--success);">${positiveCount}</div>
                    </div>
                </div>
            `;
            headerDiv.appendChild(avatar);
            headerDiv.appendChild(infoDiv);

            // Render history
            const list = document.getElementById('parentHistoryList');
            list.innerHTML = '';
            if (!data.history || data.history.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        <iconify-icon icon="mdi:history"></iconify-icon>
                        <div class="title">Belum ada riwayat</div>
                        <div class="subtitle">Transaksi poin akan muncul di sini</div>
                    </div>
                `;
            } else {
                data.history.forEach(t => {
                    const div = document.createElement('div');
                    div.className = 'list-item';
                    const pClass = t.points >= 0 ? 'points-positive' : 'points-negative';
                    const sign = t.points > 0 ? '+' : '';
                    const formattedDate = new Date(t.date).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                    div.innerHTML = `
                        <div class="history-meta">
                            <span class="history-date">${formattedDate}</span>
                            <span class="history-note">${escapeHtml(t.note || 'Tanpa catatan')}</span>
                        </div>
                        <div class="points-badge ${pClass}">${sign}${t.points}</div>
                    `;
                    list.appendChild(div);
                });
            }

            showToast('Data berhasil dimuat', 'success');
        } else {
            showToast('NIS tidak ditemukan', 'error');
            btn.disabled = false;
            btn.innerHTML = '<iconify-icon icon="mdi:eye-outline"></iconify-icon> Lihat Poin';
        }
    } catch (err) {
        showToast('Gagal terhubung ke server', 'error');
        btn.disabled = false;
        btn.innerHTML = '<iconify-icon icon="mdi:eye-outline"></iconify-icon> Lihat Poin';
    }
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

// Form submit handler
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            loginParent();
        });
    }
});

function logoutParent() {
    document.getElementById('nisInput').value = '';
    document.getElementById('parentDashboard').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    const btn = document.getElementById('loginBtn');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<iconify-icon icon="mdi:eye-outline"></iconify-icon> Lihat Poin';
    }
}