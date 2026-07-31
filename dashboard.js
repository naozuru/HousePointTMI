/**
 * Dashboard - Teacher main page
 */
(function () {
  'use strict';

  const T = window.TMI;
  let currentTeacher = T.checkAuth();
  if (!currentTeacher) return;

  document.getElementById('teacherName').textContent = `Hello, ${currentTeacher.name}`;

  // State
  let studentsData = [];
  let violationsData = [];
  let violationCategories = [];
  let selectedStudent = null;
  let currentViolationType = null;
  let currentCategoryFilter = '';
  let currentHouseFilter = '';
  let lastTransaction = null;
  let housePoints = null;

  // === INIT ===
  window.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
      fetchStudents(),
      fetchViolations(),
      fetchHousePoints(),
      fetchDashboardStats()
    ]);
    initStudentNFC();
    bindEvents();
  });

  function bindEvents() {
    // Debounced search
    const searchInput = document.getElementById('searchStudent');
    searchInput.addEventListener('input', T.debounce(renderStudents, 200));

    const violationSearch = document.getElementById('searchViolation');
    violationSearch.addEventListener('input', T.debounce(renderViolations, 200));

    document.getElementById('classFilter').addEventListener('change', renderStudents);

    document.getElementById('backBtn').addEventListener('click', backToSelection);

    // Quick house filters
    document.querySelectorAll('#quickFilters .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#quickFilters .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentHouseFilter = chip.dataset.house;
        renderStudents();
      });
    });

    // First chip as default active
    document.querySelector('#quickFilters .chip').classList.add('active');
  }

  // === DATA FETCHING ===

  async function fetchStudents() {
    const res = await T.api('getStudents');
    if (res.status === 'success') {
      studentsData = res.students || [];
    } else {
      T.showToast('Failed to load students', 'error');
    }
    renderStudents();
  }

  async function fetchViolations() {
    const res = await T.api('getViolations');
    if (res.status === 'success') {
      violationsData = res.violations || [];
      violationCategories = res.categories || [];
      renderCategoryChips();
    }
  }

  async function fetchHousePoints() {
    const res = await T.api('getHousePoints');
    if (res.status === 'success') {
      housePoints = res;
      renderHousePoints();
    }
  }

  async function fetchDashboardStats() {
    const res = await T.api('getDashboardStats');
    if (res.status === 'success') {
      renderStats(res.stats);
    } else {
      renderStatsFallback();
    }
  }

  function renderStatsFallback() {
    const positiveToday = studentsData.filter(s => s.points > 0).length;
    const total = studentsData.length;
    const stats = [
      { label: 'Total Students', value: total, icon: 'mdi:account-group', cls: '' },
      { label: 'Positive Students', value: positiveToday, icon: 'mdi:trending-up', cls: 'success' },
      { label: 'Total Points', value: studentsData.reduce((a, s) => a + (parseInt(s.points) || 0), 0), icon: 'mdi:star', cls: 'warning' },
      { label: 'Avg per Student', value: total > 0 ? Math.round(studentsData.reduce((a, s) => a + (parseInt(s.points) || 0), 0) / total * 10) / 10 : 0, icon: 'mdi:chart-line', cls: 'info' }
    ];
    renderStats({ stats });
  }

  // === RENDERERS ===

  function renderStats(data) {
    const stats = data.stats || data;
    const positiveToday = stats.positive_today ?? studentsData.filter(s => s.points > 0).length;
    const total = stats.total_students ?? studentsData.length;
    const totalPoints = studentsData.reduce((a, s) => a + (parseInt(s.points) || 0), 0);
    const avg = total > 0 ? Math.round(totalPoints / total * 10) / 10 : 0;

    const items = [
      { label: 'Students', value: total, icon: 'mdi:account-group', cls: '' },
      { label: 'Points +Today', value: '+' + (stats.positive_today || 0), icon: 'mdi:trending-up', cls: 'success' },
      { label: 'Points -Today', value: '-' + (stats.negative_today || 0), icon: 'mdi:trending-down', cls: 'danger' },
      { label: 'Tx Today', value: stats.transactions_today || 0, icon: 'mdi:receipt-text', cls: 'info' }
    ];

    const grid = document.getElementById('statsGrid');
    grid.innerHTML = items.map((s, i) => `
      <div class="stat-card ${s.cls}" style="animation-delay:${i * 60}ms">
        <div class="stat-icon"><iconify-icon icon="${s.icon}"></iconify-icon></div>
        <div class="stat-label">${T.escapeHtml(s.label)}</div>
        <div class="stat-value">${T.formatNumber(s.value)}</div>
      </div>
    `).join('');
  }

  function renderHousePoints() {
    if (!housePoints) return;
    document.getElementById('houseJJT').innerText = T.formatNumber(housePoints.houses.JJT || 0);
    document.getElementById('houseJensud').innerText = T.formatNumber(housePoints.houses.Jensud || 0);
    document.getElementById('houseMunir').innerText = T.formatNumber(housePoints.houses.Munir || 0);

    // Highlight leader
    const leader = housePoints.leader;
    ['JJT', 'Jensud', 'Munir'].forEach(h => {
      const card = document.getElementById(`houseCard-${h}`);
      if (card) card.classList.toggle('leader', h === leader && housePoints.houses[h] > 0);
    });
  }

  function renderStudents() {
    const searchVal = document.getElementById('searchStudent').value.toLowerCase().trim();
    const classVal = document.getElementById('classFilter').value;
    const list = document.getElementById('studentList');

    const filtered = studentsData.filter((s) => {
      let classMatch = false;
      const studentGrade = parseInt(s.class) || 0;

      if (classVal === 'all') classMatch = true;
      else if (classVal === 'JHS') classMatch = [7, 8, 9].includes(studentGrade);
      else if (classVal === 'SHS') classMatch = [10, 11, 12].includes(studentGrade);
      else classMatch = studentGrade === parseInt(classVal);

      const houseMatch = !currentHouseFilter || s.house === currentHouseFilter;

      const nameMatch = !searchVal ||
        (s.name || '').toLowerCase().includes(searchVal) ||
        String(s.nis).includes(searchVal);

      return classMatch && houseMatch && nameMatch;
    });

    if (filtered.length === 0) {
      list.innerHTML = T.emptyState('mdi:account-search-outline', 'No students found', 'Try a different keyword or change the filter');
      return;
    }

    list.innerHTML = filtered.map((s, idx) => {
      const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
      const sign = s.points > 0 ? '+' : '';
      const houseKey = s.house && T.HOUSES[s.house] ? s.house : '';
      return `
        <div class="list-item" data-nis="${T.escapeHtml(s.nis)}" style="animation-delay:${Math.min(idx * 20, 200)}ms">
          <div class="student-item-left">
            <div class="student-avatar house-${houseKey}" data-avatar="${T.escapeHtml(s.nis)}"></div>
            <div class="student-info-text">
              <div class="name">${T.escapeHtml(s.name)}</div>
              <div class="meta">
                <span>Grade ${T.escapeHtml(s.class)}</span>
                ${s.house ? `<span>•</span><span style="color:${T.getHouseColor(s.house)}; font-weight:700;">${T.escapeHtml(s.house)}</span>` : ''}
                <span>•</span>
                <span>NIS: ${T.escapeHtml(String(s.nis))}</span>
              </div>
            </div>
          </div>
          <div class="points-badge ${pointClass}">${sign}${T.formatNumber(s.points)}</div>
        </div>
      `;
    }).join('');

    // Wire avatars & click
    list.querySelectorAll('.list-item').forEach((item, i) => {
      const nis = item.dataset.nis;
      const student = filtered[i];
      const avatarContainer = item.querySelector('[data-avatar]');
      if (avatarContainer && student) {
        avatarContainer.appendChild(T.createAvatar(student));
      }
      item.addEventListener('click', () => selectStudent(student));
    });
  }

  function renderCategoryChips() {
    const container = document.getElementById('categoryChips');
    const cats = ['All', ...violationCategories];
    container.innerHTML = cats.map((c, i) =>
      `<span class="chip ${i === 0 ? 'active' : ''}" data-cat="${T.escapeHtml(c)}">${T.escapeHtml(c)}</span>`
    ).join('');

    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentCategoryFilter = chip.dataset.cat === 'All' ? '' : chip.dataset.cat;
        renderViolations();
      });
    });
  }

  // === STUDENT SELECTION ===

  async function selectStudent(student) {
    selectedStudent = student;
    document.getElementById('studentSelectionCard').classList.add('hidden');
    document.getElementById('actionCard').classList.remove('hidden');

    const headerDiv = document.getElementById('studentDetailHeader');
    headerDiv.innerHTML = '';

    const pointClass = student.points >= 0 ? 'points-positive' : 'points-negative';
    const sign = student.points > 0 ? '+' : '';
    const houseKey = student.house && T.HOUSES[student.house] ? student.house : '';
    const houseColor = T.getHouseColor(student.house);

    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'flex:1; min-width:0;';
    infoDiv.innerHTML = `
      <h3>${T.escapeHtml(student.name)}</h3>
      <p>
        Grade ${T.escapeHtml(student.class)}
        ${student.house ? `• <span style="color:${houseColor}; font-weight:700;">${T.escapeHtml(student.house)}</span>` : ''}
        • NIS: ${T.escapeHtml(String(student.nis))}
      </p>
      <div class="points-badge ${pointClass}" style="margin-top:10px; display:inline-block;">
        Current Points: ${sign}${T.formatNumber(student.points)}
      </div>
    `;

    const avatar = T.createAvatar(student, 'large house-' + houseKey);
    headerDiv.appendChild(avatar);
    headerDiv.appendChild(infoDiv);
    headerDiv.className = 'student-detail-header';

    document.getElementById('violationsSection').classList.add('hidden');
    document.getElementById('searchViolation').value = '';
    document.getElementById('studentHistoryPreview').classList.add('hidden');

    // Load student history
    loadStudentHistory(student.nis);
  }

  async function loadStudentHistory(nis) {
    const res = await T.api('getStudentHistory', { nis, limit: 5 });
    const container = document.getElementById('studentHistoryList');
    const wrapper = document.getElementById('studentHistoryPreview');

    if (res.status !== 'success' || res.history.length === 0) {
      wrapper.classList.add('hidden');
      return;
    }

    wrapper.classList.remove('hidden');
    container.innerHTML = res.history.map(t => {
      const pClass = t.points >= 0 ? 'points-positive' : 'points-negative';
      const sign = t.points > 0 ? '+' : '';
      return `
        <div class="history-item">
          <div class="history-meta">
            <span class="history-date">${T.formatRelative(t.date)} • ${T.formatDate(t.date)}</span>
            <span class="history-note">${T.escapeHtml(t.note || t.violation_name || 'Transaction')}</span>
          </div>
          <div class="points-badge ${pClass}">${sign}${T.formatNumber(t.points)}</div>
        </div>
      `;
    }).join('');
  }

  function backToSelection() {
    document.getElementById('studentSelectionCard').classList.remove('hidden');
    document.getElementById('actionCard').classList.add('hidden');
    document.getElementById('violationsSection').classList.add('hidden');
    document.getElementById('searchViolation').value = '';
    document.getElementById('studentHistoryPreview').classList.add('hidden');
    selectedStudent = null;
  }

  // === NFC ===

  function initStudentNFC() {
    const nfcArea = document.getElementById('studentNfcArea');
    if (!nfcArea) return;

    if (!('NDEFReader' in window)) {
      nfcArea.innerHTML = `
        <iconify-icon icon="mdi:alert-circle-outline" width="32"></iconify-icon>
        <span><small>NFC not supported. Search manually below.</small></span>
      `;
      return;
    }

    nfcArea.addEventListener('click', async () => {
      try {
        const ndef = new NDEFReader();
        await ndef.scan();
        nfcArea.classList.add('scanning');
        nfcArea.innerHTML = `
          <iconify-icon icon="mdi:contactless-payment-circle" width="32"></iconify-icon>
          <span>Hold student card near device...</span>
        `;

        ndef.addEventListener('reading', ({ serialNumber }) => {
          const nfc_id = serialNumber.replace(/:/g, '').toUpperCase();
          const found = studentsData.find(s => s.nfc_id === nfc_id);

          if (found) {
            T.vibrate(50);
            T.showToast(`Student found: ${found.name}`, 'success');
            selectStudent(found);
            resetNfcArea();
          } else {
            nfcArea.classList.remove('scanning');
            nfcArea.innerHTML = `
              <iconify-icon icon="mdi:card-off-outline" width="32"></iconify-icon>
              <span>Card ${T.escapeHtml(nfc_id)} is not registered!</span>
            `;
            setTimeout(resetNfcArea, 2500);
          }
        });
      } catch (e) {
        T.showToast('Failed to scan: ' + e.message, 'error');
      }
    });

    function resetNfcArea() {
      nfcArea.classList.remove('scanning');
      nfcArea.innerHTML = `
        <iconify-icon icon="mdi:nfc-variant" width="32"></iconify-icon>
        <span>Tap a Student Card here</span>
        <small style="font-weight: 500; opacity: 0.7;">Or search manually below</small>
      `;
    }
  }

  // === VIOLATIONS ===

  function showViolations(type) {
    currentViolationType = type;
    document.getElementById('violationsSection').classList.remove('hidden');
    renderViolations();
  }

  function renderViolations() {
    if (!currentViolationType) return;
    const searchVal = document.getElementById('searchViolation').value.toLowerCase().trim();
    const list = document.getElementById('violationList');

    const filtered = violationsData.filter(v => {
      const vType = (v.type || '').toLowerCase();
      const vName = (v.name || '').toLowerCase();
      const typeMatch = vType === currentViolationType;
      const searchMatch = !searchVal || vName.includes(searchVal);
      const catMatch = !currentCategoryFilter || v.category === currentCategoryFilter;
      return typeMatch && searchMatch && catMatch;
    });

    if (filtered.length === 0) {
      list.innerHTML = T.emptyState('mdi:format-list-bulleted', 'No items', 'Try a different keyword');
      return;
    }

    list.innerHTML = filtered.map((v, idx) => {
      const pointColor = v.type === 'plus' ? 'points-positive' : 'points-negative';
      const sign = v.type === 'plus' ? '+' : '-';
      return `
        <div class="violation-item" data-vid="${T.escapeHtml(v.id)}" style="animation-delay:${Math.min(idx * 20, 200)}ms">
          <div>
            <div class="violation-name">${T.escapeHtml(v.name)}</div>
            <span class="violation-category">${T.escapeHtml(v.category || 'General')}</span>
          </div>
          <div class="points-badge ${pointColor}">${sign}${T.formatNumber(v.point)}</div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.violation-item').forEach((item, i) => {
      item.addEventListener('click', () => submitTransaction(filtered[i]));
    });
  }

  // === TRANSACTION FLOW ===

  function submitTransaction(violation) {
    const pointChange = violation.type === 'plus' ? violation.point : -violation.point;
    const sign = violation.type === 'plus' ? '+' : '-';
    const color = violation.type === 'plus' ? 'var(--success)' : 'var(--danger)';
    const btnClass = violation.type === 'plus' ? 'btn-plus' : 'btn-minus';

    T.showModal(
      'Confirm Points',
      `
        <div style="text-align:center; margin-bottom:6px;">
          <strong style="font-size:15px;">${T.escapeHtml(selectedStudent.name)}</strong>
        </div>
        <div style="text-align:center; margin-bottom:14px;">
          <strong style="font-size:32px; color:${color}; font-weight:800; display:block; line-height:1;">${sign}${violation.point}</strong>
          <span style="color: var(--text-secondary); font-size: 13px;">Points</span>
        </div>
        <div style="text-align:center; color: var(--text-secondary); font-size: 13px; margin-bottom: 14px; padding: 10px; background: var(--bg-input); border-radius: var(--radius-md);">
          ${T.escapeHtml(violation.name)}
        </div>
        <textarea id="noteInput" class="modal-textarea" placeholder="Note (optional)..." rows="3" maxlength="500"></textarea>
        <div style="text-align:right; font-size:11px; color:var(--text-tertiary); margin-top:4px;">
          <span id="noteCounter">0</span>/500
        </div>
      `,
      [
        { text: 'Cancel', class: 'btn-outline' },
        {
          text: `<iconify-icon icon="mdi:check"></iconify-icon> Confirm`,
          class: btnClass,
          keepOpen: true,
          onClick: async () => {
            const noteEl = document.getElementById('noteInput');
            const counter = document.getElementById('noteCounter');
            if (counter && noteEl) {
              counter.textContent = noteEl.value.length;
            }

            const footer = document.getElementById('modalFooter');
            footer.innerHTML = '<p style="color: var(--text-secondary); font-size:13px; padding: 10px 0;">⏳ Processing...</p>';

            const note = noteEl ? noteEl.value : '';

            const res = await T.api('addTransaction', {
              teacher_id: currentTeacher.id,
              student_nis: selectedStudent.nis,
              violation_id: violation.id,
              point_change: pointChange,
              note
            });

            if (res.status === 'success') {
              T.vibrate(50);

              // Update local state
              const sIndex = studentsData.findIndex(s => String(s.nis) === String(selectedStudent.nis));
              if (sIndex >= 0) studentsData[sIndex].points = res.newPoints;
              selectedStudent.points = res.newPoints;

              lastTransaction = {
                tr_id: res.tr_id,
                student_nis: selectedStudent.nis,
                student_name: selectedStudent.name,
                point_change: pointChange,
                type: violation.type,
                points: violation.point
              };

              fetchHousePoints();
              renderStudents();
              loadStudentHistory(selectedStudent.nis);

              // Update header
              const sign2 = res.newPoints > 0 ? '+' : '';
              const pClass = res.newPoints >= 0 ? 'points-positive' : 'points-negative';
              const headerInfo = document.querySelector('#studentDetailHeader .student-info-text');
              if (headerInfo) {
                const badge = headerInfo.querySelector('.points-badge');
                if (badge) {
                  badge.className = `points-badge ${pClass}`;
                  badge.style.marginTop = '10px';
                  badge.style.display = 'inline-block';
                  badge.textContent = `Current Points: ${sign2}${T.formatNumber(res.newPoints)}`;
                  T.pulse(badge);
                }
              }

              // Milestone confetti
              if (res.milestone) {
                if (res.milestone.type === 'achievement') {
                  T.confetti(0.5, 0.5);
                  T.showToast(`🎉 Milestone! ${res.milestone.value} points reached!`, 'success', 4000);
                } else {
                  T.showToast(`⚠️ Points reached ${res.milestone.value}`, 'warning', 4000);
                }
              }

              T.showToast(
                `Points ${violation.type === 'plus' ? 'added' : 'subtracted'} successfully`,
                'success'
              );

              T.showModal(
                'Success!',
                `<p>Points have been ${violation.type === 'plus' ? 'added to' : 'subtracted from'} <strong>${T.escapeHtml(selectedStudent.name)}</strong>.</p>
                 <p style="margin-top:10px;">Current points: <strong style="color:var(--primary); font-size:18px;">${sign2}${T.formatNumber(res.newPoints)}</strong></p>`,
                [
                  {
                    text: '<iconify-icon icon="mdi:undo"></iconify-icon> Undo',
                    class: 'btn-outline',
                    onClick: undoLastTransaction
                  },
                  {
                    text: 'Done',
                    class: 'btn-primary',
                    onClick: () => {
                      backToSelection();
                    }
                  }
                ]
              );
            } else {
              T.showToast('Failed: ' + (res.message || 'Unknown error'), 'error');
              T.closeModal();
            }
          }
        }
      ]
    );

    setTimeout(() => {
      const noteEl = document.getElementById('noteInput');
      const counter = document.getElementById('noteCounter');
      if (noteEl && counter) {
        noteEl.addEventListener('input', () => {
          counter.textContent = noteEl.value.length;
        });
        noteEl.focus();
      }
    }, 100);
  }

  async function undoLastTransaction() {
    if (!lastTransaction) {
      T.showToast('No transaction to undo', 'warning');
      return;
    }

    const res = await T.api('undoTransaction', {
      tr_id: lastTransaction.tr_id,
      actor: currentTeacher.id
    });

    if (res.status === 'success') {
      // Revert local state
      const sIndex = studentsData.findIndex(s => String(s.nis) === String(lastTransaction.student_nis));
      if (sIndex >= 0) {
        studentsData[sIndex].points -= lastTransaction.point_change;
        if (selectedStudent) selectedStudent.points -= lastTransaction.point_change;
      }

      lastTransaction = null;
      fetchHousePoints();
      renderStudents();

      T.showToast('Transaction cancelled', 'success');
      T.showModal('Cancelled', '<p>The last transaction has been cancelled and the points returned.</p>', [
        { text: 'OK', class: 'btn-primary', onClick: backToSelection }
      ]);
    } else {
      T.showToast('Undo failed: ' + (res.message || ''), 'error');
      T.closeModal();
    }
  }

  // === REFRESH ===
  async function refreshDashboard() {
    document.getElementById('studentList').innerHTML =
      '<p class="loading-text">Reloading...</p>';
    await Promise.all([
      fetchStudents(),
      fetchHousePoints(),
      fetchDashboardStats()
    ]);
    T.showToast('Data refreshed', 'success', 1500);
  }

  // Expose globally for inline onclick handlers
  window.refreshDashboard = refreshDashboard;
  window.showViolations = showViolations;

})();
