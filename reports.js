/**
 * Reports - All reporting tabs
 */
(function () {
  'use strict';

  const T = window.TMI;
  if (!T.checkAuth()) return;

  let pointsChart = null;
  let houseChart = null;
  let currentTab = 'ranking';
  let allStudentsCache = [];

  // === INIT ===
  document.addEventListener('DOMContentLoaded', async () => {
    const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
    const monthSelect = document.getElementById('monthFilter');
    if (monthSelect) monthSelect.value = currentMonth;

    bindTabs();
    bindFilters();

    await Promise.all([
      fetchLeaderboard(),
      fetchHistory(),
      fetchHouseBattle(),
      fetchClassStats(),
      fetchStudentsReport()
    ]);
  });

  function bindTabs() {
    document.querySelectorAll('#mainTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('#mainTabs .tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const target = document.getElementById(tab + 'Tab');
    if (target) target.classList.remove('hidden');

    // Refresh data on tab switch
    if (tab === 'houses') fetchHouseBattle();
    if (tab === 'classes') fetchClassStats();
    if (tab === 'students') fetchStudentsReport();
  }

  function bindFilters() {
    const debouncedLeaderboard = T.debounce(fetchLeaderboard, 200);
    const debouncedHistory = T.debounce(fetchHistory, 200);

    document.getElementById('levelFilter').addEventListener('change', debouncedLeaderboard);
    document.getElementById('gradeFilter').addEventListener('change', debouncedLeaderboard);
    document.getElementById('houseFilter').addEventListener('change', debouncedLeaderboard);

    document.getElementById('monthFilter').addEventListener('change', debouncedHistory);
    document.getElementById('viewTypeFilter').addEventListener('change', debouncedHistory);
    document.getElementById('historyHouseFilter').addEventListener('change', debouncedHistory);

    // Students-report filters
    const studentsLevelFilter = document.getElementById('studentsLevelFilter');
    const studentsGradeFilter = document.getElementById('studentsGradeFilter');
    const studentsHouseFilter = document.getElementById('studentsHouseFilter');

    if (studentsLevelFilter) {
      studentsLevelFilter.addEventListener('change', () => {
        // Selecting "All Levels" should reset the grade filter to "all"
        if (studentsLevelFilter.value !== 'all' && studentsGradeFilter.value !== 'all') {
          studentsGradeFilter.value = 'all';
        }
        T.debounce(fetchStudentsReport, 150)();
      });
    }
    if (studentsGradeFilter) {
      studentsGradeFilter.addEventListener('change', () => {
        T.debounce(fetchStudentsReport, 150)();
      });
    }
    if (studentsHouseFilter) {
      studentsHouseFilter.addEventListener('change', () => {
        T.debounce(fetchStudentsReport, 150)();
      });
    }
  }

  // === RANKING ===

  async function fetchLeaderboard() {
    const level = document.getElementById('levelFilter').value;
    const grade = document.getElementById('gradeFilter').value;
    const house = document.getElementById('houseFilter').value;

    const list = document.getElementById('allStudentsList');
    list.innerHTML = '<div class="skeleton skeleton-list-item" style="height:60px;"></div>'.repeat(4);

    const res = await T.api('getLeaderboard', {
      level: level === 'all' ? '' : level,
      grade: grade === 'all' ? '' : grade,
      house: house === 'all' ? '' : house
    });

    if (res.status === 'success') {
      allStudentsCache = res.all || [];
      renderHighlight(res.highest, res.lowest);
      renderAllStudents(res.all || []);
    } else {
      list.innerHTML = T.emptyState('mdi:trophy-outline', 'Failed to load data');
    }
  }

  function renderHighlight(highest, lowest) {
    const hAvatar = document.getElementById('highestAvatar');
    hAvatar.innerHTML = '';
    if (highest) {
      hAvatar.appendChild(T.createAvatar(highest));
      document.getElementById('highestName').textContent = highest.name;
      document.getElementById('highestClass').textContent = `Grade ${highest.class}`;
      document.getElementById('highestPoints').textContent = `+${T.formatNumber(highest.points)} Points`;
    } else {
      document.getElementById('highestName').textContent = 'No data';
      document.getElementById('highestClass').textContent = '-';
      document.getElementById('highestPoints').textContent = '0 Points';
    }

    const lAvatar = document.getElementById('lowestAvatar');
    lAvatar.innerHTML = '';
    if (lowest) {
      const lowAvatar = T.createAvatar(lowest);
      lowAvatar.style.background = 'linear-gradient(135deg, var(--danger), #b91c1c)';
      lAvatar.appendChild(lowAvatar);
      document.getElementById('lowestName').textContent = lowest.name;
      document.getElementById('lowestClass').textContent = `Grade ${lowest.class}`;
      const sign = lowest.points > 0 ? '+' : '';
      document.getElementById('lowestPoints').textContent = `${sign}${T.formatNumber(lowest.points)} Points`;
    } else {
      document.getElementById('lowestName').textContent = 'No data';
      document.getElementById('lowestClass').textContent = '-';
      document.getElementById('lowestPoints').textContent = '0 Points';
    }
  }

  function renderAllStudents(students) {
    const list = document.getElementById('allStudentsList');
    if (students.length === 0) {
      list.innerHTML = T.emptyState('mdi:trophy-outline', 'No student data', 'Try changing the filter');
      return;
    }

    list.innerHTML = students.map((s, index) => {
      const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
      const sign = s.points > 0 ? '+' : '';
      const houseKey = s.house && T.HOUSES[s.house] ? s.house : '';
      let rankBadge = `<span class="rank-num">${index + 1}</span>`;
      if (index === 0) rankBadge = `<span class="rank-num gold"><iconify-icon icon="mdi:crown"></iconify-icon></span>`;
      else if (index === 1) rankBadge = `<span class="rank-num silver"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;
      else if (index === 2) rankBadge = `<span class="rank-num bronze"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;

      return `
        <div class="list-item rank-item" data-nis="${T.escapeHtml(s.nis)}" style="animation-delay:${Math.min(index * 15, 200)}ms">
          <div class="student-item-left">
            ${rankBadge}
            <div class="student-avatar small house-${houseKey}" data-avatar="${T.escapeHtml(s.nis)}"></div>
            <div class="student-info-text">
              <div class="name">${T.escapeHtml(s.name)}</div>
              <div class="meta">
                <span>Grade ${T.escapeHtml(s.class)}</span>
                ${s.house ? `<span>•</span><span style="color:${T.getHouseColor(s.house)}; font-weight:700;">${T.escapeHtml(s.house)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="points-badge ${pointClass}">${sign}${T.formatNumber(s.points)}</div>
        </div>
      `;
    }).join('');

    // Wire avatars
    list.querySelectorAll('.list-item').forEach((item, i) => {
      const avatarContainer = item.querySelector('[data-avatar]');
      if (avatarContainer && students[i]) {
        avatarContainer.appendChild(T.createAvatar(students[i], 'small'));
      }
    });
  }

  // === HISTORY ===

  async function fetchHistory() {
    const month = document.getElementById('monthFilter').value;
    const viewType = document.getElementById('viewTypeFilter').value;
    const house = document.getElementById('historyHouseFilter').value;

    document.getElementById('historyList').innerHTML =
      '<div class="skeleton skeleton-list-item" style="height:60px;"></div>'.repeat(3);

    const res = await T.api('getHistory', {
      month, viewType, house,
      limit: 100
    });

    if (res.status === 'success') {
      renderHistoryList(res.transactions || []);
      renderChart(res.chartData || [], month === 'all' ? 'All' : month);
    }
  }

  function renderHistoryList(transactions) {
    const list = document.getElementById('historyList');
    if (transactions.length === 0) {
      list.innerHTML = T.emptyState('mdi:history', 'No transactions', 'No activity in this period');
      return;
    }

    list.innerHTML = transactions.map(t => {
      const pointClass = t.points >= 0 ? 'points-positive' : 'points-negative';
      const sign = t.points > 0 ? '+' : '';
      const houseColor = T.getHouseColor(t.student_house);
      return `
        <div class="list-item">
          <div class="student-item-left">
            <div class="student-avatar small" data-avatar></div>
            <div class="student-info-text">
              <div class="name">${T.escapeHtml(t.student_name)}</div>
              <div class="meta">
                <span>Grade ${T.escapeHtml(t.student_class)}</span>
                ${t.student_house ? `<span>•</span><span style="color:${houseColor}; font-weight:700;">${T.escapeHtml(t.student_house)}</span>` : ''}
                <span>•</span>
                <span>${T.formatDateTime(t.date)}</span>
              </div>
              ${t.note ? `<div class="history-note" style="margin-top:4px;">${T.escapeHtml(t.note)}</div>` : ''}
            </div>
          </div>
          <div class="points-badge ${pointClass}">${sign}${T.formatNumber(t.points)}</div>
        </div>
      `;
    }).join('');
  }

  function renderChart(chartData, label) {
    const ctx = document.getElementById('pointsChart').getContext('2d');
    if (pointsChart) pointsChart.destroy();

    const labels = Array.from({ length: 31 }, (_, i) => i + 1);

    pointsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: `Points Activity ${label}`,
          data: chartData,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return '#004632';
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, '#004632');
            gradient.addColorStop(1, '#2ea876');
            return gradient;
          },
          borderRadius: 6,
          maxBarThickness: 18
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            titleFont: { weight: '700', size: 13 },
            bodyFont: { size: 12 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          },
          x: {
            ticks: { color: '#64748b', autoSkip: true, maxTicksLimit: 10, font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  // === HOUSE BATTLE ===

  async function fetchHouseBattle() {
    const [pointsRes, historyRes] = await Promise.all([
      T.api('getHousePoints'),
      T.api('getHouseHistory', { months: 6 })
    ]);

    if (pointsRes.status === 'success') {
      renderHouseBattle(pointsRes);
    }
    if (historyRes.status === 'success') {
      renderHouseTrendChart(historyRes.history);
      renderHouseTopStudents(historyRes.history);
    }
  }

  function renderHouseBattle(data) {
    const container = document.getElementById('houseBattle');
    const max = Math.max(...Object.values(data.houses).map(Math.abs), 1);

    const rows = data.ranked.map(r => {
      const pct = (Math.abs(r.points) / max) * 100;
      const color = T.HOUSES[r.house]?.color || 'var(--primary)';
      const isLeader = data.leader === r.house && r.points > 0;
      return `
        <div class="house-battle-row">
          <div class="house-battle-name">
            <iconify-icon icon="mdi:shield-star" style="color:${color};"></iconify-icon>
            ${r.house}${isLeader ? ' 🏆' : ''}
          </div>
          <div class="house-battle-bar-container">
            <div class="house-battle-bar" style="width:${pct}%; background: linear-gradient(90deg, ${color}, ${T.HOUSES[r.house]?.color || color});">
              ${pct > 15 ? Math.round(pct) + '%' : ''}
            </div>
          </div>
          <div class="house-battle-points">${T.formatPoints(r.points)}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = rows;

    // Stats per house
    const stats = document.createElement('div');
    stats.style.cssText = 'display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px;';
    stats.innerHTML = data.ranked.map(r => {
      const count = data.counts[r.house] || 0;
      const avg = data.averages[r.house] || 0;
      const color = T.HOUSES[r.house]?.color || 'var(--primary)';
      return `
        <div style="background:var(--bg-input); padding:12px; border-radius:var(--radius-md); text-align:center; border-left:3px solid ${color};">
          <div style="font-size:11px; color:var(--text-secondary); font-weight:700; text-transform:uppercase;">${r.house}</div>
          <div style="font-size:18px; font-weight:800; color:var(--text-primary); margin-top:4px;">${T.formatNumber(count)}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">${count} students • avg ${avg}</div>
        </div>
      `;
    }).join('');
    container.appendChild(stats);
  }

  function renderHouseTrendChart(history) {
    const ctx = document.getElementById('houseChart').getContext('2d');
    if (houseChart) houseChart.destroy();

    const months = history.JJT.map(h => {
      const [y, m] = h.month.split('-');
      return new Date(y, m - 1).toLocaleString('en-US', { month: 'short' });
    });

    houseChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: T.HOUSES ? [
          {
            label: 'JJT',
            data: history.JJT.map(h => h.points),
            borderColor: '#004632',
            backgroundColor: 'rgba(0, 70, 50, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#004632'
          },
          {
            label: 'Jensud',
            data: history.Jensud.map(h => h.points),
            borderColor: '#00835c',
            backgroundColor: 'rgba(0, 131, 92, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#00835c'
          },
          {
            label: 'Munir',
            data: history.Munir.map(h => h.points),
            borderColor: '#2ea876',
            backgroundColor: 'rgba(46, 168, 118, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#2ea876'
          }
        ] : []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 11 }, padding: 12 } },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: '#64748b', font: { size: 11 } },
            grid: { color: 'rgba(148, 163, 184, 0.15)' }
          },
          x: {
            ticks: { color: '#64748b', font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderHouseTopStudents(history) {
    // Build top 3 per house from allStudentsCache
    const houses = { JJT: [], Jensud: [], Munir: [] };
    allStudentsCache.forEach(s => {
      if (houses[s.house]) houses[s.house].push(s);
    });

    Object.keys(houses).forEach(h => {
      houses[h].sort((a, b) => b.points - a.points);
    });

    const container = document.getElementById('houseTopList');
    container.innerHTML = '';

    ['JJT', 'Jensud', 'Munir'].forEach(house => {
      const top = houses[house].slice(0, 3);
      if (top.length === 0) return;
      const color = T.HOUSES[house]?.color || 'var(--primary)';

      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom:14px;';
      section.innerHTML = `
        <h4 style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:800; color:${color}; margin-bottom:8px; text-transform:uppercase;">
          <iconify-icon icon="mdi:shield-star"></iconify-icon> ${house}
        </h4>
      `;

      const list = document.createElement('div');
      list.className = 'list-container';
      list.innerHTML = top.map((s, idx) => {
        const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
        const sign = s.points > 0 ? '+' : '';
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        return `
          <div class="list-item rank-item">
            <div class="student-item-left">
              <span class="rank-num" style="background:${color}; color:white;">${medal}</span>
              <div class="student-info-text">
                <div class="name">${T.escapeHtml(s.name)}</div>
                <div class="meta">Grade ${T.escapeHtml(s.class)}</div>
              </div>
            </div>
            <div class="points-badge ${pointClass}">${sign}${T.formatNumber(s.points)}</div>
          </div>
        `;
      }).join('');
      section.appendChild(list);
      container.appendChild(section);
    });
  }

  // === CLASS STATS ===

  async function fetchClassStats() {
    const res = await T.api('getClassStats');
    const container = document.getElementById('classStats');
    if (res.status !== 'success') {
      container.innerHTML = T.emptyState('mdi:school', 'Failed to load data');
      return;
    }

    if (res.classes.length === 0) {
      container.innerHTML = T.emptyState('mdi:school', 'No class data');
      return;
    }

    container.innerHTML = res.classes.map(c => {
      const top = c.top_student;
      return `
        <div class="list-item" style="flex-direction:column; align-items:stretch; gap:10px; cursor:default;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="font-size:15px; color:var(--text-primary);">Grade ${T.escapeHtml(c.class)}</strong>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                ${c.total_students} students • Average ${c.average} points
              </div>
            </div>
            <div class="points-badge ${c.total_points >= 0 ? 'points-positive' : 'points-negative'}">
              ${T.formatPoints(c.total_points)}
            </div>
          </div>
          ${top ? `
            <div style="padding-top:8px; border-top:1px solid var(--border); font-size:12px; color:var(--text-secondary);">
              <iconify-icon icon="mdi:account-star" style="color:var(--warning);"></iconify-icon>
              Top: <strong>${T.escapeHtml(top.name)}</strong> (${T.formatPoints(top.points)})
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // === STUDENTS REPORT ===
  let studentsReportCache = [];

  async function fetchStudentsReport() {
    const levelEl = document.getElementById('studentsLevelFilter');
    const gradeEl = document.getElementById('studentsGradeFilter');
    const houseEl = document.getElementById('studentsHouseFilter');

    if (!levelEl || !gradeEl || !houseEl) return;

    const level = levelEl.value;
    const grade = gradeEl.value;
    const house = houseEl.value;

    const list = document.getElementById('studentsReportList');
    if (list) {
      list.innerHTML = '<div class="skeleton skeleton-list-item" style="height:48px;"></div>'.repeat(5);
    }

    const res = await T.api('getStudentsReport', {
      level: level === 'all' ? '' : level,
      grade: grade === 'all' ? '' : grade,
      house: house === 'all' ? '' : house
    });

    if (res.status !== 'success') {
      if (list) list.innerHTML = T.emptyState('mdi:alert-circle-outline', 'Failed to load students', res.message || 'Try again later');
      studentsReportCache = [];
      return;
    }

    studentsReportCache = res.students || [];
    renderStudentsReport(studentsReportCache, { level, grade, house });
  }

  function renderStudentsReport(students, filters) {
    const list = document.getElementById('studentsReportList');
    if (!list) return;

    if (students.length === 0) {
      list.innerHTML = T.emptyState('mdi:account-search-outline', 'No students found', 'Try changing the filter');
      return;
    }

    // Update count summary
    const summary = document.getElementById('studentsReportSummary');
    if (summary) summary.textContent = `${students.length} student${students.length === 1 ? '' : 's'}`;

    list.innerHTML = students.map((s, idx) => {
      const rank = idx + 1;
      const pointClass = s.points >= 0 ? 'points-positive' : 'points-negative';
      const sign = s.points > 0 ? '+' : '';
      const houseKey = s.house && T.HOUSES[s.house] ? s.house : '';
      let rankBadge = `<span class="rank-num">${rank}</span>`;
      if (rank === 1) rankBadge = `<span class="rank-num gold"><iconify-icon icon="mdi:crown"></iconify-icon></span>`;
      else if (rank === 2) rankBadge = `<span class="rank-num silver"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;
      else if (rank === 3) rankBadge = `<span class="rank-num bronze"><iconify-icon icon="mdi:medal"></iconify-icon></span>`;

      return `
        <div class="list-item rank-item" data-nis="${T.escapeHtml(String(s.nis))}">
          <div class="student-item-left">
            ${rankBadge}
            <div class="student-avatar small house-${houseKey}" data-avatar></div>
            <div class="student-info-text">
              <div class="name">${T.escapeHtml(s.name)}</div>
              <div class="meta">
                <span>NIS: ${T.escapeHtml(String(s.nis))}</span>
                <span>•</span>
                <span>Grade ${T.escapeHtml(String(s.class))}</span>
                ${s.house ? `<span>•</span><span style="color:${T.getHouseColor(s.house)}; font-weight:700;">${T.escapeHtml(s.house)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="points-badge ${pointClass}">${sign}${T.formatNumber(s.points)}</div>
        </div>
      `;
    }).join('');

    // Wire avatars
    list.querySelectorAll('.list-item').forEach((item, i) => {
      const avatar = item.querySelector('[data-avatar]');
      if (avatar && students[i]) {
        avatar.appendChild(T.createAvatar(students[i], 'small'));
      }
    });
  }

  async function exportStudentsReport(type) {
    const levelEl = document.getElementById('studentsLevelFilter');
    const gradeEl = document.getElementById('studentsGradeFilter');
    const houseEl = document.getElementById('studentsHouseFilter');

    if (!levelEl) return;

    const level = levelEl.value;
    const grade = gradeEl.value;
    const house = houseEl.value;

    T.showToast('Preparing data...', 'info', 1500);

    const res = await T.api('getStudentsReport', {
      level: level === 'all' ? '' : level,
      grade: grade === 'all' ? '' : grade,
      house: house === 'all' ? '' : house
    });

    if (res.status !== 'success') {
      T.showToast('Failed to load data', 'error');
      return;
    }

    const students = res.students || [];

    if (students.length === 0) {
      T.showToast('No students match the filter', 'warning');
      return;
    }

    const timestamp = new Date();
    const dateStr = timestamp.toISOString().slice(0, 10);
    const timestampStr = timestamp.toLocaleString('en-US', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const filterLabel = buildStudentsFilterLabel({ level, grade, house });

    if (type === 'excel') {
      exportStudentsToExcel(students, { timestampStr, filterLabel, dateStr });
    } else if (type === 'pdf') {
      exportStudentsToPDF(students, { timestampStr, filterLabel, dateStr });
    }
  }

  function buildStudentsFilterLabel({ level, grade, house }) {
    const parts = [];
    if (level && level !== 'all') parts.push(level === 'JHS' ? 'Junior High (7-9)' : 'Senior High (10-12)');
    if (grade && grade !== 'all') parts.push(`Grade ${grade}`);
    if (house && house !== 'all') parts.push(`House ${house}`);
    return parts.length ? parts.join(' • ') : 'All Levels / All Grades / All Houses';
  }

  function exportStudentsToExcel(students, meta) {
    const rows = students.map((s, idx) => ({
      Rank: idx + 1,
      NIS: s.nis,
      Name: s.name,
      Grade: s.class,
      House: s.house || '',
      'Total Points': s.points
    }));

    // Add a metadata header row
    rows.unshift({
      Rank: `Tunas Mekar Indonesia - Student Report`,
      NIS: '',
      Name: `Filters: ${meta.filterLabel}`,
      Grade: '',
      House: '',
      'Total Points': `Generated: ${meta.timestampStr}`
    });
    rows.unshift({
      Rank: '',
      NIS: '',
      Name: '',
      Grade: '',
      House: '',
      'Total Points': ''
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },   // Rank
      { wch: 14 },  // NIS
      { wch: 32 },  // Name
      { wch: 8 },   // Grade
      { wch: 12 },  // House
      { wch: 14 }   // Total Points
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `Students_TMI_${meta.dateStr}.xlsx`);
    T.showToast(`Excel downloaded (${students.length} students)`, 'success');
  }

  function exportStudentsToPDF(students, meta) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();   // 210
    const pageHeight = doc.internal.pageSize.getHeight(); // 297
    const margin = 14;

    // === Header ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(0, 70, 50);
    doc.text('Tunas Mekar Indonesia', pageWidth / 2, 16, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Student Points Report', pageWidth / 2, 23, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Filters: ${meta.filterLabel}`, pageWidth / 2, 29, { align: 'center' });
    doc.text(`Generated: ${meta.timestampStr}`, pageWidth / 2, 34, { align: 'center' });

    // Decorative line
    doc.setDrawColor(0, 70, 50);
    doc.setLineWidth(0.5);
    doc.line(margin, 38, pageWidth - margin, 38);

    // === Table ===
    const tableBody = students.map((s, idx) => [
      String(idx + 1),
      String(s.nis),
      s.name || '-',
      s.class != null ? String(s.class) : '-',
      s.house || '-',
      (s.points > 0 ? '+' : '') + T.formatNumber(s.points)
    ]);

    doc.autoTable({
      startY: 42,
      margin: { left: margin, right: margin },
      head: [['#', 'NIS', 'Name', 'Grade', 'House', 'Total Points']],
      body: tableBody,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        overflow: 'linebreak',
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [0, 70, 50],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9.5
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'left',   cellWidth: 'auto' },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 22 },
        5: { halign: 'right',  cellWidth: 26 }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        // Color the points cell based on sign
        if (data.section === 'body' && data.column.index === 5) {
          const raw = String(data.cell.raw);
          if (raw.startsWith('+') || (!raw.startsWith('-') && parseInt(raw) > 0)) {
            data.cell.styles.textColor = [22, 163, 74];
          } else if (raw.startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38];
          }
          data.cell.styles.fontStyle = 'bold';
        }
      },
      didDrawPage: (data) => {
        // Footer
        const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Total: ${students.length} students`, margin, pageHeight - 8);
        doc.text(pageStr, pageWidth - margin, pageHeight - 8, { align: 'right' });
        doc.text(`Generated: ${meta.timestampStr}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      },
      pageBreak: 'auto',
      showHead: 'everyPage'
    });

    doc.save(`Students_TMI_${meta.dateStr}.pdf`);
    T.showToast(`PDF downloaded (${students.length} students)`, 'success');
  }

  // === EXPORT ===

  async function exportData(type) {
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;
    const house = document.getElementById('exportHouseFilter').value;

    T.showToast('Preparing data...', 'info', 1500);

    const res = await T.api('exportData', {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      house: house || undefined
    });

    if (res.status !== 'success') {
      T.showToast('Failed to export data', 'error');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);

    if (type === 'excel') {
      const ws = XLSX.utils.json_to_sheet(res.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
      XLSX.writeFile(wb, `Report_TMI_${timestamp}.xlsx`);
      T.showToast(`Excel file downloaded (${res.total} rows)`, 'success');
    } else if (type === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      doc.setFontSize(14);
      doc.setTextColor(0, 70, 50);
      doc.text('Tunas Mekar Indonesia - Points Report', 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Printed: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' })}`, 14, 21);
      if (startDate || endDate) {
        doc.text(`Period: ${startDate || 'start'} - ${endDate || 'now'}`, 14, 26);
      }
      doc.text(`Total: ${res.total} transactions`, 14, 31);

      doc.autoTable({
        startY: 38,
        head: [['Date', 'NIS', 'Name', 'Grade', 'House', 'Points', 'Note']],
        body: res.data.map(d => [d.Date, d.NIS, d.Name, d.Grade, d.House, d.Points, d.Note]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [0, 70, 50], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });
      doc.save(`Report_TMI_${timestamp}.pdf`);
      T.showToast(`PDF file downloaded (${res.total} rows)`, 'success');
    } else if (type === 'csv') {
      const headers = Object.keys(res.data[0] || {});
      const csv = [
        headers.join(','),
        ...res.data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_TMI_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      T.showToast(`CSV file downloaded (${res.total} rows)`, 'success');
    }
  }

  // Expose for inline handlers
  window.switchTab = switchTab;
  window.fetchLeaderboard = fetchLeaderboard;
  window.fetchHistory = fetchHistory;
  window.exportData = exportData;
  window.fetchStudentsReport = fetchStudentsReport;
  window.exportStudentsReport = exportStudentsReport;

})();
