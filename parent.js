async function loginParent() {
    const nis = document.getElementById('nisInput').value;
    if(!nis) return alert("Masukkan NIS");
    
    const res = await fetch(API_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'parentLogin', nis: nis })
    });
    const data = await res.json();

    if(data.status === 'success') {
        document.getElementById('loginCard').classList.add('hidden');
        document.getElementById('parentDashboard').classList.remove('hidden');
        
        const s = data.student;
        const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
        const avatarHtml = s.photo_url ? `<img src="${s.photo_url}" class="student-avatar">` : `<div class="student-avatar">${s.name.charAt(0)}</div>`;
        
        document.getElementById('parentStudentHeader').innerHTML = `
            ${avatarHtml}
            <h3>${s.name}</h3>
            <p>Kelas ${s.class} • Rumah ${s.house}</p>
            <div class="current-points points-badge ${pointClass}">Total Poin: ${s.points}</div>
        `;

        const list = document.getElementById('parentHistoryList');
        list.innerHTML = '';
        if(data.history.length === 0) list.innerHTML = '<p class="loading-text">Belum ada riwayat.</p>';
        
        data.history.forEach(t => {
            const div = document.createElement('div');
            div.className = 'list-item';
            const pClass = t.points >= 0 ? 'points-positive' : 'points-negative';
            const sign = t.points > 0 ? '+' : '';
            const formattedDate = new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            div.innerHTML = `
                <div class="student-info-text">
                    <div class="meta">${formattedDate}</div>
                    <div class="name" style="font-size:13px; font-weight:500;">${t.note || 'Tanpa catatan'}</div>
                </div>
                <div class="points-badge ${pClass}">${sign}${t.points}</div>
            `;
            list.appendChild(div);
        });
    } else {
        alert("NIS tidak ditemukan.");
    }
}

function logoutParent() {
    document.getElementById('nisInput').value = '';
    document.getElementById('parentDashboard').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
}